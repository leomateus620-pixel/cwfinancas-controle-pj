

## Plan: DRE Multi-Model Import + Premium UI Redesign

This plan has two major tracks: backend (new parsers + fixes) and frontend (UI redesign).

---

### Track 1: Backend — `supabase/functions/dre-sync/index.ts`

**1.1 Add `dre_year` extraction + year-scoped cleanup**
- Add `extractYearFromTab(tabName, rows)` that returns the year (2024/2025/2026) from tab name, month headers, or content
- Change cleanup logic: instead of deleting ALL DEFAULT periods, scope deletion by year. Each matrix tab only cleans periods matching its detected year
- TOTAL period keys become year-scoped: `2026-TOTAL`, `2025-TOTAL`, `2024-TOTAL` (instead of plain `TOTAL`)

**1.2 Add tab scoring + priority**
- `scoreDreTab(tabName, rows)` returns a priority score:
  - +100 if name contains "2026"
  - +80 if name contains "DRE"
  - +60 if month headers show 2026 dates
  - -100 if name matches non-DRE patterns (fluxo, dashboard, contas)
- Sort candidates by score descending so 2026 is processed/displayed first

**1.3 Add 3 new model matchers + parsers (additive, no changes to existing)**

**Model SAH** — matcher: tab name "DRE 2026" + dual-row header (row 3=months, row 4=Previsto/Realizado) + paired columns with gaps
- Parser reads fixed column layout (E/F for Jan, H/I for Feb, etc.)
- Imports TWO scenarios per period: `scenario=previsto` and `scenario=realizado`
- Annual totals from columns B (previsto) and C (realizado) → `2026-TOTAL`
- Stop at end of DRE structure, ignore free-text notes below
- Uses cell values as-is (no recalculation)

**Model StartSync** — matcher: tab name "2026 DRE" + columns B:M = months, O = TOTAL, N = spacer
- Parser reads B:M as Jan-Dec, O as TOTAL
- Detects and excludes "SALDO BANCÁRIO" block (stop importing at that section)
- Standard single-scenario import

**Model GR** — matcher: tab name "DRE-Caixa" + year from month headers
- Parser reads B:M as months, O as TOTAL, ignores N
- Handles duplicate labels ("RESULTADO MÊS" appears twice) using `line_key = slug + "__r" + row_index`
- Renames internally: first occurrence → "RESULTADO MÊS (pré distribuição)", second → "RESULTADO MÊS (pós distribuição)"
- Ignores unlabeled rows (percentage lines without description)
- Tolerates #N/A in distribution rows (imports valid months, logs warning)

**1.4 Model registry approach**
- Create a `DRE_MODELS` array with `{ id, matcher(tabName, rows), parse(...) }` entries
- Detection loop: for each candidate tab, iterate models in priority order, first match wins
- Existing parsers (DEFAULT, LCF_NUCLEO, Matrix/Baladão) remain untouched — new models are appended

**1.5 Database: add `scenario` column to `dre_periods`**
- Migration: `ALTER TABLE dre_periods ADD COLUMN scenario text DEFAULT NULL`
- Update unique constraint to include scenario for SAH model support

---

### Track 2: Frontend — DRE Page Redesign

**2.1 New file: `src/components/dre/DreLabels.ts`**
- Label map: technical → simple Portuguese
  - "Deduções" → "Impostos e taxas"
  - "Receita Líquida" → "Quanto sobrou após impostos"
  - "Despesas Totais" → "Gastos do mês"
  - "Resultado" → "Lucro/Prejuízo do mês"
  - "Margem Líquida" → "Quanto virou lucro (%)"
- Tooltip explanations for each term

**2.2 New file: `src/components/dre/DreSummaryCards.tsx`**
- 4-5 liquid glass cards with:
  - Faturamento do mês
  - Impostos e taxas
  - Gastos do mês
  - Lucro/Prejuízo (highlighted, green/amber)
  - Margem de lucro (%)
- Each card: glass background (`backdrop-blur-xl`, subtle border, noise texture), large value, small label, optional tooltip
- Responsive: 5 cols desktop, 2 cols mobile

**2.3 New file: `src/components/dre/DreStoryFlow.tsx`**
- Visual 3-step flow: "Entrou → Saiu → Sobrou"
- Each step: icon, simple name, main number, one-line explanation
- Connected with subtle arrows/lines
- Glass card styling per step

**2.4 New file: `src/components/dre/DreDetailsAccordion.tsx`**
- Collapsible accordion (hidden by default) with "Ver detalhamento"
- Groups DRE lines into sections (Receitas, Impostos, Gastos, etc.)
- Sub-items collapsible within each section
- Search/filter within details
- Uses existing `DRELine[]` data

**2.5 Rewrite `src/pages/DREPage.tsx`**
- Compact top bar: company dropdown, period dropdown, "Atualizar" button
- Default period selection: prioritize 2026-TOTAL, then latest year
- Replace KPI grid + full table with: DreSummaryCards → DreStoryFlow → DreDetailsAccordion
- Keep existing LCF/Nucleo toggle when applicable
- Skeleton loading with glass styling
- Empty state with simplified language

**2.6 Update `src/hooks/useDRE.ts`**
- Sort periods to prioritize 2026 > 2025 > 2024
- Default selected period = latest year's TOTAL (or latest month)
- Handle new `scenario` field (filter realizado by default for SAH)

---

### Technical Details

**Files to create:**
- `src/components/dre/DreLabels.ts`
- `src/components/dre/DreSummaryCards.tsx`
- `src/components/dre/DreStoryFlow.tsx`
- `src/components/dre/DreDetailsAccordion.tsx`

**Files to modify:**
- `supabase/functions/dre-sync/index.ts` — add 3 models, year-scoped cleanup, tab scoring
- `src/pages/DREPage.tsx` — full redesign with new components
- `src/hooks/useDRE.ts` — period sorting, scenario filtering

**Database migration:**
- Add `scenario` column to `dre_periods`
- Update unique constraint to `(user_id, sheet_id, period_key, scenario)`

