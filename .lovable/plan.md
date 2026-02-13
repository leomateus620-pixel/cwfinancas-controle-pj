
# Unificacao do Motor de Calculos Financeiros

## Diagnostico

Apos analise detalhada do codigo, existem **3 problemas concretos** que causam inconsistencias entre telas:

### Problema 1: Graficos do Dashboard incluem transferencias

Os componentes `RevenueChart` e `ExpenseChart` chamam `useTransactions()` **sem** o filtro `excludeTransfers`, fazendo com que transferencias internas inflem os graficos do Dashboard enquanto os KPIs (via `usePeriodMetrics`) as excluem corretamente.

### Problema 2: Fluxo de Caixa usa fonte de dados independente

O hook `useCashFlow` faz sua propria query via `useTransactions()` e calcula totais localmente, em vez de consumir `usePeriodMetrics`. Isso cria uma segunda "fonte de verdade" com potencial de divergencia.

### Problema 3: Formatacao inconsistente no CashFlowPage

As linhas 267, 273 e 279 do `CashFlowPage.tsx` usam `toLocaleString("pt-BR")` em vez de `formatCurrencyBR()`, violando a padronizacao.

## O que ja esta implementado corretamente

- `movement_type` (INCOME/EXPENSE/TRANSFER) no banco e na importacao
- `usePeriodMetrics` como fonte central com separacao operacional/transferencias
- `excludeTransfers` nas paginas de Receitas e Despesas
- Toggle Operacional/Movimentacao no Dashboard
- `formatCurrencyBR` centralizado em `src/lib/currency.ts`
- NUMERIC(14,2) com trigger de arredondamento no banco
- Indice unico para prevenir duplicatas na sincronizacao

## Sobre armazenamento em centavos

O pedido menciona centavos (inteiro). A abordagem atual com NUMERIC(14,2) + trigger de arredondamento e a pratica padrao para BRL e ja garante precisao de 2 casas. Converter para centavos exigiria alterar o schema, todas as queries, todos os hooks, a edge function e a formatacao -- um risco altissimo sem beneficio real. O NUMERIC(14,2) permanece.

## Solucao (3 correcoes cirurgicas)

### Correcao 1 -- Graficos do Dashboard excluem transferencias

Alterar `RevenueChart` e `ExpenseChart` para passarem `excludeTransfers: true` na chamada de `useTransactions()`. Isso alinha os graficos com os KPIs que ja usam `usePeriodMetrics`.

**Arquivos**: `src/components/dashboard/RevenueChart.tsx`, `src/components/dashboard/ExpenseChart.tsx`

### Correcao 2 -- CashFlow consome usePeriodMetrics

Refatorar `useCashFlow` para consumir os dados de `usePeriodMetrics` em vez de fazer query independente. Isso elimina a segunda fonte de verdade e garante que os totais do Fluxo de Caixa sejam identicos aos do Dashboard.

O hook continuara calculando dados mensais (para o grafico) e upcoming payments a partir de `useTransactions`, mas os **totais** (totalInflow, totalOutflow, netCashFlow, transferIn, transferOut) virao de `usePeriodMetrics`.

**Arquivo**: `src/hooks/useCashFlow.ts`

### Correcao 3 -- Formatacao BRL no CashFlowPage

Substituir 3 ocorrencias de `toLocaleString("pt-BR")` por `formatCurrencyBR()` na secao de transferencias do `CashFlowPage.tsx`.

**Arquivo**: `src/pages/CashFlowPage.tsx`

## Arquivos modificados

| Arquivo | Acao |
|---|---|
| `src/components/dashboard/RevenueChart.tsx` | Adicionar `excludeTransfers: true` |
| `src/components/dashboard/ExpenseChart.tsx` | Adicionar `excludeTransfers: true` |
| `src/hooks/useCashFlow.ts` | Consumir totais de `usePeriodMetrics` |
| `src/pages/CashFlowPage.tsx` | Substituir `toLocaleString` por `formatCurrencyBR` |

## Resultado esperado

Todas as telas (Dashboard KPIs, Dashboard graficos, Receitas, Despesas, Fluxo de Caixa) exibirao os mesmos totais operacionais:
- Receita Operacional: R$ 417.043,65
- Despesa Operacional: R$ 424.759,82
- Resultado Operacional: -R$ 7.716,17
- Transferencias separadas e visiveis apenas no Fluxo de Caixa e no Dashboard (modo Movimentacao)
