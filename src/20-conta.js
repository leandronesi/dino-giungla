/* Dino Giungla — "La Radura dei Numeri" (scene `conta`).
   The maths heart of the game, Treasure MathStorm style: a round is 6 questions,
   every question is a spoken prompt + a drawn scene + big tappable answers.

   Level 1 (3 years old): numbers 1..5, never past 6.
     count  — how many fruits are there
     more   — which of the two baskets has more (tap the group, not a number)
     touch  — tap N fruits one by one, counted out loud
   Level 2 (6 years old): within 10, then within 20 once 12 rounds are done.
     add / sub / missing addend / compare / doubles

   There is no way to lose: a wrong tap shakes the button, the dino thinks, the
   voice encourages, and the same question stays on screen. After the second
   miss the right answer glows and the objects are counted out loud, one by one. */
(function () {
  'use strict';

  var C = G.C;
  var ROUND = 6;

  /* ------------------------------------------------------------- vocabulary */
  /* Italian agrees in gender and number. A grammar mistake read out loud to a
     child is a bug, so every spoken sentence is composed from this table. */
  var KINDS = [
    { id: 'fragola', one: 'fragola', many: 'fragole', g: 'f' },
    { id: 'banana', one: 'banana', many: 'banane', g: 'f' },
    { id: 'mela', one: 'mela', many: 'mele', g: 'f' },
    { id: 'melone', one: 'melone', many: 'meloni', g: 'm' },
    { id: 'cocco', one: 'noce di cocco', many: 'noci di cocco', g: 'f' },
    { id: 'uva', one: 'grappolo d\'uva', many: 'grappoli d\'uva', g: 'm' }
  ];

  var NUMW = ['zero', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette',
    'otto', 'nove', 'dieci', 'undici', 'dodici', 'tredici', 'quattordici',
    'quindici', 'sedici', 'diciassette', 'diciotto', 'diciannove', 'venti'];

  function nw(n) { return (n >= 0 && n < NUMW.length) ? NUMW[n] : String(n); }
  function howMany(k) { return k.g === 'f' ? 'Quante' : 'Quanti'; }
  function theMany(k) { return k.g === 'f' ? 'le ' : 'i '; }
  /* "una fragola" / "un melone" / "tre mele" */
  function amount(n, k) { return n === 1 ? (k.g === 'f' ? 'una ' : 'un ') + k.one : nw(n) + ' ' + k.many; }
  /* pronoun form after "ne": "ne mangia una" / "ne mangia uno" */
  function pron(n, k) { return n === 1 ? (k.g === 'f' ? 'una' : 'uno') : nw(n); }

  var PRAISE_TXT = ['Bravo!', 'Esatto!', 'Perfetto!', 'Sì!'];
  var PRAISE_SAY = ['Esatto!', 'Perfetto!', 'Giusto!', 'Bravissimo!', 'Proprio così!'];
  var ENCOURAGE = ['Quasi! Riprova.', 'Contiamo insieme.', 'Ci sei quasi, prova ancora.',
    'Non fa niente, riproviamo.', 'Guarda bene e riprova.'];

  /* ------------------------------------------------------------------ layout */
  var BOARD = { x: 170, y: 220, w: 990, h: 296 };
  var WIDE = { x: 210, y: 250, w: 910, h: 236 };      // objects only, full board
  var HALF_A = { x: 196, y: 252, w: 316, h: 226 };    // left addend
  var HALF_B = { x: 584, y: 252, w: 316, h: 226 };    // right addend
  var LONG = { x: 210, y: 250, w: 680, h: 232 };      // one group + answer card
  var TOUCH = { x: 230, y: 236, w: 1000, h: 290 };
  var PADS = [{ x: 176, y: 236, w: 434, h: 292 }, { x: 670, y: 236, w: 434, h: 292 }];
  var CARD_X = 1046, CARD_Y = 365;
  var ANS_COL = [C.berry, C.blueberry, C.tangerine, C.plum];

  /* ------------------------------------------------------------------- state */
  var q = null;            // current question
  var qi = 0;              // 0..ROUND-1
  var tries = 0;           // misses on the current question
  var lock = 0;            // >0 while celebrating: taps ignored
  var phase = 'play';      // 'play' | 'done'
  var shakeI = -1, shakeT = 0;
  var hintOn = false;      // glow the right answer (after 2 misses)
  var guide = null;        // { list, i, t } counting out loud, one object per beat
  var firstTry = 0;        // answers nailed at the first attempt this round
  var lastSig = '', lastType = '', lastEnc = -1;
  var touched = 0;         // 'touch' questions: how many tapped so far
  var pose = 'idle', poseT = 0;
  var rewardT = 0;
  var boardGrad = null;

  /* --------------------------------------------------------------- art shims */
  /* 01-art.js owns the drawings; fall back to something readable if a helper is
     missing so the scene never blanks out. */
  function drawFruit(c, x, y, r, kind) {
    if (typeof A !== 'undefined' && A.fruit) { A.fruit(c, x, y, r, kind); return; }
    c.save();
    c.fillStyle = C.berry;
    c.beginPath(); c.arc(x, y, r, 0, 6.3); c.fill();
    c.fillStyle = C.leaf;
    c.fillRect(x - r * .12, y - r * 1.5, r * .24, r * .6);
    c.restore();
  }
  function fruitIcon(c, x, y, r) { drawFruit(c, x, y, r * .60, q.kind.id); }

  function drawBack(c) {
    if (typeof A !== 'undefined' && A.jungle) { A.jungle(c, G.t, { dim: .3 }); return; }
    c.fillStyle = C.skyDeep; c.fillRect(0, 0, G.W, G.H);
    c.fillStyle = C.leafDark; c.fillRect(0, 470, G.W, G.H - 470);
  }
  function drawDino(c, x, y, s) {
    if (typeof A !== 'undefined' && A.dino) {
      A.dino(c, x, y, s, {
        facing: 1, pose: pose, t: G.t,
        hat: G.save.hat, color: (G.account && G.account.color) || C.dino
      });
      return;
    }
    c.fillStyle = C.dino;
    c.beginPath(); c.arc(x, y - s * .3, s * .3, 0, 6.3); c.fill();
  }

  /* ------------------------------------------------------------ small pieces */
  function board(c, x, y, w, h) {
    if (!boardGrad) {   // built once, never inside a hot loop
      boardGrad = c.createLinearGradient(0, 180, 0, 580);
      boardGrad.addColorStop(0, 'rgba(255,246,224,.95)');
      boardGrad.addColorStop(1, 'rgba(242,217,168,.95)');
    }
    c.save();
    G.shadow(c, 18, 'rgba(20,10,0,.34)', 8);
    c.fillStyle = boardGrad;
    G.roundRect(c, x, y, w, h, 30); c.fill();
    G.noShadow(c);
    c.strokeStyle = 'rgba(122,74,38,.5)'; c.lineWidth = 6;
    G.roundRect(c, x, y, w, h, 30); c.stroke();
    c.restore();
  }

  function dots(c, cx, cy, n, r, sp, color) {
    var x0 = cx - (n - 1) * sp / 2, i;
    c.save();
    c.fillStyle = color;
    for (i = 0; i < n; i++) {
      c.beginPath(); c.arc(x0 + i * sp, cy, r, 0, 6.3); c.fill();
    }
    c.restore();
  }

  function sym(c, s, x, y) { G.text(s, x, y, { size: 82, color: C.barkDark }); }

  function askCard(c, x, y) {
    c.save();
    c.fillStyle = C.cream;
    G.roundRect(c, x - 70, y - 82, 140, 164, 26); c.fill();
    c.strokeStyle = C.bark; c.lineWidth = 6;
    G.roundRect(c, x - 70, y - 82, 140, 164, 26); c.stroke();
    c.restore();
    G.text('?', x, y + 4, { size: 96, color: C.berry });
  }

  function halo(c, x, y, w, h) {
    var p = .5 + .5 * Math.sin(G.t * 4.2), e = 12 + p * 10;
    c.save();
    c.strokeStyle = 'rgba(255,215,94,' + (.55 + p * .4).toFixed(3) + ')';
    c.lineWidth = 9 + p * 7;
    G.roundRect(c, x - e, y - e, w + e * 2, h + e * 2, 36); c.stroke();
    c.restore();
  }

  /* ------------------------------------------------------------ object layout */
  /* Positions are computed once per question, never per frame. */
  function grid(n, rect, maxR) {
    var rows = n <= 5 ? 1 : (n <= 12 ? 2 : 3);
    var cols = Math.ceil(n / rows);
    var cw = rect.w / cols, ch = rect.h / rows;
    var r = G.clamp(Math.min(cw, ch) * .40, 12, maxR || 56);
    var out = [], row, col, inRow, x0, left = n;
    for (row = 0; row < rows && left > 0; row++) {
      inRow = Math.min(cols, left);
      left -= inRow;
      x0 = rect.x + (rect.w - inRow * cw) / 2;
      for (col = 0; col < inRow; col++) {
        out.push({
          x: x0 + cw * (col + .5) + G.rnd(-5, 5),
          y: rect.y + ch * (row + .5) + G.rnd(-5, 5),
          r: r, ph: G.rnd(0, 6.3)
        });
      }
    }
    return out;
  }

  function inset(pad) { return { x: pad.x + 34, y: pad.y + 36, w: pad.w - 68, h: pad.h - 104 }; }

  function drawObjs(c, list, kind, eatenFrom) {
    var i, o, y, eaten;
    c.save();
    for (i = 0; i < list.length; i++) {
      o = list[i];
      eaten = eatenFrom >= 0 && i >= eatenFrom;
      y = o.y + Math.sin(G.t * 2 + o.ph) * 3;
      c.globalAlpha = eaten ? .22 : 1;
      c.fillStyle = 'rgba(20,10,0,.12)';
      c.beginPath(); c.ellipse(o.x, o.y + o.r * .98, o.r * .85, o.r * .26, 0, 0, 6.3); c.fill();
      drawFruit(c, o.x, y, o.r, kind);
      c.globalAlpha = 1;
      if (eaten) {
        c.setLineDash([9, 9]);
        c.strokeStyle = 'rgba(43,29,18,.42)'; c.lineWidth = 4;
        c.beginPath(); c.arc(o.x, o.y, o.r * 1.05, 0, 6.3); c.stroke();
        c.setLineDash([]);
      }
    }
    c.restore();
  }

  /* --------------------------------------------------------- question making */
  function options(ans, count, lo, hi) {
    var set = [ans], cand = [], i, v;
    for (i = 1; i <= 5; i++) { cand.push(ans - i); cand.push(ans + i); }
    cand = G.shuffle(cand);
    for (i = 0; i < cand.length && set.length < count; i++) {
      v = cand[i];
      if (v < lo || v > hi || set.indexOf(v) >= 0) continue;
      set.push(v);
    }
    v = lo;
    while (set.length < count && v <= hi + count) { if (set.indexOf(v) < 0) set.push(v); v++; }
    return G.shuffle(set);
  }

  function pickType(list) {
    var t = G.pick(list), i = 0;
    while (t === lastType && i++ < 8) t = G.pick(list);
    return t;
  }

  /* ---- level 1: 3 years old. Never past 6, and one type is pure tapping. */
  function gen1() {
    var k = G.pick(KINDS);
    var t = pickType(['count', 'count', 'more', 'touch', 'touch']);
    var o = { type: t, kind: k, lvl: 1 };
    var n, a, b, tot;

    if (t === 'count') {
      n = G.rndi(1, 5);
      o.answer = n;
      o.objs = grid(n, WIDE, 56);
      o.guideList = o.objs;
      o.options = options(n, 3, 1, 6);
      o.say = G.pick([
        howMany(k) + ' ' + k.many + ' ci sono?',
        howMany(k) + ' ' + k.many + ' vedi?',
        'Conta ' + theMany(k) + k.many + '. ' + howMany(k) + ' ce ne sono?'
      ]);
      o.title = howMany(k) + ' ' + k.many + '?';
      o.sig = 'count' + n + k.id;
    } else if (t === 'more') {
      a = G.rndi(1, 5); b = G.rndi(1, 5);
      while (Math.abs(a - b) < 2) { a = G.rndi(1, 5); b = G.rndi(1, 5); }
      o.counts = [a, b];
      o.answer = a > b ? 0 : 1;
      o.groups = [grid(a, inset(PADS[0]), 40), grid(b, inset(PADS[1]), 40)];
      o.guideList = o.groups[o.answer];
      o.say = 'Guarda i due cesti. Dove ci sono più ' + k.many + '?';
      o.title = 'Dove ce ne sono di più?';
      o.sig = 'more' + a + '-' + b + k.id;
    } else {
      n = G.rndi(2, 5);
      tot = Math.min(6, n + G.rndi(1, 2));
      o.answer = n;
      o.objs = grid(tot, TOUCH, 58);
      o.taken = [];
      o.say = 'Tocca ' + amount(n, k) + '.';
      o.title = 'Tocca ' + n + ' ' + (n === 1 ? k.one : k.many);
      o.sig = 'touch' + n + '-' + tot + k.id;
    }
    return o;
  }

  /* ---- level 2: 6 years old. Within 10, within 20 after 12 finished rounds. */
  function gen2(big) {
    var k = G.pick(KINDS);
    var max = big ? 20 : 10;
    var t = pickType(['add', 'add', 'sub', 'sub', 'missing', 'cmp', 'double']);
    var o = { type: t, kind: k, lvl: 2 };
    var a, b, tot, eat, i, sp, r, x0, cap, sum;

    if (t === 'add') {
      a = G.rndi(2, max - 2);
      b = G.rndi(2, max - a);
      o.answer = a + b;
      o.gA = grid(a, HALF_A, 40);
      o.gB = grid(b, HALF_B, 40);
      o.guideList = o.gA.concat(o.gB);
      o.options = options(o.answer, 4, 1, max + 2);
      o.say = 'Ci sono ' + nw(a) + ' ' + k.many + ' e ne arrivano ' +
        (k.g === 'f' ? 'altre ' : 'altri ') + nw(b) + '. ' +
        howMany(k) + ' ' + k.many + ' ci sono in tutto?';
      o.title = a + ' + ' + b + ' = ?';
      o.sig = 'add' + a + '+' + b;
    } else if (t === 'sub') {
      tot = G.rndi(3, max);
      eat = G.rndi(1, tot - 1);
      o.answer = tot - eat;
      o.remain = o.answer;
      o.eat = eat;
      o.objs = grid(tot, LONG, 40);
      o.guideList = o.objs.slice(0, o.remain);
      o.options = options(o.answer, 4, 0, max);
      sum = 0;
      for (i = o.remain; i < o.objs.length; i++) sum += o.objs[i].x;
      o.eatCx = sum / eat;
      o.say = 'Ci sono ' + nw(tot) + ' ' + k.many + '. Il dino ne mangia ' + pron(eat, k) +
        '. ' + howMany(k) + ' ' + k.many + ' restano?';
      o.title = tot + ' − ' + eat + ' = ?';
      o.sig = 'sub' + tot + '-' + eat;
    } else if (t === 'missing') {
      tot = G.rndi(4, max);
      a = G.rndi(2, tot - 1);
      o.answer = tot - a;
      o.a = a; o.tot = tot;
      o.options = options(o.answer, 4, 1, max);
      sp = Math.min(66, 940 / tot);
      r = sp * .40;
      x0 = 640 - (tot - 1) * sp / 2;
      o.slots = [];
      for (i = 0; i < tot; i++) {
        o.slots.push({ x: x0 + i * sp, y: 438, r: r, ph: G.rnd(0, 6.3), full: i < a });
      }
      o.guideList = o.slots.slice(a);
      o.say = 'Abbiamo ' + nw(a) + ' ' + k.many + '. ' + howMany(k) +
        ' ne mancano per arrivare a ' + nw(tot) + '?';
      o.title = a + ' + ? = ' + tot;
      o.sig = 'miss' + a + '/' + tot;
    } else if (t === 'cmp') {
      cap = big ? 14 : 9;
      a = G.rndi(2, cap); b = G.rndi(2, cap);
      while (a === b) b = G.rndi(2, cap);
      o.counts = [a, b];
      o.answer = a > b ? 0 : 1;
      o.groups = [grid(a, inset(PADS[0]), 34), grid(b, inset(PADS[1]), 34)];
      o.guideList = o.groups[o.answer];
      o.say = 'Quale gruppo ha più ' + k.many + '? Toccalo.';
      o.title = 'Quale gruppo è più grande?';
      o.sig = 'cmp' + a + '-' + b;
    } else {
      a = G.rndi(2, Math.floor(max / 2));
      o.answer = a * 2;
      o.pairs = grid(a, LONG, 34);
      o.guideList = [];
      for (i = 0; i < o.pairs.length; i++) {
        o.guideList.push({ x: o.pairs[i].x - o.pairs[i].r * .8, y: o.pairs[i].y, r: o.pairs[i].r * .84 });
        o.guideList.push({ x: o.pairs[i].x + o.pairs[i].r * .8, y: o.pairs[i].y, r: o.pairs[i].r * .84 });
      }
      o.options = options(o.answer, 4, 2, max + 2);
      o.say = G.pick([
        'Quanto fa il doppio di ' + nw(a) + '?',
        'Conta a due a due. ' + howMany(k) + ' ' + k.many + ' ci sono in tutto?'
      ]);
      o.title = 'Il doppio di ' + a + ' = ?';
      o.sig = 'dbl' + a;
    }
    return o;
  }

  function newQuestion(prefix) {
    var big = G.level === 2 && (G.save.conta.done || 0) > 12;
    var made = null, i = 0;
    do { made = G.level === 2 ? gen2(big) : gen1(); } while (made.sig === lastSig && ++i < 10);
    lastSig = made.sig; lastType = made.type;
    q = made;
    tries = 0; shakeI = -1; shakeT = 0; hintOn = false; guide = null; touched = 0;
    G.say((prefix ? prefix + ' ' : '') + q.say);
  }

  /* --------------------------------------------------------------- feedback */
  function setPose(p, secs) { pose = p; poseT = secs; }

  function correct(x, y, spoken) {
    if (tries === 0) firstTry++;
    var s = G.save.conta;
    s.right = (s.right || 0) + 1;
    G.saveNow();
    G.sfx('good');
    G.fx.burst(x, y, { color: C.sun, count: 18, speed: 330, size: 15 });
    G.fx.burst(x, y, { color: C.tangerine, count: 12, speed: 250, size: 12 });
    G.fx.burst(x, y, { color: C.berry, count: 10, speed: 200, size: 11 });
    G.fx.ring(x, y, C.sun, 160);
    G.fx.text(x, y - 96, G.pick(PRAISE_TXT), C.cream, 56);
    G.say((spoken ? spoken + '! ' : '') + G.pick(PRAISE_SAY));
    setPose('happy', 1.6);
    guide = null; hintOn = false;
    lock = 1.15;
  }

  function encourage() {
    var i = G.rndi(0, ENCOURAGE.length - 1), n = 0;
    while (i === lastEnc && n++ < 5) i = G.rndi(0, ENCOURAGE.length - 1);
    lastEnc = i;
    return ENCOURAGE[i];
  }

  function wrong(i) {
    tries++;
    G.sfx('bad');
    shakeI = i; shakeT = .42;
    setPose('think', 1.8);
    G.say(encourage());
    if (tries >= 2) {          // gentle rescue: glow the answer and count aloud
      hintOn = true;
      if (q.guideList && q.guideList.length) startGuide(q.guideList);
    }
  }

  function startGuide(list) { guide = { list: list, i: 0, t: .9 }; }

  function stepGuide(dt) {
    guide.t -= dt;
    if (guide.t > 0) return;
    if (guide.i >= guide.list.length) { guide = null; return; }
    var o = guide.list[guide.i];
    G.say(nw(guide.i + 1));
    G.sfx('pop');
    G.fx.ring(o.x, o.y, C.cream, 74);
    guide.i++;
    guide.t = .95;
  }

  function advance() {
    qi++;
    if (qi >= ROUND) { finishRound(); return; }
    newQuestion(null);
  }

  function finishRound() {
    var s = G.save.conta;
    phase = 'done';
    s.done = (s.done || 0) + 1;
    if (firstTry > (s.best || 0)) s.best = firstTry;
    G.saveNow();
    G.fx.confetti();
    G.sfx('win');
    setPose('happy', 4);
    rewardT = .55;   // let the win jingle breathe before the coin sounds
    G.say('Evviva! Hai finito il giro. Vuoi continuare?');
  }

  /* Prize lands a beat after the win jingle, so the sounds do not pile up. */
  function grantReward() {
    rewardT = 0;
    G.addStars(1, 640, 330);
    G.addFruits(G.level === 2 ? 18 : 12, 700, 330);
  }

  function newRound() {
    if (rewardT > 0) grantReward();   // never lose the prize to an eager tap
    qi = 0; firstTry = 0; phase = 'play'; lock = 0;
    newQuestion(null);
  }

  /* ------------------------------------------------------------------- draws */
  function progress(c) {
    var i, x, r, filled = qi + (lock > 0 && phase === 'play' ? 1 : 0);
    for (i = 0; i < ROUND; i++) {
      x = 640 - (ROUND - 1) * 44 / 2 + i * 44;
      r = (i === filled && phase === 'play') ? 13 + Math.sin(G.t * 3.4) * 2.5 : 13;
      c.fillStyle = i < filled ? C.sun : 'rgba(255,246,224,.30)';
      c.beginPath(); c.arc(x, 110, r, 0, 6.3); c.fill();
      c.strokeStyle = 'rgba(20,10,0,.35)'; c.lineWidth = 3;
      c.beginPath(); c.arc(x, 110, r, 0, 6.3); c.stroke();
    }
  }

  function promptBar(c, str) {
    c.save();
    c.fillStyle = 'rgba(38,24,13,.72)';
    G.roundRect(c, 206, 142, 868, 70, 24); c.fill();
    c.restore();
    G.text(str, 640, 178, { size: 38, color: C.cream, maxWidth: 812 });
  }

  function speakerBtn() {
    G.ui.round({
      id: 'say-again', x: 108, y: 177, r: 46, color: C.cream, silent: true,
      icon: function (cc, x, y, r) {
        cc.save();
        cc.fillStyle = C.ink;
        cc.beginPath();
        cc.moveTo(x - r * .34, y - r * .15); cc.lineTo(x - r * .10, y - r * .15);
        cc.lineTo(x + r * .10, y - r * .40); cc.lineTo(x + r * .10, y + r * .40);
        cc.lineTo(x - r * .10, y + r * .15); cc.lineTo(x - r * .34, y + r * .15);
        cc.closePath(); cc.fill();
        cc.strokeStyle = C.ink; cc.lineWidth = r * .11; cc.lineCap = 'round';
        cc.beginPath(); cc.arc(x + r * .16, y, r * .26, -.9, .9); cc.stroke();
        cc.beginPath(); cc.arc(x + r * .16, y, r * .46, -.9, .9); cc.stroke();
        cc.restore();
      },
      onTap: function () { if (q) { G.sfx('tap'); G.say(q.say); } }
    });
  }

  function padTap(i) {
    return function () {
      if (lock > 0 || phase !== 'play') return;
      var p = PADS[i];
      if (i === q.answer) correct(p.x + p.w / 2, p.y + p.h / 2, null);
      else wrong(i);
    };
  }

  function drawPads(c) {
    var i, p, down, sh;
    for (i = 0; i < 2; i++) {
      p = PADS[i];
      sh = (shakeI === i && shakeT > 0) ? Math.sin(shakeT * 62) * 9 * (shakeT / .42) : 0;
      if (hintOn && i === q.answer) halo(c, p.x + sh, p.y, p.w, p.h);
      down = G.ui.button({
        id: 'pad' + i, x: p.x + sh, y: p.y, w: p.w, h: p.h, r: 30,
        color: i === 0 ? '#7bc96f' : '#6fbfd8', silent: true, onTap: padTap(i)
      });
      c.save();
      c.translate(sh, down ? 5 : 0);
      drawObjs(c, q.groups[i], q.kind.id, -1);
      c.restore();
      if (q.type === 'cmp') {     // 6 year olds get the written number too
        c.save();
        c.fillStyle = C.cream;
        G.roundRect(c, p.x + sh + p.w / 2 - 54, p.y + p.h - 78, 108, 62, 20); c.fill();
        c.restore();
        G.text(String(q.counts[i]), p.x + sh + p.w / 2, p.y + p.h - 46, { size: 46, color: C.ink });
      }
    }
  }

  function objTap(i) {
    return function () {
      if (lock > 0 || phase !== 'play') return;
      if (q.taken[i]) return;
      var o = q.objs[i];
      q.taken[i] = true;
      touched++;
      guide = null;
      G.sfx('pop');
      G.fx.burst(o.x, o.y, { color: C.mint, count: 10, speed: 210, size: 11 });
      G.fx.ring(o.x, o.y, C.cream, 86);
      G.fx.text(o.x, o.y - 70, nw(touched), C.cream, 46);
      if (touched >= q.answer) correct(o.x, o.y, nw(touched));
      else G.say(nw(touched));   // count out loud: "uno", "due", ...
    };
  }

  function drawTouch(c) {
    var i, o, n = q.answer, sp, r, x0;
    var x = 470, y = 542, w = 340, h = 152;
    for (i = 0; i < q.objs.length; i++) {
      if (q.taken[i]) continue;
      o = q.objs[i];
      G.ui.round({
        id: 'obj' + i, x: o.x, y: o.y, r: o.r, color: C.leafLight,
        silent: true, icon: fruitIcon, onTap: objTap(i)
      });
    }
    // counter card: digits for who reads them, one slot per unit for who does not
    c.save();
    c.fillStyle = 'rgba(255,246,224,.96)';
    G.roundRect(c, x, y, w, h, 28); c.fill();
    c.strokeStyle = C.bark; c.lineWidth = 6;
    G.roundRect(c, x, y, w, h, 28); c.stroke();
    c.restore();
    G.text(touched + ' / ' + n, x + w / 2, y + 46, { size: 48, color: C.ink });
    sp = Math.min(58, (w - 50) / n); r = sp * .32; x0 = x + w / 2 - (n - 1) * sp / 2;
    c.save();
    for (i = 0; i < n; i++) {
      c.fillStyle = i < touched ? C.berry : 'rgba(43,29,18,.16)';
      c.beginPath(); c.arc(x0 + i * sp, y + 108, r, 0, 6.3); c.fill();
    }
    c.restore();
  }

  function drawMissing(c) {
    var i, s, y;
    G.text(String(q.a), 470, 300, { size: 84, color: C.ink });
    G.text('+', 552, 300, { size: 72, color: C.barkDark });
    c.save();
    c.fillStyle = C.cream;
    G.roundRect(c, 590, 246, 100, 110, 22); c.fill();
    c.strokeStyle = C.bark; c.lineWidth = 6;
    G.roundRect(c, 590, 246, 100, 110, 22); c.stroke();
    c.restore();
    G.text('?', 640, 302, { size: 72, color: C.berry });
    G.text('=', 730, 300, { size: 72, color: C.barkDark });
    G.text(String(q.tot), 812, 300, { size: 84, color: C.ink });
    // support row: real fruit for what we have, empty rings for what is missing
    c.save();
    for (i = 0; i < q.slots.length; i++) {
      s = q.slots[i];
      if (s.full) {
        y = s.y + Math.sin(G.t * 2 + s.ph) * 3;
        drawFruit(c, s.x, y, s.r, q.kind.id);
      } else {
        c.setLineDash([8, 8]);
        c.strokeStyle = 'rgba(43,29,18,.45)'; c.lineWidth = 4;
        c.beginPath(); c.arc(s.x, s.y, s.r, 0, 6.3); c.stroke();
        c.setLineDash([]);
      }
    }
    c.restore();
  }

  function drawPairs(c) {
    var i, p, y;
    c.save();
    for (i = 0; i < q.pairs.length; i++) {
      p = q.pairs[i];
      y = p.y + Math.sin(G.t * 2 + p.ph) * 3;
      c.fillStyle = 'rgba(47,143,78,.20)';
      G.roundRect(c, p.x - p.r * 1.75, p.y - p.r * 1.15, p.r * 3.5, p.r * 2.3, p.r); c.fill();
      drawFruit(c, p.x - p.r * .8, y, p.r * .84, q.kind.id);
      drawFruit(c, p.x + p.r * .8, y, p.r * .84, q.kind.id);
    }
    c.restore();
  }

  function eatenBadge(c) {
    c.save();
    c.fillStyle = 'rgba(38,24,13,.80)';
    G.roundRect(c, q.eatCx - 62, BOARD.y + 8, 124, 56, 18); c.fill();
    c.restore();
    G.text('− ' + q.eat, q.eatCx, BOARD.y + 37, { size: 38, color: C.sun });
  }

  function drawStage(c) {
    var t = q.type;
    if (t === 'more' || t === 'cmp') { drawPads(c); return; }
    if (t === 'touch') { drawTouch(c); return; }
    board(c, BOARD.x, BOARD.y, BOARD.w, BOARD.h);
    if (t === 'count') {
      drawObjs(c, q.objs, q.kind.id, -1);
    } else if (t === 'add') {
      drawObjs(c, q.gA, q.kind.id, -1);
      drawObjs(c, q.gB, q.kind.id, -1);
      sym(c, '+', 548, CARD_Y);
      sym(c, '=', 936, CARD_Y);
      askCard(c, CARD_X, CARD_Y);
    } else if (t === 'sub') {
      drawObjs(c, q.objs, q.kind.id, q.remain);
      eatenBadge(c);
      sym(c, '=', 936, CARD_Y);
      askCard(c, CARD_X, CARD_Y);
    } else if (t === 'double') {
      drawPairs(c);
      sym(c, '=', 936, CARD_Y);
      askCard(c, CARD_X, CARD_Y);
    } else if (t === 'missing') {
      drawMissing(c);
    }
  }

  /* the counting hand: a pulsing ring plus the running number, one object at a time */
  function guideMark(c) {
    if (!guide || guide.i <= 0) return;
    var o = guide.list[guide.i - 1], r = o.r || 40;
    var p = .5 + .5 * Math.sin(G.t * 7);
    c.save();
    c.strokeStyle = 'rgba(255,215,94,' + (.6 + p * .4).toFixed(3) + ')';
    c.lineWidth = 7;
    c.beginPath(); c.arc(o.x, o.y, r * 1.3 + p * 5, 0, 6.3); c.stroke();
    c.restore();
    G.text(String(guide.i), o.x, o.y - r * 1.9, {
      size: 40, color: C.cream, stroke: 'rgba(40,20,0,.65)'
    });
  }

  /* `q` can have moved on between the frame that declared these buttons and the
     frame that handles the tap: the UI is immediate mode with one frame of lag
     (uiHot = uiRects at the swap), and the 'more' and 'touch' questions carry
     no options at all. Touching an answer at the exact moment the round changes
     used to throw here. */
  function ansGeom() {
    var n = (q && q.options) ? q.options.length : 3;
    var bw = n === 3 ? 250 : 220, bh = n === 3 ? 156 : 152, gap = n === 3 ? 46 : 30;
    return { n: n, w: bw, h: bh, gap: gap, x0: (G.W - (n * bw + (n - 1) * gap)) / 2, y: 538 };
  }

  function ansTap(i, val) {
    return function () {
      if (lock > 0 || phase !== 'play' || !q || !q.options) return;
      var g = ansGeom();
      if (val === q.answer) correct(g.x0 + i * (g.w + g.gap) + g.w / 2, g.y + g.h / 2, null);
      else wrong(i);
    };
  }

  function drawAnswers(c) {
    if (!q.options) return;
    var g = ansGeom(), i, x, cx, dy, val, sh, down, right;
    for (i = 0; i < g.n; i++) {
      val = q.options[i];
      x = g.x0 + i * (g.w + g.gap);
      right = val === q.answer;
      sh = (shakeI === i && shakeT > 0) ? Math.sin(shakeT * 62) * 11 * (shakeT / .42) : 0;
      if (hintOn && right) halo(c, x + sh, g.y, g.w, g.h);
      down = G.ui.button({
        id: 'ans' + i, x: x + sh, y: g.y, w: g.w, h: g.h,
        color: ANS_COL[i % ANS_COL.length], silent: true, onTap: ansTap(i, val)
      });
      cx = x + sh + g.w / 2;
      dy = down ? 5 : 0;
      if (q.lvl === 1) {
        // dots under the digit: a child who does not know figures counts the dots
        G.text(String(val), cx, g.y + dy + g.h * .36, { size: 78, color: '#fff', stroke: 'rgba(0,0,0,.28)' });
        dots(c, cx, g.y + dy + g.h * .74, val, 11, 30, 'rgba(255,246,224,.95)');
      } else {
        G.text(String(val), cx, g.y + dy + g.h * .50, { size: 82, color: '#fff', stroke: 'rgba(0,0,0,.28)' });
      }
    }
  }

  function drawDone(c) {
    var i, x;
    c.save();
    c.fillStyle = 'rgba(9,32,21,.55)';
    c.fillRect(0, 0, G.W, G.H);
    c.restore();
    board(c, 220, 168, 840, 404);
    G.text('Che bel giro!', 640, 240, { size: 58, color: C.ink });

    // rewards as icons, so they read without words
    if (typeof G.starIcon === 'function') G.starIcon(c, 520, 320, 30);
    G.text('+1', 578, 322, { size: 44, color: C.ink, align: 'left' });
    drawFruit(c, 720, 320, 28, 'fragola');
    G.text('+' + (G.level === 2 ? 18 : 12), 762, 322, { size: 44, color: C.ink, align: 'left' });

    // one dot per question, lit when it was right at the first try
    for (i = 0; i < ROUND; i++) {
      x = 640 - (ROUND - 1) * 44 / 2 + i * 44;
      c.fillStyle = i < firstTry ? C.sun : 'rgba(43,29,18,.16)';
      c.beginPath(); c.arc(x, 380, 14, 0, 6.3); c.fill();
    }

    /* A present waiting gets a third button — and only then, so the two-button
       layout the children already know stays exactly as it was. At three the
       reward should not have a journey in front of it. */
    var crate = (typeof G.crates === 'function') ? G.crates() : 0;
    if (crate > 0) {
      G.ui.button({
        id: 'again', x: 240, y: 404, w: 260, h: 132, label: 'Continua',
        color: C.leaf, fontSize: 32, onTap: function () { newRound(); }
      });
      G.ui.button({
        id: 'crate', x: 519, y: 404, w: 260, h: 132, label: 'Apri la cassa!',
        color: C.plum, fontSize: 27, onTap: function () { G.go('guardaroba'); }
      });
      G.ui.button({
        id: 'leave', x: 798, y: 404, w: 260, h: 132, label: 'Torna alla giungla',
        color: C.tangerine, fontSize: 25, onTap: function () { G.home(); }
      });
      return;
    }
    G.ui.button({
      id: 'again', x: 280, y: 404, w: 340, h: 132, label: 'Continua',
      color: C.leaf, fontSize: 40, onTap: function () { newRound(); }
    });
    G.ui.button({
      id: 'leave', x: 660, y: 404, w: 340, h: 132, label: 'Torna alla giungla',
      color: C.tangerine, fontSize: 29, onTap: function () { G.home(); }
    });
  }

  /* ------------------------------------------------------------------- scene */
  G.scene('conta', {
    hud: true,
    back: true,

    enter: function () {
      var s = (G.save.conta = G.save.conta || {});
      s.done ??= 0;    // rounds finished
      s.right ??= 0;   // total right answers, all time
      s.best ??= 0;    // best "right at the first try" in a single round
      G.save.seen = G.save.seen || {};

      qi = 0; firstTry = 0; phase = 'play'; lock = 0; rewardT = 0;
      shakeI = -1; shakeT = 0; hintOn = false; guide = null; touched = 0;
      lastSig = ''; lastType = ''; pose = 'idle'; poseT = 0;

      var hello = null;
      if (!G.save.seen.conta) {
        G.save.seen.conta = true;
        G.saveNow();
        hello = 'Benvenuto nella Radura dei Numeri!';
      } else if (G.account && G.account.name) {
        hello = 'Si conta, ' + G.account.name + '!';
      }
      newQuestion(hello);
    },

    exit: function () {
      if (rewardT > 0) grantReward();   // flyers keep flying across the fade
      guide = null; lock = 0;
    },

    update: function (dt) {
      if (poseT > 0) { poseT -= dt; if (poseT <= 0) pose = 'idle'; }
      if (shakeT > 0) { shakeT -= dt; if (shakeT <= 0) shakeI = -1; }
      if (guide) stepGuide(dt);
      if (rewardT > 0) { rewardT -= dt; if (rewardT <= 0) grantReward(); }
      if (lock > 0) { lock -= dt; if (lock <= 0) { lock = 0; advance(); } }
    },

    draw: function (c) {
      drawBack(c);
      progress(c);
      drawDino(c, 78, 704, 140);
      if (phase === 'done') { drawDone(c); return; }
      promptBar(c, q.title);
      speakerBtn();
      drawStage(c);
      guideMark(c);
      drawAnswers(c);
    }
  });
})();
