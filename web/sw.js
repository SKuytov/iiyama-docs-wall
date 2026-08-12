/* Service Worker · iiyama-docs-wall
 * Cache-first for shell + assets, network-first for manifest.json
 * so the browser version keeps working when the network dies.
 */
const VERSION = 'v4';
const CACHE = `iiyama-docs-wall-${VERSION}`;

const PRECACHE = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'assets/cotton-bg-1.jpg',
  'assets/cotton-bg-2.jpg',
  'assets/septona-logo.png',
  // Fonts must be precached: the docs view is live HTML text now, and a
  // fallback system face would reflow the tightly fitted 4K layout.
  'assets/fonts/golos-cyrillic.woff2',
  'assets/fonts/golos-cyrillic-ext.woff2',
  'assets/fonts/golos-latin.woff2',
  'assets/fonts/golos-latin-ext.woff2',
  'assets/fonts/inter-cyrillic.woff2',
  'assets/fonts/inter-cyrillic-ext.woff2',
  'assets/fonts/inter-latin.woff2',
  'assets/fonts/inter-latin-ext.woff2',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Manifest: always try network first (so updates land quickly), fall back to cache
  if (url.pathname.endsWith('/manifest.json')) {
    e.respondWith(
      fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Everything else: cache first, fall back to network, then update the cache
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      });
    })
  );
});
