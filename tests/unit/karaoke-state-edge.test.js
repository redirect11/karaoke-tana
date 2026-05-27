/**
 * tests/unit/karaoke-state-edge.test.js
 *
 * Additional edge-case and boundary tests for every function in
 * scripts/karaoke-state.js that are not covered by the primary BDD specs.
 *
 * Focus areas:
 *   - computeSerataUiState  – truthy/falsy field coercions, field absence
 *   - computeBookingCookieAction – boundary timestamps, field variations
 *   - computeQueuePosition  – large queues, non-array input, fractional ids
 *   - computeVoteBanner     – precedence matrix completeness
 *   - computeAdminSerataColor – full matrix (see admin-serata-colors.test.js
 *                               for BDD; this file adds extra edge cases)
 */

import { describe, it, expect } from 'vitest';
import state from '../../scripts/karaoke-state.js';

const {
  computeSerataUiState,
  computeBookingCookieAction,
  computeQueuePosition,
  computeVoteBanner,
  computeAdminSerataColor,
} = state;

const NOW = 1_700_000_000_000;

// ─────────────────────────────────────────────────────────────────────────────
describe('computeSerataUiState – edge cases', () => {

  it('treats an empty object as open (no closing flags)', () => {
    // An empty object is truthy → falls through to the open branch
    const result = computeSerataUiState({});
    expect(result.uiState).toBe('open');
    // prenotazioni_abilitate is undefined → !== false → bookingsEnabled = true
    expect(result.bookingsEnabled).toBe(true);
    expect(result.votingOpen).toBe(false);
  });

  it('treats vincitore_decretato = 1 (truthy number) as winner decreed', () => {
    expect(computeSerataUiState({ vincitore_decretato: 1 }).uiState).toBe('winner-decreed');
  });

  it('treats vincitore_decretato = "yes" (truthy string) as winner decreed', () => {
    expect(computeSerataUiState({ vincitore_decretato: 'yes' }).uiState).toBe('winner-decreed');
  });

  it('treats winner_reveal_countdown_active = 1 (truthy number) as reveal countdown', () => {
    expect(computeSerataUiState({ winner_reveal_countdown_active: 1 }).uiState).toBe('reveal-countdown');
  });

  it('treats voto_aperto = 1 (truthy number) as votingOpen', () => {
    const result = computeSerataUiState({ voto_aperto: 1 });
    expect(result.votingOpen).toBe(true);
  });

  it('vincitore_decretato = 0 (falsy) does not trigger winner-decreed', () => {
    expect(computeSerataUiState({ vincitore_decretato: 0 }).uiState).toBe('open');
  });

  it('winner_reveal_countdown_active = 0 (falsy) does not trigger reveal-countdown', () => {
    expect(computeSerataUiState({ winner_reveal_countdown_active: 0 }).uiState).toBe('open');
  });

  it('winner-decreed takes precedence over winner_reveal_countdown_active', () => {
    const result = computeSerataUiState({
      vincitore_decretato: true,
      winner_reveal_countdown_active: true,
      prenotazioni_abilitate: true,
    });
    expect(result.uiState).toBe('winner-decreed');
    expect(result.bookingsEnabled).toBe(false);
    expect(result.votingOpen).toBe(false);
  });

  it('reveal-countdown disables bookings regardless of prenotazioni_abilitate', () => {
    const result = computeSerataUiState({
      vincitore_decretato: false,
      winner_reveal_countdown_active: true,
      prenotazioni_abilitate: true,
    });
    expect(result.uiState).toBe('reveal-countdown');
    expect(result.bookingsEnabled).toBe(false);
  });

  it('returns full shape object (all three keys present)', () => {
    const result = computeSerataUiState(null);
    expect(result).toHaveProperty('uiState');
    expect(result).toHaveProperty('bookingsEnabled');
    expect(result).toHaveProperty('votingOpen');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('computeBookingCookieAction – edge cases', () => {

  it('uses Date.now() default when now is not provided', () => {
    // A booking expiring far in the future should still be pending
    const stored = { id: 1, serataId: 5, pendingExpiresAt: Date.now() + 3_600_000 };
    expect(computeBookingCookieAction(stored, 5).action).toBe('pending');
  });

  it('treats stored.id as a float → invalid', () => {
    const stored = { id: 1.5, serataId: 5, pendingExpiresAt: NOW + 1000 };
    expect(computeBookingCookieAction(stored, 5, 30, NOW).action).toBe('invalid');
  });

  it('treats stored.id as a string number → valid (coerced)', () => {
    const stored = { id: '3', serataId: 5, pendingExpiresAt: NOW + 1000 };
    expect(computeBookingCookieAction(stored, 5, 30, NOW).action).toBe('pending');
  });

  it('treats serataId mismatch as stale-serata', () => {
    const stored = { id: 1, serataId: 99, pendingExpiresAt: NOW + 1000 };
    expect(computeBookingCookieAction(stored, 5, 30, NOW).action).toBe('stale-serata');
  });

  it('skips stale-serata check when currentSerataId is null', () => {
    const stored = { id: 1, serataId: 99, pendingExpiresAt: NOW + 1000 };
    // currentSerataId = null → no serata to compare against → skip stale check
    expect(computeBookingCookieAction(stored, null, 30, NOW).action).toBe('pending');
  });

  it('skips stale-serata check when currentSerataId is 0', () => {
    const stored = { id: 1, serataId: 99, pendingExpiresAt: NOW + 1000 };
    expect(computeBookingCookieAction(stored, 0, 30, NOW).action).toBe('pending');
  });

  it('returns approved when pendingExpiresAt is null (server cleared it)', () => {
    const stored = { id: 1, serataId: 5, pendingExpiresAt: null };
    expect(computeBookingCookieAction(stored, 5, 30, NOW).action).toBe('approved');
  });

  it('returns approved when pendingExpiresAt is undefined (field absent)', () => {
    const stored = { id: 1, serataId: 5 }; // no pendingExpiresAt key
    expect(computeBookingCookieAction(stored, 5, 30, NOW).action).toBe('approved');
  });

  it('returns expired when now === pendingExpiryAt exactly (boundary)', () => {
    const stored = { id: 1, serataId: 5, pendingExpiresAt: NOW };
    expect(computeBookingCookieAction(stored, 5, 30, NOW).action).toBe('expired');
  });

  it('returns pending when now is one ms before expiry (boundary)', () => {
    const stored = { id: 1, serataId: 5, pendingExpiresAt: NOW + 1 };
    expect(computeBookingCookieAction(stored, 5, 30, NOW).action).toBe('pending');
  });

  it('computes expiry from timestamp when pendingExpiresAt is 0', () => {
    const stored = { id: 1, serataId: 5, timestamp: NOW - 60_000, pendingExpiresAt: 0 };
    // expiry = (NOW - 60_000) + 30 * 60 * 1000 = NOW + 29 * 60 * 1000 → still pending
    expect(computeBookingCookieAction(stored, 5, 30, NOW).action).toBe('pending');
  });

  it('returns pending when only timestamp is provided and not yet expired', () => {
    // pendingExpiresAt: 0 (not null/undefined) forces the timestamp fallback path
    const stored = { id: 1, serataId: 5, timestamp: NOW - 5 * 60 * 1000, pendingExpiresAt: 0 };
    expect(computeBookingCookieAction(stored, 5, 30, NOW).action).toBe('pending');
  });

  it('returns expired when timestamp-derived expiry has passed', () => {
    // timestamp is 35 minutes ago → 30-minute window already closed
    const stored = { id: 1, serataId: 5, timestamp: NOW - 35 * 60 * 1000, pendingExpiresAt: 0 };
    expect(computeBookingCookieAction(stored, 5, 30, NOW).action).toBe('expired');
  });

  it('includes bookingId in the approved result', () => {
    const stored = { id: 7, serataId: 5, pendingExpiresAt: null };
    expect(computeBookingCookieAction(stored, 5, 30, NOW).bookingId).toBe(7);
  });

  it('includes pendingExpiryAt in the pending result', () => {
    const expiresAt = NOW + 20 * 60 * 1000;
    const stored = { id: 1, serataId: 5, pendingExpiresAt: expiresAt };
    expect(computeBookingCookieAction(stored, 5, 30, NOW).pendingExpiryAt).toBe(expiresAt);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('computeQueuePosition – edge cases', () => {

  it('returns no-booking for null bookingId', () => {
    expect(computeQueuePosition(null, [{ id: 1 }]).status).toBe('no-booking');
  });

  it('returns no-booking for bookingId = 0', () => {
    expect(computeQueuePosition(0, [{ id: 1 }]).status).toBe('no-booking');
  });

  it('returns no-booking for negative bookingId', () => {
    expect(computeQueuePosition(-5, [{ id: 1 }]).status).toBe('no-booking');
  });

  it('returns no-booking for string non-numeric bookingId', () => {
    expect(computeQueuePosition('abc', [{ id: 1 }]).status).toBe('no-booking');
  });

  it('returns no-booking for null queueItems', () => {
    expect(computeQueuePosition(1, null).status).toBe('no-booking');
  });

  it('returns not-found when queue is empty', () => {
    expect(computeQueuePosition(1, []).status).toBe('not-found');
  });

  it('returns preparing when the current booking is flagged in_preparazione', () => {
    const result = computeQueuePosition(1, [{ id: 1, in_preparazione: true }, { id: 2 }]);
    expect(result.status).toBe('preparing');
    expect(result.index).toBe(0);
  });

  it('returns not-found with correct index -1', () => {
    const result = computeQueuePosition(99, [{ id: 1 }, { id: 2 }]);
    expect(result.status).toBe('not-found');
    expect(result.index).toBe(-1);
  });

  it('coerces string bookingId to number for lookup', () => {
    expect(computeQueuePosition('2', [{ id: 1 }, { id: 2 }]).status).toBe('next');
  });

  it('returns waiting with the correct index for position 3 (index 2)', () => {
    const queue = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
    const result = computeQueuePosition(3, queue);
    expect(result.status).toBe('waiting');
    expect(result.index).toBe(2);
  });

  it('returns waiting for large queue position', () => {
    const queue = Array.from({ length: 20 }, (_, i) => ({ id: i + 1 }));
    const result = computeQueuePosition(15, queue);
    expect(result.status).toBe('waiting');
    expect(result.index).toBe(14);
  });

  it('matches by numeric equality (item.id is a string)', () => {
    expect(computeQueuePosition(1, [{ id: '1' }, { id: '2' }]).status).toBe('turn');
  });

  it('handles queue items with null/missing id gracefully', () => {
    const queue = [{ id: null }, { id: undefined }, { id: 5 }];
    const result = computeQueuePosition(5, queue);
    expect(result.status).toBe('waiting');
    expect(result.index).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('computeVoteBanner – precedence and edge cases', () => {

  it('forceReveal=true always returns winner-decreed', () => {
    // All flag combinations should yield winner-decreed when forceReveal is set
    const combinations = [
      { voto_aperto: true,  vincitore_decretato: false, winner_reveal_countdown_active: false },
      { voto_aperto: false, vincitore_decretato: false, winner_reveal_countdown_active: true  },
      { voto_aperto: true,  vincitore_decretato: true,  winner_reveal_countdown_active: true  },
    ];
    combinations.forEach(flags => {
      expect(computeVoteBanner(flags, true)).toBe('winner-decreed');
    });
  });

  it('vincitore_decretato takes precedence over voto_aperto', () => {
    expect(computeVoteBanner({ voto_aperto: true, vincitore_decretato: true }))
      .toBe('winner-decreed');
  });

  it('vincitore_decretato takes precedence over reveal countdown', () => {
    expect(computeVoteBanner({
      voto_aperto: false,
      vincitore_decretato: true,
      winner_reveal_countdown_active: true,
    })).toBe('winner-decreed');
  });

  it('voto_aperto takes precedence over countdown (voto_aperto checked first)', () => {
    // When voto_aperto=true and countdown is active, banner is voting-open
    // (vincitore_decretato=false is required, otherwise winner-decreed wins)
    expect(computeVoteBanner({
      voto_aperto: true,
      vincitore_decretato: false,
      winner_reveal_countdown_active: true,
    })).toBe('voting-open');
  });

  it('returns voting-closed when all flags are false', () => {
    expect(computeVoteBanner({
      voto_aperto: false,
      vincitore_decretato: false,
      winner_reveal_countdown_active: false,
    })).toBe('voting-closed');
  });

  it('returns voting-closed for null serata without forceReveal', () => {
    expect(computeVoteBanner(null)).toBe('voting-closed');
  });

  it('treats vincitore_decretato = 1 (truthy) as decreed', () => {
    expect(computeVoteBanner({ vincitore_decretato: 1 })).toBe('winner-decreed');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('computeAdminSerataColor – edge cases', () => {

  it('treats winner_reveal_countdown_active = 1 (truthy) as proclamation', () => {
    expect(computeAdminSerataColor({ winner_reveal_countdown_active: 1, vincitore_decretato: false }))
      .toBe('is-proclamation');
  });

  it('treats vincitore_decretato = 1 (truthy) as decreed → no proclamation', () => {
    // countdown active but decreed truthy → inProclamazioneMode = false
    expect(computeAdminSerataColor({ winner_reveal_countdown_active: 1, vincitore_decretato: 1 }))
      .toBe('is-open');
  });

  it('treats prenotazioni_abilitate = true as open', () => {
    expect(computeAdminSerataColor({ prenotazioni_abilitate: true })).toBe('is-open');
  });

  it('treats prenotazioni_abilitate = undefined as open (not explicitly false)', () => {
    expect(computeAdminSerataColor({ prenotazioni_abilitate: undefined })).toBe('is-open');
  });
});
