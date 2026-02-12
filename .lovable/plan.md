

# Reset de Dados Importados + Limpeza Automatica ao Desconectar

## Problema

Quando o usuario desconecta uma planilha ou a conta Google, apenas os registros de conexao e tokens sao removidos. Os dados importados (transacoes, DRE, insights, perfis de planilha, agregacoes, jobs) permanecem no banco, causando valores "fantasma" nos menus Dashboard, Receitas, Despesas, Fluxo de Caixa e Previsoes.

## Solucao em 4 Blocos

### Bloco 1 -- Edge Function `reset-sheet-data`

Criar `supabase/functions/reset-sheet-data/index.ts`

**Entrada:**
```json
{
  "connection_id": "uuid" | null,
  "scope": "ALL" | "TRANSACTIONS_ONLY" | "DRE_ONLY"
}
```

- Se `connection_id` fornecido: limpa dados vinculados aquela planilha
- Se `connection_id` nulo: limpa TODOS os dados do usuario (reset total)

**Sequencia de deletes (scope=ALL):**

1. `transactions` WHERE `source_sheet_id = connection_id` (ou `user_id` se reset total)
2. `transaction_flags` WHERE transaction_id in transacoes deletadas (cascade natural se FK existir, senao delete explicito)
3. `financial_daily_aggregates` WHERE `source_sheet_id = connection_id`
4. `dre_lines` WHERE `user_id` (via period_id cascade ou delete direto)
5. `dre_periods` WHERE `sheet_id = connection_id`
6. `dre_values` WHERE `sheet_id = connection_id`
7. `dre_mappings` WHERE `sheet_id = connection_id`
8. `ai_sheet_profiles` WHERE `connected_sheet_id = connection_id`
9. `ai_insights` WHERE `connected_sheet_id = connection_id`
10. `sheet_sync_jobs` WHERE `connection_id = connection_id`
11. `google_sheet_sync_logs` WHERE `connection_id = connection_id`

**Escopo TRANSACTIONS_ONLY:** apenas itens 1-3
**Escopo DRE_ONLY:** apenas itens 4-7

**Retorno:** `{ ok: true, deleted: { transactions: N, dre_lines: N, ... } }`

A funcao usa `service_role` para poder deletar em tabelas onde o frontend nao tem permissao de DELETE (como `sheet_sync_jobs`, `google_sheet_sync_logs`). Valida o JWT do usuario para garantir que so apaga dados dele.

### Bloco 2 -- Integrar Reset no Fluxo de Desconexao

**`deleteConnection` (remover planilha individual):**
1. Chamar `reset-sheet-data` com `connection_id` e `scope=ALL`
2. Somente apos sucesso, deletar o registro da conexao
3. Invalidar todas as queries relevantes (transactions, home-dashboard, sync-jobs, dre, insights)

**`disconnectGoogle` (desconectar conta inteira):**
1. Para cada conexao do usuario, chamar `reset-sheet-data` com `scope=ALL`
2. Somente apos sucesso de todos os resets, deletar tokens e conexoes
3. Invalidar todas as queries

### Bloco 3 -- Botao "Zerar Dados Importados" na UI

Adicionar na pagina Google Sheets, abaixo das conexoes, um botao danger:

- Label: "Zerar Dados Importados"
- Confirmacao em 2 passos: dialog com input "Digite ZERAR para confirmar"
- Ao confirmar: chama `reset-sheet-data` com `connection_id=null` e `scope=ALL` (reset total)
- Apos sucesso: toast "Dados zerados. Pronto para reimportar." + invalidar queries
- O botao fica desabilitado durante execucao

### Bloco 4 -- Invalidacao Completa de Queries

Apos qualquer reset (manual ou automatico), invalidar:
- `["transactions"]`
- `["home-dashboard"]`
- `["sync-jobs"]`
- `["google-sheet-connections"]`
- `["google-oauth-status"]`
- `["dre-periods"]`
- `["dre-lines"]`
- `["balance-sheet"]`
- `["invoices"]`
- `["ai-insights"]`
- `["finance-insights"]`
- `["flagged-transactions"]`
- `["cash-flow"]`

Isso garante que todos os cards/graficos/tabelas refletem estado vazio imediatamente.

## Arquivos Criados/Modificados

| Arquivo | Acao |
|---|---|
| `supabase/functions/reset-sheet-data/index.ts` | Criar (edge function de reset) |
| `supabase/config.toml` | Adicionar `[functions.reset-sheet-data]` |
| `src/hooks/useGoogleSheets.ts` | Modificar `deleteConnection` e `disconnectGoogle` para chamar reset antes |
| `src/pages/GoogleSheetsPage.tsx` | Adicionar botao "Zerar Dados Importados" com confirmacao |

## Detalhes Tecnicos

- A edge function usa `createClient` com `SUPABASE_SERVICE_ROLE_KEY` para poder deletar em tabelas com RLS restritivo (sheet_sync_jobs, google_sheet_sync_logs)
- A funcao valida o JWT do usuario via header Authorization para garantir que so apaga dados do usuario autenticado
- Deletes sao executados em sequencia (nao transacao SQL) para evitar locks longos, mas cada um e idempotente
- Se algum delete falhar, a funcao retorna erro parcial com indicacao de qual tabela falhou
- O campo `source_sheet_id` na tabela `transactions` e usado para filtrar por conexao -- transacoes sem `source_sheet_id` (manuais) NAO sao apagadas
- `dre_lines` sao deletadas via CASCADE do `dre_periods` (period_id FK) ou diretamente por `user_id`
- A confirmacao "Digite ZERAR" previne cliques acidentais
- O fluxo de desconexao e bloqueante: se o reset falhar, a desconexao nao prossegue e o usuario recebe mensagem de erro

