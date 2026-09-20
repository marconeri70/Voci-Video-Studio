// V2.2: service worker disattivato intenzionalmente per evitare versioni obsolete su GitHub Pages.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.registration.unregister()));
