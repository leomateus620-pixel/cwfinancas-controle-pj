

# Restringir Home ao mês vigente com comparação via query separada

## Problema

O `homeStart` foi alterado para buscar 60 dias de transações, mas o requisito é que a Home exiba SOMENTE dados do mês corrente (ex: 1 Fev - 28 Fev). A comparação "% vs mês anterior" ainda precisa funcionar.

## Solução

Usar DUAS chamadas `useTransactions` no hook `useHomeDashboard.ts`:

1. **Query principal (mês corrente):** `startOfMonth(now)` até `endOfMonth(now)` -- alimenta KPIs, categorias, alertas
2. **Query secundária (mês anterior):** `startOfMonth(subMonths(now, 1))` até `endOfMonth(subMonths(now, 1))` -- alimenta apenas a variação % e comparações

O `dailyTrend` (sparkline de 30 dias) continuará usando os dados combinados das duas queries, pois os últimos 30 dias podem cruzar dois meses.

## Arquivo modificado

| Arquivo | Ação |
|---|---|
| `src/hooks/useHomeDashboard.ts` | Separar em duas queries de transações: mês atual e mês anterior |

## Detalhes técnicos

### Mudanças no hook

```text
// ANTES (uma query de 60 dias):
const homeStart = format(subDays(now, 60), "yyyy-MM-dd");
const { transactions, totals } = useTransactions({ startDate: homeStart, endDate: homeEnd });

// DEPOIS (duas queries separadas):
const currStart = format(startOfMonth(now), "yyyy-MM-dd");
const currEnd = format(endOfMonth(now), "yyyy-MM-dd");
const prevStart = format(startOfMonth(subMonths(now, 1)), "yyyy-MM-dd");
const prevEnd = format(endOfMonth(subMonths(now, 1)), "yyyy-MM-dd");

const { transactions: currTx, totals } = useTransactions({ startDate: currStart, endDate: currEnd });
const { transactions: prevTx } = useTransactions({ startDate: prevStart, endDate: prevEnd });
```

### Ajustes nos cálculos

- **KPIs do mês (Entradas, Saídas, Resultado):** usam apenas `currTx`
- **Variação % vs mês anterior:** usa `prevTx` para calcular `prevMonthIncome`, `prevMonthExpense`, `prevMonthResult`
- **Trend 30d vs 30d:** combina `currTx` + `prevTx` (ambas queries juntas cobrem ~60 dias)
- **dailyTrend sparkline:** combina `currTx` + `prevTx` para montar os últimos 30 dias
- **Runway (fôlego):** usa `currTx` + `prevTx` combinados para média de despesas dos últimos 30 dias
- **currentBalance (totals.balance):** vem da query do mês corrente via `allTotals`
- **Alertas:** mantêm a mesma lógica, apenas trocando a fonte de dados

### O que NÃO muda

- Interface `HomeDashboardData` permanece idêntica
- Nenhum componente de UI precisa ser alterado
- A página `HomePage.tsx` não é tocada
