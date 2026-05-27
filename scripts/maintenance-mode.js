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

  function getBrowserStorage(name) {
    if (typeof window === 'undefined') return null;
    try {
      return window[name] || null;
    } catch {
      return null;
    }
  }

  function getAuthStorages() {
    const storages = [];
    const local = getBrowserStorage('localStorage');
    const session = getBrowserStorage('sessionStorage');
    if (local) storages.push(local);
    if (session) storages.push(session);
    return storages;
  }

  function decodeMaybeBase64(value) {
    if (typeof value !== 'string') return value;
    if (value.startsWith('base64-')) {
      try {
        return typeof atob === 'function' ? atob(value.slice('base64-'.length)) : value;
      } catch {
        return value;
      }
    }
    return value;
  }

  function extractAccessToken(rawValue) {
    const decoded = decodeMaybeBase64(rawValue);
    if (!decoded) return null;
    try {
      const parsed = JSON.parse(decoded);
      return parsed?.access_token
        || parsed?.currentSession?.access_token
        || parsed?.session?.access_token
        || null;
    } catch {
      return null;
    }
  }

  // Legge i token di sessione direttamente dallo storage, SENZA creare client
  // GoTrue aggiuntivi: più istanze GoTrue sulla stessa storageKey producono
  // "undefined behavior" e il token dell'admin non veniva riconosciuto sulle
  // pagine pubbliche. Gestisce la chiave singola `sb-<ref>-auth-token`, la
  // variante suddivisa in chunk (`...auth-token.0`, `.1`, …) e il prefisso
  // `base64-`.
  function readAuthTokensFromStorage(storage) {
    const tokens = [];
    if (!storage) return tokens;
    let length;
    try { length = storage.length; } catch { return tokens; }
    const chunked = {};
    function safeGet(key) {
      try { return storage.getItem(key); } catch { return null; }
    }
    for (let i = 0; i < length; i += 1) {
      let key;
      try { key = storage.key(i); } catch { continue; }
      if (!key) continue;
      const chunkMatch = /^(sb-.+-auth-token)\.(\d+)$/.exec(key);
      if (/^sb-.+-auth-token$/.test(key)) {
        const token = extractAccessToken(safeGet(key));
        if (token) tokens.push(token);
      } else if (chunkMatch) {
        const base = chunkMatch[1];
        (chunked[base] = chunked[base] || {})[Number(chunkMatch[2])] = safeGet(key) || '';
      }
    }
    Object.keys(chunked).forEach((base) => {
      const parts = chunked[base];
      const assembled = Object.keys(parts)
        .map(Number)
        .sort((a, b) => a - b)
        .map((n) => parts[n])
        .join('');
      const token = extractAccessToken(assembled);
      if (token) tokens.push(token);
    });
    return tokens;
  }

  function getAccessTokens() {
    const tokens = [];
    const seen = new Set();
    for (const storage of getAuthStorages()) {
      for (const token of readAuthTokensFromStorage(storage)) {
        if (token && !seen.has(token)) {
          seen.add(token);
          tokens.push(token);
        }
      }
    }
    return tokens;
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
    // persistSession:false -> non registra una GoTrue sulla storageKey condivisa.
    const db = createClient(config, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
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
    try {
      const tokens = getAccessTokens();
      if (tokens.length === 0) return state;
      state.isAuthenticated = true;
      const endpoint = `${String(config.SUPABASE_URL).replace(/\/+$/, '')}/functions/v1/admin-bookings`;
      for (const token of tokens) {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: getAdminHeaders(token, config),
          body: JSON.stringify({ action: 'ping' }),
        });
        const result = await response.json().catch(() => null);
        if (response.ok && result?.success === true && result?.data?.ok === true) {
          state.isAdmin = true;
          break;
        }
      }
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
