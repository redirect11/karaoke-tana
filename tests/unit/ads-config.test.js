// @vitest-environment jsdom
/**
 * tests/unit/ads-config.test.js
 *
 * Unit tests for scripts/ads-config.js (window.KaraokeAdsConfig).
 *
 * The module exposes buildPolicy() and createPolicyStore(), pure-ish helpers
 * used to normalize the ads configuration (ADS_ENABLED / ADS_MODE /
 * ADS_PROVIDER / AdSense ids / ADS_REQUIRE_BEFORE_BOOKING) into a stable
 * policy object consumed by the banner/booking-gate code.
 *
 * Uses jsdom because ads-config.js is an IIFE attached to `window`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

let KaraokeAdsConfig;

beforeEach(async () => {
  vi.resetModules();
  delete window.KaraokeAdsConfig;
  await import('../../scripts/ads-config.js');
  KaraokeAdsConfig = window.KaraokeAdsConfig;
});

describe('buildPolicy', () => {
  describe('defaults / safe fallbacks', () => {
    it('returns a disabled policy when no config is provided', () => {
      const p = KaraokeAdsConfig.buildPolicy();
      expect(p.enabled).toBe(false);
      expect(p.mode).toBe('off');
      expect(p.provider).toBe('none');
      expect(p.intrusive).toBe(false);
      expect(p.bannerEnabled).toBe(false);
      expect(p.requireBeforeBooking).toBe(false);
      expect(p.adsenseReady).toBe(false);
      expect(p.adsenseClientId).toBe('');
      expect(p.adsenseBannerSlot).toBe('');
    });

    it('falls back to off/none for invalid mode/provider values', () => {
      const p = KaraokeAdsConfig.buildPolicy({ ADS_MODE: 'banana', ADS_PROVIDER: 'spam' });
      expect(p.mode).toBe('off');
      expect(p.provider).toBe('none');
    });

    it('exposes the merged raw config', () => {
      const p = KaraokeAdsConfig.buildPolicy({ ADS_ENABLED: true }, { ADS_MODE: 'soft' });
      expect(p.raw).toMatchObject({ ADS_ENABLED: true, ADS_MODE: 'soft' });
    });
  });

  describe('ADS_ENABLED boolean normalization', () => {
    it.each([
      [true, true],
      ['true', true],
      ['1', true],
      ['yes', true],
      ['on', true],
      [1, true],
      [false, false],
      ['false', false],
      ['0', false],
      ['no', false],
      ['off', false],
      [0, false],
      ['weird', false],
    ])('normalizes ADS_ENABLED=%p to %p', (input, expected) => {
      const p = KaraokeAdsConfig.buildPolicy({ ADS_ENABLED: input });
      expect(p.enabled).toBe(expected);
    });
  });

  describe('bannerEnabled', () => {
    it('is false when enabled but mode is off', () => {
      const p = KaraokeAdsConfig.buildPolicy({ ADS_ENABLED: true, ADS_MODE: 'off' });
      expect(p.bannerEnabled).toBe(false);
    });

    it('is false when mode is soft but ads are disabled', () => {
      const p = KaraokeAdsConfig.buildPolicy({ ADS_ENABLED: false, ADS_MODE: 'soft' });
      expect(p.bannerEnabled).toBe(false);
    });

    it('is true when enabled and mode is soft', () => {
      const p = KaraokeAdsConfig.buildPolicy({ ADS_ENABLED: true, ADS_MODE: 'soft' });
      expect(p.bannerEnabled).toBe(true);
      expect(p.intrusive).toBe(false);
    });

    it('is true and intrusive when enabled and mode is intrusive', () => {
      const p = KaraokeAdsConfig.buildPolicy({ ADS_ENABLED: true, ADS_MODE: 'intrusive' });
      expect(p.bannerEnabled).toBe(true);
      expect(p.intrusive).toBe(true);
    });
  });

  describe('requireBeforeBooking', () => {
    it('is false when the banner is not enabled even if the flag is set', () => {
      const p = KaraokeAdsConfig.buildPolicy({ ADS_REQUIRE_BEFORE_BOOKING: true });
      expect(p.bannerEnabled).toBe(false);
      expect(p.requireBeforeBooking).toBe(false);
    });

    it('is true only when banner enabled and flag set', () => {
      const p = KaraokeAdsConfig.buildPolicy({
        ADS_ENABLED: true,
        ADS_MODE: 'soft',
        ADS_REQUIRE_BEFORE_BOOKING: 'true',
      });
      expect(p.requireBeforeBooking).toBe(true);
    });
  });

  describe('adsenseReady', () => {
    it('is false when provider is adsense but ids are missing', () => {
      const p = KaraokeAdsConfig.buildPolicy({
        ADS_ENABLED: true,
        ADS_MODE: 'soft',
        ADS_PROVIDER: 'adsense',
      });
      expect(p.adsenseReady).toBe(false);
    });

    it('is false when only the client id is present', () => {
      const p = KaraokeAdsConfig.buildPolicy({
        ADS_PROVIDER: 'adsense',
        ADSENSE_CLIENT_ID: 'ca-pub-123',
      });
      expect(p.adsenseReady).toBe(false);
    });

    it('is true when provider is adsense and both ids are present', () => {
      const p = KaraokeAdsConfig.buildPolicy({
        ADS_PROVIDER: 'adsense',
        ADSENSE_CLIENT_ID: '  ca-pub-123  ',
        ADSENSE_BANNER_SLOT: ' 999 ',
      });
      expect(p.adsenseReady).toBe(true);
      expect(p.adsenseClientId).toBe('ca-pub-123');
      expect(p.adsenseBannerSlot).toBe('999');
    });

    it('is false when ids are present but provider is custom', () => {
      const p = KaraokeAdsConfig.buildPolicy({
        ADS_PROVIDER: 'custom',
        ADSENSE_CLIENT_ID: 'ca-pub-123',
        ADSENSE_BANNER_SLOT: '999',
      });
      expect(p.adsenseReady).toBe(false);
      expect(p.provider).toBe('custom');
    });
  });

  describe('overrides precedence', () => {
    it('lets overrides win over the base config', () => {
      const p = KaraokeAdsConfig.buildPolicy(
        { ADS_ENABLED: true, ADS_MODE: 'soft' },
        { ADS_MODE: 'intrusive' },
      );
      expect(p.mode).toBe('intrusive');
      expect(p.intrusive).toBe(true);
    });
  });
});

describe('createPolicyStore', () => {
  it('returns the base policy when no overrides are set', () => {
    const store = KaraokeAdsConfig.createPolicyStore({ ADS_ENABLED: true, ADS_MODE: 'soft' });
    expect(store.getPolicy().mode).toBe('soft');
  });

  it('merges successive runtime overrides', () => {
    const store = KaraokeAdsConfig.createPolicyStore({ ADS_ENABLED: true, ADS_MODE: 'soft' });
    store.setRuntimeOverrides({ ADS_MODE: 'intrusive' });
    store.setRuntimeOverrides({ ADS_REQUIRE_BEFORE_BOOKING: true });
    const p = store.getPolicy();
    expect(p.mode).toBe('intrusive');
    expect(p.requireBeforeBooking).toBe(true);
  });

  it('returns the updated policy from setRuntimeOverrides', () => {
    const store = KaraokeAdsConfig.createPolicyStore({ ADS_ENABLED: true, ADS_MODE: 'soft' });
    const p = store.setRuntimeOverrides({ ADS_MODE: 'off' });
    expect(p.bannerEnabled).toBe(false);
  });

  it('clearRuntimeOverrides restores the base policy', () => {
    const store = KaraokeAdsConfig.createPolicyStore({ ADS_ENABLED: true, ADS_MODE: 'soft' });
    store.setRuntimeOverrides({ ADS_MODE: 'intrusive' });
    const p = store.clearRuntimeOverrides();
    expect(p.mode).toBe('soft');
  });
});
