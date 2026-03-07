

## Plan: Fix APR Sync Pipeline — 2 Root Causes Found

### Investigation Summary

The APR connections ("Contas a pagar 2026" and "Contas a receber 2026") were created as single-tab connections with `data_type: "transactions"`. When the user clicks "Sincronizar", the frontend routes them to `google-sheets-sync` (single-tab sync function) instead of `sheets-sync-all-tabs` (which has the APR pipeline).

**Root Cause 1 — Wrong sync function called.** In `GoogleSheetsPage.tsx`, `handleSync` checks `connection.sheet_name === null && connection.data_type === "all_tabs"` to decide which function to call. Since these APR connections have `sheet_name = "Contas a pagar 2026"` and `data_type = "transactions"`, they go to `google-sheets-sync`, which is a generic transaction importer with no APR awareness.

**Root Cause 2 — `google-sheets-sync` crashes on numeric headers.** The XLSX parser returns numbers for header cells (e.g., `46023` for Excel serial dates, `36447.41` for amounts). The `autoDetectMapping` function does `(h || "").toLowerCase()` which crashes because `h` is a `number`, not a `string`. This is the `(h || "").toLowerCase is not a function` error in the logs.

### Fix Plan

**1. `src/pages/GoogleSheetsPage.tsx` — Route APR connections to `syncAllTabs`**

In `handleSync`, detect if the connection's `sheet_name` matches payable/receivable patterns. If so, call `syncAllTabs` instead of `syncData`:

```text
handleSync logic:
  if data_type === "all_tabs" → syncAllTabs (existing)
  if sheet_name matches "contas a pagar/receber" → syncAllTabs (NEW)
  else → syncData (existing single-tab)
```

**2. `supabase/functions/google-sheets-sync/index.ts` — Fix crash on numeric headers**

Defensive fix in `autoDetectMapping`: coerce all header values to strings before calling `.toLowerCase()`. Change line 341:
```typescript
const normalizedHeaders = headers.map(h => 
  String(h ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
);
```

**3. `supabase/functions/sheets-sync-all-tabs/index.ts` — Handle single-tab APR connections**

When `sheets-sync-all-tabs` receives a connection with `sheet_name` set (not null), it currently reads ALL tabs from the spreadsheet and classifies them. This works — the APR tab will be classified and processed. But we need to ensure that:
- The connection's `sheet_name` is logged for debugging
- If no monthly tabs exist but APR tabs exist, it doesn't error (already fixed in previous plan)

**4. `src/hooks/useGoogleSheets.ts` — Invalidate APR queries after sync**

Add `"apr-payable"` and `"apr-receivable"` to the query invalidation list in `syncAllTabs.onSuccess` so the AccountsPage refreshes after sync.

### Files Modified

| File | Change |
|------|--------|
| `src/pages/GoogleSheetsPage.tsx` | Detect APR connections and route to `syncAllTabs` |
| `supabase/functions/google-sheets-sync/index.ts` | Fix `autoDetectMapping` crash on numeric headers |
| `src/hooks/useGoogleSheets.ts` | Add APR query keys to invalidation lists |

### What This Fixes
- Clicking "Sincronizar" on APR connections will use the correct pipeline with APR parsers
- Data flows into `accounts_payable_receivable` table
- AccountsPage cards display real data after sync
- The `google-sheets-sync` function no longer crashes on numeric XLSX headers (defensive fix)

