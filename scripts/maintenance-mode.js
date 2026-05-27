(() => {
  const DEFAULT_SETTINGS = Object.freeze({
    manutenzione_abilitata: false,
  });

  function resolveConfig() {
    return (typeof window.CONFIG === 'object' && window.CONFIG)
      || {};
  }

  function isSupabaseReady(config) {
    const url = `${config?.SUPABASE_URL || ''}`;
    return !!url && !url.includes('TUO-PROGETTO');
  }

  function createClient(config, options) {
    if (!isSupabaseReady(config) || typeof window.supabase?.createClient !== 'function') return null;
    return window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY || '', options);
  }

  function getAdminHeaders(token, config) {
    const headers = new Headers({
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
    });
    if (config?.SUPABASE_ANON_KEY) headers.set('apikey', config.SUPABASE_ANON_KEY);
    return headers;
  }

  async function loadMaintenanceSettings(config) {
    const db = createClient(config);
    if (!db) return { ...DEFAULT_SETTINGS };
    try {
      const { data } = await db
        .from('impostazioni_pubbliche')
        .select('manutenzione_abilitata')
        .eq('id', 1)
        .maybeSingle();
      return { ...DEFAULT_SETTINGS, ...(data || {}) };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  async function getAccessState(config = resolveConfig()) {
    const state = {
      settings: await loadMaintenanceSettings(config),
      isAuthenticated: false,
      isAdmin: false,
    };
    const authClient = createClient(config, {
      auth: { persistSession: true, storage: window.sessionStorage },
    });
    if (!authClient) return state;
    try {
      const { data } = await authClient.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) return state;
      state.isAuthenticated = true;
      const endpoint = `${String(config.SUPABASE_URL).replace(/\/+$/, '')}/functions/v1/admin-bookings`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: getAdminHeaders(token, config),
        body: JSON.stringify({ action: 'ping' }),
      });
      state.isAdmin = response.ok;
    } catch {
      return state;
    }
    return state;
  }

  function redirectToHome(homePath = 'index.html') {
    if (typeof window === 'undefined') return;
    const targetUrl = new URL(homePath, window.location.href);
    window.location.replace(targetUrl.toString());
  }

  function injectAdminBanner(text = '⚠️ Modalità manutenzione attiva') {
    if (typeof document === 'undefined' || document.getElementById('karaoke-maintenance-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'karaoke-maintenance-banner';
    banner.textContent = text;
    banner.setAttribute('role', 'alert');
    banner.setAttribute('aria-live', 'polite');
    banner.style.cssText = [
      'position:sticky',
      'top:0',
      'z-index:9999',
      'width:100%',
      'padding:12px 16px',
      'text-align:center',
      'font-weight:800',
      'letter-spacing:0.04em',
      'background:linear-gradient(135deg,#f5c400 0%,#d97b00 100%)',
      'color:#1a1200',
      'box-shadow:0 8px 24px rgba(0,0,0,0.28)',
    ].join(';');
    document.body.prepend(banner);
  }

  window.KaraokeMaintenanceMode = {
    getAccessState,
    redirectToHome,
    injectAdminBanner,
  };
})();
