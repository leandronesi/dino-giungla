/* Dino Giungla — wearable gear (namespace `A`, extends 01-art.js).
   Four slots: `testa` (the eight hats of 01b-art-world.js), `occhi`, `collo`,
   `coda`. The catalogue below is the single list the wardrobe reads.

   Every entry carries a REACTION — {pose, say} — and that is the whole point of
   the wardrobe: put the nightcap on and the dino really falls asleep, put the
   wizard hat on and he really starts thinking. The five poses already exist in
   A.dino, so the strongest reward in the game costs no drawing at all.

   HARD RULE for painters: never draw a letter, a digit or a logo. Everything
   here is rendered inside A.dino's ctx.scale(face, 1), so it mirrors when the
   dino walks left. Symmetric shapes survive that; glyphs would come out
   backwards. See the sleeping z's in 01-art.js, drawn outside the transform.

   Ink is the dino's warm brown, not the world's green-black: these pieces sit
   ON the animal, and 01b's darker outline reads as a hole at small sizes. */
(function () {
  'use strict';

  var G = window.G || {};
  var C = G.C || {};
  var A = window.A || (window.A = {});
  var INK = C.ink || '#2b1d12';
  var TAU = 6.2831853;

  /* 01-art.js keeps its primitives private inside its own IIFE, so these are
     deliberate local copies — the alternative is publishing internals on A. */
  function _shade(col, amt) { return G.shade ? G.shade(col, amt) : col; }
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

  /* ============================================================ EYES (occhi) */
  /* (x,y) = midpoint between the pupils, s = eye spacing. The head is drawn in
     three quarters, so the far lens is smaller and sits a touch higher.
     Lenses are ALWAYS translucent: in the 'happy' pose A.dino fills the eyes
     with a solid star, and an opaque lens would erase the face at the exact
     moment of celebration. */
  function lensAlpha(o) { return (o && o.eyes === 'star') ? 0.38 : 0.55; }

  function frame(c, x, y, s, o, tint) {
    var r1 = s * 0.41, r2 = s * 0.44, lw = s * 0.11;
    c.strokeStyle = tint; c.lineWidth = lw; c.lineCap = 'round';
    c.beginPath();                                    // bridge
    c.moveTo(x - s * 0.10, y - s * 0.06);
    c.quadraticCurveTo(x, y - s * 0.16, x + s * 0.12, y - s * 0.04);
    c.stroke();
    c.beginPath();                                    // temple arm, near side only
    c.moveTo(x + s * 0.62, y - s * 0.02);
    c.lineTo(x + s * 0.86, y - s * 0.16);
    c.stroke();
    return { r1: r1, r2: r2, lw: lw };
  }

  function gOcchialini(c, x, y, s, o) {
    var tint = _shade(C.blueberry || '#4d80e4', -30);
    var f = frame(c, x, y, s, o, tint);
    c.save();
    c.globalAlpha = lensAlpha(o);
    _ell(c, x - s * 0.50, y - s * 0.03, f.r1, f.r1 * 0.78, 0);
    c.fillStyle = '#cfe6f5'; c.fill();
    _ell(c, x + s * 0.50, y + s * 0.01, f.r2, f.r2 * 0.94, 0);
    c.fillStyle = '#cfe6f5'; c.fill();
    c.restore();
    c.strokeStyle = tint; c.lineWidth = f.lw;
    _ell(c, x - s * 0.50, y - s * 0.03, f.r1, f.r1 * 0.78, 0); c.stroke();
    _ell(c, x + s * 0.50, y + s * 0.01, f.r2, f.r2 * 0.94, 0); c.stroke();
    _gloss(c, x + s * 0.40, y - s * 0.14, s * 0.15, s * 0.07, -0.6, 0.55);
  }

  function gSole(c, x, y, s, o) {
    var tint = '#2f2a34';
    var f = frame(c, x, y, s, o, tint);
    c.save();
    c.globalAlpha = lensAlpha(o) + 0.28;
    _ell(c, x - s * 0.50, y - s * 0.03, f.r1, f.r1 * 0.78, 0);
    c.fillStyle = '#3a3550'; c.fill();
    _ell(c, x + s * 0.50, y + s * 0.01, f.r2, f.r2 * 0.94, 0);
    c.fillStyle = '#3a3550'; c.fill();
    c.restore();
    c.strokeStyle = tint; c.lineWidth = f.lw;
    _ell(c, x - s * 0.50, y - s * 0.03, f.r1, f.r1 * 0.78, 0); c.stroke();
    _ell(c, x + s * 0.50, y + s * 0.01, f.r2, f.r2 * 0.94, 0); c.stroke();
    c.save();                                          // diagonal flash
    c.globalAlpha = 0.5; c.strokeStyle = '#ffffff'; c.lineWidth = s * 0.10;
    c.beginPath();
    c.moveTo(x + s * 0.34, y + s * 0.20); c.lineTo(x + s * 0.62, y - s * 0.20);
    c.stroke();
    c.restore();
  }

  /* =========================================================== NECK (collo) */
  /* (x,y) = the hollow of the throat, s = full width. Front pieces only: a
     scarf that wraps round the neck would need two z-positions on a silhouette
     that is ONE fused path (01-art.js), and costs more than this whole file. */
  function gPapillon(c, x, y, s, o) {
    var col = C.berry || '#e8536b', lw = s * 0.09;
    var w = s * 0.50, h = s * 0.30;
    c.beginPath();
    c.moveTo(x, y);
    c.quadraticCurveTo(x - w, y - h, x - w * 0.92, y);
    c.quadraticCurveTo(x - w, y + h, x, y);
    c.quadraticCurveTo(x + w, y - h, x + w * 0.92, y);
    c.quadraticCurveTo(x + w, y + h, x, y);
    c.closePath();
    _shape(c, col, lw);
    _ell(c, x, y, s * 0.13, s * 0.15, 0);
    _shape(c, _shade(col, -26), lw * 0.9);
  }

  function gMedaglia(c, x, y, s, o) {
    var lw = s * 0.085, r = s * 0.26;
    c.beginPath();                                     // ribbon, a shallow V
    c.moveTo(x - s * 0.30, y - s * 0.22);
    c.lineTo(x, y + s * 0.16);
    c.lineTo(x + s * 0.30, y - s * 0.22);
    c.lineTo(x + s * 0.16, y - s * 0.26);
    c.lineTo(x, y - s * 0.02);
    c.lineTo(x - s * 0.16, y - s * 0.26);
    c.closePath();
    _shape(c, C.blueberry || '#4d80e4', lw);
    _ell(c, x, y + s * 0.30, r, r, 0);
    _shape(c, C.sun || '#ffd75e', lw);
    if (G.starPath) {
      c.fillStyle = _shade(C.sun || '#ffd75e', -46);
      G.starPath(c, x, y + s * 0.30, r * 0.56); c.fill();
    }
    _gloss(c, x - r * 0.34, y + s * 0.30 - r * 0.36, r * 0.30, r * 0.16, -0.7, 0.42);
  }

  /* =========================================================== TAIL (coda) */
  /* Drawn in a space the caller has already translated to the point on the tail
     and rotated onto its tangent, so both pieces ride the tail wag for free.
     s = the tail's thickness there. */
  function gFiocco(c, x, y, s, o) {
    var col = C.pinkPop || '#ff6fae', lw = s * 0.16;
    var w = s * 0.86, h = s * 0.56;
    c.beginPath();
    c.moveTo(x, y);
    c.quadraticCurveTo(x - w * 0.5, y - h, x - w, y - h * 0.22);
    c.quadraticCurveTo(x - w * 0.7, y + h * 0.5, x, y);
    c.quadraticCurveTo(x + w * 0.5, y - h, x + w, y - h * 0.22);
    c.quadraticCurveTo(x + w * 0.7, y + h * 0.5, x, y);
    c.closePath();
    _shape(c, col, lw);
    _ell(c, x, y, s * 0.22, s * 0.24, 0);
    _shape(c, _shade(col, -28), lw * 0.85);
  }

  function gAnellino(c, x, y, s, o) {
    var col = C.mint || '#38d9a9', lw = s * 0.15;
    _ell(c, x, y, s * 0.78, s * 0.92, 0);
    _shape(c, col, lw);
    c.save();                                          // inner shadow gives it volume
    c.globalAlpha = 0.30;
    _ell(c, x, y, s * 0.50, s * 0.62, 0);
    c.fillStyle = INK; c.fill();
    c.restore();
    _gloss(c, x - s * 0.34, y - s * 0.40, s * 0.20, s * 0.12, -0.5, 0.5);
  }

  var PAINT = {
    occhialini: gOcchialini, sole: gSole,
    papillon: gPapillon, medaglia: gMedaglia,
    fiocco: gFiocco, anellino: gAnellino
  };

  /* Draw one non-hat piece. Hats keep going through A.hat: they have their own
     anchor and their own scale, and their art is not touched by this file. */
  A.gear = function (ctx, id, x, y, s, o) {
    var f = id && PAINT[id];
    if (!f) return;
    ctx.save();
    f(ctx, x, y, s > 0 ? s : 40, o || {});
    ctx.restore();
  };

  /* ============================================================== CATALOGUE */
  /* `pose` and `say` are the reaction. Order here is the order of the shelves;
     the order pieces are GIVEN is CRATE_ORDER in 23-guardaroba.js, which is
     sorted by how strong the reaction is, not by slot. */
  var HAT_REACT = {
    berretto: { pose: 'walk', say: 'Andiamo!' },
    corona: { pose: 'happy', say: 'Sono il re della giungla!' },
    fiore: { pose: 'idle', say: 'Che profumo!' },
    esploratore: { pose: 'walk', say: 'In marcia!' },
    cuffia: { pose: 'sleep', say: 'Buonanotte...' },
    pirata: { pose: 'happy', say: 'Arrembaggio!' },
    cilindro: { pose: 'idle', say: 'Che eleganza!' },
    mago: { pose: 'think', say: 'Abracadabra!' }
  };

  A.GEAR = [];
  (A.HATS || []).forEach(function (h) {
    var r = HAT_REACT[h.id] || { pose: 'happy', say: 'Bello!' };
    A.GEAR.push({
      id: h.id, slot: 'testa', name: h.name, pose: r.pose, say: r.say,
      draw: function (c, x, y, s) { A.hat(c, x, y, s * 0.86, h.id); }
    });
  });

  [
    { id: 'occhialini', slot: 'occhi', name: 'Occhialini', pose: 'think', say: 'Ora vedo tutto!' },
    { id: 'sole', slot: 'occhi', name: 'Occhiali da sole', pose: 'happy', say: 'Che stile!' },
    { id: 'papillon', slot: 'collo', name: 'Papillon', pose: 'idle', say: 'Elegantissimo!' },
    { id: 'medaglia', slot: 'collo', name: 'Medaglia', pose: 'happy', say: 'Ho vinto!' },
    { id: 'fiocco', slot: 'coda', name: 'Fiocco', pose: 'happy', say: 'Guarda la mia coda!' },
    { id: 'anellino', slot: 'coda', name: 'Anellino', pose: 'walk', say: 'Tintinnaaa!' }
  ].forEach(function (g) {
    var sc = g.slot === 'occhi' ? 0.62 : g.slot === 'collo' ? 0.70 : 0.52;
    g.draw = function (c, x, y, s) { A.gear(c, g.id, x, y, s * sc, {}); };
    A.GEAR.push(g);
  });

  var BY_ID = {};
  A.GEAR.forEach(function (g) { BY_ID[g.id] = g; });
  A.gearOf = function (id) { return (id && BY_ID[id]) || null; };
  A.SLOTS = ['testa', 'occhi', 'collo', 'coda'];

  /* ================================================================== LOOK */
  /* What a given save is WEARING. `testa` stays in save.hat so the eight hats
     and every old save keep working untouched; the three new slots live in
     save.guardaroba.gear.

     PASS YOUR OWN `out` BUFFER whenever you draw more than one dino in a frame.
     Three surfaces do: the "Chi gioca?" cards, the level-2 portraits, and the
     brother's window. Without a private buffer they would all end up wearing
     the look of whoever was resolved last — and to a three-year-old that is not
     a glitch, that is his brother stealing his hat. */
  var shared = { testa: null, occhi: null, collo: null, coda: null };

  G.look = function (save, out) {
    var s = save || G.save || {};
    var gr = s.guardaroba;
    var g = (gr && typeof gr.gear === 'object' && gr.gear) || null;
    var o = out || shared;
    o.testa = typeof s.hat === 'string' ? s.hat : null;
    o.occhi = (g && typeof g.occhi === 'string') ? g.occhi : null;
    o.collo = (g && typeof g.collo === 'string') ? g.collo : null;
    o.coda = (g && typeof g.coda === 'string') ? g.coda : null;
    return o;
  };

  A._gear_ok = true;
})();
