-- =============================================================
--  Visibilità selfie prenotazioni
--
--  Permette allo staff di nascondere una foto mantenendo il file
--  originale e mostrando il placeholder di default.
-- =============================================================

ALTER TABLE public.prenotazioni
  ADD COLUMN IF NOT EXISTS selfie_nascosta BOOLEAN NOT NULL DEFAULT FALSE;
