(function () {
  var cfg = window.config;
  if (!cfg || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return;
  fetch(cfg.SUPABASE_URL + '/rest/v1/impostazioni_pubbliche?select=ads_enabled&id=eq.1', {
    headers: { apikey: cfg.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + cfg.SUPABASE_ANON_KEY },
  })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (!Array.isArray(data) || !data.length || data[0].ads_enabled === false) return;
      var s = document.createElement('script');
      s.src = 'https://quge5.com/88/tag.min.js';
      s.setAttribute('data-zone', '245668');
      s.async = true;
      s.setAttribute('data-cfasync', 'false');
      document.head.appendChild(s);
    })
    .catch(function () {});
})();
