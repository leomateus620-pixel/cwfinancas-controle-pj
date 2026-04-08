

## Plano: Corrigir Limpeza Incompleta de Dados ao Desconectar Planilha

### Diagnóstico

O `reset-sheet-data` **não limpa** várias tabelas que acumulam dados. Para o usuário principal (`ae3ae0d0`), que não tem planilha conectada, restam:

| Tabela | Registros órfãos | Motivo |
|--------|-------------------|--------|
| `transactions` | 6 | `source_sheet_id = NULL` — o reset só apaga onde `source_sheet_id IS NOT NULL` |
| `forecast_monthly` | 22 | Tabela **nunca** é limpa pelo reset |
| `invoices` | 2 | Tabela **nunca** é limpa pelo reset |
| `credit_card_cycles` | 46 | Tabela **nunca** é limpa pelo reset |
| `credit_card_transactions` | 464 | Tabela **nunca** é limpa pelo reset |
| `credit_card_review_queue` | 55 | Tabela **nunca** é limpa pelo reset |

### Causa Raiz

A edge function `reset-sheet-data` foi criada antes das features de Cartão de Crédito e Previsões Financeiras. Essas tabelas simplesmente não foram incluídas no fluxo de limpeza. Além disso, transações com `source_sheet_id = NULL` (inseridas por scripts ou importações avulsas) escapam do filtro.

### Correção

#### 1. Atualizar `reset-sheet-data` para limpar as tabelas faltantes

Adicionar ao escopo de limpeza (quando `scope = "ALL"`):

- **`credit_card_transactions`** — deletar por `user_id` (e opcionalmente filtrar por `cycle_id` de ciclos da conexão)
- **`credit_card_cycles`** — deletar por `user_id` + `connection_id`
- **`credit_card_review_queue`** — deletar por `user_id`
- **`forecast_monthly`** — deletar por `user_id` + `sheet_id` (ou `sheet_id IS NULL` para dados avulsos)
- **`forecast_insights`** — deletar por `user_id` + `sheet_id`
- **`invoices`** — deletar por `user_id`

Quando `connectionId` é fornecido:
- `credit_card_cycles` → filtrar por `connection_id`
- `credit_card_transactions` → deletar onde `cycle_id` pertence aos ciclos daquela conexão
- `forecast_monthly` / `forecast_insights` → filtrar por `sheet_id = connectionId`

Quando `connectionId` é NULL (reset total):
- Deletar tudo do `user_id`

#### 2. Corrigir o filtro de transações órfãs

Atualmente o reset total faz:
```sql
DELETE FROM transactions WHERE user_id = X AND source_sheet_id IS NOT NULL
```

Isso deixa transações com `source_sheet_id = NULL` (inseridas por scripts). No reset total, deve deletar **todas** as transações do usuário:
```sql
DELETE FROM transactions WHERE user_id = X
```

Manter o filtro `source_sheet_id IS NOT NULL` apenas quando um `connectionId` específico é fornecido.

#### 3. Ordenar as deleções para respeitar dependências

Ordem correta:
1. `credit_card_review_queue` (depende de transactions)
2. `credit_card_transactions` (depende de cycles)
3. `credit_card_cycles`
4. `transaction_flags`
5. `transactions`
6. Demais tabelas existentes
7. `forecast_monthly`
8. `forecast_insights`
9. `invoices`

### Arquivos

| Ação | Arquivo |
|------|---------|
| Editar | `supabase/functions/reset-sheet-data/index.ts` (adicionar 6 tabelas + corrigir filtro órfão) |

### Escopo restrito
- Zero novas tabelas ou migrações
- Zero alteração em código frontend
- Zero impacto em outros menus — apenas a lógica de limpeza
- Retrocompatível: o payload e retorno da função não mudam

