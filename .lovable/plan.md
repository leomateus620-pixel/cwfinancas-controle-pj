

## Diagnosis

Two bugs identified after code analysis:

### Bug 1: DRE 2026 data being deleted by DRE 2024 import

The root cause is in `dre-sync/index.ts`. When multiple matrix DRE tabs exist (e.g., "DRE 2024" and "DRE 2026"):

1. The main handler (line 1210-1222) deletes ALL old DEFAULT period data
2. It then iterates through matrix tabs sorted descending: "DRE 2026" first, then "DRE 2024"
3. `parseDreMatrix` is called for "DRE 2026" -- it inserts data correctly
4. `parseDreMatrix` is called for "DRE 2024" -- **it AGAIN deletes all DEFAULT periods** (lines 496-509), destroying the DRE 2026 data just inserted
5. Only DRE 2024 survives

The comment on line 1241 says "it will try to delete again but find nothing" -- this is incorrect because by then, the previous tab's data IS in the database.

### Bug 2: Descriptions showing "Sem descrição"

The spreadsheet has TWO description columns: "Descrição1" (often empty) and "Descrição2" (contains actual descriptions like "Taxa de boleto...", "Cobrança recebida..."). 

The `autoDetectMapping` function in `sheets-sync-all-tabs/index.ts` maps the `description` field to the FIRST header matching "descricao" -- which is "Descrição1" (empty). It never considers "Descrição2".

Evidence from `raw_data` in network response:
```
"Descrição1": "", "Descrição2": "Taxa de boleto - fatura nr. 744110051..."
```

---

## Implementation Plan

### Fix 1: DRE Matrix -- prevent cascading deletion

**File:** `supabase/functions/dre-sync/index.ts`

- Add a `skipCleanup` boolean parameter to `parseDreMatrix` (default `false`)
- When called from the multi-tab matrix handler (line 1233-1250), pass `skipCleanup: true` since cleanup is already done at lines 1210-1222
- In `parseDreMatrix`, wrap the delete block (lines 496-509) in `if (!skipCleanup) { ... }`
- This ensures DRE 2026 data is not deleted when DRE 2024 is processed next

### Fix 2: Description column -- pick the column with actual data

**File:** `supabase/functions/sheets-sync-all-tabs/index.ts`

- After `autoDetectMapping` runs and maps `description` to one column, check if there are OTHER unmapped columns whose headers also contain "descricao" or "description"
- If the mapped description column has >70% empty values in the first 50 data rows, AND an alternative description column has more data, swap to the better column
- If both have data, concatenate them (e.g., "Descrição1 - Descrição2") to preserve all information
- This handles the "Descrição1"/"Descrição2" pattern without breaking other spreadsheets

### Fix 3: Reprocess existing descriptions

- After deploying the fix, invoke `rebuild-categories` (already exists) or add a similar rebuild step to fix the `description` field on existing transactions where `raw_data` contains non-empty "Descrição2" but the stored `description` is "Sem descrição"
- The rebuild function can iterate transactions with `description = 'Sem descrição'`, check `raw_data` for alternative description fields, and update accordingly

### Technical Details

**dre-sync changes (Fix 1):**
```
parseDreMatrix signature: add skipCleanup parameter
Line 496-509: wrap deletion in if (!skipCleanup)
Line 1243: pass skipCleanup=true
```

**sheets-sync-all-tabs changes (Fix 2):**
After line 1121 (`const mapping = validateAndFixMapping(...)`), add a `validateDescriptionMapping` function that:
1. Finds all unmapped columns matching "descricao" or "description" headers
2. Samples 50 data rows to check fill rates of each
3. If current mapped column has <30% fill rate and alternative has >50%, switch
4. If both have data, create a composite mapping strategy

**rebuild-categories enhancement (Fix 3):**
Add a mode to also fix descriptions from `raw_data`:
- Scan for `description = 'Sem descrição'` where `raw_data` has keys matching "Descrição2" or similar
- Update description from the non-empty field

