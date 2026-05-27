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

## Note di manutenzione

- Per aggiungere un requisito: aggiungere una sezione sopra + entry in `requirements/requirements.yaml`
- Per creare issue GitHub da questa lista: eseguire `node scripts/generate-issues.mjs`
  (oppure via workflow `.github/workflows/generate-issues.yml`)
- I test case devono rimanere allineati con i requisiti — ogni requisito deve avere
  almeno un test case referenziato
