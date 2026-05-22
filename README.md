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
- `supabase/functions/booking-status/index.ts`

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
- `BOOKING_PENDING_EXPIRY_MIN` (default `30`, max `60`)

## Edge Function: admin-bookings

Questa repo include anche:

- `supabase/functions/admin-bookings/index.ts`
- `supabase/functions/admin-login/index.ts` *(deprecato – non più utilizzato)*

Scopo:

- `admin-bookings`: esegue lato server le mutazioni admin (approva/modifica/elimina/completata, apertura/chiusura serata, toggle votazioni, visibilità pubblica totali voti, toggle notifiche Telegram/browser, decreto vincitore, cleanup strumenti nascosti) solo con `Authorization: Bearer <supabase_access_token>`.
- `admin-login`: **deprecato**. La funzione custom esiste ancora nel repo ma non è più utilizzata dal frontend. Il login avviene ora tramite Supabase Auth SDK.

### Autenticazione admin: Supabase Auth

L'accesso admin usa ora **Supabase Auth** (email + password) invece del vecchio sistema password/hash custom.

#### Setup iniziale (una tantum)

1. **Crea l'utente admin su Supabase**

   Vai su: *Supabase Dashboard → Authentication → Users → Invite user* (oppure *Add user*).
   Imposta email e password. Copia l'UUID dell'utente appena creato.

2. **Crea la tabella `admin_users`** (se non l'hai già eseguita)

   Incolla il file di migrazione in SQL Editor:
   ```bash
   # File: supabase/migrations/20260520160000_admin_users.sql
   ```
   oppure esegui direttamente:
   ```sql
   CREATE TABLE IF NOT EXISTS admin_users (
     user_id    UUID         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
     created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
   );
   ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
   ```

3. **Aggiungi l'utente admin all'allowlist**

   ```sql
   INSERT INTO admin_users (user_id)
   VALUES ('<UUID-UTENTE-ADMIN>');
   ```

4. **Verifica il login**

   Apri `admin.html`, inserisci email e password dell'utente Supabase appena creato.

### Secrets richiesti nell'Edge Function `admin-bookings`

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ALLOWED_ORIGINS` (es. `https://redirect11.github.io` oppure `*`)

### Come funziona il flusso

1. Il browser chiama `supabase.auth.signInWithPassword({ email, password })` via SDK.
2. Supabase Auth restituisce un `access_token` (JWT).
3. Il `access_token` viene salvato in `sessionStorage` e inviato come `Authorization: Bearer` a ogni chiamata a `admin-bookings`.
4. `admin-bookings` verifica il JWT via `supabase.auth.getUser(token)` e controlla che l'`user_id` sia presente in `admin_users`.
5. Solo allora esegue l'azione richiesta.

## Supabase branch deploy (Git integration)

Per l'auto-deploy delle Edge Functions nei branch preview, questa repo dichiara le funzioni in:

- `supabase/config.toml`

con almeno:

- `[functions.submit-booking]`
- `[functions.booking-status]`
- `[functions.admin-bookings]`
- `[functions.admin-login]`

> Nota: aggiorna `project_id` in `supabase/config.toml` con il tuo project ref Supabase.

### Deploy funzione

Esempio con Supabase CLI:

```bash
supabase functions deploy submit-booking --project-ref <PROJECT_REF>
```

### Deploy automatico su `develop`

La repo include anche il workflow GitHub Actions `.github/workflows/deploy-supabase-functions-develop.yml`, che su push a `develop` deploya automaticamente tutte le funzioni trovate in `supabase/functions/` (esclusa `_shared`) verso il progetto test `jiqjklcnplxolyqeklxr`.

Il workflow usa il secret GitHub `SUPABASE_ACCESS_TOKEN`, che deve contenere un personal access token Supabase.

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

### Deploy produzione (`main`)

La pipeline (`.github/workflows/deploy.yml`) genera `config.js` dai secrets:

- `IG_USERNAME`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUBMIT_BOOKING_FUNCTION_URL` (opzionale)
- `BOOKING_STATUS_FUNCTION_URL` (opzionale)
- `BOOKING_PENDING_EXPIRY_MIN`
- `BOOKING_COOLDOWN_MIN`
- `ADS_ENABLED` (`true|false`)
- `ADS_MODE` (`off|soft|intrusive`)
- `ADS_PROVIDER` (`none|adsense|custom`)
- `ADSENSE_CLIENT_ID` (es. `ca-pub-xxxxxxxxxxxxxxxx`)
- `ADSENSE_BANNER_SLOT` (slot id banner)
- `ADS_REQUIRE_BEFORE_BOOKING` (`true|false`)

Sito produzione: `https://redirect11.github.io/karaoke-tana/`

### Deploy test (`develop`)

La pipeline (`.github/workflows/deploy-develop-test.yml`) parte su push a `develop` e pubblica:

- root `/karaoke-tana/` = snapshot `main` (produzione)
- path `/karaoke-tana/test/` = snapshot `develop` (test)

URL test: `https://redirect11.github.io/karaoke-tana/test/`

Secrets consigliati per ambiente test (workflow `develop`):

- `TEST_IG_USERNAME`
- `TEST_SUPABASE_URL`
- `TEST_SUPABASE_ANON_KEY`
- `TEST_SUBMIT_BOOKING_FUNCTION_URL` (opzionale)
- `TEST_BOOKING_STATUS_FUNCTION_URL` (opzionale)
- `TEST_BOOKING_PENDING_EXPIRY_MIN`
- `TEST_BOOKING_COOLDOWN_MIN`
- `TEST_ADS_ENABLED`
- `TEST_ADS_MODE`
- `TEST_ADS_PROVIDER`
- `TEST_ADSENSE_CLIENT_ID`
- `TEST_ADSENSE_BANNER_SLOT`
- `TEST_ADS_REQUIRE_BEFORE_BOOKING`

## Ads / monetizzazione (frontend)

La web app include un'infrastruttura ads configurabile e disaccoppiata dal flusso business:

- `scripts/ads-config.js`: policy/config ads centralizzata (safe default se valori mancanti)
- `scripts/ads-banner.js`: rendering banner con provider isolato
- `scripts/booking-gate.js`: step intermedio opzionale prima della conferma prenotazione

### Valori config supportati

Nel `config.js` (o nei secrets della workflow deploy):

- `ADS_ENABLED=true|false`
- `ADS_MODE=off|soft|intrusive`
- `ADS_PROVIDER=none|adsense|custom`
- `ADSENSE_CLIENT_ID=ca-pub-...`
- `ADSENSE_BANNER_SLOT=<slot-id>`
- `ADS_REQUIRE_BEFORE_BOOKING=true|false`

### Come abilitare/disabilitare

- **Disabilitare tutto**: `ADS_ENABLED=false` oppure `ADS_MODE=off`
- **Banner soft**: `ADS_ENABLED=true` + `ADS_MODE=soft`
- **Banner intrusive/sticky**: `ADS_ENABLED=true` + `ADS_MODE=intrusive`

### AdSense

Per usare AdSense:

1. `ADS_PROVIDER=adsense`
2. imposta `ADSENSE_CLIENT_ID` e `ADSENSE_BANNER_SLOT`

Se la config AdSense manca/incompleta, la pagina non si rompe: viene mostrato un placeholder safe.

### Booking gate

Se `ADS_REQUIRE_BEFORE_BOOKING=true` e gli ads sono attivi, il click su "Prenota" mostra prima una modale sponsor/intermedia con percorso esplicito "Continua".  
Se ads sono off/disabilitati, la prenotazione procede normalmente senza step aggiuntivi.

## Nota piano Free Supabase

Le Edge Functions sono incluse nel piano Free, ma con limiti (invocazioni/risorse/timeout) soggetti a modifica.
Verifica sempre i limiti correnti dalla dashboard Pricing/Usage di Supabase e configura alert di consumo.
