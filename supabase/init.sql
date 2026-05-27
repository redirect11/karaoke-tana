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
  prossima_serata_data DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO impostazioni_pubbliche (id, archivio_pubblico_abilitato, modalita_post_approvazione, prossima_serata_data)
VALUES (1, FALSE, 'direct_live', NULL)
ON CONFLICT (id) DO NOTHING;

-- Impedisce più di una serata aperta contemporaneamente
CREATE UNIQUE INDEX IF NOT EXISTS one_open_serata
  ON serate (aperta) WHERE aperta = TRUE;

ALTER TABLE serate ENABLE ROW LEVEL SECURITY;
ALTER TABLE impostazioni_pubbliche ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "serate_select" ON serate FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "serate_insert" ON serate FOR INSERT TO anon WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "serate_update" ON serate FOR UPDATE TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "impostazioni_pubbliche_select" ON impostazioni_pubbliche FOR SELECT TO anon USING (true);
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

DO $$ BEGIN
  ALTER TABLE impostazioni_pubbliche
    ADD CONSTRAINT impostazioni_pubbliche_modalita_post_approvazione_check
    CHECK (modalita_post_approvazione IN ('direct_live', 'preparation_then_live'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE serate
  ADD COLUMN IF NOT EXISTS mostra_voti_totali BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE serate
  ADD COLUMN IF NOT EXISTS vincitore_decretato BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE serate
  ADD COLUMN IF NOT EXISTS vincitore_prenotazione_id BIGINT;

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
  CREATE POLICY "prenotazioni_select" ON prenotazioni FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "prenotazioni_insert" ON prenotazioni FOR INSERT TO anon WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "prenotazioni_update" ON prenotazioni FOR UPDATE TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "prenotazioni_delete" ON prenotazioni FOR DELETE TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "serate_delete" ON serate FOR DELETE TO anon USING (true);
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
  CREATE POLICY "voti_select" ON voti FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "voti_insert" ON voti FOR INSERT TO anon WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "voti_update" ON voti FOR UPDATE TO anon USING (true);
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
