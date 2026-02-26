
-- Add scenario column to dre_periods for SAH model support (previsto/realizado)
ALTER TABLE public.dre_periods ADD COLUMN IF NOT EXISTS scenario text DEFAULT NULL;

-- Drop existing unique constraint if any, then create new one including scenario
DO $$
BEGIN
  -- Try to drop old constraint
  BEGIN
    ALTER TABLE public.dre_periods DROP CONSTRAINT IF EXISTS dre_periods_user_id_sheet_id_period_key_key;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.dre_periods DROP CONSTRAINT IF EXISTS dre_periods_unique_period;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- Create unique constraint including scenario (using COALESCE for NULL scenario)
CREATE UNIQUE INDEX IF NOT EXISTS dre_periods_unique_period_scenario 
ON public.dre_periods (user_id, sheet_id, period_key, COALESCE(scenario, '__none__'));
