// V3: nessuna cache applicativa. Questo file è mantenuto solo per compatibilità con installazioni precedenti.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
