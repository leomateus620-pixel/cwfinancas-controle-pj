

# Padronizacao de Formatacao Monetaria (BRL com 2 casas decimais)

## Problema Identificado

Existem **15 arquivos** com **13 funcoes locais diferentes** de formatacao monetaria, cada uma com regras distintas:

- **6 arquivos** usam `maximumFractionDigits: 0` (sem centavos): RecentTransactions, ExpensesPage, IncomePage, InvoicesPage, BalanceSheetPage, DREPage
- **5 arquivos** usam `notation: "compact"` com 1 casa decimal: CashFlowPage, ExpenseChart, RevenueChart, ForecastChart, ForecastKPIs, ForecastCashFlow
- **2 arquivos** usam formatacao manual com `k`/`mi`: HomePage
- **Nenhum** usa `minimumFractionDigits: 2` + `maximumFractionDigits: 2`

## Solucao

### Passo 1 -- Criar funcoes centralizadas em `src/lib/currency.ts`

Criar um unico arquivo com 3 funcoes:

```text
formatCurrencyBR(amount)     -> "R$ 100.000,00" (sempre 2 casas)
formatCompactBR(amount)      -> "R$ 100mil" ou "R$ 1,5mi" (para eixos de graficos)
parseBRLToNumber(raw)        -> number com 2 casas decimais
```

**`formatCurrencyBR`**: Intl.NumberFormat pt-BR, currency BRL, min/max 2 casas. Usada em cards, tabelas, tooltips, exports.

**`formatCompactBR`**: Versao compacta para eixos de graficos onde espaco e limitado. Usa notation compact com 1 casa.

**`parseBRLToNumber`**: Parser robusto que aceita formatos como "R$ 1.234,56", "100.000", "(1.234,56)", "30,00-". Rejeita valores que parecem datas.

### Passo 2 -- Migracao SQL do banco

- `ALTER COLUMN transactions.amount TYPE NUMERIC(14,2)`
- `UPDATE transactions SET amount = round(amount::numeric, 2)`
- Mesma alteracao para `invoices.value` e `balance_sheet_items.amount`
- Usar validation trigger (nao CHECK constraint) para garantir `amount = round(amount, 2)`

### Passo 3 -- Substituir todas as funcoes locais

Remover as 13 funcoes `formatCurrency` / `formatBRL` locais e importar de `src/lib/currency.ts`:

| Arquivo | Funcao local removida | Substituicao |
|---|---|---|
| `src/components/dashboard/RecentTransactions.tsx` | `formatCurrency` (0 casas) | `formatCurrencyBR` |
| `src/components/dashboard/ExpenseChart.tsx` | `formatCurrency` (compact) | `formatCurrencyBR` para tooltip, `formatCompactBR` para eixo |
| `src/components/dashboard/RevenueChart.tsx` | `formatCurrency` (compact) | `formatCurrencyBR` para tooltip, `formatCompactBR` para eixo |
| `src/components/forecast/ForecastKPIs.tsx` | `formatCurrency` (compact) | `formatCurrencyBR` |
| `src/components/forecast/ForecastCashFlow.tsx` | `formatCurrency` (compact) | `formatCurrencyBR` |
| `src/components/forecast/ForecastChart.tsx` | `formatCurrency` (compact) | `formatCurrencyBR` para tooltip, `formatCompactBR` para eixo |
| `src/pages/CashFlowPage.tsx` | `formatCurrency` (compact) | `formatCurrencyBR` para tooltip/cards, `formatCompactBR` para eixo |
| `src/pages/IncomePage.tsx` | `formatCurrency` (0 casas) | `formatCurrencyBR` |
| `src/pages/ExpensesPage.tsx` | `formatCurrency` (0 casas) | `formatCurrencyBR` |
| `src/pages/InvoicesPage.tsx` | `formatCurrency` (0 casas) | `formatCurrencyBR` |
| `src/pages/BalanceSheetPage.tsx` | `formatCurrency` (0 casas) | `formatCurrencyBR` |
| `src/pages/DREPage.tsx` | `formatBRL` (0 casas) | `formatCurrencyBR` |
| `src/pages/HomePage.tsx` | `formatBRL` + `formatFullBRL` (manual k/mi) | `formatCurrencyBR` para valores completos, `formatCompactBR` para cards compactos |
| `src/hooks/useHomeDashboard.ts` | `formatBRL` (sem casas fixas) | `formatCurrencyBR` |
| `src/components/home/DailySummary.tsx` | inline `toLocaleString` | `formatCurrencyBR` |

### Passo 4 -- Atualizar parser na Edge Function

Integrar `parseBRLToNumber` na logica de importacao do `sheets-sync-all-tabs` para garantir que valores importados da planilha sejam sempre arredondados a 2 casas.

### Passo 5 -- Testes unitarios

Criar `src/lib/__tests__/currency.test.ts` com cobertura para:
- `formatCurrencyBR`: inteiros, decimais, negativos, zero
- `parseBRLToNumber`: todos os formatos BRL, rejeicao de datas, round-trip

## Arquivos modificados

| Arquivo | Acao |
|---|---|
| Migration SQL | ALTER amount para NUMERIC(14,2) + round dados existentes |
| `src/lib/currency.ts` | **NOVO** -- formatCurrencyBR, formatCompactBR, parseBRLToNumber |
| `src/lib/__tests__/currency.test.ts` | **NOVO** -- testes unitarios |
| 15 arquivos listados acima | Remover funcao local, importar de currency.ts |
| `supabase/functions/sheets-sync-all-tabs/index.ts` | Usar parseBRLToNumber na importacao |

## Resultado esperado

- Todo valor monetario exibido com 2 casas decimais: "R$ 100.000,00"
- Eixos de graficos usam formato compacto legivel: "R$ 100mil"
- Tooltips e cards sempre com 2 casas
- Banco armazena NUMERIC(14,2) -- sem perda de precisao
- Uma unica fonte de verdade para formatacao

