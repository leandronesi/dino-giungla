/* Dino Giungla — "La Radura delle Lettere" (scene: lettere).
   Children compose the names of familiar jungle objects. The game introduces
   listening, mixed letters and a slowly revealed model, with no losing state. */
(function () {
  'use strict';

  var G = window.G;
  if (!G || !G.scene) return;
  var C = G.C, W = G.W, H = G.H, A = window.A;
  var WORDS = [
    { word: 'DINO', name: 'il dinosauro', kind: 'dino', color: C.dino },
    { word: 'CASA', name: 'la casa', kind: 'casa', color: C.berry },
    { word: 'BUS', name: 'il pulmino', kind: 'bus', color: C.sun },
    { word: 'MELA', name: 'la mela', kind: 'mela', color: C.berry },
    { word: 'PALLA', name: 'la palla', kind: 'palla', color: C.blueberry },
    { word: 'SOLE', name: 'il sole', kind: 'sole', color: C.sun },
    { word: 'FIORE', name: 'il fiore', kind: 'fiore', color: C.pinkPop }
  ];
  var S = {
    phase: 'play', round: 0, word: null, mode: 0, slots: [], tray: [],
    next: 0, active: -1, flash: 0, idle: 0, reveal: 0, song: 0
  };
  var MODE_NAMES = ['Ascolta e componi', 'Riordina le lettere', 'Copia la parola'];

  function big() { return G.level === 2; }
  function branch() {
    if (!G.save.lettere || typeof G.save.lettere !== 'object' || Array.isArray(G.save.lettere)) G.save.lettere = {};
    var b = G.save.lettere;
    b.done ??= 0; b.best ??= 0;
    if (typeof b.done !== 'number' || !isFinite(b.done) || b.done < 0) b.done = 0;
    if (typeof b.best !== 'number' || !isFinite(b.best) || b.best < 0) b.best = 0;
    b.done = Math.floor(b.done); b.best = Math.floor(b.best);
    return b;
  }
  function wordForRound() {
    var max = big() ? WORDS.length : 5;
    return WORDS[S.round % max];
  }
  function modeForRound() {
    // The three modes are a gentle spiral: every child sees all of them.
    return S.round % 3;
  }
  function shuffleLetters(word) {
    var arr = word.split(''), i, j, t;
    for (i = arr.length - 1; i > 0; i--) {
      j = G.rndi(0, i + 1); t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    // A visibly mixed word is more useful than an accidental identity order.
    if (arr.join('') === word && arr.length > 1) { t = arr[0]; arr[0] = arr[1]; arr[1] = t; }
    return arr;
  }
  function startRound() {
    var w = wordForRound(), i, extras = big() ? ['R', 'T'] : [];
    S.word = w; S.mode = modeForRound(); S.slots = [];
    for (i = 0; i < w.word.length; i++) S.slots.push('');
    S.tray = shuffleLetters(w.word);
    for (i = 0; i < extras.length; i++) S.tray.push(extras[i]);
    S.next = 0; S.phase = 'play'; S.active = -1; S.flash = 0; S.idle = 0;
    S.reveal = S.mode === 2 ? 1 : 0; S.song = 0;
    G.say('Ascolta: ' + w.name + '.');
  }
  function reset() { S.round = 0; S.word = null; S.phase = 'play'; S.idle = 0; startRound(); }
  function expected() { return S.word ? S.word.word[S.next] : ''; }
  function complete() {
    var b = branch();
    b.done++; b.best = Math.max(b.best, S.word.word.length); G.saveNow();
    G.addFruits(big() ? 7 : 5, 640, 350); G.addStars(1, 640, 300);
    G.fx.burst(640, 330, { color: S.word.color, count: 12, speed: 170, size: 7, life: .65, gravity: 160 });
    G.sfx('win'); G.say(G.pick(['Bravissimo!', 'Parola fatta!', 'Che bella parola!']));
    S.phase = 'done'; S.song = 0;
  }
  function chooseLetter(i) {
    var slot = typeof i === 'number' ? i : S.tray.indexOf(i);
    var letter = S.tray[slot];
    if (S.phase !== 'play' || !S.word || !letter) return;
    S.idle = 0;
    if (letter !== expected()) {
      S.flash = .7; G.sfx('pop');
      G.say(G.pick(['Quasi!', 'Guarda la prossima lettera!', 'Riprova con calma!']));
      return;
    }
    S.active = slot; S.slots[S.next] = letter; S.tray[slot] = '';
    S.next++; G.sfx('tap');
    if (S.next >= S.word.word.length) complete();
  }
  function help() {
    if (S.phase !== 'play' || !S.word) return;
    S.reveal = Math.min(S.word.word.length, S.reveal + 1);
    G.sfx('chime');
    G.say(S.mode === 0 ? 'Ascolta il nome: ' + S.word.name + '.' : 'La parola comincia con ' + S.word.word[0] + '.');
  }
  function listen() {
    if (!S.word) return;
    G.sfx('whoosh'); G.say('Ascolta: ' + S.word.name + '.');
  }
  // Small public seam used by headless smoke and useful for accessibility.
  G.lettersState = function () {
    return { phase: S.phase, expected: expected(), round: S.round, mode: S.mode, word: S.word && S.word.word, reveal: S.reveal, tray: S.tray.slice() };
  };
  G.lettersChoose = chooseLetter;
  G.lettersHelp = help;

  function drawObject(c, w, x, y, s) {
    var col = w.color;
    c.save(); c.lineWidth = 6; c.strokeStyle = C.ink;
    if (w.kind === 'dino' && A && A.dino) A.dino(c, x, y + s * .48, s, { facing: 1, pose: S.phase === 'done' ? 'happy' : 'idle', t: G.t, color: col, hat: null, gear: (G.look ? G.look(G.save, {}) : null) });
    else if (w.kind === 'casa') { c.fillStyle = C.cream; G.roundRect(c, x - s * .40, y - s * .10, s * .80, s * .60, 14); c.fill(); c.stroke(); c.fillStyle = C.berry; c.beginPath(); c.moveTo(x - s * .52, y - s * .08); c.lineTo(x, y - s * .48); c.lineTo(x + s * .52, y - s * .08); c.closePath(); c.fill(); c.stroke(); c.fillStyle = C.bark; G.roundRect(c, x - s * .10, y + s * .20, s * .20, s * .30, 5); c.fill(); }
    else if (w.kind === 'bus') { c.fillStyle = C.sun; G.roundRect(c, x - s * .54, y - s * .18, s * 1.08, s * .48, 16); c.fill(); c.stroke(); c.fillStyle = C.sky; c.fillRect(x - s * .38, y - s * .10, s * .25, s * .18); c.fillRect(x - s * .06, y - s * .10, s * .25, s * .18); c.fillStyle = C.barkDark; c.beginPath(); c.arc(x - s * .30, y + s * .34, s * .12, 0, 7); c.fill(); c.beginPath(); c.arc(x + s * .30, y + s * .34, s * .12, 0, 7); c.fill(); }
    else if (w.kind === 'mela') { c.fillStyle = C.berry; c.beginPath(); c.arc(x, y + s * .08, s * .30, 0, 7); c.fill(); c.stroke(); c.strokeStyle = C.bark; c.lineWidth = 9; c.beginPath(); c.moveTo(x, y - s * .20); c.lineTo(x + s * .05, y - s * .40); c.stroke(); c.fillStyle = C.leafLight; c.beginPath(); c.ellipse(x + s * .15, y - s * .32, s * .15, s * .07, -.3, 0, 7); c.fill(); }
    else if (w.kind === 'palla') { c.fillStyle = C.blueberry; c.beginPath(); c.arc(x, y, s * .34, 0, 7); c.fill(); c.stroke(); c.strokeStyle = C.cream; c.lineWidth = 8; c.beginPath(); c.arc(x, y, s * .22, -.8, 2.2); c.stroke(); }
    else if (w.kind === 'sole') { c.fillStyle = C.sun; c.beginPath(); c.arc(x, y, s * .27, 0, 7); c.fill(); c.stroke(); for (var a = 0; a < 8; a++) { var q = a * Math.PI / 4; c.beginPath(); c.moveTo(x + Math.cos(q) * s * .36, y + Math.sin(q) * s * .36); c.lineTo(x + Math.cos(q) * s * .50, y + Math.sin(q) * s * .50); c.stroke(); } }
    else { c.fillStyle = C.pinkPop; for (var p = 0; p < 6; p++) { var z = p * Math.PI / 3; c.beginPath(); c.arc(x + Math.cos(z) * s * .18, y + Math.sin(z) * s * .18, s * .18, 0, 7); c.fill(); c.stroke(); } c.fillStyle = C.sun; c.beginPath(); c.arc(x, y, s * .15, 0, 7); c.fill(); c.stroke(); }
    c.restore();
  }
  function drawSlot(c, i, x, y, size) {
    var val = S.slots[i], revealed = S.mode === 2 && i < S.reveal;
    c.save(); c.fillStyle = val ? C.leafLight : (revealed ? 'rgba(255,215,94,.88)' : 'rgba(255,246,224,.88)');
    G.roundRect(c, x, y, size, 96, 18); c.fill(); c.strokeStyle = C.bark; c.lineWidth = 4; c.stroke();
    if (val || revealed) G.text(val || S.word.word[i], x + size / 2, y + 65, { ctx: c, size: 48, color: C.ink, weight: 900 });
    c.restore();
  }
  function draw(c) {
    if (A && A.jungle) A.jungle(c, G.t, { dim: .18 }); else { c.fillStyle = C.sky; c.fillRect(0, 0, W, H); }
    G.text('La Radura delle Lettere', 640, 130, { size: 40, color: C.cream, stroke: 'rgba(12,40,25,.7)', strokeWidth: 9 });
    if (!S.word) return;
    G.text(S.phase === 'done' ? 'Parola fatta!' : MODE_NAMES[S.mode], 640, 174, { size: 25, color: C.cream, stroke: 'rgba(12,40,25,.65)', strokeWidth: 6 });
    /* L'oggetto sta di lato: al centro restano libere istruzione e parola. */
    drawObject(c, S.word, 930, 205, 100);
    var size = Math.min(104, 620 / S.word.word.length), start = 640 - (S.word.word.length * size + (S.word.word.length - 1) * 12) / 2, i;
    for (i = 0; i < S.word.word.length; i++) drawSlot(c, i, start + i * (size + 12), 305, size);
    var trayN = S.tray.length, tw = Math.min(132, 1120 / Math.max(1, trayN)), tx = 640 - (trayN * tw + (trayN - 1) * 10) / 2;
    for (i = 0; i < trayN; i++) {
      G.ui.button({ x: tx + i * (tw + 10), y: 440, w: tw, h: 112, r: 24, color: S.tray[i] ? S.word.color : 'rgba(120,100,80,.35)', label: S.tray[i] || '·', fontSize: 44, disabled: !S.tray[i], onTap: (function (k) { return function () { chooseLetter(k); }; })(i) });
    }
    if (S.phase === 'play') {
      G.ui.button({ x: 260, y: 590, w: 300, h: 100, r: 24, color: C.plum, label: 'Ascolta', fontSize: 32, onTap: listen });
      G.ui.button({ x: 620, y: 590, w: 400, h: 100, r: 24, color: C.leaf, label: 'Aiuto', sub: 'una lettera', fontSize: 32, onTap: help });
    } else if (S.phase === 'done') {
      G.ui.button({ x: 310, y: 570, w: 290, h: 110, r: 26, color: C.leaf, label: 'Ancora!', fontSize: 38, onTap: function () { S.round++; startRound(); } });
      G.ui.button({ x: 680, y: 570, w: 290, h: 110, r: 26, color: C.tangerine, label: 'Giungla', fontSize: 34, onTap: function () { G.home(); } });
    }
    if (S.flash > 0) G.text('Riprova!', 640, 690, { size: 28, color: C.sun, stroke: C.ink, strokeWidth: 6 });
  }
  G.scene('lettere', {
    enter: function () { branch(); reset(); },
    exit: function () {},
    update: function (dt) {
      if (S.flash > 0) S.flash = Math.max(0, S.flash - dt);
      S.song += dt;
      if (S.phase === 'play') {
        S.idle += dt;
        if (S.mode === 2 && S.reveal < S.word.word.length) S.reveal = Math.min(S.word.word.length, 1 + Math.floor(S.song / 4));
        // The dino demonstrates the next letter after a quiet stretch.
        if (S.idle > 9) { S.idle = 0; if (S.next < S.word.word.length) chooseLetter(S.tray.indexOf(expected())); }
    } else if (S.phase === 'done') {
        S.song += dt;
        // The next little word arrives on its own; the replay button remains
        // available for a child who wants to start immediately.
        if (S.song > 1.6) { S.round++; startRound(); }
      }
    },
    draw: draw,
    onDown: function () {}, onMove: function () {}, onUp: function () {}
  });
})();
