

## Diagnosis

### A) "0 importadas de 1544 processadas" — 3 Root Causes

1. **Empty header on Valor column (PRIMARY CAUSE)**. The XLSX shows headers: `Data | Conta | Categoria | Fornecedor | [EMPTY] | ...`. Column E (the amount column with values like `$(3,216.74)`) has NO header text. `autoDetectMapping` only matches by header keywords, so `amount` is never mapped. Every row returns `value: null` from `extractAmount` → all skipped as `VALUE_PARSE_FAIL`.

2. **No fallback density-based detection**. When header-based mapping fails to find an `amount` column, there is no fallback that scans data rows to find which column has the highest percentage of parseable monetary values.

3. **The values use US dollar format** (`$3,216.74`, `$(50,000.00)`). The `parseBRL` parser already handles this correctly (removes `$`, detects comma-before-dot as thousands separator), so parsing itself is fine once the column is detected.

### B) KPIs errados na DRE — 2 Root Causes

1. **"Faturamento" keyword doesn't match "RECEITA BRUTA TOTAL"**. In `calculateDefaultKPIs`, `findLineValue(lines, "faturamento")` searches for the word "faturamento" but this DRE uses "RECEITA BRUTA TOTAL". After normalization, "receita bruta total" does NOT contain "faturamento" → returns 0. Cards show Faturamento = R$ 0.

2. **"resultado" matches wrong line**. `findLineValue(lines, "resultado")` can match "RESULTADO DO EXERCÍCIO" but also "RESULTADO" from the FLUXO DE CAIXA block if it leaked into imported data. The stop keyword fix from the last iteration should prevent FLUXO DE CAIXA leaking, but the synonym list for faturamento is still missing.

## Execution Plan (5 Steps)

### Step 1 — Fix amount column detection by data density
**File:** `supabase/functions/sheets-sync-all-tabs/index.ts`
- After `autoDetectMapping`, if `mapping.amount` is not set AND `mapping.credit`/`mapping.debit` are not set, scan first 50 data rows to find the column with highest parseable monetary value density using `parseBRL`. Exclude columns already mapped to `date`, `category`, `account`, `description`.
- Set `mapping.amount = headers[bestColIdx]` if density > 30%. If header is empty, use the column index as a synthetic key.

### Step 2 — Handle empty-header columns in row object construction
**File:** `supabase/functions/sheets-sync-all-tabs/index.ts`
- When building `rowObj` from `headers` and `row`, if a header is empty string, use `__col_${i}` as the key. Update the mapping to reference this synthetic key when amount is detected by density on an empty-header column.

### Step 3 — Fix KPI keyword synonyms for "faturamento"
**File:** `src/hooks/useDRE.ts`
- In `calculateDefaultKPIs`, add "receita bruta" as a synonym for faturamento: try `findLineValue(lines, "faturamento")` first, then fallback to `findLineValue(lines, "receita bruta")`.
- Add "resultado do exercicio" as synonym for resultado (more specific, avoids matching FLUXO DE CAIXA's "RESULTADO").

### Step 4 — Fix `google-sheets-sync` (single-tab sync) with same density fallback
**File:** `supabase/functions/google-sheets-sync/index.ts`
- Apply the same density-based amount detection fallback to maintain consistency with multi-tab sync.

### Step 5 — Verify no regression
- The density fallback only activates when header-based mapping fails to find amount/credit/debit. Existing spreadsheets with proper "Valor" headers are unaffected.
- KPI synonym additions are additive (try new keyword only if old one returns null). No change for spreadsheets already matching "faturamento".

## Files to Modify

1. `supabase/functions/sheets-sync-all-tabs/index.ts` — add density-based amount column detection + empty-header handling
2. `supabase/functions/google-sheets-sync/index.ts` — same density fallback for single-tab sync
3. `src/hooks/useDRE.ts` — add "receita bruta" synonym for faturamento, "resultado do exercicio" for resultado

