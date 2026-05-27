ALTER TABLE public.impostazioni_pubbliche
  ADD COLUMN IF NOT EXISTS modalita_post_approvazione TEXT NOT NULL DEFAULT 'direct_live';

UPDATE public.impostazioni_pubbliche
SET modalita_post_approvazione = 'direct_live'
WHERE modalita_post_approvazione IS NULL;

DO $$ BEGIN
  ALTER TABLE public.impostazioni_pubbliche
    ADD CONSTRAINT impostazioni_pubbliche_modalita_post_approvazione_check
    CHECK (modalita_post_approvazione IN ('direct_live', 'preparation_then_live'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.prenotazioni
  ADD COLUMN IF NOT EXISTS in_preparazione BOOLEAN NOT NULL DEFAULT FALSE;
