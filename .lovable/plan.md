

## Plano: Fôlego de Caixa Inteligente (com dados do Caixa Atual)

### Problema
O cálculo do "Fôlego de Caixa" (runway) usa `currentBalance = monthIncome - monthExpense` (resultado operacional do mês), que **nao representa o saldo real em caixa**. Quando existem saldos bancários importados (`bank_balances`), o valor correto a usar e o `closingTotal` (soma dos saldos finais dos bancos). O calculo atual gera runway irreal.

### Solucao

**Logica de prioridade:**
1. Se existem `bank_balances` para o mes corrente -> usar `closingTotal` como saldo base
2. Senao -> manter calculo atual (`monthIncome - monthExpense`)

**Arquivo: `src/hooks/useHomeDashboard.ts`**

1. Importar `useBankBalances` e consumir `closingTotal` e `isEmpty`
2. Criar `effectiveBalance`: `bankClosingTotal ?? fallbackBalance`
3. Atualizar `runwayDays` para usar `effectiveBalance` em vez de `currentBalance`
4. Atualizar `currentBalance` retornado para usar `effectiveBalance` (alimenta CaixaAtualCard fallback)
5. Adicionar campo `runwaySource` ("bank_balances" | "transactions") para tooltip contextual

**Arquivo: `src/pages/HomePage.tsx`**

1. Atualizar tooltip do Folego para refletir a fonte dos dados dinamicamente
2. Adicionar sublabel mostrando a media diaria de despesas usada no calculo
3. Adicionar `href="/cash-flow"` para navegacao

**Arquivo: `src/components/home/HomeKPICard.tsx`**

1. Adicionar prop opcional `subtitle` para exibir info extra (ex: "~R$ 2,1 mil/dia") abaixo do valor principal

### Detalhes tecnicos

No `useHomeDashboard`:
```typescript
import { useBankBalances } from "./useBankBalances";

// dentro do hook:
const { closingTotal: bankClosingTotal, isEmpty: bankEmpty } = useBankBalances();
const effectiveBalance = (!bankEmpty && bankClosingTotal !== null) ? bankClosingTotal : (monthIncome - monthExpense);
const runwaySource = (!bankEmpty && bankClosingTotal !== null) ? "bank_balances" : "transactions";

// runway:
const runwayDays = effectiveBalance <= 0 ? 0 
  : avgDailyExpense === 0 ? null 
  : Math.round(effectiveBalance / avgDailyExpense);
```

No KPI do Folego (HomePage):
- Tooltip dinamico: se fonte = bank_balances, mostrar "Baseado no saldo bancario consolidado"; senao, manter texto atual
- Subtitle: `~${formatCompactBR(avgDailyExpense)}/dia` para dar contexto ao usuario

### Arquivos modificados

| Arquivo | Mudanca |
|---|---|
| `src/hooks/useHomeDashboard.ts` | Integrar `useBankBalances`, calcular `effectiveBalance`, expor `runwaySource` e `avgDailyExpense` |
| `src/pages/HomePage.tsx` | Tooltip dinamico, subtitle com media diaria, href |
| `src/components/home/HomeKPICard.tsx` | Prop `subtitle` opcional |

