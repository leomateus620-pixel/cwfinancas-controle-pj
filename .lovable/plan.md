

## Investigation Results: Why Contas a Pagar / Receber Shows Zero Data

### Root Cause (3 issues found)

**Issue 1 — The APR code was never deployed.** The `sheets-sync-all-tabs` edge function shows zero logs and `sync_tab_audit` has zero records. The APR pipeline code exists in the source file (lines 2192-2289) but the edge function was never redeployed after adding it. The last successful sync (Mar2026 at 00:02:50) ran with the OLD version of the function that doesn't include APR processing.

**Issue 2 — Drive fingerprint blocks re-sync.** Even after deploying, a re-sync of the Mar2026 connection (the only one with `sync_status: success`) would be skipped by the fingerprint check (line 1731) if the spreadsheet hasn't changed. The fingerprint is currently `nil` so this won't block the FIRST sync after deploy, but will block subsequent ones unless the spreadsheet is modified.

**Issue 3 — The "Contas a pagar 2026" and "Contas a receber 2026" connections are separate connections with `sync_status: error`.** These were created as standalone connections with `data_type: transactions`, but they point to tabs that are classified as PAYABLE/RECEIVABLE by the router. When synced individually, the function looks for MONTHLY_TRANSACTIONS tabs, finds none matching the selected range, and throws "Nenhuma aba mensal encontrada" (line 1838), causing the error status.

### Fix Plan

**Step 1: Deploy the edge function** — Force redeploy `sheets-sync-all-tabs` so the APR pipeline code is live.

**Step 2: Fix the "no monthly tabs" error for APR-only connections** — The function throws an error at line 1836-1838 if `monthlyTabs.length === 0`. When the user syncs from the "Contas a pagar 2026" connection, it should NOT fail just because there are no monthly tabs. Change the check to allow sync to proceed when APR tabs exist.

Specifically, at line 1836-1838:
```typescript
// BEFORE: throws if no monthly tabs
if (monthlyTabs.length === 0) {
  throw new Error("Nenhuma aba mensal encontrada no intervalo selecionado");
}

// AFTER: only throw if no monthly AND no APR tabs
const aprTabs = classified.filter(t => t.route === "PAYABLE" || t.route === "RECEIVABLE");
if (monthlyTabs.length === 0 && aprTabs.length === 0) {
  throw new Error("Nenhuma aba mensal ou de contas a pagar/receber encontrada");
}
```

**Step 3: Move APR classification BEFORE the monthly tab check** — The `aprTabs` variable is currently computed at line 2193, after all monthly processing. Move it up so it's available for the check in Step 2.

**Step 4: Clear the fingerprint after deploy** — After deploying, the first sync on connection `f3073495` will work since `last_source_fingerprint` is null. But we should also ensure the two "error" connections can re-sync.

### Files Modified

| File | Change |
|------|--------|
| `supabase/functions/sheets-sync-all-tabs/index.ts` | Move `aprTabs` classification before monthly check; allow sync with 0 monthly tabs if APR tabs exist |

Then force redeploy of the function.

### What This Fixes
- The APR pipeline will actually execute during sync
- "Contas a pagar 2026" and "Contas a receber 2026" connections can sync without erroring on "no monthly tabs"
- Data flows into `accounts_payable_receivable` table
- The existing UI (PayableCard, ReceivableCard) will display the imported data

