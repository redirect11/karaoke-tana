-- Migrazione admin_credentials da bcrypt a PBKDF2-SHA256 per Edge Runtime.
ALTER TABLE admin_credentials
  ADD COLUMN IF NOT EXISTS password_salt TEXT,
  ADD COLUMN IF NOT EXISTS password_iterations INTEGER,
  ADD COLUMN IF NOT EXISTS password_hash_algo TEXT;

UPDATE admin_credentials
SET
  password_iterations = COALESCE(password_iterations, 210000),
  password_hash_algo = COALESCE(NULLIF(TRIM(password_hash_algo), ''), 'pbkdf2-sha256');
