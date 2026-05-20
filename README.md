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

- `admin-login`: verifica server-side la password admin con PBKDF2-SHA256 (Web Crypto, compatibile Supabase Edge Runtime) e rilascia un token sessione breve.
- `admin-bookings`: esegue lato server le mutazioni admin (approva/elimina/completata, apertura/chiusura serata, toggle votazioni, cleanup strumenti nascosti) solo con `Authorization: Bearer <token>`.

### Secrets richiesti nella funzione

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_TOKEN_SIGNING_SECRET`
- `ALLOWED_ORIGINS` (es. `https://redirect11.github.io` oppure `*`)
- `ADMIN_SESSION_TTL_SECONDS` (opzionale, default 14400)

La password admin viene inserita in `admin.html`/`admin-tools.html` solo al login, inviata via HTTPS a `admin-login`, e non viene mai salvata nel client. Nel browser viene salvato solo il token sessione temporaneo in `sessionStorage`.

### Migrazione password admin: bcrypt -> PBKDF2-SHA256

`bcrypt@v0.4.1` è stato rimosso da `admin-login` perché in Supabase Edge Runtime può fallire con `ReferenceError: Worker is not defined`.
La verifica password ora usa solo Web Crypto (`crypto.subtle`) con `PBKDF2` + `SHA-256`.

1) Applica la migrazione DB:

```sql
-- File: supabase/migrations/20260520150000_admin_credentials_pbkdf2.sql
ALTER TABLE admin_credentials
  ADD COLUMN IF NOT EXISTS password_salt TEXT,
  ADD COLUMN IF NOT EXISTS password_iterations INTEGER,
  ADD COLUMN IF NOT EXISTS password_hash_algo TEXT;

UPDATE admin_credentials
SET
  password_iterations = COALESCE(password_iterations, 210000),
  password_hash_algo = COALESCE(NULLIF(TRIM(password_hash_algo), ''), 'pbkdf2-sha256');
```

2) Genera i nuovi valori hash/salt:

```bash
node scripts/generate-admin-password.mjs
```

Oppure con password/iterazioni via argomento:

```bash
node scripts/generate-admin-password.mjs --password="NuovaPasswordSicura" --iterations=210000
```

Output generato:
- `password_salt`
- `password_hash`
- `password_iterations`
- `password_hash_algo`

3) Aggiorna il record attivo in `admin_credentials` con i valori prodotti dallo script.

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
