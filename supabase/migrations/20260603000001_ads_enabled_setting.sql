-- Aggiunge il flag ads_enabled a impostazioni_pubbliche.
-- DEFAULT TRUE: gli ads sono attivi in produzione per default.
ALTER TABLE public.impostazioni_pubbliche
  ADD COLUMN IF NOT EXISTS ads_enabled BOOLEAN NOT NULL DEFAULT TRUE;
