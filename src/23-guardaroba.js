/* Dino Giungla — "Il Guardaroba".

   The fourth place. It is NOT a shop: nothing here has a price, and nothing
   here can ever tell a child no. Pieces arrive in crates that fill up as you
   play the other three games, and a crate that is not ready yet is simply not
   drawn — not greyed out, not padlocked. A dark object that answers "not yet"
   is a padlock painted beige.

   The reward is not the piece, it is the REACTION: every item carries a pose
   and a line (see A.GEAR in 01c-art-gear.js), so putting the nightcap on makes
   the dino actually fall asleep. Reliable cause and effect is the thing a
   three-year-old repeats eighty times in a row.

   Level 1 is a toy box with four rules and no slots at all: tap a toy, it flies
   on and the dino reacts; tap it again, it comes off; tap the dino, he does it
   again; tap the dice, everything changes. Level 2 is composition: four slots,
   a shelf per slot, three portraits that save a whole look, and a window onto
   your brother's dino.

   Owns: G.save.guardaroba, plus G.save.hat / G.save.hats, which moved here when
   the hat shop left the Nido. */
(function () {
  'use strict';

  var C = G.C, W = G.W, H = G.H;

  /* Given in this order — sorted by how strong the reaction is, not by slot.
     The first four crates are the four best reactions in the game. Showing a
     child "the four places things go" is a grown-up's taxonomy; at three it
     means nothing. */
  var CRATE_ORDER = [
    'cuffia', 'occhialini', 'fiocco', 'mago', 'papillon', 'sole', 'corona',
    'anellino', 'berretto', 'medaglia', 'pirata', 'fiore', 'esploratore', 'cilindro'
  ];

  /* Stars needed to have earned the nth crate. Cheap at first — the first crate
     lands after two games — then slower. The whole collection costs 48 stars
     against the 107 the old shop wanted for the eight hats alone. */
  function starsFor(n) {
    return n <= 6 ? n * 2 : n <= 12 ? 12 + (n - 6) * 4 : 36 + (n - 12) * 6;
  }

  /* ------------------------------------------------------------ save branch */
  function br() {
    var g = G.save.guardaroba;
    if (!g || typeof g !== 'object') { g = G.save.guardaroba = {}; }
    if (!g.gear || typeof g.gear !== 'object') g.gear = { occhi: null, collo: null, coda: null };
    if (!Array.isArray(g.owned)) g.owned = [];
    if (!Array.isArray(g.shots)) g.shots = [];
    if (typeof g.opened !== 'number' || !isFinite(g.opened) || g.opened < 0) g.opened = 0;
    if (typeof g.nudges !== 'number' || !isFinite(g.nudges)) g.nudges = 0;
    if (A.SLOTS.indexOf(g.slot) < 0) g.slot = 'testa';
    if (!Array.isArray(G.save.hats)) G.save.hats = [];
    if (typeof G.save.hat !== 'string') G.save.hat = null;

    /* One-off migration: whoever already bought hats keeps them, is not given
       them a second time (CRATE_ORDER skips what you own), and gets credit for
       what they already spent — otherwise closing the shop would quietly wipe
       out an afternoon of saving up. */
    if (typeof g.seed !== 'number' || !isFinite(g.seed)) {
      var spent = 0, k;
      for (k = 0; k < (A.HATS || []).length; k++) {
        if (G.save.hats.indexOf(A.HATS[k].id) >= 0) spent += A.HATS[k].price || 0;
      }
      g.seed = spent;
      g.opened = Math.min(CRATE_ORDER.length, G.save.hats.length);
    }
    return g;
  }

  function ownsId(id) {
    var g = A.gearOf(id);
    if (!g) return false;
    return g.slot === 'testa'
      ? G.save.hats.indexOf(id) >= 0
      : br().owned.indexOf(id) >= 0;
  }
  function ownedList() {
    return A.GEAR.filter(function (g) { return ownsId(g.id); });
  }
  function wornIn(slot) {
    return slot === 'testa' ? G.save.hat : br().gear[slot];
  }
  function wear(slot, id) {
    if (slot === 'testa') G.save.hat = id; else br().gear[slot] = id;
    G.saveNow();
  }

  /* How many crates have been earned, opened, and are waiting right now.
     Recomputed every frame on purpose: G.addStars does not raise G.save.stars
     until the flying star lands on the HUD (~0.6s), so a crate earned by the
     round you just won would be invisible if this were read once on enter(). */
  function earned() {
    var g = br(), total = (G.save.stars || 0) + g.seed, n = 0;
    while (n < CRATE_ORDER.length && starsFor(n + 1) <= total) n++;
    return n;
  }
  function waiting() { return Math.max(0, earned() - br().opened); }
  function nextId() {
    for (var i = 0; i < CRATE_ORDER.length; i++) {
      if (!ownsId(CRATE_ORDER[i])) return CRATE_ORDER[i];
    }
    return null;
  }
  /* Published so the jungle can badge the station and the two minigames can
     offer a shortcut straight to the present. */
  G.crates = function () { return waiting(); };

  /* --------------------------------------------------------------- state */
  var S = {
    mode: 'gioca',        // 'gioca' | 'apri'
    react: 0,             // seconds left on the current reaction
    pose: null, last: null,
    fly: null,            // {id, x, y, tx, ty, k}
    crate: 0,             // taps landed on the crate, 0..3
    prize: null, prizeT: 0,
    idle: 0, shake: 0, flash: 0
  };
  var look = { testa: null, occhi: null, collo: null, coda: null };
  var mate = { testa: null, occhi: null, collo: null, coda: null };

  function react(id) {
    var g = A.gearOf(id);
    if (!g) return;
    S.react = 1.4; S.pose = g.pose; S.last = id;
    G.say(g.say);
  }
  function pose() { return S.react > 0 ? S.pose : 'idle'; }

  /* --------------------------------------------------------------- pieces */
  function toggle(id, fromX, fromY, dinoX, dinoY) {
    var g = A.gearOf(id);
    if (!g) return;
    if (wornIn(g.slot) === id) {                 // same rule, mirrored: take it off
      wear(g.slot, null);
      G.sfx('pop');
      G.fx.burst(fromX, fromY, { color: C.cream, count: 8, speed: 120, life: 0.5 });
      if (S.last === id) { S.react = 0; S.last = null; }
      return;
    }
    wear(g.slot, id);
    G.sfx('tap');
    /* The 0.4s flight is not a delay to trim: at three, tracking a slow moving
       object is mature, while a saccade to a sparkle 900px from your finger is
       not. It is what makes the destination legible. */
    S.fly = { id: id, x: fromX, y: fromY, tx: dinoX, ty: dinoY, k: 0 };
  }

  function stripAll() {
    var i;
    wear('testa', null);
    for (i = 1; i < A.SLOTS.length; i++) wear(A.SLOTS[i], null);
    S.react = 0; S.last = null;
    G.sfx('pop');
    for (i = 0; i < 14; i++) {
      G.fx.burst(240 + Math.random() * 140, 300 + Math.random() * 200,
        { color: C.sun, count: 3, speed: 200, life: 0.8, gravity: 420, shape: 'star' });
    }
    G.say('Tutto via!');
  }

  function roll() {
    var own = ownedList(), i, s, pool, pick = null;
    for (i = 0; i < A.SLOTS.length; i++) {
      s = A.SLOTS[i];
      pool = own.filter(function (g) { return g.slot === s; });
      /* Every owned slot, including the ones this level does not show — a child
         who put a bow on the tail at level 2 and then moved to level 1 must
         still be able to lose it. And null is a legal outcome: sometimes the
         surprise is that something comes off. */
      if (!pool.length) { wear(s, null); continue; }
      var r = G.rndi(0, pool.length);            // == pool.length means "nothing"
      wear(s, r >= pool.length ? null : pool[r].id);
      if (r < pool.length) pick = pool[r].id;
    }
    G.sfx('chime');
    G.fx.confetti();
    if (pick) react(pick); else G.say('Sorpresa!');
  }

  /* ---------------------------------------------------------------- crate */
  function openCrate() {
    var g = br(), id = nextId();
    g.opened = Math.min(CRATE_ORDER.length, g.opened + 1);
    if (!id) { G.saveNow(); S.mode = 'gioca'; return; }
    var item = A.gearOf(id);
    if (item.slot === 'testa') { if (G.save.hats.indexOf(id) < 0) G.save.hats.push(id); }
    else if (g.owned.indexOf(id) < 0) g.owned.push(id);
    wear(item.slot, id);
    G.saveNow();
    S.prize = id; S.prizeT = 2.2;
    G.sfx('win'); G.fx.confetti();
    G.fx.ring(W / 2, 380, C.sun);
    G.say('Guarda! ' + item.name + '!');
    S.react = 2.2; S.pose = item.pose; S.last = id;
  }

  function drawCrate(c, x, y, s, open) {
    var w = s * 0.52, hh = s * 0.34, lift = open * 0.5;
    c.save();
    c.fillStyle = 'rgba(20,10,0,.22)';
    c.beginPath(); c.ellipse(x, y + hh + s * 0.06, w * 1.05, s * 0.09, 0, 0, 7); c.fill();
    if (open > 0.05) {                            // light spilling out
      c.globalAlpha = 0.30 + open * 0.5;
      c.fillStyle = C.sun;
      c.beginPath(); c.ellipse(x, y - hh * 0.2, w * (0.7 + open), hh * (0.5 + open), 0, 0, 7); c.fill();
      c.globalAlpha = 1;
    }
    c.save();                                     // lid, hinged at the back
    c.translate(x, y - hh);
    c.rotate(-lift);
    c.fillStyle = C.barkDark;
    G.roundRect(c, -w, -s * 0.20, w * 2, s * 0.22, s * 0.05); c.fill();
    c.fillStyle = C.bark;
    G.roundRect(c, -w * 0.94, -s * 0.17, w * 1.88, s * 0.15, s * 0.04); c.fill();
    c.restore();
    c.fillStyle = C.barkDark;                     // body
    G.roundRect(c, x - w, y - hh, w * 2, hh * 2, s * 0.05); c.fill();
    c.fillStyle = C.bark;
    G.roundRect(c, x - w * 0.94, y - hh * 0.9, w * 1.88, hh * 1.8, s * 0.04); c.fill();
    c.fillStyle = C.barkDark;                     // bands
    c.fillRect(x - w * 0.62, y - hh, w * 0.16, hh * 2);
    c.fillRect(x + w * 0.46, y - hh, w * 0.16, hh * 2);
    c.fillStyle = C.sun;                          // clasp
    c.beginPath(); c.arc(x, y - hh * 0.05, s * 0.07, 0, 7); c.fill();
    c.restore();
  }

  /* -------------------------------------------------------------- helpers */
  function cross(c, cx, cy, r) {
    c.save();
    c.strokeStyle = 'rgba(120,100,80,.75)'; c.lineWidth = Math.max(3, r * 0.13);
    c.lineCap = 'round';
    c.beginPath(); c.arc(cx, cy, r * 0.66, 0, 7); c.stroke();
    c.beginPath();
    c.moveTo(cx - r * 0.44, cy + r * 0.44); c.lineTo(cx + r * 0.44, cy - r * 0.44);
    c.stroke(); c.restore();
  }
  function dice(c, cx, cy, r) {
    c.save();
    c.fillStyle = C.cream;
    G.roundRect(c, cx - r * 0.62, cy - r * 0.62, r * 1.24, r * 1.24, r * 0.22);
    c.fill();
    c.strokeStyle = C.ink; c.lineWidth = Math.max(2.5, r * 0.09); c.stroke();
    c.fillStyle = C.ink;
    [[-0.28, -0.28], [0.28, -0.28], [0, 0], [-0.28, 0.28], [0.28, 0.28]].forEach(function (p) {
      c.beginPath(); c.arc(cx + p[0] * r, cy + p[1] * r, r * 0.10, 0, 7); c.fill();
    });
    c.restore();
  }
  function camera(c, cx, cy, r) {
    c.save();
    c.fillStyle = C.ink;
    G.roundRect(c, cx - r * 0.64, cy - r * 0.42, r * 1.28, r * 0.86, r * 0.14); c.fill();
    c.fillStyle = C.cream;
    c.beginPath(); c.arc(cx, cy, r * 0.28, 0, 7); c.fill();
    c.fillStyle = C.blueberry;
    c.beginPath(); c.arc(cx, cy, r * 0.18, 0, 7); c.fill();
    c.fillStyle = C.berry;
    c.beginPath(); c.arc(cx + r * 0.40, cy - r * 0.26, r * 0.08, 0, 7); c.fill();
    c.restore();
  }
  var SHOT_ICON = ['stella', 'cuore', 'luna'];
  function shotIcon(c, cx, cy, r, i) {
    var f = A.SHAPES && A.SHAPES[SHOT_ICON[i % 3]];
    c.save();
    if (f) f(c, cx, cy, r, [C.sun, C.pinkPop, C.tangerine][i % 3]);
    else { c.fillStyle = C.sun; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fill(); }
    c.restore();
  }

  function backdrop(c) {
    A.jungle(c, G.t, { dim: 0.30 });
    c.save(); c.fillStyle = 'rgba(18,45,30,.42)'; c.fillRect(0, 0, W, H); c.restore();
  }

  /* Preview of a piece inside a cell, at a size the cell can hold. */
  function preview(c, g, cx, cy, size) {
    c.save();
    g.draw(c, cx, cy, size);
    c.restore();
  }

  /* ================================================================ SCENE */
  G.scene('guardaroba', {
    enter: function () {
      var g = br();
      S.mode = waiting() > 0 ? 'apri' : 'gioca';
      S.react = 0; S.pose = null; S.last = null; S.fly = null;
      S.crate = 0; S.prize = null; S.prizeT = 0; S.idle = 0; S.flash = 0;
      G.look(G.save, look);
      if (!G.save.seen) G.save.seen = {};
      var first = !G.save.seen.guardaroba;
      G.save.seen.guardaroba = true;
      G.saveNow();
      setTimeout(function () {
        if (G.current !== 'guardaroba') return;
        if (S.mode === 'apri') G.say('Un regalo! Aprilo!');
        else if (first) G.say('Questo e il guardaroba. Tocca un giocattolo e vedi cosa fa!');
        else G.say(G.pick(['Cosa ti metti oggi?', 'Vestiamo il dino!', 'Provane uno!']));
      }, 420);
    },

    exit: function () { S.fly = null; S.mode = 'gioca'; },

    update: function (dt) {
      if (S.react > 0) S.react = Math.max(0, S.react - dt);
      if (S.prizeT > 0) S.prizeT = Math.max(0, S.prizeT - dt);
      if (S.flash > 0) S.flash = Math.max(0, S.flash - dt * 3);
      if (S.fly) {
        S.fly.k += dt / 0.4;
        if (S.fly.k >= 1) { react(S.fly.id); S.fly = null; }
      }
      G.look(G.save, look);

      /* A nudge if he freezes, twice at most, and only for the little one. */
      if (G.level === 1 && S.mode === 'gioca' && !S.fly) {
        S.idle += dt;
        if (S.idle > 12 && br().nudges < 2) {
          S.idle = 0; br().nudges++;
          var own = ownedList();
          if (own.length) { G.say('Provalo!'); S.flash = 1; }
        }
      }
    },

    onDown: function () { S.idle = 0; },

    draw: function (c) {
      backdrop(c);
      if (S.mode === 'apri') { drawOpen(c); return; }
      if (G.level === 2) drawBig(c); else drawSmall(c);
    }
  });

  /* --------------------------------------------------------- crate opening */
  function drawOpen(c) {
    var open = S.prize ? 1 : S.crate / 3;
    G.text('Un regalo per te!', W / 2, 132, {
      size: 54, color: C.cream, stroke: 'rgba(12,40,25,.75)', strokeWidth: 11
    });
    drawCrate(c, W / 2, 420, 330, open);

    if (S.prize) {
      var item = A.gearOf(S.prize);
      var k = 1 - Math.max(0, S.prizeT - 1.2) / 1.0;
      var yy = 300 - G.ease(G.clamp(k, 0, 1)) * 60;
      c.save();
      c.globalAlpha = G.clamp(k * 1.4, 0, 1);
      preview(c, item, W / 2, yy, 150);
      c.restore();
      G.text(item.name, W / 2, 560, {
        size: 46, color: C.cream, stroke: 'rgba(12,40,25,.75)', strokeWidth: 10
      });
      if (S.prizeT <= 0) {
        G.ui.button({
          x: W / 2 - 190, y: 610, w: 380, h: 96, r: 28, color: C.leaf,
          label: waiting() > 0 ? 'Un altro!' : 'Provalo!', fontSize: 40,
          onTap: function () {
            S.prize = null; S.crate = 0;
            S.mode = waiting() > 0 ? 'apri' : 'gioca';
          }
        });
      }
      return;
    }

    /* One huge target, three identical knocks. No aiming, no order. */
    G.ui.button({
      id: 'crate', x: W / 2 - 230, y: 220, w: 460, h: 400, r: 40, ghost: true,
      onTap: function () {
        S.crate++;
        G.sfx('tap'); G.shake(3);
        G.fx.burst(W / 2, 420, { color: C.sun, count: 10, speed: 240, life: 0.5, shape: 'star' });
        if (S.crate >= 3) openCrate();
      }
    });
    G.text(['Tocca la cassa!', 'Ancora!', 'Ancora una volta!'][Math.min(2, S.crate)],
      W / 2, 640, { size: 38, color: C.cream, stroke: 'rgba(12,40,25,.7)', strokeWidth: 9, weight: 800 });
  }

  /* ------------------------------------------------------------- level 1 */
  /* Grid that resizes itself so every toy you own is always on screen at once:
     never a page, never an arrow, and never a toy that disappears. A crown that
     vanishes behind a chevron is a real loss at three. */
  var GX = 560, GY = 120, GW = 696, GH = 480;
  function fit(n) {
    if (n <= 4) return { cols: 2, rows: 2 };
    if (n <= 6) return { cols: 3, rows: 2 };
    if (n <= 9) return { cols: 3, rows: 3 };
    if (n <= 12) return { cols: 4, rows: 3 };
    return { cols: 4, rows: 4 };
  }

  function drawSmall(c) {
    var own = ownedList();
    var dx = 300, dy = 650, ds = 280;

    A.dino(c, dx, dy, ds, { gear: look, color: dinoColor(), pose: pose(), t: G.t, facing: 1 });
    G.ui.button({
      id: 'poke', x: dx - 150, y: dy - 300, w: 300, h: 300, r: 40, ghost: true,
      onTap: function () { if (S.last) react(S.last); else { G.sfx('tap'); G.say('Ciao!'); } }
    });

    var f = fit(own.length), i;
    var cw = (GW - (f.cols - 1) * 20) / f.cols;
    var ch = (GH - (f.rows - 1) * 18) / f.rows;
    for (i = 0; i < own.length && i < f.cols * f.rows; i++) {
      (function (g, idx) {
        var bx = GX + (idx % f.cols) * (cw + 20);
        var by = GY + Math.floor(idx / f.cols) * (ch + 18);
        var on = wornIn(g.slot) === g.id;
        G.ui.button({
          id: 'toy' + g.id, x: bx, y: by, w: cw, h: ch, r: 24,
          color: on ? C.leafLight : C.cream,
          icon: function (cc, ccx, ccy) {
            preview(cc, g, ccx, ccy, Math.min(cw, ch) * 0.66);
            if (on) {
              cc.save(); cc.strokeStyle = C.leafDark; cc.lineWidth = 7; cc.lineCap = 'round';
              cc.beginPath();
              cc.moveTo(bx + cw - 46, by + 26); cc.lineTo(bx + cw - 32, by + 40);
              cc.lineTo(bx + cw - 12, by + 16); cc.stroke(); cc.restore();
            }
          },
          onTap: function () { toggle(g.id, bx + cw / 2, by + ch / 2, dx, dy - ds * 0.72); }
        });
      })(own[i], i);
    }

    if (!own.length) {
      G.text('Gioca e arriveranno i regali!', GX + GW / 2, GY + GH / 2, {
        size: 36, color: C.cream, weight: 800, maxWidth: GW - 40,
        stroke: 'rgba(12,40,25,.7)', strokeWidth: 9
      });
    }

    G.ui.button({
      x: GX, y: 616, w: 336, h: 96, r: 28, color: C.bark, label: 'Tutto via!', fontSize: 40,
      onTap: stripAll
    });
    G.ui.button({
      x: GX + 360, y: 616, w: 336, h: 96, r: 28, color: C.plum, label: 'Sorpresa!', fontSize: 40,
      icon: function (cc, ccx, ccy) { dice(cc, ccx - 108, ccy, 30); },
      onTap: roll
    });

    drawFly(c);
    drawProgress(c, 300, 128);
  }

  /* ------------------------------------------------------------- level 2 */
  var SLOT_NAME = { testa: 'Testa', occhi: 'Occhi', collo: 'Collo', coda: 'Coda' };

  function drawBig(c) {
    var g = br(), i;
    var dx = 330, dy = 560, ds = 225;

    mirror(c, dx, 400, 200, 260);
    A.dino(c, dx, dy, ds, { gear: look, color: dinoColor(), pose: pose(), t: G.t, facing: 1 });
    G.ui.button({
      id: 'poke', x: dx - 120, y: dy - 250, w: 240, h: 250, r: 36, ghost: true,
      onTap: function () { if (S.last) react(S.last); else { G.sfx('tap'); G.say('Ciao!'); } }
    });

    // slot bar + dice
    for (i = 0; i < A.SLOTS.length; i++) {
      (function (slot, idx) {
        var cx = 640 + idx * 122;
        var on = g.slot === slot;
        G.ui.round({
          id: 'slot' + slot, x: cx, y: 160, r: 54,
          color: on ? C.leafLight : C.cream,
          icon: function (cc, ccx, ccy, r) {
            var id = wornIn(slot), it = id && A.gearOf(id);
            if (it) preview(cc, it, ccx, ccy, r * 1.15);
            else cross(cc, ccx, ccy, r * 0.72);
          },
          onTap: function () { g.slot = slot; G.sfx('pop'); G.saveNow(); }
        });
        G.text(SLOT_NAME[slot], cx, 232, {
          size: 20, color: C.cream, weight: 800, stroke: 'rgba(12,40,25,.7)', strokeWidth: 6
        });
      })(A.SLOTS[i], i);
    }
    G.ui.round({
      id: 'dice', x: 1128, y: 160, r: 54, color: C.plum,
      icon: function (cc, ccx, ccy, r) { dice(cc, ccx, ccy, r * 0.9); },
      onTap: roll
    });

    // shelf of the active slot: nine cells, "Niente" always first
    var pool = ownedList().filter(function (it) { return it.slot === g.slot; });
    var cells = [null].concat(pool.map(function (it) { return it.id; })).slice(0, 9);
    for (i = 0; i < cells.length; i++) {
      (function (id, idx) {
        var bx = 600 + (idx % 3) * 208, by = 258 + Math.floor(idx / 3) * 154;
        var on = wornIn(g.slot) === id;
        G.ui.button({
          id: 'cell' + g.slot + idx, x: bx, y: by, w: 190, h: 140, r: 22,
          color: on ? C.leafLight : C.cream,
          icon: function (cc, ccx, ccy) {
            if (!id) { cross(cc, ccx, ccy, 40); return; }
            preview(cc, A.gearOf(id), ccx, ccy, 84);
          },
          onTap: function () {
            if (!id) {
              wear(g.slot, null); G.sfx('pop');
              S.react = 0; S.last = null;
              return;
            }
            toggle(id, bx + 95, by + 70, dx, dy - ds * 0.72);
          }
        });
      })(cells[i], i);
    }

    drawShots(c, g, dx, dy, ds);
    drawMate(c);
    drawFly(c);
    drawProgress(c, 330, 690);

    // collection pips: a count, never a judgement
    var have = ownedList().length, tot = CRATE_ORDER.length;
    G.text(have + ' di ' + tot, 1128, 232, {
      size: 20, color: C.cream, weight: 800, stroke: 'rgba(12,40,25,.7)', strokeWidth: 6
    });
  }

  function mirror(c, cx, cy, rx, ry) {
    c.save();
    c.globalAlpha = 0.22;
    c.fillStyle = C.cream;
    c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, 7); c.fill();
    c.globalAlpha = 1;
    c.strokeStyle = C.bark; c.lineWidth = 12;
    c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, 7); c.stroke();
    c.strokeStyle = C.barkDark; c.lineWidth = 4;
    c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, 7); c.stroke();
    c.restore();
  }

  /* Three portraits: photograph the whole look, get it back with one tap. It is
     the picture you show your dad and the outfit slot at the same time. */
  function drawShots(c, g, dx, dy, ds) {
    var i;
    G.ui.round({
      id: 'shot', x: 89, y: 647, r: 59, color: C.tangerine,
      icon: function (cc, ccx, ccy, r) { camera(cc, ccx, ccy, r * 0.9); },
      onTap: function () {
        var snap = {
          testa: wornIn('testa'), occhi: wornIn('occhi'),
          collo: wornIn('collo'), coda: wornIn('coda')
        };
        g.shots.unshift(snap);
        g.shots.length = Math.min(3, g.shots.length);
        G.saveNow(); G.sfx('chime'); G.fx.ring(89, 647, C.sun);
        G.say('Fatto! Un vestito nuovo.');
      }
    });
    for (i = 0; i < 3; i++) {
      (function (idx) {
        var bx = 166 + idx * 130, sh = g.shots[idx];
        G.ui.button({
          id: 'sh' + idx, x: bx, y: 588, w: 118, h: 118, r: 20,
          color: sh ? C.cream : 'rgba(255,246,224,.30)',
          icon: function (cc, ccx, ccy) {
            if (!sh) { cross(cc, ccx, ccy, 30); return; }
            A.dino(cc, ccx, ccy + 44, 96, { gear: sh, color: dinoColor(), pose: 'idle', t: 0, facing: 1 });
            shotIcon(cc, bx + 98, 606, 13, idx);
          },
          onTap: function () {
            if (!sh) { G.say('Prima fai una foto!'); return; }
            wear('testa', sh.testa || null);
            wear('occhi', sh.occhi || null);
            wear('collo', sh.collo || null);
            wear('coda', sh.coda || null);
            G.sfx('good'); G.fx.confetti();
            G.say('Ecco il tuo vestito!');
          }
        });
      })(i);
    }
  }

  /* Your brother's dino, wearing what HE left on. Read-only on purpose: writing
     into another child's save would let you lend him a piece he does not own,
     and he would lose it for good the moment he took it off. */
  function drawMate(c) {
    if (!G.accounts || !G.account) return;
    var all = G.accounts.list().filter(function (a) { return a.id !== G.account.id; });
    if (!all.length) return;
    var other = all[0];
    var sv = G.LS.get('dg.save.' + other.id, {}) || {};
    G.look(sv, mate);
    c.save();
    A.panel(c, 30, 240, 120, 172, { r: 18 });
    c.restore();
    A.dino(c, 90, 386, 128, { gear: mate, color: other.color, pose: 'idle', t: G.t, facing: 1 });
    G.text(other.name, 90, 400, { size: 18, color: C.ink, maxWidth: 104, weight: 800 });
    G.ui.button({
      id: 'mate', x: 30, y: 240, w: 120, h: 172, r: 18, ghost: true,
      onTap: function () { G.sfx('tap'); G.say('Questo e il dino di ' + other.name + '!'); }
    });
  }

  /* ---------------------------------------------------------------- bits */
  function dinoColor() { return (G.account && G.account.color) || C.dino; }

  function drawFly(c) {
    if (!S.fly) return;
    var k = G.ease(G.clamp(S.fly.k, 0, 1));
    var g = A.gearOf(S.fly.id);
    if (!g) return;
    var x = G.lerp(S.fly.x, S.fly.tx, k);
    var y = G.lerp(S.fly.y, S.fly.ty, k) - Math.sin(k * Math.PI) * 90;
    c.save();
    c.globalAlpha = 1 - k * 0.25;
    preview(c, g, x, y, 72 + k * 26);
    c.restore();
  }

  /* Progress towards the next crate, as a ring. No number to read: the ring
     fills, and when it is full the present is simply there. */
  function drawProgress(c, cx, cy) {
    var g = br(), n = earned();
    if (n >= CRATE_ORDER.length) return;
    var have = (G.save.stars || 0) + g.seed;
    var lo = starsFor(n), hi = starsFor(n + 1);
    var k = G.clamp((have - lo) / Math.max(1, hi - lo), 0, 1);
    c.save();
    c.strokeStyle = 'rgba(255,246,224,.35)'; c.lineWidth = 9; c.lineCap = 'round';
    c.beginPath(); c.arc(cx, cy, 26, 0, 7); c.stroke();
    c.strokeStyle = C.sun; c.lineWidth = 9;
    c.beginPath(); c.arc(cx, cy, 26, -Math.PI / 2, -Math.PI / 2 + k * 6.283); c.stroke();
    c.restore();
    drawCrate(c, cx, cy, 44, 0);
  }
})();
