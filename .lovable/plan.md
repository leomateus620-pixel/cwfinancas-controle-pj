

## Plan: Fix Bank Balance Extraction with Dedicated H-J Read

### Root Cause
The Google Sheets API returns ragged arrays — each row only contains columns up to the last non-empty cell in that row. If the "SALDO BANCÁRIO" block (columns H-J) is on rows that also have transaction data in A-F, the H-J data might exist at indices 7-9. But if those rows have empty A-G cells, the API may shift column positions. Most critically, the bank balance rows likely sit below the transaction data area, and those rows may only have content in H-J — meaning the API returns them at indices 0-2, not 7-9. This makes anchor detection unreliable.

### Solution: Second Targeted Read for H-J

**File:** `supabase/functions/sheets-sync-all-tabs/index.ts`

#### Change 1: Add a dedicated function to read bank balance range

```typescript
async function readBankBalanceRange(
  accessToken: string,
  spreadsheetId: string,
  tabTitle: string,
  requestId: string
): Promise<string[][]> {
  // Try tight range first (H3:J5), then fallback to H1:J20
  for (const range of [`'${tabTitle}'!H3:J5`, `'${tabTitle}'!H1:J20`]) {
    const resp = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!resp.ok) continue;
    const data = await resp.json();
    const values: string[][] = data.values || [];
    if (values.length > 0) {
      console.log(`[${requestId}] [bank-balance] tab=${tabTitle} range=${range} rows=${values.length}`);
      return values;
    }
  }
  return [];
}
```

#### Change 2: Update `extractBankBalances` to work with 3-column H-J data

When called with the dedicated H-J read (3 columns only), the function should:
- Col 0 = bank name or "SALDO BANCÁRIO" header
- Col 1 = opening balance / "Saldo inicial"  
- Col 2 = closing balance / "Saldo final"

Detect header row (containing "SALDO BANCÁRIO" or "Saldo inicial"/"Saldo final"), then read bank rows below it. This is simpler since columns are always 0, 1, 2.

#### Change 3: Replace current bank balance extraction call (line ~1489-1518)

Instead of calling `extractBankBalances(allRows, ...)` with the transaction data, do a separate read:

```typescript
// ===== BANK BALANCES EXTRACTION (soft fail) =====
try {
  let bankBalanceRows: string[][] = [];
  if (!xlsxWorkbook && accessToken) {
    bankBalanceRows = await readBankBalanceRange(accessToken, connection.spreadsheet_id, tab.title, requestId);
  } else if (xlsxWorkbook) {
    // For xlsx: extract H-J columns from allRows (indices 7-9)
    bankBalanceRows = allRows.map(r => [safeStr(r[7]), safeStr(r[8]), safeStr(r[9])]);
  }
  
  if (bankBalanceRows.length > 0) {
    const bankBalances = extractBankBalances(bankBalanceRows, tab, parseBRL);
    // ... upsert as before
  }
} catch ...
```

#### Change 4: Simplify `extractBankBalances` for 3-column input

Since the input will always be a 3-column array (col 0=bank/header, col 1=opening, col 2=closing):
- Scan for anchor ("saldo bancario") or header ("saldo inicial") in row
- If not found, assume row 0 is header (for tight range H3:J3)
- Read data rows from header+1 onward
- `bankNameCol=0`, `openingCol=1`, `closingCol=2`

#### Change 5: Add confirmation log after upsert

```typescript
const { count } = await supabase.from("bank_balances")
  .select("*", { count: "exact", head: true })
  .eq("user_id", userId)
  .eq("period_key", tab.periodKey || format_period_now());
console.log(`[bank-balance] confirm persisted count=${count} tab=${tab.title} period=${tab.periodKey}`);
```

### Files to modify
| File | Change |
|------|--------|
| `supabase/functions/sheets-sync-all-tabs/index.ts` | Add `readBankBalanceRange()`, rewrite extraction call to use dedicated H-J read, simplify `extractBankBalances` for 3-col input, add confirmation logs |

No changes needed to `useBankBalances.ts` or `BankBalanceCard.tsx` — the frontend is correct, it just has no data to display.

