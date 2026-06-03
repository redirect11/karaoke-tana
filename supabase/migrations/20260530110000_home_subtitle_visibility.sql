ALTER TABLE impostazioni_pubbliche
  ADD COLUMN IF NOT EXISTS home_subtitle_enabled BOOLEAN NOT NULL DEFAULT TRUE;
