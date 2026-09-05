/* Dino Giungla — the little bus and its road (namespace `A`, extends 01-art.js).

   SIDE VIEW, and that is the whole reason this scene is cheap: A.dino is drawn
   in profile and anchored at the feet, with facing 1 or -1. A side-scrolling bus
   is the one camera where a driving dino costs nothing — the opposite of the
   top-down ring, where turning him through 360 degrees would have meant drawing
   him from eight angles.

   ANCHORING: like everything on the ground, (x, y) is the POINT OF CONTACT WITH
   THE ROAD, never the centre.

   No canvas shadowBlur, no Math.random, warm brown ink. Same house rules as
   01d-art-casa.js. */
(function () {
  'use strict';

  var G = window.G || {};
  var C = G.C || {};
  var A = window.A || (window.A = {});
  var INK = C.ink || '#2b1d12';
  var TAU = 6.2831853;

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

  /* ------------------------------------------------------------ the parts */
  A.BUS_BODY = ['#ffd75e', '#ff6fae', '#4d80e4', '#38d9a9', '#ff9f43', '#8f5bd6'];
  A.BUS_WHEEL = ['legno', 'grandi', 'fiori'];
  A.BUS_ROOF = ['niente', 'tettuccio', 'portapacchi'];

  function wheel(c, x, y, r, kind, spin) {
    c.save();
    c.translate(x, y); c.rotate(spin);
    var big = kind === 'grandi';
    var rr = big ? r * 1.22 : r;
    _ell(c, 0, 0, rr, rr, 0);
    _shape(c, kind === 'legno' ? (C.bark || '#7a4a26') : '#3a3038', _lw(rr * 2));
    _ell(c, 0, 0, rr * 0.42, rr * 0.42, 0);
    _shape(c, C.cream || '#fff6e0', _lw(rr));
    if (kind === 'fiori') {
      c.fillStyle = C.pinkPop || '#ff6fae';
      for (var i = 0; i < 5; i++) {
        var a = i * TAU / 5;
        c.beginPath(); c.arc(Math.cos(a) * rr * 0.66, Math.sin(a) * rr * 0.66, rr * 0.18, 0, TAU); c.fill();
      }
    } else {
      c.strokeStyle = _shade(C.bark || '#7a4a26', -40);
      c.lineWidth = Math.max(2, rr * 0.10);
      for (var j = 0; j < 4; j++) {
        var b = j * TAU / 4;
        c.beginPath();
        c.moveTo(Math.cos(b) * rr * 0.34, Math.sin(b) * rr * 0.34);
        c.lineTo(Math.cos(b) * rr * 0.86, Math.sin(b) * rr * 0.86);
        c.stroke();
      }
    }
    c.restore();
  }

  /* The bus itself. (x, y) sits on the road. `o` = {
       body, wheels, roof   — indices into the tables above
       spin                 — wheel rotation in radians
       dirt                 — 0..1, how muddy it is
       tilt                 — small body lean while accelerating
       riders               — [{color}] shown through the windows
     }  The driver is NOT drawn here: the scene draws A.dino in the cab, so it
     picks up the child's own colour and whatever he is wearing. */
  A.bus = function (c, x, y, s, o) {
    o = o || {};
    var col = A.BUS_BODY[(o.body | 0) % A.BUS_BODY.length];
    var wk = A.BUS_WHEEL[(o.wheels | 0) % A.BUS_WHEEL.length];
    var rk = A.BUS_ROOF[(o.roof | 0) % A.BUS_ROOF.length];
    var lw = _lw(s);
    var w = s, h = s * 0.62, r = s * 0.13;
    var top = y - h - r * 0.6;

    c.save();
    c.globalAlpha = 0.22; c.fillStyle = '#28190a';
    _ell(c, x, y + 4, w * 0.52, s * 0.055, 0); c.fill();
    c.restore();

    if (o.tilt) { c.save(); c.translate(x, y); c.rotate(o.tilt); c.translate(-x, -y); }

    if (rk === 'tettuccio') {
      c.beginPath();
      G.roundRect(c, x - w * 0.52, top - s * 0.10, w * 1.04, s * 0.12, s * 0.05);
      _shape(c, _shade(col, -34), lw);
    } else if (rk === 'portapacchi') {
      c.strokeStyle = C.bark || '#7a4a26'; c.lineWidth = lw * 1.6; c.lineCap = 'round';
      c.beginPath();
      c.moveTo(x - w * 0.44, top - s * 0.08); c.lineTo(x + w * 0.44, top - s * 0.08);
      c.moveTo(x - w * 0.34, top - s * 0.08); c.lineTo(x - w * 0.34, top);
      c.moveTo(x + w * 0.34, top - s * 0.08); c.lineTo(x + w * 0.34, top);
      c.stroke();
      if (A.fruit) A.fruit(c, x, top - s * 0.16, s * 0.07, 'melone');
    }

    c.beginPath();                                   // body
    G.roundRect(c, x - w * 0.5, top, w, h, r);
    _shape(c, col, lw);

    c.beginPath();                                   // bonnet, a snub nose
    G.roundRect(c, x + w * 0.34, top + h * 0.34, w * 0.22, h * 0.62, r * 0.6);
    _shape(c, _shade(col, -14), lw);

    var i, wx, ww = w * 0.17, wh = h * 0.40, wy = top + h * 0.16;
    for (i = 0; i < 3; i++) {                        // windows
      wx = x - w * 0.42 + i * (ww + w * 0.045);
      c.beginPath();
      G.roundRect(c, wx, wy, ww, wh, r * 0.4);
      _shape(c, '#cfe6f5', lw * 0.7);
      var passenger = i===2 && o.driverColor ? {color:o.driverColor} : o.riders && o.riders[i];
      if (passenger) {                 // a passenger looking out
        c.save();
        G.roundRect(c, wx, wy, ww, wh, r * 0.4); c.clip();
        c.fillStyle = passenger.color || C.dino;
        c.beginPath(); c.arc(wx + ww * 0.5, wy + wh * 0.78, ww * 0.42, 0, TAU); c.fill();
        c.fillStyle = INK;
        c.beginPath(); c.arc(wx + ww * 0.34, wy + wh * 0.62, ww * 0.07, 0, TAU); c.fill();
        c.beginPath(); c.arc(wx + ww * 0.66, wy + wh * 0.62, ww * 0.07, 0, TAU); c.fill();
        c.restore();
      }
      _gloss(c, wx + ww * 0.26, wy + wh * 0.24, ww * 0.2, wh * 0.14, -0.5, 0.5);
    }

    c.beginPath();                                   // door, open when stopped
    var dw = w * 0.16, dx = x + w * 0.10;
    G.roundRect(c, dx, wy, dw, h * 0.74, r * 0.4);
    _shape(c, o.doorOpen ? '#9fd8ef' : _shade(col, 22), lw * 0.7);
    c.strokeStyle = INK; c.lineWidth = lw * 0.6;
    c.beginPath(); c.moveTo(dx + dw * 0.5, wy); c.lineTo(dx + dw * 0.5, wy + h * 0.74); c.stroke();

    c.fillStyle = C.sun || '#ffd75e';                // headlamp
    c.beginPath(); c.arc(x + w * 0.53, top + h * 0.60, s * 0.045, 0, TAU); c.fill();
    c.strokeStyle = INK; c.lineWidth = lw * 0.6; c.stroke();

    if (o.dirt > 0.02) {                             // mud
      c.save();
      c.globalAlpha = Math.min(0.55, o.dirt * 0.55);
      c.fillStyle = '#6b4a26';
      for (i = 0; i < 9; i++) {
        c.beginPath();
        c.arc(x - w * 0.44 + _rnd(i * 5 + 1) * w * 0.9,
          top + h * 0.30 + _rnd(i * 5 + 2) * h * 0.62,
          s * (0.02 + _rnd(i * 5 + 3) * 0.035), 0, TAU);
        c.fill();
      }
      c.restore();
    }

    wheel(c, x - w * 0.30, y - s * 0.10, s * 0.13, wk, o.spin || 0);
    wheel(c, x + w * 0.30, y - s * 0.10, s * 0.13, wk, o.spin || 0);

    if (o.tilt) c.restore();
  };

  /* A bus stop: post, sign, and the symbol of the place it serves. */
  A.busStop = function (c, x, y, s, o) {
    o = o || {};
    var lw = _lw(s);
    c.save();
    c.globalAlpha = 0.2; c.fillStyle = '#28190a';
    _ell(c, x, y, s * 0.24, s * 0.06, 0); c.fill();
    c.restore();
    c.strokeStyle = C.barkDark || '#4e2f18'; c.lineWidth = lw * 2.4; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - s * 0.86); c.stroke();
    c.beginPath();
    G.roundRect(c, x - s * 0.30, y - s * 1.30, s * 0.60, s * 0.50, s * 0.08);
    _shape(c, o.here ? (C.leafLight || '#63c777') : (C.cream || '#fff6e0'), lw);
    if (o.icon) o.icon(c, x, y - s * 1.05, s * 0.17);
  };

  /* The fruit pump: a tank you fill by holding. */
  A.pump = function (c, x, y, s, o) {
    o = o || {};
    var lw = _lw(s), w = s * 0.44, h = s * 0.82;
    c.beginPath();
    G.roundRect(c, x - w / 2, y - h, w, h, s * 0.07);
    _shape(c, C.berry || '#e8536b', lw);
    c.beginPath();
    G.roundRect(c, x - w * 0.32, y - h * 0.88, w * 0.64, h * 0.34, s * 0.04);
    _shape(c, '#cfe6f5', lw * 0.7);
    c.save();                                        // the level inside
    G.roundRect(c, x - w * 0.32, y - h * 0.88, w * 0.64, h * 0.34, s * 0.04); c.clip();
    var k = G.clamp(o.level === undefined ? 1 : o.level, 0, 1);
    c.fillStyle = C.sun || '#ffd75e';
    c.fillRect(x - w * 0.32, y - h * 0.88 + h * 0.34 * (1 - k), w * 0.64, h * 0.34 * k);
    c.restore();
    c.strokeStyle = C.barkDark || '#4e2f18'; c.lineWidth = lw * 1.4; c.lineCap = 'round';
    c.beginPath();
    c.moveTo(x + w * 0.4, y - h * 0.52);
    c.quadraticCurveTo(x + w * 0.9, y - h * 0.40, x + w * 0.82, y - h * 0.12);
    c.stroke();
    if (A.fruit) A.fruit(c, x, y - h * 1.12, s * 0.10, 'fragola');
  };

  /* The wash: an arch with brushes that spin when it is working. */
  A.wash = function (c, x, y, s, o) {
    o = o || {};
    var lw = _lw(s), w = s * 1.10, h = s * 0.96;
    c.strokeStyle = C.blueberry || '#4d80e4'; c.lineWidth = lw * 2.6; c.lineCap = 'round';
    c.beginPath();
    c.moveTo(x - w / 2, y); c.lineTo(x - w / 2, y - h);
    c.lineTo(x + w / 2, y - h); c.lineTo(x + w / 2, y);
    c.stroke();
    var i, on = o.on ? 1 : 0, sp = (G.t || 0) * (on ? 9 : 1.2);
    for (i = 0; i < 4; i++) {
      var bx = x - w * 0.34 + i * w * 0.226;
      c.save();
      c.translate(bx, y - h * 0.52); c.rotate(sp + i);
      c.fillStyle = i % 2 ? (C.mint || '#38d9a9') : (C.cream || '#fff6e0');
      for (var j = 0; j < 6; j++) {
        c.save(); c.rotate(j * TAU / 6);
        c.fillRect(-s * 0.02, 0, s * 0.04, s * 0.20);
        c.restore();
      }
      c.restore();
    }
    if (on) {
      c.save(); c.globalAlpha = 0.5; c.fillStyle = '#bfe6f7';
      for (i = 0; i < 12; i++) {
        c.beginPath();
        c.arc(x - w * 0.4 + _rnd(i * 3) * w * 0.8,
          y - h * 0.9 + ((G.t * 220 + i * 60) % (h * 0.9)),
          s * 0.03, 0, TAU);
        c.fill();
      }
      c.restore();
    }
  };

  /* A level-crossing style gate: one tap opens it. */
  A.gate = function (c, x, y, s, o) {
    o = o || {};
    var lw = _lw(s), k = G.clamp(o.open === undefined ? 0 : o.open, 0, 1);
    c.strokeStyle = C.barkDark || '#4e2f18'; c.lineWidth = lw * 2.2; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - s * 0.62); c.stroke();
    c.save();
    c.translate(x, y - s * 0.62);
    c.rotate(-k * Math.PI * 0.44);
    c.fillStyle = C.berry || '#e8536b';
    G.roundRect(c, 0, -s * 0.05, s * 0.92, s * 0.10, s * 0.04); c.fill();
    c.fillStyle = C.cream || '#fff6e0';
    for (var i = 0; i < 3; i++) c.fillRect(s * (0.14 + i * 0.26), -s * 0.05, s * 0.13, s * 0.10);
    c.strokeStyle = INK; c.lineWidth = lw * 0.7;
    G.roundRect(c, 0, -s * 0.05, s * 0.92, s * 0.10, s * 0.04); c.stroke();
    c.restore();
  };

  A._bus_ok = true;
})();
