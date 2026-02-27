

## Diagnosis

After reading the full `dre-sync/index.ts` (1908 lines), `DREPage.tsx`, `useDRE.ts`, and all DRE components, here are the root causes:

### Bug 1: "Only TOTAL" — Month-by-month view lost
- **Root cause (UI)**: `DREPage.tsx` lines 68-78 auto-selects `${selectedYear}-TOTAL` as the default period. There's no UI affordance to switch to individual months easily — the period dropdown is small and TOTAL is always pre-selected.
- **Root cause (Backend)**: `parseDefaultDre` (line 1474) uses bare `"TOTAL"` instead of year-scoped `"2026-TOTAL"`, causing filtering issues. Monthly periods ARE imported but the UI hides them by defaulting to TOTAL.

### Bug 2: SAH connection error
- **Root cause**: `matcherSAH` (line 628) uses rigid regex `^dre\s+2026$` — only matches exactly "DRE 2026". Any variation (extra space, different year) fails.
- **Root cause**: `parseSAH` uses `.insert()` (line 744) not `.upsert()` for periods. On re-sync, if year-scoped cleanup fails to delete (e.g., scenario mismatch), insert fails with unique constraint violation → 500 error.
- **Root cause**: Year-scoped cleanup (line 720) uses `LIKE '${dreYear}%'` but doesn't filter by `template_type`, so it could delete periods from other models.

### Bug 3: Similar spreadsheets fail
- **Root cause**: All 3 new matchers are hardcoded to exact tab names:
  - SAH: `^dre\s+2026$` (line 628)
  - StartSync: `^2026\s+dre$` (line 788)
  - GR: `dre-caixa` or `dre caixa` (line 974)
- Any year change or slight naming variation = no match → falls through to DEFAULT parser which may also fail.

### Bug 4: LCF lost nucleos
- **Root cause**: LCF parser itself is intact. The regression is in the UI: `DREPage.tsx` shows the nucleo toggle ONLY when `activeTemplate === "LCF_NUCLEO"` (line 96) AND `nucleos.length >= 2` (line 222). But `activeTemplate` is derived from `sortedPeriods[0].template_type` — if a DEFAULT period sorts before LCF periods (higher year), the template shows as DEFAULT and nucleos toggle disappears.

### Bug 5: Cleanup cascade between models/years
- **Root cause**: SAH/StartSync/GR cleanup uses `LIKE '${dreYear}%'` without filtering by `template_type`, so importing SAH for 2026 can delete DEFAULT or GR periods for the same year. Also, DEFAULT parser (line 1477) deletes ALL DEFAULT periods regardless of year.

---

## Implementation Plan

### 1. Fix matchers — make year-flexible
**File:** `supabase/functions/dre-sync/index.ts`

- `matcherSAH`: Change from `^dre\s+2026$` to `^dre\s+20\d{2}$` + keep dual-header check (Previsto/Realizado)
- `matcherStartSync`: Change from `^2026\s+dre$` to `^20\d{2}\s+dre$`
- `matcherGR`: Keep as-is (name-based, not year-dependent)
- All matchers must extract year dynamically from tab name, not assume 2026

### 2. Fix period insertion — use upsert everywhere
**File:** `supabase/functions/dre-sync/index.ts`

- `parseSAH` line 744: Change `.insert()` to `.upsert()` with `onConflict`
- `parseStartSync` line 927: Same
- `parseGR` line 1141: Same
- `parseDefaultDre` line 1504: Same
- Year-scope the DEFAULT TOTAL: change `"TOTAL"` (line 1474) to `"${dreYear}-TOTAL"` using year detection

### 3. Fix cleanup — scope by template_type + year
**File:** `supabase/functions/dre-sync/index.ts`

- All cleanup queries must filter by BOTH `template_type` AND year prefix
- SAH cleanup: add `.eq("template_type", "SAH")` 
- StartSync cleanup: add `.eq("template_type", "STARTSYNC")`
- GR cleanup: add `.eq("template_type", "GR")`
- DEFAULT/Matrix cleanup: already filters by `template_type = DEFAULT`

### 4. Fix UI — restore month-by-month + nucleos
**File:** `src/pages/DREPage.tsx`

- Change default period selection: prefer latest month (e.g., `2026-01`) instead of TOTAL. Only fall back to TOTAL if no monthly periods exist.
- Fix `activeTemplate` derivation: instead of using `sortedPeriods[0]`, detect template from ALL periods for the selected connection (use most frequent or connection-specific template)
- Show nucleo toggle when ANY period has `LCF_NUCLEO` template, not just the first sorted period

**File:** `src/hooks/useDRE.ts`

- Fix `activeTemplate` (line 112-114): scan all periods for the selected connection, return the template that has the most periods (or the one matching the selected year)
- When `sheetId` filter is active, ensure periods are filtered correctly

### 5. Fix DEFAULT parser TOTAL key
**File:** `supabase/functions/dre-sync/index.ts`

- In `parseDefaultDre`, detect year from month headers and scope TOTAL: `${dreYear}-TOTAL` instead of bare `"TOTAL"`
- Add `scenario: null` to period inserts (line 1495-1501)

### 6. Improve error handling
**File:** `supabase/functions/dre-sync/index.ts`

- Wrap each model parse in try/catch so one model failure doesn't abort the entire sync
- Log the specific error per tab and continue processing other tabs
- Return partial results with error details

---

### Files to modify:
- `supabase/functions/dre-sync/index.ts` — matcher flexibility, upsert, cleanup scoping, DEFAULT TOTAL fix, error handling
- `src/pages/DREPage.tsx` — default period selection (prefer monthly), template detection fix
- `src/hooks/useDRE.ts` — `activeTemplate` derivation fix

### No database migration needed
The existing schema already has `scenario` column and the unique constraint.

