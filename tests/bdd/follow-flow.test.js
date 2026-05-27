/**
 * tests/bdd/follow-flow.test.js
 *
 * BDD specification for the follow flow widget visibility logic.
 *
 * Requirement matrix – computeFollowFlowVisibility:
 *
 *  | Scenario                                      | showSteps | showFollowBox | showForm | activeStep |
 *  |-----------------------------------------------|-----------|---------------|----------|------------|
 *  | First visit (never followed)                  | true      | true          | false    | 1          |
 *  | User clicks Follow, no reload                 | true      | false         | true     | 2          |
 *  | Reload after follow (cookie present)          | false     | false         | true     | –          |
 *  | Reload without follow (returning visitor)     | true      | true          | false    | 1          |
 *  | followedAtPageLoad overrides followedInSession| false     | false         | true     | –          |
 *
 * Requirement matrix – shouldRestoreFollowFlow:
 *
 *  | Scenario                                      | restore? |
 *  |-----------------------------------------------|----------|
 *  | No active state (transition from disabled)    | true     |
 *  | Already in booking flow (form/follow visible) | false    |
 *  | Booking waiting                               | false    |
 *  | Booking succeeded                             | false    |
 */

import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const FollowFlow = require('../../scripts/follow-flow.js');

const { computeFollowFlowVisibility, shouldRestoreFollowFlow } = FollowFlow;

// ─────────────────────────────────────────────────────────────────────────────
describe('Feature: Follow flow widget visibility', () => {

  // ── First visit ────────────────────────────────────────────────────────────
  describe('Scenario: First visit – user has never followed', () => {
    const state = computeFollowFlowVisibility({ followedAtPageLoad: false, followedInSession: false });

    it('should show the steps widget', () => {
      expect(state.showSteps).toBe(true);
    });

    it('should show the Follow box (step 1)', () => {
      expect(state.showFollowBox).toBe(true);
    });

    it('should not show the booking form yet', () => {
      expect(state.showForm).toBe(false);
    });

    it('should set active step to 1', () => {
      expect(state.activeStep).toBe(1);
    });
  });

  // ── Follow clicked in session ──────────────────────────────────────────────
  describe('Scenario: User clicks Follow without reloading the page', () => {
    const state = computeFollowFlowVisibility({ followedAtPageLoad: false, followedInSession: true });

    it('should keep the steps widget visible', () => {
      expect(state.showSteps).toBe(true);
    });

    it('should hide the Follow box (step 1 is done)', () => {
      expect(state.showFollowBox).toBe(false);
    });

    it('should show the booking form (step 2)', () => {
      expect(state.showForm).toBe(true);
    });

    it('should set active step to 2', () => {
      expect(state.activeStep).toBe(2);
    });
  });

  // ── Reload after follow ────────────────────────────────────────────────────
  describe('Scenario: Page reload after following (cookie already present)', () => {
    const state = computeFollowFlowVisibility({ followedAtPageLoad: true, followedInSession: false });

    it('should hide the steps widget (follow step already completed)', () => {
      expect(state.showSteps).toBe(false);
    });

    it('should hide the Follow box', () => {
      expect(state.showFollowBox).toBe(false);
    });

    it('should show the booking form directly', () => {
      expect(state.showForm).toBe(true);
    });
  });

  // ── Reload without follow ─────────────────────────────────────────────────
  describe('Scenario: Page reload without having followed (returning visitor)', () => {
    const state = computeFollowFlowVisibility({ followedAtPageLoad: false, followedInSession: false });

    it('should show the steps widget', () => {
      expect(state.showSteps).toBe(true);
    });

    it('should show the Follow box again', () => {
      expect(state.showFollowBox).toBe(true);
    });

    it('should not show the booking form', () => {
      expect(state.showForm).toBe(false);
    });
  });

  // ── Precedence ────────────────────────────────────────────────────────────
  describe('Scenario: followedAtPageLoad takes precedence over followedInSession', () => {
    const state = computeFollowFlowVisibility({ followedAtPageLoad: true, followedInSession: true });

    it('should hide the steps widget (cookie-based state wins)', () => {
      expect(state.showSteps).toBe(false);
    });

    it('should show the booking form', () => {
      expect(state.showForm).toBe(true);
    });

    it('should hide the Follow box', () => {
      expect(state.showFollowBox).toBe(false);
    });
  });

  // ── Complete matrix ────────────────────────────────────────────────────────
  describe('Complete visibility matrix', () => {
    const cases = [
      // [label, params, expected]
      [
        'never followed',
        { followedAtPageLoad: false, followedInSession: false },
        { showSteps: true, showFollowBox: true, showForm: false, activeStep: 1 },
      ],
      [
        'followed in session',
        { followedAtPageLoad: false, followedInSession: true },
        { showSteps: true, showFollowBox: false, showForm: true, activeStep: 2 },
      ],
      [
        'followed at page load',
        { followedAtPageLoad: true, followedInSession: false },
        { showSteps: false, showFollowBox: false, showForm: true, activeStep: 0 },
      ],
      [
        'both true (atPageLoad wins)',
        { followedAtPageLoad: true, followedInSession: true },
        { showSteps: false, showFollowBox: false, showForm: true, activeStep: 0 },
      ],
    ];

    it.each(cases)('%s', (_label, params, expected) => {
      expect(computeFollowFlowVisibility(params)).toEqual(expected);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Feature: Restore follow flow guard', () => {

  // ── No active state ────────────────────────────────────────────────────────
  describe('Scenario: No active state – transitioning from bookings-disabled to open', () => {
    it('should restore the follow flow', () => {
      expect(shouldRestoreFollowFlow({ isWaiting: false, isSuccess: false, isInBookingFlow: false })).toBe(true);
    });

    it('should restore when called with no arguments', () => {
      expect(shouldRestoreFollowFlow()).toBe(true);
    });
  });

  // ── Already in booking flow ────────────────────────────────────────────────
  describe('Scenario: User already in booking flow (form or Follow box visible)', () => {
    it('should not restore – prevents the widget from flickering back', () => {
      expect(shouldRestoreFollowFlow({ isWaiting: false, isSuccess: false, isInBookingFlow: true })).toBe(false);
    });
  });

  // ── Booking waiting ────────────────────────────────────────────────────────
  describe('Scenario: Booking is in waiting state', () => {
    it('should not restore – user is waiting for approval', () => {
      expect(shouldRestoreFollowFlow({ isWaiting: true, isSuccess: false, isInBookingFlow: false })).toBe(false);
    });
  });

  // ── Booking succeeded ──────────────────────────────────────────────────────
  describe('Scenario: Booking succeeded', () => {
    it('should not restore – user has completed the flow', () => {
      expect(shouldRestoreFollowFlow({ isWaiting: false, isSuccess: true, isInBookingFlow: false })).toBe(false);
    });
  });

  // ── Pending booking (priority handed to checkPendingBooking) ──────────────
  describe('Scenario: Pending booking detected during realtime refresh', () => {
    it('shouldRestoreFollowFlow returns true but checkPendingBooking in index.html takes over', () => {
      // shouldRestoreFollowFlow is unaware of pending bookings; it returns true
      // so that index.html calls the serata-state logic, which then delegates to
      // checkPendingBooking() before deciding whether to show the form.
      expect(shouldRestoreFollowFlow({ isWaiting: false, isSuccess: false, isInBookingFlow: false })).toBe(true);
    });
  });
});
