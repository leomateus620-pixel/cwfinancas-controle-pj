

## Plan: Two Tasks for Caixa Atual Card

### Task 1: Support StarSync Bank Balance Layout (G2:I4)

The current extraction only reads ranges `H3:J5` and `H1:J20` (columns H-J). StarSync uses **columns G-I, rows 2-4**. The screenshot confirms raw float values appear as bank names (the system is reading wrong columns).

**Changes in both sync functions:**

**`supabase/functions/sheets-sync-all-tabs/index.ts`:**
- **`readBankBalanceRange`** (~line 225): Add `G2:I4` and `G1:I20` as additional range attempts **before** the existing H-J ranges. The function already uses a for-loop that returns the first successful range, so prepending G-I ranges means: if G-I has valid bank data it wins, otherwise falls back to H-J (preserving GR compatibility).
- **xlsx fallback** (~line 1516): Also try columns G-I (indices 6-8) first, then H-J (indices 7-9). Use a heuristic: if G-I yields valid bank names (non-numeric first column), use those; otherwise use H-J.

**`supabase/functions/google-sheets-sync/index.ts`:**
- **`readBankBalanceRange`** (~line 562): Same change — add `G2:I4` and `G1:I20` before H-J ranges.
- **xlsx fallback** (~line 1022-1029): Same G-I/H-J heuristic.

**Heuristic for choosing the right range:** After reading each candidate range, validate that at least one row has a non-numeric value in column 0 (bank name) AND a parseable numeric value in column 1 or 2. If the first successful range fails this validation, continue to the next. This ensures we don't break the existing GR extraction.

---

### Task 2: Multi-Month Comparison in Caixa Atual Card

Add a month selector so users can view and compare bank balances across all connected months, not just the current one.

**Architecture:**

```text
┌─────────────────────────────────────────────┐
│  CAIXA ATUAL                                │
│  [Jan] [Fev] [Mar*]  ← chip selector       │
│                                             │
│  ┌─────────┐  ┌─────────┐                  │
│  │ Sicredi │  │ Caixinha │  ← current view  │
│  │ R$ X    │  │ R$ Y    │                   │
│  └─────────┘  └─────────┘                  │
│                                             │
│  Comparação com mês anterior:               │
│  Saldo Final: R$ Z  →  R$ W  (+N%)         │
│  Ver detalhes >                             │
└─────────────────────────────────────────────┘
```

**`src/hooks/useBankBalances.ts`:**
- Add a new query `useAllBankBalancePeriods()` that fetches **distinct `period_key` values** from `bank_balances` for the current user. This populates the month selector chips.
- Modify `useBankBalances` to accept an optional array and also fetch the **previous month's data** alongside the selected month for delta comparison.

**`src/components/home/CaixaAtualCard.tsx`:**
- Add a horizontal chip/pill selector below the header showing available months (from `useAllBankBalancePeriods`). Current month is selected by default.
- When user selects a month, the card re-renders with that month's bank balances.
- Add a **comparison row** below the bank cards showing: previous month total → selected month total, with delta percentage.
- The drawer also updates to show the selected month's data (not hardcoded to current month).

**Data flow:**
1. `useAllBankBalancePeriods()` → returns `["2026-01", "2026-02", "2026-03"]`
2. User selects `"2026-02"` → `useBankBalances("2026-02")` fetches Feb data
3. Hook also fetches `"2026-01"` (previous month) for comparison
4. Card displays Feb balances + Jan→Feb delta

