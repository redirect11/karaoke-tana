-- Tabella allowlist degli utenti admin autenticati via Supabase Auth.
-- Ogni riga corrisponde a un utente Supabase Auth autorizzato come admin.
-- L'admin-bookings Edge Function verifica che il JWT dell'utente loggato
-- sia presente in questa tabella prima di eseguire qualsiasi azione.
CREATE TABLE IF NOT EXISTS admin_users (
  user_id    UUID         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Abilita RLS: nessuna policy pubblica, accessibile solo dal service role.
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
