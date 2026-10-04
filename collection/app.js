/* The six games keep their original URLs, storage and workers. */
(function () {
  'use strict';
  var cards = Array.from(document.querySelectorAll('[data-game]'));
  var catalog = document.getElementById('catalog'), player = document.getElementById('player');
  var status = document.getElementById('offline-status'), retry = document.getElementById('retry-download');
  var install = document.getElementById('install-app');
  var frame, lastCard, promptEvent, preparing = false, recheck = false;
  var watched = new WeakSet();
  var assets = ['', 'index.html', 'manifest.webmanifest', 'icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];
  function fullscreen() {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(function () {});
    }
  }
  function saveGame() {
    try { if (frame && frame.contentWindow.G && frame.contentWindow.G.saveFlush) frame.contentWindow.G.saveFlush(); } catch (e) {}
  }
  function closeGame() {
    if (frame) {
      saveGame();
      try { if (frame.contentWindow.speechSynthesis) frame.contentWindow.speechSynthesis.cancel(); } catch (e) {}
      frame.remove(); frame = null;
    }
    player.hidden = true; catalog.hidden = false;
    if (lastCard) lastCard.focus();
  }
  function showGame() {
    closeGame();
    var slug = location.hash.slice(1);
    var card = cards.find(function (c) { return c.dataset.game === slug; });
    if (!card) { prepare(); return; }
    lastCard = card; catalog.hidden = true; player.hidden = false;
    document.getElementById('game-title').textContent = card.querySelector('h2').textContent;
    document.getElementById('game-error').hidden = true;
    frame = document.createElement('iframe');
    frame.id = 'game-frame'; frame.title = card.querySelector('h2').textContent;
    frame.setAttribute('allow', "fullscreen 'none'; autoplay; screen-wake-lock");
    frame.src = card.href;
    var openedFrame = frame;
    frame.addEventListener('load', function () {
      if (frame !== openedFrame) return;
      try {
        if (!frame.contentWindow.G) { document.getElementById('game-error').hidden = false; return; }
        frame.contentWindow.G.toggleFullscreen = fullscreen;
      } catch (e) { document.getElementById('game-error').hidden = false; }
      document.getElementById('back-to-games').focus();
    });
    player.appendChild(frame);
  }
  cards.forEach(function (card) {
    card.addEventListener('click', function (e) {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      e.preventDefault(); location.hash = card.dataset.game;
    });
  });
  document.getElementById('back-to-games').addEventListener('click', function () {
    history.replaceState(null, '', location.pathname + location.search); showGame();
  });
  window.addEventListener('hashchange', showGame);
  window.addEventListener('pagehide', saveGame);
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); promptEvent = e; install.hidden = false;
  });
  install.addEventListener('click', function () {
    if (!promptEvent) return;
    var event = promptEvent; promptEvent = null; install.hidden = true;
    event.prompt().catch(function () {});
  });
  window.addEventListener('appinstalled', function () { promptEvent = null; install.hidden = true; });
  function active(registration) {
    var worker = registration.installing || registration.waiting || registration.active;
    if (!worker) return Promise.reject(new Error('Download non disponibile'));
    if (worker.state === 'activated') return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { reject(new Error('Download interrotto')); }, 30000);
      worker.addEventListener('statechange', function () {
        if (worker.state === 'activated') { clearTimeout(timer); resolve(); }
        if (worker.state === 'redundant') { clearTimeout(timer); reject(new Error('Download interrotto')); }
      });
    });
  }
  function available(card) {
    return Promise.all(assets.map(function (asset) {
      return caches.match(new URL(asset, card.href).href).then(function (hit) { return !!hit && hit.ok; });
    })).then(function (hits) { return hits.every(Boolean); });
  }
  function observe(registration) {
    if (watched.has(registration)) return;
    watched.add(registration);
    registration.addEventListener('updatefound', function () {
      if (!registration.active) return;
      status.dataset.state = 'loading';
      status.textContent = 'Aggiorno i giochi per usarli anche senza Internet…';
      if (preparing) recheck = true;
      else prepare();
    });
  }
  async function prepareGame(card) {
    var registration = await navigator.serviceWorker.getRegistration(card.href);
    if (registration) {
      observe(registration);
      if (registration.installing || registration.waiting) await active(registration);
    }
    if (!registration || registration.scope !== card.href || !registration.active || !(await available(card))) {
      registration = await navigator.serviceWorker.register(new URL('sw.js', card.href).href);
      observe(registration);
      await active(registration);
    }
    if (!(await available(card)) && navigator.onLine) {
      // Existing workers tolerate partial download failures. Repair their cache on retry.
      var keys = await caches.keys();
      var key = keys.find(function (k) { return k.indexOf(card.dataset.game + '-') === 0; });
      if (key) {
        var cache = await caches.open(key);
        await cache.addAll(assets.map(function (asset) { return new URL(asset, card.href).href; }));
      }
    }
    if (!(await available(card))) throw new Error('Download incompleto');
  }
  async function prepare() {
    if (preparing) return;
    preparing = true; retry.hidden = true; status.dataset.state = 'loading';
    if (!('serviceWorker' in navigator) || !window.isSecureContext) {
      status.dataset.state = 'error'; status.textContent = 'Apri la collection dal suo indirizzo HTTPS per installarla e scaricare i giochi.';
      preparing = false; return;
    }
    var count = 0;
    try {
      var own = await navigator.serviceWorker.register('sw.js');
      observe(own);
      await active(own);
      var results = await Promise.all(cards.map(async function (card) {
        try {
          await prepareGame(card); count++;
          status.textContent = 'Giochi pronti senza Internet: ' + count + ' di ' + cards.length + '.';
          return true;
        } catch (e) { return false; }
      }));
      var ready = results.every(Boolean);
      status.dataset.state = ready ? 'ready' : 'error';
      status.textContent = ready ? 'Tutti e sei i giochi sono pronti anche senza Internet.' : count + ' di sei giochi pronti senza Internet. Connettiti e riprova per scaricarli tutti.';
      retry.hidden = ready;
    } catch (e) {
      status.dataset.state = 'error'; status.textContent = 'Download interrotto. Connettiti a Internet e riprova.'; retry.hidden = false;
    } finally {
      preparing = false;
      if (recheck) { recheck = false; prepare(); }
    }
  }
  retry.addEventListener('click', prepare);
  window.addEventListener('online', prepare);
  showGame(); prepare();
})();
