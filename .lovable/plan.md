

## Plan: Add "Importar Contas" Button to AccountsPage

### What
Add an empty state with a one-click import button to the Contas a Pagar / Receber page, matching the DRE page pattern. When no APR data exists, show a prompt with an "Importar Contas" button that triggers sync of only the payable/receivable tabs from the already-connected spreadsheet.

### How

**`src/pages/AccountsPage.tsx`** — Single file change:
1. Import `useGoogleSheets` and add `RefreshCw`, `FileSpreadsheet` icons
2. Add empty state check: when `payable.length === 0 && receivable.length === 0 && !isLoading`, show the empty state card
3. The "Importar Contas" button calls `syncAllTabs.mutate()` on the first available connection, passing only APR-related tabs
4. Add a refresh/re-sync button in the header (like DRE has) for when data already exists
5. Match the DRE's "liquid glass" empty state visual style with decorative gradient orbs

### Button Logic
```text
onClick → syncAllTabs.mutate({
  connectionId: connections[0].id,
  // no selectedTabs filter needed — the pipeline already
  // classifies and processes only PAYABLE/RECEIVABLE tabs
})
```

The existing `sheets-sync-all-tabs` pipeline already classifies tabs and processes APR tabs automatically. No backend changes needed.

### Files Modified

| File | Change |
|------|--------|
| `src/pages/AccountsPage.tsx` | Add empty state with import button + header sync button |

