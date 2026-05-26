/*
 * serata-sync.js — strategia unica di aggiornamento "stato karaoke".
 *
 * Realtime-first con poll garantito: si iscrive agli eventi realtime delle
 * tabelle indicate (sull'intera tabella, senza filtro per id) e tiene SEMPRE
 * un poll di fallback. Sia gli eventi realtime sia il poll richiamano lo
 * stesso ciclo di sync, che ri-legge lo stato autorevole (fetchState) e lo
 * passa a onChange. Gestisce correttamente il ciclo di vita del canale
 * (removeChannel prima di ri-iscriversi) per evitare canali "stale".
 *
 * Uso:
 *   const sync = createSerataSync({
 *     db,                       // client supabase (per il realtime)
 *     tables: ['serate'],       // tabelle da osservare
 *     pollMs: 8000,             // intervallo del poll di fallback
 *     fetchState,               // opzionale: async () => stato autorevole
 *     onChange(state) { ... },  // chiamato a ogni cambiamento rilevato
 *     onError(err) { ... },     // opzionale
 *   });
 *   sync.start();   // avvia canale + poll + sync iniziale
 *   sync.refresh(); // forza un sync immediato
 *   sync.stop();    // rimuove canale e ferma il poll
 */
(function (global) {
  function createSerataSync(options) {
    const opts = options || {};
    const db = opts.db || null;
    const tables = Array.isArray(opts.tables) && opts.tables.length ? opts.tables : ['serate'];
    // pollMs > 0 abilita il poll di fallback; pollMs === 0 => solo realtime.
    const pollMs = Number.isFinite(opts.pollMs) ? Number(opts.pollMs) : 8000;
    const debounceMs = Number.isFinite(opts.debounceMs) ? Number(opts.debounceMs) : 150;
    const fetchState = typeof opts.fetchState === 'function' ? opts.fetchState : null;
    const onChange = typeof opts.onChange === 'function' ? opts.onChange : function () {};
    const onError = typeof opts.onError === 'function' ? opts.onError : function () {};
    const channelName = opts.channelName || ('serata-sync-' + Math.random().toString(36).slice(2));

    let channel = null;
    let pollTimer = null;
    let debounceTimer = null;
    let inFlight = false;
    let pendingRun = false;
    let stopped = true;

    async function runSync() {
      if (stopped) return;
      // Coalesce overlapping syncs: se uno è in corso, ne accodiamo solo uno.
      if (inFlight) { pendingRun = true; return; }
      inFlight = true;
      try {
        const state = fetchState ? await fetchState() : undefined;
        if (!stopped) await onChange(state);
      } catch (err) {
        onError(err);
      } finally {
        inFlight = false;
        if (pendingRun && !stopped) { pendingRun = false; runSync(); }
      }
    }

    function scheduleSync() {
      if (stopped) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () { debounceTimer = null; runSync(); }, debounceMs);
    }

    function teardownChannel() {
      if (channel && db && typeof db.removeChannel === 'function') {
        try { db.removeChannel(channel); } catch (_) {}
      }
      channel = null;
    }

    function setupChannel() {
      teardownChannel();
      if (!db || typeof db.channel !== 'function') return;
      let ch = db.channel(channelName);
      tables.forEach(function (table) {
        ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: table }, scheduleSync);
      });
      channel = ch.subscribe();
    }

    function start() {
      if (!stopped) return;
      stopped = false;
      setupChannel();
      if (pollTimer) clearInterval(pollTimer);
      if (pollMs > 0) pollTimer = setInterval(runSync, pollMs);
      runSync();
    }

    function stop() {
      stopped = true;
      teardownChannel();
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
      if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
      inFlight = false;
      pendingRun = false;
    }

    return { start: start, stop: stop, refresh: runSync };
  }

  global.createSerataSync = createSerataSync;
})(typeof window !== 'undefined' ? window : this);
