

## Plan: 4 Tasks

### Task 1: Remove "Operacional (DRE)" toggle from Dashboard
**File:** `src/pages/OverviewPage.tsx`

Remove the toggle switch section (lines 42-51) and the `showMovement` state. Simplify to always use operational mode. Remove unused imports (`useState`, `Switch`, `Label`). The hero card label becomes just "Resultado do Período". KPIGrid receives no `viewMode` prop (defaults to "operational").

### Task 2: Remove "Orçamento Usado" card + upgrade remaining KPI cards in Expenses
**File:** `src/pages/ExpensesPage.tsx`

- Remove the 3rd KPICard ("Orçamento Usado") and related budget calculations (lines 91-92, 175-182)
- Change grid from `sm:grid-cols-3` to `sm:grid-cols-2`
- Wrap the 2 remaining KPI cards with liquid glass styling: add `liquid-glass` class wrapper with backdrop-blur and subtle gradient orbs for premium texture
- Remove unused `AlertTriangle` import

### Task 3: Remove reconciliation warning from Dashboard
**File:** `src/pages/OverviewPage.tsx`

Remove the entire `{hasReconciliationWarnings && (...)}` block (lines 54-62). Remove `AlertTriangle` from imports and `Alert`/`AlertDescription` imports. Remove `hasReconciliationWarnings` from the destructured hook values.

### Task 4: Fix description/client_vendor mapping in sync function
**File:** `supabase/functions/sheets-sync-all-tabs/index.ts`

Add a post-mapping data fix at line ~1333 (after description and clientVendor are extracted, before pushing to batch):

```
// If description is empty/generic but client_vendor has real data → swap them
// Then populate client_vendor with account column value (Conta/Banco)
if ((!description || description === "Sem descrição") && clientVendor) {
  description = clientVendor;
  clientVendor = account value from mapping;
}
```

Specifically:
1. After line 1333 (`const clientVendor = ...`), extract the `account` value: `const accountName = mapping.account ? safeStr(rowObj[mapping.account]).trim() || null : null;`
2. Add swap logic: if description is empty/generic AND clientVendor has real content, set `description = clientVendor` and `clientVendor = accountName`
3. This is a general heuristic — it only triggers when description would be "Sem descrição" and there's real data in client_vendor, so it won't affect spreadsheets where description is already populated correctly

Also update the **UI column headers**:
- `src/pages/IncomePage.tsx` line 342: Change "Cliente" → "Conta/Banco"
- `src/pages/ExpensesPage.tsx` line 331: Change "Fornecedor" → "Conta/Banco"
- `src/components/dashboard/RecentTransactions.tsx`: No column header to change (compact view)

After deploying the edge function fix, existing transactions won't update automatically — a re-sync of the spreadsheet will be needed.

### Files to modify
| File | Changes |
|------|--------|
| `src/pages/OverviewPage.tsx` | Remove toggle + reconciliation warning |
| `src/pages/ExpensesPage.tsx` | Remove budget card, upgrade KPI design, rename column |
| `src/pages/IncomePage.tsx` | Rename "Cliente" → "Conta/Banco" |
| `supabase/functions/sheets-sync-all-tabs/index.ts` | Add description↔client_vendor swap heuristic |

