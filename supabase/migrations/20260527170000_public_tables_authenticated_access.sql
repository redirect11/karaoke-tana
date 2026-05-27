-- =============================================================
--  public_tables_authenticated_access
--
--  Le policy RLS delle tabelle pubbliche erano definite solo `TO anon`.
--  Un admin loggato (ruolo `authenticated`) che naviga le pagine pubbliche
--  (home, vota, archivio) invia le richieste con il proprio JWT, quindi
--  come ruolo `authenticated`: non essendo coperto dalle policy `TO anon`,
--  RLS restituiva ZERO righe -> home "prenotazioni chiuse", vota redirect
--  alla home, archivio vuoto, e il realtime non consegnava eventi.
--
--  Estendiamo le policy a `anon, authenticated` (stessa convenzione già
--  usata dalle policy storage dei selfie). Le condizioni restano invariate
--  (USING/WITH CHECK true), quindi nessuna nuova esposizione: l'accesso era
--  già aperto ad `anon`, ora vale anche per gli admin loggati.
--
--  Idempotente: salta le policy eventualmente assenti.
-- =============================================================

DO $$ BEGIN ALTER POLICY "serate_select" ON serate TO anon, authenticated; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER POLICY "serate_insert" ON serate TO anon, authenticated; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER POLICY "serate_update" ON serate TO anon, authenticated; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER POLICY "serate_delete" ON serate TO anon, authenticated; EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN ALTER POLICY "prenotazioni_select" ON prenotazioni TO anon, authenticated; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER POLICY "prenotazioni_insert" ON prenotazioni TO anon, authenticated; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER POLICY "prenotazioni_update" ON prenotazioni TO anon, authenticated; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER POLICY "prenotazioni_delete" ON prenotazioni TO anon, authenticated; EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN ALTER POLICY "voti_select" ON voti TO anon, authenticated; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER POLICY "voti_insert" ON voti TO anon, authenticated; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER POLICY "voti_update" ON voti TO anon, authenticated; EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN ALTER POLICY "impostazioni_pubbliche_select" ON impostazioni_pubbliche TO anon, authenticated; EXCEPTION WHEN undefined_object THEN NULL; END $$;
