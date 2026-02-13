
# Correcao Completa do Dashboard: Filtros, KPIs e Consistencia de Dados

## Diagnostico

Apos analise detalhada do codigo e dos dados no banco, identifiquei os seguintes problemas:

### Bugs Criticos

1. **Hero Card no OverviewPage com valor hardcoded**: O saldo `R$ 253.412` e a variacao `12.5%` sao valores fixos no codigo, nao vem dos dados reais.

2. **KPIs com variacoes fake**: Todos os percentuais de variacao nos cards sao hardcoded:
   - KPIGrid: `12.5%`, `8.2%`, `3.4%`, `5.2%` (fixos)
   - IncomePage: `15.3%`, `8.7%`, `12.1%` (fixos)
   - ExpensesPage: `-5.2%`, `3.1%` (fixos)

3. **useHomeDashboard conflita com filtro global**: Ele recebe transacoes ja filtradas pelo periodo global (via `useTransactions`), mas depois tenta filtrar novamente para "mes atual" -- se o periodo global for "Ultimos 7 dias", nao ha dados do mes inteiro, gerando valores zerados ou errados.

4. **RevenueChart com bug de month_key**: Usa `date.getMonth()` (0-indexed, Jan=0) para gerar chave `2026-00`, o que causa ordenacao incorreta e labels errados ao cruzar anos.

5. **Sem calculo real de "vs periodo anterior"**: Nenhum componente calcula a variacao real comparando o periodo selecionado com o periodo equivalente anterior.

### Dados no Banco (confirmados)
- 739 transacoes totais (556 expense, 183 income)
- Todos os `amount` sao positivos (o `type` determina o sinal)
- Datas vao de 2025-01-02 a 2026-02-03
- Receita total: R$ 382.852,65
- Despesas total: R$ 303.658,83

## Solucao

### Bloco 1 -- Criar hook `usePeriodMetrics` (fonte unica de metricas)

Criar `src/hooks/usePeriodMetrics.ts`:

Esse hook sera a **fonte unica de verdade** para todas as metricas do periodo selecionado.

```text
usePeriodMetrics()
  - Consome useDateRange() para obter from/to
  - Faz 2 queries:
    1. Periodo atual: transacoes entre from e to
    2. Periodo anterior: mesmo tamanho de dias, imediatamente antes de from
  - Retorna:
    - currentIncome, currentExpense, currentBalance
    - previousIncome, previousExpense, previousBalance
    - incomeChange (% real), expenseChange (% real), balanceChange (% real)
    - margin (lucro/receita no periodo)
    - marginChange (% real vs anterior)
    - monthlyBreakdown: array de { monthKey, income, expense, balance }
    - categoryBreakdown: { income: top5[], expense: top5[] }
    - recentTransactions: top 10
    - transactionCount
    - isLoading
```

O calculo do periodo anterior:
- Se o filtro e "Ultimos 30 dias" (dia 14/jan a 13/fev), o anterior e 15/dez a 13/jan
- Isso garante comparacao proporcional

### Bloco 2 -- Corrigir OverviewPage

**Hero Card**: Substituir valores hardcoded por dados reais do `usePeriodMetrics`:
- Saldo = `currentBalance` (receita - despesa no periodo)
- Variacao = `balanceChange` (% real vs periodo anterior)

**KPIGrid**: Substituir variacoes hardcoded:
- Receita Total = `currentIncome`, change = `incomeChange`
- Lucro Liquido = `currentBalance`, change = `balanceChange`
- Despesas Totais = `currentExpense`, change = `expenseChange`
- Margem = `margin`, change = `marginChange`

### Bloco 3 -- Corrigir RevenueChart

Corrigir o bug de `date.getMonth()`:
- Trocar de `getMonth()` (0-indexed) para `format(parseISO(t.date), "yyyy-MM")` do date-fns
- Usar o month_key correto para agrupamento e labels

### Bloco 4 -- Corrigir IncomePage e ExpensesPage

Substituir KPIs hardcoded por valores reais:
- "vs mes anterior" deve comparar com periodo anterior real
- Ticket medio, maior fonte/categoria devem vir dos dados filtrados

### Bloco 5 -- Corrigir useHomeDashboard

A Home nao usa o filtro global (por design). Corrigir para:
- Buscar transacoes sem filtro de periodo global (override com datas proprias)
- Calcular mes atual vs mes anterior usando datas explicitas
- Nao depender do `useDateRange()` (a Home mostra sempre o mes corrente)

### Bloco 6 -- Reconciliacao com DRE (banner informativo)

Adicionar ao `usePeriodMetrics` uma funcao de reconciliacao:
- Para cada mes no periodo, comparar receita/despesa das transacoes com DRE
- Se diferenca > 15%, retornar warning
- No OverviewPage, mostrar banner discreto se houver warnings

## Arquivos Criados/Modificados

| Arquivo | Acao |
|---|---|
| `src/hooks/usePeriodMetrics.ts` | Criar -- fonte unica de metricas por periodo |
| `src/pages/OverviewPage.tsx` | Corrigir hero card e usar dados reais |
| `src/components/dashboard/KPIGrid.tsx` | Usar `usePeriodMetrics` com variacoes reais |
| `src/components/dashboard/RevenueChart.tsx` | Corrigir bug de month_key (getMonth 0-indexed) |
| `src/components/dashboard/ExpenseChart.tsx` | Usar dados ja filtrados (sem mudanca de logica) |
| `src/components/dashboard/ProfitDistributionChart.tsx` | Idem |
| `src/components/dashboard/RecentTransactions.tsx` | Idem |
| `src/pages/IncomePage.tsx` | Substituir KPIs hardcoded por dados reais |
| `src/pages/ExpensesPage.tsx` | Substituir KPIs hardcoded por dados reais |
| `src/hooks/useHomeDashboard.ts` | Desacoplar do filtro global, usar mes atual fixo |

## Detalhes Tecnicos

- `usePeriodMetrics` faz queries diretas ao Supabase com `from/to` explicitos (sem depender do `useTransactions` que tem try/catch no `useDateRange`)
- O periodo anterior e calculado como: `previousFrom = subDays(from, diffDays)`, `previousTo = subDays(from, 1)` onde `diffDays = differenceInDays(to, from)`
- O `queryKey` inclui `from` e `to` para invalidar cache automaticamente ao trocar periodo
- A reconciliacao com DRE busca `dre_lines` agrupadas por `period_key` (YYYY-MM) e compara com o `monthlyBreakdown`
- Nao cria tabelas novas, nao cria edge functions -- tudo e calculado no cliente a partir das queries existentes
- O limite de 1000 rows do Supabase nao e problema aqui (739 transacoes totais), mas o hook usara paginacao se necessario no futuro
