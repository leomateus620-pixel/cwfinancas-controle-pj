# Correção: valor da demanda não chega ao Asana

## Diagnóstico

Na demanda atual, o cliente escreveu **"1400 reais"** mas:

1. No card "Dados financeiros" o campo **VALOR** aparece como `—` (a coluna `amount` foi gravada como `null`).
2. No Asana, a seção "INFORMAÇÕES IDENTIFICADAS AUTOMATICAMENTE" mostra `Valores citados: Não informado`.

Causas no código:

- `src/lib/demands/interpretFreeText.ts` só reconhece valores no formato `R$ ...` (regex `AMOUNT_RE = /R\$\s*[\d.]+(?:,\d{1,2})?/g`). Frases como "1400 reais", "mil e quinhentos reais" ou "1.400,00" não são capturadas.
- `src/components/demands/new/QuickDemandForm.tsx` chama `useCreateDemand` **sem enviar `amount` nem `due_date`**, mesmo quando o texto contém esses dados. Por isso o card financeiro fica vazio.
- A edge `asana-create-task`/`asana-update-task` apenas reflete o que recebeu, então a falha é a montante.

## O que vai ser feito

### 1. Reforçar `interpretFreeText.ts`
- Aceitar valores em vários formatos PT-BR:
  - `R$ 1.400,00`, `R$ 1400`, `R$1.400,50`
  - `1.400,00 reais`, `1400 reais`, `1400,00 reais`
  - `mil reais`, `dois mil reais`, `mil e quinhentos reais` (lista pequena de números por extenso até "dez mil")
- Adicionar `amount_numeric: number | null` na interpretação (primeiro valor reconhecido, convertido para `number` com `round(.., 2)`).
- Normalizar `amounts: string[]` para sempre exibir como `R$ X.XXX,XX` (Intl).
- Reforçar `DATE_RE` para também capturar `dd/mm/aaaa`, `dd-mm`, e extrair `due_date_iso: string | null` (ISO `YYYY-MM-DD`) quando houver uma data clara (preferência pela primeira data futura ou próxima).
- Não inventar dados: se nada bate, mantém `null` / arrays vazios.

### 2. `QuickDemandForm.tsx`
- Após `interpretDemand`, repassar para `useCreateDemand`:
  - `amount: interpretation.amount_numeric ?? null`
  - `due_date: interpretation.due_date_iso ?? null`
- Continuar gravando a interpretação completa em `requester_metadata.interpretation` (string JSON), agora já contendo `amount_numeric` e `due_date_iso`.

### 3. Edge functions Asana (`asana-create-task` e `asana-update-task`)
- No bloco "🔎 INFORMAÇÕES IDENTIFICADAS AUTOMATICAMENTE":
  - Quando `amount` da demanda existir, mostrar **`Valor identificado: R$ X.XXX,XX`** como primeira linha (usa `fmtBRL(demand.amount)`).
  - Caso contrário, manter `Valores citados:` baseado em `interpretation.amounts`.
  - Adicionar `Vencimento identificado: dd/mm/aaaa` quando `demand.due_date` existir.
- Garantir que o título da task inclua o valor quando houver: `"<tipo> — <empresa> — R$ X.XXX,XX"` (opcional, mas ajuda a equipe).
- Não mudar layout dos demais blocos.

### 4. Validação
- Testar com strings: "1400 reais", "R$ 1.400,00", "mil reais", "vence em 25/05/2026 no valor de 2500 reais", e descrição sem valor algum.
- Verificar no detalhe da demanda (card "Dados financeiros") e na task gerada no Asana.

## Arquivos afetados

- `src/lib/demands/interpretFreeText.ts` (regex + extração numérica + data ISO)
- `src/components/demands/new/QuickDemandForm.tsx` (envia `amount` e `due_date`)
- `supabase/functions/asana-create-task/index.ts` (notas + título)
- `supabase/functions/asana-update-task/index.ts` (notas + título)

Sem alterações de schema, RLS ou UI fora dessa correção.
