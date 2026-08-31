/* Dino Giungla — the house: shell and furniture (namespace `A`, extends 01-art.js).

   ANCHORING CONVENTION, and it is the one thing that must not be got wrong:
   every piece of furniture is drawn from its POINT OF CONTACT WITH THE FLOOR,
   like A.dino. Not its centre. There are already three conventions loose in this
   codebase (A.egg and A.chick are centred, A.panel takes a top-left corner), and
   without this line somebody will use the centre and every piece will float
   forty pixels above its own shadow.

   THE PERSPECTIVE LAW, which is what keeps thirteen hand-drawn objects looking
   like one room instead of thirteen cut-outs:
     - FLOOR = 470 is the horizon, the same height as HORIZON in 01b, so the
       house and the jungle share a skyline.
     - Every horizontal disc — a rug, the top of a stool, a bowl, a pot — is an
       ellipse of ratio TILT. No exceptions. If a shape cannot be that ellipse,
       it is drawn from the side in pure elevation instead.
     - depth(y) scales a piece by 0.88..1.08 across the floor band. Deliberately
       narrow: the walls are orthographic, so a wider range reads as "objects of
       different sizes", not "objects at different distances".

   THINGS THAT ARE BANNED HERE, each one learned the expensive way:
     - No ceiling and no hanging lamp: both need a vanishing point the walls do
       not have.
     - No four-legged chair. Thirty-five lines, three separate planes, and every
       child knows exactly what a chair looks like, so every error shows. A pouf
       is eight lines and is never wrong.
     - No rectangular table and no rectangular rug: a rectangle on the floor
       announces the projection we are not doing.
     - No canvas shadowBlur anywhere — 22-nido.js says so too, it is a tablet.
     - No Math.random: the room must not boil between frames.

   Ink is the warm brown of 01-art, not the green-black of 01b. A wooden interior
   is warm matter; with the other outline the room looks like a piece of jungle
   that got cut out and hung on a wall. */
(function () {
  'use strict';

  var G = window.G || {};
  var C = G.C || {};
  var A = window.A || (window.A = {});
  var INK = C.ink || '#2b1d12';
  var TAU = 6.2831853;

  /* Third hand-made copy of 01-art.js's private primitives — 01c already said so
     in its own header. If a fourth appears, publish them on A once and for all,
     in the open, as a deliberate change to the art contract. */
  function _shade(col, amt) { return G.shade ? G.shade(col, amt) : col; }
  function _lw(s) { return Math.max(2.2, Math.min(5.5, s * 0.034)); }
  function _ell(c, x, y, rx, ry, rot) {
    rx = Math.max(0.2, rx); ry = Math.max(0.2, ry); rot = rot || 0;
    c.beginPath();
    c.moveTo(x + rx * Math.cos(rot), y + rx * Math.sin(rot));
    c.ellipse(x, y, rx, ry, rot, 0, TAU);
  }
  function _shape(c, col, lw) {
    c.lineJoin = 'round'; c.lineCap = 'round';
    if (lw > 0) { c.strokeStyle = INK; c.lineWidth = lw * 2; c.stroke(); }
    c.fillStyle = col; c.fill();
  }
  function _gloss(c, x, y, rx, ry, rot, a) {
    c.save(); c.globalAlpha = a === undefined ? 0.30 : a;
    _ell(c, x, y, rx, ry, rot); c.fillStyle = '#ffffff'; c.fill();
    c.restore();
  }
  function _rnd(i) { var v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); }

  /* ------------------------------------------------------- perspective law */
  A.FLOOR = 470;            // wall/floor junction
  A.TILT = 0.30;            // ry/rx of every horizontal disc
  A.FLOOR_BOTTOM = 700;

  A.roomDepth = function (y) {
    var k = (y - A.FLOOR) / (A.FLOOR_BOTTOM - A.FLOOR);
    return 0.88 + Math.max(0, Math.min(1, k)) * 0.20;
  };

  /* Contact shadow. Same shape as plotShadow in 22-nido.js: a squashed ellipse,
     never a canvas blur. */
  A.roomShadow = function (c, x, y, w) {
    c.save();
    c.globalAlpha = 0.20;
    _ell(c, x, y, w * 0.52, w * 0.52 * A.TILT * 0.62, 0);
    c.fillStyle = '#28190a'; c.fill();
    c.restore();
  };

  /* A.panel anchored to the ground instead of a top-left corner, with the sign
     hardware off: A.panel turns on grain and bolts above 90x60, and used raw as
     a universal carcass the room comes out looking like a stack of overworld
     signposts. */
  A.panelAt = function (c, cx, groundY, w, h, o) {
    o = o || {};
    var opt = { r: o.r === undefined ? 10 : o.r, bolts: false, grain: false };
    if (o.color) opt.color = o.color;
    if (o.tint) opt.tint = o.tint;
    if (A.panel) { A.panel(c, cx - w / 2, groundY - h, w, h, opt); return; }
    c.fillStyle = o.color || C.cream;
    G.roundRect(c, cx - w / 2, groundY - h, w, h, opt.r); c.fill();
  };

  /* A window onto the jungle. NOT five lines: A.jungle paints in fixed screen
     coordinates (horizon at 468, sun at 1092,104), so a rect clipped between
     y 236 and 412 would contain nothing but sky and the tips of the hills. We
     have to clip, translate and scale a crop centred on the interesting part. */
  A.jungleIn = function (c, x, y, w, h) {
    c.save();
    G.roundRect(c, x, y, w, h, 10);
    c.clip();
    var k = 0.55;
    c.translate(x + w / 2, y + h / 2);
    c.scale(k, k);
    c.translate(-640, -430);
    if (A.jungle) A.jungle(c, G.t, { dim: 0.15 });
    else { c.fillStyle = C.sky; c.fillRect(0, 0, 1280, 720); }
    c.restore();
  };

  /* ------------------------------------------------------------- the shell */
  var WALLS = [
    { base: '#f0dcc0', tint: null },
    { base: '#f0dcc0', tint: 'rgba(120,180,220,.34)' },
    { base: '#f0dcc0', tint: 'rgba(232,120,150,.28)' },
    { base: '#f0dcc0', tint: 'rgba(150,205,150,.30)' }
  ];
  var FLOORS = ['#c89a63', '#a9743f', '#c2a678', '#8f6b4a'];
  A.WALL_N = WALLS.length;
  A.FLOOR_N = FLOORS.length;

  var grads = {};
  function vgrad(c, key, y0, y1, a, b) {
    var g = grads[key];
    if (!g) {
      g = c.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, a); g.addColorStop(1, b);
      grads[key] = g;
    }
    return g;
  }

  /* One wallpaper pattern plus a tint for the four variants, the same trick
     A.panel already uses — four separate loops would be four things to look at
     instead of one. */
  A.room = function (c, o) {
    o = o || {};
    var wi = Math.max(0, Math.min(WALLS.length - 1, o.wall | 0));
    var fi = Math.max(0, Math.min(FLOORS.length - 1, o.floor | 0));
    var W = 1280, F = A.FLOOR, B = A.FLOOR_BOTTOM;
    var i, x, y;

    c.save();

    // wall
    c.fillStyle = vgrad(c, 'wall', 96, F, '#e6cfae', WALLS[wi].base);
    c.fillRect(0, 96, W, F - 96);
    c.save();                                    // vertical stripes, one pattern
    c.globalAlpha = 0.16;
    c.fillStyle = '#b08c62';
    for (i = 0; i * 96 < W; i++) c.fillRect(i * 96 + 26, 96, 30, F - 96);
    c.restore();
    c.save();                                    // little dots between stripes
    c.globalAlpha = 0.13;
    c.fillStyle = '#a87f56';
    for (i = 0; i * 96 < W; i++) {
      for (y = 140; y < F - 20; y += 78) {
        c.beginPath(); c.arc(i * 96 + 74, y, 5, 0, TAU); c.fill();
      }
    }
    c.restore();
    if (WALLS[wi].tint) {
      c.save(); c.fillStyle = WALLS[wi].tint; c.fillRect(0, 96, W, F - 96); c.restore();
    }
    // shallow side walls and a picture rail: enough architecture to stop the
    // wallpaper reading as a flat stage, without introducing a false ceiling
    c.save();
    c.fillStyle = 'rgba(72,45,22,.08)';
    c.beginPath(); c.moveTo(0,96); c.lineTo(92,126); c.lineTo(92,F); c.lineTo(0,F); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(W,96); c.lineTo(W-92,126); c.lineTo(W-92,F); c.lineTo(W,F); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(78,48,24,.20)'; c.lineWidth = 5;
    c.beginPath(); c.moveTo(0,122); c.lineTo(W,122); c.stroke();
    c.restore();

    // floor: boards that really converge — width as a function of y
    c.fillStyle = vgrad(c, 'floor' + fi, F, B + 20, _shade(FLOORS[fi], -26), FLOORS[fi]);
    c.fillRect(0, F, W, 720 - F);
    c.save();                                    // long seams converge to the room centre
    c.strokeStyle = 'rgba(60,36,16,.13)'; c.lineWidth = 2;
    for (i = -1; i <= 9; i++) {
      c.beginPath(); c.moveTo(640, F); c.lineTo(i * 160, 720); c.stroke();
    }
    c.restore();
    c.save();
    c.strokeStyle = 'rgba(60,36,16,.30)';
    c.lineWidth = 3;
    for (y = F + 16; y < 720; y += 16 + (y - F) * 0.14) {
      c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
    }
    c.restore();
    c.save();                                    // board joints, deterministic
    c.strokeStyle = 'rgba(60,36,16,.22)';
    c.lineWidth = 2;
    for (i = 0; i < 26; i++) {
      x = _rnd(i * 3 + 5) * W;
      y = F + 24 + _rnd(i * 3 + 6) * (720 - F - 30);
      c.beginPath(); c.moveTo(x, y - 7); c.lineTo(x, y + 7); c.stroke();
    }
    c.restore();

    // skirting board at the junction
    c.fillStyle = _shade(FLOORS[fi], -44);
    c.fillRect(0, F - 16, W, 18);
    c.fillStyle = 'rgba(255,246,224,.30)';
    c.fillRect(0, F - 16, W, 5);

    // ambient pool of light, so the middle of the room reads as the middle
    c.save();
    c.globalAlpha = 0.16;
    _ell(c, 640, F + 120, 470, 470 * A.TILT * 1.5, 0);
    c.fillStyle = C.sun || '#ffd75e'; c.fill();
    c.restore();

    // a broad sunbeam gives furniture a common light direction
    c.save(); c.globalAlpha = 0.055; c.fillStyle = '#fff6d0';
    c.beginPath(); c.moveTo(890, 122); c.lineTo(1080, 122); c.lineTo(900, 720); c.lineTo(530, 720); c.closePath(); c.fill();
    c.restore();

    c.restore();
  };

  /* ============================================================= FURNITURE */
  /* Every painter: (c, x, y, s, o) with (x,y) ON THE FLOOR, s the nominal width,
     o = { c: colorway index }. Colourways are arrays so the shop can preview the
     next one without knowing anything about the piece. */
  function pick(list, o) { return list[(o && o.c | 0) % list.length]; }

  var COL = {
    tappeto: ['#e8536b', '#4d80e4', '#38d9a9', '#ff9f43'],
    ciotola: ['#4d80e4', '#e8536b', '#8f5bd6', '#38d9a9'],
    pouf: ['#ff6fae', '#ffd75e', '#63c777', '#4d80e4'],
    pianta: ['#2f8f4e', '#63c777', '#38d9a9', '#7a9f3e'],
    lampada: ['#ffd75e', '#fff0b8', '#ffb14e', '#f6e7c1'],
    finestra: ['#7a4a26', '#8f5bd6', '#4d80e4', '#2f8f4e'],
    lettino: ['#8f5bd6', '#4d80e4', '#e8536b', '#38d9a9'],
    tavolino: ['#7a4a26', '#a9743f', '#8f5bd6', '#2f8f4e'],
    quadro: ['#ffd75e', '#e8536b', '#4d80e4', '#63c777'],
    libreria: ['#7a4a26', '#a9743f', '#8f6b4a', '#5d3a1d'],
    casetta: ['#ff9f43', '#63c777', '#4d80e4', '#ff6fae'],
    amaca: ['#38d9a9', '#ff6fae', '#ffd75e', '#4d80e4'],
    acquario: ['#3fb6c9', '#4d80e4', '#38d9a9', '#8f5bd6'],
    albero: ['#2f8f4e', '#63c777', '#7a9f3e', '#38d9a9']
  };

  function pTappeto(c, x, y, s, o) {
    var col = pick(COL.tappeto, o), r = s * 0.5;
    _ell(c, x, y, r, r * A.TILT, 0); _shape(c, col, _lw(s) * 0.7);
    c.save(); c.globalAlpha = 0.5; c.strokeStyle = '#fff';
    c.lineWidth = Math.max(2, s * 0.02);
    _ell(c, x, y, r * 0.72, r * 0.72 * A.TILT, 0); c.stroke();
    _ell(c, x, y, r * 0.42, r * 0.42 * A.TILT, 0); c.stroke();
    c.restore();
  }

  function pCiotola(c, x, y, s, o) {
    var col = pick(COL.ciotola, o), r = s * 0.5, lw = _lw(s) * 0.8;
    c.beginPath();
    c.ellipse(x, y - r * A.TILT * 0.7, r, r * A.TILT, 0, 0, Math.PI);
    c.closePath();
    _shape(c, col, lw);
    _ell(c, x, y - r * A.TILT * 0.7, r, r * A.TILT, 0);
    _shape(c, _shade(col, 34), lw * 0.8);
    if (A.fruit) {
      A.fruit(c, x - r * 0.28, y - r * A.TILT * 1.1, r * 0.26, 'fragola');
      A.fruit(c, x + r * 0.22, y - r * A.TILT * 1.25, r * 0.24, 'mela');
    }
  }

  function pPouf(c, x, y, s, o) {
    var col = pick(COL.pouf, o), r = s * 0.5, h = s * 0.36, lw = _lw(s);
    c.beginPath();
    c.moveTo(x - r, y - h);
    c.lineTo(x - r, y - r * A.TILT);
    c.ellipse(x, y - r * A.TILT, r, r * A.TILT, 0, Math.PI, 0, true);
    c.lineTo(x + r, y - h);
    c.closePath();
    _shape(c, col, lw);
    _ell(c, x, y - h, r, r * A.TILT, 0);
    _shape(c, _shade(col, 26), lw);
    c.save(); c.globalAlpha = 0.35; c.strokeStyle = _shade(col, -40);
    c.lineWidth = Math.max(2, s * 0.022);
    c.beginPath(); c.moveTo(x - r * 0.5, y - h + r * A.TILT * 0.6); c.lineTo(x - r * 0.5, y - h * 0.3);
    c.moveTo(x + r * 0.5, y - h + r * A.TILT * 0.6); c.lineTo(x + r * 0.5, y - h * 0.3);
    c.stroke(); c.restore();
    _gloss(c, x - r * 0.34, y - h - r * A.TILT * 0.24, r * 0.28, r * A.TILT * 0.34, 0, 0.34);
  }

  function pPianta(c, x, y, s, o) {
    var col = pick(COL.pianta, o), r = s * 0.30, ph = s * 0.34, lw = _lw(s);
    c.beginPath();                                  // pot, a truncated cone
    c.moveTo(x - r, y - ph);
    c.lineTo(x - r * 0.74, y - r * A.TILT);
    c.ellipse(x, y - r * A.TILT, r * 0.74, r * 0.74 * A.TILT, 0, Math.PI, 0, true);
    c.lineTo(x + r, y - ph);
    c.closePath();
    _shape(c, C.tangerine || '#ff9f43', lw);
    _ell(c, x, y - ph, r, r * A.TILT, 0);
    _shape(c, _shade(C.tangerine || '#ff9f43', -24), lw * 0.8);
    var i, a, ll = s * 0.52;                        // leaves, a fan
    for (i = 0; i < 5; i++) {
      a = -Math.PI / 2 + (i - 2) * 0.42;
      c.beginPath();
      c.moveTo(x, y - ph);
      c.quadraticCurveTo(
        x + Math.cos(a) * ll * 0.62 - Math.sin(a) * ll * 0.30,
        y - ph + Math.sin(a) * ll * 0.62 + Math.cos(a) * ll * 0.30,
        x + Math.cos(a) * ll, y - ph + Math.sin(a) * ll);
      c.quadraticCurveTo(
        x + Math.cos(a) * ll * 0.62 + Math.sin(a) * ll * 0.30,
        y - ph + Math.sin(a) * ll * 0.62 - Math.cos(a) * ll * 0.30,
        x, y - ph);
      c.closePath();
      _shape(c, i % 2 ? _shade(col, 20) : col, lw * 0.75);
    }
  }

  function pLampada(c, x, y, s, o) {
    var col = pick(COL.lampada, o), r = s * 0.42, h = s * 1.15, lw = _lw(s);
    _ell(c, x, y - r * 0.16 * A.TILT, r * 0.56, r * 0.56 * A.TILT, 0);
    _shape(c, C.barkDark || '#4e2f18', lw * 0.8);
    c.strokeStyle = INK; c.lineWidth = lw * 1.6;    // stem
    c.beginPath(); c.moveTo(x, y - r * 0.2); c.lineTo(x, y - h + r * 0.5); c.stroke();
    c.strokeStyle = C.bark || '#7a4a26'; c.lineWidth = lw * 0.9;
    c.beginPath(); c.moveTo(x, y - r * 0.2); c.lineTo(x, y - h + r * 0.5); c.stroke();
    c.save();                                       // pool of light
    c.globalAlpha = 0.26; c.fillStyle = col;
    c.beginPath();
    c.moveTo(x - r * 0.86, y - h + r * 0.62);
    c.lineTo(x + r * 0.86, y - h + r * 0.62);
    c.lineTo(x + r * 2.0, y);
    c.lineTo(x - r * 2.0, y);
    c.closePath(); c.fill();
    c.restore();
    c.beginPath();                                  // shade
    c.moveTo(x - r * 0.86, y - h + r * 0.62);
    c.lineTo(x - r * 0.52, y - h);
    c.lineTo(x + r * 0.52, y - h);
    c.lineTo(x + r * 0.86, y - h + r * 0.62);
    c.closePath();
    _shape(c, col, lw);
  }

  function pFinestra(c, x, y, s, o) {
    var col = pick(COL.finestra, o), w = s, h = s * 0.78, lw = _lw(s);
    var top = y - h;
    A.jungleIn(c, x - w / 2 + 8, top + 8, w - 16, h - 16);
    c.strokeStyle = col; c.lineWidth = lw * 2.2;    // frame
    G.roundRect(c, x - w / 2, top, w, h, 10); c.stroke();
    c.strokeStyle = INK; c.lineWidth = lw * 0.8;
    G.roundRect(c, x - w / 2, top, w, h, 10); c.stroke();
    c.strokeStyle = col; c.lineWidth = lw * 1.4;    // mullions
    c.beginPath();
    c.moveTo(x, top + 6); c.lineTo(x, top + h - 6);
    c.moveTo(x - w / 2 + 6, top + h / 2); c.lineTo(x + w / 2 - 6, top + h / 2);
    c.stroke();
    c.fillStyle = _shade(col, -30);                 // sill
    G.roundRect(c, x - w / 2 - 10, top + h - 4, w + 20, 14, 5); c.fill();
  }

  /* The dino DOES NOT LIE DOWN — verified in 01-art.js: the `sleep` pose closes
     the eyes and lifts the arms but the geometry stays anchored at the feet. So
     he dozes standing on the mattress and the blanket is drawn IN FRONT of him,
     hiding the legs. That is what `front` painters are for. */
  function pLettino(c, x, y, s, o) {
    var col = pick(COL.lettino, o), w = s, h = s * 0.30, lw = _lw(s);
    c.fillStyle = C.bark || '#7a4a26';              // legs
    c.fillRect(x - w * 0.44, y - h * 0.5, w * 0.08, h * 0.5);
    c.fillRect(x + w * 0.36, y - h * 0.5, w * 0.08, h * 0.5);
    _ell(c, x, y - h, w * 0.5, w * 0.5 * A.TILT, 0);   // mattress
    _shape(c, C.cream || '#fff6e0', lw);
    c.beginPath();                                  // headboard
    c.moveTo(x - w * 0.5, y - h);
    c.lineTo(x - w * 0.5, y - h - s * 0.34);
    c.quadraticCurveTo(x - w * 0.34, y - h - s * 0.44, x - w * 0.18, y - h - s * 0.34);
    c.lineTo(x - w * 0.18, y - h);
    c.closePath();
    _shape(c, col, lw);
  }
  function pLettinoFront(c, x, y, s, o) {
    var col = pick(COL.lettino, o), w = s, h = s * 0.30, lw = _lw(s);
    c.beginPath();                                  // blanket, hides the feet
    c.moveTo(x - w * 0.16, y - h + w * 0.5 * A.TILT * 0.2);
    c.quadraticCurveTo(x + w * 0.16, y - h - s * 0.12, x + w * 0.5, y - h);
    c.lineTo(x + w * 0.5, y - h + w * 0.5 * A.TILT);
    c.quadraticCurveTo(x + w * 0.1, y - h + w * 0.5 * A.TILT * 1.5, x - w * 0.16, y - h + w * 0.5 * A.TILT * 0.6);
    c.closePath();
    _shape(c, _shade(col, 18), lw * 0.85);
    c.save(); c.globalAlpha = 0.4; c.strokeStyle = _shade(col, -34);
    c.lineWidth = Math.max(2, s * 0.016);
    c.beginPath();
    c.moveTo(x + w * 0.06, y - h - s * 0.02); c.lineTo(x + w * 0.12, y - h + w * 0.5 * A.TILT * 0.9);
    c.moveTo(x + w * 0.30, y - h - s * 0.04); c.lineTo(x + w * 0.34, y - h + w * 0.5 * A.TILT * 0.7);
    c.stroke(); c.restore();
  }

  function pTavolino(c, x, y, s, o) {
    var col = pick(COL.tavolino, o), r = s * 0.5, h = s * 0.46, lw = _lw(s);
    c.strokeStyle = INK; c.lineWidth = lw * 2.4;    // pedestal
    c.beginPath(); c.moveTo(x, y - r * A.TILT * 0.4); c.lineTo(x, y - h); c.stroke();
    c.strokeStyle = _shade(col, -18); c.lineWidth = lw * 1.5;
    c.beginPath(); c.moveTo(x, y - r * A.TILT * 0.4); c.lineTo(x, y - h); c.stroke();
    _ell(c, x, y - r * A.TILT * 0.3, r * 0.42, r * 0.42 * A.TILT, 0);   // foot
    _shape(c, _shade(col, -24), lw * 0.8);
    _ell(c, x, y - h, r, r * A.TILT, 0);            // top
    _shape(c, col, lw);
    _gloss(c, x - r * 0.30, y - h - r * A.TILT * 0.26, r * 0.34, r * A.TILT * 0.36, 0, 0.28);
  }

  function pQuadro(c, x, y, s, o) {
    var col = pick(COL.quadro, o), w = s, h = s * 0.86, lw = _lw(s);
    var top = y - h;
    c.fillStyle = C.cream || '#fff6e0';
    G.roundRect(c, x - w / 2, top, w, h, 8); c.fill();
    if (A.dino) {                                   // the portrait is your dino
      c.save();
      G.roundRect(c, x - w / 2 + 10, top + 10, w - 20, h - 20); c.clip();
      var look = (typeof G.look === 'function') ? G.look() : null;
      var col2 = (G.account && G.account.color) || C.dino;
      var oo = { color: col2, pose: 'idle', t: 0, facing: 1 };
      if (look) oo.gear = look;
      A.dino(c, x, top + h - 14, h * 0.86, oo);
      c.restore();
    }
    c.strokeStyle = col; c.lineWidth = lw * 2.6;
    G.roundRect(c, x - w / 2, top, w, h, 8); c.stroke();
    c.strokeStyle = INK; c.lineWidth = lw * 0.8;
    G.roundRect(c, x - w / 2, top, w, h, 8); c.stroke();
  }

  function pLibreria(c, x, y, s, o) {
    var col = pick(COL.libreria, o), w = s, h = s * 1.05, lw = _lw(s);
    A.panelAt(c, x, y, w, h, { color: col, r: 8 });
    var i, j, bx, bw, bh, sh;
    c.save();
    for (j = 0; j < 3; j++) {
      var sy = y - h + 22 + j * (h - 34) / 3;
      c.fillStyle = _shade(col, -34);
      c.fillRect(x - w / 2 + 8, sy + (h - 34) / 3 - 8, w - 16, 6);
      bx = x - w / 2 + 16;
      for (i = 0; i < 5; i++) {
        bw = 11 + _rnd(j * 7 + i) * 9;
        bh = (h - 34) / 3 - 16 - _rnd(j * 5 + i + 3) * 8;
        if (bx + bw > x + w / 2 - 16) break;
        sh = [C.berry, C.sun, C.mint, C.blueberry, C.pinkPop][(i + j) % 5] || '#e8536b';
        c.fillStyle = sh;
        G.roundRect(c, bx, sy + (h - 34) / 3 - 8 - bh, bw, bh, 2); c.fill();
        c.strokeStyle = 'rgba(40,25,10,.35)'; c.lineWidth = 1.5;
        G.roundRect(c, bx, sy + (h - 34) / 3 - 8 - bh, bw, bh, 2); c.stroke();
        bx += bw + 3;
      }
    }
    c.restore();
  }

  function pCasettaPulcini(c, x, y, s, o) {
    var col = pick(COL.casetta, o), w = s, h = s * 0.62, lw = _lw(s);
    c.beginPath();                                  // roof
    c.moveTo(x - w * 0.60, y - h);
    c.lineTo(x, y - h - s * 0.34);
    c.lineTo(x + w * 0.60, y - h);
    c.closePath();
    _shape(c, col, lw);
    A.panelAt(c, x, y, w * 0.86, h, { color: C.cream, r: 6 });
    c.fillStyle = INK;                              // hole
    _ell(c, x, y - h * 0.56, w * 0.17, w * 0.17, 0); c.fill();
    c.strokeStyle = C.bark || '#7a4a26'; c.lineWidth = lw;
    c.beginPath(); c.moveTo(x, y - h * 0.30); c.lineTo(x, y - h * 0.06); c.stroke();
  }

  function pAmaca(c, x, y, s, o) {
    var col = pick(COL.amaca, o), w = s, h = s * 0.62, lw = _lw(s);
    c.strokeStyle = C.bark || '#7a4a26'; c.lineWidth = lw * 1.4;
    c.beginPath();                                  // posts
    c.moveTo(x - w * 0.5, y); c.lineTo(x - w * 0.5, y - h);
    c.moveTo(x + w * 0.5, y); c.lineTo(x + w * 0.5, y - h);
    c.stroke();
    var sag = Math.sin((G.t || 0) * 1.1) * s * 0.03;
    c.beginPath();                                  // the sling
    c.moveTo(x - w * 0.5, y - h);
    c.quadraticCurveTo(x, y - h * 0.14 + sag, x + w * 0.5, y - h);
    c.quadraticCurveTo(x, y - h * 0.44 + sag, x - w * 0.5, y - h);
    c.closePath();
    _shape(c, col, lw);
    c.save(); c.globalAlpha = 0.4; c.strokeStyle = '#fff';
    c.lineWidth = Math.max(2, s * 0.014);
    for (var i = 1; i < 5; i++) {
      var t = i / 5;
      c.beginPath();
      c.moveTo(x - w * 0.5 + w * t, y - h + t * (1 - t) * h * 1.5);
      c.lineTo(x - w * 0.5 + w * t, y - h + t * (1 - t) * h * 1.5 + h * 0.2);
      c.stroke();
    }
    c.restore();
  }

  function pAcquario(c, x, y, s, o) {
    var col = pick(COL.acquario, o), w = s, h = s * 0.66, lw = _lw(s);
    A.panelAt(c, x, y, w * 0.94, s * 0.20, { color: C.bark, r: 5 });   // stand
    var top = y - s * 0.20 - h;
    c.fillStyle = _shade(col, 30);                  // water
    G.roundRect(c, x - w / 2, top, w, h, 8); c.fill();
    c.save();
    G.roundRect(c, x - w / 2, top, w, h, 8); c.clip();
    c.fillStyle = _shade(col, -30);                 // gravel
    c.fillRect(x - w / 2, top + h - 12, w, 12);
    var i, fx, fy, fs;
    for (i = 0; i < 3; i++) {                       // deterministic fish
      fx = x - w * 0.32 + _rnd(i * 4 + 1) * w * 0.64 + Math.sin((G.t || 0) * 0.7 + i * 2) * w * 0.12;
      fy = top + 18 + _rnd(i * 4 + 2) * (h - 44);
      fs = 8 + _rnd(i * 4 + 3) * 6;
      c.fillStyle = [C.sun, C.tangerine, C.pinkPop][i % 3] || '#ffd75e';
      c.beginPath(); c.ellipse(fx, fy, fs, fs * 0.62, 0, 0, TAU); c.fill();
      c.beginPath();
      c.moveTo(fx - fs, fy); c.lineTo(fx - fs * 1.7, fy - fs * 0.5);
      c.lineTo(fx - fs * 1.7, fy + fs * 0.5); c.closePath(); c.fill();
    }
    c.restore();
    c.strokeStyle = INK; c.lineWidth = lw * 1.2;
    G.roundRect(c, x - w / 2, top, w, h, 8); c.stroke();
    _gloss(c, x - w * 0.28, top + h * 0.24, w * 0.14, h * 0.30, -0.4, 0.30);
  }

  /* A whole tree, indoors, because it is absurd and it will make them laugh for
     weeks. Six lines, because A.tree already exists. */
  function pAlbero(c, x, y, s, o) {
    var col = pick(COL.albero, o), r = s * 0.34, lw = _lw(s);
    c.beginPath();
    c.moveTo(x - r, y - s * 0.30);
    c.lineTo(x - r * 0.76, y - r * A.TILT);
    c.ellipse(x, y - r * A.TILT, r * 0.76, r * 0.76 * A.TILT, 0, Math.PI, 0, true);
    c.lineTo(x + r, y - s * 0.30);
    c.closePath();
    _shape(c, C.tangerine || '#ff9f43', lw);
    if (A.tree) A.tree(c, x, y - s * 0.30, s * 1.5, { kind: 'grande' });
    void col;
  }

  /* The door between the two rooms. Pure elevation, no vanishing point, so it
     obeys the same ban on perspective as everything else in this file.
     `o.side` is -1 for a door on the left wall, 1 for the right. */
  A.porta = function (c, cx, groundY, s, o) {
    o = o || {};
    var side = o.side === -1 ? -1 : 1;
    var w = s * 0.62, h = s * 1.30, lw = _lw(s);
    var top = groundY - h;
    c.save();
    c.fillStyle = _shade(C.bark || '#7a4a26', -34);          // frame
    G.roundRect(c, cx - w / 2 - 10, top - 10, w + 20, h + 10, 10); c.fill();
    c.fillStyle = '#3a2414';                                  // the dark beyond
    G.roundRect(c, cx - w / 2, top, w, h, 6); c.fill();
    c.save();                                                 // a warm sliver of the next room
    G.roundRect(c, cx - w / 2, top, w, h, 6); c.clip();
    c.globalAlpha = 0.5;
    c.fillStyle = C.sun || '#ffd75e';
    c.fillRect(cx - w / 2, top, w * 0.34, h);
    c.restore();
    c.fillStyle = C.bark || '#7a4a26';                        // the leaf, ajar
    G.roundRect(c, cx - w / 2 + w * 0.34, top, w * 0.66, h, 5); c.fill();
    c.strokeStyle = INK; c.lineWidth = lw * 0.9;
    G.roundRect(c, cx - w / 2 + w * 0.34, top, w * 0.66, h, 5); c.stroke();
    c.fillStyle = C.sun || '#ffd75e';                         // handle
    c.beginPath();
    c.arc(cx - w / 2 + w * 0.46, groundY - h * 0.48, s * 0.045, 0, TAU);
    c.fill();
    c.restore();
    void side;
  };

  A.HOUSE = {
    tappeto: pTappeto, ciotola: pCiotola, pouf: pPouf, pianta: pPianta,
    lampada: pLampada, finestra: pFinestra, lettino: pLettino,
    tavolino: pTavolino, quadro: pQuadro, libreria: pLibreria,
    casetta: pCasettaPulcini, amaca: pAmaca, acquario: pAcquario, albero: pAlbero
  };
  A.HOUSE_FRONT = { lettino: pLettinoFront };

  A.house = function (c, id, x, y, s, o) {
    var f = id && A.HOUSE[id];
    if (!f) return;
    c.save(); f(c, x, y, s > 0 ? s : 100, o || {}); c.restore();
  };
  A.houseFront = function (c, id, x, y, s, o) {
    var f = id && A.HOUSE_FRONT[id];
    if (!f) return;
    c.save(); f(c, x, y, s > 0 ? s : 100, o || {}); c.restore();
  };

  A._casa_ok = true;
})();
