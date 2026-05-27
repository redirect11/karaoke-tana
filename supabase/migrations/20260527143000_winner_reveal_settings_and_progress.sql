ALTER TABLE impostazioni_pubbliche
  ADD COLUMN IF NOT EXISTS winner_reveal_animation_enabled BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE impostazioni_pubbliche
  ADD COLUMN IF NOT EXISTS winner_reveal_animation_mode TEXT NOT NULL DEFAULT 'automatic';

ALTER TABLE impostazioni_pubbliche
  ADD COLUMN IF NOT EXISTS winner_reveal_auto_step_seconds INTEGER NOT NULL DEFAULT 3;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'impostazioni_pubbliche_winner_reveal_animation_mode_check'
  ) THEN
    ALTER TABLE impostazioni_pubbliche
      ADD CONSTRAINT impostazioni_pubbliche_winner_reveal_animation_mode_check
      CHECK (winner_reveal_animation_mode IN ('manual', 'automatic'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'impostazioni_pubbliche_winner_reveal_auto_step_seconds_check'
  ) THEN
    ALTER TABLE impostazioni_pubbliche
      ADD CONSTRAINT impostazioni_pubbliche_winner_reveal_auto_step_seconds_check
      CHECK (winner_reveal_auto_step_seconds BETWEEN 1 AND 30);
  END IF;
END $$;

ALTER TABLE serate
  ADD COLUMN IF NOT EXISTS winner_reveal_current_rank INTEGER;

ALTER TABLE serate
  ADD COLUMN IF NOT EXISTS winner_reveal_total_ranks INTEGER;

ALTER TABLE serate
  ADD COLUMN IF NOT EXISTS winner_reveal_step_started_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'serate_winner_reveal_current_rank_check'
  ) THEN
    ALTER TABLE serate
      ADD CONSTRAINT serate_winner_reveal_current_rank_check
      CHECK (winner_reveal_current_rank IS NULL OR winner_reveal_current_rank BETWEEN 1 AND 5);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'serate_winner_reveal_total_ranks_check'
  ) THEN
    ALTER TABLE serate
      ADD CONSTRAINT serate_winner_reveal_total_ranks_check
      CHECK (winner_reveal_total_ranks IS NULL OR winner_reveal_total_ranks BETWEEN 1 AND 5);
  END IF;
END $$;
