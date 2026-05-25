-- =============================================================
--  prenotazioni_abilitate
--
--  Aggiunge il campo `prenotazioni_abilitate` alla tabella serate.
--  Permette allo staff di disabilitare le prenotazioni senza chiudere
--  la serata (stato "karaoke aperto, prenotazioni chiuse").
--  Valore di default TRUE: le prenotazioni sono attive all'apertura.
-- =============================================================

ALTER TABLE public.serate
  ADD COLUMN IF NOT EXISTS prenotazioni_abilitate BOOLEAN NOT NULL DEFAULT TRUE;
