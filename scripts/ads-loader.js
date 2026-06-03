// Il tag Monetag è presente come script statico nell'<head> (#ads-monetag).
// Questo loader lo rimuove se gli ads sono disabilitati:
//   - config.ADS_ENABLED === false  → disabilitato da config.js (locale/dev)
//   - ads_enabled === false in DB   → disabilitato dall'admin panel
// In produzione con ads abilitati il tag è già nell'HTML e non serve fare nulla.
(function () {
  function removeAdTag() {
    var tag = document.getElementById('ads-monetag');
    if (tag) tag.remove();
  }

  function checkAndMaybeDisable() {
    var cfg = window.config;

    // 1. Controllo immediato config.js (sincrono, senza latenza)
    if (cfg && cfg.ADS_ENABLED === false) {
      removeAdTag();
      return;
    }

    // 2. Controllo DB (async) — rimuove il tag se ads_enabled = false in Supabase
    if (!cfg || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return;
    fetch(cfg.SUPABASE_URL + '/rest/v1/impostazioni_pubbliche?select=ads_enabled&id=eq.1', {
      headers: { apikey: cfg.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + cfg.SUPABASE_ANON_KEY },
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (Array.isArray(data) && data.length && data[0].ads_enabled === false) {
          removeAdTag();
        }
      })
      .catch(function () {});
  }

  // Su vota.html la verifica admin viene fatta altrove (dopo detectDirettaAdmin)
  window.loadAds = checkAndMaybeDisable;

  if (!window.ADS_MANUAL_LOAD) checkAndMaybeDisable();
})();
