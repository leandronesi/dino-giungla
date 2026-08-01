/* Art, part two: the world around the dino — backdrop, foliage, props, signs
   and the hat catalogue. Loads right after 01-art.js and fills in the rest of
   the A namespace promised by CONTRACT.md.

   Everything here is deterministic: scenery positions come from a hash of the
   element index, never from Math.random(), or the jungle would boil. */
(function () {
  'use strict';

  var A = (window.A = window.A || {});
  var C = G.C, W = G.W, H = G.H;
  var TAU = Math.PI * 2;
  var INK = '#1e3a24';

  function rnd(i) { var v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); }
  function ell(c, x, y, rx, ry, rot) {
    c.beginPath();
    if (c.ellipse) c.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot || 0, 0, TAU);
    else c.arc(x, y, Math.max(.1, rx), 0, TAU);
  }
  function ink(c, w) { c.strokeStyle = INK; c.lineWidth = w; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); }
  function fillInk(c, col, w) { c.fillStyle = col; c.fill(); if (w > 0) ink(c, w); }

  /* Gradients are built once: rebuilding them every frame is the classic
     canvas performance leak on a cheap tablet. */
  var GRAD = {};
  function grad(c, key, x0, y0, x1, y1, stops) {
    if (GRAD[key]) return GRAD[key];
    var g = c.createLinearGradient(x0, y0, x1, y1);
    for (var i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
    GRAD[key] = g;
    return g;
  }

  /* A leaf: two curves meeting at a tip, with a midrib. Angle in radians. */
  function leaf(c, x, y, len, wid, ang, col, lw) {
    c.save();
    c.translate(x, y); c.rotate(ang);
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(len * .42, -wid, len, 0);
    c.quadraticCurveTo(len * .42, wid, 0, 0);
    c.closePath();
    fillInk(c, col, lw || 0);
    c.strokeStyle = 'rgba(20,50,30,.30)';
    c.lineWidth = Math.max(1, wid * .13);
    c.beginPath(); c.moveTo(len * .06, 0); c.lineTo(len * .92, 0); c.stroke();
    c.restore();
  }

  /* ================================================================ JUNGLE */
  var HORIZON = 468;

  A.jungle = function (ctx, t, o) {
    o = o || {}; t = t || 0;
    var i, x, y, s, sway;

    ctx.save();

    // sky
    ctx.fillStyle = grad(ctx, 'sky', 0, 0, 0, HORIZON, [[0, C.skyDeep], [.62, C.sky], [1, '#d9f2e4']]);
    ctx.fillRect(0, 0, W, HORIZON + 2);

    // sun with a soft halo
    ctx.save();
    ctx.globalAlpha = .35;
    ctx.fillStyle = C.sun;
    ell(ctx, 1092, 104, 128, 128); ctx.fill();
    ctx.globalAlpha = .6;
    ell(ctx, 1092, 104, 88, 88); ctx.fill();
    ctx.globalAlpha = 1;
    ell(ctx, 1092, 104, 54, 54); ctx.fill();
    ctx.restore();

    // far hills — two soft ridges
    ctx.fillStyle = '#5aa87a';
    ctx.beginPath(); ctx.moveTo(-40, HORIZON);
    for (i = 0; i <= 8; i++) {
      x = -40 + i * 170;
      ctx.quadraticCurveTo(x + 85, HORIZON - 80 - rnd(i) * 62, x + 170, HORIZON - 6);
    }
    ctx.lineTo(W + 40, HORIZON + 8); ctx.lineTo(-40, HORIZON + 8); ctx.closePath(); ctx.fill();

    ctx.fillStyle = '#3f8f5d';
    ctx.beginPath(); ctx.moveTo(-40, HORIZON);
    for (i = 0; i <= 6; i++) {
      x = -40 + i * 230;
      ctx.quadraticCurveTo(x + 115, HORIZON - 40 - rnd(i + 20) * 44, x + 230, HORIZON - 2);
    }
    ctx.lineTo(W + 40, HORIZON + 8); ctx.lineTo(-40, HORIZON + 8); ctx.closePath(); ctx.fill();

    // mid jungle: a band of crowns just behind the horizon
    for (i = 0; i < 11; i++) {
      x = -30 + i * 126 + rnd(i + 40) * 40;
      s = 62 + rnd(i + 60) * 34;
      sway = Math.sin(t * .5 + i * .8) * 3;
      ctx.fillStyle = i % 2 ? C.leafDark : '#26723f';
      ell(ctx, x + sway, HORIZON - s * .52, s, s * .62); ctx.fill();
      ell(ctx, x + sway - s * .5, HORIZON - s * .28, s * .62, s * .45); ctx.fill();
      ell(ctx, x + sway + s * .5, HORIZON - s * .30, s * .62, s * .45); ctx.fill();
    }

    // ground
    ctx.fillStyle = grad(ctx, 'ground', 0, HORIZON, 0, H, [[0, '#3f9d5d'], [.35, C.leaf], [1, '#256b3c']]);
    ctx.fillRect(0, HORIZON, W, H - HORIZON);

    // a lighter clearing so the middle of the screen stays readable
    ctx.save();
    ctx.globalAlpha = .30; ctx.fillStyle = C.leafLight;
    ell(ctx, W * .5, H * .86, W * .52, 190); ctx.fill();
    ctx.restore();

    // grass tufts along the horizon and scattered on the ground
    ctx.strokeStyle = '#2b7a45'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (i = 0; i < 90; i++) {
      x = rnd(i + 100) * (W + 40) - 20;
      y = HORIZON + 6 + rnd(i + 200) * (H - HORIZON - 10);
      s = 8 + rnd(i + 300) * 12;
      sway = Math.sin(t * 1.1 + i) * 2.2;
      ctx.beginPath();
      ctx.moveTo(x, y); ctx.quadraticCurveTo(x + sway, y - s * .6, x + sway * 2, y - s);
      ctx.moveTo(x + 6, y); ctx.quadraticCurveTo(x + 6 + sway, y - s * .5, x + 6 + sway * 2, y - s * .8);
      ctx.stroke();
    }

    if (o.night) { ctx.fillStyle = 'rgba(18,32,72,.42)'; ctx.fillRect(0, 0, W, H); }
    if (o.tint) { ctx.save(); ctx.globalAlpha = .28; ctx.fillStyle = o.tint; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    if (o.dim) { ctx.fillStyle = 'rgba(10,30,20,' + Math.min(.85, o.dim) + ')'; ctx.fillRect(0, 0, W, H); }

    ctx.restore();
  };

  /* Foreground fronds in the top corners. Drawn before the HUD, which the core
     paints afterwards, so they never hide the counters. */
  A.canopy = function (ctx, t) {
    t = t || 0;
    var i, sw;
    ctx.save();
    for (i = 0; i < 5; i++) {
      sw = Math.sin(t * .55 + i * .9) * .05;
      leaf(ctx, -30 + i * 34, -22, 190 + rnd(i) * 70, 46 + rnd(i + 5) * 16,
        Math.PI * (.18 + i * .055) + sw, i % 2 ? C.leafDark : '#2a7c45', 0);
    }
    for (i = 0; i < 5; i++) {
      sw = Math.sin(t * .5 + i * 1.1 + 2) * .05;
      leaf(ctx, W + 30 - i * 34, -22, 190 + rnd(i + 9) * 70, 46 + rnd(i + 14) * 16,
        Math.PI * (.82 - i * .055) + sw, i % 2 ? C.leafDark : '#2a7c45', 0);
    }
    ctx.restore();
  };

  /* ================================================================= PROPS */
  A.cloud = function (ctx, x, y, s) {
    s = s > 0 ? s : 60;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    ell(ctx, x, y, s * .62, s * .40); ctx.fill();
    ell(ctx, x - s * .48, y + s * .10, s * .40, s * .28); ctx.fill();
    ell(ctx, x + s * .46, y + s * .12, s * .36, s * .26); ctx.fill();
    ell(ctx, x + s * .10, y - s * .24, s * .34, s * .28); ctx.fill();
    ctx.restore();
  };

  A.rock = function (ctx, x, y, s) {
    s = s > 0 ? s : 40;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x - s * .5, y);
    ctx.lineTo(x - s * .34, y - s * .42);
    ctx.lineTo(x + s * .04, y - s * .56);
    ctx.lineTo(x + s * .40, y - s * .34);
    ctx.lineTo(x + s * .5, y);
    ctx.closePath();
    fillInk(ctx, '#9aa3a0', Math.max(2, s * .06));
    ctx.fillStyle = 'rgba(255,255,255,.30)';
    ctx.beginPath();
    ctx.moveTo(x - s * .30, y - s * .38); ctx.lineTo(x + s * .02, y - s * .50);
    ctx.lineTo(x - s * .04, y - s * .30); ctx.closePath(); ctx.fill();
    ctx.restore();
  };

  A.flower = function (ctx, x, y, s, color) {
    s = s > 0 ? s : 30;
    color = color || C.pinkPop;
    var i, a, pr = s * .26;
    ctx.save();
    ctx.strokeStyle = '#2b7a45'; ctx.lineWidth = Math.max(2, s * .07); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - s * .10, y - s * .40, x, y - s * .62); ctx.stroke();
    leaf(ctx, x, y - s * .30, s * .30, s * .11, -0.35, '#3f9d5d', 0);
    for (i = 0; i < 6; i++) {
      a = i * TAU / 6;
      ell(ctx, x + Math.cos(a) * pr, y - s * .62 + Math.sin(a) * pr, pr * .92, pr * .92);
      fillInk(ctx, color, Math.max(1.6, s * .045));
    }
    ell(ctx, x, y - s * .62, pr * .70, pr * .70);
    fillInk(ctx, C.sun, Math.max(1.6, s * .045));
    ctx.restore();
  };

  A.bush = function (ctx, x, y, s, o) {
    o = o || {};
    s = s > 0 ? s : 70;
    var col = o.color || C.leaf, lw = Math.max(2.4, s * .045), i, a;
    ctx.save();
    ell(ctx, x - s * .34, y - s * .26, s * .40, s * .32); fillInk(ctx, G.shade(col, -22), lw);
    ell(ctx, x + s * .34, y - s * .24, s * .38, s * .30); fillInk(ctx, G.shade(col, -22), lw);
    ell(ctx, x, y - s * .40, s * .48, s * .40); fillInk(ctx, col, lw);
    ctx.fillStyle = 'rgba(255,255,255,.16)';
    ell(ctx, x - s * .14, y - s * .54, s * .24, s * .13, -.4); ctx.fill();
    if (o.berries) {
      for (i = 0; i < 5; i++) {
        a = i * 1.7;
        ell(ctx, x + Math.cos(a) * s * .32, y - s * .34 + Math.sin(a) * s * .22, s * .075, s * .075);
        fillInk(ctx, o.berryColor || C.berry, Math.max(1.4, s * .028));
      }
    }
    ctx.restore();
  };

  A.tree = function (ctx, x, y, s, o) {
    o = o || {};
    s = s > 0 ? s : 200;
    var t = o.t || 0, kind = o.kind || 'grande';
    var lw = Math.max(2.6, s * .022), i, a, sway = Math.sin(t * .5 + x * .01) * .045;
    ctx.save();

    if (kind === 'palma') {
      ctx.beginPath();
      ctx.moveTo(x - s * .05, y);
      ctx.quadraticCurveTo(x - s * .02 + s * .10, y - s * .50, x + s * .07, y - s * .86);
      ctx.lineTo(x + s * .13, y - s * .85);
      ctx.quadraticCurveTo(x + s * .06 + s * .10, y - s * .50, x + s * .06, y);
      ctx.closePath();
      fillInk(ctx, C.bark, lw);
      for (i = 0; i < 7; i++) {
        a = -Math.PI * .5 + (i - 3) * .42 + sway;
        leaf(ctx, x + s * .10, y - s * .86, s * .40, s * .105, a, i % 2 ? C.leafDark : C.leaf, lw * .8);
      }
      ell(ctx, x + s * .10, y - s * .86, s * .05, s * .05); fillInk(ctx, C.barkDark, lw * .8);
      ell(ctx, x + s * .17, y - s * .78, s * .045, s * .05); fillInk(ctx, '#b98a4e', lw * .7);
    } else if (kind === 'felce') {
      ctx.beginPath();
      ctx.moveTo(x - s * .04, y); ctx.lineTo(x + s * .04, y);
      ctx.lineTo(x + s * .03, y - s * .30); ctx.lineTo(x - s * .03, y - s * .30);
      ctx.closePath();
      fillInk(ctx, C.bark, lw);
      for (i = 0; i < 8; i++) {
        a = -Math.PI * .5 + (i - 3.5) * .34 + sway;
        leaf(ctx, x, y - s * .30, s * .34 + rnd(i) * s * .08, s * .085, a, i % 2 ? '#2f8f4e' : C.leafLight, lw * .75);
      }
    } else {
      ctx.beginPath();
      ctx.moveTo(x - s * .085, y);
      ctx.quadraticCurveTo(x - s * .05, y - s * .34, x - s * .055, y - s * .56);
      ctx.lineTo(x + s * .055, y - s * .56);
      ctx.quadraticCurveTo(x + s * .05, y - s * .34, x + s * .085, y);
      ctx.closePath();
      fillInk(ctx, C.bark, lw);
      ctx.strokeStyle = 'rgba(60,34,12,.35)'; ctx.lineWidth = lw * .7;
      ctx.beginPath(); ctx.moveTo(x - s * .02, y - s * .08); ctx.lineTo(x - s * .015, y - s * .46); ctx.stroke();

      var cy = y - s * .70, cw = s * .34;
      ell(ctx, x - cw * .72 + sway * s * .05, cy + s * .06, cw * .70, cw * .58); fillInk(ctx, C.leafDark, lw);
      ell(ctx, x + cw * .72 + sway * s * .05, cy + s * .05, cw * .68, cw * .56); fillInk(ctx, C.leafDark, lw);
      ell(ctx, x + sway * s * .05, cy - s * .05, cw * .96, cw * .78); fillInk(ctx, C.leaf, lw);
      ctx.fillStyle = 'rgba(255,255,255,.15)';
      ell(ctx, x - cw * .30, cy - s * .12, cw * .42, cw * .20, -.35); ctx.fill();
    }
    ctx.restore();
  };

  /* ================================================================= PANEL */
  A.panel = function (ctx, x, y, w, h, o) {
    o = o || {};
    var r = o.r === undefined ? 22 : o.r;
    var face = o.color || C.cream;
    var border = o.border || C.bark;
    var bw = o.borderWidth || Math.max(6, Math.min(w, h) * .045);
    ctx.save();

    G.roundRect(ctx, x, y, w, h, r);
    ctx.fillStyle = border; ctx.fill();

    G.roundRect(ctx, x + bw, y + bw, Math.max(2, w - bw * 2), Math.max(2, h - bw * 2), Math.max(2, r - bw * .6));
    ctx.fillStyle = face; ctx.fill();

    if (o.grain !== false) {
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = 'rgba(160,120,70,.13)';
      ctx.lineWidth = 2;
      for (var i = 1; i * 26 < h; i++) {
        ctx.beginPath();
        ctx.moveTo(x + bw, y + i * 26);
        ctx.quadraticCurveTo(x + w * .5, y + i * 26 + (i % 2 ? 4 : -4), x + w - bw, y + i * 26);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (o.tint) {
      ctx.save(); ctx.globalAlpha = .18; ctx.fillStyle = o.tint;
      G.roundRect(ctx, x + bw, y + bw, w - bw * 2, h - bw * 2, Math.max(2, r - bw * .6)); ctx.fill();
      ctx.restore();
    }
    // bolts
    if (o.bolts !== false && w > 90 && h > 60) {
      ctx.fillStyle = '#c9a66b';
      [[x + bw * 1.5, y + bw * 1.5], [x + w - bw * 1.5, y + bw * 1.5],
       [x + bw * 1.5, y + h - bw * 1.5], [x + w - bw * 1.5, y + h - bw * 1.5]].forEach(function (p) {
        ell(ctx, p[0], p[1], bw * .34, bw * .34); ctx.fill();
      });
    }
    ctx.restore();
  };

  A.sign = function (ctx, x, y, w, h, title) {
    A.panel(ctx, x, y, w, h, {});
    if (title) {
      G.text(String(title), x + w / 2, y + Math.min(46, h * .26), {
        ctx: ctx, size: Math.min(34, h * .20, w * .13), color: C.ink, maxWidth: w * .84
      });
    }
  };

  /* ================================================================== HATS */
  function hatBerretto(c, x, y, s) {
    var w = s * .58;
    c.beginPath(); c.arc(x, y, w, Math.PI, 0); c.closePath();
    fillInk(c, C.berry, s * .05);
    c.beginPath();
    c.moveTo(x + w * .1, y); c.quadraticCurveTo(x + w * 1.5, y - s * .06, x + w * 1.45, y + s * .09);
    c.quadraticCurveTo(x + w * .9, y + s * .05, x + w * .1, y + s * .04); c.closePath();
    fillInk(c, G.shade(C.berry, -30), s * .05);
    c.fillStyle = C.cream; ell(c, x, y - w * .82, s * .07, s * .07); c.fill();
  }
  function hatCorona(c, x, y, s) {
    var w = s * .52, hh = s * .42;
    c.beginPath();
    c.moveTo(x - w, y + s * .04);
    c.lineTo(x - w, y - hh * .5);
    c.lineTo(x - w * .55, y - hh * .1); c.lineTo(x - w * .18, y - hh);
    c.lineTo(x + w * .18, y - hh * .1); c.lineTo(x + w * .55, y - hh);
    c.lineTo(x + w, y - hh * .4); c.lineTo(x + w, y + s * .04);
    c.closePath();
    fillInk(c, C.sun, s * .05);
    c.fillStyle = C.berry;
    [[-w * .5, -hh * .05], [0, -hh * .18], [w * .5, -hh * .05]].forEach(function (p) {
      ell(c, x + p[0], y + p[1], s * .055, s * .055); c.fill();
    });
  }
  function hatFiore(c, x, y, s) {
    c.strokeStyle = '#2b7a45'; c.lineWidth = s * .06; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x - s * .30, y + s * .04); c.quadraticCurveTo(x - s * .05, y + s * .02, x + s * .22, y - s * .04); c.stroke();
    A.flower(c, x + s * .30, y + s * .22, s * .62, C.pinkPop);
    leaf(c, x - s * .18, y - s * .01, s * .26, s * .09, -.5, C.leafLight, s * .03);
  }
  function hatEsploratore(c, x, y, s) {
    var w = s * .78;
    c.beginPath(); ell(c, x, y + s * .03, w, s * .13); fillInk(c, '#d8c49a', s * .045);
    c.beginPath(); c.arc(x, y + s * .02, s * .46, Math.PI, 0); c.closePath();
    fillInk(c, '#e6d3ac', s * .05);
    c.strokeStyle = '#8f7a4f'; c.lineWidth = s * .05;
    c.beginPath(); c.moveTo(x - s * .46, y - s * .06); c.lineTo(x + s * .46, y - s * .06); c.stroke();
  }
  function hatPirata(c, x, y, s) {
    var w = s * .78;
    c.beginPath();
    c.moveTo(x - w, y + s * .06);
    c.quadraticCurveTo(x - w * .40, y - s * .52, x, y - s * .46);
    c.quadraticCurveTo(x + w * .40, y - s * .52, x + w, y + s * .06);
    c.quadraticCurveTo(x, y + s * .22, x - w, y + s * .06);
    c.closePath();
    fillInk(c, '#2f2a34', s * .05);
    c.fillStyle = C.cream;
    ell(c, x, y - s * .16, s * .11, s * .12); c.fill();
    c.fillStyle = '#2f2a34';
    ell(c, x - s * .045, y - s * .18, s * .028, s * .034); c.fill();
    ell(c, x + s * .045, y - s * .18, s * .028, s * .034); c.fill();
    c.strokeStyle = C.cream; c.lineWidth = s * .035;
    c.beginPath(); c.moveTo(x - s * .09, y - s * .05); c.lineTo(x + s * .09, y - s * .05); c.stroke();
  }
  function hatCilindro(c, x, y, s) {
    c.beginPath(); ell(c, x, y + s * .03, s * .68, s * .12); fillInk(c, '#33313a', s * .045);
    c.beginPath();
    G.roundRect(c, x - s * .34, y - s * .62, s * .68, s * .66, s * .06);
    fillInk(c, '#3d3a45', s * .05);
    c.fillStyle = C.berry;
    c.fillRect(x - s * .34, y - s * .16, s * .68, s * .12);
  }
  function hatMago(c, x, y, s) {
    c.beginPath(); ell(c, x, y + s * .03, s * .66, s * .12); fillInk(c, '#5b3fa6', s * .045);
    c.beginPath();
    c.moveTo(x - s * .40, y + s * .01);
    c.quadraticCurveTo(x - s * .20, y - s * .62, x + s * .10, y - s * .92);
    c.quadraticCurveTo(x + s * .16, y - s * .48, x + s * .40, y + s * .01);
    c.closePath();
    fillInk(c, C.plum, s * .05);
    c.fillStyle = C.sun;
    [[-.10, -.20, .055], [.02, -.44, .042], [-.16, -.02, .034]].forEach(function (p) {
      G.starPath(c, x + s * p[0], y + s * p[1], s * p[2]); c.fill();
    });
  }
  function hatCuffia(c, x, y, s) {
    c.beginPath(); c.arc(x, y + s * .05, s * .56, Math.PI, 0); c.closePath();
    fillInk(c, C.water, s * .05);
    c.strokeStyle = C.cream; c.lineWidth = s * .05; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x - s * .40, y - s * .18); c.quadraticCurveTo(x, y - s * .36, x + s * .40, y - s * .18); c.stroke();
    c.beginPath(); c.moveTo(x - s * .26, y - s * .40); c.quadraticCurveTo(x, y - s * .50, x + s * .26, y - s * .40); c.stroke();
  }

  var PAINT = {
    berretto: hatBerretto, corona: hatCorona, fiore: hatFiore, esploratore: hatEsploratore,
    pirata: hatPirata, cilindro: hatCilindro, mago: hatMago, cuffia: hatCuffia
  };

  A.hat = function (ctx, x, y, s, id) {
    if (!id) return;
    var f = PAINT[id];
    if (!f) return;
    s = s > 0 ? s : 60;
    ctx.save();
    f(ctx, x, y, s);
    ctx.restore();
  };

  A.HATS = [
    { id: 'berretto', name: 'Berretto', price: 3 },
    { id: 'corona', name: 'Corona', price: 5 },
    { id: 'fiore', name: 'Fiore', price: 8 },
    { id: 'esploratore', name: 'Esploratore', price: 11 },
    { id: 'cuffia', name: 'Cuffia', price: 14 },
    { id: 'pirata', name: 'Pirata', price: 18 },
    { id: 'cilindro', name: 'Cilindro', price: 22 },
    { id: 'mago', name: 'Mago', price: 26 }
  ].map(function (h) {
    h.draw = function (ctx, x, y, s) { A.hat(ctx, x, y, s, h.id); };
    return h;
  });

  A._world_ok = true;
})();
