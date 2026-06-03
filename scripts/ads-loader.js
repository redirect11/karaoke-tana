(function () {
  function injectTag() {
    var s = document.createElement('script');
    s.src = 'https://quge5.com/88/tag.min.js';
    s.setAttribute('data-zone', '245668');
    s.async = true;
    s.setAttribute('data-cfasync', 'false');
    document.head.appendChild(s);
  }

  function loadAds() {
    var cfg = window.config;
    if (!cfg || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
      // config.js non disponibile: fallback su ADS_ENABLED da config
      if (cfg && cfg.ADS_ENABLED !== false) injectTag();
      return;
    }
    fetch(cfg.SUPABASE_URL + '/rest/v1/impostazioni_pubbliche?select=ads_enabled&id=eq.1', {
      headers: { apikey: cfg.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + cfg.SUPABASE_ANON_KEY },
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        // Se la colonna ads_enabled non esiste ancora (migration non applicata)
        // o la riga non esiste, data è vuoto o manca il campo:
        // in entrambi i casi si usa il valore di config.js come fallback.
        if (!Array.isArray(data) || !data.length) {
          if (cfg.ADS_ENABLED !== false) injectTag();
          return;
        }
        var row = data[0];
        // ads_enabled null (colonna esiste ma valore null) → fallback config
        var enabled = row.ads_enabled === null ? cfg.ADS_ENABLED !== false : row.ads_enabled !== false;
        if (enabled) injectTag();
      })
      .catch(function () {
        // Errore di rete o colonna mancante: fallback su config.js
        if (cfg.ADS_ENABLED !== false) injectTag();
      });
  }

  window.loadAds = loadAds;

  // Auto-load su tutte le pagine tranne quelle che impostano ADS_MANUAL_LOAD=true
  // (es. vota.html attende la verifica admin prima di caricare gli ads).
  if (!window.ADS_MANUAL_LOAD) loadAds();
})();
