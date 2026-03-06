

## Plan: Fix Forecast Edge Functions — 3 Critical Bugs

### Root Cause Analysis

Three bugs are preventing forecast generation:

1. **`getClaims()` does not exist** in supabase-js v2.93.1 — both `build-forecast` and `forecast-insights` use `authClient.auth.getClaims(token)` which crashes the function immediately. Must use `authClient.auth.getUser()` instead.

2. **CORS headers incomplete** — the client sends `x-supabase-client-platform` and other headers, but the edge functions only allow `authorization, x-client-info, apikey, content-type`. The preflight fails.

3. **Wrong `sheet_id` passed** — `ForecastsPage` uses `connections?.[0]` which is the DRE connection (`0a3677e3`), but transactions have `source_sheet_id` pointing to Jan/Feb/Mar connections. The forecast function queries `transactions WHERE source_sheet_id = DRE_id` and gets zero results. The fix: don't filter by `sheet_id` for transactions (query all user transactions), but still use `sheet_id` for storing/querying forecast results.

### Changes

**1. `supabase/functions/build-forecast/index.ts`**
- Replace `getClaims(token)` with `getUser()` and extract `user.id`
- Update CORS headers to include all required Supabase client headers
- Remove the `source_sheet_id` filter on transactions query — always fetch all user transactions regardless of `sheet_id` (sheet_id is only used for storing/querying forecast results)

**2. `supabase/functions/forecast-insights/index.ts`**
- Same auth fix: replace `getClaims` with `getUser`
- Same CORS headers fix

**3. `src/pages/ForecastsPage.tsx`**
- Change `activeSheet` to pick the first **transaction** connection (not DRE). Or better: pass `null` to let the edge function use all transactions, and store results without sheet_id filtering.

**4. `src/hooks/useForecast.ts`**
- Remove `sheetId` dependency — always query forecast data without sheet_id filter (use `is("sheet_id", null)`) since all transactions are aggregated together.

### Files Modified
1. `supabase/functions/build-forecast/index.ts` — auth fix + CORS + remove source_sheet_id filter
2. `supabase/functions/forecast-insights/index.ts` — auth fix + CORS
3. `src/pages/ForecastsPage.tsx` — pass no sheetId
4. `src/hooks/useForecast.ts` — simplify to not use sheetId

