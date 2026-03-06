

## Plan: Lower Forecast Minimum to 2 Months + Premium Liquid Glass Redesign

### Part 1: Lower Minimum Data Requirement (2 months + DRE)

**A. Edge Function `supabase/functions/build-forecast/index.ts`**
- Line 90: Change minimum from `4` to `2` months
- Line 92: Update error message to reflect new minimum
- Line 297: Adjust confidence penalty — with 2 months, current formula gives `85 - (6-2)*8 = 53%`, which is acceptable. Add a bonus when DRE data validates the months (e.g., +10 if DRE matches for all months)
- Add a `low_data_mode` flag when `n < 4` that slightly dampens the slope influence to avoid overfitting with just 2 data points

**B. Hook `src/hooks/useForecast.ts`**
- Line ~118: Change `hasEnoughData: realMonths.length >= 4` → `>= 2`

**C. Page `src/pages/ForecastsPage.tsx`**
- Line 158: Update empty state text from "4 meses" to "2 meses de transações + DRE"

### Part 2: Premium Liquid Glass Redesign of Forecast Components

**D. `ForecastKPIs.tsx` — Glass KPI cards**
- Replace `liquid-glass-navy` with `liquid-glass-caixa` class (reuse the premium glass from Caixa Atual)
- Add icon in glass pill background
- Better typography hierarchy: title smaller/tracking, value larger/bolder
- Subtle colored left border accent per KPI type (green for receita, blue for confidence, amber for risk)
- Smooth hover with `hover:scale-[1.01]` transition

**E. `ForecastChart.tsx` — Glass chart container**
- Apply `liquid-glass-caixa` class to outer container
- Series toggle buttons: use `liquid-glass-chip` active style
- Tooltip: use glass treatment with blur

**F. `ForecastCashFlow.tsx` — Glass projected cards**
- Outer container: `liquid-glass-caixa`
- Each month item: `liquid-glass-bank-card` style with hover
- Better value hierarchy: saldo as primary, entradas/saídas as secondary pills
- Add subtle colored indicator (green/red dot) for positive/negative months

**G. `ForecastInsightsPanel.tsx` — Glass insights**
- Outer container: `liquid-glass-caixa`
- Summary block: glass highlight with premium border
- Section cards (insights, risks, opportunities): refined glass sub-cards
- Risk severity badges with glass pill treatment

**H. `ForecastsPage.tsx` — Page-level refinements**
- Header select + button: glass treatment on controls
- Warning banner: glass card with amber accent border
- Empty state: premium glass container with subtle gradient orbs
- Generating state: glass container with refined spinner

### Files Modified
1. `supabase/functions/build-forecast/index.ts` — minimum 4→2, dampen slope for low data
2. `src/hooks/useForecast.ts` — hasEnoughData threshold 4→2
3. `src/pages/ForecastsPage.tsx` — empty state text + glass styling
4. `src/components/forecast/ForecastKPIs.tsx` — premium glass cards
5. `src/components/forecast/ForecastChart.tsx` — glass container + controls
6. `src/components/forecast/ForecastCashFlow.tsx` — glass month cards
7. `src/components/forecast/ForecastInsightsPanel.tsx` — glass insights

### What Does NOT Change
- All data logic (weighted moving avg, linear slope, DRE validation, seasonality)
- Forecast insights AI prompt and edge function
- Database schema
- Hook query structure
- Chart rendering logic (Recharts areas, gradients, reference lines)

