# Requisiti Funzionali — Karaoke Tana Test

> **Fonte**: derivato dal codice (`index.html`, `scripts/follow-flow.js`, `.github/workflows/`),
> arricchito e validato nelle sessioni di review con il proprietario del progetto.
>
> **Processo**: aggiornare questo documento quando si aggiunge una funzionalità.
> Per ogni requisito nuovo, aggiungere anche un test case in `tests/` e,
> se necessario, una entry in `requirements/requirements.yaml` per la generazione
> automatica di issue GitHub.

---

## Indice

- [Follow Flow (REQ-FOLLOW)](#follow-flow)
- [Step Widget (REQ-STEP)](#step-widget)
- [CI/CD (REQ-CI)](#cicd)
- [Stati Prioritari (REQ-PRIORITY)](#stati-prioritari)
- [Stato pre-live / Coda (REQ-QUEUE)](#stato-pre-live--coda)
- [Reveal vincitore (REQ-REVEAL)](#reveal-vincitore)
- [Sincronizzazione realtime (REQ-SYNC)](#sincronizzazione-realtime)
- [Manutenzione (REQ-MAINT)](#manutenzione)
- [Ads / monetizzazione (REQ-ADS)](#ads--monetizzazione)
- [Visibilità voti e notifiche (REQ-VOTE, REQ-NOTIFY)](#visibilità-voti-e-notifiche)
- [Archivio serate (REQ-ARCHIVE)](#archivio-serate)
- [Test Case derivati dai requisiti](#test-case)

---

## Follow Flow

### REQ-FOLLOW-001 · Box Segui — sempre visibile se non seguito

| Campo     | Valore |
|-----------|--------|
| **ID**    | REQ-FOLLOW-001 |
| **Area**  | `index.html` init, `scripts/follow-flow.js` |
| **Stato** | ✅ implementato |

**Descrizione**  
Il box "Segui" deve essere mostrato **sempre** al caricamento della pagina se il cookie
`ig_followed` non è impostato a `"true"`. Nessun altro cookie (es. `ig_clicked`) deve
bypassare questo comportamento.

**Regola**  
```
followedAtPageLoad = getCookie("ig_followed") === "true"
SE followedAtPageLoad = false → mostra box Segui
SE followedAtPageLoad = true  → non mostrare box Segui
```

**Test case** → [TC-FOLLOW-001](#tc-follow-001), [TC-FOLLOW-002](#tc-follow-002)

---

### REQ-FOLLOW-002 · Widget step — primo accesso senza follow

| Campo     | Valore |
|-----------|--------|
| **ID**    | REQ-FOLLOW-002 |
| **Area**  | `index.html` init, `scripts/follow-flow.js` |
| **Stato** | ✅ implementato |

**Descrizione**  
Al primo accesso (o al ricaricamento senza follow), devono essere visibili:
- il widget degli step (`.steps`)
- il box Segui (`#step-follow`)
- lo step 1 attivo

**Test case** → [TC-FOLLOW-001](#tc-follow-001)

---

### REQ-FOLLOW-003 · Segui cliccato senza ricaricamento

| Campo     | Valore |
|-----------|--------|
| **ID**    | REQ-FOLLOW-003 |
| **Area**  | `index.html` → `goToForm()` |
| **Stato** | ✅ implementato |

**Descrizione**  
Quando l'utente clicca "Segui" e ritorna alla pagina **senza ricaricare**:
- il box Segui scompare
- il form di prenotazione appare
- il widget step resta visibile
- lo step 1 è completato (✓), lo step 2 è attivo

**Regola**  
`followedInSession = true` → `computeFollowFlowVisibility` restituisce
`{ showSteps:true, showFollowBox:false, showForm:true, activeStep:2 }`.

**Test case** → [TC-FOLLOW-003](#tc-follow-003)

---

### REQ-FOLLOW-004 · Ricaricamento con follow già completato

| Campo     | Valore |
|-----------|--------|
| **ID**    | REQ-FOLLOW-004 |
| **Area**  | `index.html` init |
| **Stato** | ✅ implementato |

**Descrizione**  
Se `ig_followed=true` è presente al caricamento:
- il box Segui **non** viene mostrato
- il widget step **non** viene mostrato
- si passa direttamente al form, salvo stati prioritari

**Test case** → [TC-FOLLOW-004](#tc-follow-004)

---

### REQ-FOLLOW-005 · Nessuna riapparizione dopo follow — realtime/polling

| Campo     | Valore |
|-----------|--------|
| **ID**    | REQ-FOLLOW-005 |
| **Area**  | `index.html` → `refreshSerataState`, `handleNewSerataOpened`, `handleReturn` |
| **Stato** | ✅ implementato |

**Descrizione**  
Dopo che il follow è stato completato (`ig_followed=true` al load oppure `followedInSession=true`),
gli eventi successivi (realtime, polling 8s, focus, visibilitychange, pageshow) **non devono**
far riapparire il box Segui né il widget step.

**Regola per `handleReturn`**  
`handleReturn` procede a `goToForm()` solo se `igOpened=true` (utente ha aperto Instagram
in questa sessione tramite il pulsante). Il cookie `ig_clicked` da solo **non** è sufficiente
a bypassare il box Segui al ricaricamento.

**Test case** → [TC-FOLLOW-005](#tc-follow-005), [TC-FOLLOW-006](#tc-follow-006)

---

## Step Widget

### REQ-STEP-001 · Widget step — elemento statico, decisione al load

| Campo     | Valore |
|-----------|--------|
| **ID**    | REQ-STEP-001 |
| **Area**  | `index.html` init, `scripts/follow-flow.js` |
| **Stato** | ✅ implementato |

**Descrizione**  
La visibilità del widget degli step (`.steps`) viene decisa **una sola volta al caricamento**,
in modo deterministico, tramite `computeFollowFlowVisibility`. Gli eventi successivi
(realtime, polling, focus) non modificano questa decisione se l'utente è già in un
flusso di prenotazione attivo.

**Regola**  
```
showSteps = followedAtPageLoad ? false
          : followedInSession  ? true  (step 2 attivo)
          :                      true  (step 1 attivo)
```

**Test case** → tutti i TC-FOLLOW-*

---

### REQ-STEP-002 · Nessun flicker al ricaricamento

| Campo     | Valore |
|-----------|--------|
| **ID**    | REQ-STEP-002 |
| **Area**  | `index.html` (HTML statico: `style="display:none"`) |
| **Stato** | ✅ implementato |

**Descrizione**  
Gli elementi `.steps`, `#step-follow`, `#step-form` partono con `style="display:none"`
nell'HTML. Solo il loader `#step-loading` è visibile inizialmente. Questo impedisce
qualsiasi flash/flicker durante il caricamento.

---

## CI/CD

### REQ-CI-001 · Deploy GitHub Pages solo se i test sono verdi

| Campo     | Valore |
|-----------|--------|
| **ID**    | REQ-CI-001 |
| **Area**  | `.github/workflows/deploy.yml` |
| **Stato** | ✅ implementato |

**Descrizione**  
Il deploy su GitHub Pages (e le operazioni di migrazione DB / deploy edge functions)
**non deve avvenire** se la suite di test fallisce. La pipeline è:

```
test → migrate → deploy-functions → deploy (Pages)
```

Ogni job dipende dal precedente tramite `needs`. Se `test` fallisce, tutta la catena
si blocca.

**Test case** → verificabile tramite CI GitHub Actions

---

### REQ-CI-002 · Pipeline coerente — migrate prima di deploy-functions

| Campo     | Valore |
|-----------|--------|
| **ID**    | REQ-CI-002 |
| **Area**  | `.github/workflows/deploy.yml` |
| **Stato** | ✅ implementato |

**Descrizione**  
Le migrazioni database devono essere eseguite prima del deploy delle edge functions,
che a loro volta devono completarsi prima del deploy Pages.

---

## Stati Prioritari

### REQ-PRIORITY-001 · Gli stati prioritari prevalgono sul follow flow

| Campo     | Valore |
|-----------|--------|
| **ID**    | REQ-PRIORITY-001 |
| **Area**  | `index.html`, `scripts/karaoke-state.js` |
| **Stato** | ✅ implementato |

**Descrizione**  
I seguenti stati hanno la precedenza assoluta sul flusso follow/form e devono essere
mostrati anche se `ig_followed=true`:

| Stato | Condizione | Elemento UI |
|-------|-----------|-------------|
| Pending booking | cookie prenotazione attivo | `#step-waiting` |
| Waiting | admin ha confermato la prenotazione | `#step-waiting` |
| Success | prenotazione inviata con successo | `#step-success` |
| Bookings disabled | `prenotazioni_abilitate=false` | `#step-bookings-disabled` |
| Reveal mode | `winner_reveal_countdown_active=true` | `#step-closed` |
| Closed state | nessuna serata aperta o vincitore decretato | `#step-closed` |

**Test case** → `tests/bdd/booking-pending-states.test.js`, `tests/bdd/karaoke-serata-states.test.js`

---

## Stato pre-live / Coda

### REQ-QUEUE-001 · Setting post-approvazione configurabile

| Campo     | Valore |
|-----------|--------|
| **ID**    | REQ-QUEUE-001 |
| **Area**  | `admin-tools.html`, `supabase/functions/admin-bookings/index.ts`, `impostazioni_pubbliche.modalita_post_approvazione` |
| **Stato** | ✅ implementato |

**Descrizione**  
Nelle impostazioni è presente il controllo "Cosa fare dopo approvazione" con due
scelte: "La canzone va direttamente live" oppure "In preparazione e poi live".
La UI mostra anche una descrizione chiara del comportamento di entrambe.

**Test case** → [TC-QUEUE-001](#tc-queue-001)

---

### REQ-QUEUE-002 · Stato transitorio "si sta preparando" prima del live

| Campo     | Valore |
|-----------|--------|
| **ID**    | REQ-QUEUE-002 |
| **Area**  | `admin.html`, `index.html`, `scripts/karaoke-state.js` |
| **Stato** | ✅ implementato |

**Descrizione**  
Quando il setting post-approvazione è "In preparazione e poi live", la canzone
corrente entra nello stato "si sta preparando" prima del live. In home e nella
lista pubblica lo stato è visibile; in admin la canzone corrente mostra il
pulsante "Inizia" e solo dopo il click passa al normale stato live/on air.

**Test case** → [TC-QUEUE-002](#tc-queue-002), [TC-QUEUE-003](#tc-queue-003)

---

## Reveal vincitore

### REQ-REVEAL-001 · Reveal classifica finale opzionale dopo countdown

| Campo     | Valore |
|-----------|--------|
| **ID**    | REQ-REVEAL-001 |
| **Area**  | `admin-tools.html`, `admin.html`, `vota.html`, `admin-bookings` |
| **Stato** | ✅ implementato |

**Descrizione**  
Esiste un'impostazione per attivare/disattivare il reveal progressivo della Top 5
dopo il countdown di proclamazione. Se disattivato, al termine del countdown viene
mostrata subito la classifica finale completa.

**Test case** → [TC-REVEAL-001](#tc-reveal-001)

---

### REQ-REVEAL-002 · Reveal manuale gestito da admin

| Campo     | Valore |
|-----------|--------|
| **ID**    | REQ-REVEAL-002 |
| **Area**  | `admin.html`, `vota.html`, `admin-bookings` |
| **Stato** | ✅ implementato |

**Descrizione**  
Con reveal attivo in modalità manuale, al termine del countdown viene mostrata
subito la posizione più bassa della Top 5 (o equivalente se meno elementi) e
l'admin svela le posizioni successive con un controllo dinamico fino al pulsante
finale "Svela vincitore".

**Test case** → [TC-REVEAL-002](#tc-reveal-002)

---

### REQ-REVEAL-003 · Reveal automatico con intervallo configurabile

| Campo     | Valore |
|-----------|--------|
| **ID**    | REQ-REVEAL-003 |
| **Area**  | `admin-tools.html`, `admin.html`, `vota.html`, `admin-bookings` |
| **Stato** | ✅ implementato |

**Descrizione**  
Con reveal attivo in modalità automatica, l'intervallo tra una posizione e la
successiva è configurabile nelle impostazioni
(`winner_reveal_auto_step_seconds`). Nel pannello admin compaiono solo annuncio
dinamico ("Svelando la posizione X") e timer di avanzamento che si resetta a
ogni step.

**Test case** → [TC-REVEAL-003](#tc-reveal-003)

---

### REQ-REVEAL-004 · Diretta proclamazione vincitore attivabile da admin

| Campo     | Valore |
|-----------|--------|
| **ID**    | REQ-REVEAL-004 |
| **Area**  | `admin.html`, `vota.html`, `admin-bookings` (`enable_diretta`, `disable_diretta`) |
| **Stato** | ✅ implementato |

**Descrizione**  
A votazioni chiuse l'admin può abilitare la "diretta": `vota.html` mostra la
schermata "Il vincitore sta per essere rivelato…" e le prenotazioni vengono
disabilitate (`winner_reveal_countdown_active=true`). L'admin può disabilitare la
diretta prima del countdown. In modalità proclamazione è disponibile anche la
proclamazione diretta, che pubblica subito il vincitore senza countdown pubblico.

**Test case** → [TC-REVEAL-004](#tc-reveal-004)

---

## Sincronizzazione realtime

### REQ-SYNC-001 · Sync stato karaoke realtime-first con poll di fallback

| Campo     | Valore |
|-----------|--------|
| **ID**    | REQ-SYNC-001 |
| **Area**  | `scripts/serata-sync.js`, `index.html`, `vota.html` |
| **Stato** | ✅ implementato |

**Descrizione**  
L'aggiornamento dello stato karaoke usa una strategia unica
(`createSerataSync`): iscrizione realtime agli eventi `postgres_changes` delle
tabelle osservate più un poll di fallback sempre attivo (`pollMs > 0`;
`pollMs = 0` abilita solo realtime). Sia gli eventi realtime sia il poll
richiamano lo stesso ciclo di sync, che ri-legge lo stato autorevole
(`fetchState`) e lo passa a `onChange`. Gli eventi realtime sono
debounced/coalizzati e il ciclo di vita del canale è gestito (`removeChannel`
prima di ri-iscriversi) per evitare canali stale.

**Test case** → [TC-SYNC-001](#tc-sync-001), [TC-SYNC-002](#tc-sync-002), [TC-SYNC-003](#tc-sync-003)

---

## Manutenzione

### REQ-MAINT-001 · Modalità manutenzione con redirect utenti e banner admin

| Campo     | Valore |
|-----------|--------|
| **ID**    | REQ-MAINT-001 |
| **Area**  | `scripts/maintenance-mode.js`, `admin-tools.html`, `admin-bookings`, `impostazioni_pubbliche.manutenzione_abilitata` |
| **Stato** | ✅ implementato |

**Descrizione**  
L'admin può attivare/disattivare la modalità manutenzione
(`manutenzione_abilitata`). Quando è attiva, gli utenti non admin vengono
reindirizzati alla home/pagina di manutenzione, mentre gli admin autenticati
continuano a navigare e vedono un banner di stato. Titolo e messaggio della
pagina di manutenzione sono configurabili (`home_maintenance_title`,
`home_maintenance_message`).

**Test case** → [TC-MAINT-001](#tc-maint-001)

---

## Ads / monetizzazione

### REQ-ADS-001 · Policy ads centralizzata con default sicuri

| Campo     | Valore |
|-----------|--------|
| **ID**    | REQ-ADS-001 |
| **Area**  | `scripts/ads-config.js` |
| **Stato** | ✅ implementato |

**Descrizione**  
La configurazione ads (`ADS_ENABLED`, `ADS_MODE` `off|soft|intrusive`,
`ADS_PROVIDER` `none|adsense|custom`, id AdSense, `ADS_REQUIRE_BEFORE_BOOKING`)
viene normalizzata in un oggetto policy stabile con default sicuri. Il banner è
abilitato solo se `enabled` e `mode != off`; `requireBeforeBooking` solo se il
banner è abilitato; `adsenseReady` solo se `provider=adsense` con client id e slot
entrambi presenti.

**Test case** → [TC-ADS-001](#tc-ads-001), [TC-ADS-002](#tc-ads-002)

---

### REQ-ADS-002 · Rendering banner/inline ads con fallback placeholder

| Campo     | Valore |
|-----------|--------|
| **ID**    | REQ-ADS-002 |
| **Area**  | `scripts/ads-banner.js`, `scripts/ads-loader.js`, `index.html` |
| **Stato** | ✅ implementato |

**Descrizione**  
Il rendering del banner sponsor isola il provider e non rompe mai la pagina: con
provider mancante o configurazione AdSense incompleta viene mostrato un
placeholder sicuro. La modalità intrusive applica la classe
`ads-intrusive-active` al body; il banner disabilitato pulisce il container e
rimuove la classe intrusive.

**Test case** → [TC-ADS-003](#tc-ads-003), [TC-ADS-004](#tc-ads-004)

---

### REQ-ADS-003 · Booking gate opzionale prima della prenotazione

| Campo     | Valore |
|-----------|--------|
| **ID**    | REQ-ADS-003 |
| **Area**  | `scripts/booking-gate.js`, `index.html` |
| **Stato** | ✅ implementato |

**Descrizione**  
Se `ADS_REQUIRE_BEFORE_BOOKING` è attivo e gli ads sono abilitati, il click su
"Prenota" mostra prima una modale sponsor con percorso esplicito "Continua". Se
gli ads sono off/disabilitati, la prenotazione procede senza step aggiuntivi.

**Test case** → [TC-ADS-005](#tc-ads-005)

---

## Visibilità voti e notifiche

### REQ-VOTE-001 · Visibilità pubblica dei totali voti configurabile

| Campo     | Valore |
|-----------|--------|
| **ID**    | REQ-VOTE-001 |
| **Area**  | `admin.html`, `admin-tools.html`, `vota.html`, `admin-bookings`, `impostazioni_pubbliche.mostra_voti_totali` |
| **Stato** | ✅ implementato |

**Descrizione**  
L'admin può attivare/disattivare la visibilità pubblica dei totali voti
(`mostra_voti_totali`). Quando attiva, `vota.html` mostra i totali a tutti gli
utenti; il campo viene comunque nascosto all'avvio del countdown di
proclamazione.

**Test case** → [TC-VOTE-001](#tc-vote-001)

---

### REQ-NOTIFY-001 · Toggle notifiche Telegram e browser per nuove prenotazioni

| Campo     | Valore |
|-----------|--------|
| **ID**    | REQ-NOTIFY-001 |
| **Area**  | `admin.html`, `admin-tools.html`, `admin-bookings`, `impostazioni_pubbliche` |
| **Stato** | ✅ implementato |

**Descrizione**  
L'admin può attivare/disattivare in modo indipendente le notifiche Telegram
(`notifiche_telegram_abilitate`) e le notifiche browser
(`notifiche_browser_abilitate`) per le nuove prenotazioni. Entrambe sono attive di
default all'apertura di una serata.

**Test case** → [TC-NOTIFY-001](#tc-notify-001)

---

## Archivio serate

### REQ-ARCHIVE-001 · Archivio pubblico delle serate concluse

| Campo     | Valore |
|-----------|--------|
| **ID**    | REQ-ARCHIVE-001 |
| **Area**  | `archive.html`, `admin-bookings` (`get_archive`), `impostazioni_pubbliche.archivio_pubblico_abilitato` |
| **Stato** | ✅ implementato |

**Descrizione**  
Le serate concluse sono consultabili in un archivio pubblico (`archive.html`)
quando l'archivio pubblico è abilitato. Il listing pubblico restituisce solo le
serate non nascoste.

**Test case** → [TC-ARCHIVE-001](#tc-archive-001)

---

### REQ-ARCHIVE-002 · Controlli admin su visibilità e copertina serate archiviate

| Campo     | Valore |
|-----------|--------|
| **ID**    | REQ-ARCHIVE-002 |
| **Area**  | `admin-tools.html`, `admin-bookings` (`set_archive_visibility`, `set_archive_cover`) |
| **Stato** | ✅ implementato |

**Descrizione**  
Per le serate concluse l'admin può nascondere/mostrare la serata nell'archivio
pubblico (`archiviato_nascosto`) e scegliere l'immagine di copertina: copertina di
default (`cover_use_default`), automatica (vincitore/random) oppure il selfie di
una prenotazione specifica (`cover_prenotazione_id`), con validazione che la
prenotazione appartenga alla serata.

**Test case** → [TC-ARCHIVE-002](#tc-archive-002)

---

## Test Case

### TC-FOLLOW-001

**ID**: TC-FOLLOW-001  
**Requisiti**: REQ-FOLLOW-001, REQ-FOLLOW-002  
**Descrizione**: Primo accesso / reload senza follow  
**Input**: `followedAtPageLoad=false`, `followedInSession=false`  
**Output atteso**: `{ showSteps:true, showFollowBox:true, showForm:false, activeStep:1 }`  
**File test**: `tests/bdd/follow-flow.test.js` → "First visit – user has never followed"  
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;`tests/bdd/init-follow-rules.test.js` → "First access – ig_followed NOT set"

---

### TC-FOLLOW-002

**ID**: TC-FOLLOW-002  
**Requisiti**: REQ-FOLLOW-001  
**Descrizione**: Reload con `ig_clicked` impostato ma `ig_followed` non impostato  
**Input**: `followedAtPageLoad=false`, `followedInSession=false` (ig_clicked è irrilevante)  
**Output atteso**: `{ showSteps:true, showFollowBox:true, showForm:false, activeStep:1 }`  
**File test**: `tests/bdd/init-follow-rules.test.js` → "Reload with ig_clicked set but ig_followed NOT set"

---

### TC-FOLLOW-003

**ID**: TC-FOLLOW-003  
**Requisiti**: REQ-FOLLOW-003  
**Descrizione**: Utente clicca Segui senza ricaricare  
**Input**: `followedAtPageLoad=false`, `followedInSession=true`  
**Output atteso**: `{ showSteps:true, showFollowBox:false, showForm:true, activeStep:2 }`  
**File test**: `tests/bdd/follow-flow.test.js` → "User clicks Follow without reloading"  
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;`tests/bdd/init-follow-rules.test.js` → "Follow clicked in session"

---

### TC-FOLLOW-004

**ID**: TC-FOLLOW-004  
**Requisiti**: REQ-FOLLOW-004  
**Descrizione**: Reload con `ig_followed=true` (cookie presente)  
**Input**: `followedAtPageLoad=true`, `followedInSession=false`  
**Output atteso**: `{ showSteps:false, showFollowBox:false, showForm:true, activeStep:0 }`  
**File test**: `tests/bdd/follow-flow.test.js` → "Page reload after following"  
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;`tests/bdd/init-follow-rules.test.js` → "Reload with ig_followed=true"

---

### TC-FOLLOW-005

**ID**: TC-FOLLOW-005  
**Requisiti**: REQ-FOLLOW-005  
**Descrizione**: Realtime/polling dopo follow — nessuna riapparizione del box Segui  
**Input**: `followedAtPageLoad=true`, `followedInSession=false` (realtime event)  
**Output atteso**: `computeFollowFlowVisibility` restituisce `showFollowBox:false, showSteps:false`  
**File test**: `tests/bdd/init-follow-rules.test.js` → "Realtime / polling guard"

---

### TC-FOLLOW-006

**ID**: TC-FOLLOW-006  
**Requisiti**: REQ-FOLLOW-005  
**Descrizione**: `handleReturn` su pageshow/focus senza `igOpened` — nessuna azione  
**Input**: `igOpened=false`, `followedAtPageLoad=false`, `followedInSession=false`  
**Output atteso**: `handleReturn` non chiama `goToForm` (ritorna immediatamente)  
**File test**: `tests/bdd/init-follow-rules.test.js` → "handleReturn guard rules"

---

### TC-QUEUE-001

**ID**: TC-QUEUE-001  
**Requisiti**: REQ-QUEUE-001  
**Descrizione**: Setting post-approvazione (`direct_live` vs `prepare_then_live`) interpretato correttamente  
**File test**: `tests/unit/karaoke-state-edge.test.js`, `tests/bdd/booking-pending-states.test.js`

---

### TC-QUEUE-002

**ID**: TC-QUEUE-002  
**Requisiti**: REQ-QUEUE-002  
**Descrizione**: Prenotazione `in_preparazione` produce lo stato "si sta preparando"  
**Output atteso**: lo stato corrente è `preparing` quando la prenotazione corrente è flaggata `in_preparazione`  
**File test**: `tests/unit/karaoke-state-edge.test.js` → "returns preparing when the current booking is flagged in_preparazione"

---

### TC-QUEUE-003

**ID**: TC-QUEUE-003  
**Requisiti**: REQ-QUEUE-002  
**Descrizione**: Transizione da "si sta preparando" a live/on air  
**File test**: `tests/bdd/booking-pending-states.test.js`

---

### TC-REVEAL-001

**ID**: TC-REVEAL-001  
**Requisiti**: REQ-REVEAL-001  
**Descrizione**: A countdown concluso, classifica finale mostrata (reveal progressivo on/off)  
**File test**: `tests/bdd/karaoke-serata-states.test.js`, `tests/bdd/vote-flow.test.js`

---

### TC-REVEAL-002

**ID**: TC-REVEAL-002  
**Requisiti**: REQ-REVEAL-002  
**Descrizione**: Reveal manuale — posizione più bassa mostrata, avanzamento controllato da admin  
**File test**: `tests/bdd/vote-flow.test.js`

---

### TC-REVEAL-003

**ID**: TC-REVEAL-003  
**Requisiti**: REQ-REVEAL-003  
**Descrizione**: Reveal automatico con intervallo configurabile  
**File test**: `tests/bdd/karaoke-serata-states.test.js` → "Reveal countdown is active"

---

### TC-REVEAL-004

**ID**: TC-REVEAL-004  
**Requisiti**: REQ-REVEAL-004  
**Descrizione**: Diretta attiva → stato `reveal-countdown`; `vincitore_decretato` ha precedenza  
**File test**: `tests/bdd/karaoke-serata-states.test.js` → "Reveal countdown is active, votes closed",  
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;"vincitore_decretato takes precedence over reveal countdown"

---

### TC-SYNC-001

**ID**: TC-SYNC-001  
**Requisiti**: REQ-SYNC-001  
**Descrizione**: Sync iniziale al `start()` e iscrizione a un canale per le tabelle osservate  
**File test**: `tests/unit/serata-sync.test.js` → "runs an initial sync on start",  
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;"subscribes to a channel for each configured table"

---

### TC-SYNC-002

**ID**: TC-SYNC-002  
**Requisiti**: REQ-SYNC-001  
**Descrizione**: Poll di fallback (`pollMs > 0`) e modalità realtime-only (`pollMs = 0`)  
**File test**: `tests/unit/serata-sync.test.js` → "runs sync on each poll interval when pollMs > 0",  
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;"does not poll when pollMs === 0 (realtime only)"

---

### TC-SYNC-003

**ID**: TC-SYNC-003  
**Requisiti**: REQ-SYNC-001  
**Descrizione**: Eventi realtime debounced/coalizzati, errori gestiti via `onError`, canale rimosso allo stop  
**File test**: `tests/unit/serata-sync.test.js` → "coalesces a burst of realtime events into a single sync",  
&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;"reports fetchState errors through onError without throwing", "removes the channel on stop"

---

### TC-MAINT-001

**ID**: TC-MAINT-001  
**Requisiti**: REQ-MAINT-001  
**Descrizione**: Manutenzione attiva → redirect non admin, admin autenticato resta e vede il banner  
**File test**: `tests/unit/maintenance-mode.test.js`

---

### TC-ADS-001

**ID**: TC-ADS-001  
**Requisiti**: REQ-ADS-001  
**Descrizione**: Normalizzazione `ADS_ENABLED`/`ADS_MODE`/`ADS_PROVIDER` con default sicuri  
**File test**: `tests/unit/ads-config.test.js` → "buildPolicy"

---

### TC-ADS-002

**ID**: TC-ADS-002  
**Requisiti**: REQ-ADS-001  
**Descrizione**: `bannerEnabled`, `requireBeforeBooking`, `adsenseReady` e store con override runtime  
**File test**: `tests/unit/ads-config.test.js` → "bannerEnabled", "requireBeforeBooking", "adsenseReady", "createPolicyStore"

---

### TC-ADS-003

**ID**: TC-ADS-003  
**Requisiti**: REQ-ADS-002  
**Descrizione**: Banner soft/intrusive con label sponsor e toggle classe `ads-intrusive-active`  
**File test**: `tests/unit/ads-banner.test.js` → "renderBanner"

---

### TC-ADS-004

**ID**: TC-ADS-004  
**Requisiti**: REQ-ADS-002  
**Descrizione**: Fallback placeholder con provider mancante o AdSense incompleto; slot AdSense quando pronto  
**File test**: `tests/unit/ads-banner.test.js` → "renderBanner – adsense provider", "renderInlineAd"

---

### TC-ADS-005

**ID**: TC-ADS-005  
**Requisiti**: REQ-ADS-003  
**Descrizione**: Booking gate aperto solo se `requireBeforeBooking=true`, altrimenti prenotazione diretta  
**File test**: `tests/unit/booking-gate.test.js`

---

### TC-VOTE-001

**ID**: TC-VOTE-001  
**Requisiti**: REQ-VOTE-001  
**Descrizione**: `mostra_voti_totali` controlla la visibilità pubblica dei totali; nascosti durante il countdown  
**File test**: `tests/bdd/vote-flow.test.js`, `tests/bdd/admin-serata-colors.test.js`

---

### TC-NOTIFY-001

**ID**: TC-NOTIFY-001  
**Requisiti**: REQ-NOTIFY-001  
**Descrizione**: Toggle indipendenti notifiche Telegram/browser; default attive all'apertura serata  
**Note**: comportamento server-side in `supabase/functions/admin-bookings/index.ts`
(`set_telegram_notifications`, `set_browser_notifications`); verifica manuale/integrazione.

---

### TC-ARCHIVE-001

**ID**: TC-ARCHIVE-001  
**Requisiti**: REQ-ARCHIVE-001  
**Descrizione**: Listing archivio pubblico restituisce solo le serate non nascoste  
**Note**: comportamento server-side in `supabase/functions/admin-bookings/index.ts` (`get_archive`);
verifica manuale/integrazione.

---

### TC-ARCHIVE-002

**ID**: TC-ARCHIVE-002  
**Requisiti**: REQ-ARCHIVE-002  
**Descrizione**: Toggle visibilità (`archiviato_nascosto`) e scelta copertina (`set_archive_cover`) con validazione  
**Note**: comportamento server-side in `supabase/functions/admin-bookings/index.ts`
(`set_archive_visibility`, `set_archive_cover`); verifica manuale/integrazione.

---

## Note di manutenzione

- Per aggiungere un requisito: aggiungere una sezione sopra + entry in `requirements/requirements.yaml`
- Per creare issue GitHub da questa lista: eseguire `node scripts/generate-issues.mjs`
  (oppure via workflow `.github/workflows/generate-issues.yml`)
- I test case devono rimanere allineati con i requisiti — ogni requisito deve avere
  almeno un test case referenziato
