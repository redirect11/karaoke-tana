-- =============================================================
--  replica_identity_full
--
--  Imposta REPLICA IDENTITY FULL sulle tabelle usate da Supabase Realtime
--  con filtri postgres_changes (es. serata_id=eq.X).
--
--  Senza questa impostazione, gli eventi UPDATE inviano solo le colonne
--  modificate: Supabase non può applicare il filtro perché serata_id
--  (non cambiata) è assente dal payload. Il risultato è che i client
--  ricevono solo INSERT, mai UPDATE → la pagina si aggiorna solo via poll.
--
--  Con REPLICA IDENTITY FULL ogni evento porta il record completo
--  (old + new), abilitando i filtri lato server e i callback realtime.
-- =============================================================

ALTER TABLE public.prenotazioni REPLICA IDENTITY FULL;
ALTER TABLE public.serate       REPLICA IDENTITY FULL;
ALTER TABLE public.voti         REPLICA IDENTITY FULL;
