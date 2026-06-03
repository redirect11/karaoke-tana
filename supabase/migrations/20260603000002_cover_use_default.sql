-- Aggiunge flag per forzare il logo.png come cover nell'archivio.
-- cover_prenotazione_id=null + cover_use_default=false → automatica (vincitore/random)
-- cover_prenotazione_id=X                              → selfie specifico
-- cover_prenotazione_id=null + cover_use_default=true  → logo.png
ALTER TABLE public.serate
  ADD COLUMN IF NOT EXISTS cover_use_default BOOLEAN NOT NULL DEFAULT FALSE;
