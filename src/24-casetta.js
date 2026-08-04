/* Dino Giungla — "La Casetta".

   The fifth place, and the first one in the whole game where fruit buys
   something that does not produce more fruit. Until now fruit bought producers
   that made more fruit: a closed circle, with no reason to HAVE fruit other than
   having more of it.

   TWO ROOMS — Salotto and Nanna — because one room could not hold the furniture.
   Measured: the twelve floor pieces are 2226px wide against 1100px of floor
   band, so with everything bought the overlap was arithmetic, not bad luck.
   The catalogue is SPLIT, never duplicated: same fourteen pieces over 2200px,
   which is the whole fix and costs no new art. Each room also has two LANES —
   back and front — because nine of the twelve pieces are taller than the band is
   deep, so a single row can only ever be a single row.

   AND THE HOUSE DOES NOT END. Buying everything used to be the finish line,
   reached in fifteen minutes. Now it is the STARTING line: a full house means
   more pieces that can be asked for, more seats, more guests, more moments. The
   content is not material, so the Nido's exponential fruit faucet cannot consume
   it — three nested cycles, all driven by the child's taps:
     1. a REQUEST: somebody wants to be taken to a piece you already own.
        Not a NEED — a need decays, and a need that gets worse while you are away
        is a failure state with a clock in it, and both are banned here. Toca
        Kitchen does not work on need either: you offer an onion and it sneezes.
        Offer-and-react, never lack-and-repair.
     2. a MOMENT of the day, every few requests: the light changes, and the same
        fourteen pieces mean five different things.
     3. the CAST: named guests come and go, one per party.

   THE LINE AGAINST THE NIDO, the real design risk since both are "buy things and
   put them in your space":
     - The catalogue is NOT a ladder. Nothing has a yield, nothing seats more than
       one, and `seats` is not correlated with price: the 25-fruit pouf and the
       300-fruit hammock do the same thing. No dominant strategy, no way to be
       wrong.
     - No clock: nothing here reads Date.now, and nothing changes while the scene
       is not running. The Nido makes VALUE while you are away; the Casetta makes
       BEHAVIOUR while you watch.
     - No faucet: not one G.addFruits. The first negative-sum place in the game.
     - No ghost outlines of what you do not own. That moment belongs to the Nido.

   Owns G.save.casetta. Reads G.save.nido.items[*].chicks READ-ONLY. */
(function () {
  'use strict';

  var C = G.C, W = G.W, H = G.H;

  var FLOOR_TOP = 498, FLOOR_BOT = 690;
  var X_MIN = 90, X_MAX = 1190;
  var WALL_TOP = 250, WALL_BOT = 412;
  var LANE_BACK = 524, LANE_FRONT = 666;
  var MAX_PER_ROOM = 8;
  var ROOMS = [
    { id: 0, name: 'Salotto', door: 1 },     // door on the right wall
    { id: 1, name: 'Nanna', door: -1 }       // door on the left wall
  ];

  /* Prices ride the ladder the game already speaks (the Nido's plants are
     25/60/140/300/600) and level 1 halves them exactly like buyCost does.
     `seats` is 0 or 1 and NEVER correlated with price: the moment a dearer piece
     seats more guests there is a right order to buy in, which is the one thing
     this room promised not to have.
     `r` is the room, and the home spots were laid out so that no two are closer
     than 140px — the previous layout had ten such pairs. */
  var CAT = [
    // ---- Salotto
    { id: 'ciotola', name: 'Ciotola', cost: 25, seats: 0, on: 'floor', r: 0, w: 96, home: [1090, 648], pose: 'happy', say: 'Che fame!', l1: true },
    { id: 'pouf', name: 'Pouf', cost: 25, seats: 1, on: 'floor', r: 0, w: 130, home: [880, 660], pose: 'idle', say: 'Che comodo!', l1: true },
    { id: 'finestra', name: 'Finestra', cost: 60, seats: 0, on: 'wall', r: 0, w: 210, home: [1000, 386], pose: 'think', say: 'Guarda la giungla!', l1: true },
    { id: 'tavolino', name: 'Tavolino', cost: 140, seats: 1, on: 'floor', r: 0, w: 190, home: [620, 672], pose: 'happy', say: 'Facciamo festa!', l1: true },
    { id: 'casetta', name: 'Casetta', cost: 300, seats: 0, on: 'floor', r: 0, w: 170, home: [700, 524], pose: 'happy', say: 'Casa dolce casa!', l1: true },
    { id: 'amaca', name: 'Amaca', cost: 300, seats: 1, on: 'floor', r: 0, w: 280, home: [230, 668], pose: 'sleep', say: 'Dondolooo...', l1: false },
    { id: 'acquario', name: 'Acquario', cost: 600, seats: 0, on: 'floor', r: 0, w: 210, home: [400, 528], pose: 'think', say: 'Ciao pesciolini!', l1: false },
    // ---- Nanna
    { id: 'tappeto', name: 'Tappeto', cost: 0, seats: 1, on: 'floor', r: 1, w: 240, home: [560, 664], pose: 'sleep', say: 'Che morbido!', l1: true },
    { id: 'lampada', name: 'Lampada', cost: 60, seats: 0, on: 'floor', r: 1, w: 130, home: [140, 520], pose: 'idle', say: 'Che bella luce!', l1: true },
    { id: 'pianta', name: 'Pianta', cost: 60, seats: 0, on: 'floor', r: 1, w: 150, home: [230, 668], pose: 'think', say: 'Che profumo!', l1: true },
    { id: 'lettino', name: 'Lettino', cost: 140, seats: 1, on: 'floor', r: 1, w: 250, home: [900, 676], pose: 'sleep', say: 'Buonanotte...', l1: true },
    { id: 'quadro', name: 'Quadro', cost: 140, seats: 0, on: 'wall', r: 1, w: 150, home: [560, 372], pose: 'think', say: 'Sono io!', l1: false },
    { id: 'libreria', name: 'Libreria', cost: 300, seats: 0, on: 'floor', r: 1, w: 180, home: [360, 516], pose: 'think', say: 'Che bel libro!', l1: false },
    { id: 'albero', name: 'Albero', cost: 600, seats: 0, on: 'floor', r: 1, w: 200, home: [1080, 524], pose: 'happy', say: 'Un albero in casa!', l1: false }
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

  /* The guests. A recurring cast with names is the single strongest pull on
     coming back after weeks, and it is the thing this game had none of. Each one
     wants a different piece, so the request changes meaning depending on who is
     living here — which is the reason to throw the twentieth party. */
  var CAST = [
    { id: 'pippi', name: 'Pippi', color: '#ff6fae', wants: 'ciotola' },
    { id: 'bubu', name: 'Bubu', color: '#4d80e4', wants: 'tappeto' },
    { id: 'momo', name: 'Momo', color: '#ffd75e', wants: 'tavolino' },
    { id: 'nina', name: 'Nina', color: '#38d9a9', wants: 'pianta' },
    { id: 'rufo', name: 'Rufo', color: '#ff9f43', wants: 'casetta' },
    { id: 'lulu', name: 'Lulu', color: '#8f5bd6', wants: 'lettino' }
  ];
  var CAST_BY = {};
  CAST.forEach(function (q) { CAST_BY[q.id] = q; });

  /* The five moments. Not persisted on purpose: a child coming back at nine in
     the morning to a midnight-blue house looks like a bug to a parent. */
  var MOMENTS = [
    { name: 'Mattina', say: 'Buongiorno!', tint: 'rgba(255,215,94,.10)', wants: ['lettino', 'tappeto', 'finestra'] },
    { name: 'Gioco', say: 'Si gioca!', tint: null, wants: ['casetta', 'albero', 'acquario', 'pouf'] },
    { name: 'Merenda', say: 'E ora della merenda!', tint: 'rgba(255,159,67,.10)', wants: ['ciotola', 'tavolino'] },
    { name: 'Sera', say: 'Si fa sera...', tint: 'rgba(143,91,214,.14)', wants: ['lampada', 'libreria', 'quadro'] },
    { name: 'Nanna', say: 'Tutti a nanna!', tint: 'rgba(77,128,228,.20)', wants: ['lettino', 'tappeto', 'amaca'] }
  ];

  function big() { return G.level === 2; }
  function price(cost) { return big() ? cost : Math.max(1, Math.round(cost / 2)); }
  function inCatalog(d) { return big() || d.l1; }
  function fruitsOwned() {
    var v = Number(G.save.fruits);
    return isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
  }

  /* ------------------------------------------------------------ save branch */
  function br() {
    var g = G.save.casetta;
    if (!g || typeof g !== 'object' || Array.isArray(g)) g = G.save.casetta = {};
    if (!Array.isArray(g.items)) g.items = [];
    g.items = g.items.filter(function (it) {
      return it && typeof it === 'object' && BY_ID[it.id];
    });
    g.items.forEach(function (it) {
      var d = BY_ID[it.id];
      it.c = Math.max(0, Math.min(3, Math.round(Number(it.c)) || 0));
      it.r = d.r;                              // the room is the catalogue's call
      it.x = clampX(Number(it.x), d);
      it.y = clampY(Number(it.y), d);
    });
    trimRooms(g);
    if (!Array.isArray(g.surf)) g.surf = [];
    g.surf = g.surf.filter(function (s) { return typeof s === 'string'; });
    g.wall = pair(g.wall, (A.WALL_N || 4) - 1);
    g.floor = pair(g.floor, (A.FLOOR_N || 4) - 1);
    if (!Array.isArray(g.cast)) g.cast = ['pippi', 'bubu', 'momo'];
    g.cast = g.cast.filter(function (id) { return CAST_BY[id]; });
    if (!g.cast.length) g.cast = ['pippi'];
    g.room = (g.room === 1) ? 1 : 0;
    if (typeof g.gift !== 'boolean') g.gift = false;
    if (typeof g.parties !== 'number' || !isFinite(g.parties) || g.parties < 0) g.parties = 0;
    return g;
  }
  function pair(v, max) {
    var a = Array.isArray(v) ? v : [v, v];
    return [clampInt(a[0], 0, max), clampInt(a[1], 0, max)];
  }
  function trimRooms(g) {
    var n = [0, 0], out = [];
    g.items.forEach(function (it) {
      if (n[it.r] >= MAX_PER_ROOM) return;
      n[it.r]++; out.push(it);
    });
    g.items = out;
  }
  function clampInt(v, a, b) {
    v = Math.round(Number(v));
    return isFinite(v) ? Math.max(a, Math.min(b, v)) : a;
  }
  function clampX(v, d) {
    if (!isFinite(v)) v = d.home[0];
    return Math.max(X_MIN + d.w * 0.2, Math.min(X_MAX - d.w * 0.2, v));
  }
  function clampY(v, d) {
    if (!isFinite(v)) v = d.home[1];
    return d.on === 'wall'
      ? Math.max(WALL_TOP, Math.min(WALL_BOT, v))
      : Math.max(FLOOR_TOP, Math.min(FLOOR_BOT, v));
  }

  function room() { return br().room; }
  function here(it) { return it.r === room(); }
  function items() { return br().items.filter(here); }
  function countOf(id) {
    return br().items.reduce(function (n, it) { return n + (it.id === id ? 1 : 0); }, 0);
  }
  function ownsId(id) { return countOf(id) > 0; }
  function hasSurf(id) { return br().surf.indexOf(id) >= 0; }
  function roomFull() { return items().length >= MAX_PER_ROOM; }

  /* Find a gap on a lane wide enough for a new piece, instead of dropping the
     second copy at home + [74, 14], which used to overlap by up to three
     quarters. Also what makes "A posto!" actually tidy. */
  function packLane(r, laneY, w, skip) {
    var used = br().items.filter(function (it) {
      return it !== skip && it.r === r && BY_ID[it.id].on === 'floor' &&
        Math.abs(it.y - laneY) < 60;
    }).map(function (it) {
      return [it.x - BY_ID[it.id].w / 2, it.x + BY_ID[it.id].w / 2];
    }).sort(function (a, b) { return a[0] - b[0]; });

    var cur = X_MIN, i;
    for (i = 0; i < used.length; i++) {
      if (used[i][0] - cur >= w + 20) return cur + w / 2 + 10;
      cur = Math.max(cur, used[i][1] + 20);
    }
    if (X_MAX - cur >= w) return cur + w / 2;
    return null;                                  // this lane is genuinely full
  }

  function placeNew(d) {
    var lane = d.home[1] < 600 ? LANE_BACK : LANE_FRONT;
    var x = packLane(d.r, lane, d.w, null);
    if (x === null) {
      lane = lane === LANE_BACK ? LANE_FRONT : LANE_BACK;
      x = packLane(d.r, lane, d.w, null);
    }
    if (x === null) { x = d.home[0]; lane = d.home[1]; }
    return { x: x, y: lane };
  }

  /* Guests: chicks hatched at the Nido come to live here once there is somewhere
     to sit. READ-ONLY on another scene's branch, and never a write. */
  function chicksBorn() {
    var nido = G.save.nido, k, it, n = 0;
    if (!nido || typeof nido !== 'object') return 0;
    var list = nido.items;
    if (!list || typeof list !== 'object') return 0;
    for (k in list) {
      if (!Object.prototype.hasOwnProperty.call(list, k)) continue;
      it = list[k];
      if (!it || typeof it !== 'object') continue;
      n += Math.max(0, Math.min(6, Math.floor(Number(it.chicks) || 0)));
    }
    return n;
  }
  function seatsTotal() {
    return br().items.reduce(function (n, it) { return n + (BY_ID[it.id].seats || 0); }, 0);
  }
  function guests() { return Math.max(0, Math.min(chicksBorn(), seatsTotal())); }
  G.casaOspiti = function () { return guests(); };

  /* ---------------------------------------------------------------- state */
  var S = {
    shop: false, brush: false,
    fly: null, drag: null,
    party: 0, idle: 0, nudges: 0, sayT: 0, sayMsg: null,
    softT: 0, softX: 0, softY: 0,
    moment: 0, beat: 0, tintK: 1, tintFrom: 0,
    ask: null, askT: 0,                 // {id, who} — who is null when it is the dino
    fade: 0, fadeTo: -1                 // room cross-fade
  };
  var D = { x: 640, y: 620, tx: 640, ty: 620, facing: 1, state: 'idle', t: 1.6, use: null, spont: false };

  function dinoSize() { return (big() ? 185 : 210) * A.roomDepth(D.y); }
  function moment() { return MOMENTS[S.moment % MOMENTS.length]; }

  function sendTo(it, spontaneous) {
    var d = BY_ID[it.id];
    D.tx = it.x; D.ty = d.on === 'wall' ? FLOOR_TOP + 40 : it.y;
    D.facing = D.tx >= D.x ? 1 : -1;
    D.state = 'walk'; D.use = it; D.spont = !!spontaneous;
  }
  function chooseSomething() {
    var pool = items();
    if (!pool.length) { D.state = 'idle'; D.t = 2 + Math.random() * 2; D.use = null; return; }
    sendTo(pool[G.rndi(0, pool.length - 1)], true);
  }
  function say(msg, delay) { S.sayMsg = msg; S.sayT = delay === undefined ? 0.1 : delay; }

  /* ------------------------------------------------------- the request cycle */
  /* HARD RULE: a request only ever names something you ALREADY OWN. Naming
     something from the shop would turn it into a shopping list, which this file
     forbids. Ignoring a request does nothing at all: no counter, no reward, no
     sad face — it just changes on its own after a while. */
  function newAsk() {
    var g = br(), pool = items().filter(function (it) { return BY_ID[it.id].on === 'floor'; });
    if (!pool.length) { S.ask = null; return; }
    var wanted = moment().wants;
    var liked = pool.filter(function (it) { return wanted.indexOf(it.id) >= 0; });
    var pick = (liked.length ? liked : pool)[G.rndi(0, (liked.length ? liked : pool).length - 1)];
    var who = null;
    if (big() && g.cast.length && guests() > 0 && Math.random() < 0.5) {
      who = CAST_BY[g.cast[G.rndi(0, g.cast.length - 1)]] || null;
      if (who) {
        var w = pool.filter(function (it) { return it.id === who.wants; });
        if (w.length) pick = w[0];
      }
    }
    S.ask = { id: pick.id, who: who };
    S.askT = 14;
    if (who) say(who.name + ' vuole ' + articleFor(pick.id) + BY_ID[pick.id].name + '!', 0.2);
  }
  function articleFor(id) {
    return (id === 'amaca' || id === 'casetta' || id === 'ciotola' ||
      id === 'lampada' || id === 'pianta' || id === 'libreria' || id === 'finestra') ? 'la ' : 'il ';
  }
  function satisfyAsk(it) {
    if (!S.ask || S.ask.id !== it.id) return;
    S.ask = null;
    G.sfx('good');
    G.fx.ring(it.x, it.y - 60, C.sun);
    S.beat++;
    if (S.beat >= (big() ? 4 : 3)) { S.beat = 0; nextMoment(); }
    else newAsk();
  }
  function nextMoment() {
    S.tintFrom = S.moment;
    S.moment = (S.moment + 1) % MOMENTS.length;
    S.tintK = 0;
    say(moment().say, 0.35);
    newAsk();
  }

  /* ------------------------------------------------------------- buying */
  function softNo(x, y) {
    S.softT = 1.1; S.softX = x; S.softY = y;
    /* deliberately NOT G.sfx('bad'): it is the only negative sound in a room
       that promises not to have one. */
    G.sfx('chime');
    G.say(G.pick(['Ci vogliono piu frutti!', 'Raccogli ancora un po di frutti!', 'Non bastano ancora!']));
  }

  function buy(d, cx, cy) {
    var g = br(), cost = price(d.cost);
    if (g.items.filter(function (it) { return it.r === d.r; }).length >= MAX_PER_ROOM) {
      G.sfx('pop'); G.say('Questa stanza e piena!');
      return;
    }
    if (fruitsOwned() < cost || !G.spend(cost)) { softNo(cx, cy); return; }
    var spot = d.on === 'wall' ? { x: d.home[0], y: d.home[1] } : placeNew(d);
    var it = { id: d.id, c: countOf(d.id) % 4, r: d.r, x: clampX(spot.x, d), y: clampY(spot.y, d) };
    g.items.push(it);
    G.saveNow();
    S.fly = { id: d.id, c: it.c, x: cx, y: cy, tx: it.x, ty: it.y, k: 0 };
    G.sfx('chime'); G.fx.ring(cx, cy, C.sun); G.fx.confetti();
    say(d.say, 0.5);
    if (!S.ask) newAsk();
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
    if (s.kind === 'wall') g.wall[room()] = s.v; else g.floor[room()] = s.v;
    G.saveNow(); G.sfx('whoosh');
  }

  /* At level 2 the dice no longer repaints hand-painted furniture: the brush and
     the dice were undoing each other, and there is no undo. It rolls the walls
     and floors of BOTH rooms, which is already a double surprise. */
  function roll() {
    var g = br(), i;
    for (i = 0; i < 2; i++) {
      g.wall[i] = ownedSurfV('wall');
      g.floor[i] = ownedSurfV('floor');
    }
    if (!big()) g.items.forEach(function (it) { it.c = G.rndi(0, 3); });
    G.saveNow();
    G.sfx('chime'); G.fx.confetti();
    G.say('Sorpresa!');
  }
  function ownedSurfV(kind) {
    var ok = [0], i, s;
    for (i = 0; i < SURF.length; i++) {
      s = SURF[i];
      if (s.kind === kind && hasSurf(s.id)) ok.push(s.v);
    }
    return ok[G.rndi(0, ok.length - 1)];
  }

  function tidy() {
    var g = br(), r, lane, x;
    [0, 1].forEach(function (rr) {
      [LANE_BACK, LANE_FRONT].forEach(function (ly) {
        var cur = X_MIN + 20;
        g.items.filter(function (it) {
          return it.r === rr && BY_ID[it.id].on === 'floor' &&
            Math.abs(BY_ID[it.id].home[1] - ly) < 80;
        }).forEach(function (it) {
          var d = BY_ID[it.id];
          it.x = clampX(cur + d.w / 2, d); it.y = ly;
          cur += d.w + 24;
        });
      });
    });
    void r; void lane; void x;
    G.saveNow(); G.sfx('pop'); G.say('A posto!');
  }

  function partyCost() {
    return price(Math.min(240, PARTY_COST + 20 * Math.max(0, br().parties - 2)));
  }
  function party(cx, cy) {
    if (S.party > 0) return;
    var g = br(), cost = partyCost();
    if (fruitsOwned() < cost || !G.spend(cost)) { softNo(cx, cy); return; }
    g.parties++;
    rotateCast(g);
    G.saveNow();
    S.party = 4.5;
    G.sfx('win'); G.fx.confetti();
    G.say(G.pick(['Che festa!', 'Evviva la festa!', 'Tutti a tavola!']));
  }
  /* One guest leaves and another arrives at every party: the reason to throw the
     twentieth one. */
  function rotateCast(g) {
    var away = CAST.filter(function (q) { return g.cast.indexOf(q.id) < 0; });
    if (!away.length) return;
    g.cast.shift();
    g.cast.push(away[G.rndi(0, away.length - 1)].id);
  }

  /* ---------------------------------------------------------- the door */
  function goRoom(to) {
    if (S.fade > 0 || to === room()) return;
    S.fadeTo = to;
    S.fade = 1;
    G.sfx('whoosh');
  }

  /* ================================================================ SCENE */
  G.scene('casetta', {
    enter: function () {
      var g = br();
      S.shop = false; S.brush = false; S.fly = null; S.drag = null;
      S.party = 0; S.idle = 0; S.nudges = 0; S.softT = 0;
      S.sayMsg = null; S.sayT = 0;
      S.moment = 0; S.beat = 0; S.tintK = 1; S.tintFrom = 0;
      S.ask = null; S.askT = 0; S.fade = 0; S.fadeTo = -1;
      g.room = 0;

      /* Two presents, one per room, so neither is ever empty on the first visit:
         a room with nothing in it is the only moment the house can look broken. */
      if (!g.gift) {
        g.gift = true;
        [BY_ID.tappeto, BY_ID.ciotola].forEach(function (d) {
          g.items.push({ id: d.id, c: 0, r: d.r, x: d.home[0], y: d.home[1] });
        });
        G.saveNow();
      }
      D.x = 640; D.y = 620; D.tx = 640; D.ty = 620;
      D.state = 'idle'; D.t = 1.4; D.use = null; D.facing = 1;
      newAsk();

      if (!G.save.seen) G.save.seen = {};
      var first = !G.save.seen.casetta;
      G.save.seen.casetta = true;
      G.saveNow();
      setTimeout(function () {
        if (G.current !== 'casetta') return;
        G.say(first
          ? 'Questa e la tua casetta! Guarda cosa vuole il dino.'
          : G.pick(['Bentornato a casa!', 'Cosa facciamo oggi?', 'Guarda chi c e!']));
      }, 420);
    },

    exit: function () { S.fly = null; S.drag = null; S.shop = false; },

    update: function (dt) {
      if (S.softT > 0) S.softT = Math.max(0, S.softT - dt);
      if (S.party > 0) S.party = Math.max(0, S.party - dt);
      if (S.tintK < 1) S.tintK = Math.min(1, S.tintK + dt / 1.2);
      if (S.sayT > 0) {
        S.sayT -= dt;
        if (S.sayT <= 0 && S.sayMsg) { G.say(S.sayMsg); S.sayMsg = null; }
      }
      if (S.fly) { S.fly.k += dt / 0.4; if (S.fly.k >= 1) S.fly = null; }

      if (S.fade > 0) {                       // crossing the door
        S.fade -= dt / 0.30;
        if (S.fade <= 0.5 && S.fadeTo >= 0) {
          var g = br();
          g.room = S.fadeTo; S.fadeTo = -1;
          G.saveNow();
          D.x = room() === 0 ? 200 : 1080; D.y = LANE_FRONT;
          D.tx = D.x; D.ty = D.y; D.state = 'idle'; D.t = 1.2; D.use = null;
          S.shop = false;
          newAsk();
        }
        if (S.fade < 0) S.fade = 0;
      }

      if (S.ask) { S.askT -= dt; if (S.askT <= 0) newAsk(); }

      if (S.party > 0) {
        var tav = items().filter(function (i) { return i.id === 'tavolino'; })[0];
        if (tav) { D.tx = tav.x - 90; D.ty = tav.y; }
        D.state = Math.abs(D.tx - D.x) > 8 ? 'walk' : 'use';
      } else if (D.state === 'walk') {
        var dx = D.tx - D.x, dy = D.ty - D.y, dist = Math.hypot(dx, dy);
        var step = (big() ? 270 : 305) * dt;
        if (dist <= step) {
          D.x = D.tx; D.y = D.ty; D.state = 'use';
          D.t = D.spont ? 3 + Math.random() * 2 : 3.4;
          if (D.use && !D.spont) {
            say(BY_ID[D.use.id].say, 0);
            satisfyAsk(D.use);
          }
        } else {
          D.x += dx / dist * step; D.y += dy / dist * step;
          D.facing = dx >= 0 ? 1 : -1;
        }
      } else {
        D.t -= dt;
        if (D.t <= 0) {
          if (D.state === 'use') { D.state = 'idle'; D.t = 4 + Math.random() * 3; D.use = null; }
          else chooseSomething();
        }
      }

      /* A nudge that DEMONSTRATES instead of explaining, and at level 1 the
         'Nanna' moment walks him through the door on his own — otherwise a
         three-year-old may never discover the second room exists. */
      S.idle += dt;
      if (!big() && S.idle > 8 && S.nudges < 2 && items().length) {
        S.idle = 0; S.nudges++;
        if (moment().name === 'Nanna' && room() === 0) goRoom(1);
        else chooseSomething();
      }
    },

    onDown: function (p) {
      S.idle = 0;
      if (S.fade > 0) return;
      if (S.shop) { S.shop = false; return; }

      var dr = ROOMS[room()].door;              // the door: walk through it
      var doorX = dr === 1 ? 1204 : 76;
      if (Math.abs(p.x - doorX) < 90 && p.y > 210 && p.y < 480) {
        goRoom(1 - room());
        return;
      }

      var list = items(), i, it, d, hit = -1, best = 1e9, dd;
      for (i = list.length - 1; i >= 0; i--) {
        it = list[i]; d = BY_ID[it.id];
        dd = Math.hypot(p.x - it.x, p.y - (d.on === 'wall' ? it.y - d.w * 0.3 : it.y - d.w * 0.25));
        if (dd < Math.max(58, d.w * 0.55) * (big() ? 1.06 : 1.30) && dd < best) { best = dd; hit = i; }
      }
      if (hit < 0) return;
      it = list[hit]; d = BY_ID[it.id];

      if (big() && S.brush) { it.c = (it.c + 1) % 4; G.saveNow(); G.sfx('pop'); return; }
      if (big()) {
        S.drag = { i: br().items.indexOf(it), dx: p.x - it.x, dy: p.y - it.y, moved: false, t: 0 };
      }
      sendTo(it, false);
      G.sfx('tap');
    },

    onMove: function (p) {
      if (!big() || !S.drag) return;
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
    var g = br(), r = room(), i;
    A.room(c, { wall: g.wall[r], floor: g.floor[r] });
    drawMomentTint(c);
    drawDoor(c);

    var list = [];
    g.items.filter(here).forEach(function (it, idx) {
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
    g.items.filter(here).forEach(function (it) {
      var d = BY_ID[it.id];
      if (A.HOUSE_FRONT[it.id]) A.houseFront(c, it.id, it.x, it.y, d.w * A.roomDepth(it.y), { c: it.c });
    });

    drawAsk(c);
    drawFly(c);
    drawPartyButton(c);
    if (S.party > 0) drawParty(c);
    if (big()) drawShopL2(c); else drawShopL1(c);
    drawSoftNo(c);
    drawFade(c);
    void i;
  }

  /* One rectangle, cross-faded on frame time. This is what makes fourteen pieces
     of furniture mean five different things. */
  function drawMomentTint(c) {
    var to = MOMENTS[S.moment].tint, from = MOMENTS[S.tintFrom].tint;
    var k = S.tintK;
    c.save();
    if (from && k < 1) { c.globalAlpha = 1 - k; c.fillStyle = from; c.fillRect(0, 96, W, 624); }
    if (to) { c.globalAlpha = k; c.fillStyle = to; c.fillRect(0, 96, W, 624); }
    c.restore();
  }

  function drawDoor(c) {
    var dr = ROOMS[room()].door;
    var x = dr === 1 ? 1204 : 76;
    A.porta(c, x, 470, 190, { side: dr });
    /* A pulsing dot when what is being asked for is in the other room — the
       reason two rooms are a mechanic and not two screens. */
    if (big() && S.ask && BY_ID[S.ask.id].r !== room()) {
      var col = (S.ask.who && S.ask.who.color) || C.sun;
      c.save();
      c.globalAlpha = 0.5 + Math.sin(G.t * 4) * 0.35;
      c.fillStyle = col;
      c.beginPath(); c.arc(x, 300, 22, 0, 7); c.fill();
      c.restore();
    }
  }

  function drawFade(c) {
    if (S.fade <= 0) return;
    c.save();
    c.globalAlpha = 1 - Math.abs(S.fade - 0.5) * 2;
    c.fillStyle = '#1c1208';
    c.fillRect(0, 0, W, H);
    c.restore();
  }

  /* The bubble: who wants what, drawn as the piece itself. Never blocks a tap,
     never counts, and expires on its own. */
  function drawAsk(c) {
    if (!S.ask) return;
    var d = BY_ID[S.ask.id];
    if (d.r !== room()) return;
    var r = big() ? 54 : 62;
    var bx = D.x, by = D.y - dinoSize() * 1.08 - r * 0.4;
    if (S.ask.who) {
      var q = guestList().filter(function (g2) { return g2.id === S.ask.who.id; })[0];
      if (q) { bx = q.x; by = q.y - 96; }
    }
    var pulse = 1 + Math.sin(G.t * 3) * 0.05;
    c.save();
    c.translate(bx, by); c.scale(pulse, pulse); c.translate(-bx, -by);
    c.fillStyle = 'rgba(255,246,224,.95)';
    c.beginPath(); c.arc(bx, by, r, 0, 7); c.fill();
    c.strokeStyle = (S.ask.who && S.ask.who.color) || C.bark;
    c.lineWidth = 6;
    c.beginPath(); c.arc(bx, by, r, 0, 7); c.stroke();
    c.beginPath();                               // the little tail
    c.moveTo(bx - 12, by + r * 0.86);
    c.lineTo(bx + 4, by + r * 1.34);
    c.lineTo(bx + 14, by + r * 0.80);
    c.closePath();
    c.fillStyle = 'rgba(255,246,224,.95)'; c.fill();
    c.restore();
    c.save();                                    // the piece, drawn small
    var k = Math.min(1, (r * 1.3) / Math.max(40, d.w * 0.7));
    A.house(c, d.id, bx, by + r * 0.42, d.w * k * 0.66, { c: 0 });
    c.restore();
  }

  function drawDino(c) {
    var s = dinoSize(), pose = 'idle';
    if (D.state === 'walk') pose = 'walk';
    else if (D.state === 'use' && D.use) pose = BY_ID[D.use.id].pose;
    if (S.party > 0 && D.state === 'use') pose = 'happy';
    var col = (G.account && G.account.color) || C.dino;
    A.dino(c, D.x, D.y, s, { facing: D.facing, pose: pose, t: G.t, color: col });
    if (D.spont && D.state === 'use') {
      G.text('!', D.x + D.facing * s * 0.34, D.y - s * 1.06, {
        ctx: c, size: 34, color: C.sun, stroke: 'rgba(43,29,18,.7)', strokeWidth: 7
      });
    }
  }

  var guestBuf = [];
  function guestList() {
    var n = guests(), g = br(), out = guestBuf, i;
    out.length = 0;
    var seats = g.items.filter(function (it) { return here(it) && BY_ID[it.id].seats > 0; });
    for (i = 0; i < n && i < seats.length; i++) {
      var who = CAST_BY[g.cast[i % g.cast.length]] || CAST[0];
      out.push({ x: seats[i].x + 44, y: seats[i].y - 4, i: i, id: who.id, name: who.name, color: who.color });
    }
    return out;
  }
  function drawGuest(c, q) {
    var k = A.roomDepth(q.y);
    var hop = S.party > 0 ? Math.abs(Math.sin(G.t * 6 + q.i)) * 18 : 0;
    var sleepy = moment().name === 'Nanna';
    if (A.chick) A.chick(c, q.x, q.y - 26 * k - hop, 62 * k, { t: G.t + q.i * 1.7, color: q.color });
    if (sleepy) {
      c.save();
      c.globalAlpha = 0.5 + Math.sin(G.t * 1.6 + q.i) * 0.3;
      G.text('z', q.x + 26 * k, q.y - 72 * k, { ctx: c, size: 22 * k, color: C.cream, stroke: 'rgba(43,29,18,.5)' });
      c.restore();
    }
  }

  function drawFly(c) {
    if (!S.fly) return;
    var k = G.ease(G.clamp(S.fly.k, 0, 1)), d = BY_ID[S.fly.id];
    var x = G.lerp(S.fly.x, S.fly.tx, k);
    var y = G.lerp(S.fly.y, S.fly.ty, k) - Math.sin(k * Math.PI) * 110;
    c.save(); c.globalAlpha = 1 - k * 0.15;
    A.house(c, S.fly.id, x, y, d.w * (0.7 + k * 0.3), { c: S.fly.c });
    c.restore();
  }

  function drawPartyButton(c) {
    var tav = items().filter(function (it) { return it.id === 'tavolino'; })[0];
    if (!tav) return;
    var cost = partyCost(), can = fruitsOwned() >= cost;
    var by = tav.y - 156 + Math.sin(G.t * 2) * 5, bx = tav.x;
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
  function partyGlyph(c, cx, cy, r, going) {
    c.save();
    c.fillStyle = going ? C.berry : C.cream;
    c.beginPath();
    c.moveTo(cx, cy - r * 0.86); c.lineTo(cx + r * 0.52, cy + r * 0.30);
    c.lineTo(cx - r * 0.52, cy + r * 0.30); c.closePath(); c.fill();
    c.strokeStyle = C.ink; c.lineWidth = Math.max(3, r * 0.11); c.stroke();
    c.fillStyle = going ? C.cream : C.berry;
    c.beginPath(); c.arc(cx, cy - r * 0.86, r * 0.15, 0, 7); c.fill();
    [[-0.78, 0.62, C.sun], [0.80, 0.50, C.mint], [0.10, 0.78, C.blueberry]].forEach(function (p, i) {
      c.fillStyle = p[2];
      var d = going ? Math.sin(G.t * 7 + i) * r * 0.12 : 0;
      c.beginPath(); c.arc(cx + p[0] * r, cy + p[1] * r + d, r * 0.13, 0, 7); c.fill();
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
      c.beginPath(); c.arc(640 + Math.cos(a) * r, 300 + Math.sin(a) * r * 0.4, 9, 0, 7); c.fill();
    }
    c.globalAlpha = G.clamp(S.party / 1.5, 0, 1);
    G.text('Festa!', 640, 200, {
      ctx: c, size: 62, color: C.cream, stroke: 'rgba(12,40,25,.75)', strokeWidth: 12
    });
    c.restore();
  }

  function drawSoftNo(c) {
    if (S.softT <= 0) return;
    var k = S.softT / 1.1;
    c.save(); c.globalAlpha = k;
    G.text('Servono piu frutti', S.softX, S.softY - 40 - (1 - k) * 30, {
      ctx: c, size: 30, color: C.cream, weight: 800,
      stroke: 'rgba(12,40,25,.75)', strokeWidth: 8
    });
    c.restore();
  }

  /* ---------------------------------------------------------- shop, level 1 */
  function shopList() {
    var out = [], i, d;
    for (i = 0; i < CAT.length; i++) {
      d = CAT[i];
      if (d.r !== room() || !inCatalog(d) || d.cost === 0) continue;
      if (countOf(d.id) >= 2) continue;
      out.push({ kind: 'item', d: d, cost: price(d.cost) });
    }
    SURF.forEach(function (s) {
      if (!hasSurf(s.id)) out.push({ kind: 'surf', s: s, cost: price(s.cost) });
    });
    out.sort(function (a, b) { return a.cost - b.cost; });
    return out;
  }
  function shopCellsL1() {
    var list = shopList(), its = [], srf = [], i;
    for (i = 0; i < list.length; i++) {
      if (list[i].kind === 'surf') srf.push(list[i]); else its.push(list[i]);
    }
    var out = its.slice(0, 2);
    if (srf.length) out.push(srf[0]);
    while (out.length < 3 && its.length > out.length) out.push(its[out.length]);
    return out;
  }

  /* The shop lives ON THE WALL. It used to be a strip over the floor band, which
     swallowed most of the tap disc of the very furniture it had just sold. */
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
        if (idx === firstDim) {
          ring(c, bx + 264, 138, 22, G.clamp(fruitsOwned() / Math.max(1, e.cost), 0, 1));
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
  /* The tool column lives on the wall WITHOUT the door, so it swaps side between
     rooms. Geometrically forced, and the weakest part of this layout: a button
     that moves is a button you have to look for. */
  function drawShopL2(c) {
    var tx = ROOMS[room()].door === 1 ? 104 : 1176;
    G.ui.round({
      id: 'cart', x: tx, y: 636, r: 64, color: S.shop ? C.leaf : C.tangerine,
      icon: function (cc, x, y, r) { cartGlyph(cc, x, y, r * 0.8); },
      onTap: function () { S.shop = !S.shop; G.sfx('pop'); }
    });
    G.ui.round({
      id: 'brush', x: tx, y: 496, r: 52, color: S.brush ? C.berry : C.cream,
      icon: function (cc, x, y, r) { brushGlyph(cc, x, y, r * 0.8, S.brush); },
      onTap: function () { S.brush = !S.brush; G.sfx('pop'); }
    });
    G.ui.round({
      id: 'tidy', x: tx, y: 376, r: 52, color: C.blueberry,
      icon: function (cc, x, y, r) { tidyGlyph(cc, x, y, r * 0.8); },
      onTap: tidy
    });
    G.ui.round({
      id: 'dado', x: tx, y: 176, r: 52, color: C.plum,
      icon: function (cc, x, y, r) { diceGlyph(cc, x, y, r * 0.82); },
      onTap: roll
    });
    if (!S.shop) return;

    var list = shopList(), i;
    var px = ROOMS[room()].door === 1 ? 210 : 410;
    A.panel(c, px, 150, 660, 540, { r: 28 });
    G.text('Il carretto', px + 330, 196, { size: 36, color: C.ink });
    for (i = 0; i < 6 && i < list.length; i++) {
      (function (e, idx) {
        var bx = px + 20 + (idx % 3) * 208, by = 250 + Math.floor(idx / 3) * 216;
        var can = fruitsOwned() >= e.cost;
        G.ui.button({
          id: 'sl2' + (e.kind === 'surf' ? e.s.id : e.d.id), x: bx, y: by, w: 200, h: 200, r: 20,
          color: can ? C.cream : '#a49889',
          sub: String(e.cost), fontSize: 26,
          icon: function (cc, cx, cy) { cellIcon(cc, e, cx, cy - 12, 96); },
          onTap: function () {
            if (e.kind === 'surf') buySurface(e.s, bx + 100, by + 100);
            else buy(e.d, bx + 100, by + 100);
          }
        });
      })(list[i], i);
    }
  }

  function cellIcon(c, e, cx, cy, s) {
    if (e.kind === 'surf') {
      var g = br(), r = room();
      c.save();
      G.roundRect(c, cx - s * 0.62, cy - s * 0.44, s * 1.24, s * 0.88, 8);
      c.clip();
      c.translate(cx - s * 0.62, cy - s * 0.44);
      c.scale(s * 1.24 / 1280, s * 0.88 / 620);
      c.translate(0, -96);
      A.room(c, e.s.kind === 'wall'
        ? { wall: e.s.v, floor: g.floor[r] }
        : { wall: g.wall[r], floor: e.s.v });
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
    c.moveTo(cx - r * 0.7, cy - r * 0.5); c.lineTo(cx + r * 0.7, cy - r * 0.5);
    c.lineTo(cx + r * 0.44, cy + r * 0.24); c.lineTo(cx - r * 0.44, cy + r * 0.24);
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
    c.moveTo(cx + r * 0.12, cy - r * 0.44); c.lineTo(cx + r * 0.62, cy - r * 0.68);
    c.lineTo(cx + r * 0.50, cy - r * 0.12); c.closePath(); c.fill();
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
