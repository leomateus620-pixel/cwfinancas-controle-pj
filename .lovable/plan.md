

## Plan: Fix Bank Name Detection for StarSync Layout

### Problem
The StarSync spreadsheet stores bank names ("Sicredi", "ASAAS") in column G, but the current data shows numeric values stored as bank_name (`-0.49`, `209.06`). This means the G-I range validation is failing and falling back to H-J, which picks up wrong columns.

### Root Cause Investigation
The `isValidBankBalanceData` heuristic checks if col0 is non-numeric. "Sicredi" and "ASAAS" are text, so they should pass. The likely issue is that the Google Sheets API returns the G2:I4 range with a header row (e.g., "Saldo Bancário | Saldo Inicial | Saldo Final") that passes validation, but then `extractBankBalances` correctly skips the header — and the actual bank names might be in rows that don't get returned or are structured differently than expected.

### Changes

#### 1. Add "ASAAS" to bank name lists
- **`supabase/functions/sheets-sync-all-tabs/index.ts`** (~line 404): Add `"asaas"` to `BANK_NAMES` array
- **`supabase/functions/rebuild-categories/index.ts`** (~line 14): Add `"asaas"` to `BANK_NAMES` array
- Both files already have "sicredi" — no change needed for that

#### 2. Add ASAAS logo support in UI
- **`src/components/home/CaixaAtualCard.tsx`**: Add `"asaas"` case to `getBankLogo()`. Since there's no ASAAS logo asset yet, it will fall through to the default Wallet icon (or we can add a placeholder). The user didn't provide an ASAAS logo, so we'll just ensure the name displays correctly.

#### 3. Improve `isValidBankBalanceData` robustness
Both sync functions: tighten the heuristic to also use `looksLikeBankName()` as an additional positive signal. Currently it only checks "is NOT a number" — but some edge cases (like a header "Total") might pass. Adding a check that at least one row's col0 matches a known bank name provides stronger validation.

Update in both `sheets-sync-all-tabs/index.ts` and `google-sheets-sync/index.ts`:
```typescript
function isValidBankBalanceData(rows: string[][]): boolean {
  for (const row of rows) {
    const col0 = String(row[0] ?? "").trim();
    if (!col0) continue;
    const cleaned = col0.replace(/[R$.\s]/g, "").replace(",", ".");
    if (col0 && isNaN(Number(cleaned))) {
      const col1 = parseBRL(row[1]);
      const col2 = parseBRL(row[2]);
      if (col1 !== null || col2 !== null) return true;
    }
  }
  return false;
}
```

The logic itself looks correct. The real fix is ensuring "asaas" is in `BANK_NAMES` and that the data cleanup after sync re-runs to fix the stored numeric bank names. After deploying, the user should re-sync the StarSync spreadsheet.

#### 4. Clean up bad data
Run a migration or manual query to delete the invalid bank_balance rows with numeric bank names so the re-sync produces clean data.

### Files to modify
- `supabase/functions/sheets-sync-all-tabs/index.ts` — add "asaas" to BANK_NAMES
- `supabase/functions/google-sheets-sync/index.ts` — add "asaas" to BANK_NAMES  
- `supabase/functions/rebuild-categories/index.ts` — add "asaas" to BANK_NAMES
- `src/components/home/CaixaAtualCard.tsx` — add "asaas" to getBankLogo (fallback to Wallet icon)
- Database: delete bad bank_balance rows with numeric names

