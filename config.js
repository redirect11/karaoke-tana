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

  // ── Telegram ──────────────────────────────────────────────
  // 1. Cerca @BotFather su Telegram → /newbot → copia il token
  // 2. Crea un gruppo con lo staff, aggiungi il bot come membro
  // 3. Manda un messaggio nel gruppo, poi apri nel browser:
  //    https://api.telegram.org/bot{TOKEN}/getUpdates
  //    Il chat_id del gruppo è il numero negativo in "chat":{"id":...}
  TELEGRAM_BOT_TOKEN: '',   // es. '7312456789:AAFxxxxxx'
  TELEGRAM_CHAT_ID:   '',   // es. '-1001234567890'

  // ── Admin ─────────────────────────────────────────────────
  // Password per accedere a /admin.html
  ADMIN_PASSWORD: 'tana2024',

};

// =============================================================
//  SQL DA ESEGUIRE SU SUPABASE UNA VOLTA SOLA
//  (Supabase dashboard → SQL Editor → New query → Esegui)
// =============================================================
//
//  CREATE TABLE prenotazioni (
//    id         BIGSERIAL PRIMARY KEY,
//    nome       TEXT NOT NULL,
//    canzone    TEXT NOT NULL,
//    artista    TEXT NOT NULL,
//    tavolo     INTEGER NOT NULL,
//    cantata    BOOLEAN DEFAULT FALSE,
//    created_at TIMESTAMPTZ DEFAULT NOW()
//  );
//
//  ALTER TABLE prenotazioni ENABLE ROW LEVEL SECURITY;
//
//  CREATE POLICY "insert_public" ON prenotazioni
//    FOR INSERT TO anon WITH CHECK (true);
//
//  CREATE POLICY "select_public" ON prenotazioni
//    FOR SELECT TO anon USING (true);
//
//  CREATE POLICY "update_public" ON prenotazioni
//    FOR UPDATE TO anon USING (true);
//
//  -- Attiva il real-time per la tabella:
//  -- Supabase dashboard → Database → Replication → supabase_realtime
//  -- → aggiungi la tabella "prenotazioni"
// =============================================================
