
# Correcao Definitiva: Bug "Data como Valor"

## Causa Raiz Confirmada

O `autoDetectMapping` esta mapeando colunas erradas:

```
Mapeamento ATUAL (errado):
  amount:  " Valor "    (com espacos - OK parcial)
  credit:  "Banco"      (ERRADO - "Banco" nao e credito!)
  debit:   "Data"       (ERRADO - coluna de DATA mapeada como DEBITO!)
  date:    "Data"       (OK)
```

Na funcao `extractAmount`, credit/debit sao verificados ANTES de amount. O fluxo:
1. `creditRaw = "UNICRED"` (nome do banco) -> `parseBRL` retorna null -> 0
2. `debitRaw = "30/01/2026"` (data!) -> `parseBRL` remove letras, pega "30" -> retorna 30
3. `debit = 30, credit = 0` -> retorna `{value: 30, type: "expense"}`
4. A coluna real `" Valor "` com `" R$ 459,69 "` NUNCA e consultada

Dados reais na planilha (raw_data confirmado):
```
" Valor ": " R$  459,69 "   <- valor REAL (ignorado)
"Data": "30/01/2026"         <- usado como VALOR (bug!)
"Banco": "UNICRED"           <- usado como credito (errado)
```

---

## Solucao (3 correcoes independentes)

### Correcao 1: autoDetectMapping - Evitar falsos positivos

O mapeamento de `credit` e `debit` esta muito agressivo. "Banco" nao e credito. "Data" nao e debito.

**Mudancas:**
- Remover keywords genericas como "c" e "d" que podem casar com qualquer coisa
- Adicionar normalizacao de espacos nos headers ANTES de comparar
- Exigir match mais preciso (palavra inteira, nao substring parcial)
- NUNCA mapear a mesma coluna para dois campos diferentes (se "Data" ja mapeou para `date`, nao pode mapear para `debit`)

### Correcao 2: extractAmount - Priorizar coluna `amount` e validar

**Mudancas:**
- Trocar a ordem: tentar `amount` PRIMEIRO, depois credit/debit
- Adicionar validacao: se o valor parseado de credit/debit "parece data" (1-31 e bate com o dia), rejeitar
- Normalizar nomes de coluna (trim spaces) antes de buscar no rowObj
- Remover o "last resort scan" (linhas 386-396) que varre TODAS as colunas - isso e perigoso

### Correcao 3: parseBRL - Rejeitar strings que sao datas

**Mudancas:**
- Antes de parsear, verificar se a string contem padrao de data (DD/MM/YYYY, YYYY-MM-DD)
- Se detectar data, retornar null imediatamente

### Correcao 4: Reprocessar dados corrompidos

**Mudancas no edge function:**
- Apos sync, detectar padrao "date-as-value" (20+ linhas com amount == day-of-date)
- Se detectado, limpar mapping de credit/debit e re-sincronizar

**Job de reparo no banco:**
- Identificar transacoes onde `amount` esta entre 1-31 e `amount == extract(day from date)`
- Re-extrair valor correto do campo `raw_data` que ja esta salvo no banco
- Atualizar registros sem duplicar

---

## Arquivos a Modificar

### 1. `supabase/functions/google-sheets-sync/index.ts`

**autoDetectMapping (linha 289-317):**
- Normalizar headers com `.trim()` antes de comparar
- Impedir mapeamento duplo (mesma coluna para 2 campos)
- Refinar keywords de credit/debit (remover "c", "d" isolados)
- Adicionar verificacao: credit/debit so mapeia se coluna NAO esta mapeada para date/description

**extractAmount (linha 323-397):**
- Tentar `mapping.amount` PRIMEIRO (antes de credit/debit)
- Normalizar keys do rowObj com `.trim()` para casar com headers com espacos
- Adicionar `looksLikeDate()` check antes de aceitar valor de credit/debit
- REMOVER o "last resort scan" que varre todas as colunas (perigoso demais)

**parseBRL (linha 77-173):**
- Adicionar deteccao de padrao de data no inicio (DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD)
- Se detectar data, retornar null imediatamente

**Novo: funcao `looksLikeDate(value)`:**
- Retorna true se o valor contem padrao DD/MM/YYYY ou similar
- Usada como guard em extractAmount

**Novo: funcao `normalizeRowKeys(rowObj)`:**
- Faz `.trim()` em todas as keys do objeto de linha
- Resolve o problema de `" Valor "` vs `"Valor"`

**Novo: deteccao de "date-as-value" pos-sync:**
- Apos processar todas as linhas, verificar se 20+ linhas tem amount == day(date)
- Se sim, log de alerta + limpar credit/debit do mapping + re-sync

### 2. Job de Reparo (SQL via edge function ou inline)

Identificar e corrigir transacoes ja importadas erradas:
```sql
-- Transacoes onde amount = day(date) e raw_data tem valor real diferente
SELECT id, amount, date, raw_data
FROM transactions
WHERE amount BETWEEN 1 AND 31
AND EXTRACT(DAY FROM date) = amount
AND source = 'sheets'
```

Para cada uma, re-extrair o valor de `raw_data` usando o campo correto (` Valor `) com `parseBRL`.

### 3. `supabase/functions/sheets-preview-mapping/index.ts`

Aplicar as mesmas correcoes de normalizacao de headers e extractAmount para manter preview consistente com sync.

---

## Resultado Esperado

**Antes:**
```
amount: 30, date: 2026-01-30  (DIA do mes!)
amount: 29, date: 2026-01-29  (DIA do mes!)
```

**Depois:**
```
amount: 459.69, date: 2026-01-30, type: income
amount: 5863.06, date: 2026-01-29, type: income
amount: 2453.21, date: 2026-01-28, type: expense
```

---

## Validacoes Anti-Regressao

1. `parseBRL("30/01/2026")` deve retornar `null` (e uma data, nao um valor)
2. `parseBRL(" R$  459,69 ")` deve retornar `459.69`
3. `parseBRL(" R$  (2.453,21)")` deve retornar `-2453.21`
4. `autoDetectMapping` nunca deve mapear mesma coluna para 2 campos
5. `extractAmount` deve priorizar coluna `amount` sobre credit/debit
6. Apos sync, nenhuma transacao deve ter amount == day(date) em massa
