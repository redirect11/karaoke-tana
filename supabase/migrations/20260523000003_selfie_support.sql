-- =============================================================
--  Supporto selfie nelle prenotazioni
--
--  Aggiunge la colonna selfie_url alla tabella prenotazioni
--  e crea il bucket Supabase Storage "selfies" (pubblico in lettura,
--  insert anonimo con limite dimensione).
-- =============================================================

-- Colonna nella tabella prenotazioni
ALTER TABLE public.prenotazioni
  ADD COLUMN IF NOT EXISTS selfie_url TEXT;

-- Bucket storage per i selfie
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'selfies',
  'selfies',
  true,                          -- lettura pubblica (URL diretti funzionano)
  2097152,                       -- 2 MB max per file
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: chiunque può caricare (INSERT) un selfie
-- Il percorso è <serata_id>/<uuid>.jpg → non serve autenticazione
DO $$ BEGIN
  CREATE POLICY "selfies_insert_anon"
    ON storage.objects FOR INSERT
    TO anon, authenticated
    WITH CHECK (bucket_id = 'selfies');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: lettura pubblica
DO $$ BEGIN
  CREATE POLICY "selfies_select_public"
    ON storage.objects FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'selfies');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
