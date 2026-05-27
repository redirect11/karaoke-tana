// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const STORAGE_KEY = 'sb-example-auth-token';
const SETTINGS_URL = '/rest/v1/impostazioni_pubbliche';
const PING_URL = '/functions/v1/admin-bookings';

function storeSession(storage, token, key = STORAGE_KEY) {
  storage.setItem(key, JSON.stringify({
    access_token: token,
    refresh_token: `refresh-${token}`,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: { id: `user-${token}` },
  }));
}

// maintenance-mode NON crea client supabase: legge le impostazioni via REST
// e fa il ping all'edge function. Il mock fetch instrada per endpoint.
function installFetch({ manutenzione = true, isAdminFor = () => true } = {}) {
  global.fetch = vi.fn(async (url, options) => {
    const u = String(url);
    if (u.includes(SETTINGS_URL)) {
      return { ok: true, json: async () => ([{ manutenzione_abilitata: manutenzione }]) };
    }
    if (u.includes(PING_URL)) {
      const auth = options?.headers?.get?.('Authorization') || '';
      const ok = isAdminFor(auth);
      return { ok, json: async () => (ok ? { success: true, data: { ok: true } } : { success: false }) };
    }
    return { ok: false, json: async () => ({}) };
  });
}
function pingCalls() {
  return global.fetch.mock.calls.filter((c) => String(c[0]).includes(PING_URL));
}

beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  delete window.KaraokeMaintenanceMode;
  delete window.supabase;
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.CONFIG = {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'anon',
  };
});

describe('KaraokeMaintenanceMode.getAccessState', () => {
  it('non crea alcun client supabase (nessuna istanza GoTrue extra)', async () => {
    window.supabase = { createClient: vi.fn() };
    storeSession(window.localStorage, 'local-token');
    installFetch();
    await import('../../scripts/maintenance-mode.js');

    await window.KaraokeMaintenanceMode.getAccessState(window.CONFIG);

    expect(window.supabase.createClient).not.toHaveBeenCalled();
  });

  it('riconosce admin da token in localStorage', async () => {
    storeSession(window.localStorage, 'local-token');
    installFetch();
    await import('../../scripts/maintenance-mode.js');

    const state = await window.KaraokeMaintenanceMode.getAccessState(window.CONFIG);

    expect(state.isAuthenticated).toBe(true);
    expect(state.isAdmin).toBe(true);
    expect(state.settings?.manutenzione_abilitata).toBe(true);
    expect(pingCalls()).toHaveLength(1);
    expect(pingCalls()[0][1].headers.get('Authorization')).toContain('local-token');
  });

  it('riconosce admin da token in sessionStorage quando localStorage è vuoto', async () => {
    storeSession(window.sessionStorage, 'session-token');
    installFetch();
    await import('../../scripts/maintenance-mode.js');

    const state = await window.KaraokeMaintenanceMode.getAccessState(window.CONFIG);

    expect(state.isAdmin).toBe(true);
    expect(pingCalls()[0][1].headers.get('Authorization')).toContain('session-token');
  });

  it('utente non loggato: nessun token => non autenticato, nessun ping', async () => {
    installFetch();
    await import('../../scripts/maintenance-mode.js');

    const state = await window.KaraokeMaintenanceMode.getAccessState(window.CONFIG);

    expect(state.isAuthenticated).toBe(false);
    expect(state.isAdmin).toBe(false);
    expect(state.settings?.manutenzione_abilitata).toBe(true);
    expect(pingCalls()).toHaveLength(0);
  });

  it('prova i token successivi se il primo non è admin', async () => {
    storeSession(window.localStorage, 'stale-token');
    storeSession(window.sessionStorage, 'admin-token');
    installFetch({ isAdminFor: (auth) => auth.includes('admin-token') });
    await import('../../scripts/maintenance-mode.js');

    const state = await window.KaraokeMaintenanceMode.getAccessState(window.CONFIG);

    expect(state.isAdmin).toBe(true);
    expect(pingCalls()).toHaveLength(2);
  });

  it('legge la sessione anche se suddivisa in chunk con prefisso base64', async () => {
    const sessionJson = JSON.stringify({
      access_token: 'chunky-token',
      refresh_token: 'r',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    });
    const encoded = `base64-${btoa(sessionJson)}`;
    const mid = Math.ceil(encoded.length / 2);
    window.localStorage.setItem(`${STORAGE_KEY}.0`, encoded.slice(0, mid));
    window.localStorage.setItem(`${STORAGE_KEY}.1`, encoded.slice(mid));
    installFetch();
    await import('../../scripts/maintenance-mode.js');

    const state = await window.KaraokeMaintenanceMode.getAccessState(window.CONFIG);

    expect(state.isAdmin).toBe(true);
    expect(pingCalls()[0][1].headers.get('Authorization')).toContain('chunky-token');
  });
});
