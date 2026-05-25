-- =============================================================
--  karaoke-tana – Schema base
--  Migrazione iniziale per sviluppo locale con Supabase CLI.
--
--  Questa migrazione viene applicata automaticamente da:
--    supabase start  (primo avvio)
--    supabase db reset  (reset completo)
--
--  Le migrazioni successive (20260520*) aggiungono colonne
--  con ADD COLUMN IF NOT EXISTS, quindi sono idempotenti.
-- =============================================================


-- ─────────────────────────────────────────────────────────────
--  Legacy: admin_credentials
--  Tabella del vecchio sistema di login admin (password hash).
--  Non più usata (rimpiazzata da Supabase Auth + admin_users),
--  ma necessaria perché la migrazione 20260520150000 la altera.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_credentials (
  id          SERIAL       PRIMARY KEY,
  username    TEXT         NOT NULL UNIQUE,
  password    TEXT         NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────
--  1. SERATE
--  Una sola serata può essere aperta alla volta (unique index
--  parziale su aperta = TRUE).
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS serate (
  id                           BIGSERIAL    PRIMARY KEY,
  data                         DATE         NOT NULL DEFAULT CURRENT_DATE,
  aperta                       BOOLEAN      NOT NULL DEFAULT FALSE,
  voto_aperto                  BOOLEAN      NOT NULL DEFAULT FALSE,
  mostra_voti_totali           BOOLEAN      NOT NULL DEFAULT FALSE,
  vincitore_decretato          BOOLEAN      NOT NULL DEFAULT FALSE,
  vincitore_prenotazione_id    BIGINT,
  notifiche_telegram_abilitate BOOLEAN      NOT NULL DEFAULT TRUE,
  notifiche_browser_abilitate  BOOLEAN      NOT NULL DEFAULT TRUE,
  note                         TEXT,
  created_at                   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS one_open_serata
  ON serate (aperta) WHERE aperta = TRUE;

ALTER TABLE serate ENABLE ROW LEVEL SECURITY;

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
  CREATE POLICY "serate_delete" ON serate FOR DELETE TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ─────────────────────────────────────────────────────────────
--  2. PRENOTAZIONI
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prenotazioni (
  id         BIGSERIAL    PRIMARY KEY,
  nome       TEXT         NOT NULL,
  canzone    TEXT         NOT NULL,
  artista    TEXT         NOT NULL,
  tavolo     INTEGER      DEFAULT 0,       -- opzionale, non più raccolto dal form
  cantata    BOOLEAN      NOT NULL DEFAULT FALSE,
  approvata  BOOLEAN      NOT NULL DEFAULT FALSE,
  serata_id  BIGINT       REFERENCES serate(id),
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

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


-- ─────────────────────────────────────────────────────────────
--  3. VOTI
--  Un voto per canzone, aggiornabile (1–5 stelle).
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS voti (
  id               BIGSERIAL    PRIMARY KEY,
  prenotazione_id  BIGINT       NOT NULL REFERENCES prenotazioni(id) ON DELETE CASCADE,
  voto             INTEGER      NOT NULL CHECK (voto >= 1 AND voto <= 5),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
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


-- ─────────────────────────────────────────────────────────────
--  NOTA: Realtime
--  In Supabase cloud devi abilitare il realtime manualmente:
--    Dashboard → Database → Replication → supabase_realtime
--    → aggiungi: prenotazioni, serate, voti
--
--  In locale (supabase start) il realtime è abilitato per default
--  su tutte le tabelle.
-- ─────────────────────────────────────────────────────────────
