

## Plano: Corrigir importacao completa de Contas a Pagar (35 contas)

### Problema raiz

Os logs revelam **dois erros** que derrubam batches inteiros do upsert:

1. **"date/time field value out of range: 2026-02-30"** — Quando "Dia 30" e construida com fevereiro, gera data invalida `2026-02-30`. O batch inteiro falha.

2. **"ON CONFLICT DO UPDATE command cannot affect row a second time"** — O content_hash e gerado com `(type + period + description + counterpart + amount)`. Como `counterpart = description`, se dois fornecedores diferentes tiverem o mesmo nome com o mesmo valor no mesmo mes, ou se a mesma linha gerar registros duplicados, o batch falha.

Resultado: dos 114 records parseados, apenas 50 sobrevivem (batches com erros sao descartados inteiros, perdendo ~64 registros).

### Solucao

**Arquivo**: `supabase/functions/sheets-sync-all-tabs/index.ts`

#### 1. Validar datas antes do upsert
Quando "Dia XX" + mes gera data invalida (ex: Dia 30 + fev, Dia 31 + abr), limitar o dia ao ultimo dia valido do mes usando logica simples:

```typescript
// Antes de construir a data
const maxDay = new Date(mc.year, mc.month, 0).getDate(); // ultimo dia do mes
const safeDay = Math.min(diaNumber, maxDay);
dueDate = `${mc.year}-${monthStr}-${String(safeDay).padStart(2, "0")}`;
```

#### 2. Incluir source_row no content_hash
O hash atual nao distingue dois fornecedores na mesma linha de planilha com valores iguais. Adicionar `source_row` ao hash garante unicidade:

```typescript
function generateAPRContentHash(recordType, periodKey, description, counterpart, amount, sourceRow) {
  return generateRowHash({
    t: recordType,
    p: periodKey,
    d: (description || "").toLowerCase().trim().replace(/\s+/g, " "),
    c: (counterpart || "").toLowerCase().trim(),
    a: Math.round(amount * 100),
    r: sourceRow || 0,  // novo campo
  });
}
```

Atualizar a chamada na linha 2379 para passar `r.source_row`.

#### 3. Deduplicar batch antes do upsert
Como protecao adicional, filtrar duplicatas de content_hash dentro do mesmo batch antes de enviar ao banco (manter a ultima ocorrencia):

```typescript
const deduped = new Map();
for (const rec of upsertBatch) {
  deduped.set(rec.content_hash, rec);
}
const finalBatch = Array.from(deduped.values());
```

### O que nao muda
- Nenhum fluxo de transacoes mensais, DRE ou forecast
- Nenhuma alteracao no frontend
- Layout vertical e block nao sao afetados (usam a mesma funcao de hash, que sera melhorada)

### Resultado esperado
- Datas invalidas corrigidas (Dia 30 fev → 28 fev)
- Sem colisoes de hash no batch
- Todos os ~35 fornecedores importados corretamente por mes

