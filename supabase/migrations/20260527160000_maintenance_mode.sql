ALTER TABLE public.impostazioni_pubbliche
  ADD COLUMN IF NOT EXISTS manutenzione_abilitata BOOLEAN NOT NULL DEFAULT FALSE;
