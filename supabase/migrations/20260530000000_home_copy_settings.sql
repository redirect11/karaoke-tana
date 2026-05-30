ALTER TABLE impostazioni_pubbliche
  ADD COLUMN IF NOT EXISTS home_subtitle_text TEXT NOT NULL DEFAULT 'Il karaoke, la votazione e la coda in un unico posto.';

ALTER TABLE impostazioni_pubbliche
  ADD COLUMN IF NOT EXISTS home_follow_title TEXT NOT NULL DEFAULT 'Prima di tutto…';

ALTER TABLE impostazioni_pubbliche
  ADD COLUMN IF NOT EXISTS home_follow_message TEXT NOT NULL DEFAULT 'Segui la nostra pagina Instagram per poter prenotare una canzone.';

ALTER TABLE impostazioni_pubbliche
  ADD COLUMN IF NOT EXISTS home_form_title TEXT NOT NULL DEFAULT 'Prenota la tua canzone 🎤';

ALTER TABLE impostazioni_pubbliche
  ADD COLUMN IF NOT EXISTS home_form_message TEXT NOT NULL DEFAULT 'Compila il form e lo staff la aggiungerà alla lista appena possibile.';

ALTER TABLE impostazioni_pubbliche
  ADD COLUMN IF NOT EXISTS home_success_title TEXT NOT NULL DEFAULT 'Richiesta inviata!';

ALTER TABLE impostazioni_pubbliche
  ADD COLUMN IF NOT EXISTS home_success_message TEXT NOT NULL DEFAULT 'Lo staff la controllerà e apparirà in lista appena viene approvata.';

ALTER TABLE impostazioni_pubbliche
  ADD COLUMN IF NOT EXISTS home_waiting_title TEXT NOT NULL DEFAULT 'Stato della tua prenotazione';

ALTER TABLE impostazioni_pubbliche
  ADD COLUMN IF NOT EXISTS home_waiting_message TEXT NOT NULL DEFAULT 'Sto controllando lo stato della tua prenotazione…';

ALTER TABLE impostazioni_pubbliche
  ADD COLUMN IF NOT EXISTS home_bookings_disabled_title TEXT NOT NULL DEFAULT 'Prenotazioni non disponibili';

ALTER TABLE impostazioni_pubbliche
  ADD COLUMN IF NOT EXISTS home_bookings_disabled_message TEXT NOT NULL DEFAULT 'Le prenotazioni sono al momento chiuse.';

ALTER TABLE impostazioni_pubbliche
  ADD COLUMN IF NOT EXISTS home_closed_title TEXT NOT NULL DEFAULT 'Prenotazioni chiuse';

ALTER TABLE impostazioni_pubbliche
  ADD COLUMN IF NOT EXISTS home_closed_message TEXT NOT NULL DEFAULT E'Al momento non è attiva nessuna serata karaoke.\nTorna più tardi!';

ALTER TABLE impostazioni_pubbliche
  ADD COLUMN IF NOT EXISTS home_maintenance_title TEXT NOT NULL DEFAULT '🚧 In manutenzione';

ALTER TABLE impostazioni_pubbliche
  ADD COLUMN IF NOT EXISTS home_maintenance_message TEXT NOT NULL DEFAULT E'Sito in manutenzione. Torneremo presto.\nIntanto segui la nostra pagina per scoprire le ultime novità e le prossime date del karaoke';