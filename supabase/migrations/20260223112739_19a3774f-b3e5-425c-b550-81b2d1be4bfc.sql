
-- 1) Adicionar novos campos
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS stable_key text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS content_hash text;

-- 2) Backfill stable_key a partir de external_row_key para registros existentes
UPDATE transactions
SET stable_key = external_row_key
WHERE external_row_key IS NOT NULL AND stable_key IS NULL;

-- 3) Backfill content_hash a partir dos dados existentes (hash real dos campos)
UPDATE transactions
SET content_hash = md5(
  COALESCE(date::text, '') || '|' ||
  (amount * 100)::bigint::text || '|' ||
  LOWER(TRIM(COALESCE(description, ''))) || '|' ||
  LOWER(TRIM(COALESCE(category, ''))) || '|' ||
  LOWER(TRIM(COALESCE(client_vendor, '')))
)
WHERE content_hash IS NULL AND source_sheet_id IS NOT NULL;

-- 4) Remover indices parciais conflitantes
DROP INDEX IF EXISTS idx_transactions_external_row_key_unique;
DROP INDEX IF EXISTS idx_transactions_idempotent_key;

-- 5) Remover indice antigo sem WHERE
DROP INDEX IF EXISTS idx_transactions_upsert_key;

-- 6) Criar indice unico sobre stable_key (parcial para nao afetar transacoes manuais)
CREATE UNIQUE INDEX idx_transactions_stable_key
ON transactions (user_id, source_sheet_id, stable_key)
WHERE stable_key IS NOT NULL AND source_sheet_id IS NOT NULL;

-- 7) Adicionar colunas de fingerprint e lock na connections
ALTER TABLE google_sheet_connections
ADD COLUMN IF NOT EXISTS last_source_fingerprint text,
ADD COLUMN IF NOT EXISTS lock_until timestamptz;
