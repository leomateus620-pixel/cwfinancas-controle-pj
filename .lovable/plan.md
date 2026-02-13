
# Correcao Definitiva da Importacao: 100% das Linhas com Valor

## Diagnostico Confirmado

Analisei o codigo completo da funcao `sheets-sync-all-tabs` e identifiquei **5 causas-raiz** para a importacao parcial (462 de 1.024 linhas):

### Causa 1: Range fixo `A1:Z1000`
Linha 546 do edge function: `const range = "'${tab.title}'!A1:Z1000"`. Se uma aba tiver mais de 999 linhas de dados, as excedentes sao ignoradas silenciosamente.

### Causa 2: Operacoes row-by-row (PRINCIPAL)
Para cada linha, o sistema faz 2 chamadas ao banco:
1. `SELECT id FROM transactions WHERE external_row_key = ...`
2. `INSERT` ou `UPDATE`

Para 1.024 linhas = ~2.048 chamadas ao banco. Com latencia de ~50ms por chamada = ~102 segundos. O timeout interno e de 110s, resultando em `status: partial` ou `timeout` antes de processar todas as abas.

### Causa 3: Skip agressivo
- `amount === 0` e descartado (linha 587)
- Linhas com "total", "saldo", "subtotal" na descricao sao descartadas, mesmo que tenham valor valido
- Linhas sem descricao sao descartadas pelo `isSkippableRow`

### Causa 4: Sem auditoria
Nao existe registro de quantas linhas foram detectadas vs importadas por aba. Linhas "somem" silenciosamente.

### Causa 5: Year default incorreto
`defaultYear = new Date().getFullYear()` retorna 2026, mas a planilha e de 2025. Isso pode causar `periodKey` errado (ex: "2026-07" em vez de "2025-07"), gerando conflito com `month_range`.

## Solucao

### Bloco 1 -- Reescrever `sheets-sync-all-tabs/index.ts`

**1A. Leitura paginada (lastRow real)**

Em vez de `A1:Z1000`, implementar leitura paginada:
- Primeiro, ler metadados da aba para descobrir `rowCount` real via `sheets.properties.gridProperties.rowCount`
- Ler em batches de 500 linhas: `A1:Z500`, `A501:Z1000`, etc.
- Continuar ate encontrar batch inteiro sem valor parseavel na coluna Valor

**1B. Batch upsert (eliminar timeout)**

Substituir SELECT+INSERT/UPDATE individual por batch processing:
- Acumular transacoes em array (batch de 50)
- Buscar `external_row_key` existentes com um unico SELECT `IN (...)` 
- Fazer upsert em lote com `ON CONFLICT (external_row_key)` via SQL direto ou batch insert
- Reducao estimada: de ~2.048 chamadas para ~40 chamadas (50x mais rapido)

**1C. Regras de importacao relaxadas**

Criterio unico para importar: **Valor parseavel e diferente de null**
- Permitir amount = 0 (raro, mas valido)
- NAO descartar por descricao vazia (usar "Sem descricao")
- NAO descartar por categoria vazia (usar "Geral")
- NAO descartar linhas com "total" se tiverem data valida (totais reais nao tem data)
- Manter protecao contra header repetido (>= 3 colunas match header keywords)

**1D. Year inference inteligente**

Em vez de `defaultYear = new Date().getFullYear()`:
- Extrair ano do nome da planilha (regex `\b(20\d{2})\b`)
- Fallback: ano da maioria das datas encontradas na primeira aba processada
- Fallback final: ano atual

**1E. Auditoria por aba (`sync_audit`)**

Registrar para cada aba:
- `rows_scanned`: total de linhas lidas (excluindo header)
- `rows_with_value`: linhas onde Valor parseou como numero
- `rows_imported`: linhas efetivamente inseridas/atualizadas
- `rows_skipped`: linhas sem valor parseavel
- `skip_reasons`: contagem por motivo (no_value, header_row, empty_row)

### Bloco 2 -- Criar tabela `sync_tab_audit`

Nova tabela para rastrear importacao por aba:

```text
sync_tab_audit
  id           uuid PK
  job_id       uuid FK -> sheet_sync_jobs
  user_id      uuid
  connection_id uuid
  tab_name     text
  period_key   text
  rows_scanned int
  rows_with_value int
  rows_imported int
  rows_skipped int
  skip_reasons jsonb  -- {"no_value": 45, "header_row": 1, "empty": 3}
  errors       jsonb
  created_at   timestamptz
```

RLS: usuarios veem apenas seus proprios registros.

### Bloco 3 -- Ajustar `isSkippableRow` (mais permissivo)

Regra atual (muito agressiva):
- Descarta qualquer linha com "total" na descricao

Nova regra (precisa):
- Descartar SOMENTE se: nao tem data valida E descricao contem keyword de totalizacao
- Linhas com data valida + "total" na descricao = importar normalmente (pode ser uma transacao real chamada "Total Servicos")

### Bloco 4 -- Ajustar queries do Dashboard (Supabase 1000-row limit)

O `usePeriodMetrics` faz `SELECT` sem `.limit()`, mas o Supabase tem limite default de 1000 rows. Com 1.024 transacoes, 24 serao cortadas silenciosamente.

Correcao: adicionar `.limit(5000)` explicitamente ou usar paginacao no hook para garantir todas as transacoes.

### Bloco 5 -- UI de Auditoria no GoogleSheetsPage

Adicionar na secao de historico de sync:
- Tabela mostrando por aba: "Detectadas | Importadas | Diferenca"
- Se diferenca > 0: badge vermelho "FALHA"
- Se diferenca = 0: badge verde "OK"

## Arquivos Criados/Modificados

| Arquivo | Acao |
|---|---|
| `supabase/functions/sheets-sync-all-tabs/index.ts` | Reescrever: paginacao, batch upsert, audit, year inference |
| Migration SQL | Criar tabela `sync_tab_audit` |
| `src/hooks/usePeriodMetrics.ts` | Adicionar `.limit(5000)` nas queries |
| `src/hooks/useSyncAudit.ts` | Criar hook para ler auditoria por aba |
| `src/pages/GoogleSheetsPage.tsx` | Adicionar secao de auditoria por aba |
| `src/components/sheets/SyncAuditTable.tsx` | Componente de tabela de auditoria |

## Detalhes Tecnicos

### Batch Upsert (pseudocodigo)

```text
// Acumular linhas parseadas
const batch: TransactionData[] = [];

for (row of allRows) {
  const amount = parseBRL(row[valorCol]);
  if (amount === null) { audit.no_value++; continue; }
  batch.push({ ...transactionData, external_row_key });
}

// Buscar existentes em 1 query
const existingKeys = await supabase
  .from("transactions")
  .select("external_row_key")
  .eq("user_id", userId)
  .eq("source_sheet_id", connectionId)
  .in("external_row_key", batch.map(b => b.external_row_key));

// Separar inserts vs updates
const toInsert = batch.filter(b => !existingSet.has(b.external_row_key));
const toUpdate = batch.filter(b => existingSet.has(b.external_row_key));

// Insert em lotes de 50
for (chunk of chunks(toInsert, 50)) {
  await supabase.from("transactions").insert(chunk);
}
// Update em lotes
for (chunk of chunks(toUpdate, 50)) {
  await supabase.from("transactions").upsert(chunk, { onConflict: "user_id,source_sheet_id,external_row_key" });
}
```

### Protecao contra confusao data/valor

O `parseBRL` existente ja rejeita strings com formato de data. Manter essa protecao e adicionar log quando ativada (para auditoria).

### Impacto na performance

- Leitura: ~2-3 chamadas a Google Sheets API por aba (vs 1 atual) -- insignificante
- Escrita no banco: ~40 chamadas total (vs ~2.048 atual) -- **50x mais rapido**
- Tempo estimado total: ~15-20 segundos para 1.024 linhas em 9 abas (vs timeout atual)

### Unique constraint necessaria

Para que o batch upsert funcione com `ON CONFLICT`, sera necessario criar um unique index:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_external_row_key_unique
ON transactions (user_id, source_sheet_id, external_row_key)
WHERE external_row_key IS NOT NULL;
```

## Criterio de Sucesso

1. Sync da planilha "Tarifa Zero 2025" (Abr-Dez): detectadas = 1.024, importadas = 1.024
2. Dashboard mostra receitas e despesas corretas para todo o periodo
3. Auditoria visivel na UI com contagem por aba
4. Nenhuma importacao parcial silenciosa
