/* Collection shell only. Each game retains its worker and its saves. */
var CACHE = 'dino-collection-b449c5be39';
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
    // Refresh the page and its script before returning stale installation controls.
    if (e.request.mode === 'navigate' || url.pathname.endsWith('/app.js')) {
      if (cached) {
        var timer;
        var fallback = new Promise(function (resolve) { timer = setTimeout(function () { resolve(cached); }, 2500); });
        e.waitUntil(network.catch(function () {}));
        return Promise.race([network.catch(function () { return cached; }), fallback]).finally(function () { clearTimeout(timer); });
      }
      return network.catch(function (error) { if (cached) return cached; throw error; });
    }
    if (cached) { e.waitUntil(network.catch(function () {})); return cached; }
    return network;
  }));
});
