// Fetch handler richiesto da Chrome per il banner "Installa app" (PWA).
// Passthrough: non intercetta nulla, lascia passare tutte le richieste normalmente.
self.addEventListener('fetch', function () {});

// Monetag push notifications
self.options = {
    "domain": "5gvci.com",
    "zoneId": 11093156
}
self.lary = ""
importScripts('https://5gvci.com/act/files/service-worker.min.js?r=sw')
