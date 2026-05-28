/**
 * tests/unit/follow-flow.test.js
 *
 * Unit tests for scripts/follow-flow.js.
 *
 * Focus areas:
 *   - computeFollowFlowVisibility – return shape, all branches, parameter coercions
 *   - shouldRestoreFollowFlow     – all flag combinations, parameter coercions
 *   - shouldShowVoteLink          – vote link visibility rules
 */

import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const FollowFlow = require('../../scripts/follow-flow.js');

const { computeFollowFlowVisibility, shouldRestoreFollowFlow, shouldShowVoteLink } = FollowFlow;

// ─────────────────────────────────────────────────────────────────────────────
describe('computeFollowFlowVisibility – return shape', () => {

  it('always returns an object with showSteps, showFollowBox, showForm and activeStep', () => {
    const cases = [
      {},
      { followedAtPageLoad: false, followedInSession: false },
      { followedAtPageLoad: true,  followedInSession: false },
      { followedAtPageLoad: false, followedInSession: true  },
      { followedAtPageLoad: true,  followedInSession: true  },
    ];
    for (const params of cases) {
      const s = computeFollowFlowVisibility(params);
      expect(typeof s.showSteps).toBe('boolean');
      expect(typeof s.showFollowBox).toBe('boolean');
      expect(typeof s.showForm).toBe('boolean');
      expect(typeof s.activeStep).toBe('number');
    }
  });

  it('returns valid output with no arguments', () => {
    const s = computeFollowFlowVisibility();
    expect(s).toHaveProperty('showSteps');
    expect(s).toHaveProperty('showFollowBox');
    expect(s).toHaveProperty('showForm');
    expect(s).toHaveProperty('activeStep');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('computeFollowFlowVisibility – branch: never followed (both false)', () => {

  it('showSteps = true', () => {
    expect(computeFollowFlowVisibility({ followedAtPageLoad: false, followedInSession: false }).showSteps).toBe(true);
  });

  it('showFollowBox = true', () => {
    expect(computeFollowFlowVisibility({ followedAtPageLoad: false, followedInSession: false }).showFollowBox).toBe(true);
  });

  it('showForm = false', () => {
    expect(computeFollowFlowVisibility({ followedAtPageLoad: false, followedInSession: false }).showForm).toBe(false);
  });

  it('activeStep = 1', () => {
    expect(computeFollowFlowVisibility({ followedAtPageLoad: false, followedInSession: false }).activeStep).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('computeFollowFlowVisibility – branch: followed in session (followedInSession=true)', () => {

  it('showSteps = true', () => {
    expect(computeFollowFlowVisibility({ followedAtPageLoad: false, followedInSession: true }).showSteps).toBe(true);
  });

  it('showFollowBox = false', () => {
    expect(computeFollowFlowVisibility({ followedAtPageLoad: false, followedInSession: true }).showFollowBox).toBe(false);
  });

  it('showForm = true', () => {
    expect(computeFollowFlowVisibility({ followedAtPageLoad: false, followedInSession: true }).showForm).toBe(true);
  });

  it('activeStep = 2', () => {
    expect(computeFollowFlowVisibility({ followedAtPageLoad: false, followedInSession: true }).activeStep).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('computeFollowFlowVisibility – branch: followed at page load (followedAtPageLoad=true)', () => {

  it('showSteps = false', () => {
    expect(computeFollowFlowVisibility({ followedAtPageLoad: true, followedInSession: false }).showSteps).toBe(false);
  });

  it('showFollowBox = false', () => {
    expect(computeFollowFlowVisibility({ followedAtPageLoad: true, followedInSession: false }).showFollowBox).toBe(false);
  });

  it('showForm = true', () => {
    expect(computeFollowFlowVisibility({ followedAtPageLoad: true, followedInSession: false }).showForm).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('computeFollowFlowVisibility – followedAtPageLoad precedence over followedInSession', () => {

  it('when both true: showSteps = false (atPageLoad wins)', () => {
    expect(computeFollowFlowVisibility({ followedAtPageLoad: true, followedInSession: true }).showSteps).toBe(false);
  });

  it('when both true: showForm = true', () => {
    expect(computeFollowFlowVisibility({ followedAtPageLoad: true, followedInSession: true }).showForm).toBe(true);
  });

  it('when both true: showFollowBox = false', () => {
    expect(computeFollowFlowVisibility({ followedAtPageLoad: true, followedInSession: true }).showFollowBox).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('computeFollowFlowVisibility – parameter coercions', () => {

  it('undefined params → same as both false', () => {
    expect(computeFollowFlowVisibility()).toEqual(
      computeFollowFlowVisibility({ followedAtPageLoad: false, followedInSession: false })
    );
  });

  it('null params → same as both false', () => {
    expect(computeFollowFlowVisibility(null)).toEqual(
      computeFollowFlowVisibility({ followedAtPageLoad: false, followedInSession: false })
    );
  });

  it('truthy non-boolean followedAtPageLoad (1) treated as true', () => {
    expect(computeFollowFlowVisibility({ followedAtPageLoad: 1, followedInSession: false }).showSteps).toBe(false);
  });

  it('truthy non-boolean followedInSession ("yes") treated as true', () => {
    expect(computeFollowFlowVisibility({ followedAtPageLoad: false, followedInSession: 'yes' }).showFollowBox).toBe(false);
  });

  it('falsy non-boolean followedAtPageLoad (0) treated as false', () => {
    expect(computeFollowFlowVisibility({ followedAtPageLoad: 0, followedInSession: false }).showSteps).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('shouldRestoreFollowFlow – all flag combinations', () => {

  it('all false → restore (returns true)', () => {
    expect(shouldRestoreFollowFlow({ isWaiting: false, isSuccess: false, isInBookingFlow: false })).toBe(true);
  });

  it('isWaiting=true → do not restore', () => {
    expect(shouldRestoreFollowFlow({ isWaiting: true, isSuccess: false, isInBookingFlow: false })).toBe(false);
  });

  it('isSuccess=true → do not restore', () => {
    expect(shouldRestoreFollowFlow({ isWaiting: false, isSuccess: true, isInBookingFlow: false })).toBe(false);
  });

  it('isInBookingFlow=true → do not restore', () => {
    expect(shouldRestoreFollowFlow({ isWaiting: false, isSuccess: false, isInBookingFlow: true })).toBe(false);
  });

  it('isWaiting=true and isSuccess=true → do not restore', () => {
    expect(shouldRestoreFollowFlow({ isWaiting: true, isSuccess: true, isInBookingFlow: false })).toBe(false);
  });

  it('all true → do not restore', () => {
    expect(shouldRestoreFollowFlow({ isWaiting: true, isSuccess: true, isInBookingFlow: true })).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('shouldRestoreFollowFlow – parameter coercions', () => {

  it('undefined params → restore (returns true)', () => {
    expect(shouldRestoreFollowFlow()).toBe(true);
  });

  it('null params → restore (returns true)', () => {
    expect(shouldRestoreFollowFlow(null)).toBe(true);
  });

  it('truthy non-boolean isWaiting (1) → do not restore', () => {
    expect(shouldRestoreFollowFlow({ isWaiting: 1 })).toBe(false);
  });

  it('falsy non-boolean isWaiting (0) → restore', () => {
    expect(shouldRestoreFollowFlow({ isWaiting: 0 })).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('shouldShowVoteLink – vote visibility', () => {

  it('shows vote link when voteOpen=true', () => {
    expect(shouldShowVoteLink({ voteOpen: true })).toBe(true);
  });

  it('hides vote link when voteOpen=false', () => {
    expect(shouldShowVoteLink({ voteOpen: false })).toBe(false);
  });
});
