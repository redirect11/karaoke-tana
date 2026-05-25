-- =============================================================
--  Legacy: admin_credentials PBKDF2
--
--  Questa migrazione è mantenuta per compatibilità con la history
--  remota Supabase (schema_migrations). Il flusso admin attuale
--  usa Supabase Auth + admin_users.
-- =============================================================

ALTER TABLE IF EXISTS admin_credentials
  ADD COLUMN IF NOT EXISTS password_salt TEXT,
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS password_iterations INTEGER NOT NULL DEFAULT 210000,
  ADD COLUMN IF NOT EXISTS password_hash_algo TEXT NOT NULL DEFAULT 'pbkdf2-sha256',
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
