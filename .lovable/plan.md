

## Diagnóstico Técnico de Performance

### Gargalos Identificados (por impacto)

**1. CRÍTICO — Cascata de queries duplicadas de transações**

A página Overview (`OverviewPage`) renderiza:
- `KPIGrid` → `usePeriodMetrics()` (2 queries: current + previous period)
- `RevenueChart` → `useTransactions({ excludeTransfers: true })` (1 query — `.select("*")`, sem limite)
- `ExpenseChart` → `useTransactions({ type: "expense" })` (1 query — `.select("*")`, sem limite)
- `ProfitDistributionChart` → `useTransactions({ type: "income" })` (1 query — `.select("*")`, sem limite)
- `RecentTransactions` → `useTransactions()` (1 query — `.select("*")`, sem limite, SEM filtro de tipo)

Total: **7 queries paralelas** na mesma página, a maioria carregando **todas as colunas** (`select("*")`) e **sem limite de linhas** (default 1000 do PostgREST, mas `usePeriodMetrics` pede 5000).

Com 5.500 linhas, cada query retorna ~367 linhas/mês. Com `select("*")`, cada linha carrega `raw_data` (JSONB pesado), `content_hash`, `stable_key`, `external_row_key` — campos irrelevantes para exibição.

**2. CRÍTICO — `useTransactions` sem paginação nem limite**

O hook `useTransactions` faz `select("*")` sem `.limit()`. Com o preset "6m" (padrão), retorna potencialmente 2.500-3.000 linhas de transações com todas as colunas. Páginas como Income e Expenses renderizam TODAS essas linhas em uma tabela HTML sem virtualização.

**3. ALTO — HomePage faz 5+ queries separadas**

`useHomeDashboard` chama:
- `useTransactions()` 2x (mês atual + mês anterior) — cada uma com `select("*")`
- `useInvoices()` sem filtro (todas as invoices)
- `useSyncStatus()` 
- Query separada para DRE profit quality

**4. ALTO — `useCashFlow` duplica dados**

`useCashFlow` chama `useTransactions()` (sem filtro de tipo = todas as transações) E `usePeriodMetrics()` separadamente. Os dois hooks carregam basicamente os mesmos dados.

**5. MÉDIO — Tabelas renderizam listas inteiras sem virtualização**

`IncomePage` e `ExpensesPage` renderizam `filteredData.map(...)` diretamente no DOM — com 500+ linhas, isso cria centenas de nós DOM simultaneamente.

**6. MÉDIO — Falta de índices no banco**

A tabela `transactions` é consultada por `date`, `type`, `movement_type`, `category`, `user_id` — mas não há índices compostos otimizados para essas combinações frequentes.

**7. BAIXO — Busca textual sem debounce**

Income e Expenses pages fazem `searchTerm` filtering em `onChange` direto, recalculando `filteredData` a cada keystroke.

---

### Plano de Otimização

#### Fase 1 — Banco de Dados (índices)

Criar índices compostos na tabela `transactions` para as queries mais frequentes:

```sql
CREATE INDEX idx_transactions_user_date ON transactions(user_id, date DESC);
CREATE INDEX idx_transactions_user_type_date ON transactions(user_id, type, date DESC);
CREATE INDEX idx_transactions_user_movement_date ON transactions(user_id, movement_type, date DESC);
```

#### Fase 2 — `useTransactions` com paginação e select otimizado

1. **Restringir colunas**: Trocar `.select("*")` por `.select("id, type, description, amount, category, date, client_vendor, movement_type")` — elimina `raw_data`, `content_hash`, `stable_key`, `notes`, etc.
2. **Adicionar `.limit()`**: Default de 1000 para listagens, com opção de paginação.
3. **Aumentar `staleTime`**: De 30s (default global) para 60s no hook de transações.

#### Fase 3 — Consolidar queries na OverviewPage

1. Fazer `RevenueChart`, `ExpenseChart`, `ProfitDistributionChart` e `RecentTransactions` consumirem dados de `usePeriodMetrics` via context/prop drilling em vez de cada um chamar `useTransactions()` separadamente.
2. Criar um hook `useOverviewData` que faz UMA query e distribui os dados para os 4 componentes.

#### Fase 4 — Paginação nas tabelas de Income/Expenses

1. Implementar paginação client-side (50 linhas por página) nas tabelas de `IncomePage` e `ExpensesPage`.
2. Adicionar debounce de 300ms no campo de busca.
3. Memoizar componentes de linha da tabela com `React.memo`.

#### Fase 5 — Otimizar HomePage

1. `useHomeDashboard` já seleciona colunas corretas para as queries de DRE, mas as chamadas a `useTransactions` usam `select("*")`. Trocar para passagem de colunas restritas.
2. Consolidar `currTx` e `prevTx` em uma única query com range expandido (2 meses) e filtrar client-side.

#### Fase 6 — Otimizar `useCashFlow`

Eliminar a dependência dupla: `useCashFlow` não precisa chamar `useTransactions()` + `usePeriodMetrics()` separadamente. Utilizar apenas os dados de `useTransactions` (já filtrados pelo date range global) e calcular totais localmente.

### Arquivos Modificados

| Arquivo | Mudança |
|---|---|
| Migration SQL | 3 índices compostos em `transactions` |
| `src/hooks/useTransactions.ts` | Select de colunas específicas, `.limit(1000)`, `staleTime: 60000` |
| `src/pages/IncomePage.tsx` | Paginação (50/página), debounce na busca |
| `src/pages/ExpensesPage.tsx` | Paginação (50/página), debounce na busca |
| `src/hooks/useHomeDashboard.ts` | Consolidar 2 queries de transações em 1 |
| `src/hooks/useCashFlow.ts` | Remover chamada duplicada a `usePeriodMetrics` |
| `src/pages/OverviewPage.tsx` + componentes filhos | Criar `useOverviewData` hook que centraliza dados para os 4 componentes |
| `src/components/dashboard/RevenueChart.tsx` | Receber dados via props em vez de chamar `useTransactions` |
| `src/components/dashboard/ExpenseChart.tsx` | Receber dados via props em vez de chamar `useTransactions` |
| `src/components/dashboard/ProfitDistributionChart.tsx` | Receber dados via props em vez de chamar `useTransactions` |
| `src/components/dashboard/RecentTransactions.tsx` | Receber dados via props em vez de chamar `useTransactions` |

### Ganhos Esperados

- **Queries por navegação**: Overview de ~7 para 2-3 queries
- **Payload por query**: Redução de ~60% (eliminando `raw_data`, `content_hash`, etc.)
- **DOM nodes em tabelas**: De 500+ linhas para 50 por página
- **Tempo de resposta do banco**: Melhora com índices compostos para range queries por data
- **Responsividade de busca**: Debounce elimina recálculos a cada keystroke

### Riscos e Mitigações

- **Risco**: Componentes que dependem de campos removidos do select → **Mitigação**: Auditar todos os usos de `Transaction` antes de restringir colunas
- **Risco**: Paginação pode esconder dados → **Mitigação**: Mostrar contagem total e permitir expandir
- **Segurança**: Nenhuma alteração em RLS, lógica financeira ou fluxo de importação

