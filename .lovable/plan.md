

## Diagnosis: Complete Bug Map

### Critical Bug: ALL upsert calls fail (500 error)
**Location:** `dre-sync/index.ts` lines 562, 745, 929, 1144, 1518
**Cause:** The unique index `dre_periods_unique_period_scenario` uses expression `COALESCE(scenario, '__none__')`, which cannot be matched by `.upsert({ onConflict: "user_id,sheet_id,period_key" })`. PostgreSQL requires the `ON CONFLICT` target to match a constraint exactly. Expression indexes don't qualify.
**Fix:** Replace all `.upsert()` calls with `.insert()`. The cleanup-then-insert pattern already guarantees idempotency. Each parser already deletes old periods before inserting new ones.

### Bug 2: Missing "Abr" month in Sonho de Consumo DRE
**Location:** `detectDreMatrix()` line 375 and `parseDefaultDre()` line 1401
**Cause:** Month headers span 2 rows in this spreadsheet (Jan-Mar on row 6, Abr+TOTAL on row 7). The detector only scans one row at a time.
**Fix:** After finding the primary header row, scan the adjacent row (headerRow+1) for additional month columns and TOTAL that were not found on the primary row. Merge them into the detection result.

### Bug 3: FLUXO DE CAIXA block leaks into DRE data
**Location:** `MATRIX_DRE_STOP_KEYWORDS` line 357
**Cause:** Stop keywords include "lucro operacional" and "lucro liquido" which cuts the DRE too early — missing DISTRIBUIÇÃO DE LUCRO and RESULTADO DO EXERCÍCIO. Meanwhile FLUXO DE CAIXA has no stop.
**Fix:** Replace stop keywords with non-DRE block keywords: "fluxo de caixa", "saldo bancario". This lets the parser import through RESULTADO DO EXERCÍCIO and stop before FLUXO DE CAIXA.

### Bug 4: Percentage rows (e.g. "% CMV", "% Imposto") parsed as DRE lines
**Location:** `parseDefaultDre()` line 1453-1470
**Cause:** No filter for percentage-only rows in the DEFAULT/Matrix parser (GR parser has this filter at line 1059 but others don't).
**Fix:** Add check in `parseDefaultDre` and `parseDreMatrix` to skip rows where the label starts with "%" or the label is purely a percentage indicator.

### Bug 5: UI shows only TOTAL period by default
**Location:** `DREPage.tsx` lines 68-78
**Cause:** Auto-selection prefers TOTAL. The code tries monthly periods but the fallback logic resolves to TOTAL.
**Status:** Already partially fixed in last iteration. Verify and ensure latest month is selected.

---

## Implementation Plan

### Step 1: Fix upsert → insert (all parsers)
**File:** `supabase/functions/dre-sync/index.ts`
- Line 562: Change `.upsert(periodInserts, { onConflict: ... })` to `.insert(periodInserts)`
- Line 745: Same for SAH parser
- Line 929: Same for StartSync parser
- Line 1144: Same for GR parser
- Line 1518: Same for DEFAULT parser
- All 5 parsers already do cleanup before insert, so idempotency is maintained

### Step 2: Fix multi-row header detection
**File:** `supabase/functions/dre-sync/index.ts`
- In `detectDreMatrix()` (line 393-432): After finding the primary header row with ≥2 months, scan headerRow+1 for additional month columns and TOTAL that aren't already in `candidates`
- In `parseDefaultDre()` (line 1412-1432): Same logic — after finding header row, scan adjacent row
- In `parseStartSync()` (line 810-833): Same logic

### Step 3: Fix stop keywords for matrix/default parsers
**File:** `supabase/functions/dre-sync/index.ts`
- Line 357-359: Replace `MATRIX_DRE_STOP_KEYWORDS` content:
  - Remove: "lucro operacional", "resultado operacional", "lucro liquido", "resultado liquido"
  - Add: "fluxo de caixa", "saldo bancario", "saldo banco"
- This lets the parser import through the full DRE (including RESULTADO DO EXERCÍCIO) and stop at non-DRE blocks

### Step 4: Skip percentage rows in DEFAULT/Matrix parsers
**File:** `supabase/functions/dre-sync/index.ts`
- In `parseDreMatrix()` around line 490-494: Add `if (/^%/.test(label.trim())) continue;`
- In `parseDefaultDre()` around line 1456: Same check

### Step 5: Verify UI period selection
**File:** `src/pages/DREPage.tsx`
- Confirm the auto-selection logic prefers the latest monthly period over TOTAL
- Already partially fixed in previous iteration; verify no regression

### Step 6: Verify EXCLUDE keywords don't block legitimate DRE lines
**File:** `supabase/functions/dre-sync/index.ts`
- Line 361-365: `MATRIX_EXCLUDE_KEYWORDS` contains "distribuicao" which would incorrectly exclude "DISTRIBUIÇÃO DE LUCRO" lines from import
- Fix: Remove "distribuicao" from exclude keywords, or make the exclusion more specific (only exclude when combined with personal names like "chris", "michelle")

---

### Technical Details

**Files to modify:**
- `supabase/functions/dre-sync/index.ts` — 6 targeted changes (upsert→insert, header detection, stop keywords, percentage filter, exclude keywords)
- `src/pages/DREPage.tsx` — verify/fix period selection

**No database migration needed.** The existing unique index works fine with insert (it prevents true duplicates). The cleanup logic ensures no conflicts.

**Testing:** After deploying the edge function, invoke dre-sync against the Sonho de Consumo connection to verify:
- All 12 months + TOTAL detected (including Abr)
- Lines imported correctly up to RESULTADO DO EXERCÍCIO
- No FLUXO DE CAIXA data leaking in
- No 500 error on sync

