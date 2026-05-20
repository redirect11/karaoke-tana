// =============================================================
//  CONFIGURAZIONE – compila queste variabili prima di andare live
// =============================================================

const CONFIG = {

  // ── Instagram ─────────────────────────────────────────────
  IG_USERNAME: 'latanadelconiglio_nola',

  // ── Supabase ──────────────────────────────────────────────
  // Trovate in: supabase.com → tuo progetto → Settings → API
  SUPABASE_URL:      'https://TUO-PROGETTO.supabase.co',
  SUPABASE_ANON_KEY: 'eyJ...LA_TUA_ANON_KEY',

  // ── Solo valori pubblici nel browser ─────────────────────
  // Non inserire qui password admin, token Telegram o altri
  // segreti: config.js viene pubblicato su GitHub Pages ed è
  // leggibile da chiunque apra il sito.

  // ── Cooldown prenotazione ──────────────────────────────────
  // Minuti dopo i quali si può prenotare di nuovo anche senza
  // che la canzone venga spuntata dallo staff (fallback)
  BOOKING_COOLDOWN_MIN: 90,

};

// =============================================================
//  SQL DA ESEGUIRE SU SUPABASE UNA VOLTA SOLA
//  (Supabase dashboard → SQL Editor → New query → Esegui)
// =============================================================
//
//  -- 1. Tabella prenotazioni
//  CREATE TABLE prenotazioni (
//    id         BIGSERIAL PRIMARY KEY,
//    nome       TEXT NOT NULL,
//    canzone    TEXT NOT NULL,
//    artista    TEXT NOT NULL,
//    tavolo     INTEGER NOT NULL,
//    cantata    BOOLEAN DEFAULT FALSE,
//    serata_id  BIGINT,
//    created_at TIMESTAMPTZ DEFAULT NOW()
//  );
//
//  ALTER TABLE prenotazioni ENABLE ROW LEVEL SECURITY;
//  CREATE POLICY "insert_public" ON prenotazioni FOR INSERT TO anon WITH CHECK (true);
//  CREATE POLICY "select_public" ON prenotazioni FOR SELECT TO anon USING (true);
//  CREATE POLICY "update_public" ON prenotazioni FOR UPDATE TO anon USING (true);
//
//  -- 2. Tabella serate (una sola può essere aperta alla volta)
//  CREATE TABLE serate (
//    id          BIGSERIAL PRIMARY KEY,
//    data        DATE NOT NULL DEFAULT CURRENT_DATE,
//    aperta      BOOLEAN DEFAULT FALSE,
//    voto_aperto BOOLEAN DEFAULT FALSE,
//    note        TEXT,
//    created_at  TIMESTAMPTZ DEFAULT NOW()
//  );
//
//  -- Impedisce più di una serata aperta contemporaneamente
//  CREATE UNIQUE INDEX one_open_serata ON serate (aperta) WHERE aperta = TRUE;
//
//  ALTER TABLE serate ENABLE ROW LEVEL SECURITY;
//  CREATE POLICY "select_public" ON serate FOR SELECT TO anon USING (true);
//  CREATE POLICY "insert_public" ON serate FOR INSERT TO anon WITH CHECK (true);
//  CREATE POLICY "update_public" ON serate FOR UPDATE TO anon USING (true);
//
//  -- Collega prenotazioni a serate
//  ALTER TABLE prenotazioni
//    ADD CONSTRAINT fk_serata FOREIGN KEY (serata_id) REFERENCES serate(id);
//
//  -- 3. Tabella voti (un voto per canzone per dispositivo, aggiornabile)
//  CREATE TABLE voti (
//    id               BIGSERIAL PRIMARY KEY,
//    prenotazione_id  BIGINT NOT NULL REFERENCES prenotazioni(id) ON DELETE CASCADE,
//    voto             INTEGER NOT NULL CHECK (voto >= 1 AND voto <= 5),
//    created_at       TIMESTAMPTZ DEFAULT NOW()
//  );
//
//  ALTER TABLE voti ENABLE ROW LEVEL SECURITY;
//  CREATE POLICY "select_public" ON voti FOR SELECT TO anon USING (true);
//  CREATE POLICY "insert_public" ON voti FOR INSERT TO anon WITH CHECK (true);
//  CREATE POLICY "update_public" ON voti FOR UPDATE TO anon USING (true);
//
//  -- Attiva il real-time per tutte e tre le tabelle:
//  -- Supabase dashboard → Database → Replication → supabase_realtime
//  -- → aggiungi "prenotazioni", "serate", "voti"
// =============================================================
