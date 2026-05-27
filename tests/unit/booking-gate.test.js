// @vitest-environment jsdom
/**
 * tests/unit/booking-gate.test.js
 *
 * Unit tests for scripts/booking-gate.js (KaraokeBookingGate.createBookingGate).
 *
 * Uses jsdom environment so that `window` and `document` are available,
 * matching the browser context that booking-gate.js expects.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Helpers to build a minimal fake modal ────────────────────────────────────

function makeButton(label) {
  const listeners = {};
  return {
    _label: label,
    addEventListener(event, fn) {
      listeners[event] = listeners[event] || [];
      listeners[event].push(fn);
    },
    removeEventListener(event, fn) {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter(h => h !== fn);
      }
    },
    click() {
      (listeners['click'] || []).forEach(fn => fn());
    },
  };
}

function makeModal() {
  const classList = new Set();
  const listeners = {};
  const cancelBtn   = makeButton('cancel');
  const continueBtn = makeButton('continue');
  const messageEl = { textContent: '' };
  const adEl = { innerHTML: '', appendChild(child) { this.innerHTML = child.className || child.textContent; } };

  const modal = {
    classList: {
      add(cls)    { classList.add(cls); },
      remove(cls) { classList.delete(cls); },
      has(cls)    { return classList.has(cls); },
    },
    addEventListener(event, fn) {
      listeners[event] = listeners[event] || [];
      listeners[event].push(fn);
    },
    removeEventListener(event, fn) {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter(h => h !== fn);
      }
    },
    querySelector(sel) {
      if (sel === '[data-booking-gate-message]') return messageEl;
      if (sel === '[data-booking-gate-ad]')      return adEl;
      if (sel === '[data-booking-gate-action="cancel"]')   return cancelBtn;
      if (sel === '[data-booking-gate-action="continue"]') return continueBtn;
      return null;
    },
    clickBackdrop() {
      (listeners['click'] || []).forEach(fn => fn({ target: modal }));
    },
    cancelBtn,
    continueBtn,
    messageEl,
    adEl,
  };

  return modal;
}

// ── Module loading ───────────────────────────────────────────────────────────

let KaraokeBookingGate;

beforeEach(async () => {
  // Re-execute the IIFE on each test so we always get a fresh module state.
  vi.resetModules();
  await import('../../scripts/booking-gate.js');
  KaraokeBookingGate = window.KaraokeBookingGate;
});

// ─────────────────────────────────────────────────────────────────────────────
describe('createBookingGate', () => {

  describe('requestConfirmation – policy.requireBeforeBooking is false', () => {
    it('resolves to true immediately without opening the modal', async () => {
      const modal = makeModal();
      const gate = KaraokeBookingGate.createBookingGate({ modalEl: modal });
      const result = await gate.requestConfirmation({ requireBeforeBooking: false });
      expect(result).toBe(true);
      expect(modal.classList.has('open')).toBe(false);
    });

    it('resolves to true when policy is null', async () => {
      const gate = KaraokeBookingGate.createBookingGate({ modalEl: makeModal() });
      expect(await gate.requestConfirmation(null)).toBe(true);
    });

    it('resolves to true when policy is undefined', async () => {
      const gate = KaraokeBookingGate.createBookingGate({ modalEl: makeModal() });
      expect(await gate.requestConfirmation(undefined)).toBe(true);
    });
  });

  describe('requestConfirmation – modal elements missing', () => {
    it('resolves to true when no modalEl is provided', async () => {
      const gate = KaraokeBookingGate.createBookingGate({});
      expect(await gate.requestConfirmation({ requireBeforeBooking: true })).toBe(true);
    });
  });

  describe('requestConfirmation – modal shown, user interacts', () => {
    it('opens the modal when requireBeforeBooking is true', async () => {
      const modal = makeModal();
      const gate = KaraokeBookingGate.createBookingGate({
        modalEl: modal,
        renderAdContent: () => {},
      });
      const promise = gate.requestConfirmation({ requireBeforeBooking: true });
      expect(modal.classList.has('open')).toBe(true);
      modal.continueBtn.click();
      await promise;
    });

    it('resolves to true when the continue button is clicked', async () => {
      const modal = makeModal();
      const gate  = KaraokeBookingGate.createBookingGate({
        modalEl: modal,
        renderAdContent: () => {},
      });
      const promise = gate.requestConfirmation({ requireBeforeBooking: true });
      modal.continueBtn.click();
      expect(await promise).toBe(true);
    });

    it('removes the open class after continue', async () => {
      const modal = makeModal();
      const gate  = KaraokeBookingGate.createBookingGate({
        modalEl: modal,
        renderAdContent: () => {},
      });
      const promise = gate.requestConfirmation({ requireBeforeBooking: true });
      modal.continueBtn.click();
      await promise;
      expect(modal.classList.has('open')).toBe(false);
    });

    it('resolves to false when the cancel button is clicked', async () => {
      const modal = makeModal();
      const gate  = KaraokeBookingGate.createBookingGate({
        modalEl: modal,
        renderAdContent: () => {},
      });
      const promise = gate.requestConfirmation({ requireBeforeBooking: true });
      modal.cancelBtn.click();
      expect(await promise).toBe(false);
    });

    it('resolves to false when the backdrop is clicked', async () => {
      const modal = makeModal();
      const gate  = KaraokeBookingGate.createBookingGate({
        modalEl: modal,
        renderAdContent: () => {},
      });
      const promise = gate.requestConfirmation({ requireBeforeBooking: true });
      modal.clickBackdrop();
      expect(await promise).toBe(false);
    });

    it('sets the message for adsense provider', async () => {
      const modal = makeModal();
      const gate  = KaraokeBookingGate.createBookingGate({
        modalEl: modal,
        renderAdContent: () => {},
      });
      const promise = gate.requestConfirmation({ requireBeforeBooking: true, provider: 'adsense' });
      expect(modal.messageEl.textContent).toContain('AdSense');
      modal.cancelBtn.click();
      await promise;
    });

    it('sets the message for non-adsense provider', async () => {
      const modal = makeModal();
      const gate  = KaraokeBookingGate.createBookingGate({
        modalEl: modal,
        renderAdContent: () => {},
      });
      const promise = gate.requestConfirmation({ requireBeforeBooking: true, provider: 'custom' });
      expect(modal.messageEl.textContent).toContain('sponsor breve');
      modal.cancelBtn.click();
      await promise;
    });

    it('calls renderAdContent when provided', async () => {
      const modal = makeModal();
      const renderAdContent = vi.fn();
      const policy = { requireBeforeBooking: true, provider: 'adsense' };
      const gate = KaraokeBookingGate.createBookingGate({ modalEl: modal, renderAdContent });
      const promise = gate.requestConfirmation(policy);
      expect(renderAdContent).toHaveBeenCalledWith(modal.adEl, policy);
      modal.continueBtn.click();
      await promise;
    });

    it('renders a fallback ad-placeholder when renderAdContent is absent', async () => {
      const modal = makeModal();
      const gate  = KaraokeBookingGate.createBookingGate({ modalEl: modal });
      const promise = gate.requestConfirmation({ requireBeforeBooking: true });
      // booking-gate.js creates a div.ads-placeholder via document.createElement
      // and appends it; our fake adEl.appendChild records child.className.
      expect(modal.adEl.innerHTML).toContain('ads-placeholder');
      modal.cancelBtn.click();
      await promise;
    });
  });
});

