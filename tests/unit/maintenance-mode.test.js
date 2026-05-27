// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const STORAGE_KEY = 'sb-example-auth-token';

function buildSupabaseMock({ manutenzioneAbilitata = true } = {}) {
  // Dopo il fix il riconoscimento NON usa più getSession: legge il token
  // direttamente dallo storage. Al client serve solo la query impostazioni.
  const createClient = vi.fn(() => ({
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
  }));
  return { createClient };
}

function storeSession(storage, token, key = STORAGE_KEY) {
  storage.setItem(key, JSON.stringify({
    access_token: token,
    refresh_token: `refresh-${token}`,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: { id: `user-${token}` },
  }));
}

beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  delete window.KaraokeMaintenanceMode;
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.CONFIG = {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'anon',
  };
});

describe('KaraokeMaintenanceMode.getAccessState', () => {
  it('riconosce admin da token in localStorage', async () => {
    window.supabase = buildSupabaseMock();
    storeSession(window.localStorage, 'local-token');
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

  it('riconosce admin da token in sessionStorage quando localStorage è vuoto', async () => {
    window.supabase = buildSupabaseMock();
    storeSession(window.sessionStorage, 'session-token');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { ok: true } }),
    });
    await import('../../scripts/maintenance-mode.js');

    const state = await window.KaraokeMaintenanceMode.getAccessState(window.CONFIG);

    expect(state.isAuthenticated).toBe(true);
    expect(state.isAdmin).toBe(true);
    const [, fetchOptions] = global.fetch.mock.calls[0];
    expect(fetchOptions.headers.get('Authorization')).toContain('session-token');
  });

  it('utente non loggato: nessun token in storage => non autenticato, niente ping', async () => {
    window.supabase = buildSupabaseMock();
    global.fetch = vi.fn();
    await import('../../scripts/maintenance-mode.js');

    const state = await window.KaraokeMaintenanceMode.getAccessState(window.CONFIG);

    expect(state.isAuthenticated).toBe(false);
    expect(state.isAdmin).toBe(false);
    expect(state.settings?.manutenzione_abilitata).toBe(true);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('prova i token successivi se il primo non è admin', async () => {
    window.supabase = buildSupabaseMock();
    storeSession(window.localStorage, 'stale-token');
    storeSession(window.sessionStorage, 'admin-token');
    global.fetch = vi.fn().mockImplementation(async (_url, options) => {
      const authHeader = options?.headers?.get?.('Authorization') || '';
      if (authHeader.includes('admin-token')) {
        return { ok: true, json: async () => ({ success: true, data: { ok: true } }) };
      }
      return { ok: false, json: async () => ({ success: false }) };
    });
    await import('../../scripts/maintenance-mode.js');

    const state = await window.KaraokeMaintenanceMode.getAccessState(window.CONFIG);

    expect(state.isAuthenticated).toBe(true);
    expect(state.isAdmin).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('legge la sessione anche se suddivisa in chunk con prefisso base64', async () => {
    window.supabase = buildSupabaseMock();
    const sessionJson = JSON.stringify({
      access_token: 'chunky-token',
      refresh_token: 'r',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    });
    const encoded = `base64-${btoa(sessionJson)}`;
    const mid = Math.ceil(encoded.length / 2);
    window.localStorage.setItem(`${STORAGE_KEY}.0`, encoded.slice(0, mid));
    window.localStorage.setItem(`${STORAGE_KEY}.1`, encoded.slice(mid));
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { ok: true } }),
    });
    await import('../../scripts/maintenance-mode.js');

    const state = await window.KaraokeMaintenanceMode.getAccessState(window.CONFIG);

    expect(state.isAdmin).toBe(true);
    const [, fetchOptions] = global.fetch.mock.calls[0];
    expect(fetchOptions.headers.get('Authorization')).toContain('chunky-token');
  });
});
