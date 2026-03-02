

## Diagnosis

### Bug 1: "Saiu" math is broken (Entrou - Saiu ≠ Sobrou)
**File:** `src/components/dre/DreStoryFlow.tsx` line 16
**Cause:** `saiu = abs(faturamento - receitaLiquida) + abs(despesasTotais)` only accounts for deductions + despesas. It misses CMV (-66,711), Custo de Venda (-5,910), and Distribuição de Lucro (-100,000). So Entrou(271k) - Saiu(126k) = 144k, but Sobrou shows -27k. Mathematically impossible.
**Fix:** Derive `saiu = faturamento - resultado`. This guarantees Entrou - Saiu = Sobrou always.

### Bug 2: `parseMonthHeader` doesn't match "Abr 2026" (space separator)
**File:** `supabase/functions/dre-sync/index.ts` line 154
**Cause:** Regex `/^([a-z]{3,})\.?\s*[\/\-]\s*(\d{2,4})$/` requires `/` or `-` between month and year. "Abr 2026" uses a space.
**Fix:** Add `\s` to the separator character class: `[\/\-\s]`.

### Bug 3: TOTAL not calculated when cell is empty
**File:** `supabase/functions/dre-sync/index.ts` (parseDreMatrix + parseDefaultDre)
**Cause:** If the TOTAL cell is blank for a line (e.g., "Distribuição de Lucro" has -50k in Jan and -50k in Feb but TOTAL is empty), the line gets `undefined` for TOTAL period and is skipped. So TOTAL shows 0 for that line.
**Fix:** After parsing values, if TOTAL column exists and a line has no value there but has values in month columns, auto-compute TOTAL = sum of month values.

### Bug 4: KPIs miss CMV, Custo de Venda, Distribuição
**File:** `src/hooks/useDRE.ts` `calculateDefaultKPIs`
**Cause:** Only extracts faturamento, receitaLiquida, despesasTotais, resultado. The "despesasTotais" from `findLineValue` doesn't include CMV, Custo de Venda, or Distribuição. These are separate DRE line groups.
**Fix:** Extract all components individually and compute a proper `totalSaiu`.

### Bug 5: DreSummaryCards "Impostos e taxas" shows wrong value
**File:** `src/components/dre/DreSummaryCards.tsx` line 38
**Cause:** Shows `receitaLiquida - faturamento`. If receitaLiquida is read directly from DRE (already includes CMV deduction in some formats), this shows an incorrect "tax" number.
**Fix:** Pass `deducoes` explicitly from KPI calculation.

---

## Implementation Plan

### Step 1: Fix `parseMonthHeader` to accept space separator
**File:** `supabase/functions/dre-sync/index.ts` line 154
Change regex from `[\/\-]` to `[\/\-\s]`. One-line change.

### Step 2: Add TOTAL auto-calculation for empty cells
**File:** `supabase/functions/dre-sync/index.ts`
In both `parseDreMatrix` (after line 529) and `parseDefaultDre` (after line 1521): iterate `parsedLines`, and for each line that has month values but no TOTAL value, set `values.set(totalColIndex, sumOfMonthValues)`.

### Step 3: Fix KPI calculation with full component extraction
**File:** `src/hooks/useDRE.ts` — rewrite `calculateDefaultKPIs` to:
- Extract: faturamento, deducoes, cmv, custoDeVenda, receitaLiquida, despesasTotais, lucroOperacional, distribuicao, resultadoExercicio
- Compute `totalSaiu = abs(deducoes) + abs(cmv) + abs(custoDeVenda) + abs(despesasTotais) + abs(distribuicao)`
- Return all components including `deducoes` and `totalSaiu`

### Step 4: Fix DreStoryFlow — derive "Saiu" from Entrou and Sobrou
**File:** `src/components/dre/DreStoryFlow.tsx`
Change props to receive `totalSaiu` from KPIs or compute `saiu = faturamento - resultado`. This ensures the three-step narrative is always mathematically consistent.

### Step 5: Fix DreSummaryCards — show actual deduções
**File:** `src/components/dre/DreSummaryCards.tsx`
Add `deducoes` prop and use it directly instead of computing `receitaLiquida - faturamento`.

### Step 6: Update DREPage to pass new props
**File:** `src/pages/DREPage.tsx`
Pass new KPI fields (deducoes, totalSaiu) to child components.

---

### Files to modify:
1. `supabase/functions/dre-sync/index.ts` — parseMonthHeader regex + TOTAL auto-calc
2. `src/hooks/useDRE.ts` — full KPI extraction with all DRE components
3. `src/components/dre/DreStoryFlow.tsx` — consistent Saiu calculation
4. `src/components/dre/DreSummaryCards.tsx` — use explicit deduções prop
5. `src/pages/DREPage.tsx` — pass new KPI fields

