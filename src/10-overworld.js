/* Dino Giungla — "giungla": the overworld hub.
   A place, not a menu: the child taps the trail and the dino walks there;
   tapping a station sign makes him walk to it and only then the minigame opens.
   Owns no save branch of its own — it only writes G.save.seen.giungla. */
(function () {
  'use strict';

  var W = G.W;

  /* The jungle is TWICE as wide as the screen and the camera follows the dino.
     Four signs already crowded one screenful — the name plaques were running off
     the left edge and colliding with each other — and a fifth place would have
     been impossible. Two arrows jump between the halves for anyone who does not
     want to walk. */
  var WORLD_W = 2560;
  var MAXCAM = WORLD_W - 1280;
  var cam = 0;              // current camera x, world coordinates
  var camHold = null;       // an arrow pinned the view here; walking releases it

  /* ------------------------------------------------------------- the trail */
  /* Hand-placed control points, smoothed into a polyline once at load time.
     The trail lives low on the screen, well clear of the HUD band (y < 96). */
  var CP = [
    [96, 664], [214, 628], [318, 568], [432, 552], [548, 598],
    [666, 640], [788, 622], [880, 560], [978, 514], [1096, 496], [1198, 528],
    [1320, 588], [1444, 632], [1566, 614], [1680, 554], [1794, 510],
    [1912, 526], [2030, 586], [2150, 634], [2272, 602], [2384, 546], [2470, 592]
  ];

  function crv(p0, p1, p2, p3, t) {           // Catmull-Rom, one axis
    var t2 = t * t, t3 = t2 * t;
    return 0.5 * ((2 * p1) + (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
  }

  var PATH = [];                               // [{x, y, s}] with cumulative arc length
  (function buildPath() {
    var SUB = 10, i, j, a, b, c, d, t, x, y, px = 0, py = 0, s = 0, first = true;
    for (i = 0; i < CP.length - 1; i++) {
      a = CP[i > 0 ? i - 1 : 0];
      b = CP[i];
      c = CP[i + 1];
      d = CP[i + 2 < CP.length ? i + 2 : CP.length - 1];
      for (j = 0; j < SUB; j++) {
        t = j / SUB;
        x = crv(a[0], b[0], c[0], d[0], t);
        y = crv(a[1], b[1], c[1], d[1], t);
        if (!first) s += Math.hypot(x - px, y - py);
        PATH.push({ x: x, y: y, s: s });
        px = x; py = y; first = false;
      }
    }
    var L = CP[CP.length - 1];
    s += Math.hypot(L[0] - px, L[1] - py);
    PATH.push({ x: L[0], y: L[1], s: s });
  })();
  var PLEN = PATH[PATH.length - 1].s;

  function posAt(s, out) {                     // point at arc length s
    s = G.clamp(s, 0, PLEN);
    var lo = 0, hi = PATH.length - 1, mid;
    while (lo < hi - 1) {
      mid = (lo + hi) >> 1;
      if (PATH[mid].s <= s) lo = mid; else hi = mid;
    }
    var a = PATH[lo], b = PATH[hi];
    var k = b.s > a.s ? (s - a.s) / (b.s - a.s) : 0;
    out.x = a.x + (b.x - a.x) * k;
    out.y = a.y + (b.y - a.y) * k;
    return out;
  }

  var nearHit = { s: 0, d: 0 };
  function nearestOnTrail(x, y) {              // project a tap onto the trail
    var i, p, d, best = 1e9, bs = 0;
    for (i = 0; i < PATH.length; i++) {
      p = PATH[i];
      d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
      if (d < best) { best = d; bs = p.s; }
    }
    nearHit.s = bs; nearHit.d = Math.sqrt(best);
    return nearHit;
  }

  function trailWidth(y) { return G.lerp(23, 45, G.clamp((y - 480) / 190, 0, 1)); }

  /* trail ribbon + pebbles: static geometry, computed once.
     Two ready-made polygons (edge + inner earth), decimated to every other
     sample — the curve is smooth enough and the tablet redraws them every frame.
     Pebbles are bucketed by opacity so the whole gravel is three fills a frame
     instead of fifty-four beginPath/fill pairs. */
  var PEB_A = [0.12, 0.19, 0.26];
  var ribbonOut = [], ribbonIn = [], pebbles = [[], [], []];
  (function buildLook() {
    var i, p, a, b, ux, uy, len, w;
    var lo = [], ro = [], li = [], ri = [];
    for (i = 0; i < PATH.length; i += 2) {
      p = PATH[i];
      a = PATH[i > 0 ? i - 1 : 0];
      b = PATH[i < PATH.length - 1 ? i + 1 : PATH.length - 1];
      ux = -(b.y - a.y); uy = (b.x - a.x);
      len = Math.hypot(ux, uy) || 1;
      ux /= len; uy /= len;
      w = trailWidth(p.y);
      lo.push([p.x + ux * w, p.y + uy * w]);
      ro.push([p.x - ux * w, p.y - uy * w]);
      li.push([p.x + ux * (w - 7), p.y + uy * (w - 7) + 5]);
      ri.push([p.x - ux * (w - 7), p.y - uy * (w - 7) + 5]);
    }
    ribbonOut = lo.concat(ro.reverse());
    ribbonIn = li.concat(ri.reverse());

    var seed = 20260801;
    var rn = function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    var k, q, off, g;
    for (i = 0; i < 54; i++) {
      k = Math.floor(rn() * (PATH.length - 2)) + 1;
      p = PATH[k]; q = PATH[k + 1];
      ux = -(q.y - p.y); uy = (q.x - p.x);
      len = Math.hypot(ux, uy) || 1;
      ux /= len; uy /= len;
      off = (rn() * 2 - 1) * trailWidth(p.y) * 0.68;
      g = Math.min(PEB_A.length - 1, Math.floor(rn() * PEB_A.length));
      pebbles[g].push({ x: p.x + ux * off, y: p.y + uy * off + 4, r: 2.4 + rn() * 4.6 });
    }
  })();

  /* ------------------------------------------------------------- stations */
  /* `go` is what the voice says to the little ones: the name alone is not an
     invitation, and each place needs its own article (alla / ai / al). */
  /* `sway` is the phase of the idle wobble, so the signs never move in lockstep.
     It used to be called `ph`, which drawStation() then overwrote with the
     plaque height — after one frame every sign swayed with the same phase. */
  var STATIONS = [
    { id: 'conta', name: 'La Radura dei Numeri', go: 'Andiamo alla Radura dei Numeri!', branch: 'conta', at: 0.075, sway: 0.0 },
    { id: 'fili', name: 'I Fili Intrecciati', go: 'Andiamo ai Fili Intrecciati!', branch: 'fili', at: 0.275, sway: 1.9 },
    { id: 'guardaroba', name: 'Il Guardaroba', go: 'Andiamo al Guardaroba!', branch: 'guardaroba', at: 0.495, sway: 5.5 },
    { id: 'nido', name: 'Il Nido', go: 'Andiamo al Nido!', branch: 'nido', at: 0.715, sway: 3.7 }
  ];

  /* How much has been done in each place, for the badge the big one gets.
     Other modules own these branches and may not have created them yet, so
     everything is read defensively. Note there is no `stars` inside a branch:
     stars are global (G.save.stars). What the minigames do persist is `done`
     (rounds finished); the nido counts hatched chicks instead. */
  function progressOf(branch) {
    var b = G.save && G.save[branch];
    if (!b || typeof b !== 'object') return 0;
    var v = b.done;
    if (typeof v === 'number' && isFinite(v) && v > 0) return Math.floor(v);
    var items = b.items, k, c, n = 0;
    if (items && typeof items === 'object') {
      for (k in items) {
        if (!Object.prototype.hasOwnProperty.call(items, k)) continue;
        c = items[k] && items[k].chicks;
        if (typeof c === 'number' && isFinite(c) && c > 0) n += Math.floor(c);
      }
    }
    return n;
  }

  /* --------------------------------------------------------- decorations */
  var TREES = [
    { x: 62, y: 508, s: 250, kind: 'grande' },
    { x: 236, y: 470, s: 186, kind: 'palma' },
    { x: 512, y: 476, s: 208, kind: 'grande' },
    { x: 742, y: 456, s: 168, kind: 'felce' },
    { x: 862, y: 462, s: 182, kind: 'palma' },
    { x: 1224, y: 512, s: 244, kind: 'grande' },
    { x: 1388, y: 470, s: 178, kind: 'felce' },
    { x: 1552, y: 486, s: 214, kind: 'grande' },
    { x: 1738, y: 452, s: 166, kind: 'palma' },
    { x: 1908, y: 478, s: 196, kind: 'grande' },
    { x: 2094, y: 458, s: 172, kind: 'felce' },
    { x: 2258, y: 480, s: 206, kind: 'palma' },
    { x: 2448, y: 512, s: 246, kind: 'grande' }
  ];
  /* props sit beside the trail; kept sorted by y so the dino can slot in by depth */
  var PROPS = [
    { k: 'bush', x: 168, y: 552, s: 74, berries: true },
    { k: 'flower', x: 404, y: 512, s: 34, c: '#ff6fae' },
    { k: 'rock', x: 470, y: 522, s: 40 },
    { k: 'flower', x: 606, y: 546, s: 30, c: '#ffd75e' },
    { k: 'bush', x: 934, y: 528, s: 70, berries: false },
    { k: 'flower', x: 1042, y: 560, s: 32, c: '#8f5bd6' },
    { k: 'rock', x: 268, y: 596, s: 34 },
    { k: 'bush', x: 596, y: 676, s: 92, berries: true },
    { k: 'flower', x: 830, y: 682, s: 38, c: '#ff9f43' },
    { k: 'rock', x: 1128, y: 656, s: 46 },
    { k: 'bush', x: 42, y: 712, s: 108, berries: false },
    { k: 'bush', x: 1256, y: 706, s: 104, berries: true },
    { k: 'flower', x: 1362, y: 528, s: 34, c: '#ffd75e' },
    { k: 'rock', x: 1470, y: 546, s: 42 },
    { k: 'bush', x: 1604, y: 560, s: 76, berries: true },
    { k: 'flower', x: 1732, y: 500, s: 30, c: '#ff6fae' },
    { k: 'rock', x: 1866, y: 486, s: 36 },
    { k: 'bush', x: 1984, y: 522, s: 70, berries: false },
    { k: 'flower', x: 2118, y: 566, s: 36, c: '#8f5bd6' },
    { k: 'rock', x: 2246, y: 540, s: 44 },
    { k: 'bush', x: 2372, y: 690, s: 96, berries: true },
    { k: 'flower', x: 1548, y: 684, s: 38, c: '#ff9f43' },
    { k: 'bush', x: 1900, y: 672, s: 88, berries: false },
    { k: 'rock', x: 2140, y: 700, s: 48 },
    { k: 'bush', x: 2520, y: 712, s: 104, berries: true }
  ].sort(function (a, b) { return a.y - b.y; });

  var CLOUDS = [
    { x: 180, y: 136, s: 78, v: 5 },
    { x: 620, y: 178, s: 62, v: 7 },
    { x: 980, y: 132, s: 88, v: 4 }
  ];
  var BUGS = [
    { cx: 330, cy: 486, rx: 74, ry: 34, ph: 0.0, c: '#ff6fae', s: 15 },
    { cx: 736, cy: 512, rx: 96, ry: 28, ph: 2.2, c: '#ffd75e', s: 13 },
    { cx: 1050, cy: 448, rx: 68, ry: 40, ph: 4.1, c: '#4d80e4', s: 14 },
    { cx: 1490, cy: 494, rx: 82, ry: 32, ph: 1.3, c: '#ffd75e', s: 14 },
    { cx: 1880, cy: 458, rx: 70, ry: 38, ph: 3.4, c: '#ff6fae', s: 13 },
    { cx: 2290, cy: 500, rx: 90, ry: 30, ph: 5.2, c: '#4d80e4', s: 15 }
  ];

  /* --------------------------------------------------------- dino & state */
  var dino = { s: 0, target: 0, x: 0, y: 0, facing: 1, happy: 0 };
  var state = 'idle';                 // 'idle' | 'walk' | 'enter'
  var pending = null;                 // station id we are walking to
  var enterT = 0;
  var SPEED = 260, SIGN_R = 100;
  var big = false;                    // G.level 2; anything else gets the easy set
  var visited = false;                // session-scoped: first entry ever this run
  var lastStop = null;                // where we left from — module var, never saved
  var lastProfile = null;             // the above two belong to ONE player only
  var sayT = 0, sayMsg = null;        // greeting queued: see enter()
  var idleT = 0, nudges = 0;          // the little one gets a hand if he freezes
  var tmpA = { x: 0, y: 0 }, tmpB = { x: 0, y: 0 };

  var POKES = [
    'Ciao! Sono qui!',
    'Che bella giornata!',
    'Mi fai il solletico!',
    'Andiamo a giocare?',
    'Roar! Cioè... ciao!',
    'Dove andiamo adesso?'
  ];
  var BACKS = ['Eccoci qua!', 'E adesso dove andiamo?', 'Che bel giro!'];
  var lastPoke = -1;

  /* One voice line at a time, and always on a delay: the account screen keeps
     talking for a moment after it hands over ("Benvenuto nella giungla, X!")
     and G.say cancels whatever came before, so speaking at once would cut it. */
  function speak(msg, delay) { sayMsg = msg; sayT = delay; }
  function hushPending() { sayMsg = null; sayT = 0; }

  function nearestStation() {
    var i, d, best = 1e9, out = STATIONS[0];
    for (i = 0; i < STATIONS.length; i++) {
      d = Math.abs(STATIONS[i].s - dino.s);
      if (d < best) { best = d; out = STATIONS[i]; }
    }
    return out;
  }

  function pokeDino() {
    var i = G.rndi(0, POKES.length - 1);
    if (i === lastPoke) i = (i + 1) % POKES.length;
    lastPoke = i;
    dino.happy = 1.2;
    G.sfx('pop');
    G.say(POKES[i]);
    G.fx.burst(dino.x - cam, dino.y - 90, {
      color: G.C.sun, count: 8, speed: 170, life: 0.5, size: 9, gravity: 320
    });
  }

  function walkTo(s, id) {
    dino.target = G.clamp(s, 0, PLEN);
    pending = id || null;
    camHold = null;                 // he moves, so the camera goes back to him
    state = Math.abs(dino.target - dino.s) < 3 ? 'idle' : 'walk';
    if (state === 'idle') arrive();
  }

  function arrive() {
    dino.s = dino.target;
    if (pending) {
      state = 'enter';
      enterT = 0.34;
      dino.happy = 0.6;
      G.sfx('whoosh');
    } else {
      state = 'idle';
      G.fx.burst(dino.x - cam, dino.y, {
        color: '#d8c08a', count: 6, speed: 90, life: 0.35, size: 8, gravity: 260
      });
    }
  }

  function goStation(st) {
    G.sfx('tap');
    G.fx.ring(st.cx - cam, st.cy, G.C.sun, SIGN_R + 40);
    st.pop = 1;
    // The little ones cannot read: the sign invites them out loud instead.
    if (!big) G.say(st.go);
    walkTo(st.s, st.id);
  }

  /* ------------------------------------------------------------- drawing */
  function poly(c, pts) {
    var i;
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    c.closePath();
  }

  function drawTrail(c) {
    var i, g, grp, pb;
    c.save();
    poly(c, ribbonOut);
    c.fillStyle = '#8a5f33';
    c.fill();
    poly(c, ribbonIn);
    c.fillStyle = G.C.sand;
    c.fill();
    c.fillStyle = '#5b3a1c';
    for (g = 0; g < pebbles.length; g++) {
      grp = pebbles[g];
      if (!grp.length) continue;
      c.globalAlpha = PEB_A[g];
      c.beginPath();
      for (i = 0; i < grp.length; i++) {
        pb = grp[i];
        c.moveTo(pb.x + pb.r, pb.y);       // moveTo first, or the arcs join up
        c.arc(pb.x, pb.y, pb.r, 0, 7);
      }
      c.fill();
    }
    c.restore();
  }

  function iconConta(c, cx, cy, r) {
    var y = cy - r * 0.34;
    A.fruit(c, cx - r * 0.42, y + r * 0.05, r * 0.20, 'fragola');
    A.fruit(c, cx, y - r * 0.05, r * 0.20, 'mela');
    A.fruit(c, cx + r * 0.42, y + r * 0.05, r * 0.20, 'uva');
    G.text('3', cx, cy + r * 0.40, {
      ctx: c, size: r * 0.80, color: G.C.berry, stroke: 'rgba(255,255,255,.95)'
    });
  }

  function iconFili(c, cx, cy, r) {
    c.save();
    c.lineWidth = r * 0.15;
    c.lineCap = 'round';
    c.strokeStyle = G.C.plum;
    c.beginPath();
    c.moveTo(cx - r * 0.42, cy + r * 0.20);
    c.quadraticCurveTo(cx, cy - r * 0.52, cx + r * 0.42, cy + r * 0.20);
    c.stroke();
    c.fillStyle = G.C.berry;
    c.beginPath(); c.arc(cx - r * 0.42, cy + r * 0.20, r * 0.26, 0, 7); c.fill();
    c.fillStyle = G.C.blueberry;
    c.beginPath(); c.arc(cx + r * 0.42, cy + r * 0.20, r * 0.26, 0, 7); c.fill();
    c.fillStyle = 'rgba(255,255,255,.55)';
    c.beginPath(); c.arc(cx - r * 0.48, cy + r * 0.12, r * 0.09, 0, 7); c.fill();
    c.beginPath(); c.arc(cx + r * 0.36, cy + r * 0.12, r * 0.09, 0, 7); c.fill();
    c.restore();
  }

  function iconNido(c, cx, cy, r) {
    var by = cy + r * 0.30;
    A.egg(c, cx, by - r * 0.30, r * 0.86, {});
    c.save();
    c.fillStyle = G.C.barkDark;
    c.beginPath(); c.ellipse(cx, by, r * 0.66, r * 0.34, 0, 0, Math.PI); c.fill();
    c.fillStyle = G.C.bark;
    c.beginPath(); c.ellipse(cx, by, r * 0.66, r * 0.26, 0, 0, Math.PI); c.fill();
    c.strokeStyle = G.C.barkDark;
    c.lineWidth = r * 0.07;
    c.lineCap = 'round';
    var i, a;
    for (i = 0; i < 4; i++) {
      a = 0.42 + i * 0.58;
      c.beginPath();
      c.moveTo(cx - r * 0.60 + i * r * 0.34, by + r * 0.04);
      c.lineTo(cx - r * 0.30 + i * r * 0.34, by + r * 0.24 * Math.sin(a));
      c.stroke();
    }
    c.restore();
  }

  /* A chest with the lid open and something bright coming out of it. Deliberately
     not a wardrobe: at r = 74 a cupboard is a brown rectangle, a chest is a
     silhouette even a three-year-old reads. */
  function iconGuardaroba(c, cx, cy, r) {
    var w = r * 0.78, by = cy + r * 0.42;
    c.save();
    c.fillStyle = G.C.sun;                       // glow from inside
    c.globalAlpha = 0.55;
    c.beginPath(); c.ellipse(cx, by - r * 0.34, w * 0.86, r * 0.40, 0, 0, 7); c.fill();
    c.globalAlpha = 1;
    c.fillStyle = G.C.barkDark;                  // open lid, tipped back
    c.beginPath();
    c.moveTo(cx - w, by - r * 0.30);
    c.quadraticCurveTo(cx, by - r * 1.16, cx + w, by - r * 0.52);
    c.lineTo(cx + w * 0.86, by - r * 0.30);
    c.quadraticCurveTo(cx, by - r * 0.86, cx - w * 0.86, by - r * 0.14);
    c.closePath(); c.fill();
    c.fillStyle = G.C.bark;                      // body
    G.roundRect(c, cx - w, by - r * 0.28, w * 2, r * 0.62, r * 0.10); c.fill();
    c.fillStyle = G.C.barkDark;
    c.fillRect(cx - w, by - r * 0.04, w * 2, r * 0.13);
    c.fillStyle = G.C.sun;                       // clasp
    c.beginPath(); c.arc(cx, by + r * 0.03, r * 0.13, 0, 7); c.fill();
    if (G.starPath) {                            // a star escaping the chest
      c.fillStyle = G.C.sun;
      G.starPath(c, cx + r * 0.44, by - r * 0.74, r * 0.20); c.fill();
      G.starPath(c, cx - r * 0.30, by - r * 0.60, r * 0.13); c.fill();
    }
    c.restore();
  }

  var ICONS = { conta: iconConta, fili: iconFili, nido: iconNido, guardaroba: iconGuardaroba };

  function drawBadge(c, x, y, n) {
    c.save();
    c.fillStyle = 'rgba(255,246,224,.96)';
    G.roundRect(c, x - 48, y - 23, 96, 46, 23);
    c.fill();
    c.strokeStyle = 'rgba(122,74,38,.5)';
    c.lineWidth = 3;
    c.stroke();
    G.starIcon(c, x - 23, y, 15);
    G.text(n > 99 ? '99+' : String(n), x + 17, y + 1, { ctx: c, size: 27, color: G.C.ink });
    c.restore();
  }

  /* A present waiting at the Guardaroba. This is the one badge the little one
     gets too: he cannot read the number, but a thing that pulses on a sign
     means "something for you is over there", and that he understands. */
  function drawCrateBadge(c, x, y, n) {
    var k = 1 + Math.sin(G.t * 4) * 0.08;
    c.save();
    c.translate(x, y); c.scale(k, k); c.translate(-x, -y);
    c.fillStyle = G.C.sun;
    c.beginPath(); c.arc(x, y, 33, 0, 7); c.fill();
    c.strokeStyle = 'rgba(122,74,38,.55)'; c.lineWidth = 3; c.stroke();
    c.fillStyle = G.C.barkDark;
    G.roundRect(c, x - 17, y - 12, 34, 22, 4); c.fill();
    c.fillStyle = G.C.bark;
    G.roundRect(c, x - 15, y - 14, 30, 9, 3); c.fill();
    c.fillStyle = G.C.sun;
    c.beginPath(); c.arc(x, y - 2, 4, 0, 7); c.fill();
    if (n > 1) {
      G.text(String(Math.min(9, n)), x + 22, y + 18, {
        ctx: c, size: 24, color: G.C.ink, stroke: 'rgba(255,246,224,.95)', strokeWidth: 6
      });
    }
    c.restore();
  }

  /* Two arrows to hop between the halves without walking. They pin the camera;
     the moment the dino moves anywhere the pin is released and the view goes
     back to following him. One mental model, no modes: you are always looking
     at wherever the dino is about to be. */
  function camArrow(c, x, y, r, dir) {
    c.save();
    c.strokeStyle = G.C.ink; c.lineWidth = Math.max(7, r * 0.20);
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(x + dir * r * 0.22, y - r * 0.42);
    c.lineTo(x - dir * r * 0.22, y);
    c.lineTo(x + dir * r * 0.22, y + r * 0.42);
    c.stroke();
    c.restore();
  }

  function drawArrows() {
    if (MAXCAM <= 0) return;
    var target = camHold !== null ? camHold : G.clamp(dino.x - W / 2, 0, MAXCAM);
    if (target > 12) {
      G.ui.round({
        id: 'cam-l', x: 76, y: 372, r: 56, color: 'rgba(255,246,224,.82)',
        icon: function (cc, x, y, r) { camArrow(cc, x, y, r, -1); },
        onTap: function () { camHold = 0; G.sfx('whoosh'); }
      });
    }
    if (target < MAXCAM - 12) {
      G.ui.round({
        id: 'cam-r', x: W - 76, y: 372, r: 56, color: 'rgba(255,246,224,.82)',
        icon: function (cc, x, y, r) { camArrow(cc, x, y, r, 1); },
        onTap: function () { camHold = MAXCAM; G.sfx('whoosh'); }
      });
    }
  }

  function plaqueWidth(c, st, size) {
    if (st._w && st._ws === size) return st._w;
    c.save();
    c.font = G.font(size);
    var w = c.measureText(st.name).width;
    c.restore();
    st._ws = size;
    st._w = Math.max(190, Math.min(320, w + 46));
    return st._w;
  }

  function drawStation(c, st) {
    var r = SIGN_R * (1 + st.pop * 0.07);
    var cx = st.cx, cy = st.cy, base = st.by;
    var i, a;

    c.save();
    c.translate(cx, base);
    c.rotate(Math.sin(G.t * 0.8 + st.sway) * 0.022);   // slow, gentle sway
    c.translate(-cx, -base);

    // ground contact
    c.fillStyle = 'rgba(20,10,0,.20)';
    c.beginPath(); c.ellipse(cx, base + 2, 46, 12, 0, 0, 7); c.fill();

    // posts
    var y0 = cy + r * 0.5;
    c.fillStyle = G.C.barkDark;
    c.fillRect(cx - 32, y0, 18, base - y0);
    c.fillRect(cx + 14, y0, 18, base - y0);
    c.fillStyle = G.C.bark;
    c.fillRect(cx - 30, y0, 11, base - y0);
    c.fillRect(cx + 16, y0, 11, base - y0);

    // the little ones get a soft halo that keeps saying "tap me"
    if (!big) {
      c.fillStyle = G.C.sun;
      c.globalAlpha = 0.14 + 0.10 * Math.sin(G.t * 2 + st.sway);
      c.beginPath(); c.arc(cx, cy, r + 20, 0, 7); c.fill();
      c.globalAlpha = 1;
    }

    // round board
    c.fillStyle = 'rgba(20,10,0,.18)';
    c.beginPath(); c.arc(cx + 6, cy + 11, r, 0, 7); c.fill();
    c.fillStyle = G.C.barkDark;
    c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fill();
    c.fillStyle = G.C.bark;
    c.beginPath(); c.arc(cx, cy, r * 0.93, 0, 7); c.fill();
    c.fillStyle = G.C.cream;
    c.beginPath(); c.arc(cx, cy, r * 0.80, 0, 7); c.fill();
    c.strokeStyle = 'rgba(122,74,38,.35)';
    c.lineWidth = 4;
    c.beginPath(); c.arc(cx, cy, r * 0.72, 0, 7); c.stroke();
    c.fillStyle = 'rgba(78,47,24,.55)';
    for (i = 0; i < 6; i++) {
      a = i * Math.PI / 3 + 0.5;
      c.beginPath();
      c.arc(cx + Math.cos(a) * r * 0.87, cy + Math.sin(a) * r * 0.87, 4, 0, 7);
      c.fill();
    }

    ICONS[st.id](c, cx, cy, r * 0.74);

    // name plaque — its box is remembered so a tap on it counts as a tap on
    // the sign, otherwise the most label-looking part of the sign is dead.
    var fs = big ? 26 : 30;
    var pw = plaqueWidth(c, st, fs), ph = fs + 24;
    var px = cx - pw / 2, py = cy + r + 4;
    st.px = px; st.py = py; st.pw = pw; st.ph = ph;
    A.panel(c, px, py, pw, ph, { r: 14 });
    G.text(st.name, cx, py + ph / 2, {
      ctx: c, size: fs, color: G.C.ink, maxWidth: pw - 26
    });

    var waiting = (st.id === 'guardaroba' && typeof G.crates === 'function') ? G.crates() : 0;
    if (waiting > 0) {
      drawCrateBadge(c, cx + r * 0.78, cy - r * 0.80, waiting);
    } else if (big) {
      // the big one can also read how much he has done in each place
      var n = progressOf(st.branch);
      if (n > 0) drawBadge(c, cx + r * 0.78, cy - r * 0.80, n);
    }

    c.restore();
  }

  function butterfly(c, x, y, s, col, ph) {
    var f = Math.abs(Math.sin(G.t * 9 + ph));
    var w = s * (0.35 + 0.65 * f);
    c.save();
    c.translate(x, y);
    c.fillStyle = col;
    c.beginPath(); c.ellipse(-w * 0.58, -s * 0.14, w * 0.58, s * 0.44, -0.34, 0, 7); c.fill();
    c.beginPath(); c.ellipse(w * 0.58, -s * 0.14, w * 0.58, s * 0.44, 0.34, 0, 7); c.fill();
    c.fillStyle = G.shade(col, -46);
    c.beginPath(); c.ellipse(-w * 0.44, s * 0.24, w * 0.40, s * 0.28, -0.2, 0, 7); c.fill();
    c.beginPath(); c.ellipse(w * 0.44, s * 0.24, w * 0.40, s * 0.28, 0.2, 0, 7); c.fill();
    c.fillStyle = G.C.ink;
    c.beginPath(); c.ellipse(0, 0, s * 0.11, s * 0.48, 0, 0, 7); c.fill();
    c.restore();
  }

  function drawProp(c, p) {
    if (p.k === 'bush') A.bush(c, p.x, p.y, p.s, { berries: p.berries });
    else if (p.k === 'flower') A.flower(c, p.x, p.y, p.s, p.c);
    else A.rock(c, p.x, p.y, p.s);
  }

  /* ---------------------------------------------------------------- scene */
  G.scene('giungla', {
    hud: true,
    back: false,

    enter: function () {
      // An old or hand-edited save can hold anything here, and writing a
      // property on a primitive throws in strict mode — check the type, not
      // just the truthiness. enter() is called without a try/catch at boot.
      if (!G.save.seen || typeof G.save.seen !== 'object') G.save.seen = {};

      // "where we left" and "already greeted" belong to one player: siblings
      // share the tablet and switching account re-enters this very scene.
      var prof = (G.account && G.account.id) || null;
      if (prof !== lastProfile) {
        lastProfile = prof;
        visited = false;
        lastStop = null;
        lastPoke = -1;
      }

      big = G.level === 2;               // anything unexpected gets the easy set
      SIGN_R = big ? 92 : 112;
      // The youngest is the one with the least patience: he waits less, not more.
      SPEED = big ? 270 : 305;

      var i, st;
      for (i = 0; i < STATIONS.length; i++) {
        st = STATIONS[i];
        st.s = st.at * PLEN;
        posAt(st.s, tmpA);
        st.bx = tmpA.x; st.by = tmpA.y;
        st.cx = tmpA.x; st.cy = tmpA.y - SIGN_R - 76;
        st.pop = 0;
        st._w = 0; st._ws = 0;
        st.px = 0; st.py = 0; st.pw = 0; st.ph = 0;
      }

      dino.s = lastStop === null ? PLEN * 0.055 : G.clamp(lastStop, 0, PLEN);
      dino.target = dino.s;
      dino.facing = 1;
      dino.happy = 0;
      posAt(dino.s, tmpA);
      dino.x = tmpA.x; dino.y = tmpA.y;
      state = 'idle';
      pending = null;
      idleT = 0;
      nudges = 0;
      camHold = null;
      cam = G.clamp(dino.x - W / 2, 0, MAXCAM);   // start framed on him, no slide
      hushPending();

      var who = (G.account && G.account.name) || 'Dino';
      if (!visited) {
        visited = true;
        // One single utterance: G.say cancels whatever was speaking before.
        if (!G.save.seen.giungla) {
          G.save.seen.giungla = true;
          G.saveNow();
          // Longest wait of the three: the account screen is still welcoming him.
          speak('Ciao ' + who + '! Questa è la giungla. Tocca un cartello per giocare!', 2.6);
        } else {
          speak('Ciao ' + who + '! Dove andiamo?', 1.2);
        }
      } else if (lastStop !== null) {
        speak(G.pick(BACKS), 0.45);
      }
    },

    exit: function () {
      lastStop = dino.s;                 // come back where we left, session only
      hushPending();
    },

    update: function (dt) {
      var i;
      for (i = 0; i < STATIONS.length; i++) {
        if (STATIONS[i].pop > 0) STATIONS[i].pop = Math.max(0, STATIONS[i].pop - dt * 3.2);
      }
      if (dino.happy > 0) dino.happy = Math.max(0, dino.happy - dt);

      for (i = 0; i < CLOUDS.length; i++) {
        CLOUDS[i].x += CLOUDS[i].v * dt;
        if (CLOUDS[i].x > W + 220) CLOUDS[i].x = -220;
      }

      if (sayT > 0) {
        sayT -= dt;
        if (sayT <= 0) { sayT = 0; if (sayMsg) { G.say(sayMsg); sayMsg = null; } }
      }

      /* A three-year-old on his own can simply not know what to do. After a
         long silence the dino hops and asks for a sign to be tapped — twice at
         most, never for the big one, never while something is happening. */
      if (state === 'idle' && sayT === 0) {
        idleT += dt;
        if (!big && nudges < 2 && idleT >= 16) {
          idleT = 0; nudges++;
          dino.happy = 1.2;
          var hint = nearestStation();
          // effects live in screen space, the station in world space
          G.fx.ring(hint.cx - cam, hint.cy, G.C.sun, SIGN_R + 60);
          G.say('Tocca un cartello per giocare!');
        }
      } else {
        idleT = 0;
      }

      if (state === 'walk') {
        var d = dino.target - dino.s;
        var step = SPEED * dt;
        if (Math.abs(d) <= step) arrive();
        else {
          dino.s += d > 0 ? step : -step;
          dino.facing = d > 0 ? 1 : -1;
        }
      } else if (state === 'enter') {
        enterT -= dt;
        if (enterT <= 0) {
          var id = pending;
          pending = null;
          state = 'idle';              // stay usable even if that scene is missing
          if (id) G.go(id);
        }
      }
      posAt(dino.s, tmpA);
      dino.x = tmpA.x; dino.y = tmpA.y;

      // Camera: on the dino, unless an arrow pinned it somewhere else.
      var ct = camHold !== null ? camHold : G.clamp(dino.x - W / 2, 0, MAXCAM);
      cam += (ct - cam) * Math.min(1, dt * 6);
      if (Math.abs(ct - cam) < 0.5) cam = ct;
    },

    draw: function (c) {
      var i, p;

      /* Backdrop and clouds stay in SCREEN space: they are the far distance, so
         holding them still while the trail slides reads as depth, and it costs
         nothing. Everything the child can touch lives in world space below. */
      A.jungle(c, G.t);
      for (i = 0; i < CLOUDS.length; i++) A.cloud(c, CLOUDS[i].x, CLOUDS[i].y, CLOUDS[i].s);

      c.save();
      c.translate(-cam, 0);

      for (i = 0; i < TREES.length; i++) A.tree(c, TREES[i].x, TREES[i].y, TREES[i].s, { kind: TREES[i].kind });

      drawTrail(c);

      for (i = 0; i < STATIONS.length; i++) drawStation(c, STATIONS[i]);

      for (i = 0; i < BUGS.length; i++) {
        p = BUGS[i];
        butterfly(c,
          p.cx + Math.sin(G.t * 0.62 + p.ph) * p.rx,
          p.cy + Math.sin(G.t * 0.97 + p.ph * 1.7) * p.ry,
          p.s, p.c, p.ph);
      }

      // props behind the dino
      var di = 0;
      while (di < PROPS.length && PROPS[di].y <= dino.y) { drawProp(c, PROPS[di]); di++; }

      // where we are headed
      if (state === 'walk') {
        posAt(dino.target, tmpB);
        var k = (G.t * 1.5) % 1;
        c.save();
        c.globalAlpha = (1 - k) * 0.75;
        c.strokeStyle = G.C.cream;
        c.lineWidth = 5;
        c.beginPath();
        c.ellipse(tmpB.x, tmpB.y, 18 + k * 30, 7 + k * 12, 0, 0, 7);
        c.stroke();
        c.restore();
      }

      // the dino
      var size = 118 + G.clamp((dino.y - 470) / 200, 0, 1) * 34;
      c.fillStyle = 'rgba(20,10,0,.20)';
      c.beginPath();
      c.ellipse(dino.x, dino.y + 4, size * 0.30, size * 0.10, 0, 0, 7);
      c.fill();
      // This is the CURRENT player, so we pass no `gear` and no `hat` and let
      // A.dino read the live save (G.look hardens it). Naming `hat` here would
      // mean "I am drawing somebody else" and would strip the glasses and the
      // bow tie off him — see CONTRACT.md.
      var col = (G.account && typeof G.account.color === 'string') ? G.account.color : G.C.dino;
      A.dino(c, dino.x, dino.y, size, {
        facing: dino.facing,
        pose: state === 'walk' ? 'walk' : (dino.happy > 0 ? 'happy' : 'idle'),
        t: G.t,
        color: col
      });

      // props in front of the dino
      while (di < PROPS.length) { drawProp(c, PROPS[di]); di++; }

      c.restore();

      A.canopy(c, G.t);
      drawArrows();
    },

    onDown: function (p) {
      idleT = 0;
      if (state === 'enter') {                    // already stepping in, let it be
        G.fx.ring(p.x, p.y, 'rgba(255,255,255,.65)', 44);
        return;
      }
      hushPending();                              // never talk over his own tap

      // Everything below is hit-tested in WORLD coordinates: the finger arrives
      // in screen space and the world may be scrolled under it.
      var wx = p.x + cam;

      var i, st, r;
      // stations first: the board is the primary thing to touch
      for (i = 0; i < STATIONS.length; i++) {
        st = STATIONS[i];
        r = SIGN_R + 16;
        if (G.dist(wx, p.y, st.cx, st.cy) <= r) { goStation(st); return; }
        // the name plaque hangs below the board and reads as part of the sign
        if (st.pw > 0 && wx >= st.px && wx <= st.px + st.pw &&
            p.y >= st.py && p.y <= st.py + st.ph) { goStation(st); return; }
      }

      // then the dino himself
      if (G.dist(wx, p.y, dino.x, dino.y - 54) <= 74) { pokeDino(); return; }

      // anywhere near the trail: walk there. Tapping while walking re-aims.
      var n = nearestOnTrail(wx, p.y);
      if (n.d <= 210) {
        G.sfx('tap');
        walkTo(n.s, null);
        G.fx.ring(p.x, p.y, G.C.cream, 70);
        return;
      }

      // nothing to do here — a friendly sparkle, never a "no"
      G.fx.ring(p.x, p.y, 'rgba(255,255,255,.65)', 44);
    }
  });
})();
