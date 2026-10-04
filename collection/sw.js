/* Collection shell only. Each game retains its worker and its saves. */
var CACHE = 'dino-collection-64d3245fe7';
var ASSETS = ['./', './index.html', './app.js', '../manifest.webmanifest', '../icon.svg', '../icon-180.png', '../icon-192.png', '../icon-512.png', '../icon-maskable-512.png', '../test/collection-frames/dino-kart-race.png', '../test/collection-frames/dino-officina-workbench.png', '../test/collection-frames/dino-stazione-switches.png', '../test/collection-frames/dino-run-running.png', '../test/collection-frames/dino-mario-play.png'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('dino-collection-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  var url = new URL(e.request.url);
  var known = ASSETS.some(function (p) { return new URL(p, self.registration.scope).href === url.origin + url.pathname; });
  if (!known) return;
  e.respondWith(caches.open(CACHE).then(async function (cache) {
    var cached = await cache.match(e.request, { ignoreSearch: true });
    var network = fetch(e.request).then(async function (response) {
      if (response.ok) await cache.put(e.request, response.clone());
      return response.ok ? response : (cached || response);
    });
    if (cached) { e.waitUntil(network.catch(function () {})); return cached; }
    return network;
  }));
});
