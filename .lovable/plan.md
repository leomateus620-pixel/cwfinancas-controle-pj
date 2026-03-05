

## Plan: Redesign "Caixa Atual" Card with Per-Bank Closing Balances

### What Changes

Replace the current simple `HomeKPICard` for "Caixa Atual" (lines 94-105 in HomePage.tsx) with a new premium component `CaixaAtualCard` that:

1. **Main view**: Shows each bank's **closing balance** from `bank_balances`, with the bank name displayed above each value. Uses `AnimatedValue` for count-up animation and `GlassCard` with highlight variant.

2. **"Ver detalhes" drawer**: Opens a detailed view per bank showing:
   - Opening balance, closing balance, and delta (variation)
   - Month's transaction summary (total income/expense from `useHomeDashboard` data, since transactions aren't linked to specific banks)

3. **Remove the separate `BankBalanceCard`** from HomePage (line 150), since the bank data is now integrated into "Caixa Atual".

### Files

| File | Action |
|------|--------|
| `src/components/home/CaixaAtualCard.tsx` | **Create** — New premium card consuming `useBankBalances` + receiving `monthIncome`/`monthExpense` as props |
| `src/pages/HomePage.tsx` | **Edit** — Replace `HomeKPICard` for "Caixa Atual" with `CaixaAtualCard`, remove standalone `BankBalanceCard`, pass transaction totals as props |

### CaixaAtualCard Design

- `GlassCard variant="highlight"` spanning `md:col-span-2`
- Header: Wallet icon + "CAIXA ATUAL" label + tooltip + month subtitle
- Body: Grid of bank cards, each showing:
  - Bank name (bold, above value)
  - Closing balance as large animated number (red if negative, green/default if positive)
  - Small delta badge showing % change from opening
- Footer: "Ver detalhes ›" button always visible
- Drawer: Full breakdown per bank (opening/closing/delta) + overall month summary (entradas/saídas/resultado)
- Staggered fade-in animations per bank card (120ms delay each)
- Empty state falls back to showing `currentBalance` from transactions (existing behavior)

### Data Flow

```text
useBankBalances(periodKey) → rows[] → CaixaAtualCard
useHomeDashboard → monthIncome, monthExpense → passed as props for drawer details
```

No backend changes needed — all data already available.

