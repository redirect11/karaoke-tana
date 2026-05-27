/**
 * tests/bdd/admin-serata-colors.test.js
 *
 * BDD specification for the admin panel serata colour-state logic,
 * implemented in computeAdminSerataColor() (scripts/karaoke-state.js).
 *
 * The colour is shown as a dot and background accent on the collapsible
 * serata panel in admin.html.  It maps the serata database record to one
 * of four CSS classes:
 *
 *  | Scenario                                          | CSS class         | Colour  |
 *  |---------------------------------------------------|-------------------|---------|
 *  | No serata is open                                 | is-closed         | 🔴 red  |
 *  | Reveal countdown active, winner not yet decreed   | is-proclamation   | 🟠 orange |
 *  | Open serata, prenotazioni disabled                | is-warning        | 🟡 yellow |
 *  | Open serata, prenotazioni enabled (default)       | is-open           | 🟢 green |
 *
 * Note: vincitore_decretato alone does NOT change the dot colour – only the
 * combination (countdown active && !decreed) triggers proclamation mode.
 * This mirrors the exact logic in admin.html renderSerata().
 */

import { describe, it, expect } from 'vitest';
import state from '../../scripts/karaoke-state.js';

const { computeAdminSerataColor } = state;

// ── Factory helper ────────────────────────────────────────────────────────────

function openSerata(overrides = {}) {
  return {
    id: 1,
    aperta: true,
    data: '2025-06-01',
    prenotazioni_abilitate: true,
    voto_aperto: false,
    vincitore_decretato: false,
    vincitore_prenotazione_id: null,
    winner_reveal_countdown_active: false,
    winner_reveal_countdown_ends_at: null,
    mostra_voti_totali: false,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
describe('Feature: Admin serata panel colour state', () => {

  // ── Closed ───────────────────────────────────────────────────────────────
  describe('Scenario: No serata is open (null)', () => {
    it('returns "is-closed" for null', () => {
      expect(computeAdminSerataColor(null)).toBe('is-closed');
    });

    it('returns "is-closed" for undefined', () => {
      expect(computeAdminSerataColor(undefined)).toBe('is-closed');
    });

    it('returns "is-closed" for false', () => {
      expect(computeAdminSerataColor(false)).toBe('is-closed');
    });
  });

  // ── Proclamation mode ─────────────────────────────────────────────────────
  describe('Scenario: Reveal countdown is active and winner not yet decreed', () => {
    const serata = openSerata({ winner_reveal_countdown_active: true, vincitore_decretato: false });

    it('returns "is-proclamation"', () => {
      expect(computeAdminSerataColor(serata)).toBe('is-proclamation');
    });
  });

  describe('Scenario: Reveal countdown active + bookings disabled → still proclamation', () => {
    const serata = openSerata({
      winner_reveal_countdown_active: true,
      vincitore_decretato: false,
      prenotazioni_abilitate: false,
    });

    it('proclamation takes precedence over is-warning', () => {
      expect(computeAdminSerataColor(serata)).toBe('is-proclamation');
    });
  });

  describe('Scenario: Reveal countdown active but winner already decreed → not proclamation', () => {
    const serata = openSerata({
      winner_reveal_countdown_active: true,
      vincitore_decretato: true,
    });

    it('returns "is-open" when bookings enabled (not proclamation)', () => {
      expect(computeAdminSerataColor(serata)).toBe('is-open');
    });

    it('returns "is-warning" when bookings disabled (not proclamation)', () => {
      const serataNoBookings = openSerata({
        winner_reveal_countdown_active: true,
        vincitore_decretato: true,
        prenotazioni_abilitate: false,
      });
      expect(computeAdminSerataColor(serataNoBookings)).toBe('is-warning');
    });
  });

  // ── Warning (bookings disabled) ───────────────────────────────────────────
  describe('Scenario: Serata open but bookings are disabled', () => {
    const serata = openSerata({ prenotazioni_abilitate: false });

    it('returns "is-warning"', () => {
      expect(computeAdminSerataColor(serata)).toBe('is-warning');
    });
  });

  describe('Scenario: Bookings disabled even when voting is open', () => {
    const serata = openSerata({ prenotazioni_abilitate: false, voto_aperto: true });

    it('still returns "is-warning"', () => {
      expect(computeAdminSerataColor(serata)).toBe('is-warning');
    });
  });

  // ── Open (default) ────────────────────────────────────────────────────────
  describe('Scenario: Normal open serata with bookings enabled', () => {
    it('returns "is-open" for a standard open serata', () => {
      expect(computeAdminSerataColor(openSerata())).toBe('is-open');
    });

    it('returns "is-open" when voting is also open', () => {
      expect(computeAdminSerataColor(openSerata({ voto_aperto: true }))).toBe('is-open');
    });

    it('returns "is-open" when prenotazioni_abilitate is absent (undefined)', () => {
      const serata = openSerata();
      delete serata.prenotazioni_abilitate;
      expect(computeAdminSerataColor(serata)).toBe('is-open');
    });

    it('returns "is-open" when prenotazioni_abilitate is null', () => {
      expect(computeAdminSerataColor(openSerata({ prenotazioni_abilitate: null }))).toBe('is-open');
    });

    it('returns "is-open" when vincitore_decretato is true but no countdown', () => {
      // Winner decreed without countdown = end-of-night, still shows as open
      expect(computeAdminSerataColor(openSerata({ vincitore_decretato: true }))).toBe('is-open');
    });
  });

  // ── Complete colour matrix ─────────────────────────────────────────────────
  describe('Complete colour matrix', () => {
    const cases = [
      // [label, serataData, expectedClass]
      ['null',                                              null,                                                                                        'is-closed'],
      ['countdown=true, decreed=false, bookings=true',     openSerata({ winner_reveal_countdown_active: true }),                                         'is-proclamation'],
      ['countdown=true, decreed=false, bookings=false',    openSerata({ winner_reveal_countdown_active: true, prenotazioni_abilitate: false }),           'is-proclamation'],
      ['countdown=true, decreed=true,  bookings=true',     openSerata({ winner_reveal_countdown_active: true, vincitore_decretato: true }),               'is-open'],
      ['countdown=true, decreed=true,  bookings=false',    openSerata({ winner_reveal_countdown_active: true, vincitore_decretato: true, prenotazioni_abilitate: false }), 'is-warning'],
      ['countdown=false, bookings=false, vote=false',      openSerata({ prenotazioni_abilitate: false }),                                                 'is-warning'],
      ['countdown=false, bookings=true,  vote=false',      openSerata({ prenotazioni_abilitate: true }),                                                  'is-open'],
      ['countdown=false, bookings=true,  vote=true',       openSerata({ prenotazioni_abilitate: true, voto_aperto: true }),                               'is-open'],
      ['decreed only (no countdown)',                      openSerata({ vincitore_decretato: true }),                                                     'is-open'],
    ];

    it.each(cases)('%s → %s', (_label, serataData, expectedClass) => {
      expect(computeAdminSerataColor(serataData)).toBe(expectedClass);
    });
  });
});
