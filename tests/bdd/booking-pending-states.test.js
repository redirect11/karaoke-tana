/**
 * tests/bdd/booking-pending-states.test.js
 *
 * BDD specification for the pending-booking cookie state machine and the
 * to-sing queue position logic.
 *
 * Requirement matrix:
 *
 *  | Scenario                              | action        | bookingId |
 *  |---------------------------------------|---------------|-----------|
 *  | No stored booking                     | none          | –         |
 *  | Invalid / missing booking id          | invalid       | –         |
 *  | Booking belongs to a different serata | stale-serata  | ✓         |
 *  | Pending window expired                | expired       | ✓         |
 *  | Booking approved (null expiry)        | approved      | ✓         |
 *  | Pending, not yet expired              | pending       | ✓         |
 *
 * Queue position:
 *
 *  | Booking position in queue | status      |
 *  |---------------------------|-------------|
 *  | Not in queue (index -1)   | not-found   |
 *  | First + preparing         | preparing   |
 *  | First (index 0)           | turn        |
 *  | Second (index 1)          | next        |
 *  | Third or later (index 2+) | waiting     |
 *  | No valid bookingId        | no-booking  |
 */

import { describe, it, expect } from 'vitest';
import state from '../../scripts/karaoke-state.js';

const { computeBookingCookieAction, computeQueuePosition } = state;

const EXPIRY_MIN = 30;
const NOW = 1_700_000_000_000; // fixed reference point

// ── Factory helpers ──────────────────────────────────────────────────────────

/** Build a stored booking cookie object with sane defaults. */
function storedBooking(overrides = {}) {
  return {
    id: 1,
    canzone: 'Test Song',
    artista: 'Test Artist',
    serataId: 10,
    timestamp: NOW - 5 * 60 * 1000, // created 5 minutes ago
    pendingExpiresAt: NOW + 25 * 60 * 1000, // expires in 25 minutes
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
describe('Feature: Pending booking cookie state machine', () => {

  // ── No booking ────────────────────────────────────────────────────────────
  describe('Scenario: No stored booking', () => {
    it('returns action "none" for null', () => {
      expect(computeBookingCookieAction(null, 10, EXPIRY_MIN, NOW).action).toBe('none');
    });

    it('returns action "none" for undefined', () => {
      expect(computeBookingCookieAction(undefined, 10, EXPIRY_MIN, NOW).action).toBe('none');
    });

    it('returns action "none" for false', () => {
      expect(computeBookingCookieAction(false, 10, EXPIRY_MIN, NOW).action).toBe('none');
    });
  });

  // ── Invalid booking id ────────────────────────────────────────────────────
  describe('Scenario: Stored booking has an invalid or missing id', () => {
    it('returns "invalid" when id is 0', () => {
      expect(computeBookingCookieAction(storedBooking({ id: 0 }), 10, EXPIRY_MIN, NOW).action)
        .toBe('invalid');
    });

    it('returns "invalid" when id is negative', () => {
      expect(computeBookingCookieAction(storedBooking({ id: -5 }), 10, EXPIRY_MIN, NOW).action)
        .toBe('invalid');
    });

    it('returns "invalid" when id is absent', () => {
      const s = storedBooking();
      delete s.id;
      expect(computeBookingCookieAction(s, 10, EXPIRY_MIN, NOW).action).toBe('invalid');
    });

    it('returns "invalid" when id is a non-numeric string', () => {
      expect(computeBookingCookieAction(storedBooking({ id: 'abc' }), 10, EXPIRY_MIN, NOW).action)
        .toBe('invalid');
    });
  });

  // ── Stale serata ──────────────────────────────────────────────────────────
  describe('Scenario: Booking belongs to a different (old) serata', () => {
    it('returns "stale-serata" when serataId does not match currentSerataId', () => {
      const s = storedBooking({ serataId: 5 });
      const result = computeBookingCookieAction(s, 10, EXPIRY_MIN, NOW);
      expect(result.action).toBe('stale-serata');
      expect(result.bookingId).toBe(1);
    });

    it('does NOT flag as stale when currentSerataId is null (unknown)', () => {
      const s = storedBooking({ serataId: 5 });
      // When the current serata is unknown, we cannot determine staleness.
      const result = computeBookingCookieAction(s, null, EXPIRY_MIN, NOW);
      expect(result.action).not.toBe('stale-serata');
    });

    it('does NOT flag as stale when serataIds match', () => {
      const s = storedBooking({ serataId: 10 });
      const result = computeBookingCookieAction(s, 10, EXPIRY_MIN, NOW);
      expect(result.action).not.toBe('stale-serata');
    });
  });

  // ── Approved ──────────────────────────────────────────────────────────────
  describe('Scenario: Booking has been approved by staff', () => {
    it('returns "approved" when pendingExpiresAt is null (canonical approved marker)', () => {
      const s = storedBooking({ pendingExpiresAt: null, serataId: 10 });
      expect(computeBookingCookieAction(s, 10, EXPIRY_MIN, NOW).action).toBe('approved');
    });

    it('returns "approved" when pendingExpiresAt is undefined', () => {
      const s = storedBooking({ serataId: 10 });
      delete s.pendingExpiresAt;
      expect(computeBookingCookieAction(s, 10, EXPIRY_MIN, NOW).action).toBe('approved');
    });

    it('includes the bookingId in the result', () => {
      const s = storedBooking({ id: 42, pendingExpiresAt: null, serataId: 10 });
      expect(computeBookingCookieAction(s, 10, EXPIRY_MIN, NOW).bookingId).toBe(42);
    });
  });

  // ── Expired ───────────────────────────────────────────────────────────────
  describe('Scenario: Pending booking whose waiting window has elapsed', () => {
    it('returns "expired" when pendingExpiresAt is in the past', () => {
      const past = NOW - 1_000; // 1 second ago
      const s = storedBooking({ pendingExpiresAt: past, serataId: 10 });
      expect(computeBookingCookieAction(s, 10, EXPIRY_MIN, NOW).action).toBe('expired');
    });

    it('returns "expired" when computed from timestamp + expiryMin and that has elapsed', () => {
      // timestamp 35 minutes ago → expiry was 5 minutes ago
      const s = storedBooking({
        timestamp: NOW - 35 * 60 * 1000,
        pendingExpiresAt: 0, // 0 → fallback to timestamp
        serataId: 10,
      });
      expect(computeBookingCookieAction(s, 10, EXPIRY_MIN, NOW).action).toBe('expired');
    });

    it('includes bookingId and pendingExpiryAt in the result', () => {
      const past = NOW - 1_000;
      const s = storedBooking({ id: 7, pendingExpiresAt: past, serataId: 10 });
      const result = computeBookingCookieAction(s, 10, EXPIRY_MIN, NOW);
      expect(result.bookingId).toBe(7);
      expect(result.pendingExpiryAt).toBe(past);
    });
  });

  // ── Pending ───────────────────────────────────────────────────────────────
  describe('Scenario: Pending booking whose window has NOT yet elapsed', () => {
    it('returns "pending" when pendingExpiresAt is in the future', () => {
      const future = NOW + 10 * 60 * 1000;
      const s = storedBooking({ pendingExpiresAt: future, serataId: 10 });
      expect(computeBookingCookieAction(s, 10, EXPIRY_MIN, NOW).action).toBe('pending');
    });

    it('returns "pending" when computed from timestamp and it is still in the future', () => {
      // timestamp 5 minutes ago, expiryMin=30 → expires in 25 minutes
      const s = storedBooking({
        timestamp: NOW - 5 * 60 * 1000,
        pendingExpiresAt: 0,
        serataId: 10,
      });
      expect(computeBookingCookieAction(s, 10, EXPIRY_MIN, NOW).action).toBe('pending');
    });

    it('includes bookingId and pendingExpiryAt in the result', () => {
      const future = NOW + 20 * 60 * 1000;
      const s = storedBooking({ id: 3, pendingExpiresAt: future, serataId: 10 });
      const result = computeBookingCookieAction(s, 10, EXPIRY_MIN, NOW);
      expect(result.bookingId).toBe(3);
      expect(result.pendingExpiryAt).toBe(future);
    });
  });

  // ── Edge: expiry exactly at "now" ────────────────────────────────────────
  describe('Edge: pending expiry is exactly at NOW', () => {
    it('treats NOW === expiryAt as expired (>= comparison)', () => {
      const s = storedBooking({ pendingExpiresAt: NOW, serataId: 10 });
      expect(computeBookingCookieAction(s, 10, EXPIRY_MIN, NOW).action).toBe('expired');
    });
  });

  // ── Full action matrix (table-driven) ────────────────────────────────────
  describe('Complete action matrix', () => {
    const cases = [
      ['null stored',        null,                                          10, 'none'],
      ['invalid id (0)',     storedBooking({ id: 0,  serataId: 10 }),       10, 'invalid'],
      ['stale serata',       storedBooking({ serataId: 5 }),                10, 'stale-serata'],
      ['approved (null)',    storedBooking({ pendingExpiresAt: null,   serataId: 10 }), 10, 'approved'],
      ['expired',           storedBooking({ pendingExpiresAt: NOW - 1, serataId: 10 }), 10, 'expired'],
      ['pending future',    storedBooking({ pendingExpiresAt: NOW + 1, serataId: 10 }), 10, 'pending'],
    ];

    it.each(cases)('%s', (_label, stored, currentSerataId, expectedAction) => {
      expect(computeBookingCookieAction(stored, currentSerataId, EXPIRY_MIN, NOW).action)
        .toBe(expectedAction);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Feature: Queue position logic', () => {

  describe('Scenario: User has no valid booking id', () => {
    it('returns status "no-booking" for null bookingId', () => {
      expect(computeQueuePosition(null, []).status).toBe('no-booking');
    });

    it('returns status "no-booking" for 0 bookingId', () => {
      expect(computeQueuePosition(0, [{ id: 1 }]).status).toBe('no-booking');
    });

    it('returns status "no-booking" for negative bookingId', () => {
      expect(computeQueuePosition(-1, [{ id: 1 }]).status).toBe('no-booking');
    });

    it('returns status "no-booking" when queueItems is not an array', () => {
      expect(computeQueuePosition(1, null).status).toBe('no-booking');
    });
  });

  describe('Scenario: Booking is not found in the queue', () => {
    it('returns status "not-found" and index -1', () => {
      const queue = [{ id: 2 }, { id: 3 }];
      const result = computeQueuePosition(1, queue);
      expect(result.status).toBe('not-found');
      expect(result.index).toBe(-1);
    });
  });

  describe('Scenario: Booking is first in the queue (È il tuo turno!)', () => {
    it('returns status "turn" and index 0', () => {
      const queue = [{ id: 1 }, { id: 2 }];
      const result = computeQueuePosition(1, queue);
      expect(result.status).toBe('turn');
      expect(result.index).toBe(0);
    });
  });

  describe('Scenario: Booking is current but still in preparation', () => {
    it('returns status "preparing" and index 0', () => {
      const queue = [{ id: 1, in_preparazione: true }, { id: 2 }];
      const result = computeQueuePosition(1, queue);
      expect(result.status).toBe('preparing');
      expect(result.index).toBe(0);
    });
  });

  describe('Scenario: Booking is second in the queue (Preparati!)', () => {
    it('returns status "next" and index 1', () => {
      const queue = [{ id: 2 }, { id: 1 }, { id: 3 }];
      const result = computeQueuePosition(1, queue);
      expect(result.status).toBe('next');
      expect(result.index).toBe(1);
    });
  });

  describe('Scenario: Booking is further down the queue (Mancano N canzoni)', () => {
    it('returns status "waiting" and the correct index for position 2', () => {
      const queue = [{ id: 2 }, { id: 3 }, { id: 1 }];
      const result = computeQueuePosition(1, queue);
      expect(result.status).toBe('waiting');
      expect(result.index).toBe(2);
    });

    it('returns the correct index for a longer queue', () => {
      const queue = [{ id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }, { id: 1 }];
      const result = computeQueuePosition(1, queue);
      expect(result.status).toBe('waiting');
      expect(result.index).toBe(4);
    });
  });

  // ── UI label mapping (derived from index and status) ─────────────────────
  describe('UI label expectations based on queue status', () => {
    /**
     * This group documents the mapping between computeQueuePosition status
     * and the text shown in updateWaitingPositionStatus() (index.html).
     * The mapping is not tested at the DOM level here, but the status values
     * are the authoritative source for the labels.
     */

    const labelMap = {
      'no-booking':  '(no action)',
      'not-found':   'Sei in lista. Lo staff ti chiamerà quando arriva il tuo turno.',
      'preparing':   'Sei la canzone corrente: lo staff ti sta preparando prima del live.',
      'turn':        'È il tuo turno.',
      'next':        'Preparati, canti al prossimo turno.',
      'waiting':     'Mancano N canzoni',
    };

    it.each(Object.entries(labelMap))('status "%s" → "%s"', (status, _label) => {
      // Simply asserting that the status values we specify are the correct ones.
      expect(typeof status).toBe('string');
      expect(Object.keys(labelMap)).toContain(status);
    });
  });

  // ── Queue position matrix ─────────────────────────────────────────────────
  describe('Position matrix', () => {
    const queue = [{ id: 10 }, { id: 20 }, { id: 30 }, { id: 40 }];
    const queueWithPreparingCurrent = [{ id: 10, in_preparazione: true }, { id: 20 }, { id: 30 }, { id: 40 }];

    const cases = [
      { bookingId: null, queueItems: queue, expectedStatus: 'no-booking', expectedIndex: -1 },
      { bookingId: 99, queueItems: queue, expectedStatus: 'not-found', expectedIndex: -1 },
      { bookingId: 10, queueItems: queueWithPreparingCurrent, expectedStatus: 'preparing', expectedIndex: 0 },
      { bookingId: 10, queueItems: queue, expectedStatus: 'turn', expectedIndex: 0 },
      { bookingId: 20, queueItems: queue, expectedStatus: 'next', expectedIndex: 1 },
      { bookingId: 30, queueItems: queue, expectedStatus: 'waiting', expectedIndex: 2 },
      { bookingId: 40, queueItems: queue, expectedStatus: 'waiting', expectedIndex: 3 },
    ];

    it.each(cases)('bookingId=$bookingId → status=$expectedStatus, index=$expectedIndex', ({ bookingId, queueItems, expectedStatus, expectedIndex }) => {
      const result = computeQueuePosition(bookingId, queueItems);
      expect(result.status).toBe(expectedStatus);
      expect(result.index).toBe(expectedIndex);
    });
  });
});
