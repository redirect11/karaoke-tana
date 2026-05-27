ALTER TABLE impostazioni_pubbliche
  ADD COLUMN IF NOT EXISTS winner_reveal_countdown_default_seconds INTEGER NOT NULL DEFAULT 5;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'impostazioni_pubbliche_winner_reveal_countdown_default_seconds_check'
  ) THEN
    ALTER TABLE impostazioni_pubbliche
      ADD CONSTRAINT impostazioni_pubbliche_winner_reveal_countdown_default_seconds_check
      CHECK (winner_reveal_countdown_default_seconds BETWEEN 5 AND 300);
  END IF;
END $$;
