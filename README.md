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

Scopo:

- `admin-bookings`: esegue lato server le mutazioni admin (approva/modifica/elimina/completata, apertura/chiusura serata, toggle votazioni, visibilità pubblica totali voti, toggle notifiche Telegram/browser, decreto vincitore, cleanup strumenti nascosti) solo con `Authorization: Bearer <supabase_access_token>`.

### Autenticazione admin: Supabase Auth

L'accesso admin usa ora **Supabase Auth** (email + password) invece del vecchio sistema password/hash custom.

La vecchia migrazione `supabase/migrations/20260520150000_admin_credentials_pbkdf2.sql` è mantenuta solo per compatibilità con la history remota di Supabase (schema_migrations): il flusso admin attuale usa solo `auth.users` + `admin_users`.

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

con:

- `[functions.submit-booking]`
- `[functions.booking-status]`
- `[functions.admin-bookings]`

`admin-login` non è più dichiarata né deployata: il login admin usa direttamente Supabase Auth dal frontend, mentre le azioni server-side restano su `admin-bookings`.

> Nota: aggiorna `project_id` in `supabase/config.toml` con il tuo project ref Supabase.

### Deploy funzione

Esempio con Supabase CLI:

```bash
supabase functions deploy submit-booking --project-ref <PROJECT_REF>
```

### Deploy automatico

In questa repo il deploy automatico parte solo da `main`.

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

### Reveal pubblico vincitore

- La schermata diretta/countdown per il reveal vincitore è integrata in `vota.html`.
- Con votazioni chiuse l'admin può premere **"Abilita diretta"** dallo staff panel (`admin.html`):
  - la pagina `vota.html` mostra la schermata "Il vincitore sta per essere rivelato…";
  - aprendo **"Apri pagina voti/countdown ↗"** l'admin può gestire la diretta anche dalla pagina pubblica;
  - premendo **"Avvia countdown"** (da staff panel o da `vota.html` aperta in modalità admin) compare per 1 secondo il numero iniziale e poi parte il countdown configurato nelle impostazioni pubbliche (default 5 s);
  - al termine del countdown il vincitore viene decretato automaticamente.
- In modalità proclamazione è disponibile anche **"Proclamazione diretta"**, che pubblica subito il vincitore senza far comparire alcun countdown sulla pagina pubblica.
- Se si vuole annullare la diretta prima del countdown, premere **"Disabilita diretta"**.

## Deploy GitHub Pages

### Deploy sito test (`main`)

La pipeline (`.github/workflows/deploy.yml`) genera `config.js` dai secrets e pubblica il contenuto di questa repo sull'ambiente di test.

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

URL test: `https://test.ilkaraokedellatana.it/`

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
