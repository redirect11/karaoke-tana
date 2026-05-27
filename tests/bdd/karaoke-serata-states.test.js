/**
 * tests/bdd/karaoke-serata-states.test.js
 *
 * BDD specification for all karaoke serata state combinations.
 *
 * Requirement matrix being tested:
 *
 *  | Scenario                             | uiState           | bookingsEnabled | votingOpen |
 *  |--------------------------------------|-------------------|-----------------|------------|
 *  | No serata data                       | closed            | false           | false      |
 *  | Winner decreed                       | winner-decreed    | false           | false      |
 *  | Reveal countdown active              | reveal-countdown  | false           | false/true |
 *  | Open, bookings on, vote closed       | open              | true            | false      |
 *  | Open, bookings on, vote open         | open              | true            | true       |
 *  | Open, bookings off, vote closed      | open              | false           | false      |
 *  | Open, bookings off, vote open        | open              | false           | true       |
 *  | Winner overrides countdown           | winner-decreed    | false           | false      |
 *  | prenotazioni_abilitate absent/null   | open              | true            | –          |
 */

import { describe, it, expect } from 'vitest';
import state from '../../scripts/karaoke-state.js';

const { computeSerataUiState } = state;

// ── Factory helpers ──────────────────────────────────────────────────────────

/** Build a minimal "open serata" row with sane defaults. */
function openSerata(overrides = {}) {
  return {
    id: 1,
    aperta: true,
    voto_aperto: false,
    prenotazioni_abilitate: true,
    vincitore_decretato: false,
    vincitore_prenotazione_id: null,
    winner_reveal_countdown_active: false,
    winner_reveal_countdown_ends_at: null,
    notifiche_browser_abilitate: true,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
describe('Feature: Karaoke serata state machine', () => {

  // ── Closed ───────────────────────────────────────────────────────────────
  describe('Scenario: No serata is open (data = null)', () => {
    it('should show the "closed" UI state', () => {
      const result = computeSerataUiState(null);
      expect(result.uiState).toBe('closed');
    });

    it('should disable bookings', () => {
      expect(computeSerataUiState(null).bookingsEnabled).toBe(false);
    });

    it('should close voting', () => {
      expect(computeSerataUiState(null).votingOpen).toBe(false);
    });
  });

  // ── Winner decreed ────────────────────────────────────────────────────────
  describe('Scenario: A winner has been officially decreed', () => {
    const serata = openSerata({ vincitore_decretato: true, voto_aperto: false });

    it('should show the "winner-decreed" UI state', () => {
      expect(computeSerataUiState(serata).uiState).toBe('winner-decreed');
    });

    it('should disable bookings', () => {
      expect(computeSerataUiState(serata).bookingsEnabled).toBe(false);
    });

    it('should close voting', () => {
      expect(computeSerataUiState(serata).votingOpen).toBe(false);
    });
  });

  describe('Scenario: Winner is decreed even though voto_aperto is still true', () => {
    // Edge case: admin set vincitore_decretato without closing votes first.
    const serata = openSerata({ vincitore_decretato: true, voto_aperto: true });

    it('should still show "winner-decreed" (not "open")', () => {
      expect(computeSerataUiState(serata).uiState).toBe('winner-decreed');
    });

    it('should still close voting even though voto_aperto=true', () => {
      expect(computeSerataUiState(serata).votingOpen).toBe(false);
    });
  });

  // ── Reveal countdown active ───────────────────────────────────────────────
  describe('Scenario: Reveal countdown is active, votes closed', () => {
    const serata = openSerata({ winner_reveal_countdown_active: true, voto_aperto: false });

    it('should show the "reveal-countdown" UI state', () => {
      expect(computeSerataUiState(serata).uiState).toBe('reveal-countdown');
    });

    it('should disable bookings', () => {
      expect(computeSerataUiState(serata).bookingsEnabled).toBe(false);
    });

    it('should show votingOpen = false', () => {
      expect(computeSerataUiState(serata).votingOpen).toBe(false);
    });
  });

  describe('Scenario: Reveal countdown active AND votes still open', () => {
    const serata = openSerata({ winner_reveal_countdown_active: true, voto_aperto: true });

    it('should remain "reveal-countdown"', () => {
      expect(computeSerataUiState(serata).uiState).toBe('reveal-countdown');
    });

    it('should reflect that voting is open', () => {
      expect(computeSerataUiState(serata).votingOpen).toBe(true);
    });
  });

  describe('Scenario: vincitore_decretato takes precedence over reveal countdown', () => {
    const serata = openSerata({ vincitore_decretato: true, winner_reveal_countdown_active: true });

    it('should show "winner-decreed", not "reveal-countdown"', () => {
      expect(computeSerataUiState(serata).uiState).toBe('winner-decreed');
    });
  });

  // ── Open, bookings enabled ────────────────────────────────────────────────
  describe('Scenario: Serata is open, bookings enabled, voting closed', () => {
    const serata = openSerata({ prenotazioni_abilitate: true, voto_aperto: false });

    it('should show the "open" UI state', () => {
      expect(computeSerataUiState(serata).uiState).toBe('open');
    });

    it('should enable bookings', () => {
      expect(computeSerataUiState(serata).bookingsEnabled).toBe(true);
    });

    it('should report votingOpen = false', () => {
      expect(computeSerataUiState(serata).votingOpen).toBe(false);
    });
  });

  describe('Scenario: Serata is open, bookings enabled, voting open', () => {
    const serata = openSerata({ prenotazioni_abilitate: true, voto_aperto: true });

    it('should show the "open" UI state', () => {
      expect(computeSerataUiState(serata).uiState).toBe('open');
    });

    it('should enable bookings', () => {
      expect(computeSerataUiState(serata).bookingsEnabled).toBe(true);
    });

    it('should report votingOpen = true', () => {
      expect(computeSerataUiState(serata).votingOpen).toBe(true);
    });
  });

  // ── Open, bookings disabled ───────────────────────────────────────────────
  describe('Scenario: Serata is open but bookings are disabled, voting closed', () => {
    const serata = openSerata({ prenotazioni_abilitate: false, voto_aperto: false });

    it('should show the "open" UI state', () => {
      expect(computeSerataUiState(serata).uiState).toBe('open');
    });

    it('should disable bookings', () => {
      expect(computeSerataUiState(serata).bookingsEnabled).toBe(false);
    });

    it('should report votingOpen = false', () => {
      expect(computeSerataUiState(serata).votingOpen).toBe(false);
    });
  });

  describe('Scenario: Serata is open, bookings disabled, voting open', () => {
    const serata = openSerata({ prenotazioni_abilitate: false, voto_aperto: true });

    it('should show the "open" UI state', () => {
      expect(computeSerataUiState(serata).uiState).toBe('open');
    });

    it('should disable bookings', () => {
      expect(computeSerataUiState(serata).bookingsEnabled).toBe(false);
    });

    it('should report votingOpen = true (vote banner still shown)', () => {
      expect(computeSerataUiState(serata).votingOpen).toBe(true);
    });
  });

  // ── prenotazioni_abilitate edge cases ────────────────────────────────────
  describe('Scenario: prenotazioni_abilitate is absent (defaults to enabled)', () => {
    it('should treat missing field as enabled', () => {
      const serata = openSerata();
      delete serata.prenotazioni_abilitate;
      // prenotazioni_abilitate !== false → true
      expect(computeSerataUiState(serata).bookingsEnabled).toBe(true);
    });

    it('should treat null as enabled', () => {
      const serata = openSerata({ prenotazioni_abilitate: null });
      expect(computeSerataUiState(serata).bookingsEnabled).toBe(true);
    });

    it('should treat explicit true as enabled', () => {
      const serata = openSerata({ prenotazioni_abilitate: true });
      expect(computeSerataUiState(serata).bookingsEnabled).toBe(true);
    });

    it('should treat explicit false as disabled', () => {
      const serata = openSerata({ prenotazioni_abilitate: false });
      expect(computeSerataUiState(serata).bookingsEnabled).toBe(false);
    });
  });

  // ── Complete state matrix ─────────────────────────────────────────────────
  describe('Complete state × vote × booking matrix', () => {
    const cases = [
      // [label, serataData, expected]
      ['null data',                  null,                                                          { uiState: 'closed',           bookingsEnabled: false, votingOpen: false }],
      ['winner decreed, vote off',   openSerata({ vincitore_decretato: true, voto_aperto: false }), { uiState: 'winner-decreed',   bookingsEnabled: false, votingOpen: false }],
      ['winner decreed, vote on',    openSerata({ vincitore_decretato: true, voto_aperto: true }),  { uiState: 'winner-decreed',   bookingsEnabled: false, votingOpen: false }],
      ['reveal, bookings on',        openSerata({ winner_reveal_countdown_active: true }),           { uiState: 'reveal-countdown', bookingsEnabled: false, votingOpen: false }],
      ['reveal + vote open',         openSerata({ winner_reveal_countdown_active: true, voto_aperto: true }), { uiState: 'reveal-countdown', bookingsEnabled: false, votingOpen: true }],
      ['open, b=on, v=off',         openSerata({ prenotazioni_abilitate: true,  voto_aperto: false }), { uiState: 'open', bookingsEnabled: true,  votingOpen: false }],
      ['open, b=on, v=on',          openSerata({ prenotazioni_abilitate: true,  voto_aperto: true  }), { uiState: 'open', bookingsEnabled: true,  votingOpen: true  }],
      ['open, b=off, v=off',        openSerata({ prenotazioni_abilitate: false, voto_aperto: false }), { uiState: 'open', bookingsEnabled: false, votingOpen: false }],
      ['open, b=off, v=on',         openSerata({ prenotazioni_abilitate: false, voto_aperto: true  }), { uiState: 'open', bookingsEnabled: false, votingOpen: true  }],
    ];

    it.each(cases)('%s', (_label, serataData, expected) => {
      expect(computeSerataUiState(serataData)).toEqual(expected);
    });
  });
});
