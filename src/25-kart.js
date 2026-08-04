/* Dino Giungla — "La Pista dei Gusci" (scene: kart).

   A race a three-year-old cannot lose, and a six-year-old can actually get good
   at. Owns G.save.kart.

   THREE CONSTRUCTION DECISIONS DO ALL THE WORK. Everything else follows.

   1. A KART IS (s, lat), NEVER (x, y). Position along the track and offset from
      the centre line, and the drawing converts. This deletes free-body physics,
      wall collision, swept tests, tunnelling, per-frame nearest-point search and
      sub-stepping in one go — that is, the entire class of bug that shows up to a
      small child as "my car is stuck", the most agitating outcome there is.
      Driving off the track is not REPRESENTABLE.

   2. NO LINE OF CODE SUBTRACTS SPEED. `spd = Math.max(spd, CRUISE)` after every
      update. No brake, no penalty, no obstacle that slows you, no grass, no
      wall. The puddle SPEEDS YOU UP. A whole category of failure has no way to
      be expressed.

   3. NO CAMERA. The whole oval fits on screen, so all five karts are always
      visible. "I fell behind and can't see anyone" is closed by arithmetic
      instead of by a device — and the device would itself be the diagnosis:
      a zoom that widens, or an arrow that points at the leader, is a sign
      saying YOU ARE LOSING.

   And the corollary that took three tries to see: A VISIBLE HELP THAT ONLY
   SWITCHES ON WHEN YOU ARE BEHIND IS A SIGN THAT SAYS YOU ARE BEHIND. So the
   friends do not slow down for you. Each of them stops to eat blackberries on
   its own offset timer; falling behind only nudges how LONG the stop lasts.

   There is no position, no placing, no finishing order, and no number anywhere
   except the fruit counter in the HUD. "Last" has no representation, so it
   cannot be read. */
(function () {
  'use strict';

  var C = G.C, W = G.W, H = G.H;

  /* --------------------------------------------------------------- track */
  /* A stadium oval — two straights and two semicircles — computed analytically
     rather than sampled from a spline. An ellipse was the obvious choice and is
     wrong: its minimum radius of curvature would be b*b/a = 71px against a
     half-width of 72, so the inner edge of the ribbon folds through itself and
     the (s, lat) -> point map stops being injective. The kart would visibly
     travel BACKWARDS while s increases, exactly at the corner the whole no-fail
     promise rests on. A stadium's minimum radius is HB = 175. */
  var CX = 640, CY = 445, HA = 450, HB = 175;
  var LSTR = HA - HB;                   // 275, half the length of one straight
  var ARC = Math.PI * HB;               // 549.78 per semicircle
  var PLEN = 4 * LSTR + 2 * ARC;        // 2199.6
  var HW = 72;                          // half width of the ribbon
  var LAT_MAX = 40;                     // the drivable corridor, well inside HW

  var S1 = 2 * LSTR;                    // end of the top straight
  var S2 = S1 + ARC;                    // end of the right bend
  var S3 = S2 + 2 * LSTR;               // end of the bottom straight

  function wrapS(s) { s %= PLEN; return s < 0 ? s + PLEN : s; }
  /* Signed shortest arc from a to b, in (-PLEN/2, PLEN/2]. */
  function wrapDelta(a, b) {
    var d = wrapS(b - a);
    return d > PLEN / 2 ? d - PLEN : d;
  }

  /* Centre-line point, unit tangent, and inward normal at arc length s.
     `lat` is positive INWARDS, which is what makes the inner line genuinely
     shorter: the parallel curve at distance lat from a curve of curvature k has
     length scaled by (1 - lat*k). */
  var _p = { x: 0, y: 0, dx: 1, dy: 0, nx: 0, ny: 1, k: 0 };
  function at(s) {
    s = wrapS(s);
    var a;
    if (s < S1) {                                   // top straight, going right
      _p.x = CX - LSTR + s; _p.y = CY - HB;
      _p.dx = 1; _p.dy = 0; _p.k = 0;
    } else if (s < S2) {                            // right bend, clockwise
      a = -Math.PI / 2 + (s - S1) / HB;
      _p.x = CX + LSTR + Math.cos(a) * HB;
      _p.y = CY + Math.sin(a) * HB;
      _p.dx = -Math.sin(a); _p.dy = Math.cos(a); _p.k = 1 / HB;
    } else if (s < S3) {                            // bottom straight, going left
      _p.x = CX + LSTR - (s - S2); _p.y = CY + HB;
      _p.dx = -1; _p.dy = 0; _p.k = 0;
    } else {                                        // left bend
      a = Math.PI / 2 + (s - S3) / HB;
      _p.x = CX - LSTR + Math.cos(a) * HB;
      _p.y = CY + Math.sin(a) * HB;
      _p.dx = -Math.sin(a); _p.dy = Math.cos(a); _p.k = 1 / HB;
    }
    _p.nx = -_p.dy; _p.ny = _p.dx;                  // rotate +90: points inward
    return _p;
  }
  function px(s, lat) { var p = at(s); return p.x + p.nx * lat; }
  function py(s, lat) { var p = at(s); return p.y + p.ny * lat; }

  /* ------------------------------------------------------------- friends */
  /* The same names that come to the parties in the Casetta. The table is
     duplicated on purpose: modules talk only through G, and a shared table
     would be a shared module. */
  var CAST = [
    { name: 'Pippi', color: '#ff6fae' },
    { name: 'Bubu', color: '#4d80e4' },
    { name: 'Momo', color: '#ffd75e' },
    { name: 'Nina', color: '#38d9a9' }
  ];

  var LAPS_1 = 3, LAPS_2 = 5;
  var CRUISE_1 = 250, BOOST_1 = 340;
  var CRUISE_2 = 300, BOOST_2 = 430;
  var LEAD_MAX = 300, TRAIL_MAX = 340;   // the pack lives inside 640px of arc

  function big() { return G.level === 2; }
  function laps() { return big() ? LAPS_2 : LAPS_1; }
  function cruise() { return big() ? CRUISE_2 : CRUISE_1; }
  function boost() { return big() ? BOOST_2 : BOOST_1; }

  /* ------------------------------------------------------------ save branch */
  function br() {
    var g = G.save.kart;
    if (!g || typeof g !== 'object' || Array.isArray(g)) g = G.save.kart = {};
    if (typeof g.done !== 'number' || !isFinite(g.done) || g.done < 0) g.done = 0;
    if (typeof g.best !== 'number' || !isFinite(g.best) || g.best <= 0) g.best = 0;
    return g;
  }

  /* ---------------------------------------------------------------- state */
  var S = {
    phase: 'via',        // 'via' (lights) | 'gara' | 'festa'
    t: 0,
    thr: 0, gasHeld: false, gasLatch: 0,
    downX: null, downLat: 0, steered: 0,
    callLat: null,
    lapT: 0, lapFrames: 0, bestShown: 0,
    banked: 0,
    shake: 0
  };
  var karts = [];
  var items = [];
  var bg = null, bgOK = false;

  function me() { return karts[0]; }

  /* ------------------------------------------------------------ the items */
  /* Nothing abstract, no inventory, no slot, nothing to "use": everything works
     on contact and pays out inside 300ms. */
  function buildItems() {
    items.length = 0;
    var n = laps() > 0 ? 1 : 1, i, k;
    var fruitLat = big() ? [34, -34, 44, -44] : [0, 18, -18, 0];
    var kinds = ['fragola', 'banana', 'uva', 'mela', 'melone'];
    for (i = 0; i < 8; i++) {                        // fruit around the lap
      items.push({
        kind: 'fruit', s: (i + 0.5) * PLEN / 8, lat: fruitLat[i % fruitLat.length],
        fruit: kinds[i % kinds.length], taken: 0, glow: 0
      });
    }
    for (i = 0; i < 3; i++) {                        // wind leaves
      /* Level 1: exactly on the automatic line, so they cannot be missed — he
         gets a present of speed and believes he took it. Level 2: on the INSIDE
         of the bends, so they only pay if he actually steers. */
      k = big() ? (i === 0 ? S1 + ARC * 0.5 : i === 1 ? S3 + ARC * 0.5 : LSTR)
        : (i + 0.3) * PLEN / 3;
      items.push({ kind: 'wind', s: k, lat: big() ? 30 : 0, taken: 0, glow: 0 });
    }
    for (i = 0; i < 2; i++) {                        // puddles: they SPEED YOU UP
      items.push({ kind: 'pool', s: (i + 0.15) * PLEN / 2, lat: big() ? -20 : 0, taken: 0, glow: 0 });
    }
    var hats = Array.isArray(G.save.hats) ? G.save.hats : [];
    if (hats.length) {                               // one of his own hats, flying
      items.push({ kind: 'hat', s: PLEN * 0.62, lat: 0, taken: 0, glow: 0, hat: hats[hats.length - 1] });
    }
    void n;
  }

  /* --------------------------------------------------------------- start */
  function reset() {
    var i, k;
    karts.length = 0;
    karts.push({
      me: true, s: 0, lat: 0, dist: 0, spd: cruise(),
      color: (G.account && G.account.color) || C.dino, name: '', wob: 0,
      stop: 0, next: 0, pace: 1
    });
    for (i = 0; i < CAST.length; i++) {
      k = CAST[i];
      karts.push({
        me: false, s: -60 - i * 46, lat: (i % 2 ? 1 : -1) * (14 + i * 5), dist: -60 - i * 46,
        spd: cruise(), color: k.color, name: k.name, wob: i * 1.3,
        /* Their stops are on their OWN offset timers. Tying them to the gap
           would make the help visible, and a visible help is a sign. */
        stop: 0, next: 5 + i * 3.5, pace: big() ? (0.97 + i * 0.01) : 0.98
      });
    }
    buildItems();
    S.phase = 'via'; S.t = 0; S.thr = 0; S.gasHeld = false; S.gasLatch = 0;
    S.downX = null; S.steered = 0; S.callLat = null;
    /* lapDone MUST be reset here: it is the high-water mark of completed laps,
       so leaving it behind means the second race of a session banks nothing. */
    S.lapDone = 0;
    S.lapT = 0; S.lapFrames = 0; S.bestShown = 0; S.banked = 0; S.shake = 0;
    S.wearHat = null;
  }

  /* Fruit is banked EVERY LAP, not at the finish: leaving half way through must
     never throw anything away, so the home button is not a trapdoor. */
  function bank(n, x, y) {
    if (n <= 0) return;
    S.banked += n;
    G.addFruits(n, x, y);
  }

  /* ================================================================ SCENE */
  G.scene('kart', {
    enter: function () {
      br();
      reset();
      bgOK = false;
      setTimeout(function () {
        if (G.current !== 'kart') return;
        G.say(G.pick(['Pronti, partenza... via!', 'Si corre!', 'Andiamo a fare un giro!']));
      }, 400);
    },

    exit: function () { S.phase = 'festa'; },

    update: function (dt) {
      var i, k, p, it, d;
      S.t += dt;
      if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 3);

      /* Safety net: window.blur zeroes the core's pointer.down but does NOT call
         the scene's onUp, so the gas could stay held down for ever. */
      if (!G.pointer || !G.pointer.down) { S.gasHeld = false; S.downX = null; }
      S.gasLatch = Math.max(0, S.gasLatch - dt);

      if (S.phase === 'via') {
        if (S.t > 3) { S.phase = 'gara'; S.t = 0; G.sfx('win'); }
        return;
      }
      if (S.phase === 'festa') { S.t += 0; return; }

      /* ---- throttle. A three-year-old hammers, so a tap has to be worth as
         much as a held finger: one 100ms tap latches 0.85s of full gas. No
         input pattern produces less feedback than another. */
      var want = (S.gasHeld || S.gasLatch > 0) ? 1 : 0;
      S.thr += (want - S.thr) * Math.min(1, dt * 7);

      var mek = me();
      var target = cruise() + S.thr * (boost() - cruise());
      mek.spd += G.clamp(target - mek.spd, -300 * dt, 300 * dt);
      mek.spd = Math.max(mek.spd, cruise());          // NOTHING subtracts speed

      /* ---- steering */
      var wantLat = 0, assist = 1;
      if (big()) {
        wantLat = G.clamp(S.downLat, -LAT_MAX, LAT_MAX);
        assist = 1 - 0.78 * G.clamp(S.steered, 0, 1);  // 100% -> 22% as he really drives
      } else if (S.callLat !== null) {
        wantLat = G.clamp(S.callLat, -LAT_MAX, LAT_MAX);
      }
      var autoLat = autoLine(mek.s);
      var aim = wantLat * (1 - assist) + autoLat * assist;
      if (!big() || S.callLat !== null) aim = wantLat || autoLat;
      mek.lat += G.clamp(aim - mek.lat, -170 * dt, 170 * dt);
      mek.lat = G.clamp(mek.lat, -LAT_MAX, LAT_MAX);

      advance(mek, dt);

      /* ---- the friends */
      for (i = 1; i < karts.length; i++) {
        k = karts[i];
        k.next -= dt;
        if (k.stop > 0) {
          k.stop -= dt;
          k.spd += G.clamp(cruise() * 0.55 - k.spd, -300 * dt, 300 * dt);
        } else {
          if (k.next <= 0) {
            k.next = 7 + Math.random() * 6;
            /* The gap only nudges HOW LONG, never WHETHER. */
            d = wrapDelta(k.dist, mek.dist);
            k.stop = 1.1 + G.clamp(d / 900, -0.4, 0.4);
          }
          k.spd += G.clamp(cruise() * k.pace - k.spd, -300 * dt, 300 * dt);
        }
        k.spd = Math.max(k.spd, cruise() * 0.5);

        /* The pack stays inside 640px of arc, so lapping is arithmetically
           impossible in either direction. */
        d = wrapDelta(mek.dist, k.dist);
        if (d > LEAD_MAX) k.spd = Math.min(k.spd, mek.spd * 0.92);
        if (d < -TRAIL_MAX) k.spd = Math.max(k.spd, mek.spd * 1.04);

        k.lat += Math.sin(S.t * 0.7 + k.wob) * 9 * dt;
        k.lat = G.clamp(k.lat, -LAT_MAX, LAT_MAX);

        /* Courtesy: they make room, so he is never boxed in. And the push is
           ASYMMETRIC — only the rival moves. "A friend made me miss the banana"
           is the worst kind of failure, because it is attributed to somebody
           else. Nobody's speed is ever touched. */
        if (Math.abs(wrapDelta(mek.s, k.s)) < 70 && Math.abs(k.lat - mek.lat) < 34) {
          k.lat += (k.lat >= mek.lat ? 1 : -1) * 46 * dt;
          k.lat = G.clamp(k.lat, -LAT_MAX, LAT_MAX);
        }
        advance(k, dt);
      }

      /* ---- pick-ups */
      for (i = 0; i < items.length; i++) {
        it = items[i];
        if (it.glow > 0) it.glow = Math.max(0, it.glow - dt * 2);
        if (it.taken > 0) { it.taken -= dt; continue; }
        if (Math.abs(wrapDelta(mek.s, it.s)) > 26) continue;
        if (Math.abs(it.lat - mek.lat) > (big() ? 34 : 60)) continue;
        take(it, mek);
      }

      /* ---- laps */
      var lapNow = Math.floor(mek.dist / PLEN);
      S.lapT += dt; S.lapFrames++;
      if (lapNow > S.lapDone) {
        S.lapDone = lapNow;
        onLap();
      }
      if (mek.dist >= laps() * PLEN) finish();
    },

    onDown: function (p) {
      if (p.y < 112) return;                       // HUD band and its slack
      S.gasHeld = true; S.gasLatch = 0.85;
      S.downX = p.x; S.downLat = me() ? me().lat : 0;
      if (S.phase !== 'gara') return;

      if (!big()) {
        /* Tap-to-call. The verb a three-year-old already knows from four other
           scenes: touch the thing you want. Never a dead tap. */
        var best = null, bd = 220, i, it, d, dx, dy;
        for (i = 0; i < items.length; i++) {
          it = items[i];
          if (it.taken > 0) continue;
          d = wrapDelta(me().s, it.s);
          if (d < 10 || d > 520) continue;         // only ahead: never look back
          dx = px(it.s, it.lat) - p.x; dy = py(it.s, it.lat) - p.y;
          var dd = Math.hypot(dx, dy);
          if (dd < bd) { bd = dd; best = it; }
        }
        if (best) { best.glow = 1; S.callLat = best.lat; G.sfx('pop'); }
        else G.fx.ring(p.x, p.y, 'rgba(255,255,255,.6)', 40);
      }
    },

    onMove: function (p) {
      if (!big() || S.downX === null) return;
      /* Relative drag, never absolute: a finger that lands anywhere is not a
         steering command by itself. */
      var dx = p.x - S.downX;
      S.downLat = G.clamp(S.downLat + dx * 0.10, -LAT_MAX, LAT_MAX);
      S.downX = p.x;
      S.steered = Math.min(1, S.steered + Math.abs(dx) / 240);
    },

    onUp: function () { S.gasHeld = false; S.downX = null; },

    draw: function (c) { drawAll(c); }
  });

  S.lapDone = 0;

  /* --------------------------------------------------------------- motion */
  function advance(k, dt) {
    var p = at(k.s);
    /* The exact length of the parallel path at distance lat from a curve of
       curvature k: the inner line is genuinely shorter, and there is no
       coefficient to tune. Off at level 1, where he is never punished for
       being off the racing line. */
    var scale = big() ? G.clamp(1 / (1 - k.lat * p.k), 0.86, 1.16) : 1;
    var ds = k.spd * dt * scale;
    k.s = wrapS(k.s + ds);
    k.dist += ds;
  }

  /* The line the game drives for you: hug the inside through the bends. */
  function autoLine(s) {
    var p = at(s);
    return p.k > 0 ? 22 : 0;
  }

  function take(it, k) {
    var x = px(it.s, it.lat), y = py(it.s, it.lat);
    it.taken = 3.2;
    if (it.kind === 'fruit') {
      bank(big() ? 3 : 2, x, y);
      G.sfx('coin');
      G.fx.burst(x, y, { color: C.sun, count: 8, speed: 180, life: 0.5 });
      if (!big()) S.callLat = null;
    } else if (it.kind === 'wind') {
      k.spd = Math.min(boost() * 1.25, k.spd + 90);
      G.sfx('whoosh');
      G.fx.burst(x, y, { color: C.leafLight, count: 10, speed: 240, life: 0.5 });
    } else if (it.kind === 'pool') {
      k.spd = Math.min(boost() * 1.3, k.spd + 120);
      G.sfx('chime');
      G.fx.ring(x, y, C.water);
    } else if (it.kind === 'hat') {
      S.wearHat = it.hat;
      G.sfx('good');
      G.fx.confetti();
      G.say('Il tuo cappello!');
    }
  }

  function onLap() {
    var mek = me();
    G.sfx('chime');
    bank(big() ? 6 : 4, mek.x || 640, 240);
    if (big()) {
      var g = br();
      /* Never Date.now: below 20fps the core clamps dt to 0.05 and physics and
         wall clock would diverge. And a lap is rejected if the frame rate was
         so poor that a slow tablet would be rewarded. */
      if (S.lapFrames > 0 && S.lapT / S.lapFrames <= 0.022) {
        if (!g.best || S.lapT < g.best) {
          g.best = S.lapT; G.saveNow();
          S.bestShown = 2.4;
          G.fx.text(640, 300, 'Giro record!', C.sun, 46);
        }
      }
    }
    S.lapT = 0; S.lapFrames = 0;
    items.forEach(function (it) { if (it.kind !== 'hat') it.taken = 0; });
  }

  function finish() {
    var g = br();
    g.done++;
    G.saveNow();
    S.phase = 'festa'; S.t = 0;
    G.sfx('win'); G.fx.confetti();
    G.addStars(1, 640, 300);
    G.say(G.pick(['Che bel giro!', 'Bravissimo!', 'Evviva!']));
  }

  /* ----------------------------------------------------------------- draw */
  /* The backdrop is baked once into an offscreen canvas and blitted with a
     single drawImage. Only possible because there is no camera, and it is what
     keeps this scene at about a third of the overworld's raster load. */
  function bake() {
    var cv, c;
    try { cv = document.createElement('canvas'); } catch (e) { return false; }
    cv.width = 1280; cv.height = 720;
    c = cv.getContext('2d');
    if (!c) return false;

    c.fillStyle = '#7fbf5a'; c.fillRect(0, 0, 1280, 720);
    if (A.jungle) { try { A.jungle(c, 0, { dim: 0.25 }); } catch (e) { /* keep the grass */ } }

    ribbon(c, HW + 10, '#5a4326');                 // shoulder
    ribbon(c, HW, '#c8a06a');                      // the track itself
    kerbs(c);
    c.save();                                       // the inner meadow pond
    c.globalAlpha = 0.55; c.fillStyle = C.water;
    c.beginPath(); c.ellipse(CX, 443, 132, 78, 0, 0, 7); c.fill();
    c.restore();
    bg = cv;
    return true;
  }

  function ribbon(c, w, col) {
    var i, s, p, n = 160;
    c.beginPath();
    for (i = 0; i <= n; i++) { s = i / n * PLEN; p = at(s); if (i) c.lineTo(p.x + p.nx * -w, p.y + p.ny * -w); else c.moveTo(p.x + p.nx * -w, p.y + p.ny * -w); }
    for (i = n; i >= 0; i--) { s = i / n * PLEN; p = at(s); c.lineTo(p.x + p.nx * w, p.y + p.ny * w); }
    c.closePath();
    c.fillStyle = col; c.fill();
  }

  function kerbs(c) {
    var i, s, p, k = 44;
    for (i = 0; i < k; i++) {
      s = i / k * PLEN;
      p = at(s);
      c.fillStyle = i % 2 ? '#e8536b' : '#fff6e0';
      [-1, 1].forEach(function (side) {
        c.save();
        c.translate(p.x + p.nx * side * (HW - 5), p.y + p.ny * side * (HW - 5));
        c.rotate(Math.atan2(p.dy, p.dx));
        c.fillRect(-PLEN / k / 2, -6, PLEN / k, 12);
        c.restore();
      });
    }
  }

  function drawAll(c) {
    var i;
    if (!bgOK) { bgOK = true; if (!bake()) bg = null; }
    if (bg) { try { c.drawImage(bg, 0, 0); } catch (e) { bg = null; } }
    if (!bg) { c.fillStyle = '#7fbf5a'; c.fillRect(0, 0, W, H); ribbon(c, HW, '#c8a06a'); }

    drawArch(c);
    for (i = 0; i < items.length; i++) drawItem(c, items[i]);

    /* Depth order: whoever is lower on screen is nearer. */
    var order = karts.slice().sort(function (a, b) { return py(a.s, a.lat) - py(b.s, b.lat); });
    for (i = 0; i < order.length; i++) drawKart(c, order[i]);

    drawPedal(c);
    if (S.phase === 'via') drawLights(c);
    if (S.phase === 'festa') drawFinish(c);
    if (S.bestShown > 0) S.bestShown = Math.max(0, S.bestShown - G.dt);
  }

  /* The lap counter is three big fruits hanging from the start arch. One drops
     each lap, with a chime, and flies away. Cause and effect in one glance —
     no bar, no tally, no text. */
  function drawArch(c) {
    var x = CX - LSTR, y = CY - HB;
    var n = laps(), doneL = Math.min(n, S.lapDone), i;
    c.save();
    c.strokeStyle = C.bark; c.lineWidth = 16; c.lineCap = 'round';
    c.beginPath();
    c.moveTo(x - HW - 12, y + 4); c.lineTo(x - HW - 12, y - 92);
    c.moveTo(x + HW + 12, y + 4); c.lineTo(x + HW + 12, y - 92);
    c.stroke();
    c.strokeStyle = C.barkDark; c.lineWidth = 14;
    c.beginPath(); c.moveTo(x - HW - 20, y - 92); c.lineTo(x + HW + 20, y - 92); c.stroke();
    c.restore();
    for (i = 0; i < n; i++) {
      if (i < doneL) continue;
      var fx = x - HW + 18 + i * ((HW * 2 - 36) / Math.max(1, n - 1 || 1));
      if (n === 1) fx = x;
      c.save();
      c.strokeStyle = 'rgba(60,40,20,.6)'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(fx, y - 92); c.lineTo(fx, y - 66); c.stroke();
      c.restore();
      if (A.fruit) A.fruit(c, fx, y - 52, 20, ['fragola', 'mela', 'uva', 'banana', 'melone'][i % 5]);
    }
  }

  function drawItem(c, it) {
    if (it.taken > 0) return;
    var x = px(it.s, it.lat), y = py(it.s, it.lat);
    var g = 1 + it.glow * 0.6;
    var bob = Math.sin(S.t * 3 + it.s) * 4;
    c.save();
    c.translate(x, y + bob);
    c.scale(g, g);
    if (it.kind === 'fruit') {
      if (A.fruit) A.fruit(c, 0, 0, 20, it.fruit);
    } else if (it.kind === 'wind') {
      c.fillStyle = C.leafLight;
      c.beginPath();
      c.ellipse(0, 0, 22, 12, Math.sin(S.t * 4) * 0.4, 0, 7);
      c.fill();
      c.strokeStyle = C.leafDark; c.lineWidth = 3; c.stroke();
    } else if (it.kind === 'pool') {
      c.globalAlpha = 0.7; c.fillStyle = C.water;
      c.beginPath(); c.ellipse(0, 0, 34, 15, 0, 0, 7); c.fill();
      c.globalAlpha = 0.5; c.strokeStyle = '#fff'; c.lineWidth = 3;
      c.beginPath(); c.ellipse(0, 0, 22, 9, 0, 0, 7); c.stroke();
    } else if (it.kind === 'hat' && A.hat) {
      A.hat(c, 0, 0, 54, it.hat);
    }
    c.restore();
    if (it.glow > 0) {
      c.save(); c.globalAlpha = it.glow * 0.7;
      c.strokeStyle = C.sun; c.lineWidth = 5;
      c.beginPath(); c.arc(x, y + bob, 34, 0, 7); c.stroke();
      c.restore();
    }
  }

  /* An egg shell with wooden wheels, seen from above. Only the shell rotates:
     A.dino is drawn in profile and anchored at the feet, so turning it through
     360 degrees would mean drawing the dino from eight angles — by a distance
     the most expensive art this project has ever been asked for. The dino stays
     upright inside a shell that turns, and reads perfectly. */
  function drawKart(c, k) {
    var p = at(k.s);
    var x = p.x + p.nx * k.lat, y = p.y + p.ny * k.lat;
    var ang = Math.atan2(p.dy, p.dx);
    var sc = k.me ? 1.22 : 1;
    var wob = Math.sin(S.t * 8 + k.wob) * 0.05;

    c.save();
    c.globalAlpha = 0.22; c.fillStyle = k.me ? k.color : '#20140a';
    c.beginPath(); c.ellipse(x, y + 10, 40 * sc, 18 * sc, 0, 0, 7); c.fill();
    c.restore();

    c.save();
    c.translate(x, y);
    c.rotate(ang + wob);
    c.scale(sc, sc);
    c.fillStyle = C.barkDark;                        // wheels
    [[-20, -22], [-20, 22], [20, -22], [20, 22]].forEach(function (o) {
      c.beginPath(); c.ellipse(o[0], o[1], 12, 7, 0, 0, 7); c.fill();
    });
    if (A.egg) A.egg(c, 0, 0, 62, { color: k.color });
    else {
      c.fillStyle = k.color;
      c.beginPath(); c.ellipse(0, 0, 30, 22, 0, 0, 7); c.fill();
    }
    c.restore();

    /* The dino sits upright in the shell, never rotated. */
    if (A.dino) {
      var o = { facing: p.dx >= 0 ? 1 : -1, pose: 'happy', t: G.t, color: k.color };
      if (!k.me) o.hat = null;                       // a friend, not the player
      A.dino(c, x, y + 6 * sc, 74 * sc, o);
    }

    if (k.me) {                                      // the marker that never turns off
      var fy = y - 74 * sc - 16 + Math.sin(S.t * 3) * 5;
      c.save();
      c.fillStyle = C.sun; c.strokeStyle = C.ink; c.lineWidth = 3;
      c.beginPath();
      c.moveTo(x, fy + 16); c.lineTo(x - 14, fy - 8); c.lineTo(x + 14, fy - 8);
      c.closePath(); c.fill(); c.stroke();
      c.restore();
    } else if (k.stop > 0) {
      G.text('mmm!', x, y - 62, {
        ctx: c, size: 22, color: C.cream, stroke: 'rgba(43,29,18,.7)', strokeWidth: 6
      });
    }
  }

  /* An affordance, not a target: the whole screen below the HUD is the pedal.
     Deliberately NOT a G.ui button with hold:true — that flag is wired to the
     parents' gate in the core, and a pedal registered that way would open the
     grown-up menu after 1.4 seconds of accelerating. */
  function drawPedal(c) {
    var down = S.thr > 0.35;
    var y = 443 + (down ? 8 : 0);
    c.save();
    c.globalAlpha = 0.9;
    c.fillStyle = down ? C.leafLight : C.leaf;
    c.beginPath(); c.ellipse(CX, y, 104, 62, 0, 0, 7); c.fill();
    c.strokeStyle = C.leafDark; c.lineWidth = 6; c.stroke();
    c.globalAlpha = 0.30 + S.thr * 0.55;
    c.fillStyle = C.sun;
    c.beginPath(); c.ellipse(CX, y, 88 * (0.4 + S.thr * 0.6), 50 * (0.4 + S.thr * 0.6), 0, 0, 7); c.fill();
    c.restore();
  }

  function drawLights(c) {
    var k = Math.min(3, Math.floor(S.t) + 1), i;
    for (i = 0; i < 3; i++) {
      c.save();
      c.fillStyle = i < k ? (i === 2 ? C.leafLight : C.sun) : 'rgba(255,246,224,.30)';
      c.beginPath(); c.arc(CX - 90 + i * 90, 250, 34, 0, 7); c.fill();
      c.strokeStyle = C.ink; c.lineWidth = 5; c.stroke();
      c.restore();
    }
    G.text(k >= 3 ? 'VIA!' : 'Pronti...', CX, 340, {
      ctx: c, size: 54, color: C.cream, stroke: 'rgba(12,40,25,.75)', strokeWidth: 11
    });
  }

  /* No position, no placing, no order of arrival — here or anywhere else. */
  function drawFinish(c) {
    c.save();
    c.fillStyle = 'rgba(9,32,21,.45)'; c.fillRect(0, 0, W, H);
    c.restore();
    A.panel(c, 300, 190, 680, 340, { r: 32 });
    G.text('Che bel giro!', CX, 268, { ctx: c, size: 56, color: C.ink });
    if (A.fruit) A.fruit(c, 520, 350, 30, 'fragola');
    G.text('+' + S.banked, 570, 352, { ctx: c, size: 46, color: C.ink, align: 'left' });
    if (G.starIcon) G.starIcon(c, 720, 350, 28);
    G.text('+1', 762, 352, { ctx: c, size: 46, color: C.ink, align: 'left' });
    G.ui.button({
      id: 'kagain', x: 350, y: 400, w: 280, h: 104, r: 28, color: C.leaf,
      label: 'Ancora!', fontSize: 38, onTap: function () { reset(); }
    });
    G.ui.button({
      id: 'kleave', x: 660, y: 400, w: 280, h: 104, r: 28, color: C.tangerine,
      label: 'Giungla', fontSize: 34, onTap: function () { G.home(); }
    });
  }
})();
