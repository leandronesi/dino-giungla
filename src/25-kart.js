/* Dino Giungla — "Il Girotondo dei Suoni" (scene: kart).
   Four friends play a short sequence; the child repeats it by touching the
   matching instruments. The game has no losing state and owns only G.save.kart.
   All art is procedural so the scene stays offline and works without assets. */
(function () {
  'use strict';

  var G = window.G;
  if (!G || !G.scene) return;
  var C = G.C, W = G.W, H = G.H;
  var A = window.A;
  var FRIENDS = [
    { name: 'Tamburo', say: 'tamburo', color: C.berry, sfx: 'note0' },
    { name: 'Campanella', say: 'campanella', color: C.sun, sfx: 'note1' },
    { name: 'Maracas', say: 'maracas', color: C.mint, sfx: 'note2' },
    { name: 'Flauto', say: 'flauto', color: C.blueberry, sfx: 'note3' }
  ];
  var ROUND_GOAL = 4;
  var S = {
    phase: 'ascolta', t: 0, round: 0, sequence: [], playAt: 0, playIndex: 0,
    inputIndex: 0, active: -1, activeT: 0, phaseT: 0, mistake: 0, idle: 0, songT: 0, banked: 0
  };
  var lookBuffers = [{}, {}, {}, {}];

  function big() { return G.level === 2; }
  function br() {
    if (!G.save.kart || typeof G.save.kart !== 'object' || Array.isArray(G.save.kart)) G.save.kart = {};
    var k = G.save.kart;
    k.done ??= 0; k.best ??= 0;
    if (typeof k.done !== 'number' || !isFinite(k.done) || k.done < 0) k.done = 0;
    if (typeof k.best !== 'number' || !isFinite(k.best) || k.best < 0) k.best = 0;
    k.done = Math.floor(k.done); k.best = Math.floor(k.best);
    return k;
  }
  function bank(n, x, y) {
    if (n > 0) { S.banked += n; G.addFruits(n, x, y); }
  }
  function sequenceLength() {
    return big() ? Math.min(6, 3 + S.round) : Math.min(3, 1 + S.round);
  }
  function nextRound() {
    var i, v, last = -1, len = sequenceLength();
    S.sequence.length = 0;
    for (i = 0; i < len; i++) {
      v = G.rndi(0, FRIENDS.length - 1);
      if (v === last) v = (v + 1) % FRIENDS.length;
      S.sequence.push(v); last = v;
    }
    S.phase = 'play'; S.t = 0; S.phaseT = 0; S.playAt = 1.5; S.playIndex = 0;
    S.inputIndex = 0; S.active = -1; S.activeT = 0; S.mistake = 0; S.idle = 0;
    G.say(big() ? 'Ascolta tutta la sequenza!' : 'Ascolta e ripeti!');
  }
  function reset() {
    S.phase = 'ascolta'; S.t = 0; S.round = 0; S.sequence.length = 0;
    S.playIndex = 0; S.inputIndex = 0; S.active = -1; S.activeT = 0; S.phaseT = 0; S.mistake = 0;
    S.idle = 0; S.songT = 0; S.banked = 0;
    nextRound();
  }
  function playNote(i) {
    var f = FRIENDS[i];
    S.active = i; S.activeT = 0;
    G.sfx(f.sfx);
    G.fx.ring(180 + i * 285, 355, f.color, 68);
  }
  function completeRound() {
    var k = br(), reward = big() ? 7 : 5;
    k.done++; k.best = Math.max(k.best, S.sequence.length); G.saveNow();
    bank(reward, 640, 330); G.addStars(1, 640, 285);
    G.fx.burst(640, 340, { color: C.sun, count: 12, speed: 190, size: 7, life: .65, gravity: 170 });
    S.round++;
    if (S.round >= ROUND_GOAL) {
      S.phase = 'festa'; S.songT = 0; G.sfx('win'); G.fx.confetti();
      G.say('Avete fatto una canzone! Balliamo!');
    } else {
      S.phase = 'pausa'; S.t = 0; G.sfx('good');
      G.say(G.pick(['Bravissimi!', 'Che bella musica!', 'Evviva gli amici!']));
    }
  }
  function wrong() {
    S.phase = 'buffo'; S.t = 0; S.mistake = .95; S.idle = 0;
    G.sfx('pop');
    G.say(G.pick(['Ops, era un altro strumento!', 'Quasi! Riproviamo!', 'Che suono buffo!']));
  }
  function choose(i) {
    if (S.phase !== 'input' && S.phase !== 'smallInput') return;
    S.idle = 0;
    if (S.sequence[S.inputIndex] !== i) { wrong(); return; }
    S.active = i; S.activeT = 0; S.inputIndex++; G.sfx(FRIENDS[i].sfx);
    G.fx.ring(180 + i * 285, 355, FRIENDS[i].color, 60);
    if (S.inputIndex >= S.sequence.length) completeRound();
    else if (!big()) { S.phase = 'smallNext'; S.t = 0; }
  }
  function demonstrateExpected() {
    if (S.phase !== 'input' && S.phase !== 'smallInput') return;
    S.idle=0;playNote(S.sequence[S.inputIndex]);
  }
  function replay(){
    if(S.phase!=='input'&&S.phase!=='smallInput')return;
    G.hush();S.playIndex=0;S.inputIndex=0;S.phase='play';S.phaseT=0;S.playAt=.6;S.idle=0;
  }
  G.soundReplay=replay;
  G.soundState = function () {
    return {
      phase: S.phase, expected: S.sequence[S.inputIndex], round: S.round,
      length: S.sequence.length, index: S.inputIndex, played: S.playIndex,
      phaseT: S.phaseT, nextIn: S.phase === 'play' ? Math.max(0, S.playAt - S.phaseT) : 0
    };
  };
  G.soundChoose = choose;                 // deterministic headless tests

  function iconDrum(c, x, y, s) {
    c.save(); c.fillStyle = '#fff6e0'; c.strokeStyle = C.ink; c.lineWidth = Math.max(3, s * .08);
    c.beginPath(); c.ellipse(x, y - s * .10, s * .36, s * .17, 0, 0, 7); c.fill(); c.stroke();
    c.fillStyle = C.berry; c.beginPath(); c.ellipse(x, y + s * .10, s * .34, s * .27, 0, 0, 7); c.fill(); c.stroke();
    c.strokeStyle = C.cream; c.lineWidth = s * .07; c.beginPath(); c.moveTo(x - s * .20, y - s * .28); c.lineTo(x - s * .35, y - s * .54); c.moveTo(x + s * .20, y - s * .28); c.lineTo(x + s * .35, y - s * .54); c.stroke(); c.restore();
  }
  function iconBell(c, x, y, s) {
    c.save(); c.fillStyle = C.sun; c.strokeStyle = C.ink; c.lineWidth = Math.max(3, s * .08);
    c.beginPath(); c.moveTo(x - s * .34, y + s * .22); c.quadraticCurveTo(x - s * .30, y - s * .30, x, y - s * .38); c.quadraticCurveTo(x + s * .30, y - s * .30, x + s * .34, y + s * .22); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.arc(x, y + s * .28, s * .10, 0, 7); c.fill(); c.restore();
  }
  function iconMaracas(c, x, y, s) {
    c.save(); c.fillStyle = C.mint; c.strokeStyle = C.ink; c.lineWidth = Math.max(3, s * .08);
    c.save(); c.translate(x - s * .18, y - s * .06); c.rotate(-.45); c.beginPath(); c.ellipse(0, -s * .20, s * .21, s * .28, 0, 0, 7); c.fill(); c.stroke(); c.fillStyle = C.cream; c.fillRect(-s * .06, s * .04, s * .12, s * .35); c.restore();
    c.save(); c.translate(x + s * .18, y - s * .06); c.rotate(.45); c.beginPath(); c.ellipse(0, -s * .20, s * .21, s * .28, 0, 0, 7); c.fill(); c.stroke(); c.fillStyle = C.cream; c.fillRect(-s * .06, s * .04, s * .12, s * .35); c.restore(); c.restore();
  }
  function iconFlute(c, x, y, s) {
    c.save(); c.strokeStyle = C.blueberry; c.lineWidth = s * .18; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - s * .38, y + s * .25); c.lineTo(x + s * .38, y - s * .25); c.stroke(); c.strokeStyle = C.cream; c.lineWidth = s * .07; for (var i = -1; i < 2; i++) { c.beginPath(); c.arc(x + i * s * .17, y - i * s * .11, s * .045, 0, 7); c.stroke(); } c.restore();
  }
  var ICONS = [iconDrum, iconBell, iconMaracas, iconFlute];

  function drawFriend(c, i) {
    var x = 180 + i * 285, f = FRIENDS[i], pose = S.phase === 'festa' ? 'happy' : (S.active === i ? 'happy' : 'idle');
    if (A && A.dino) {
      var gear = (typeof G.look === 'function') ? G.look(G.save, lookBuffers[i]) : null;
      A.dino(c, x, 374, 152, { facing: 1, pose: pose, t: G.t + i * .2, color: f.color, gear: gear });
    }
    c.save(); c.globalAlpha = S.active === i ? .95 : .65; c.fillStyle = f.color; c.beginPath(); c.ellipse(x, 376, 106, 20, 0, 0, 7); c.fill(); c.restore();
    if (S.active === i) { c.save(); c.strokeStyle = C.sun; c.lineWidth = 8; c.beginPath(); c.arc(x, 310, 93 + Math.sin(G.t * 8) * 6, 0, 7); c.stroke(); c.restore(); }
  }
  function drawButtons(c) {
    var y = 466, i;
    for (i = 0; i < FRIENDS.length; i++) {
      G.ui.button({ id:'instrument-'+i,x: 60 + i * 285, y: y, w: 240, h: 166, r: 30, color: FRIENDS[i].color,
        disabled:S.phase!=='input'&&S.phase!=='smallInput',
        label: '', icon: ICONS[i], iconSize: 106,
        onTap: (function (k) { return function () { choose(k); }; })(i) });
      G.text(FRIENDS[i].name, 180 + i * 285, 596, {
        ctx: c, size: 23, color: C.cream, stroke: 'rgba(43,29,18,.72)', strokeWidth: 6
      });
    }
  }
  function drawParty(c) {
    var i;
    for (i = 0; i < 12; i++) {
      var x = 90 + ((i * 173) % 1100), y = 220 + ((i * 71) % 260);
      c.save(); c.globalAlpha = .35; c.strokeStyle = FRIENDS[i % 4].color; c.lineWidth = 5; c.beginPath(); c.arc(x, y, 22 + Math.sin(S.songT * 7 + i) * 8, 0, 7); c.stroke(); c.restore();
    }
    G.text('Bravissimi!', 640, 460, { size: 58, color: C.sun, stroke: C.ink, strokeWidth: 11 });
    G.ui.button({ x: 310, y: 510, w: 290, h: 112, r: 28, label: 'Ancora!', color: C.leaf, fontSize: 38, onTap: function () { reset(); } });
    G.ui.button({ x: 680, y: 510, w: 290, h: 112, r: 28, label: 'Giungla', color: C.tangerine, fontSize: 34, onTap: function () { G.home(); } });
  }
  function drawRhythm(c) {
    var n = S.sequence.length, done = (S.phase === 'input' || S.phase === 'smallInput') ? S.inputIndex : S.playIndex;
    var label = (S.phase === 'input' || S.phase === 'smallInput') ? ('Tocca ' + done + ' / ' + n) : ('Ascolta ' + n + (n===1?' nota':' note'));
    var left = 380, width = 520, i, x;
    c.save(); c.fillStyle = 'rgba(15,43,51,.72)'; G.roundRect(c, left - 28, 392, width + 56, 58, 24); c.fill();
    G.text(label, left + width / 2, 409, { ctx: c, size: 23, color: C.cream, stroke: C.ink, strokeWidth: 5 });
    for (i = 0; i < n; i++) {
      x = left + (i + .5) * width / n;
      c.fillStyle = i < done ? C.leafLight : (i === done ? C.sun : 'rgba(255,245,220,.35)');
      c.beginPath(); c.arc(x, 432, 9, 0, 7); c.fill();
      c.strokeStyle = i<done || !big() ? FRIENDS[S.sequence[i]].color : C.cream; c.lineWidth = 3; c.stroke();
    }
    if (S.phase === 'play' && S.playAt > 0) {
      c.fillStyle = C.sun; c.globalAlpha = .78; G.roundRect(c, left, 444, width * G.clamp(S.phaseT / S.playAt, 0, 1), 5, 3); c.fill();
    }
    c.restore();
  }
  function drawScene(c) {
    c.fillStyle='#bfe3da';c.fillRect(0,0,W,H);
    c.fillStyle='#50866a';c.beginPath();c.ellipse(60,260,250,310,-.3,0,7);c.ellipse(1220,260,250,310,.3,0,7);c.fill();
    c.fillStyle='#8fbd8a';c.fillRect(0,370,W,350);
    c.fillStyle='#73573d';G.roundRect(c,32,359,1216,301,30);c.fill();
    c.fillStyle='#d7b982';G.roundRect(c,32,348,1216,290,30);c.fill();
    c.strokeStyle='#bf9d68';c.lineWidth=3;for(var plank=0;plank<8;plank++){c.beginPath();c.moveTo(60,380+plank*35);c.lineTo(1220,380+plank*35);c.stroke();}
    c.strokeStyle='#526c54';c.lineWidth=3;c.beginPath();c.moveTo(24,106);c.quadraticCurveTo(640,205,1256,106);c.stroke();
    for(var flag=0;flag<11;flag++){var fx=60+flag*116,fy=110+Math.sin(flag/10*Math.PI)*45;c.fillStyle=FRIENDS[flag%4].color;c.beginPath();c.moveTo(fx,fy);c.lineTo(fx+38,fy+5);c.lineTo(fx+18,fy+39);c.fill();}
    G.text('Girotondo dei Suoni', 640, 122, { size: 42, color: C.cream, stroke: 'rgba(12,40,25,.7)', strokeWidth: 9 });
    var instruction = S.phase === 'festa' ? 'La nostra canzone!' : (S.phase === 'input' || S.phase === 'smallInput' ? 'Tocca gli strumenti nello stesso ordine' : 'Ascolta...');
    G.text(instruction, 640, 194, { size: 25, color: C.cream, stroke: 'rgba(12,40,25,.65)', strokeWidth: 6 });
    for (var i = 0; i < FRIENDS.length; i++) drawFriend(c, i);
    drawRhythm(c);
    if (S.phase === 'festa') drawParty(c); else drawButtons(c);
    if(S.phase==='input'||S.phase==='smallInput')G.ui.button({id:'music-replay',x:1020,y:108,w:220,h:96,r:20,color:C.water,label:'Riascolta',fontSize:26,onTap:replay});
    if (S.phase === 'buffo') G.text('Riproviamo insieme!', 640, 690, { size: 28, color: C.sun, stroke: C.ink, strokeWidth: 6 });
  }

  G.scene('kart', {
    enter: function () {
      br(); reset();
      if (!G.save.seen || typeof G.save.seen !== 'object') G.save.seen = {};
      var first = !G.save.seen.kart; G.save.seen.kart = true; G.saveNow();
      if (first) G.say('Ascolta gli amici e ripeti la musica!');
    },
    exit: function () { S.active = -1; G.hush(); },
    update: function (dt) {
      S.songT += dt; S.t += dt; S.phaseT += dt; S.activeT += dt;
      if (S.active >= 0 && S.activeT > .42) S.active = -1;
      if (S.phase === 'play') {
        if (S.phaseT >= S.playAt) {
          if (S.playIndex < S.sequence.length) {
            playNote(S.sequence[S.playIndex++]);
            S.phaseT = 0;
            if (big()) S.playAt = .76;
            else { S.phase = 'smallInput'; S.idle=0; }
          } else {
            S.phase = big() ? 'input' : 'pausaInput'; S.t = 0; S.idle = 0;
            if (big()) G.say('Ora tocca a te!');
          }
        }
      } else if (S.phase === 'smallNext') {
        if (S.t > .32) { S.phase = 'play'; S.t = 0; S.phaseT = 0; S.playAt = .12; }
      } else if (S.phase === 'smallInput') {
        S.idle += dt; if (S.idle > 5) demonstrateExpected();
      } else if (S.phase === 'pausaInput') {
        S.phase = 'input'; S.t = 0; S.idle = 0; G.say('Adesso ripeti la sequenza!');
      } else if (S.phase === 'input') {
        S.idle += dt; if (S.idle > 9) demonstrateExpected();
      } else if (S.phase === 'buffo') {
        if (S.t > .9) {
          S.t = 0; S.phaseT = 0; S.idle = 0;
          if (big()) { S.playIndex=0;S.inputIndex=0;S.phase = 'play'; S.playAt = .7; } else { S.phase = 'smallInput'; playNote(S.sequence[S.inputIndex]); }
        }
      } else if (S.phase === 'pausa') {
        if (S.t > 1.1) nextRound();
      }
    },
    draw: function (c) { drawScene(c); },
    onDown: function () {}, onMove: function () {}, onUp: function () {}
  });
})();
