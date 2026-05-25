ALTER TABLE serate
  ADD COLUMN IF NOT EXISTS winner_reveal_countdown_active BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE serate
  ADD COLUMN IF NOT EXISTS winner_reveal_countdown_started_at TIMESTAMPTZ;

ALTER TABLE serate
  ADD COLUMN IF NOT EXISTS winner_reveal_countdown_ends_at TIMESTAMPTZ;

ALTER TABLE serate
  ADD COLUMN IF NOT EXISTS winner_reveal_countdown_seconds INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'serate_winner_reveal_countdown_seconds_check'
  ) THEN
    ALTER TABLE serate
      ADD CONSTRAINT serate_winner_reveal_countdown_seconds_check
      CHECK (winner_reveal_countdown_seconds IS NULL OR winner_reveal_countdown_seconds BETWEEN 5 AND 300);
  END IF;
END $$;
