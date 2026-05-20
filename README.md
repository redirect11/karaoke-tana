# karaoke-tana

App web statica per prenotazioni karaoke e votazioni, con database Supabase.

## Setup base

1. Crea `config.js` partendo da `config.example.js`.
2. Inserisci almeno:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
3. Esegui SQL iniziale da `/home/runner/work/karaoke-tana/karaoke-tana/supabase/init.sql`.

## Edge Function: submit-booking

Questa repo include la funzione:

- `/home/runner/work/karaoke-tana/karaoke-tana/supabase/functions/submit-booking/index.ts`

Scopo: creare una prenotazione lato server (no insert diretto dal browser), con:

- validazione payload JSON
- formato errori standardizzato (`{ success, data, error }`)
- CORS configurabile
- auth opzionale (`REQUIRE_AUTH=true/false`)
- uso segreti server-side (`SUPABASE_SERVICE_ROLE_KEY`)

### Secrets richiesti nella funzione

Configura su Supabase Edge Functions:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ALLOWED_ORIGINS` (es. `https://redirect11.github.io` oppure `*`)
- `REQUIRE_AUTH` (`false` per flusso anonimo attuale)

### Deploy funzione

Esempio con Supabase CLI:

```bash
supabase functions deploy submit-booking --project-ref <PROJECT_REF>
```

### Test endpoint pubblico

Endpoint:

`https://<PROJECT_REF>.supabase.co/functions/v1/submit-booking`

Esempio test:

```bash
curl -i \
  -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/submit-booking" \
  -H "Content-Type: application/json" \
  -H "apikey: <SUPABASE_ANON_KEY>" \
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
  -d '{"nome":"Mario","canzone":"Volare","artista":"Modugno"}'
```

## Integrazione frontend

Il form in `/home/runner/work/karaoke-tana/karaoke-tana/index.html` ora chiama la Edge Function:

- URL custom: `CONFIG.SUBMIT_BOOKING_FUNCTION_URL` (opzionale)
- fallback automatico: `${SUPABASE_URL}/functions/v1/submit-booking`

La UI gestisce loading/error sul bottone di submit.

## Deploy GitHub Pages

La pipeline (`/home/runner/work/karaoke-tana/karaoke-tana/.github/workflows/deploy.yml`) genera `config.js` dai secrets:

- `IG_USERNAME`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUBMIT_BOOKING_FUNCTION_URL` (opzionale)
- `BOOKING_COOLDOWN_MIN`

## Nota piano Free Supabase

Le Edge Functions sono incluse nel piano Free, ma con limiti (invocazioni/risorse/timeout) soggetti a modifica.
Verifica sempre i limiti correnti dalla dashboard Pricing/Usage di Supabase e configura alert di consumo.
