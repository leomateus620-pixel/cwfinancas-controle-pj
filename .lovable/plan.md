

## Plan: Fix Bank Balance Precision (Floating-Point Rounding)

### Root Cause
The spreadsheet stores saldo inicial as raw floating-point numbers (e.g., `209.060000000005` instead of `209.06`) and saldo final is a formula (`=H3+SOMASE(B:B;G3;E:E)`) whose computed result also has floating-point noise. When XLSX parses these, it returns the raw float, which gets stored in the database without rounding. The `validate_amount_precision` trigger only covers `transactions`, `invoices`, and `balance_sheet_items` — NOT `bank_balances`.

### Changes

#### 1. Round bank balance values to 2 decimal places on extraction
**Files:** `supabase/functions/google-sheets-sync/index.ts` and `supabase/functions/sheets-sync-all-tabs/index.ts`

In both `extractBankBalances` functions, wrap parsed values with `Math.round(x * 100) / 100`:

```typescript
// google-sheets-sync (~line 646-647)
const opening = parseBRL(row[1]);
const closing = parseBRL(row[2]);
// becomes:
const rawOpening = parseBRL(row[1]);
const rawClosing = parseBRL(row[2]);
const opening = rawOpening !== null ? Math.round(rawOpening * 100) / 100 : null;
const closing = rawClosing !== null ? Math.round(rawClosing * 100) / 100 : null;
```

Same pattern in `sheets-sync-all-tabs` (~lines 328-329).

#### 2. Add debug logging for raw vs rounded values
Log the raw cell values and parsed values to help diagnose any future discrepancies:

```typescript
console.log(`[${requestId}] [bank-balance] "${bankName}" raw=[${row[1]}, ${row[2]}] parsed=[${rawOpening}, ${rawClosing}] rounded=[${opening}, ${closing}]`);
```

#### 3. Clean up existing data — round all stored values
Run an UPDATE query to round existing `bank_balances` values to 2 decimal places:

```sql
UPDATE bank_balances 
SET opening_balance = ROUND(opening_balance, 2),
    closing_balance = ROUND(closing_balance, 2);
```

#### 4. Add precision trigger for bank_balances table
Add `bank_balances` to the existing `validate_amount_precision` trigger function so future inserts/updates are always rounded:

```sql
-- Update the trigger function to also handle bank_balances
-- Add trigger on bank_balances table
```

### Files to modify
- `supabase/functions/google-sheets-sync/index.ts` — round extracted values
- `supabase/functions/sheets-sync-all-tabs/index.ts` — round extracted values
- Database: UPDATE existing rows + add precision trigger

After deploying, re-sync the StarSync spreadsheet to get fresh, properly-rounded values.

