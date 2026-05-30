-- =============================================================
--  La Tana del Coniglio – Karaoke Booking
--  Script di inizializzazione Supabase
--
--  Come eseguire:
--    Supabase dashboard → SQL Editor → New query → incolla → Run
--
--  Sicuro da rieseguire: usa IF NOT EXISTS / DROP IF EXISTS.
-- =============================================================


-- ─────────────────────────────────────────────────────────────
--  1. SERATE
--     Una sola serata può essere aperta alla volta.
--     Le prenotazioni e le votazioni vengono abilitate/disabilitate
--     per serata tramite i flag `aperta` e `voto_aperto`.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS serate (
  id          BIGSERIAL    PRIMARY KEY,
  data        DATE         NOT NULL DEFAULT CURRENT_DATE,
  aperta      BOOLEAN      NOT NULL DEFAULT FALSE,
  voto_aperto BOOLEAN      NOT NULL DEFAULT FALSE,
  notifiche_telegram_abilitate BOOLEAN NOT NULL DEFAULT TRUE,
  notifiche_browser_abilitate  BOOLEAN NOT NULL DEFAULT TRUE,
  note        TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS impostazioni_pubbliche (
  id BIGINT PRIMARY KEY CHECK (id = 1),
  archivio_pubblico_abilitato BOOLEAN NOT NULL DEFAULT FALSE,
  modalita_post_approvazione TEXT NOT NULL DEFAULT 'direct_live',
  home_subtitle_text TEXT NOT NULL DEFAULT 'Il karaoke, la votazione e la coda in un unico posto.',
  home_follow_title TEXT NOT NULL DEFAULT 'Prima di tutto…',
  home_follow_message TEXT NOT NULL DEFAULT 'Segui la nostra pagina Instagram per poter prenotare una canzone.',
  home_form_title TEXT NOT NULL DEFAULT 'Prenota la tua canzone 🎤',
  home_form_message TEXT NOT NULL DEFAULT 'Compila il form e lo staff la aggiungerà alla lista appena possibile.',
  home_success_title TEXT NOT NULL DEFAULT 'Richiesta inviata!',
  home_success_message TEXT NOT NULL DEFAULT 'Lo staff la controllerà e apparirà in lista appena viene approvata.',
  home_waiting_title TEXT NOT NULL DEFAULT 'Stato della tua prenotazione',
  home_waiting_message TEXT NOT NULL DEFAULT 'Sto controllando lo stato della tua prenotazione…',
  home_bookings_disabled_title TEXT NOT NULL DEFAULT 'Prenotazioni non disponibili',
  home_bookings_disabled_message TEXT NOT NULL DEFAULT 'Le prenotazioni sono al momento chiuse.',
  home_closed_title TEXT NOT NULL DEFAULT 'Prenotazioni chiuse',
  home_closed_message TEXT NOT NULL DEFAULT E'Al momento non è attiva nessuna serata karaoke.\nTorna più tardi!',
  home_maintenance_title TEXT NOT NULL DEFAULT '🚧 In manutenzione',
  home_maintenance_message TEXT NOT NULL DEFAULT 'Sito in manutenzione. Torneremo presto.\nIntanto segui la nostra pagina per scoprire le ultime novità e le prossime date del karaoke',
  winner_reveal_animation_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  winner_reveal_animation_mode TEXT NOT NULL DEFAULT 'automatic',
  winner_reveal_auto_step_seconds INTEGER NOT NULL DEFAULT 3,
  winner_reveal_countdown_default_seconds INTEGER NOT NULL DEFAULT 5,
  prossima_serata_data DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO impostazioni_pubbliche (
  id,
  archivio_pubblico_abilitato,
  modalita_post_approvazione,
  home_subtitle_text,
  home_follow_title,
  home_follow_message,
  home_form_title,
  home_form_message,
  home_success_title,
  home_success_message,
  home_waiting_title,
  home_waiting_message,
  home_bookings_disabled_title,
  home_bookings_disabled_message,
  home_closed_title,
  home_closed_message,
  home_maintenance_title,
  home_maintenance_message,
  winner_reveal_animation_enabled,
  winner_reveal_animation_mode,
  winner_reveal_auto_step_seconds,
  winner_reveal_countdown_default_seconds,
  prossima_serata_data
)
VALUES (
  1,
  FALSE,
  'direct_live',
  'Il karaoke, la votazione e la coda in un unico posto.',
  'Prima di tutto…',
  'Segui la nostra pagina Instagram per poter prenotare una canzone.',
  'Prenota la tua canzone 🎤',
  'Compila il form e lo staff la aggiungerà alla lista appena possibile.',
  'Richiesta inviata!',
  'Lo staff la controllerà e apparirà in lista appena viene approvata.',
  'Stato della tua prenotazione',
  'Sto controllando lo stato della tua prenotazione…',
  'Prenotazioni non disponibili',
  'Le prenotazioni sono al momento chiuse.',
  'Prenotazioni chiuse',
  E'Al momento non è attiva nessuna serata karaoke.\nTorna più tardi!',
  '🚧 In manutenzione',
  'Sito in manutenzione. Torneremo presto.\nIntanto segui la nostra pagina per scoprire le ultime novità e le prossime date del karaoke',
  TRUE,
  'automatic',
  3,
  5,
  NULL
)
ON CONFLICT (id) DO NOTHING;

-- Impedisce più di una serata aperta contemporaneamente
CREATE UNIQUE INDEX IF NOT EXISTS one_open_serata
  ON serate (aperta) WHERE aperta = TRUE;

ALTER TABLE serate ENABLE ROW LEVEL SECURITY;
ALTER TABLE impostazioni_pubbliche ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "serate_select" ON serate FOR SELECT TO anon, authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "serate_insert" ON serate FOR INSERT TO anon, authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "serate_update" ON serate FOR UPDATE TO anon, authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "impostazioni_pubbliche_select" ON impostazioni_pubbliche FOR SELECT TO anon, authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ─────────────────────────────────────────────────────────────
--  2. PRENOTAZIONI
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prenotazioni (
  id         BIGSERIAL    PRIMARY KEY,
  nome       TEXT         NOT NULL,
  canzone    TEXT         NOT NULL,
  artista    TEXT         NOT NULL,
  tavolo     INTEGER      NOT NULL,
  cantata    BOOLEAN      NOT NULL DEFAULT FALSE,
  approvata  BOOLEAN      NOT NULL DEFAULT FALSE,
  in_preparazione BOOLEAN NOT NULL DEFAULT FALSE,
  serata_id  BIGINT       REFERENCES serate(id),
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Aggiunge serata_id se la tabella esisteva già senza la colonna
ALTER TABLE prenotazioni
  ADD COLUMN IF NOT EXISTS serata_id BIGINT REFERENCES serate(id);

ALTER TABLE prenotazioni
  ADD COLUMN IF NOT EXISTS approvata BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE prenotazioni
  ADD COLUMN IF NOT EXISTS in_preparazione BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE impostazioni_pubbliche
  ADD COLUMN IF NOT EXISTS modalita_post_approvazione TEXT NOT NULL DEFAULT 'direct_live';

ALTER TABLE impostazioni_pubbliche
  ADD COLUMN IF NOT EXISTS home_subtitle_text TEXT NOT NULL DEFAULT 'Il karaoke, la votazione e la coda in un unico posto.';

ALTER TABLE impostazioni_pubbliche
  ADD COLUMN IF NOT EXISTS home_follow_title TEXT NOT NULL DEFAULT 'Prima di tutto…';

ALTER TABLE impostazioni_pubbliche
  ADD COLUMN IF NOT EXISTS home_follow_message TEXT NOT NULL DEFAULT 'Segui la nostra pagina Instagram per poter prenotare una canzone.';

ALTER TABLE impostazioni_pubbliche
  ADD COLUMN IF NOT EXISTS home_form_title TEXT NOT NULL DEFAULT 'Prenota la tua canzone 🎤';

ALTER TABLE impostazioni_pubbliche
  ADD COLUMN IF NOT EXISTS home_form_message TEXT NOT NULL DEFAULT 'Compila il form e lo staff la aggiungerà alla lista appena possibile.';

ALTER TABLE impostazioni_pubbliche
  ADD COLUMN IF NOT EXISTS home_success_title TEXT NOT NULL DEFAULT 'Richiesta inviata!';

ALTER TABLE impostazioni_pubbliche
  ADD COLUMN IF NOT EXISTS home_success_message TEXT NOT NULL DEFAULT 'Lo staff la controllerà e apparirà in lista appena viene approvata.';

ALTER TABLE impostazioni_pubbliche
  ADD COLUMN IF NOT EXISTS home_waiting_title TEXT NOT NULL DEFAULT 'Stato della tua prenotazione';

ALTER TABLE impostazioni_pubbliche
  ADD COLUMN IF NOT EXISTS home_waiting_message TEXT NOT NULL DEFAULT 'Sto controllando lo stato della tua prenotazione…';

ALTER TABLE impostazioni_pubbliche
  ADD COLUMN IF NOT EXISTS home_bookings_disabled_title TEXT NOT NULL DEFAULT 'Prenotazioni non disponibili';

ALTER TABLE impostazioni_pubbliche
  ADD COLUMN IF NOT EXISTS home_bookings_disabled_message TEXT NOT NULL DEFAULT 'Le prenotazioni sono al momento chiuse.';

ALTER TABLE impostazioni_pubbliche
  ADD COLUMN IF NOT EXISTS home_closed_title TEXT NOT NULL DEFAULT 'Prenotazioni chiuse';

ALTER TABLE impostazioni_pubbliche
  ADD COLUMN IF NOT EXISTS home_closed_message TEXT NOT NULL DEFAULT E'Al momento non è attiva nessuna serata karaoke.\nTorna più tardi!';

ALTER TABLE impostazioni_pubbliche
  ADD COLUMN IF NOT EXISTS home_maintenance_title TEXT NOT NULL DEFAULT '🚧 In manutenzione';

ALTER TABLE impostazioni_pubbliche
  ADD COLUMN IF NOT EXISTS home_maintenance_message TEXT NOT NULL DEFAULT E'Sito in manutenzione. Torneremo presto.\nIntanto segui la nostra pagina per scoprire le ultime novità e le prossime date del karaoke';

ALTER TABLE impostazioni_pubbliche
  ADD COLUMN IF NOT EXISTS winner_reveal_animation_enabled BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE impostazioni_pubbliche
  ADD COLUMN IF NOT EXISTS winner_reveal_animation_mode TEXT NOT NULL DEFAULT 'automatic';

ALTER TABLE impostazioni_pubbliche
  ADD COLUMN IF NOT EXISTS winner_reveal_auto_step_seconds INTEGER NOT NULL DEFAULT 3;

ALTER TABLE impostazioni_pubbliche
  ADD COLUMN IF NOT EXISTS winner_reveal_countdown_default_seconds INTEGER NOT NULL DEFAULT 5;

DO $$ BEGIN
  ALTER TABLE impostazioni_pubbliche
    ADD CONSTRAINT impostazioni_pubbliche_modalita_post_approvazione_check
    CHECK (modalita_post_approvazione IN ('direct_live', 'preparation_then_live'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE impostazioni_pubbliche
    ADD CONSTRAINT impostazioni_pubbliche_winner_reveal_animation_mode_check
    CHECK (winner_reveal_animation_mode IN ('manual', 'automatic'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE impostazioni_pubbliche
    ADD CONSTRAINT impostazioni_pubbliche_winner_reveal_auto_step_seconds_check
    CHECK (winner_reveal_auto_step_seconds BETWEEN 1 AND 30);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE impostazioni_pubbliche
    ADD CONSTRAINT impostazioni_pubbliche_winner_reveal_countdown_default_seconds_check
    CHECK (winner_reveal_countdown_default_seconds BETWEEN 5 AND 300);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE serate
  ADD COLUMN IF NOT EXISTS mostra_voti_totali BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE serate
  ADD COLUMN IF NOT EXISTS vincitore_decretato BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE serate
  ADD COLUMN IF NOT EXISTS vincitore_prenotazione_id BIGINT;

ALTER TABLE serate
  ADD COLUMN IF NOT EXISTS winner_reveal_countdown_active BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE serate
  ADD COLUMN IF NOT EXISTS winner_reveal_countdown_started_at TIMESTAMPTZ;

ALTER TABLE serate
  ADD COLUMN IF NOT EXISTS winner_reveal_countdown_ends_at TIMESTAMPTZ;

ALTER TABLE serate
  ADD COLUMN IF NOT EXISTS winner_reveal_countdown_seconds INTEGER;

ALTER TABLE serate
  ADD COLUMN IF NOT EXISTS winner_reveal_current_rank INTEGER;

ALTER TABLE serate
  ADD COLUMN IF NOT EXISTS winner_reveal_total_ranks INTEGER;

ALTER TABLE serate
  ADD COLUMN IF NOT EXISTS winner_reveal_step_started_at TIMESTAMPTZ;

DO $$ BEGIN
  ALTER TABLE serate
    ADD CONSTRAINT serate_winner_reveal_countdown_seconds_check
    CHECK (winner_reveal_countdown_seconds IS NULL OR winner_reveal_countdown_seconds BETWEEN 5 AND 300);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE serate
    ADD CONSTRAINT serate_winner_reveal_current_rank_check
    CHECK (winner_reveal_current_rank IS NULL OR winner_reveal_current_rank BETWEEN 1 AND 5);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE serate
    ADD CONSTRAINT serate_winner_reveal_total_ranks_check
    CHECK (winner_reveal_total_ranks IS NULL OR winner_reveal_total_ranks BETWEEN 1 AND 5);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Compatibilità con installazioni esistenti che hanno creato `serate`
-- prima dell'introduzione dei toggle notifiche.
ALTER TABLE serate
  ADD COLUMN IF NOT EXISTS notifiche_telegram_abilitate BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE serate
  ADD COLUMN IF NOT EXISTS notifiche_browser_abilitate BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE prenotazioni
  ADD COLUMN IF NOT EXISTS selfie_url TEXT;

ALTER TABLE prenotazioni
  ADD COLUMN IF NOT EXISTS selfie_nascosta BOOLEAN NOT NULL DEFAULT FALSE;

-- tavolo non è più raccolto dal form; rende la colonna opzionale
ALTER TABLE prenotazioni ALTER COLUMN tavolo DROP NOT NULL;
ALTER TABLE prenotazioni ALTER COLUMN tavolo SET DEFAULT 0;

ALTER TABLE prenotazioni ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "prenotazioni_select" ON prenotazioni FOR SELECT TO anon, authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "prenotazioni_insert" ON prenotazioni FOR INSERT TO anon, authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "prenotazioni_update" ON prenotazioni FOR UPDATE TO anon, authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "prenotazioni_delete" ON prenotazioni FOR DELETE TO anon, authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "serate_delete" ON serate FOR DELETE TO anon, authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ─────────────────────────────────────────────────────────────
--  3. VOTI
--     Un voto per canzone per dispositivo (gestito lato client
--     tramite localStorage). Il voto è aggiornabile (1–5).
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS voti (
  id               BIGSERIAL   PRIMARY KEY,
  prenotazione_id  BIGINT      NOT NULL REFERENCES prenotazioni(id) ON DELETE CASCADE,
  voto             INTEGER     NOT NULL CHECK (voto >= 1 AND voto <= 5),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE voti ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "voti_select" ON voti FOR SELECT TO anon, authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "voti_insert" ON voti FOR INSERT TO anon, authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "voti_update" ON voti FOR UPDATE TO anon, authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- =============================================================
--  REALTIME: aggiungi le tabelle alla pubblicazione supabase_realtime
--  così che i client ricevano gli eventi postgres_changes.
--  Idempotente: sicuro anche se già aggiunte a mano dal dashboard.
-- =============================================================
DO $$
DECLARE
  tbl text;
BEGIN
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
