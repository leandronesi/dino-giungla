/* Dino Giungla — "La Casetta".

   The fifth place, and the first one in the whole game where fruit buys
   something that does not produce more fruit. Until now fruit bought producers
   that made more fruit: a closed circle, with no reason to HAVE fruit other than
   having more of it. That is the point of this room, more than the room itself.

   THE LINE AGAINST THE NIDO, which is the real design risk since both are "buy
   things and put them in your space":
     - The catalogue is NOT a ladder. Nothing here has a yield, nothing has more
       than one seat, and `seats` is not correlated with price: the 25-fruit pouf
       and the 300-fruit hammock do exactly the same thing. No dominant strategy,
       therefore no way to be wrong.
     - No clock. Nothing in this file reads Date.now, nothing is persisted from
       wall time, and no value changes while the scene is not running. The Nido
       makes VALUE while you are away; the Casetta makes BEHAVIOUR while you
       watch.
     - No faucet. Not one G.addFruits in this file. It is the first negative-sum
       place in the game, and that is exactly what makes the Nido mean something.
     - No ghost outlines of what you do not own. That moment belongs to the Nido.
       An empty room looks like an empty room, not like a list of things missing.

   AND THE LINE AGAINST THE GUARDAROBA, which is the closer twin: there a tap
   triggers a 1.4s pose and it decays back to idle. Here a little state machine
   runs on its own while nobody is touching the screen, and your tap does not
   TRIGGER the behaviour, it REDIRECTS it. Anyone who implements "tap the chair,
   pose for 1.4s, back to idle" has rewritten the Guardaroba with furniture.

   Owns G.save.casetta. Reads G.save.nido.items[*].chicks READ-ONLY, never writes
   to another scene's branch. */
(function () {
  'use strict';

  var C = G.C, W = G.W, H = G.H;

  var FLOOR_TOP = 498, FLOOR_BOT = 690;    // where furniture may stand
  var X_MIN = 90, X_MAX = 1190;
  var WALL_TOP = 250, WALL_BOT = 412;      // where wall pieces may hang
  var MAX_PIECES = 14;                     // the room is unreadable past this

  /* Prices ride the ladder the game already speaks — the Nido's plants are
     25/60/140/300/600 — and level 1 halves them exactly like buyCost does.
     `seats` is 0 or 1 and NEVER 2, and never correlated with price: the moment a
     dearer piece seats more guests there is a right order to buy in, which is
     the one thing this room promised not to have. */
  var CAT = [
    { id: 'tappeto', name: 'Tappeto', cost: 0, seats: 1, on: 'floor', w: 240, home: [520, 640], pose: 'sleep', say: 'Che morbido!', l1: true },
    { id: 'ciotola', name: 'Ciotola', cost: 25, seats: 0, on: 'floor', w: 96, home: [292, 612], pose: 'happy', say: 'Che fame!', l1: true },
    { id: 'pouf', name: 'Pouf', cost: 25, seats: 1, on: 'floor', w: 130, home: [880, 604], pose: 'idle', say: 'Che comodo!', l1: true },
    { id: 'pianta', name: 'Pianta', cost: 60, seats: 0, on: 'floor', w: 150, home: [1108, 588], pose: 'think', say: 'Che profumo!', l1: true },
    { id: 'lampada', name: 'Lampada', cost: 60, seats: 0, on: 'floor', w: 130, home: [176, 566], pose: 'idle', say: 'Che bella luce!', l1: true },
    { id: 'finestra', name: 'Finestra', cost: 60, seats: 0, on: 'wall', w: 210, home: [980, 386], pose: 'think', say: 'Guarda la giungla!', l1: true },
    { id: 'lettino', name: 'Lettino', cost: 140, seats: 1, on: 'floor', w: 250, home: [1046, 668], pose: 'sleep', say: 'Buonanotte...', l1: true },
    { id: 'tavolino', name: 'Tavolino', cost: 140, seats: 1, on: 'floor', w: 190, home: [640, 656], pose: 'happy', say: 'Facciamo festa!', l1: true },
    { id: 'casetta', name: 'Casetta', cost: 300, seats: 0, on: 'floor', w: 170, home: [408, 686], pose: 'happy', say: 'Casa dolce casa!', l1: true },
    { id: 'quadro', name: 'Quadro', cost: 140, seats: 0, on: 'wall', w: 150, home: [372, 372], pose: 'think', say: 'Sono io!', l1: false },
    { id: 'libreria', name: 'Libreria', cost: 300, seats: 0, on: 'floor', w: 180, home: [148, 690], pose: 'think', say: 'Che bel libro!', l1: false },
    { id: 'amaca', name: 'Amaca', cost: 300, seats: 1, on: 'floor', w: 280, home: [790, 540], pose: 'sleep', say: 'Dondolooo...', l1: false },
    { id: 'acquario', name: 'Acquario', cost: 600, seats: 0, on: 'floor', w: 210, home: [620, 528], pose: 'think', say: 'Ciao pesciolini!', l1: false },
    { id: 'albero', name: 'Albero', cost: 600, seats: 0, on: 'floor', w: 200, home: [1160, 690], pose: 'happy', say: 'Un albero in casa!', l1: false }
  ];
  var BY_ID = {};
  CAT.forEach(function (d) { BY_ID[d.id] = d; });

  var SURF = [
    { id: 'w1', kind: 'wall', v: 1, cost: 140, name: 'Parete' },
    { id: 'w2', kind: 'wall', v: 2, cost: 140, name: 'Parete' },
    { id: 'w3', kind: 'wall', v: 3, cost: 140, name: 'Parete' },
    { id: 'f1', kind: 'floor', v: 1, cost: 140, name: 'Pavimento' },
    { id: 'f2', kind: 'floor', v: 2, cost: 140, name: 'Pavimento' },
    { id: 'f3', kind: 'floor', v: 3, cost: 140, name: 'Pavimento' }
  ];
  var PARTY_COST = 60;

  function big() { return G.level === 2; }
  function price(cost) { return big() ? cost : Math.max(1, Math.round(cost / 2)); }
  function inCatalog(d) { return big() || d.l1; }
  function fruitsOwned() {
    var v = Number(G.save.fruits);
    return isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
  }

  /* ------------------------------------------------------------ save branch */
  /* blankSave() in the core does not know about this branch, so everything is
     rebuilt defensively — an old save simply has no `casetta` at all. */
  function br() {
    var g = G.save.casetta;
    if (!g || typeof g !== 'object' || Array.isArray(g)) g = G.save.casetta = {};
    if (!Array.isArray(g.items)) g.items = [];
    g.items = g.items.filter(function (it) {
      return it && typeof it === 'object' && BY_ID[it.id];
    }).slice(0, MAX_PIECES);
    g.items.forEach(function (it) {
      var d = BY_ID[it.id];
      it.c = Math.max(0, Math.min(3, Math.round(Number(it.c)) || 0));
      it.x = clampX(Number(it.x), d);
      it.y = clampY(Number(it.y), d);
    });
    if (!Array.isArray(g.surf)) g.surf = [];
    g.surf = g.surf.filter(function (s) { return typeof s === 'string'; });
    g.wall = clampInt(g.wall, 0, (A.WALL_N || 4) - 1);
    g.floor = clampInt(g.floor, 0, (A.FLOOR_N || 4) - 1);
    if (typeof g.gift !== 'boolean') g.gift = false;
    if (typeof g.parties !== 'number' || !isFinite(g.parties) || g.parties < 0) g.parties = 0;
    return g;
  }
  function clampInt(v, a, b) {
    v = Math.round(Number(v));
    return isFinite(v) ? Math.max(a, Math.min(b, v)) : a;
  }
  function clampX(v, d) {
    if (!isFinite(v)) v = d.home[0];
    var half = d.w * 0.5;
    return Math.max(X_MIN + half * 0.4, Math.min(X_MAX - half * 0.4, v));
  }
  function clampY(v, d) {
    if (!isFinite(v)) v = d.home[1];
    return d.on === 'wall'
      ? Math.max(WALL_TOP, Math.min(WALL_BOT, v))
      : Math.max(FLOOR_TOP, Math.min(FLOOR_BOT, v));
  }

  function owned(id) {
    var it = br().items, i;
    for (i = 0; i < it.length; i++) if (it[i].id === id) return true;
    return false;
  }
  function countOf(id) {
    var it = br().items, i, n = 0;
    for (i = 0; i < it.length; i++) if (it[i].id === id) n++;
    return n;
  }
  function hasSurf(id) { return br().surf.indexOf(id) >= 0; }
  function seatsTotal() {
    return br().items.reduce(function (n, it) { return n + (BY_ID[it.id].seats || 0); }, 0);
  }

  /* Guests: chicks hatched at the Nido come to live here once there is somewhere
     to sit. READ-ONLY on another scene's branch, with full type guards — and
     never a write. */
  function chicksBorn() {
    var nido = G.save.nido, k, it, n = 0;
    if (!nido || typeof nido !== 'object') return 0;
    var items = nido.items;
    if (!items || typeof items !== 'object') return 0;
    for (k in items) {
      if (!Object.prototype.hasOwnProperty.call(items, k)) continue;
      it = items[k];
      if (!it || typeof it !== 'object') continue;
      n += Math.max(0, Math.min(6, Math.floor(Number(it.chicks) || 0)));
    }
    return n;
  }
  function guests() { return Math.max(0, Math.min(chicksBorn(), seatsTotal())); }
  /* The overworld lights the window of the house icon with this. */
  G.casaOspiti = function () { return guests(); };

  /* ---------------------------------------------------------------- state */
  var S = {
    shop: false,        // level 2: the cart panel is open
    brush: false,       // level 2: the paintbrush is on
    fly: null,          // {id, c, x, y, tx, ty, k}
    drag: null,         // {i, dx, dy, moved, t}
    party: 0,           // seconds of party left
    idle: 0, nudges: 0, sayT: 0, sayMsg: null,
    softT: 0, softX: 0, softY: 0
  };

  /* The dino lives here: walks somewhere, uses it, waits, chooses again. This
     runs whether or not anybody is touching the screen. A tap redirects it; it
     never blocks a tap. */
  var D = { x: 640, y: 620, tx: 640, ty: 620, facing: 1, state: 'idle', t: 1.6, use: null, spont: false };

  function dinoSize() { return (big() ? 185 : 210) * A.roomDepth(D.y); }

  function seatsFree() {
    return br().items.filter(function (it) { return BY_ID[it.id].seats > 0; });
  }

  function sendTo(it, spontaneous) {
    var d = BY_ID[it.id];
    D.tx = it.x; D.ty = d.on === 'wall' ? FLOOR_TOP + 40 : it.y;
    D.facing = D.tx >= D.x ? 1 : -1;
    D.state = 'walk';
    D.use = it;
    D.spont = !!spontaneous;
  }

  function chooseSomething() {
    var pool = br().items;
    if (!pool.length) { D.state = 'idle'; D.t = 2 + Math.random() * 2; D.use = null; return; }
    sendTo(pool[G.rndi(0, pool.length - 1)], true);
  }

  function say(msg, delay) { S.sayMsg = msg; S.sayT = delay === undefined ? 0.1 : delay; }

  /* ------------------------------------------------------------- buying */
  function softNo(x, y) {
    S.softT = 1.1; S.softX = x; S.softY = y;
    G.sfx('bad');
    G.say(G.pick(['Ci vogliono piu frutti!', 'Raccogli ancora un po di frutti!', 'Non bastano ancora!']));
  }

  function buy(d, cx, cy) {
    var g = br(), cost = price(d.cost);
    if (g.items.length >= MAX_PIECES) {
      G.sfx('pop');
      G.say('La stanza e piena!');
      return;
    }
    // canonical double check, verbatim from the Nido: fruitsOwned() is re-read
    // here because G.addFruits does not credit until the flyer lands.
    if (fruitsOwned() < cost || !G.spend(cost)) { softNo(cx, cy); return; }
    var n = countOf(d.id);
    var it = { id: d.id, c: n % 4, x: d.home[0] + (n ? 74 : 0), y: d.home[1] + (n ? 14 : 0) };
    it.x = clampX(it.x, d); it.y = clampY(it.y, d);
    g.items.push(it);
    G.saveNow();
    S.fly = { id: d.id, c: it.c, x: cx, y: cy, tx: it.x, ty: it.y, k: 0 };
    G.sfx('chime');
    G.fx.ring(cx, cy, C.sun);
    G.fx.confetti();
    say(d.say, 0.5);
  }

  function buySurface(s, cx, cy) {
    var g = br(), cost = price(s.cost);
    if (hasSurf(s.id)) { applySurface(s); return; }
    if (fruitsOwned() < cost || !G.spend(cost)) { softNo(cx, cy); return; }
    g.surf.push(s.id);
    applySurface(s);
    G.sfx('chime'); G.fx.confetti();
  }
  function applySurface(s) {
    var g = br();
    if (s.kind === 'wall') g.wall = s.v; else g.floor = s.v;
    G.saveNow();
    G.sfx('whoosh');
  }

  function roll() {
    var g = br();
    g.items.forEach(function (it) { it.c = G.rndi(0, 3); });
    g.wall = G.rndi(0, (A.WALL_N || 4) - 1);
    g.floor = G.rndi(0, (A.FLOOR_N || 4) - 1);
    if (!hasSurf('w' + g.wall) && g.wall !== 0) g.wall = 0;      // only what you own
    if (!hasSurf('f' + g.floor) && g.floor !== 0) g.floor = 0;
    G.saveNow();
    G.sfx('chime'); G.fx.confetti();
    G.say('Sorpresa!');
  }

  function tidy() {
    var g = br();
    g.items.forEach(function (it, i) {
      var d = BY_ID[it.id], n = 0, j;
      for (j = 0; j < i; j++) if (g.items[j].id === it.id) n++;
      it.x = clampX(d.home[0] + (n ? 74 : 0), d);
      it.y = clampY(d.home[1] + (n ? 14 : 0), d);
    });
    G.saveNow();
    G.sfx('pop');
    G.say('A posto!');
  }

  /* The price creeps up, but it is CAPPED. An uncapped multiplier reads like
     depth and is really a wall: at 60 * 1.5^n the twentieth party costs over a
     million, which means softNo on every single tap — a failure state wearing a
     gentle voice. 240 is eighteen seconds of level-2 income and under two
     minutes at level 1: always reachable, never free. */
  function partyCost() {
    var n = br().parties;
    return price(Math.min(240, PARTY_COST + 20 * Math.max(0, n - 2)));
  }

  function party(cx, cy) {
    if (S.party > 0) return;              // no re-charging while it is running
    var g = br(), cost = partyCost();
    if (fruitsOwned() < cost || !G.spend(cost)) { softNo(cx, cy); return; }
    g.parties++;
    G.saveNow();
    S.party = 4.5;
    G.sfx('win'); G.fx.confetti();
    G.say(G.pick(['Che festa!', 'Evviva la festa!', 'Tutti a tavola!']));
  }

  /* ================================================================ SCENE */
  G.scene('casetta', {
    enter: function () {
      var g = br();
      S.shop = false; S.brush = false; S.fly = null; S.drag = null;
      S.party = 0; S.idle = 0; S.nudges = 0; S.softT = 0;
      S.sayMsg = null; S.sayT = 0;

      if (!g.gift) {                       // the rug is a present, always
        g.gift = true;
        var d = BY_ID.tappeto;
        g.items.push({ id: 'tappeto', c: 0, x: d.home[0], y: d.home[1] });
        G.saveNow();
      }
      D.x = 640; D.y = 620; D.tx = 640; D.ty = 620;
      D.state = 'idle'; D.t = 1.4; D.use = null; D.facing = 1;

      if (!G.save.seen) G.save.seen = {};
      var first = !G.save.seen.casetta;
      G.save.seen.casetta = true;
      G.saveNow();
      setTimeout(function () {
        if (G.current !== 'casetta') return;
        G.say(first
          ? 'Questa e la tua casetta! Compra qualcosa e guarda cosa fa il dino.'
          : G.pick(['Bentornato a casa!', 'Cosa mettiamo oggi?', 'Guarda che bella casa!']));
      }, 420);
    },

    exit: function () { S.fly = null; S.drag = null; S.shop = false; },

    update: function (dt) {
      if (S.softT > 0) S.softT = Math.max(0, S.softT - dt);
      if (S.party > 0) S.party = Math.max(0, S.party - dt);
      if (S.sayT > 0) {
        S.sayT -= dt;
        if (S.sayT <= 0 && S.sayMsg) { G.say(S.sayMsg); S.sayMsg = null; }
      }
      if (S.fly) {
        S.fly.k += dt / 0.4;
        if (S.fly.k >= 1) S.fly = null;
      }

      /* The dino's own life. Tighter than it feels it should be: against a Nido
         that pops a bubble every five seconds, one event every fifteen in a room
         where nothing else moves is a desert. */
      if (S.party > 0) {
        var t = BY_ID.tavolino, tav = br().items.filter(function (i) { return i.id === 'tavolino'; })[0];
        if (tav) { D.tx = tav.x - 90; D.ty = tav.y; }
        D.state = Math.abs(D.tx - D.x) > 8 ? 'walk' : 'use';
        void t;
      } else if (D.state === 'walk') {
        var dx = D.tx - D.x, dy = D.ty - D.y;
        var dist = Math.hypot(dx, dy);
        var step = (big() ? 270 : 305) * dt;
        if (dist <= step) {
          D.x = D.tx; D.y = D.ty;
          D.state = 'use';
          D.t = D.spont ? 3 + Math.random() * 2 : 3.4;
          if (D.use && !D.spont) say(BY_ID[D.use.id].say, 0);
        } else {
          D.x += dx / dist * step;
          D.y += dy / dist * step;
          D.facing = dx >= 0 ? 1 : -1;
        }
      } else {
        D.t -= dt;
        if (D.t <= 0) {
          if (D.state === 'use') { D.state = 'idle'; D.t = 4 + Math.random() * 3; D.use = null; }
          else chooseSomething();
        }
      }

      // a nudge that DEMONSTRATES instead of explaining
      S.idle += dt;
      if (!big() && S.idle > 8 && S.nudges < 2 && br().items.length) {
        S.idle = 0; S.nudges++;
        chooseSomething();
      }
    },

    onDown: function (p) {
      S.idle = 0;
      if (S.shop) { S.shop = false; return; }      // tap outside the cart closes it
      var g = br(), i, it, d, hit = -1, best = 1e9, dd;
      for (i = g.items.length - 1; i >= 0; i--) {
        it = g.items[i]; d = BY_ID[it.id];
        dd = Math.hypot(p.x - it.x, p.y - (d.on === 'wall' ? it.y - d.w * 0.3 : it.y - d.w * 0.25));
        if (dd < Math.max(58, d.w * 0.55) * (big() ? 1.06 : 1.30) && dd < best) { best = dd; hit = i; }
      }
      if (hit < 0) return;
      it = g.items[hit]; d = BY_ID[it.id];

      if (big() && S.brush) {                      // paintbrush: recolour, precisely
        it.c = (it.c + 1) % 4; G.saveNow(); G.sfx('pop');
        return;
      }
      /* The table used to charge for a party right here, AFTER S.drag had been
         assigned and without clearing it — so at level 2 every touch on the
         table cost 60 fruit AND started a drag, which made repositioning it
         cost 60 fruit a go. The party now has its own button (drawPartyButton),
         and the table is an ordinary piece of furniture. */
      if (big()) { S.drag = { i: hit, dx: p.x - it.x, dy: p.y - it.y, moved: false, t: 0 }; }
      sendTo(it, false);
      G.sfx('tap');
    },

    onMove: function (p) {
      if (!big() || !S.drag) return;               // no dragging at level 1, ever
      var g = br(), it = g.items[S.drag.i];
      if (!it) { S.drag = null; return; }
      var d = BY_ID[it.id];
      if (!S.drag.moved) {
        if (Math.hypot(p.x - S.drag.dx - it.x, p.y - S.drag.dy - it.y) < 12) return;
        S.drag.moved = true;
      }
      it.x = clampX(p.x - S.drag.dx, d);
      it.y = clampY(Math.round((p.y - S.drag.dy) / 10) * 10, d);
    },

    onUp: function () {
      if (S.drag && S.drag.moved) { G.saveNow(); G.sfx('pop'); }
      S.drag = null;
    },

    draw: function (c) { drawRoom(c); }
  });

  /* ---------------------------------------------------------------- draw */
  function drawRoom(c) {
    var g = br(), i;
    A.room(c, { wall: g.wall, floor: g.floor });

    /* One draw list per frame, sorted by depth, so a piece in front of the dino
       is in front of the dino and there is no class of z-order bug left. Wall
       pieces always go first: they are on the wall. */
    var list = [];
    g.items.forEach(function (it, idx) {
      var d = BY_ID[it.id];
      list.push({ y: d.on === 'wall' ? -1000 + idx : it.y, it: it, d: d });
    });
    list.push({ y: D.y, dino: true });
    guestList().forEach(function (q) { list.push({ y: q.y, guest: q }); });
    list.sort(function (a, b) { return a.y - b.y; });

    list.forEach(function (e) {
      if (e.dino) { drawDino(c); return; }
      if (e.guest) { drawGuest(c, e.guest); return; }
      var k = A.roomDepth(e.y);
      A.roomShadow(c, e.it.x, e.it.y, e.d.w * k * 0.8);
      A.house(c, e.it.id, e.it.x, e.it.y, e.d.w * k, { c: e.it.c });
    });
    // the front layer of any piece the dino may be standing inside
    g.items.forEach(function (it) {
      var d = BY_ID[it.id];
      if (A.HOUSE_FRONT[it.id]) A.houseFront(c, it.id, it.x, it.y, d.w * A.roomDepth(it.y), { c: it.c });
    });

    drawFly(c);
    drawPartyButton(c);
    if (S.party > 0) drawParty(c);
    if (big()) drawShopL2(c); else drawShopL1(c);
    drawSoftNo(c);
  }

  function drawDino(c) {
    var s = dinoSize();
    var pose = 'idle';
    if (D.state === 'walk') pose = 'walk';
    else if (D.state === 'use' && D.use) pose = BY_ID[D.use.id].pose;
    if (S.party > 0 && D.state === 'use') pose = 'happy';
    var col = (G.account && G.account.color) || C.dino;
    // current player: no gear, no hat — A.dino reads the live save
    A.dino(c, D.x, D.y, s, { facing: D.facing, pose: pose, t: G.t, color: col });
    if (D.spont && D.state === 'use') {            // he did that on his own
      G.text('!', D.x + D.facing * s * 0.34, D.y - s * 1.06, {
        ctx: c, size: 34, color: C.sun, stroke: 'rgba(43,29,18,.7)', strokeWidth: 7
      });
    }
  }

  var guestBuf = [];
  function guestList() {
    var n = guests(), g = br(), out = guestBuf;
    out.length = 0;
    var seats = g.items.filter(function (it) { return BY_ID[it.id].seats > 0; });
    for (var i = 0; i < n && i < seats.length; i++) {
      out.push({ x: seats[i].x + 44, y: seats[i].y - 4, i: i });
    }
    return out;
  }
  function drawGuest(c, q) {
    var k = A.roomDepth(q.y);
    if (A.chick) A.chick(c, q.x, q.y - 26 * k, 62 * k, { t: G.t + q.i * 1.7, color: C.dino });
  }

  function drawFly(c) {
    if (!S.fly) return;
    var k = G.ease(G.clamp(S.fly.k, 0, 1));
    var d = BY_ID[S.fly.id];
    var x = G.lerp(S.fly.x, S.fly.tx, k);
    var y = G.lerp(S.fly.y, S.fly.ty, k) - Math.sin(k * Math.PI) * 110;
    c.save();
    c.globalAlpha = 1 - k * 0.15;
    A.house(c, S.fly.id, x, y, d.w * (0.7 + k * 0.3), { c: S.fly.c });
    c.restore();
  }

  /* The party used to be invisible: it lived inside the table, and nothing said
     it existed, what it cost, or that it was worth pressing. Now it is a button
     that bobs above the table — it only exists once you own the table — and it
     says its price the way level 1 already understands: lit means yes, dim
     means not yet, and a ring fills as the fruit comes in. */
  function drawPartyButton(c) {
    var tav = null, g = br(), i;
    for (i = 0; i < g.items.length; i++) if (g.items[i].id === 'tavolino') { tav = g.items[i]; break; }
    if (!tav) return;

    var cost = partyCost(), can = fruitsOwned() >= cost;
    var bob = Math.sin(G.t * 2) * 5;
    var bx = tav.x, by = tav.y - 156 + bob;

    G.ui.round({
      id: 'festa', x: bx, y: by, r: 54,
      color: S.party > 0 ? C.sun : (can ? C.pinkPop : '#a49889'),
      icon: function (cc, x, y, r) { partyGlyph(cc, x, y, r * 0.82, S.party > 0); },
      onTap: function () { party(bx, by - 40); }
    });
    if (!can && S.party <= 0) {
      ring(c, bx + 62, by + 26, 22, G.clamp(fruitsOwned() / Math.max(1, cost), 0, 1));
    }
    if (big()) {
      G.text(String(cost), bx, by + 78, {
        ctx: c, size: 26, color: C.cream, weight: 800,
        stroke: 'rgba(12,40,25,.75)', strokeWidth: 7
      });
    }
  }

  /* A party hat and three bits of confetti — no letters, nothing to read. */
  function partyGlyph(c, cx, cy, r, going) {
    c.save();
    c.fillStyle = going ? C.berry : C.cream;
    c.beginPath();
    c.moveTo(cx, cy - r * 0.86);
    c.lineTo(cx + r * 0.52, cy + r * 0.30);
    c.lineTo(cx - r * 0.52, cy + r * 0.30);
    c.closePath();
    c.fill();
    c.strokeStyle = C.ink; c.lineWidth = Math.max(3, r * 0.11); c.stroke();
    c.fillStyle = going ? C.cream : C.berry;
    c.beginPath(); c.arc(cx, cy - r * 0.86, r * 0.15, 0, 7); c.fill();
    [[-0.78, 0.62, C.sun], [0.80, 0.50, C.mint], [0.10, 0.78, C.blueberry]].forEach(function (p, i) {
      c.fillStyle = p[2];
      var d = going ? Math.sin(G.t * 7 + i) * r * 0.12 : 0;
      c.beginPath();
      c.arc(cx + p[0] * r, cy + p[1] * r + d, r * 0.13, 0, 7);
      c.fill();
    });
    c.restore();
  }

  function drawParty(c) {
    var i, a, r;
    c.save();
    c.globalAlpha = G.clamp(S.party / 1.2, 0, 1) * 0.5;
    for (i = 0; i < 9; i++) {
      a = G.t * 1.4 + i * 0.7;
      r = 130 + Math.sin(G.t * 2 + i) * 26;
      c.fillStyle = [C.sun, C.pinkPop, C.mint, C.tangerine][i % 4];
      c.beginPath();
      c.arc(640 + Math.cos(a) * r, 300 + Math.sin(a) * r * 0.4, 9, 0, 7);
      c.fill();
    }
    c.restore();
    G.text('Festa!', 640, 200, {
      size: 62, color: C.cream, stroke: 'rgba(12,40,25,.75)', strokeWidth: 12
    });
  }

  function drawSoftNo(c) {
    if (S.softT <= 0) return;
    var k = S.softT / 1.1;
    c.save();
    c.globalAlpha = k;
    G.text('Servono piu frutti', S.softX, S.softY - 40 - (1 - k) * 30, {
      ctx: c, size: 30, color: C.cream, weight: 800,
      stroke: 'rgba(12,40,25,.75)', strokeWidth: 8
    });
    c.restore();
  }

  /* ---------------------------------------------------------- shop, level 1 */
  /* A permanent strip, never a modal: the modal hides the destination, and at
     three the destination IS the point. And no figures — the price is a state,
     not a number: lit means yes, dim means not yet, and the first dim one wears
     a ring that fills as the fruit comes in. */
  function shopList() {
    var out = [], i, d;
    for (i = 0; i < CAT.length; i++) {
      d = CAT[i];
      if (!inCatalog(d) || d.cost === 0) continue;
      if (countOf(d.id) >= 2) continue;
      out.push({ kind: 'item', d: d, cost: price(d.cost) });
    }
    SURF.forEach(function (s) {
      if (!hasSurf(s.id)) out.push({ kind: 'surf', s: s, cost: price(s.cost) });
    });
    out.sort(function (a, b) { return a.cost - b.cost; });
    return out;
  }

  /* Three cells, and the third is ALWAYS the cheapest surface you do not own —
     otherwise wallpaper and floors sit behind six cheaper pieces of furniture
     and a three-year-old never discovers they exist. */
  function shopCellsL1() {
    var list = shopList(), items = [], surfs = [], i;
    for (i = 0; i < list.length; i++) {
      if (list[i].kind === 'surf') surfs.push(list[i]); else items.push(list[i]);
    }
    var out = items.slice(0, 2);
    if (surfs.length) out.push(surfs[0]);
    while (out.length < 3 && items.length > out.length) out.push(items[out.length]);
    return out;
  }

  /* The shop lives ON THE WALL, not over the floor. It used to be a strip at
     y 596..708, which covered half the floor band and swallowed most of the tap
     disc of the very furniture it had just sold. Below y = 470 is the room now,
     and nothing else. */
  function drawShopL1(c) {
    var cells = shopCellsL1(), i, firstDim = -1;
    for (i = 0; i < cells.length; i++) {
      if (fruitsOwned() < cells[i].cost) { firstDim = i; break; }
    }
    for (i = 0; i < cells.length; i++) {
      (function (e, idx) {
        var bx = 44 + idx * 312, can = fruitsOwned() >= e.cost;
        G.ui.button({
          id: 'sl1' + idx, x: bx, y: 104, w: 300, h: 116, r: 26,
          color: can ? C.tangerine : '#a49889',
          icon: function (cc, cx, cy) { cellIcon(cc, e, cx, cy, 74); },
          onTap: function () {
            if (e.kind === 'surf') buySurface(e.s, bx + 150, 170);
            else buy(e.d, bx + 150, 170);
          }
        });
        if (idx === firstDim) {                    // "it is coming" without counting
          var k = G.clamp(fruitsOwned() / Math.max(1, e.cost), 0, 1);
          ring(c, bx + 264, 138, 22, k);
        }
      })(cells[i], i);
    }
    G.ui.round({
      id: 'dado', x: 1060, y: 160, r: 52, color: C.plum,
      icon: function (cc, x, y, r) { diceGlyph(cc, x, y, r * 0.86); },
      onTap: roll
    });
  }

  /* ---------------------------------------------------------- shop, level 2 */
  /* A cart, so the whole floor stays free for dragging — the exact opposite of
     the level 1 choice, for the opposite reason. The grid is FIXED and shows
     everything, dear things included: a child saving up for the 600 aquarium
     must be able to see it, or saving is never a choice. */
  function drawShopL2(c) {
    G.ui.round({
      id: 'cart', x: 1180, y: 636, r: 64, color: S.shop ? C.leaf : C.tangerine,
      icon: function (cc, x, y, r) { cartGlyph(cc, x, y, r * 0.8); },
      onTap: function () { S.shop = !S.shop; G.sfx('pop'); }
    });
    G.ui.round({
      id: 'brush', x: 1180, y: 486, r: 52, color: S.brush ? C.berry : C.cream,
      icon: function (cc, x, y, r) { brushGlyph(cc, x, y, r * 0.8, S.brush); },
      onTap: function () { S.brush = !S.brush; G.sfx('pop'); }
    });
    G.ui.round({
      id: 'tidy', x: 1180, y: 366, r: 52, color: C.blueberry,
      icon: function (cc, x, y, r) { tidyGlyph(cc, x, y, r * 0.8); },
      onTap: tidy
    });
    G.ui.round({
      id: 'dado', x: 1180, y: 246, r: 52, color: C.plum,
      icon: function (cc, x, y, r) { diceGlyph(cc, x, y, r * 0.82); },
      onTap: roll
    });
    if (!S.shop) return;

    var list = shopList(), i;
    A.panel(c, 600, 150, 660, 540, { r: 28 });
    G.text('Il carretto', 930, 196, { size: 36, color: C.ink });
    for (i = 0; i < 6 && i < list.length; i++) {
      (function (e, idx) {
        var bx = 620 + (idx % 3) * 208, by = 250 + Math.floor(idx / 3) * 216;
        var can = fruitsOwned() >= e.cost;
        G.ui.button({
          id: 'sl2' + (e.kind === 'surf' ? e.s.id : e.d.id), x: bx, y: by, w: 200, h: 200, r: 20,
          color: can ? C.cream : '#a49889',
          sub: String(e.cost),
          fontSize: 26,
          icon: function (cc, cx, cy) { cellIcon(cc, e, cx, cy - 12, 96); },
          onTap: function () {
            if (e.kind === 'surf') buySurface(e.s, bx + 100, by + 100);
            else buy(e.d, bx + 100, by + 100);
          }
        });
      })(list[i], i);
    }
  }

  /* The cell for a surface draws THE ROOM in that colour, so buying something
     that does not land is still an image of what you are buying. */
  function cellIcon(c, e, cx, cy, s) {
    if (e.kind === 'surf') {
      c.save();
      G.roundRect(c, cx - s * 0.62, cy - s * 0.44, s * 1.24, s * 0.88, 8);
      c.clip();
      c.translate(cx - s * 0.62, cy - s * 0.44);
      c.scale(s * 1.24 / 1280, s * 0.88 / 620);
      c.translate(0, -96);
      A.room(c, e.s.kind === 'wall' ? { wall: e.s.v, floor: br().floor } : { wall: br().wall, floor: e.s.v });
      c.restore();
      c.strokeStyle = C.bark; c.lineWidth = 4;
      G.roundRect(c, cx - s * 0.62, cy - s * 0.44, s * 1.24, s * 0.88, 8); c.stroke();
      return;
    }
    var d = e.d, k = Math.min(1, s / Math.max(40, d.w * 0.62));
    A.house(c, d.id, cx, cy + s * 0.36, d.w * k * 0.78, { c: countOf(d.id) % 4 });
  }

  /* --------------------------------------------------------------- glyphs */
  function ring(c, cx, cy, r, k) {
    c.save();
    c.strokeStyle = 'rgba(43,29,18,.28)'; c.lineWidth = 8; c.lineCap = 'round';
    c.beginPath(); c.arc(cx, cy, r, 0, 7); c.stroke();
    c.strokeStyle = C.sun; c.lineWidth = 8;
    c.beginPath(); c.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + k * 6.283); c.stroke();
    c.restore();
  }
  function diceGlyph(c, cx, cy, r) {
    c.save();
    c.fillStyle = C.cream;
    G.roundRect(c, cx - r * 0.62, cy - r * 0.62, r * 1.24, r * 1.24, r * 0.22); c.fill();
    c.strokeStyle = C.ink; c.lineWidth = Math.max(2.5, r * 0.09); c.stroke();
    c.fillStyle = C.ink;
    [[-0.28, -0.28], [0.28, -0.28], [0, 0], [-0.28, 0.28], [0.28, 0.28]].forEach(function (p) {
      c.beginPath(); c.arc(cx + p[0] * r, cy + p[1] * r, r * 0.10, 0, 7); c.fill();
    });
    c.restore();
  }
  function cartGlyph(c, cx, cy, r) {
    c.save();
    c.fillStyle = C.cream;
    c.beginPath();
    c.moveTo(cx - r * 0.7, cy - r * 0.5);
    c.lineTo(cx + r * 0.7, cy - r * 0.5);
    c.lineTo(cx + r * 0.44, cy + r * 0.24);
    c.lineTo(cx - r * 0.44, cy + r * 0.24);
    c.closePath(); c.fill();
    c.strokeStyle = C.ink; c.lineWidth = Math.max(3, r * 0.11); c.stroke();
    c.fillStyle = C.ink;
    c.beginPath(); c.arc(cx - r * 0.30, cy + r * 0.52, r * 0.15, 0, 7); c.fill();
    c.beginPath(); c.arc(cx + r * 0.30, cy + r * 0.52, r * 0.15, 0, 7); c.fill();
    c.restore();
  }
  function brushGlyph(c, cx, cy, r, on) {
    c.save();
    c.strokeStyle = on ? '#fff' : C.ink; c.lineWidth = Math.max(4, r * 0.16);
    c.lineCap = 'round';
    c.beginPath(); c.moveTo(cx - r * 0.4, cy + r * 0.5); c.lineTo(cx + r * 0.24, cy - r * 0.3);
    c.stroke();
    c.fillStyle = on ? '#fff' : C.ink;
    c.beginPath();
    c.moveTo(cx + r * 0.12, cy - r * 0.44);
    c.lineTo(cx + r * 0.62, cy - r * 0.68);
    c.lineTo(cx + r * 0.50, cy - r * 0.12);
    c.closePath(); c.fill();
    c.restore();
  }
  function tidyGlyph(c, cx, cy, r) {
    c.save();
    c.strokeStyle = '#fff'; c.lineWidth = Math.max(4, r * 0.15);
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(cx - r * 0.5, cy + r * 0.42); c.lineTo(cx + r * 0.5, cy + r * 0.42);
    c.moveTo(cx - r * 0.3, cy + r * 0.42); c.lineTo(cx - r * 0.3, cy - r * 0.1);
    c.lineTo(cx + r * 0.1, cy - r * 0.1); c.lineTo(cx + r * 0.1, cy + r * 0.42);
    c.moveTo(cx + r * 0.2, cy - r * 0.5); c.lineTo(cx + r * 0.2, cy + r * 0.42);
    c.stroke();
    c.restore();
  }
})();
