# karaoke-tana

App web statica per prenotazioni karaoke e votazioni, con database Supabase.

## Setup base

1. Crea `config.js` partendo da `config.example.js`.
2. Inserisci almeno:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
3. Esegui SQL iniziale da `supabase/init.sql`.

## Edge Function: submit-booking

Questa repo include la funzione:

- `supabase/functions/submit-booking/index.ts`

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

## Edge Function: admin-bookings

Questa repo include anche:

- `supabase/functions/admin-bookings/index.ts`

Scopo: eseguire lato server le mutazioni admin (approva/elimina/completata, apertura/chiusura serata, toggle votazioni, cleanup strumenti nascosti).

### Secrets richiesti nella funzione

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_SHARED_SECRET`
- `ALLOWED_ORIGINS` (es. `https://redirect11.github.io` oppure `*`)

La pagina `admin.html` non contiene password hardcoded: richiede l'`ADMIN_SHARED_SECRET` a runtime e lo invia alla funzione via header `x-admin-secret`.

## Supabase branch deploy (Git integration)

Per l'auto-deploy delle Edge Functions nei branch preview, questa repo dichiara le funzioni in:

- `supabase/config.toml`

con almeno:

- `[functions.submit-booking]`
- `[functions.admin-bookings]`

> Nota: aggiorna `project_id` in `supabase/config.toml` con il tuo project ref Supabase.

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

Il form in `index.html` ora chiama la Edge Function:

- URL custom: `CONFIG.SUBMIT_BOOKING_FUNCTION_URL` (opzionale)
- fallback automatico: `${SUPABASE_URL}/functions/v1/submit-booking`

La UI gestisce loading/error sul bottone di submit.

## Deploy GitHub Pages

La pipeline (`.github/workflows/deploy.yml`) genera `config.js` dai secrets:

- `IG_USERNAME`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUBMIT_BOOKING_FUNCTION_URL` (opzionale)
- `BOOKING_COOLDOWN_MIN`

## Nota piano Free Supabase

Le Edge Functions sono incluse nel piano Free, ma con limiti (invocazioni/risorse/timeout) soggetti a modifica.
Verifica sempre i limiti correnti dalla dashboard Pricing/Usage di Supabase e configura alert di consumo.
