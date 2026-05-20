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
- `supabase/functions/admin-login/index.ts`

Scopo:

- `admin-login`: verifica server-side la password admin confrontandola con `admin_credentials.password_hash` (bcrypt) e rilascia un token sessione breve.
- `admin-bookings`: esegue lato server le mutazioni admin (approva/elimina/completata, apertura/chiusura serata, toggle votazioni, cleanup strumenti nascosti) solo con `Authorization: Bearer <token>`.

### Secrets richiesti nella funzione

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_TOKEN_SIGNING_SECRET`
- `ALLOWED_ORIGINS` (es. `https://redirect11.github.io` oppure `*`)
- `ADMIN_SESSION_TTL_SECONDS` (opzionale, default 14400)

La password admin viene inserita in `admin.html`/`admin-tools.html` solo al login, inviata via HTTPS a `admin-login`, e non viene mai salvata nel client. Nel browser viene salvato solo il token sessione temporaneo in `sessionStorage`.

## Supabase branch deploy (Git integration)

Per l'auto-deploy delle Edge Functions nei branch preview, questa repo dichiara le funzioni in:

- `supabase/config.toml`

con almeno:

- `[functions.submit-booking]`
- `[functions.admin-bookings]`
- `[functions.admin-login]`

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
