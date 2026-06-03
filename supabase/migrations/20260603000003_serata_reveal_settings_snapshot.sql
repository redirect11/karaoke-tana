-- Snapshot delle impostazioni reveal al momento dell'avvio del countdown/revealing.
-- Quando il countdown parte, i valori correnti di impostazioni_pubbliche vengono
-- copiati qui così che tutti i client ricevano le stesse impostazioni via realtime
-- senza bisogno di query separate a impostazioni_pubbliche.
-- NULL = non ancora inizializzati (usa i valori di impostazioni_pubbliche come fallback).
ALTER TABLE public.serate
  ADD COLUMN IF NOT EXISTS reveal_animation_enabled    BOOLEAN,
  ADD COLUMN IF NOT EXISTS reveal_animation_mode       TEXT CHECK (reveal_animation_mode IN ('automatic', 'manual')),
  ADD COLUMN IF NOT EXISTS reveal_auto_step_seconds    INTEGER CHECK (reveal_auto_step_seconds BETWEEN 1 AND 30);
