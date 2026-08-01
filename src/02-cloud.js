/* Optional cloud save. Off by default: the game is fully playable offline.
   Set SYNC_URL to a tiny key/value endpoint (see server/worker.js in the repo)
   and the same account will follow a child from the tablet to the browser. */
(function () {
  'use strict';

  var SYNC_URL = '';        // e.g. 'https://dino-giungla.<tuo-nome>.workers.dev'

  var cloud = (G.cloud = { on: !!SYNC_URL, state: 'off', last: 0 });
  if (!SYNC_URL) { cloud.push = function () {}; cloud.pull = function () {}; return; }

  var pending = null, timer = 0;

  function url(path) { return SYNC_URL.replace(/\/+$/, '') + path; }

  cloud.pull = function () {
    if (!G.account) return;
    cloud.state = 'sync';
    fetch(url('/save/' + encodeURIComponent(G.account.id)), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.save) { cloud.state = 'ok'; return; }
        // Last write wins, and only if the remote copy is genuinely newer.
        if ((d.save.updated || 0) > (G.save.updated || 0) + 1500) {
          G.save = d.save;
          G.LS.set('dg.save.' + G.account.id, G.save);
        }
        cloud.state = 'ok';
      })
      .catch(function () { cloud.state = 'err'; });
  };

  cloud.push = function () {
    if (!G.account) return;
    pending = { id: G.account.id, name: G.account.name, save: G.save };
    if (timer) return;
    timer = setTimeout(function () {
      timer = 0;
      var body = pending; pending = null;
      if (!body) return;
      cloud.state = 'sync';
      fetch(url('/save/' + encodeURIComponent(body.id)), {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      })
        .then(function () { cloud.state = 'ok'; cloud.last = Date.now(); })
        .catch(function () { cloud.state = 'err'; });
    }, 4000);
  };
})();
