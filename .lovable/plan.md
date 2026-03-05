

## Plan: Add "Saldo Bancário" Card to Home Dashboard

This feature adds a new card to the Home page that reads bank balance data ("SALDO BANCÁRIO" block) directly from the spreadsheet during sync, stores it in a new table, and displays it in a Liquid Glass Premium card.

### Architecture Overview

```text
Spreadsheet Tab (e.g. Mar2026)
  ┌──────────────────────────────────┐
  │  ... transaction rows ...        │
  │  SALDO BANCÁRIO                  │
  │  Banco    | Saldo Inicial | Final│
  │  Sicredi  | 55.757,94    | ...   │
  │  Caixinha | ...           | ...   │
  └──────────────────────────────────┘
       │ (extracted during sync)
       ▼
  DB: bank_balances table
       │ (queried by hook)
       ▼
  HomePage → BankBalanceCard
```

### Task 1: Create `bank_balances` database table

New migration:

```sql
CREATE TABLE public.bank_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES public.google_sheet_connections(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,          -- "2026-03"
  bank_name TEXT NOT NULL,
  opening_balance NUMERIC(14,2),     -- nullable = unknown
  closing_balance NUMERIC(14,2),
  tab_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, connection_id, period_key, bank_name)
);

ALTER TABLE public.bank_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own bank balances"
  ON public.bank_balances FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service can manage bank balances"
  ON public.bank_balances FOR ALL TO service_role
  USING (true) WITH CHECK (true);
```

### Task 2: Extract bank balances during sync

**File:** `supabase/functions/sheets-sync-all-tabs/index.ts`

Add a function `extractBankBalances(rows, tab, parseBRL)` that:
1. Scans rows for a cell containing "SALDO BANCÁRIO" (case-insensitive, accent-normalized)
2. From that anchor, identifies the header row below it with "Saldo inicial" / "Saldo final" columns
3. Reads bank rows below until empty row
4. Returns `{ rows: [{bankName, opening, closing}], warnings: [] }`

Call this function **after** the existing transaction processing loop for each tab, so it runs in parallel without interfering. Upsert results into `bank_balances` table using the unique constraint.

### Task 3: Create `useBankBalances` hook

**File:** `src/hooks/useBankBalances.ts`

- Query `bank_balances` table filtered by current month's `period_key` (e.g. "2026-03")
- Compute `openingTotal` and `closingTotal` sums
- Return rows, totals, loading state, and empty state flag

### Task 4: Create `BankBalanceCard` component

**File:** `src/components/home/BankBalanceCard.tsx`

Liquid Glass Premium card with:
- Title "Saldo Bancário" + subtitle with month name
- Two highlighted totals: Saldo Inicial / Saldo Final (formatted BRL)
- List of banks (max 3 visible + "ver mais" expandable)
- Each row: bank name + opening + closing values
- Closing total < 0 → red highlight
- Empty state: "Saldo bancário não encontrado na planilha deste mês."
- Skeleton loading state
- "Ver detalhes" opens a Drawer with full bank list + any warnings
- Uses `GlassCard` with existing liquid-glass classes

### Task 5: Integrate card into HomePage

**File:** `src/pages/HomePage.tsx`

Add `BankBalanceCard` to the bottom grid row (currently 3 cards in `lg:grid-cols-3`). Change to `lg:grid-cols-4` or place it in the KPI mosaic area as a 2-col span card alongside "Caixa Atual". Position it prominently since it's balance data.

Place it after the KPI grid and before the middle row, as a standalone full-width-ish card:
```
<BankBalanceCard periodKey={currentPeriodKey} delay={240} />
```

### Task 6: Update `useHomeDashboard` (minimal)

Add the current period key export (`format(now, "yyyy-MM")`) so HomePage can pass it to the bank balance card. The bank balance hook is separate — not embedded in useHomeDashboard — to keep concerns isolated.

### Files to create/modify

| File | Action |
|------|--------|
| Migration SQL | Create `bank_balances` table |
| `supabase/functions/sheets-sync-all-tabs/index.ts` | Add `extractBankBalances()` + upsert after tab processing |
| `src/hooks/useBankBalances.ts` | New hook to query bank balances |
| `src/components/home/BankBalanceCard.tsx` | New Liquid Glass Premium card |
| `src/pages/HomePage.tsx` | Add BankBalanceCard to layout |

### Error handling

- If "SALDO BANCÁRIO" block not found → no rows inserted, card shows empty state
- Parse failures → null values + warnings logged in sync audit
- Card never blocks the rest of Home — fully independent query
- Sync never fails due to bank balance extraction — wrapped in try/catch with soft fail

