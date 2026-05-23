-- =============================================================
--  Archive admin controls
--
--  Aggiunge due campi su `serate`:
--    • archiviato_nascosto: se TRUE la serata non compare
--      nell'archivio pubblico (rimane visibile solo all'admin
--      che può tornare a renderla pubblica).
--    • cover_prenotazione_id: override opzionale per la foto di
--      copertina della serata; se NULL si applica il fallback
--      (selfie del vincitore, poi random tra i selfie caricati).
-- =============================================================

ALTER TABLE public.serate
  ADD COLUMN IF NOT EXISTS archiviato_nascosto BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.serate
  ADD COLUMN IF NOT EXISTS cover_prenotazione_id BIGINT
    REFERENCES public.prenotazioni(id) ON DELETE SET NULL;

-- Index utile per le query del listing pubblico (filtra archiviato_nascosto=false)
CREATE INDEX IF NOT EXISTS serate_archive_visible_idx
  ON public.serate (aperta, archiviato_nascosto, data DESC)
  WHERE aperta = FALSE;
