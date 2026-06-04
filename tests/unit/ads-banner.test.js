// @vitest-environment jsdom
/**
 * tests/unit/ads-banner.test.js
 *
 * Unit tests for scripts/ads-banner.js (window.KaraokeAdsBanner).
 *
 * Covers renderBanner() and renderInlineAd(): how a normalized ads policy
 * (see scripts/ads-config.js) is turned into DOM, including the safe
 * placeholder fallbacks when the provider is missing/incomplete and the
 * `ads-intrusive-active` body class toggling.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let KaraokeAdsBanner;

beforeEach(async () => {
  vi.resetModules();
  delete window.KaraokeAdsBanner;
  delete window.adsbygoogle;
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  document.body.className = '';
  await import('../../scripts/ads-banner.js');
  KaraokeAdsBanner = window.KaraokeAdsBanner;
});

afterEach(() => {
  vi.restoreAllMocks();
});

function makeContainer() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

describe('renderBanner', () => {
  it('does nothing and is safe when container is missing', () => {
    expect(() => KaraokeAdsBanner.renderBanner(null, { bannerEnabled: true })).not.toThrow();
  });

  it('clears the container and removes intrusive class when banner disabled', () => {
    document.body.classList.add('ads-intrusive-active');
    const container = makeContainer();
    container.innerHTML = '<span>old</span>';
    KaraokeAdsBanner.renderBanner(container, { bannerEnabled: false });
    expect(container.innerHTML).toBe('');
    expect(document.body.classList.contains('ads-intrusive-active')).toBe(false);
  });

  it('treats a null policy as disabled', () => {
    const container = makeContainer();
    KaraokeAdsBanner.renderBanner(container, null);
    expect(container.querySelector('.ads-banner')).toBeNull();
  });

  it('renders a soft banner with sponsor label and no intrusive body class', () => {
    const container = makeContainer();
    KaraokeAdsBanner.renderBanner(container, {
      bannerEnabled: true,
      mode: 'soft',
      intrusive: false,
      provider: 'none',
    });
    const banner = container.querySelector('aside.ads-banner');
    expect(banner).not.toBeNull();
    expect(banner.classList.contains('ads-banner--soft')).toBe(true);
    expect(container.querySelector('.ads-banner-label').textContent).toBe('Sponsor');
    expect(document.body.classList.contains('ads-intrusive-active')).toBe(false);
  });

  it('adds the intrusive body class for an intrusive banner', () => {
    const container = makeContainer();
    KaraokeAdsBanner.renderBanner(container, {
      bannerEnabled: true,
      mode: 'intrusive',
      intrusive: true,
      provider: 'none',
    });
    expect(container.querySelector('.ads-banner--intrusive')).not.toBeNull();
    expect(document.body.classList.contains('ads-intrusive-active')).toBe(true);
  });

  it('renders a generic placeholder when provider is none', () => {
    const container = makeContainer();
    KaraokeAdsBanner.renderBanner(container, {
      bannerEnabled: true,
      mode: 'soft',
      provider: 'none',
    });
    const placeholder = container.querySelector('.ads-placeholder');
    expect(placeholder).not.toBeNull();
    expect(placeholder.textContent).toBe('Supporta Karaoke Tana');
  });

  it('renders a custom placeholder for the custom provider', () => {
    const container = makeContainer();
    KaraokeAdsBanner.renderBanner(container, {
      bannerEnabled: true,
      mode: 'soft',
      provider: 'custom',
    });
    expect(container.querySelector('.ads-placeholder').textContent)
      .toBe('Spazio sponsor personalizzato');
  });
});

describe('renderBanner – adsense provider', () => {
  it('renders a placeholder when AdSense is not ready', () => {
    const container = makeContainer();
    KaraokeAdsBanner.renderBanner(container, {
      bannerEnabled: true,
      mode: 'soft',
      provider: 'adsense',
      adsenseReady: false,
    });
    expect(container.querySelector('.ads-placeholder').textContent)
      .toContain('configurazione AdSense incompleta');
    expect(window.adsbygoogle).toBeUndefined();
  });

  it('injects the AdSense script and slot when ready', () => {
    const container = makeContainer();
    KaraokeAdsBanner.renderBanner(container, {
      bannerEnabled: true,
      mode: 'soft',
      provider: 'adsense',
      adsenseReady: true,
      adsenseClientId: 'ca-pub-123',
      adsenseBannerSlot: '999',
    });
    const slot = container.querySelector('ins.adsbygoogle');
    expect(slot).not.toBeNull();
    expect(slot.getAttribute('data-ad-client')).toBe('ca-pub-123');
    expect(slot.getAttribute('data-ad-slot')).toBe('999');
    const script = document.head.querySelector('script[data-karaoke-adsense-client]');
    expect(script).not.toBeNull();
    expect(Array.isArray(window.adsbygoogle)).toBe(true);
    expect(window.adsbygoogle.length).toBe(1);
  });
});

describe('renderInlineAd', () => {
  it('replaces existing content with a placeholder for provider none', () => {
    const container = makeContainer();
    container.innerHTML = '<span>old</span>';
    KaraokeAdsBanner.renderInlineAd(container, { provider: 'none' });
    expect(container.querySelector('span')).toBeNull();
    expect(container.querySelector('.ads-placeholder')).not.toBeNull();
  });
});
