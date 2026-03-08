

## Plan: Corrigir persistência de dados APR após desconexão

### Problema identificado

A Edge Function `reset-sheet-data` — que é chamada automaticamente ao desconectar uma planilha — **não deleta registros da tabela `accounts_payable_receivable`**. Isso faz com que dados de contas a pagar/receber da planilha antiga permaneçam no banco mesmo após a desconexão. Quando uma nova planilha é conectada, os dados antigos continuam aparecendo.

Além disso, as tabelas `bank_balances` e `sync_tab_audit` também não são limpas pelo reset.

### Solução

Adicionar a limpeza de `accounts_payable_receivable`, `bank_balances` e `sync_tab_audit` na função `reset-sheet-data`.

### Arquivo a modificar

| Arquivo | Escopo |
|---------|--------|
| `supabase/functions/reset-sheet-data/index.ts` | Adicionar delete de `accounts_payable_receivable`, `bank_balances` e `sync_tab_audit` no bloco `shouldDeleteTransactions` / `scope === "ALL"` |

### Mudança detalhada

Na função `reset-sheet-data/index.ts`, dentro do bloco `shouldDeleteTransactions`, adicionar após a limpeza de `financial_daily_aggregates`:

1. **`accounts_payable_receivable`**: deletar por `connection_id` (se fornecido) ou por `user_id` (reset total)
2. **`bank_balances`**: deletar por `source_sheet_id` (se fornecido) ou por `user_id`

No bloco `scope === "ALL"`, adicionar:

3. **`sync_tab_audit`**: deletar por `user_id` (sempre no reset total)

### O que NÃO muda
- Lógica do hook `usePayableReceivable`
- Lógica de importação (`sheets-sync-all-tabs`)
- Frontend da página de Contas

