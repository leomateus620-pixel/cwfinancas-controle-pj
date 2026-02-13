
-- Step 1: Delete JAN/25 rows (out of scope)
DELETE FROM transactions WHERE source_tab ILIKE '%JAN%25%' OR source_tab ILIKE '%JAN/25%' OR source_tab ILIKE '%jan%25%';

-- Step 2: Deduplicate - keep only the most recent per external_row_key
DELETE FROM transactions WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER(PARTITION BY external_row_key ORDER BY created_at DESC) as rn
    FROM transactions
    WHERE external_row_key IS NOT NULL
  ) t WHERE t.rn > 1
);

-- Step 3: Drop existing partial unique indexes that don't work with upsert
DROP INDEX IF EXISTS idx_transactions_external_row_key;
DROP INDEX IF EXISTS idx_transactions_user_sheet_external_key;
DROP INDEX IF EXISTS idx_transactions_upsert_key;
DROP INDEX IF EXISTS idx_transactions_upsert_safe;

-- Step 4: Create new non-partial unique index for upsert
CREATE UNIQUE INDEX idx_transactions_upsert_key ON transactions (user_id, source_sheet_id, external_row_key);
