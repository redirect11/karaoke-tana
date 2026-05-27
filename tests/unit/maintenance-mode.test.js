// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

function buildSupabaseMock({ localToken = null, sessionToken = null, fallbackToken = null, manutenzioneAbilitata = true } = {}) {
  const createClient = vi.fn((_url, _key, options) => {
    const storage = options?.auth?.storage;
    let token = fallbackToken;
    if (storage === window.localStorage) token = localToken;
    if (storage === window.sessionStorage) token = sessionToken;
    return {
      from() {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { manutenzione_abilitata: manutenzioneAbilitata },
                  }),
                };
              },
            };
          },
        };
      },
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: token ? { session: { access_token: token } } : { session: null },
        }),
      },
    };
  });
  return { createClient };
}

beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  delete window.KaraokeMaintenanceMode;
  window.CONFIG = {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'anon',
  };
});

describe('KaraokeMaintenanceMode.getAccessState', () => {
  it('riconosce admin da token in localStorage', async () => {
    window.supabase = buildSupabaseMock({ localToken: 'local-token' });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { ok: true } }),
    });
    await import('../../scripts/maintenance-mode.js');

    const state = await window.KaraokeMaintenanceMode.getAccessState(window.CONFIG);

    expect(state.isAuthenticated).toBe(true);
    expect(state.isAdmin).toBe(true);
    expect(state.settings?.manutenzione_abilitata).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [, fetchOptions] = global.fetch.mock.calls[0];
    expect(fetchOptions.headers.get('Authorization')).toContain('local-token');
  });

  it('fa fallback su sessionStorage quando localStorage non ha sessione', async () => {
    window.supabase = buildSupabaseMock({ localToken: null, sessionToken: 'session-token' });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { ok: true } }),
    });
    await import('../../scripts/maintenance-mode.js');

    const state = await window.KaraokeMaintenanceMode.getAccessState(window.CONFIG);

    expect(state.isAuthenticated).toBe(true);
    expect(state.isAdmin).toBe(true);
    expect(state.settings?.manutenzione_abilitata).toBe(true);
    const [, fetchOptions] = global.fetch.mock.calls[0];
    expect(fetchOptions.headers.get('Authorization')).toContain('session-token');
  });

  it('usa il client di fallback quando localStorage e sessionStorage non hanno token', async () => {
    window.supabase = buildSupabaseMock({ localToken: null, sessionToken: null, fallbackToken: 'fallback-token' });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { ok: true } }),
    });
    await import('../../scripts/maintenance-mode.js');

    const state = await window.KaraokeMaintenanceMode.getAccessState(window.CONFIG);

    expect(state.isAuthenticated).toBe(true);
    expect(state.isAdmin).toBe(true);
    const [, fetchOptions] = global.fetch.mock.calls[0];
    expect(fetchOptions.headers.get('Authorization')).toContain('fallback-token');
  });
});
