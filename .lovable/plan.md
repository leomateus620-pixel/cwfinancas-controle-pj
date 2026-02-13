
# Classificacao de Transferencias Internas (movement_type)

## Diagnostico

Os dados confirmam o problema. O banco tem:

| Metrica | Com Transferencias | Operacional (sem transferencias) |
|---|---|---|
| Receitas | R$ 522.587,81 | R$ 417.043,65 |
| Despesas | R$ 506.598,59 | R$ 424.759,82 |
| Resultado | R$ 15.989,22 | -R$ 7.716,17 |

Existem **40 transacoes** classificadas como "Transferencia interna" ou "Transferencia Interna" (case variado) que inflam receitas em ~R$ 105k e despesas em ~R$ 82k. A DRE ignora essas transferencias, gerando divergencia com Dashboard/Receitas/Despesas.

## Solucao

### Passo 1 -- Adicionar coluna `movement_type` + classificar dados existentes

Migracao SQL:
- Adicionar coluna `movement_type TEXT DEFAULT 'INCOME'` na tabela `transactions`
- Executar UPDATE para classificar automaticamente:
  - Transacoes com categoria contendo "transferencia", "transferencia interna", "aplicacao", "resgate", "aporte", "movimentacao entre contas" recebem `movement_type = 'TRANSFER'`
  - Demais mantem `INCOME` ou `EXPENSE` baseado no campo `type` existente

### Passo 2 -- Atualizar Edge Function `sheets-sync-all-tabs`

Ao importar cada transacao, aplicar deteccao de transferencia:
- **Por categoria** (prioridade): keywords como "transferencia", "aplicacao", "resgate", "aporte"
- **Por descricao** (fallback): keywords como "TRANSFERENCIA", "TRANSF", "TED entre contas"
- Gravar `movement_type` junto com a transacao

### Passo 3 -- Atualizar `usePeriodMetrics` (Dashboard/KPIs)

Adicionar campo `movement_type` no SELECT e calcular:
- `currentIncome` = soma apenas `movement_type = 'INCOME'`
- `currentExpense` = soma apenas `movement_type = 'EXPENSE'`
- `transferIn` / `transferOut` = soma de `movement_type = 'TRANSFER'`
- Expor flag `viewMode` (operacional vs movimentacao) para o Dashboard

### Passo 4 -- Atualizar `useTransactions` (Receitas/Despesas)

Adicionar filtro `movement_type != 'TRANSFER'` nas paginas de Receitas e Despesas, para que transferencias internas nao aparecam nessas listas.

### Passo 5 -- Atualizar `useCashFlow` (Fluxo de Caixa)

Separar os dados em 3 blocos:
- Entradas Operacionais (`movement_type = 'INCOME'`)
- Saidas Operacionais (`movement_type = 'EXPENSE'`)
- Transferencias Internas (`movement_type = 'TRANSFER'`) com entradas e saidas separadas
- Exibir "Saldo Operacional" e "Saldo Total (com transferencias)"

### Passo 6 -- Toggle no Dashboard (OverviewPage)

Adicionar um Switch "Operacional / Movimentacao" no OverviewPage:
- **Operacional (DRE)**: KPIs usam apenas INCOME/EXPENSE
- **Movimentacao (Caixa)**: KPIs incluem TRANSFER
- Card fixo mostrando "Transferencias internas no periodo: R$ X"

### Passo 7 -- Atualizar CashFlowPage

Adicionar secao visual separada para transferencias internas, com totais de entrada e saida de transferencias, alem do saldo operacional vs saldo total.

### Passo 8 -- Atualizar `useHomeDashboard`

Filtrar `movement_type != 'TRANSFER'` nos calculos da Home para que alertas e health score reflitam apenas operacoes reais.

## Arquivos modificados

| Arquivo | Acao |
|---|---|
| Migration SQL | Adicionar coluna `movement_type`, classificar dados existentes |
| `supabase/functions/sheets-sync-all-tabs/index.ts` | Detectar transferencias na importacao |
| `src/hooks/usePeriodMetrics.ts` | Separar calculos por movement_type, expor transferencias |
| `src/hooks/useTransactions.ts` | Adicionar filtro opcional `excludeTransfers` |
| `src/hooks/useCashFlow.ts` | Separar transferencias em bloco proprio |
| `src/hooks/useHomeDashboard.ts` | Excluir transferencias dos calculos |
| `src/pages/OverviewPage.tsx` | Toggle Operacional/Movimentacao + card de transferencias |
| `src/pages/IncomePage.tsx` | Filtrar transferencias (somente receitas operacionais) |
| `src/pages/ExpensesPage.tsx` | Filtrar transferencias (somente despesas operacionais) |
| `src/pages/CashFlowPage.tsx` | Secao separada de transferencias internas |
| `src/components/dashboard/KPIGrid.tsx` | Suportar modo operacional/movimentacao |

## Resultado esperado

- **DRE**: Receita R$ 417.043,65 / Despesa R$ 424.759,82 (sem transferencias)
- **Receitas/Despesas**: Mesmos valores operacionais
- **Dashboard (Operacional)**: Mesmos valores da DRE
- **Dashboard (Movimentacao)**: R$ 522.587,81 / R$ 506.598,59 (com transferencias)
- **Fluxo de Caixa**: Transferencias separadas em bloco proprio
- Consistencia total entre todas as telas
