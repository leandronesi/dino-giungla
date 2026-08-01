/* Il Nido — the clearing you look after, plus the hat shop.

   Two tabs under the HUD: "Radura" (plots that grow fruit you tap to collect)
   and "Cappellini" (stars -> hats, the real reward of the whole game).

   Level 1 (3 years old): 3 plots, half price, no upgrades, one huge "Raccogli"
   button per plot so precision is never required, fat tap radius on the
   floating fruit, a free bush on the first visit, more spoken guidance.
   Level 2 (6 years old): all 5 plots, upgrades to level 5, level pips and
   growth bars, a single "Raccogli tutto" button up top, denser layout.

   Nothing here can be lost or failed: not enough fruit is a soft grey button
   and a kind sentence, never a scolding. Numbers stay under four digits by
   design (yield x1.6 per level, offline capped in both hours and harvests). */
(function () {
  'use strict';

  var C = G.C, W = G.W, H = G.H;

  /* ------------------------------------------------------------- constants */
  var GROUND = 498;            // horizon: plots stand here, buttons live below
  var TAB_Y = 104, TAB_H = 92; // tab strip, safely below the HUD band (y < 96)
  var FIELD_TOP = 206;         // taps above this line belong to the tab strip
  var BUB_TOP = 272, BUB_BOT = 424;
  var STORE_CAP = 999;         // fruit waiting on one plot (keeps it 3 digits)
  var MAX_BUB = 7;             // floating fruit per plot, then they merge
  var MAX_CHICKS = 6;
  var HATCH_EVERY = 3;         // harvests of the egg nest before one hatches
  var PET_CD = 2;              // seconds between petting rewards
  var OFFLINE_CAP = 8 * 3600;  // never count more than 8 hours away
  var OFFLINE_TICKS = 24;      // ...and at most 24 harvests per plot, so the
                               //    welcome-back number stays small and proud
  var WELCOME_MIN = 60;        // a 20 second absence is not worth a party
  var TAU = 6.2831853;

  /* ---------------------------------------------------------------- catalog */
  var DEFS = [
    { id: 'cespuglio', name: 'Cespuglio',    an: 'un cespuglio',    cost: 8,   every: 5,  base: 1, kind: 'fragola', color: C.leafLight },
    { id: 'banano',    name: 'Banano',       an: 'un banano',       cost: 25,  every: 7,  base: 2, kind: 'banana',  color: C.sun },
    { id: 'uova',      name: 'Nido di uova', an: 'un nido di uova', cost: 60,  every: 9,  base: 3, kind: 'uva',     color: C.plum },
    { id: 'stagno',    name: 'Stagno',       an: 'uno stagno',      cost: 140, every: 10, base: 5, kind: 'melone',  color: C.water },
    { id: 'orto',      name: 'Orto',         an: 'un orto',         cost: 300, every: 12, base: 9, kind: 'mela',    color: C.tangerine }
  ];

  function nSlots() { return G.level === 2 ? 5 : 3; }
  function maxLvl() { return G.level === 2 ? 5 : 1; }
  function buyCost(d) { return G.level === 2 ? d.cost : Math.max(1, Math.round(d.cost / 2)); }
  function yieldOf(d, lvl) { return Math.max(1, Math.round(d.base * Math.pow(1.6, (lvl || 1) - 1))); }
  function upCost(d, lvl) { return Math.round(d.cost * Math.pow(1.8, lvl || 1)); }
  function nShow(n) { n = Math.round(n); return n > 9999 ? '9999' : String(n); }
  function num(v, d) { v = Number(v); return isFinite(v) ? v : d; }

  /* ------------------------------------------------------------- art shims */
  /* The art library owns the house style; every call degrades to a decent
     local drawing so a half-loaded `A` can never blank the scene. */
  function A_(n) { return (typeof A !== 'undefined' && A && typeof A[n] === 'function') ? A[n] : null; }
  function hatCatalog() {
    var h = (typeof A !== 'undefined' && A) ? A.HATS : null;
    return (h && h.length) ? h : null;
  }
  function dinoColor() { return (G.account && G.account.color) || C.dino; }

  /* Stroke-then-fill a list of circles [x,y,r, x,y,r, ...] as one silhouette:
     the same trick the art library uses, so fallbacks still look like toys. */
  function blobs(c, list, col, lw) {
    var i;
    c.beginPath();
    for (i = 0; i < list.length; i += 3) {
      c.moveTo(list[i] + list[i + 2], list[i + 1]);
      c.arc(list[i], list[i + 1], list[i + 2], 0, TAU);
    }
    c.lineJoin = 'round'; c.lineCap = 'round';
    c.strokeStyle = C.ink; c.lineWidth = lw * 2; c.stroke();
    c.fillStyle = col; c.fill();
  }
  function fruitIcon(c, x, y, r, kind) {
    var f = A_('fruit');
    if (f) { f(c, x, y, r, kind || 'fragola'); return; }
    c.save(); c.fillStyle = C.berry;
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.restore();
  }
  function starIcon(c, x, y, r) {
    var f = A_('star');
    if (f) { f(c, x, y, r); return; }
    if (G.starIcon) { G.starIcon(c, x, y, r); return; }
    c.save(); c.fillStyle = C.sun;
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.restore();
  }
  function board(c, x, y, w, h, r) {
    var f = A_('panel');
    if (f) { f(c, x, y, w, h, { r: r || 26 }); return; }
    c.save();
    c.fillStyle = C.barkDark; G.roundRect(c, x, y + 6, w, h, r || 26); c.fill();
    c.fillStyle = C.cream; G.roundRect(c, x, y, w, h, r || 26); c.fill();
    c.strokeStyle = C.bark; c.lineWidth = 7;
    G.roundRect(c, x + 4, y + 4, w - 8, h - 8, (r || 26) - 4); c.stroke();
    c.restore();
  }
  function clockIcon(c, x, y, r) {
    c.save();
    c.fillStyle = C.cream; c.strokeStyle = C.ink; c.lineWidth = Math.max(2, r * .18);
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.stroke();
    c.lineCap = 'round'; c.lineWidth = Math.max(2, r * .16);
    c.beginPath();
    c.moveTo(x, y); c.lineTo(x, y - r * .58);
    c.moveTo(x, y); c.lineTo(x + r * .44, y + r * .14);
    c.stroke();
    c.restore();
  }
  function upGlyph(c, x, y, s) {
    c.save();
    c.strokeStyle = '#ffffff'; c.lineWidth = Math.max(5, s * .26);
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(x - s * .5, y + s * .12); c.lineTo(x, y - s * .48); c.lineTo(x + s * .5, y + s * .12);
    c.moveTo(x - s * .5, y + s * .60); c.lineTo(x, y);           c.lineTo(x + s * .5, y + s * .60);
    c.stroke();
    c.restore();
  }
  function arrowGlyph(c, x, y, s, dir) {
    c.save();
    c.strokeStyle = C.ink; c.lineWidth = Math.max(7, s * .32);
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(x + dir * s * .32, y - s * .62);
    c.lineTo(x - dir * s * .30, y);
    c.lineTo(x + dir * s * .32, y + s * .62);
    c.stroke();
    c.restore();
  }
  function checkBadge(c, x, y, r) {
    c.save();
    c.fillStyle = C.leafDark; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    c.strokeStyle = '#ffffff'; c.lineWidth = Math.max(4, r * .30);
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(x - r * .44, y + r * .02);
    c.lineTo(x - r * .10, y + r * .40);
    c.lineTo(x + r * .48, y - r * .40);
    c.stroke();
    c.restore();
  }

  /* -------------------------------------------------------------- save shape */
  /* Only G.save.nido (plus the hats branch the contract hands to this scene).
     Anything missing, stale or of the wrong type is rebuilt, never trusted. */
  function bank() {
    G.save.nido ??= {};
    if (!G.save.nido || typeof G.save.nido !== 'object' || Array.isArray(G.save.nido)) G.save.nido = {};
    var sv = G.save.nido;
    sv.items ??= {};
    if (!sv.items || typeof sv.items !== 'object' || Array.isArray(sv.items)) sv.items = {};
    if (sv.items.nido && !sv.items.uova) sv.items.uova = sv.items.nido;   // legacy id
    DEFS.forEach(function (d) {
      var it = sv.items[d.id];
      if (!it || typeof it !== 'object') it = sv.items[d.id] = {};
      it.n = num(it.n, 0) >= 1 ? 1 : 0;
      it.lvl = G.clamp(Math.round(num(it.lvl, 1)), 1, 5);
      it.t = G.clamp(num(it.t, 0), 0, d.every);
      it.pend = G.clamp(Math.round(num(it.pend, 0)), 0, STORE_CAP);
      it.egg = G.clamp(Math.round(num(it.egg, 0)), 0, HATCH_EVERY);
      it.chicks = G.clamp(Math.round(num(it.chicks, 0)), 0, MAX_CHICKS);
    });
    sv.lastSeen = num(sv.lastSeen, 0);
    sv.page = G.clamp(Math.round(num(sv.page, 0)), 0, 30);
    G.save.hats ??= [];
    if (!Array.isArray(G.save.hats)) G.save.hats = [];
    if (typeof G.save.hat !== 'string') G.save.hat = null;
    G.save.seen ??= {};
    if (!G.save.seen || typeof G.save.seen !== 'object') G.save.seen = {};
    return sv;
  }
  function starsOwned() { return Math.max(0, Math.floor(num(G.save.stars, 0))); }
  function fruitsOwned() { return Math.max(0, Math.floor(num(G.save.fruits, 0))); }

  /* Hats are the one place allowed to touch the star counter by hand. */
  function spendStars(n) {
    n = Math.round(n);
    if (starsOwned() < n) return false;
    G.save.stars = starsOwned() - n;
    G.saveNow();
    return true;
  }

  /* ------------------------------------------------------------ scene state */
  var S = {
    tab: 'radura',
    bub: {},          // def id -> [{x, y, v, ph}]
    chicks: [],       // {x: -1..1, dir, ph, sp}
    pet: {},          // def id -> petting cooldown left
    pop: {},          // def id -> squash animation 1 -> 0
    page: 0,
    tryId: null, tryT: 0,
    gift: false,
    idle: 0, hintT: 0, hello: 0, saveT: 0
  };
  var WB = { on: false, total: 0, chicks: 0, t: 0 };   // welcome-back panel
  var skyG = null, dirtG = null;

  /* --------------------------------------------------------------- geometry */
  var LC = null, LClevel = -1;
  function conf() {
    if (LClevel !== G.level) {
      LClevel = G.level;
      LC = G.level === 2
        ? { n: 5, w: 232, gap: 16, x0: 28,  bY: 516, bH: 112, iY: 664, bubR: 50, tapK: 1.06, perPage: 4, cardW: 190, cardGap: 14 }
        : { n: 3, w: 340, gap: 32, x0: 98,  bY: 508, bH: 132, iY: 684, bubR: 62, tapK: 1.30, perPage: 3, cardW: 256, cardGap: 20 };
    }
    return LC;
  }
  function colX(L, i) { return L.x0 + i * (L.w + L.gap); }
  function colCx(L, i) { return colX(L, i) + L.w / 2; }

  /* ------------------------------------------------------------- production */
  function bubSum(list) { var s = 0, i; for (i = 0; i < list.length; i++) s += list[i].v; return s; }

  /* Two bubbles stacked on top of each other make one of them untappable, so
     pick the candidate spot that sits farthest from the ones already there. */
  function placeBubble(L, i, list, v) {
    var cx = colCx(L, i), hw = L.w * .33;
    var best = null, bestD = -1, tries, b, j, near;
    for (tries = 0; tries < 6; tries++) {
      b = { x: cx + G.rnd(-hw, hw), y: G.rnd(BUB_TOP, BUB_BOT), v: v, ph: G.rnd(0, TAU) };
      near = 1e9;
      for (j = 0; j < list.length; j++) near = Math.min(near, G.dist(b.x, b.y, list[j].x, list[j].y));
      if (near > bestD) { bestD = near; best = b; }
      if (near > L.bubR * 1.3) break;
    }
    return best;
  }

  function addFruitTo(d, it, i, n) {
    n = Math.round(n);
    if (n <= 0) return;
    n = Math.min(n, STORE_CAP - it.pend);
    if (n <= 0) return;
    var L = conf(), list = S.bub[d.id], per = yieldOf(d, it.lvl), take;
    while (n > 0) {
      if (list.length >= MAX_BUB) { list[list.length - 1].v += n; break; }
      take = Math.min(n, per);
      list.push(placeBubble(L, i, list, take));
      n -= take;
    }
    it.pend = Math.min(STORE_CAP, bubSum(list));
  }

  function syncChicks(count) {
    while (S.chicks.length < count) {
      S.chicks.push({ x: G.rnd(-.7, .7), dir: G.pick([-1, 1]), ph: G.rnd(0, TAU), sp: G.rnd(.10, .26) });
    }
    while (S.chicks.length > count) S.chicks.pop();
  }

  function harvest(d, it, i) {
    addFruitTo(d, it, i, yieldOf(d, it.lvl));
    if (d.id !== 'uova') return;
    it.egg = (it.egg || 0) + 1;
    if (it.egg < HATCH_EVERY) return;
    it.egg = 0;
    if (it.chicks >= MAX_CHICKS) return;
    it.chicks++;
    syncChicks(it.chicks);
    G.sfx('hatch');
    var cx = colCx(conf(), i);
    G.fx.burst(cx, GROUND - 76, { color: C.cream, count: 14, speed: 210, size: 9, life: .65 });
    G.fx.ring(cx, GROUND - 76, C.cream, 120);
    G.say('È nato un cucciolo!');
  }

  /* --------------------------------------------------------- offline growth */
  function catchUp(sv) {
    var now = Date.now(), last = sv.lastSeen;
    var away = (!last || last > now) ? 0 : Math.min((now - last) / 1000, OFFLINE_CAP);
    sv.lastSeen = now;
    var res = { away: away, total: 0, hatched: 0, spare: 0, got: {} };
    var n = nSlots();
    DEFS.forEach(function (d, i) {
      var it = sv.items[d.id];
      if (!it.n) return;
      var carried = it.t + away, ticks = Math.floor(carried / d.every);
      it.t = G.clamp(carried - ticks * d.every, 0, d.every);
      ticks = Math.min(ticks, OFFLINE_TICKS);
      var got = ticks * yieldOf(d, it.lvl);
      if (d.id === 'uova' && ticks > 0) {
        var eggs = it.egg + ticks;
        it.egg = eggs % HATCH_EVERY;
        var born = Math.min(Math.floor(eggs / HATCH_EVERY), MAX_CHICKS - it.chicks);
        it.chicks += born; res.hatched += born;
      }
      if (i < n) { res.got[d.id] = got; res.total += got; }
      else { res.spare += got + it.pend; it.pend = 0; }   // a plot the profile no longer shows
    });
    return res;
  }

  /* ---------------------------------------------------------------- rewards */
  function pickBubble(d, it, k) {
    var list = S.bub[d.id], b = list[k];
    if (!b) return;
    list.splice(k, 1);
    it.pend = bubSum(list);
    G.addFruits(b.v, b.x, b.y);
    G.fx.burst(b.x, b.y, { color: d.color, count: 9, speed: 190, size: 10, life: .5, gravity: 340 });
    G.fx.ring(b.x, b.y, C.cream, 70);
    S.idle = 0; S.hintT = 0;
    G.saveNow();
  }

  function pickPlot(d, it, i) {
    var list = S.bub[d.id];
    if (!list.length) return 0;
    var tot = bubSum(list), cx = colCx(conf(), i);
    list.forEach(function (b) {
      G.fx.burst(b.x, b.y, { color: d.color, count: 6, speed: 160, size: 9, life: .45 });
    });
    S.bub[d.id] = [];
    it.pend = 0;
    G.addFruits(tot, cx, 340);
    G.fx.ring(cx, 340, C.cream, 150);
    S.idle = 0; S.hintT = 0;
    G.saveNow();
    return tot;
  }

  function pickEverything(sv) {
    var n = nSlots(), tot = 0;
    DEFS.forEach(function (d, i) {
      if (i >= n) return;
      tot += pickPlot(d, sv.items[d.id], i);
    });
    return tot;
  }

  function softNo(kind, x, y) {
    G.say(kind === 'star'
      ? 'Ti servono ancora un po\' di stelline.'
      : 'Ti servono ancora un po\' di frutti.');
    G.fx.text(x, y, 'Ancora un po\'!', C.cream, 34);
  }

  /* ------------------------------------------------------------- background */
  function drawBg(c) {
    if (!skyG) {
      skyG = c.createLinearGradient(0, 0, 0, GROUND);
      skyG.addColorStop(0, C.skyDeep);
      skyG.addColorStop(.58, C.sky);
      skyG.addColorStop(1, '#d3f0df');
      dirtG = c.createLinearGradient(0, GROUND, 0, H);
      dirtG.addColorStop(0, C.leafLight);
      dirtG.addColorStop(.30, C.leaf);
      dirtG.addColorStop(1, C.leafDark);
    }
    c.fillStyle = skyG; c.fillRect(0, 0, W, GROUND);

    // sun with a soft halo, drawn once — no canvas shadows anywhere in here
    c.save();
    c.fillStyle = 'rgba(255,215,94,.45)';
    c.beginPath(); c.arc(1096, 176, 104, 0, TAU); c.fill();
    c.fillStyle = C.sun;
    c.beginPath(); c.arc(1096, 176, 64, 0, TAU); c.fill();
    c.restore();

    // clouds
    var cl = A_('cloud'), i, x;
    for (i = 0; i < 3; i++) {
      x = ((G.t * 8 + i * 470) % (W + 360)) - 180;
      if (cl) cl(c, x, 176 + i * 44, 100 - i * 14);
      else {
        c.save(); c.fillStyle = 'rgba(255,255,255,.85)';
        c.beginPath(); c.arc(x, 176 + i * 44, 34, 0, TAU); c.fill();
        c.beginPath(); c.arc(x + 34, 182 + i * 44, 26, 0, TAU); c.fill();
        c.beginPath(); c.arc(x - 32, 184 + i * 44, 22, 0, TAU); c.fill();
        c.restore();
      }
    }

    // two cheap rows of jungle domes on the horizon
    c.fillStyle = '#1f6b3f';
    for (i = 0; i < 10; i++) { c.beginPath(); c.arc(i * 142 + 24, GROUND + 8, 96, Math.PI, 0); c.fill(); }
    c.fillStyle = C.leafDark;
    for (i = 0; i < 11; i++) { c.beginPath(); c.arc(i * 132 - 44, GROUND + 12, 76, Math.PI, 0); c.fill(); }

    c.fillStyle = dirtG; c.fillRect(0, GROUND, W, H - GROUND);
    c.save();
    c.fillStyle = 'rgba(255,255,255,.10)';
    c.beginPath(); c.ellipse(640, GROUND + 66, 660, 92, 0, 0, TAU); c.fill();
    c.restore();
  }

  function plotShadow(c, cx, rx) {
    c.save();
    c.fillStyle = 'rgba(40,26,10,.22)';
    c.beginPath(); c.ellipse(cx, GROUND + 4, rx, rx * .24, 0, 0, TAU); c.fill();
    c.restore();
  }

  /* -------------------------------------------------------------- producers */
  function pBush(c, cx, lvl) {
    var s = 132 + Math.min(lvl, 5) * 11, f = A_('bush'), i, a;
    if (f) f(c, cx, GROUND - s * .40, s, { berries: true, color: C.leaf });
    else {
      blobs(c, [
        cx, GROUND - s * .46, s * .40,
        cx - s * .34, GROUND - s * .26, s * .30,
        cx + s * .34, GROUND - s * .26, s * .30,
        cx, GROUND - s * .16, s * .34
      ], C.leaf, 4);
      c.save(); c.globalAlpha = .35; c.fillStyle = C.leafLight;
      c.beginPath(); c.ellipse(cx - s * .12, GROUND - s * .58, s * .20, s * .09, -.4, 0, TAU); c.fill();
      c.restore();
    }
    for (i = 0; i < Math.min(lvl, 5) + 1; i++) {
      a = -2.55 + i * .55;
      fruitIcon(c, cx + Math.cos(a) * s * .38, GROUND - s * .44 + Math.sin(a) * s * .26, 12, 'fragola');
    }
  }

  function pPalm(c, cx, lvl) {
    var s = 210 + Math.min(lvl, 5) * 14, f = A_('tree');
    var sway = Math.sin(G.t * .75) * 5, i, tx, ty;
    if (f) { f(c, cx, GROUND - s * .5, s, { kind: 'palma' }); }
    else {
      tx = cx + sway; ty = GROUND - s * .84;
      c.save();
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(cx - 4, GROUND);
      c.quadraticCurveTo(cx - 16, GROUND - s * .46, tx, ty);
      c.strokeStyle = C.ink; c.lineWidth = 30; c.stroke();
      c.strokeStyle = C.bark; c.lineWidth = 21; c.stroke();
      c.beginPath();
      for (i = 0; i < 6; i++) {
        var a = -2.62 + i * .52;
        var fx = tx + Math.cos(a) * s * .26, fy = ty + Math.sin(a) * s * .17;
        c.moveTo(fx + s * .24, fy);
        c.ellipse(fx, fy, s * .24, s * .075, a * .55, 0, TAU);
      }
      c.lineJoin = 'round';
      c.strokeStyle = C.ink; c.lineWidth = 8; c.stroke();
      c.fillStyle = C.leaf; c.fill();
      c.fillStyle = C.leafDark;
      c.beginPath(); c.arc(tx, ty - 4, 12, 0, TAU); c.fill();
      c.restore();
    }
    for (i = 0; i < 3; i++) {
      fruitIcon(c, cx - 24 + i * 24 + sway, GROUND - s * .58 + (i === 1 ? -8 : 0), 14, 'banana');
    }
  }

  function pNest(c, cx, lvl, it) {
    var eggFn = A_('egg'), chickFn = A_('chick'), i, ex;
    var eggs = Math.min(3, 1 + Math.floor(lvl / 2));
    var crack = G.clamp(((it.egg || 0) + it.t / 9) / HATCH_EVERY, 0, 1);
    // twig bowl
    c.save();
    blobs(c, [cx, GROUND - 24, 88], C.barkDark, 4);
    c.fillStyle = C.bark;
    c.beginPath(); c.ellipse(cx, GROUND - 34, 80, 27, 0, 0, TAU); c.fill();
    c.strokeStyle = C.barkDark; c.lineWidth = 5; c.lineCap = 'round';
    for (i = 0; i < 5; i++) {
      c.beginPath(); c.ellipse(cx - 52 + i * 26, GROUND - 30, 27, 13, .28 * i, Math.PI, 0); c.stroke();
    }
    c.restore();
    for (i = 0; i < eggs; i++) {
      ex = cx - (eggs - 1) * 26 + i * 52;
      if (eggFn) eggFn(c, ex, GROUND - 58, 64, { crack: i === 0 ? crack : 0, color: '#fff3d6' });
      else {
        c.save();
        c.fillStyle = '#fff3d6'; c.strokeStyle = C.ink; c.lineWidth = 4;
        c.beginPath(); c.ellipse(ex, GROUND - 58, 22, 28, 0, 0, TAU); c.fill(); c.stroke();
        c.restore();
      }
    }
    var hw = conf().w * .34;
    for (i = 0; i < S.chicks.length; i++) {
      var k = S.chicks[i];
      var hop = Math.abs(Math.sin(G.t * 5.6 + k.ph)) * 6;
      if (chickFn) chickFn(c, cx + k.x * hw, GROUND - 28 - hop, 54, { t: G.t + k.ph, color: dinoColor() });
      else {
        blobs(c, [cx + k.x * hw, GROUND - 44 - hop, 19], dinoColor(), 3);
      }
    }
  }

  function pPond(c, cx, lvl) {
    var rw = 94 + Math.min(lvl, 5) * 7, i, k, rockFn = A_('rock');
    c.save();
    c.fillStyle = '#255f6b';
    c.beginPath(); c.ellipse(cx, GROUND - 14, rw, 38, 0, 0, TAU); c.fill();
    c.fillStyle = C.water;
    c.beginPath(); c.ellipse(cx, GROUND - 20, rw - 10, 31, 0, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 3;
    for (i = 0; i < 3; i++) {
      k = (G.t * .3 + i / 3) % 1;
      c.globalAlpha = (1 - k) * .6;
      c.beginPath(); c.ellipse(cx, GROUND - 20, 14 + k * (rw - 24), 5 + k * 21, 0, 0, TAU); c.stroke();
    }
    c.globalAlpha = 1;
    for (i = 0; i < 3; i++) {
      var lx = cx - rw * .48 + i * rw * .48, ly = GROUND - 26 + (i % 2) * 12;
      c.fillStyle = i === 1 ? C.leafLight : C.leaf;
      c.beginPath(); c.ellipse(lx, ly, 21, 9, 0, 0, TAU); c.fill();
      c.fillStyle = C.leafDark;
      c.beginPath(); c.moveTo(lx, ly); c.lineTo(lx + 8, ly - 5); c.lineTo(lx + 8, ly + 5); c.fill();
    }
    c.restore();
    fruitIcon(c, cx + rw * .18, GROUND - 46 - Math.abs(Math.sin(G.t * 1.2)) * 8, 15, 'melone');
    if (rockFn) { rockFn(c, cx - rw - 6, GROUND - 12, 42); rockFn(c, cx + rw + 4, GROUND - 8, 30); }
    else {
      blobs(c, [cx - rw - 6, GROUND - 16, 22, cx + rw + 4, GROUND - 12, 16], '#9aa7a2', 4);
    }
  }

  function sprout(c, x, y, s, ph) {
    var sw = Math.sin(G.t * 1.1 + ph) * .2;
    c.save();
    c.translate(x, y); c.rotate(sw * .28);
    c.strokeStyle = C.leafDark; c.lineWidth = Math.max(2.5, s * .10); c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -s * .52); c.stroke();
    c.fillStyle = C.leafLight;
    c.beginPath(); c.ellipse(-s * .26, -s * .36, s * .30, s * .15, -.7, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(s * .26, -s * .36, s * .30, s * .15, .7, 0, TAU); c.fill();
    c.restore();
  }

  function pGarden(c, cx, lvl) {
    var r, i, x, hw, yy, flowerFn = A_('flower');
    c.save();
    c.fillStyle = '#6d4a2a';
    for (r = 0; r < 3; r++) {
      c.beginPath(); c.ellipse(cx, GROUND - 6 - r * 26, 104 - r * 17, 11, 0, 0, TAU); c.fill();
    }
    c.restore();
    for (r = 0; r < 3; r++) {
      hw = 86 - r * 17; yy = GROUND - 10 - r * 26;
      for (i = 0; i < 3; i++) {
        x = cx - hw + i * hw;
        sprout(c, x, yy, 30 + r * 4 + Math.min(lvl, 5) * 2, i + r * 2);
      }
    }
    if (flowerFn) { flowerFn(c, cx - 108, GROUND - 24, 26, C.pinkPop); flowerFn(c, cx + 110, GROUND - 20, 24, C.sun); }
    fruitIcon(c, cx - 44, GROUND - 40, 14, 'mela');
    fruitIcon(c, cx + 48, GROUND - 34, 13, 'melone');
  }

  function drawPlotArt(c, d, cx, it, ghost) {
    var lvl = ghost ? 1 : (it.lvl || 1);
    var pop = S.pop[d.id] || 0;
    var sy = 1 + Math.sin(pop * Math.PI) * .10;
    c.save();
    if (ghost) c.globalAlpha = .20;
    else plotShadow(c, cx, conf().w * .33);
    c.translate(cx, GROUND); c.scale(2 - sy, sy); c.translate(-cx, -GROUND);
    if (d.id === 'cespuglio') pBush(c, cx, lvl);
    else if (d.id === 'banano') pPalm(c, cx, lvl);
    else if (d.id === 'uova') pNest(c, cx, lvl, it);
    else if (d.id === 'stagno') pPond(c, cx, lvl);
    else pGarden(c, cx, lvl);
    c.restore();
  }

  /* --------------------------------------------------------- floating fruit */
  function drawBubbles(c, d, R) {
    var list = S.bub[d.id], i, b, by;
    for (i = 0; i < list.length; i++) {
      b = list[i];
      by = b.y + Math.sin(G.t * 1.7 + b.ph) * 8;
      c.save();
      c.globalAlpha = .30; c.fillStyle = '#ffffff';
      c.beginPath(); c.arc(b.x, by, R * .62, 0, TAU); c.fill();
      c.restore();
      fruitIcon(c, b.x, by, R * .44, d.kind);
      if (b.v > 1) {
        c.save();
        c.fillStyle = C.cream; c.strokeStyle = C.bark; c.lineWidth = 3;
        c.beginPath(); c.arc(b.x + R * .44, by - R * .44, 19, 0, TAU); c.fill(); c.stroke();
        c.restore();
        G.text(nShow(b.v), b.x + R * .44, by - R * .42, { size: 23, color: C.ink });
      }
    }
  }

  /* ------------------------------------------------------------------- tabs */
  function bushGlyph(c, x, y, s) {
    c.save();
    c.fillStyle = C.leafLight;
    c.beginPath(); c.arc(x, y - s * .06, s * .30, 0, TAU); c.fill();
    c.beginPath(); c.arc(x - s * .25, y + s * .11, s * .22, 0, TAU); c.fill();
    c.beginPath(); c.arc(x + s * .25, y + s * .11, s * .22, 0, TAU); c.fill();
    c.fillStyle = C.berry;
    c.beginPath(); c.arc(x - s * .10, y - s * .04, s * .09, 0, TAU); c.fill();
    c.beginPath(); c.arc(x + s * .15, y + s * .09, s * .09, 0, TAU); c.fill();
    c.restore();
  }
  function hatGlyph(c, x, y, s) {
    var f = A_('hat'), hats = hatCatalog();
    if (f && hats) { f(c, x, y, s * .95, hats[0].id); return; }
    c.save();
    c.fillStyle = C.berry;
    c.beginPath(); c.ellipse(x, y + s * .18, s * .46, s * .13, 0, 0, TAU); c.fill();
    c.beginPath(); c.arc(x, y + s * .08, s * .27, Math.PI, 0); c.fill();
    c.fillStyle = C.sun;
    c.fillRect(x - s * .27, y + s * .02, s * .54, s * .09);
    c.restore();
  }

  function drawTabs(c, sv) {
    var tabs = [
      { id: 'radura', label: 'Radura', icon: bushGlyph },
      { id: 'hats', label: 'Cappellini', icon: hatGlyph }
    ];
    tabs.forEach(function (o, i) {
      var on = S.tab === o.id;
      G.ui.button({
        id: 'nido-tab-' + o.id, x: 28 + i * 262, y: TAB_Y, w: 250, h: TAB_H, r: 26,
        color: on ? C.leaf : '#8b7c6b', fontSize: on ? 33 : 29,
        label: o.label, icon: o.icon,
        onTap: function () {
          if (S.tab === o.id) return;
          S.tab = o.id; S.idle = 0; S.tryT = 0; S.tryId = null;
          G.sfx('whoosh');
          G.say(o.id === 'hats' ? 'I cappellini!' : 'La radura!');
        }
      });
    });

    var sign = A_('sign');
    if (sign) sign(c, 578, TAB_Y - 4, 272, TAB_H + 8, 'Il Nido');
    else {
      board(c, 578, TAB_Y, 272, TAB_H, 24);
      G.text('Il Nido', 714, TAB_Y + TAB_H / 2, { size: 40, color: C.ink });
    }

    // Level 2 gets a single "collect everything" button; level 1 has one huge
    // button per plot instead, which is easier to understand at three.
    if (G.level !== 2 || S.tab !== 'radura') return;
    var n = nSlots(), tot = 0;
    DEFS.forEach(function (d, i) { if (i < n) tot += bubSum(S.bub[d.id]); });
    if (tot <= 0) return;
    G.ui.button({
      id: 'nido-all', x: 976, y: TAB_Y, w: 276, h: TAB_H, r: 26, color: C.leaf,
      label: nShow(tot), sub: 'Raccogli tutto', fontSize: 40,
      icon: function (cc, x, y, s) { fruitIcon(cc, x, y, s * .34, 'fragola'); },
      onTap: function () {
        var got = pickEverything(sv);
        if (got > 0) { G.sfx('good'); G.say('Che raccolto!'); }
      }
    });
  }

  /* ------------------------------------------------------------- the clearing */
  function drawField(c, sv, live) {
    var L = conf(), n = L.n, i;

    // soil patches
    for (i = 0; i < n; i++) {
      c.save();
      c.fillStyle = 'rgba(60,40,18,.18)';
      c.beginPath(); c.ellipse(colCx(L, i), GROUND + 6, L.w * .40, 21, 0, 0, TAU); c.fill();
      c.restore();
    }

    DEFS.forEach(function (d, i) {
      if (i >= n) return;
      var it = sv.items[d.id], cx = colCx(L, i);
      if (it.n) drawPlotArt(c, d, cx, it, false);
      else {
        c.save();
        c.setLineDash([13, 13]);
        c.lineDashOffset = -G.t * 12;
        c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 5;
        G.roundRect(c, colX(L, i) + 14, GROUND - 196, L.w - 28, 196, 26); c.stroke();
        c.setLineDash([]); c.lineDashOffset = 0;
        c.restore();
        drawPlotArt(c, d, cx, it, true);   // a faded preview of what grows here
      }

      // growth bar (gold and pulsing when the plot is full)
      if (!it.n) return;
      var bw = L.w * .56, bx = cx - bw / 2, full = it.pend >= STORE_CAP;
      c.save();
      c.fillStyle = 'rgba(18,48,30,.45)';
      G.roundRect(c, bx, GROUND + 12, bw, 11, 6); c.fill();
      if (full) {
        c.globalAlpha = .5 + Math.sin(G.t * 4) * .35;
        c.fillStyle = C.sun;
        G.roundRect(c, bx, GROUND + 12, bw, 11, 6); c.fill();
      } else {
        c.fillStyle = C.leafLight;
        G.roundRect(c, bx, GROUND + 12, Math.max(7, bw * G.clamp(it.t / d.every, 0, 1)), 11, 6); c.fill();
      }
      c.restore();
    });

    DEFS.forEach(function (d, i) { if (i < n) drawBubbles(c, d, L.bubR); });

    if (live) drawPlotButtons(c, sv, L, n);
    drawPlotInfo(c, sv, L, n);
  }

  function drawPlotButtons(c, sv, L, n) {
    DEFS.forEach(function (d, i) {
      if (i >= n) return;
      var it = sv.items[d.id], cx = colCx(L, i);
      var o = { id: 'nido-p-' + d.id, x: colX(L, i), y: L.bY, w: L.w, h: L.bH, r: 26 };

      if (!it.n) {
        /* --- buy: cost written with the fruit icon, name underneath */
        var cost = buyCost(d), can = fruitsOwned() >= cost;
        o.label = nShow(cost);
        o.sub = d.name;
        o.fontSize = G.level === 2 ? 42 : 50;
        o.color = can ? C.tangerine : '#a49889';
        o.icon = function (cc, x, y, s) { fruitIcon(cc, x, y, s * .36, 'fragola'); };
        o.onTap = function () {
          if (fruitsOwned() < cost || !G.spend(cost)) { softNo('fruit', cx, 370); return; }
          it.n = 1; it.lvl = 1; it.t = 0;
          S.pop[d.id] = 1;
          G.fx.confetti(); G.sfx('win');
          G.fx.ring(cx, GROUND - 90, C.cream, 200);
          G.say('Hai comprato ' + d.an + '!');
          G.saveNow();
        };

      } else if (G.level === 2 && it.lvl < maxLvl()) {
        /* --- upgrade (level 2 only): cost in fruit, level written small */
        var uc = upCost(d, it.lvl), canUp = fruitsOwned() >= uc;
        o.label = nShow(uc);
        o.sub = 'liv. ' + it.lvl + ' → ' + (it.lvl + 1);
        o.fontSize = 38;
        o.color = canUp ? C.plum : '#a49889';
        o.icon = function (cc, x, y, s) {
          fruitIcon(cc, x, y, s * .34, 'fragola');
          upGlyph(cc, o.x + o.w - o.h * .40, y, s * .40);
        };
        o.onTap = function () {
          if (fruitsOwned() < uc || !G.spend(uc)) { softNo('fruit', cx, 370); return; }
          it.lvl = Math.min(maxLvl(), it.lvl + 1);
          S.pop[d.id] = 1;
          G.sfx('win');
          G.fx.burst(cx, GROUND - 110, { color: C.sun, count: 22, speed: 270, size: 12, life: .8, shape: 'star' });
          G.say(d.name + ' più grande!');
          G.saveNow();
        };

      } else {
        /* --- harvest: the whole plot in one enormous tap */
        var ready = it.pend > 0;
        o.label = ready ? nShow(it.pend) : 'Cresce';
        o.sub = ready ? 'Raccogli' : null;
        o.fontSize = ready ? (G.level === 2 ? 40 : 50) : 32;
        o.color = ready ? C.leaf : '#a49889';
        o.icon = function (cc, x, y, s) { fruitIcon(cc, x, y, s * .36, d.kind); };
        o.onTap = function () {
          if (!ready) {
            G.say('I frutti stanno ancora crescendo.');
            G.fx.text(cx, 400, 'Cresce...', C.cream, 32);
            return;
          }
          var got = pickPlot(d, it, i);
          if (got > 0) { G.sfx('good'); G.say(G.pick(['Che bei frutti!', 'Buonissimi!', 'Bravo!'])); }
        };
      }
      G.ui.button(o);
    });
  }

  function drawPlotInfo(c, sv, L, n) {
    var big = G.level === 1 ? 1.18 : 1;
    DEFS.forEach(function (d, i) {
      if (i >= n) return;
      var it = sv.items[d.id], cx = colCx(L, i), y = L.iY;
      var per = yieldOf(d, it.n ? it.lvl : 1);
      c.save();
      c.globalAlpha = it.n ? 1 : .62;
      fruitIcon(c, cx - 70 * big, y, 15 * big, d.kind);
      G.text('×' + per, cx - 50 * big, y, {
        size: 27 * big, color: C.cream, align: 'left', stroke: 'rgba(10,36,22,.75)', strokeWidth: 7
      });
      clockIcon(c, cx + 24 * big, y, 15 * big);
      G.text(d.every + 's', cx + 44 * big, y, {
        size: 25 * big, color: C.cream, align: 'left', stroke: 'rgba(10,36,22,.75)', strokeWidth: 7
      });
      c.restore();
      if (G.level === 2 && it.n) {
        var k;
        for (k = 0; k < maxLvl(); k++) {
          c.save();
          c.fillStyle = k < it.lvl ? C.sun : 'rgba(255,255,255,.32)';
          c.beginPath(); c.arc(cx - 40 + k * 20, y + 28, k < it.lvl ? 8 : 6, 0, TAU); c.fill();
          c.restore();
        }
      }
    });
  }

  /* ------------------------------------------------------------- the hat shop */
  function previewHat() {
    if (S.tryT > 0 && S.tryId) return S.tryId;
    return G.save.hat || null;
  }
  function hatName(id) {
    var hats = hatCatalog(), i;
    if (!hats || !id) return 'Senza cappello';
    for (i = 0; i < hats.length; i++) if (hats[i].id === id) return hats[i].name || 'Cappello';
    return 'Cappello';
  }

  function drawShop(c) {
    var hats = hatCatalog(), L = conf();
    c.save(); c.fillStyle = 'rgba(9,32,21,.38)'; c.fillRect(0, FIELD_TOP - 6, W, H - FIELD_TOP + 6); c.restore();

    /* ---- left: the dino wearing whatever you are looking at */
    board(c, 36, 208, 372, 384, 30);
    var pid = previewHat();
    G.text(hatName(pid), 222, 254, { size: 30, color: C.ink, maxWidth: 330 });
    if (S.tryT > 0 && S.tryId && G.save.hats.indexOf(S.tryId) < 0) {
      G.text('lo stai provando', 222, 296, { size: 22, color: '#8a7864', weight: 700 });
    }
    var dinoFn = A_('dino');
    if (dinoFn) dinoFn(c, 222, 560, 244, { color: dinoColor(), hat: pid, pose: 'happy', t: G.t, facing: 1 });
    else blobs(c, [222, 480, 82, 222, 386, 54], dinoColor(), 5);

    var bare = !G.save.hat;
    G.ui.button({
      id: 'nido-bare', x: 36, y: 600, w: 372, h: 104, r: 26,
      color: bare ? '#a49889' : C.bark, label: 'Senza cappello', fontSize: 30,
      onTap: function () {
        S.tryT = 0; S.tryId = null;
        if (bare) { G.say('Il dino è già senza cappello.'); return; }
        G.save.hat = null; G.saveNow(); G.sfx('pop'); G.say('Senza cappello!');
      }
    });

    /* ---- right: the shelves */
    if (!hats) {
      board(c, 432, 208, 812, 336, 28);
      G.text('I cappellini arrivano presto!', 838, 348, { size: 36, color: C.ink });
      G.text('Intanto raccogli tante stelline', 838, 408, { size: 26, color: '#8a7864', weight: 700 });
      return;
    }

    var per = L.perPage, pages = Math.max(1, Math.ceil(hats.length / per));
    if (S.page >= pages) S.page = 0;
    var step = L.cardW + L.cardGap, first = S.page * per, i, h;
    for (i = 0; i < per; i++) {
      h = hats[first + i];
      if (!h) break;
      drawHatCard(c, h, 432 + i * step, 208, L.cardW, 336);
    }

    if (pages > 1) {
      G.ui.round({
        id: 'nido-prev', x: 520, y: 628, r: 62, color: C.cream,
        icon: function (cc, x, y, r) { arrowGlyph(cc, x, y, r * .5, -1); },
        onTap: function () { S.page = (S.page + pages - 1) % pages; G.sfx('whoosh'); }
      });
      G.ui.round({
        id: 'nido-next', x: 1160, y: 628, r: 62, color: C.cream,
        icon: function (cc, x, y, r) { arrowGlyph(cc, x, y, r * .5, 1); },
        onTap: function () { S.page = (S.page + 1) % pages; G.sfx('whoosh'); }
      });
      for (i = 0; i < pages; i++) {
        c.save();
        c.fillStyle = i === S.page ? C.sun : 'rgba(255,246,224,.45)';
        c.beginPath(); c.arc(840 - (pages - 1) * 16 + i * 32, 628, i === S.page ? 12 : 9, 0, TAU); c.fill();
        c.restore();
      }
    } else {
      starIcon(c, 740, 628, 22);
      G.text('Le stelline si vincono nei giochi!', 776, 628, {
        size: 28, color: C.cream, align: 'left', stroke: 'rgba(10,36,22,.7)', strokeWidth: 7
      });
    }
  }

  function drawHatCard(c, h, x, y, w, hh) {
    var owned = G.save.hats.indexOf(h.id) >= 0;
    var worn = G.save.hat === h.id;
    var price = Math.max(1, Math.round(num(h.price, 5)));
    var afford = starsOwned() >= price;
    var cx = x + w / 2;
    var face = worn ? '#ffe9a8' : owned ? '#dff5e6' : afford ? C.cream : '#ded3c4';

    c.save();
    c.fillStyle = 'rgba(30,18,6,.28)';
    G.roundRect(c, x, y + 8, w, hh, 26); c.fill();
    c.fillStyle = face;
    G.roundRect(c, x, y, w, hh, 26); c.fill();
    c.strokeStyle = worn ? '#d9a01c' : owned ? C.leafDark : C.bark;
    c.lineWidth = worn ? 8 : 5;
    G.roundRect(c, x + 4, y + 4, w - 8, hh - 8, 22); c.stroke();
    c.restore();

    var hatFn = A_('hat'), hs = G.level === 2 ? 118 : 150;
    if (hatFn) hatFn(c, cx, y + 126, hs, h.id);
    else {
      c.save();
      c.fillStyle = C.plum;
      c.beginPath(); c.ellipse(cx, y + 150, hs * .46, hs * .13, 0, 0, TAU); c.fill();
      c.beginPath(); c.arc(cx, y + 138, hs * .28, Math.PI, 0); c.fill();
      c.restore();
    }
    G.text(h.name || 'Cappello', cx, y + 224, {
      size: G.level === 2 ? 22 : 26, color: C.ink, maxWidth: w - 24
    });

    // action strip: price, or what tapping will do
    c.save();
    c.fillStyle = worn ? '#f6cf62' : owned ? '#b8e6c6' : 'rgba(40,24,8,.10)';
    G.roundRect(c, x + 14, y + 250, w - 28, 66, 20); c.fill();
    c.restore();
    if (worn) {
      G.text('Addosso!', cx, y + 283, { size: 27, color: '#6b4a08' });
    } else if (owned) {
      G.text('Indossa', cx, y + 283, { size: 27, color: C.leafDark });
    } else {
      var wide = price > 9 ? 20 : 12;
      starIcon(c, cx - wide - 20, y + 283, 20);
      G.text(nShow(price), cx - wide + 10, y + 283, {
        size: 34, color: afford ? C.ink : '#7d7166', align: 'left'
      });
    }
    if (owned) checkBadge(c, x + w - 30, y + 30, 19);

    // invisible hit area over the card art (the core paints the press state)
    G.ui.button({
      id: 'nido-hat-' + h.id, x: x, y: y, w: w, h: hh, r: 26, ghost: true,
      onTap: function () {
        S.tryId = h.id; S.tryT = 4;
        if (owned) {
          if (worn) { G.sfx('pop'); G.say('Ti sta benissimo!'); return; }
          G.save.hat = h.id; G.saveNow(); G.sfx('good');
          G.fx.ring(222, 420, C.sun, 180);
          G.fx.burst(222, 420, { color: C.sun, count: 14, speed: 220, size: 11, life: .7, shape: 'star' });
          G.say('Ecco ' + (h.name || 'il cappello') + '!');
          return;
        }
        if (spendStars(price)) {
          G.save.hats.push(h.id);
          G.save.hat = h.id;
          G.saveNow();
          G.fx.confetti(); G.sfx('win');
          G.fx.ring(222, 420, C.sun, 210);
          G.say('Hai comprato ' + (h.name || 'il cappello') + '!');
        } else {
          // no scolding: you get to try it on while you save up for it
          softNo('star', cx, y + 60);
        }
      }
    });
  }

  /* ------------------------------------------------------- welcome-back panel */
  function drawWelcome(c) {
    var i, a, rr;
    c.save(); c.fillStyle = 'rgba(8,26,18,.64)'; c.fillRect(0, 0, W, H); c.restore();

    // fruit orbiting the panel, the "look what grew" moment
    for (i = 0; i < 11; i++) {
      a = WB.t * .85 + i * (TAU / 11);
      rr = 316 + Math.sin(WB.t * 1.5 + i) * 26;
      fruitIcon(c, 640 + Math.cos(a) * rr, 356 + Math.sin(a) * rr * .52, 21, DEFS[i % DEFS.length].kind);
    }

    board(c, 300, 148, 680, 424, 34);
    G.text('Mentre non c\'eri...', 640, 216, { size: 46, color: C.ink });
    var bump = 1 + Math.sin(WB.t * 3.4) * .04;
    c.save();
    c.translate(640, 322); c.scale(bump, bump); c.translate(-640, -322);
    fruitIcon(c, 516, 322, 54, 'fragola');
    G.text('+' + nShow(WB.total), 594, 322, {
      size: 86, color: C.berry, align: 'left', stroke: 'rgba(70,18,26,.20)', strokeWidth: 9
    });
    c.restore();
    if (WB.chicks > 0) {
      G.text(WB.chicks === 1 ? 'e si è schiuso 1 cucciolo!' : 'e si sono schiusi ' + WB.chicks + ' cuccioli!',
        640, 396, { size: 27, color: '#8a7864', weight: 800 });
    }
    G.ui.button({
      id: 'nido-wb', x: 400, y: 424, w: 480, h: 126, r: 30, color: C.tangerine,
      label: 'Raccogli!', fontSize: 54,
      icon: function (cc, x, y, s) { fruitIcon(cc, x, y, s * .34, 'fragola'); },
      onTap: function () {
        G.addFruits(WB.total, 640, 322);
        G.fx.confetti(); G.sfx('win');
        G.say('Evviva!');
        WB.on = false; WB.total = 0; WB.chicks = 0;
        S.idle = 0;
      }
    });
  }

  /* -------------------------------------------------------------------- scene */
  G.scene('nido', {
    enter: function () {
      var sv = bank(), n = nSlots();
      S.tab = 'radura';
      S.bub = {}; S.chicks = []; S.pet = {}; S.pop = {};
      S.tryId = null; S.tryT = 0;
      S.idle = 0; S.hintT = 0; S.saveT = 0; S.hello = .5;
      S.page = G.clamp(sv.page, 0, 30);
      WB.on = false; WB.total = 0; WB.chicks = 0; WB.t = 0;
      DEFS.forEach(function (d) { S.bub[d.id] = []; });

      // a three-year-old must never meet an empty clearing he cannot afford
      var gift = false;
      if (G.level === 1 && !G.save.seen.nido && !sv.items.cespuglio.n) {
        sv.items.cespuglio.n = 1; sv.items.cespuglio.lvl = 1; sv.items.cespuglio.t = 0;
        gift = true;
      }
      G.save.seen.nido = true;

      var res = catchUp(sv);
      syncChicks(sv.items.uova.chicks);

      // rebuild the fruit that was floating when we left
      DEFS.forEach(function (d, i) {
        if (i >= n) return;
        var it = sv.items[d.id], waiting = it.pend;
        it.pend = 0;
        if (it.n && waiting > 0) addFruitTo(d, it, i, waiting);
      });

      var away = res.total + res.spare;
      if (res.away >= WELCOME_MIN && away >= 1) {
        WB.on = true; WB.total = Math.min(9999, Math.round(away)); WB.chicks = res.hatched;
        G.sfx('chime');
      } else {
        DEFS.forEach(function (d, i) {
          if (i >= n) return;
          if (sv.items[d.id].n && res.got[d.id]) addFruitTo(d, sv.items[d.id], i, res.got[d.id]);
        });
        if (res.spare > 0) G.addFruits(res.spare, 640, 380);
      }
      S.gift = gift;
      G.saveNow();
    },

    exit: function () {
      var sv = bank();
      DEFS.forEach(function (d) {
        sv.items[d.id].pend = G.clamp(Math.round(bubSum(S.bub[d.id] || [])), 0, STORE_CAP);
      });
      sv.lastSeen = Date.now();
      sv.page = S.page;
      // never swallow the welcome-back gift, even if we walk out on it
      if (WB.on && WB.total >= 1) { G.addFruits(WB.total, 640, 322); WB.on = false; WB.total = 0; }
      G.saveNow();
    },

    update: function (dt) {
      var sv = bank(), n = nSlots(), i, d;

      if (S.hello > 0) {
        S.hello -= dt;
        if (S.hello <= 0) {
          if (WB.on) G.say('Mentre non c\'eri sono cresciuti ' + WB.total + ' frutti!');
          else if (S.gift) G.say('Benvenuto nel Nido! Il primo cespuglio è un regalo per te.');
          else G.say(G.pick(['Benvenuto nel Nido!', 'Ecco la tua radura!', 'Guarda come cresce il Nido!']));
        }
      }
      if (S.tryT > 0) S.tryT = Math.max(0, S.tryT - dt);
      for (i = 0; i < DEFS.length; i++) {
        d = DEFS[i];
        if (S.pop[d.id] > 0) S.pop[d.id] = Math.max(0, S.pop[d.id] - dt * 2.6);
        if (S.pet[d.id] > 0) S.pet[d.id] = Math.max(0, S.pet[d.id] - dt);
      }

      if (WB.on) { WB.t += dt; return; }

      // growth
      DEFS.forEach(function (d, i) {
        if (i >= n) return;
        var it = sv.items[d.id];
        if (!it.n) return;
        if (it.pend >= STORE_CAP) { it.t = Math.min(it.t + dt, d.every); return; }
        it.t += dt;
        var guard = 0;
        while (it.t >= d.every && guard < 4) {
          it.t -= d.every; guard++;
          harvest(d, it, i);
          if (it.pend >= STORE_CAP) { it.t = d.every; break; }
        }
        if (it.t > d.every) it.t = d.every;
      });

      // chicks pottering about
      for (i = 0; i < S.chicks.length; i++) {
        var k = S.chicks[i];
        k.x += k.dir * k.sp * dt;
        if (k.x > .78) { k.x = .78; k.dir = -1; }
        if (k.x < -.78) { k.x = -.78; k.dir = 1; }
      }

      // a gentle nudge when ripe fruit is just sitting there
      var ripe = 0;
      DEFS.forEach(function (d, i) { if (i < n) ripe += bubSum(S.bub[d.id]); });
      S.idle += dt;
      if (S.tab === 'radura' && ripe > 0 && S.idle > 6) {
        S.hintT -= dt;
        if (S.hintT <= 0) {
          S.hintT = 2.4;
          var found = null;
          DEFS.forEach(function (d, i) { if (i < n && !found && S.bub[d.id].length) found = S.bub[d.id][0]; });
          if (found) G.fx.ring(found.x, found.y, C.cream, 110);
          if (G.level === 1 && S.idle > 11 && S.idle < 14) G.say('Tocca i frutti per raccoglierli!');
        }
      }

      // keep lastSeen honest while playing: nothing may ever be counted twice
      S.saveT += dt;
      if (S.saveT > 2) { S.saveT = 0; sv.lastSeen = Date.now(); G.saveNow(); }
    },

    draw: function (c) {
      var sv = bank();               // an ancient or partial save must not crash us
      drawBg(c);
      if (S.tab === 'radura') drawField(c, sv, !WB.on);
      else drawShop(c);
      if (!WB.on) drawTabs(c, sv);
      else drawWelcome(c);
    },

    onDown: function (p) {
      if (WB.on || S.tab !== 'radura' || p.y < FIELD_TOP) return;
      S.idle = 0; S.hintT = 0;

      var L = conf(), sv = bank(), n = L.n, i, j;
      var best = null, bestD = 1e9;

      // 1) floating fruit: the nearest one inside a very forgiving radius
      for (i = 0; i < n; i++) {
        var d = DEFS[i], list = S.bub[d.id];
        for (j = 0; j < list.length; j++) {
          var b = list[j];
          var by = b.y + Math.sin(G.t * 1.7 + b.ph) * 8;
          var dd = G.dist(p.x, p.y, b.x, by);
          if (dd < bestD && dd <= L.bubR * L.tapK) { bestD = dd; best = { d: d, k: j }; }
        }
      }
      if (best) { pickBubble(best.d, sv.items[best.d.id], best.k); return; }

      // 2) a stroke on the plot itself: always a little joy, +1 on a cooldown
      for (i = 0; i < n; i++) {
        var pd = DEFS[i], it = sv.items[pd.id];
        var x0 = colX(L, i), cx = colCx(L, i);
        if (p.x < x0 || p.x > x0 + L.w || p.y < GROUND - 256 || p.y > GROUND + 18) continue;
        if (!it.n) {
          G.sfx('tap');
          G.fx.burst(cx, GROUND - 8, { color: C.sand, count: 7, speed: 120, size: 8, life: .4 });
          return;
        }
        S.pop[pd.id] = 1;
        G.fx.burst(cx, GROUND - 96, { color: C.leafLight, count: 10, speed: 200, size: 11, life: .55, shape: 'rect' });
        if (pd.id === 'uova' && S.chicks.length) {
          G.sfx('pop');
          G.fx.text(cx, GROUND - 130, 'Squit!', C.cream, 34);
        } else {
          G.sfx('tap');
        }
        if ((S.pet[pd.id] || 0) <= 0) {
          S.pet[pd.id] = PET_CD;
          G.addFruits(1, cx, GROUND - 140);
        }
        return;
      }
    }
  });
})();
