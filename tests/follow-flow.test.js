/*
 * tests/follow-flow.test.js
 *
 * Test per la logica centralizzata del widget degli step (follow flow).
 * Esegui con: npm test
 *
 * Copertura:
 * 1. Primo accesso, utente non ha mai seguito
 * 2. Utente clicca follow senza reload
 * 3. Reload dopo follow
 * 4. Reload utente che non ha mai seguito
 * 5. Refresh/realtime/focus/pageshow dopo follow completato
 * 6. Stati prioritari: pending booking, closed state, reveal mode, bookings disabled
 */
'use strict';

const assert = require('assert');
const FollowFlow = require('../scripts/follow-flow.js');

let passed = 0;
let failed = 0;
let currentSuite = '';

function suite(name) {
  currentSuite = name;
  console.log('\n' + name);
}

function test(name, fn) {
  try {
    fn();
    console.log('  ✓', name);
    passed++;
  } catch (err) {
    console.error('  ✗', name);
    console.error('   ', err.message);
    failed++;
  }
}

// ─── computeFollowFlowVisibility ──────────────────────────────────────────────

suite('computeFollowFlowVisibility — caso 1: primo accesso, utente non ha mai seguito');

test('widget steps visibile', () => {
  const s = FollowFlow.computeFollowFlowVisibility({ followedAtPageLoad: false, followedInSession: false });
  assert.strictEqual(s.showSteps, true, 'showSteps deve essere true');
});

test('box Segui visibile', () => {
  const s = FollowFlow.computeFollowFlowVisibility({ followedAtPageLoad: false, followedInSession: false });
  assert.strictEqual(s.showFollowBox, true, 'showFollowBox deve essere true');
});

test('form NON visibile', () => {
  const s = FollowFlow.computeFollowFlowVisibility({ followedAtPageLoad: false, followedInSession: false });
  assert.strictEqual(s.showForm, false, 'showForm deve essere false');
});

test('step 1 attivo', () => {
  const s = FollowFlow.computeFollowFlowVisibility({ followedAtPageLoad: false, followedInSession: false });
  assert.strictEqual(s.activeStep, 1, 'activeStep deve essere 1');
});

// ─────────────────────────────────────────────────────────────────────────────

suite('computeFollowFlowVisibility — caso 2: utente clicca follow senza reload');

test('form visibile', () => {
  const s = FollowFlow.computeFollowFlowVisibility({ followedAtPageLoad: false, followedInSession: true });
  assert.strictEqual(s.showForm, true, 'showForm deve essere true');
});

test('widget steps visibile', () => {
  const s = FollowFlow.computeFollowFlowVisibility({ followedAtPageLoad: false, followedInSession: true });
  assert.strictEqual(s.showSteps, true, 'showSteps deve essere true');
});

test('box Segui NON visibile', () => {
  const s = FollowFlow.computeFollowFlowVisibility({ followedAtPageLoad: false, followedInSession: true });
  assert.strictEqual(s.showFollowBox, false, 'showFollowBox deve essere false');
});

test('step 2 attivo (step 1 completato)', () => {
  const s = FollowFlow.computeFollowFlowVisibility({ followedAtPageLoad: false, followedInSession: true });
  assert.strictEqual(s.activeStep, 2, 'activeStep deve essere 2');
});

// ─────────────────────────────────────────────────────────────────────────────

suite('computeFollowFlowVisibility — caso 3: reload dopo follow');

test('form visibile', () => {
  const s = FollowFlow.computeFollowFlowVisibility({ followedAtPageLoad: true, followedInSession: false });
  assert.strictEqual(s.showForm, true, 'showForm deve essere true');
});

test('widget steps NON visibile', () => {
  const s = FollowFlow.computeFollowFlowVisibility({ followedAtPageLoad: true, followedInSession: false });
  assert.strictEqual(s.showSteps, false, 'showSteps deve essere false');
});

test('box Segui NON visibile', () => {
  const s = FollowFlow.computeFollowFlowVisibility({ followedAtPageLoad: true, followedInSession: false });
  assert.strictEqual(s.showFollowBox, false, 'showFollowBox deve essere false');
});

// ─────────────────────────────────────────────────────────────────────────────

suite('computeFollowFlowVisibility — caso 4: reload utente che non ha mai seguito');

test('widget steps visibile', () => {
  const s = FollowFlow.computeFollowFlowVisibility({ followedAtPageLoad: false, followedInSession: false });
  assert.strictEqual(s.showSteps, true, 'showSteps deve essere true');
});

test('box Segui visibile', () => {
  const s = FollowFlow.computeFollowFlowVisibility({ followedAtPageLoad: false, followedInSession: false });
  assert.strictEqual(s.showFollowBox, true, 'showFollowBox deve essere true');
});

// ─────────────────────────────────────────────────────────────────────────────

suite('computeFollowFlowVisibility — followedAtPageLoad ha precedenza su followedInSession');

test('followedAtPageLoad=true e followedInSession=true → steps nascosti, form visibile', () => {
  const s = FollowFlow.computeFollowFlowVisibility({ followedAtPageLoad: true, followedInSession: true });
  assert.strictEqual(s.showSteps, false, 'showSteps deve essere false quando followedAtPageLoad=true');
  assert.strictEqual(s.showForm, true, 'showForm deve essere true quando followedAtPageLoad=true');
  assert.strictEqual(s.showFollowBox, false, 'showFollowBox deve essere false quando followedAtPageLoad=true');
});

test('parametri omessi equivalgono a false/false', () => {
  const s = FollowFlow.computeFollowFlowVisibility();
  assert.strictEqual(s.showSteps, true);
  assert.strictEqual(s.showFollowBox, true);
  assert.strictEqual(s.showForm, false);
});

// ─────────────────────────────────────────────────────────────────────────────

suite('shouldRestoreFollowFlow — caso 5: refresh/realtime dopo follow completato');

test('form già visibile → NON ripristinare (isInBookingFlow=true)', () => {
  const r = FollowFlow.shouldRestoreFollowFlow({ isWaiting: false, isSuccess: false, isInBookingFlow: true });
  assert.strictEqual(r, false, 'Non deve ripristinare quando il form è già visibile');
});

test('box Segui già visibile → NON ripristinare (isInBookingFlow=true)', () => {
  const r = FollowFlow.shouldRestoreFollowFlow({ isWaiting: false, isSuccess: false, isInBookingFlow: true });
  assert.strictEqual(r, false, 'Non deve ripristinare quando il box Segui è già visibile');
});

test('stato waiting → NON ripristinare', () => {
  const r = FollowFlow.shouldRestoreFollowFlow({ isWaiting: true, isSuccess: false, isInBookingFlow: false });
  assert.strictEqual(r, false, 'Non deve ripristinare quando è in attesa');
});

test('stato success → NON ripristinare', () => {
  const r = FollowFlow.shouldRestoreFollowFlow({ isWaiting: false, isSuccess: true, isInBookingFlow: false });
  assert.strictEqual(r, false, 'Non deve ripristinare quando ha avuto successo');
});

test('nessuno stato attivo → ripristinare (es. venendo da bookings-disabled)', () => {
  const r = FollowFlow.shouldRestoreFollowFlow({ isWaiting: false, isSuccess: false, isInBookingFlow: false });
  assert.strictEqual(r, true, 'Deve ripristinare quando non c\'è stato attivo');
});

test('parametri omessi → ripristinare', () => {
  const r = FollowFlow.shouldRestoreFollowFlow();
  assert.strictEqual(r, true, 'Deve ripristinare quando nessun parametro è true');
});

// ─────────────────────────────────────────────────────────────────────────────

suite('caso 6: interazione con stati prioritari');

test('closed/reveal/winnerDecreed: nessun impact su computeFollowFlowVisibility (gestiti a monte)', () => {
  // computeFollowFlowVisibility viene chiamata solo dopo aver verificato che la serata è aperta
  // e le prenotazioni sono abilitate. Questi stati prioritari non toccano questa funzione.
  // Qui verifichiamo che la funzione restituisca risultati coerenti in ogni caso.
  const cases = [
    { followedAtPageLoad: false, followedInSession: false },
    { followedAtPageLoad: true,  followedInSession: false },
    { followedAtPageLoad: false, followedInSession: true  },
  ];
  cases.forEach(function (params) {
    const s = FollowFlow.computeFollowFlowVisibility(params);
    // La funzione deve sempre restituire un oggetto con le proprietà attese
    assert.ok(typeof s.showSteps === 'boolean', 'showSteps deve essere boolean');
    assert.ok(typeof s.showFollowBox === 'boolean', 'showFollowBox deve essere boolean');
    assert.ok(typeof s.showForm === 'boolean', 'showForm deve essere boolean');
    assert.ok(typeof s.activeStep === 'number', 'activeStep deve essere number');
  });
});

test('pending booking: shouldRestoreFollowFlow=true ma checkPendingBooking gestisce il caso (isInBookingFlow=false)', () => {
  // Il pending booking viene gestito da checkPendingBooking() in index.html
  // che skippa la chiamata a showForm/stepFollow quando rileva la prenotazione pendente.
  // shouldRestoreFollowFlow con isInBookingFlow=false restituisce true, poi spetta
  // a checkPendingBooking decidere se mostrare il form o no.
  const r = FollowFlow.shouldRestoreFollowFlow({ isWaiting: false, isSuccess: false, isInBookingFlow: false });
  assert.strictEqual(r, true, 'shouldRestoreFollowFlow=true: spetta a checkPendingBooking gestire il pending');
});

// ─────────────────────────────────────────────────────────────────────────────

const icon = failed === 0 ? '✓' : '✗';
console.log('\n' + icon + ` ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
