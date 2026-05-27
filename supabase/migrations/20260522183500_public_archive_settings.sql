CREATE TABLE IF NOT EXISTS impostazioni_pubbliche (
  id BIGINT PRIMARY KEY CHECK (id = 1),
  archivio_pubblico_abilitato BOOLEAN NOT NULL DEFAULT FALSE,
  manutenzione_abilitata BOOLEAN NOT NULL DEFAULT FALSE,
  prossima_serata_data DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO impostazioni_pubbliche (id, archivio_pubblico_abilitato, manutenzione_abilitata, prossima_serata_data)
VALUES (1, FALSE, FALSE, NULL)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE impostazioni_pubbliche ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "impostazioni_pubbliche_select" ON impostazioni_pubbliche FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
