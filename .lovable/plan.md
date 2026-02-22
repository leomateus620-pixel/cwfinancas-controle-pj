

# Plano de Correcao Definitiva do Pipeline de Importacao

## Diagnostico Atual

Analisando o banco de dados e o codigo, identifiquei os seguintes problemas raiz:

| Bug | Impacto | Frequencia |
|---|---|---|
| `cell.trim()` em valores numericos (.xlsx) | 0 linhas importadas, 100% parse_error | Ja corrigido no codigo, precisa re-testar |
| Header detection falha quando header nao esta na linha 1 | Mapeamento errado, linhas skipped como "no_value" | Alto |
| `autoDetectMapping` nao encontra colunas com nomes diferentes dos sinonimos hardcoded | 0 linhas importadas | Medio |
| Ano padrao 2026 aplicado a planilhas de 2025 | Transacoes com datas erradas | Ja corrigido no modal, mas edge function ainda usa inferencia fragil |
| `parseBRL` com dot-only separators (ex: "100.000") classifica como 100 em vez de 100000 | Valores errados | Medio |
| `useHomeDashboard` recalcula metricas independentemente de `usePeriodMetrics` | Inconsistencia entre Home e Dashboard | Alto |
| Formatacoes manuais espalhadas (ex: `toLocaleString` em OverviewPage linha 108-111) | Inconsistencia visual | Baixo |

## Plano de Execucao (4 Fases)

### FASE 1: Correcoes Criticas no Edge Function (sem risco de regressao)

**Arquivo: `supabase/functions/sheets-sync-all-tabs/index.ts`**

1. **Header detection dinamico** -- Nao assumir que o header esta na linha 0. Escanear as primeiras 20 linhas e encontrar a linha com maior numero de colunas nao-vazias que contenha ao menos 2 keywords de header conhecidos (data, valor, descricao, categoria, etc.)

2. **Melhorar `autoDetectMapping`** -- Adicionar mais sinonimos:
   - "conta", "banco" para `account`
   - "tipo de lancamento" para `type`
   - "nome", "razao" para `client_vendor`
   - Matching parcial mais tolerante (ex: "desc." match "description")

3. **Fix `parseBRL` para "100.000"** -- O caso de um unico ponto seguido de exatamente 3 digitos E a parte antes do ponto ter ate 3 digitos ja esta tratado, mas precisa cobrir `str.split(".")[0].length > 3` (ex: "1234.567" nao deve ser tratado como milhar). Verificar e adicionar teste.

4. **Logging detalhado de parse_error** -- Atualmente o catch captura erros mas nao loga o conteudo da linha. Adicionar `console.log` com os primeiros 5 campos da linha para diagnostico.

5. **Converter valores do xlsx para string** de forma mais robusta em toda a cadeia: `extractAmount`, `parseDate`, `isSkippableRow` -- todas as funcoes que recebem `rowObj` devem tratar valores nao-string.

### FASE 2: Single Source of Truth para metricas (Frontend)

**Problema**: `useHomeDashboard` faz seus proprios calculos de income/expense/balance independentemente de `usePeriodMetrics`. Se a logica divergir (ex: filtro de TRANSFER), os numeros entre Home e Dashboard nao batem.

**Solucao**: Refatorar `useHomeDashboard` para consumir `usePeriodMetrics` como fonte unica para KPIs do mes corrente, da mesma forma que `useCashFlow` ja faz.

**Arquivo: `src/hooks/useHomeDashboard.ts`**

- Remover calculo manual de `monthIncome`, `monthExpense` baseado em queries separadas
- Importar e usar `usePeriodMetrics` para os valores operacionais do periodo corrente
- Manter calculos especificos do Home (trend 30d, runway, alerts) que usam dados historicos

**Arquivo: `src/pages/OverviewPage.tsx`**

- Substituir formatacoes manuais `toLocaleString` nas linhas 108-111 por `formatCurrencyBR`

### FASE 3: Audit aprimorado e diagnostico por etapa

**Arquivo: `supabase/functions/sheets-sync-all-tabs/index.ts`**

Adicionar breakdown detalhado dos `skip_reasons`:
- `HEADER_NOT_FOUND` -- nao encontrou linha de header
- `COLUMN_MAP_EMPTY` -- mapping retornou vazio (nenhuma coluna reconhecida)
- `DATE_PARSE_FAIL` -- data nao parseavel (informativo, nao bloqueia)
- `VALUE_PARSE_FAIL` -- valor nao parseavel (registrar o conteudo bruto do campo)
- `HEADER_ROW_DETECTED` -- linha de header repetida
- `TOTAL_ROW_DETECTED` -- linha de totalizacao

Salvar os primeiros 5 erros com o conteudo raw da linha no campo `errors` do `sync_tab_audit` para facilitar diagnostico.

### FASE 4: Testes automatizados

**Arquivo: `src/lib/__tests__/currency.test.ts`** (ampliar)

Adicionar casos de teste:
- `parseBRLToNumber("100.000")` => 100000
- `parseBRLToNumber("(609,65)")` => -609.65
- `parseBRLToNumber("R$ 59.104,18")` => 59104.18
- `parseBRLToNumber(45678)` (numero serial Excel) => 45678 (nao tratar como data)
- `parseBRLToNumber("R$ - 1.234,56")` => -1234.56

**Novo arquivo: `src/lib/__tests__/parseDate.test.ts`**

Exportar `parseDate` do edge function para um modulo compartilhado e testar:
- Serial Excel: 45678 => data valida
- BR format: "29/01/2026" => "2026-01-29"
- ISO: "2026-01-29" => "2026-01-29"
- Short: "29/01/26" => "2026-01-29"

## Arquivos modificados (resumo)

| Arquivo | Tipo de mudanca |
|---|---|
| `supabase/functions/sheets-sync-all-tabs/index.ts` | Header detection dinamico, sinonimos, logging, breakdown de skip_reasons |
| `src/hooks/useHomeDashboard.ts` | Usar `usePeriodMetrics` como fonte unica |
| `src/pages/OverviewPage.tsx` | Substituir `toLocaleString` por `formatCurrencyBR` |
| `src/lib/__tests__/currency.test.ts` | Ampliar cobertura de testes |
| `src/lib/__tests__/parseDate.test.ts` | Novo: testes para parseDate |

## O que NAO sera alterado (para evitar regressao)

- Pipeline DRE (`dre-sync/index.ts`) -- funciona independentemente e ja tem parser LCF separado
- `usePeriodMetrics` -- ja e a fonte unica, nao precisa de mudanca
- `useCashFlow` -- ja consome `usePeriodMetrics` corretamente
- `useTransactions` -- estavel, sem alteracao
- Classificacao `movement_type` / `detectMovementType` -- ja implementada e funcional
- Batch upsert / idempotencia -- ja funcional com `external_row_key`

## Ordem de execucao

1. Fase 1: Correcoes no edge function (deploy + teste real)
2. Fase 4: Testes (rodar para validar Fase 1)
3. Fase 2: Single source of truth no frontend
4. Fase 3: Audit aprimorado

Cada fase e independente e testavel isoladamente.

