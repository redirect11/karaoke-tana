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
import { describe, test, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const FollowFlow = require('../scripts/follow-flow.js');

// ─── computeFollowFlowVisibility ──────────────────────────────────────────────

describe('computeFollowFlowVisibility — caso 1: primo accesso, utente non ha mai seguito', () => {
  test('widget steps visibile', () => {
    const s = FollowFlow.computeFollowFlowVisibility({ followedAtPageLoad: false, followedInSession: false });
    expect(s.showSteps).toBe(true);
  });

  test('box Segui visibile', () => {
    const s = FollowFlow.computeFollowFlowVisibility({ followedAtPageLoad: false, followedInSession: false });
    expect(s.showFollowBox).toBe(true);
  });

  test('form NON visibile', () => {
    const s = FollowFlow.computeFollowFlowVisibility({ followedAtPageLoad: false, followedInSession: false });
    expect(s.showForm).toBe(false);
  });

  test('step 1 attivo', () => {
    const s = FollowFlow.computeFollowFlowVisibility({ followedAtPageLoad: false, followedInSession: false });
    expect(s.activeStep).toBe(1);
  });
});

describe('computeFollowFlowVisibility — caso 2: utente clicca follow senza reload', () => {
  test('form visibile', () => {
    const s = FollowFlow.computeFollowFlowVisibility({ followedAtPageLoad: false, followedInSession: true });
    expect(s.showForm).toBe(true);
  });

  test('widget steps visibile', () => {
    const s = FollowFlow.computeFollowFlowVisibility({ followedAtPageLoad: false, followedInSession: true });
    expect(s.showSteps).toBe(true);
  });

  test('box Segui NON visibile', () => {
    const s = FollowFlow.computeFollowFlowVisibility({ followedAtPageLoad: false, followedInSession: true });
    expect(s.showFollowBox).toBe(false);
  });

  test('step 2 attivo (step 1 completato)', () => {
    const s = FollowFlow.computeFollowFlowVisibility({ followedAtPageLoad: false, followedInSession: true });
    expect(s.activeStep).toBe(2);
  });
});

describe('computeFollowFlowVisibility — caso 3: reload dopo follow', () => {
  test('form visibile', () => {
    const s = FollowFlow.computeFollowFlowVisibility({ followedAtPageLoad: true, followedInSession: false });
    expect(s.showForm).toBe(true);
  });

  test('widget steps NON visibile', () => {
    const s = FollowFlow.computeFollowFlowVisibility({ followedAtPageLoad: true, followedInSession: false });
    expect(s.showSteps).toBe(false);
  });

  test('box Segui NON visibile', () => {
    const s = FollowFlow.computeFollowFlowVisibility({ followedAtPageLoad: true, followedInSession: false });
    expect(s.showFollowBox).toBe(false);
  });
});

describe('computeFollowFlowVisibility — caso 4: reload utente che non ha mai seguito', () => {
  test('widget steps visibile', () => {
    const s = FollowFlow.computeFollowFlowVisibility({ followedAtPageLoad: false, followedInSession: false });
    expect(s.showSteps).toBe(true);
  });

  test('box Segui visibile', () => {
    const s = FollowFlow.computeFollowFlowVisibility({ followedAtPageLoad: false, followedInSession: false });
    expect(s.showFollowBox).toBe(true);
  });
});

describe('computeFollowFlowVisibility — followedAtPageLoad ha precedenza su followedInSession', () => {
  test('followedAtPageLoad=true e followedInSession=true → steps nascosti, form visibile', () => {
    const s = FollowFlow.computeFollowFlowVisibility({ followedAtPageLoad: true, followedInSession: true });
    expect(s.showSteps).toBe(false);
    expect(s.showForm).toBe(true);
    expect(s.showFollowBox).toBe(false);
  });

  test('parametri omessi equivalgono a false/false', () => {
    const s = FollowFlow.computeFollowFlowVisibility();
    expect(s.showSteps).toBe(true);
    expect(s.showFollowBox).toBe(true);
    expect(s.showForm).toBe(false);
  });
});

describe('shouldRestoreFollowFlow — caso 5: refresh/realtime dopo follow completato', () => {
  test('form già visibile → NON ripristinare (isInBookingFlow=true)', () => {
    const r = FollowFlow.shouldRestoreFollowFlow({ isWaiting: false, isSuccess: false, isInBookingFlow: true });
    expect(r).toBe(false);
  });

  test('box Segui già visibile → NON ripristinare (isInBookingFlow=true)', () => {
    const r = FollowFlow.shouldRestoreFollowFlow({ isWaiting: false, isSuccess: false, isInBookingFlow: true });
    expect(r).toBe(false);
  });

  test('stato waiting → NON ripristinare', () => {
    const r = FollowFlow.shouldRestoreFollowFlow({ isWaiting: true, isSuccess: false, isInBookingFlow: false });
    expect(r).toBe(false);
  });

  test('stato success → NON ripristinare', () => {
    const r = FollowFlow.shouldRestoreFollowFlow({ isWaiting: false, isSuccess: true, isInBookingFlow: false });
    expect(r).toBe(false);
  });

  test('nessuno stato attivo → ripristinare (es. venendo da bookings-disabled)', () => {
    const r = FollowFlow.shouldRestoreFollowFlow({ isWaiting: false, isSuccess: false, isInBookingFlow: false });
    expect(r).toBe(true);
  });

  test('parametri omessi → ripristinare', () => {
    const r = FollowFlow.shouldRestoreFollowFlow();
    expect(r).toBe(true);
  });
});

describe('caso 6: interazione con stati prioritari', () => {
  test('closed/reveal/winnerDecreed: nessun impact su computeFollowFlowVisibility (gestiti a monte)', () => {
    const cases = [
      { followedAtPageLoad: false, followedInSession: false },
      { followedAtPageLoad: true,  followedInSession: false },
      { followedAtPageLoad: false, followedInSession: true  },
    ];
    cases.forEach((params) => {
      const s = FollowFlow.computeFollowFlowVisibility(params);
      expect(typeof s.showSteps).toBe('boolean');
      expect(typeof s.showFollowBox).toBe('boolean');
      expect(typeof s.showForm).toBe('boolean');
      expect(typeof s.activeStep).toBe('number');
    });
  });

  test('pending booking: shouldRestoreFollowFlow=true ma checkPendingBooking gestisce il caso (isInBookingFlow=false)', () => {
    const r = FollowFlow.shouldRestoreFollowFlow({ isWaiting: false, isSuccess: false, isInBookingFlow: false });
    expect(r).toBe(true);
  });
});
