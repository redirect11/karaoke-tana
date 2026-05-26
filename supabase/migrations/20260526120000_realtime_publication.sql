-- =============================================================
--  realtime_publication
--
--  Aggiunge le tabelle alla pubblicazione `supabase_realtime` così che
--  Supabase Realtime invii gli eventi postgres_changes ai client.
--  Prima era un passo manuale da dashboard
--  (Database -> Replication -> supabase_realtime).
--
--  Senza questo, le pagine si aggiornano solo via poll di fallback;
--  con questo gli eventi (apri/chiudi serata, nuove prenotazioni, voti)
--  arrivano in tempo reale.
--
--  Idempotente: sicuro anche se le tabelle erano già state aggiunte a mano.
-- =============================================================

DO $$
DECLARE
  tbl text;
BEGIN
  -- Nei progetti Supabase la pubblicazione esiste già; se manca (es. locale) la creiamo.
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  FOREACH tbl IN ARRAY ARRAY['serate', 'prenotazioni', 'voti'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    END IF;
  END LOOP;
END $$;
