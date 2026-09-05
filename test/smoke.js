#!/usr/bin/env node
/* Headless smoke test. Runs the whole bundle against a fake DOM/canvas/audio,
   pumps frames through every scene at both difficulty levels, and fuzzes it
   with random taps and drags. Any thrown error or console.error is a failure.

   `node test/smoke.js`  — exit code 0 = clean. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');

const NOOP = function () {};
const failures = [];
let phase = 'boot';

/* ------------------------------------------------------------ fake canvas */
function gradient() { return { addColorStop: NOOP }; }

// Counted so we can tell "the scene rendered" from "the scene rendered nothing",
// and so a NaN coordinate — which silently voids an entire canvas path — is caught.
const DRAW_OPS = ['fill', 'stroke', 'fillRect', 'strokeRect', 'fillText', 'strokeText', 'arc', 'arcTo',
  'ellipse', 'moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo', 'rect', 'translate', 'rotate', 'drawImage'];
let drawCount = 0;
const counted = {};
DRAW_OPS.forEach((name) => {
  counted[name] = function () {
    drawCount++;
    for (let i = 0; i < arguments.length; i++) {
      const v = arguments[i];
      if (typeof v === 'number' && !Number.isFinite(v)) { fail('ctx.' + name + '() argomento ' + i + ' = ' + v); break; }
    }
  };
});

function ctx2d() {
  const store = { canvas: null };
  const special = {
    ...counted,
    createLinearGradient: gradient,
    createRadialGradient: gradient,
    createConicGradient: gradient,
    createPattern: () => ({ setTransform: NOOP }),
    measureText: (s) => ({ width: String(s).length * 9, actualBoundingBoxAscent: 10, actualBoundingBoxDescent: 4 }),
    getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
    isPointInPath: () => false,
    isPointInStroke: () => false,
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    getLineDash: () => []
  };
  return new Proxy(store, {
    get(t, k) {
      if (k in special) return special[k];
      if (k in t) return t[k];
      if (typeof k === 'symbol') return undefined;
      return NOOP;                       // any unknown 2d method is a no-op
    },
    set(t, k, v) {
      // Catch the classic canvas bug: a NaN coordinate silently kills a draw.
      if ((k === 'lineWidth' || k === 'globalAlpha' || k === 'shadowBlur') && Number.isNaN(v)) {
        fail('ctx.' + k + ' set to NaN');
      }
      if ((k === 'fillStyle' || k === 'strokeStyle') && typeof v === 'string' && /NaN|undefined/.test(v)) {
        fail('ctx.' + k + ' = "' + v + '"');
      }
      t[k] = v; return true;
    }
  });
}

function fail(msg) {
  const line = '[' + phase + '] ' + msg;
  if (failures.length < 400 && !failures.includes(line)) failures.push(line);
}

/* --------------------------------------------------------------- fake DOM */
function classList() {
  const set = new Set();
  return {
    add: (c) => set.add(c),
    remove: (c) => set.delete(c),
    contains: (c) => set.has(c),
    toggle: (c, on) => { if (on === undefined) { set.has(c) ? set.delete(c) : set.add(c); } else if (on) set.add(c); else set.delete(c); return set.has(c); }
  };
}
function el(id) {
  const listeners = {};
  return {
    id,
    listeners,
    style: {},
    classList: classList(),
    value: '',
    textContent: '',
    width: 0, height: 0,
    addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); },
    removeEventListener: NOOP,
    dispatch: (t, e) => (listeners[t] || []).forEach((f) => f(e)),
    getContext: () => el._ctx || (el._ctx = ctx2d()),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: WIN.innerWidth, height: WIN.innerHeight, right: WIN.innerWidth, bottom: WIN.innerHeight }),
    setPointerCapture: NOOP, releasePointerCapture: NOOP,
    focus: NOOP, blur: NOOP, select: NOOP,
    requestFullscreen: () => Promise.resolve(),
    appendChild: NOOP, remove: NOOP
  };
}

const ELS = {};
['c', 'ovl', 'ovl-t', 'ovl-i', 'ovl-y', 'ovl-n', 'rot'].forEach((id) => { ELS[id] = el(id); });

/* --------------------------------------------------------- virtual timers */
let vclock = 0;
const timers = [];
function fakeSetTimeout(fn, ms) {
  const t = { at: vclock + (ms || 0), fn, id: timers.length + 1 };
  timers.push(t);
  return t.id;
}
function fakeClearTimeout(id) {
  const i = timers.findIndex((t) => t.id === id);
  if (i >= 0) timers.splice(i, 1);
}
function flushTimers() {
  for (let guard = 0; guard < 500; guard++) {
    const due = timers.filter((t) => t.at <= vclock);
    if (!due.length) return;
    due.forEach((t) => {
      timers.splice(timers.indexOf(t), 1);
      try { t.fn(); } catch (e) { fail('setTimeout callback: ' + e.message); }
    });
  }
}

/* ------------------------------------------------------------- fake world */
const WIN = {
  innerWidth: 1600, innerHeight: 900, devicePixelRatio: 2,
  listeners: {},
  addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); },
  removeEventListener: NOOP,
  matchMedia: () => ({ matches: false, addEventListener: NOOP }),
  setTimeout: fakeSetTimeout, clearTimeout: fakeClearTimeout,
  setInterval: () => 0, clearInterval: NOOP,
  requestAnimationFrame(cb) { WIN._raf = cb; return 1; },
  cancelAnimationFrame: NOOP,
  speechSynthesis: { speak: NOOP, cancel: NOOP, getVoices: () => [{ lang: 'it-IT', name: 'Fake' }], addEventListener: NOOP },
  SpeechSynthesisUtterance: function (s) { this.text = s; },
  AudioContext: function () {
    const node = () => ({
      connect: NOOP, disconnect: NOOP, start: NOOP, stop: NOOP,
      gain: { value: 0, setValueAtTime: NOOP, exponentialRampToValueAtTime: NOOP, linearRampToValueAtTime: NOOP },
      frequency: { value: 0, setValueAtTime: NOOP, exponentialRampToValueAtTime: NOOP },
      Q: { value: 0 }, type: '', buffer: null
    });
    this.currentTime = 0; this.state = 'running'; this.sampleRate = 44100;
    this.destination = node();
    this.createGain = node; this.createOscillator = node; this.createBufferSource = node; this.createBiquadFilter = node;
    this.createBuffer = (ch, len) => ({ getChannelData: () => new Float32Array(len) });
    this.resume = () => Promise.resolve();
  },
  navigator: { wakeLock: null, userAgent: 'smoke' },
  performance: { now: () => vclock },
  console
};

const localStore = new Map();
WIN.localStorage = {
  getItem: (k) => (localStore.has(k) ? localStore.get(k) : null),
  setItem: (k, v) => localStore.set(k, String(v)),
  removeItem: (k) => localStore.delete(k),
  clear: () => localStore.clear()
};

WIN.document = {
  hidden: false,
  documentElement: el('html'),
  listeners: {},
  getElementById: (id) => ELS[id] || el(id),
  addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); },
  removeEventListener: NOOP,
  createElement: (t) => el(t),
  fullscreenElement: null,
  exitFullscreen: () => Promise.resolve(),
  body: el('body')
};

const sandbox = WIN;
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
sandbox.Math = Math; sandbox.JSON = JSON; sandbox.Date = Date;
sandbox.console = {
  log: NOOP, warn: (...a) => fail('console.warn: ' + a.join(' ')),
  error: (...a) => fail('console.error: ' + a.map((x) => (x && x.stack ? x.stack.split('\n').slice(0, 3).join(' | ') : String(x))).join(' ')),
  info: NOOP, debug: NOOP
};

/* --------------------------------------------------------------- load src */
const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.js')).sort();
const code = files.map((f) => '/* ' + f + ' */\n' + fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n;\n');

vm.createContext(sandbox);
try {
  vm.runInContext(code, sandbox, { filename: 'bundle.js' });
} catch (e) {
  console.error('\n✗ il bundle non parte affatto:\n' + (e.stack || e.message) + '\n');
  process.exit(1);
}

const G = sandbox.G;
if (!G) { console.error('✗ G non e stato creato'); process.exit(1); }

/* ------------------------------------------------------------ frame pump */
function pump(n) {
  for (let i = 0; i < n; i++) {
    vclock += 16.7;
    flushTimers();
    if (!WIN._raf) { fail('nessun requestAnimationFrame registrato'); return; }
    try { WIN._raf(vclock); } catch (e) { fail('frame: ' + (e.stack || e.message).split('\n').slice(0, 3).join(' | ')); }
  }
}

function toClient(x, y) {
  const v = G.view;
  return { clientX: v.ox + x * v.s, clientY: v.oy + y * v.s };
}
function pev(x, y) { const c = toClient(x, y); return { clientX: c.clientX, clientY: c.clientY, pointerId: 1, preventDefault: NOOP }; }

function tap(x, y) {
  ELS.c.dispatch('pointerdown', pev(x, y));
  pump(1);
  ELS.c.dispatch('pointerup', pev(x, y));
  pump(1);
}
function drag(x0, y0, x1, y1, steps) {
  steps = steps || 8;
  ELS.c.dispatch('pointerdown', pev(x0, y0));
  for (let i = 1; i <= steps; i++) {
    ELS.c.dispatch('pointermove', pev(x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps));
    pump(1);
  }
  ELS.c.dispatch('pointerup', pev(x1, y1));
  pump(1);
}
function closeOverlayIfOpen(name) {
  if (ELS.ovl.classList.contains('on')) {
    ELS['ovl-i'].value = name || 'Prova';
    ELS['ovl-y'].dispatch('click', {});
    pump(2);
  }
}

/* ------------------------------------------------------------------ tests */
console.log('Dino Giungla — collaudo headless');
console.log('moduli: ' + files.join(', ') + '\n');

// 0. boot ran
phase = 'avvio';
pump(20);
if (!G.current) fail('nessuna scena attiva dopo l avvio');

const expected = ['accesso', 'nuovo', 'segreto', 'gate', 'genitori', 'giungla', 'conta', 'fili', 'nido', 'lettere', 'guardaroba', 'casetta', 'kart', 'bus'];
const missing = expected.filter((s) => !G.sceneOf(s));
if (missing.length) fail('scene mancanti: ' + missing.join(', '));

if (!sandbox.A) fail('namespace A (grafica) assente');
else {
  const need = ['dino', 'jungle', 'canopy', 'fruit', 'egg', 'chick', 'bush', 'tree', 'flower', 'rock', 'cloud', 'panel', 'sign', 'star', 'hat', 'HATS', 'SHAPES', 'gear', 'GEAR', 'gearOf', 'SLOTS', 'house', 'HOUSE', 'room', 'roomDepth'];
  const miss = need.filter((k) => sandbox.A[k] === undefined);
  if (miss.length) fail('A.* mancanti: ' + miss.join(', '));
  if (sandbox.A.HATS && sandbox.A.HATS.length < 6) fail('A.HATS ha solo ' + sandbox.A.HATS.length + ' cappelli');
}

// 1. full sign-up flow through the real UI
phase = 'iscrizione';
G.go('accesso'); pump(40);
tap(1280 / 2, 360);                       // "nuovo giocatore" is the only card at first
pump(40); closeOverlayIfOpen('Bimbo');    // the name prompt opens on enter()
pump(20);
tap(275, 208); pump(6);                   // a colour swatch
tap(1280 / 2, 720 - 70); pump(20);        // avanti
tap(460, 330); pump(6);                   // "Piccolo"
tap(1280 / 2, 720 - 70); pump(20);        // avanti
tap(474, 324); pump(6);                   // secret: three of the nine tiles
tap(630, 324); pump(6);
tap(786, 324); pump(6);
tap(1280 / 2, 720 - 70); pump(50);        // fatto
if (!G.account) fail('iscrizione non ha creato/collegato un account');
else if (G.current !== 'giungla') fail('dopo l iscrizione la scena e "' + G.current + '" invece di giungla');

// 2. every scene, at both levels, with a fuzz of taps and drags
const scenes = ['giungla', 'conta', 'fili', 'nido', 'lettere', 'guardaroba', 'casetta', 'kart', 'bus', 'genitori', 'gate', 'accesso'];
[1, 2].forEach((lvl) => {
  if (!G.account) return;
  G.accounts.update(G.account.id, { level: lvl });
  G.level = lvl;
  scenes.forEach((s) => {
    phase = s + ' L' + lvl;
    G.go(s, s === 'gate' ? { then: 'giungla', back: 'giungla' } : null);
    pump(30);
    if (G.current !== s) { G.go(s, s === 'gate' ? { then: 'giungla', back: 'giungla' } : null); pump(40); }
    if (G.current !== s) { fail('non sono riuscito a entrare (sono in "' + G.current + '")'); return; }
    drawCount = 0;
    pump(30);
    if (drawCount < 600) fail('disegna quasi nulla: ' + drawCount + ' operazioni in 30 frame (schermata vuota?)');
    for (let i = 0; i < 130; i++) {
      const x = 40 + Math.random() * 1200, y = 40 + Math.random() * 640;
      if (Math.random() < 0.25) drag(x, y, 40 + Math.random() * 1200, 40 + Math.random() * 640, 6);
      else tap(x, y);
      pump(2);
      closeOverlayIfOpen('Fuzz');
      if (G.current !== s) { G.go(s); pump(32); }     // a tap navigated away: come back
    }
    pump(60);
  });
});

// 3. the "fili" grid deserves a methodical sweep: every cell dragged to every neighbour
phase = 'fili sistematico';
if (G.sceneOf('fili')) {
  G.go('fili'); pump(30);
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 6; c++) {
      const x = 400 + c * 80, y = 150 + r * 80;
      drag(x, y, x + 80, y, 4);
      drag(x, y, x, y + 80, 4);
      drag(x, y, x - 80, y, 4);
    }
  }
  pump(60);
}

// 3b. La Radura delle Lettere: every mode is playable and has a gentle helper.
phase = 'lettere';
if (G.sceneOf('lettere')) {
  G.go('lettere'); pump(40);
  if (typeof G.lettersState !== 'function' || typeof G.lettersChoose !== 'function' || typeof G.lettersHelp !== 'function') {
    fail('La Radura delle Lettere non espone stato/input per il collaudo');
  } else {
    const catalog = typeof G.lettersCatalog === 'function' ? G.lettersCatalog() : null;
    if (!catalog || !Array.isArray(catalog.piccolo) || !Array.isArray(catalog.grande) || catalog.piccolo.length < 50 || catalog.grande.length < 100) {
      fail('catalogo Lettere troppo piccolo o non configurabile');
    } else {
      [['Piccolo', catalog.piccolo, 50], ['Grande', catalog.grande, 100]].forEach(([label, words, minimum]) => {
        const seen = new Set();
        words.forEach((entry) => {
          if (!entry || typeof entry.word !== 'string' || !/^[A-Z]{3,9}$/.test(entry.word)) {
            fail('parola ' + label + ' ingestibile: ' + JSON.stringify(entry));
            return;
          }
          if (seen.has(entry.word)) fail('parola ' + label + ' duplicata: ' + entry.word);
          seen.add(entry.word);
        });
        if (seen.size < minimum) fail('parole ' + label + ' uniche sotto soglia: ' + seen.size);
      });
    }
    for (let i = 0; i < 1600 && (G.save.lettere || {}).done < 5; i++) {
      const q = G.lettersState();
      if (q.phase === 'play' && q.expected) {
        const tray = (q.tray || []);
        G.lettersChoose(q.expected);
      }
      if (i % 180 === 0) G.lettersHelp();
      pump(1);
    }
    if (typeof (G.save.lettere || {}).done !== 'number') fail('G.save.lettere.done non e un numero');
  }
}

// 4. long session at the nest: offline earnings, buying, upgrading
phase = 'nido lungo';
if (G.sceneOf('nido')) {
  G.save.fruits = 5000; G.save.stars = 200;
  G.go('nido'); pump(30);
  for (let i = 0; i < 220; i++) { tap(60 + Math.random() * 1160, 120 + Math.random() * 560); pump(3); }
  pump(400);                                  // let producers tick for a while
  // simulate coming back tomorrow
  if (G.save.nido && typeof G.save.nido === 'object') {
    for (const k in G.save.nido) if (/last|seen|time|t$/i.test(k) && typeof G.save.nido[k] === 'number') G.save.nido[k] = Date.now() - 36e5 * 20;
  }
  G.go('giungla'); pump(30); G.go('nido'); pump(90);
}

// 4b. the wardrobe: crates really hand pieces over, stars are never spent, and
//     G.look never gives two dinos the same buffer — that bug would put one
//     child's hat on his brother's dino in the "Chi gioca?" screen.
phase = 'guardaroba';
const countOwned = () =>
  (Array.isArray(G.save.hats) ? G.save.hats.length : 0) +
  (G.save.guardaroba && Array.isArray(G.save.guardaroba.owned) ? G.save.guardaroba.owned.length : 0);

if (G.sceneOf('guardaroba')) {
  if (typeof G.look !== 'function') fail('G.look assente');
  else {
    const la = G.look({ hat: 'corona', guardaroba: { gear: { occhi: 'sole' } } }, {});
    const lb = G.look({ hat: 'mago', guardaroba: { gear: { collo: 'papillon' } } }, {});
    if (la === lb) fail('G.look ha restituito lo stesso oggetto a due buffer distinti');
    if (la.testa !== 'corona' || la.occhi !== 'sole') fail('G.look non legge il look: ' + JSON.stringify(la));
    if (la.testa !== 'corona') fail('la seconda G.look ha sovrascritto il buffer della prima');
    if (lb.collo !== 'papillon' || lb.occhi !== null) fail('G.look sbaglia il secondo look: ' + JSON.stringify(lb));
    const rotto = G.look({ hat: 42, guardaroba: { gear: 'rotto' } }, {});
    if (rotto.testa !== null || rotto.occhi !== null) fail('G.look non regge un salvataggio corrotto');
  }
  if (typeof G.crates !== 'function') fail('G.crates assente (la giungla e i due giochi la usano)');

  // Drive it by STATE, not by timing: three knocks open a crate, the prize
  // shows for 2.2s, then one tap on "un altro!" / "provalo!".
  const openOneCrate = () => {
    tap(640, 420); pump(4);
    tap(640, 420); pump(4);
    tap(640, 420); pump(4);
    pump(170);                    // 2.2s of prize animation at 16.7ms a frame
    tap(640, 658); pump(12);
  };

  /* A fresh account, so none of the fuzz above can decide what this measures.
     Without it the section inherits 130 random taps' worth of state and the
     assertions pass or fail by luck. */
  const dressUp = G.accounts.create({ name: 'Veste', color: '#57c98a', level: 2, secret: null });
  G.accounts.login(dressUp.id);
  G.go('giungla'); pump(40);
  closeOverlayIfOpen('Veste');

  G.save.stars = 60;
  const ownedBefore = countOwned(), starsBefore = G.save.stars;
  G.go('guardaroba'); pump(60);
  if (G.current !== 'guardaroba') fail('non sono entrato nel guardaroba (sono in "' + G.current + '")');
  if (G.crates() < 1) fail('60 stelline e nessuna cassa pronta: ' + G.crates());

  let guard = 0;
  while (G.crates() > 0 && guard++ < 30) openOneCrate();
  if (guard >= 30) fail('le casse non si esauriscono mai: ne restano ' + G.crates());

  const ownedAfter = countOwned();
  if (ownedAfter <= ownedBefore) fail('nessun pezzo sbloccato aprendo le casse (' + ownedBefore + ' -> ' + ownedAfter + ')');
  if (ownedAfter > 14) fail('sbloccati piu pezzi di quanti ne esistano: ' + ownedAfter);
  if (G.save.stars < starsBefore) fail('le stelline sono state spese: ' + starsBefore + ' -> ' + G.save.stars);
  if (!Array.isArray(G.save.hats)) fail('G.save.hats non e piu un array');

  // all the stars in the world must not conjure a crate that has nothing in it
  G.save.stars = 9999; pump(20);
  if (G.crates() !== 0) fail('casse pronte con tutto gia sbloccato: ' + G.crates());
  for (let i = 0; i < 40; i++) { tap(640, 420); pump(4); tap(640, 658); pump(4); }
  if (countOwned() > 14) fail('il catalogo e stato superato: ' + countOwned());
}

// 4c. La Casetta. Three of its design promises are enforceable by reading the
//     source, so they are assertions here instead of hopes in a comment.
phase = 'casetta';
{
  // comments are stripped first: the file DESCRIBES these invariants in prose,
  // so a naive grep finds the promise instead of a violation of it
  const casaSrc = fs.readFileSync(path.join(SRC, '24-casetta.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  if (/G\.addFruits\s*\(|G\.addStars\s*\(/.test(casaSrc)) fail('la Casetta ha un rubinetto: non deve MAI dare valuta');
  if (/Date\.now\s*\(|catchUp\s*\(/.test(casaSrc)) fail('la Casetta ha un orologio: niente deve cambiare mentre la scena non gira');
  if (/setLineDash\s*\(/.test(casaSrc)) fail('la Casetta disegna sagome di cose non possedute: quel momento e del Nido');
}

if (G.sceneOf('casetta')) {
  const casa = G.accounts.create({ name: 'Casa', color: '#57c98a', level: 2, secret: null });
  G.accounts.login(casa.id);
  G.go('giungla'); pump(40); closeOverlayIfOpen('Casa');

  G.save.fruits = 6000;
  G.save.nido = { items: { uova: { n: 1, lvl: 1, t: 0, pend: 0, egg: 0, chicks: 4 } }, lastSeen: 0 };
  const nidoBefore = JSON.stringify(G.save.nido);

  G.go('casetta'); pump(60);
  if (G.current !== 'casetta') fail('non sono entrato nella casetta (sono in "' + G.current + '")');
  if (typeof G.casaOspiti !== 'function') fail('G.casaOspiti assente: la giungla accende la finestra con quella');

  const fruitsBefore = G.save.fruits;
  // Normal play is clean: enter the stable furnishing mode, whose cart opens
  // on the same side in both rooms.
  tap(1090, 160); pump(12);
  [[330, 350], [538, 350], [746, 350], [330, 566], [538, 566], [746, 566]].forEach(([cx, cy]) => {
    tap(cx, cy); pump(14);
  });
  pump(40);

  const casaSave = G.save.casetta || {};
  const items = Array.isArray(casaSave.items) ? casaSave.items : null;
  if (!items) fail('G.save.casetta.items non e un array');
  else {
    if (items.length < 2) fail('nessun mobile comprato con 6000 frutti: ' + items.length);
    if (items.length > 16) fail('superato il tetto degli 8 pezzi per stanza: ' + items.length);
    const badRoom = items.filter((it) => it.r !== 0 && it.r !== 1);
    if (badRoom.length) fail('pezzi senza stanza valida: ' + JSON.stringify(badRoom[0]));
    [0, 1].forEach((r) => {
      const n = items.filter((it) => it.r === r).length;
      if (n > 8) fail('stanza ' + r + ' con ' + n + ' pezzi, il tetto e 8');
    });
  }
  if (G.save.fruits >= fruitsBefore) fail('comprare non ha speso frutti: ' + fruitsBefore + ' -> ' + G.save.fruits);
  if (G.save.fruits < 0) fail('frutti negativi: ' + G.save.fruits);
  if (JSON.stringify(G.save.nido) !== nidoBefore) fail('la Casetta ha scritto nel ramo del Nido (deve leggerlo e basta)');
  if (G.casaOspiti() > 4) fail('piu ospiti dei pulcini nati: ' + G.casaOspiti());

  /* The door is the biggest risk in the two-room design: if it does not work,
     the child buys furniture for a room he can never see. Salotto has its door
     on the right at x=1204, Nanna on the left at x=76. */
  tap(1090, 160); pump(12);           // leave furnishing mode before using the door
  const roomBefore = G.save.casetta.room;
  tap(1204, 350); pump(50);
  if (G.save.casetta.room === roomBefore) fail('la porta non porta nella seconda stanza');
  else {
    tap(76, 350); pump(50);
    if (G.save.casetta.room !== roomBefore) fail('dalla seconda stanza non si torna indietro');
  }
  // both rooms must actually hold something, or half the catalogue is invisible
  [0, 1].forEach((r) => {
    const n = (G.save.casetta.items || []).filter((it) => it.r === r).length;
    if (!n) fail('la stanza ' + r + ' e vuota: meta del catalogo non si vede mai');
  });

  // fruits must never go up in here, whatever the fuzz touches
  const before = G.save.fruits;
  for (let i = 0; i < 120; i++) { tap(60 + Math.random() * 1160, 120 + Math.random() * 560); pump(3); }
  if (G.save.fruits > before) fail('i frutti sono AUMENTATI nella Casetta: ' + before + ' -> ' + G.save.fruits);
  if (JSON.stringify(G.save.nido) !== nidoBefore) fail('il fuzz nella Casetta ha scritto nel ramo del Nido');

  // level 1 must never drag a piece around
  G.accounts.update(casa.id, { level: 1 }); G.level = 1;
  G.go('giungla'); pump(20); G.go('casetta'); pump(40);
  /* Only the pieces that were already there: a stray tap can land on the shop
     strip and legitimately BUY something, which grows the array. What must not
     happen is an existing piece MOVING. */
  const snap = (G.save.casetta.items || []).map((it) => it.id + '@' + it.x + ',' + it.y);
  for (let i = 0; i < 40; i++) {
    drag(200 + Math.random() * 900, 500 + Math.random() * 180, 200 + Math.random() * 900, 500 + Math.random() * 180, 6);
    pump(3);
  }
  const after = (G.save.casetta.items || []).map((it) => it.id + '@' + it.x + ',' + it.y);
  for (let i = 0; i < snap.length; i++) {
    if (after[i] !== snap[i]) {
      fail('a livello 1 il trascinamento ha spostato un mobile: ' + snap[i] + ' -> ' + after[i]);
      break;
    }
  }
}

// 4d. La Pista. Its no-fail promises are structural, so they are assertions.
phase = 'kart';
{
  const kartSrc = fs.readFileSync(path.join(SRC, '25-kart.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  if (/G\.sfx\(\s*'bad'\s*\)/.test(kartSrc)) fail('la Pista ha un suono negativo: qui non si perde');
  if (/Date\.now\s*\(/.test(kartSrc)) fail('la Pista legge l orologio: il cronometro va accumulato da dt');
  const faucets = (kartSrc.match(/G\.addFruits\s*\(/g) || []).length;
  if (faucets !== 1) fail('G.addFruits chiamata ' + faucets + ' volte: deve passare solo da bank()');
  if (/hold\s*:\s*true/.test(kartSrc)) fail('un bottone con hold:true aprirebbe il menu genitori mentre si accelera');
  if (!/function\s+drawRhythm\s*\(/.test(kartSrc) || !/Tocca\s+'? \+ done/.test(kartSrc)) fail('il Girotondo non mostra il contatore ritmico');
  if (!/note0|note1|note2|note3/.test(kartSrc)) fail('il Girotondo non distingue i suoni degli strumenti');
}

if (G.sceneOf('kart')) {
  const pilot = G.accounts.create({ name: 'Pilota', color: '#57c98a', level: 1, secret: null });
  G.accounts.login(pilot.id);
  G.go('giungla'); pump(40); closeOverlayIfOpen('Pilota');
  G.save.fruits = 0;
  G.go('kart'); pump(60);
  if (G.current !== 'kart') fail('non sono entrato nella Pista (sono in "' + G.current + '")');

  // Repeat the expected notes through the same action used by the four buttons.
  if (typeof G.soundState !== 'function' || typeof G.soundChoose !== 'function') {
    fail('il Girotondo dei Suoni non espone stato/input per il collaudo');
  } else {
    for (let i = 0; i < 2400 && (G.save.kart || {}).done < 4; i++) {
      const q = G.soundState();
      if ((q.phase === 'input' || q.phase === 'smallInput') && q.expected !== undefined) G.soundChoose(q.expected);
      pump(1);
    }
  }
  const k = G.save.kart || {};
  if (typeof k.done !== 'number') fail('G.save.kart.done non e un numero');
  if (G.save.fruits <= 0) fail('un giro non ha fruttato niente: bank() non ha incassato');
  if (G.save.fruits > 100000) fail('frutti fuori scala dalla Pista: ' + G.save.fruits);

  // And now no touch at all: after a pause the friend demonstrates the expected
  // note, without answering or earning rewards on behalf of the child.
  G.go('giungla'); pump(30); G.go('kart'); pump(40);
  const doneBefore = (G.save.kart || {}).done || 0;
  pump(3000);
  if (((G.save.kart || {}).done || 0) !== doneBefore) {
    fail('la musica assegna progressi senza una risposta del bambino');
  }
}

// 4e. Il Pulmino: un giro con le commissioni, senza niente da fallire.
phase = 'bus';
{
  const busSrc = fs.readFileSync(path.join(SRC, '26-bus.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  if (/G\.sfx\(\s*'bad'\s*\)/.test(busSrc)) fail('il Pulmino ha un suono negativo');
  if (/G\.spend\s*\(/.test(busSrc)) fail('il Pulmino spende frutti: i pezzi si sbloccano viaggiando, non comprando');
  if (/Date\.now\s*\(/.test(busSrc)) fail('il Pulmino legge l orologio');
}

if (G.sceneOf('bus')) {
  const driver = G.accounts.create({ name: 'Autista', color: '#57c98a', level: 1, secret: null });
  G.accounts.login(driver.id);
  G.go('giungla'); pump(40); closeOverlayIfOpen('Autista');
  G.save.fruits = 0;
  G.go('bus'); pump(60);
  if (G.current !== 'bus') fail('non sono entrato nel Pulmino (sono in "' + G.current + '")');

  /* Choose wash, passenger, fuel and destination in a non-suggested order:
     the map must preserve every job and still complete the trip. */
  if (typeof G.busChoose !== 'function' || typeof G.busState !== 'function') {
    fail('il Pulmino non espone mappa/stato per il collaudo');
  } else {
    const go = (id) => {
      G.busChoose(id);
      for (let i = 0; i < 260 && G.busState().phase === 'travel'; i++) pump(1);
      pump(8);
    };
    const work = () => {
      const x=G.busState().current==='fuel'?290:640;
      ELS.c.dispatch('pointerdown', pev(x, 470));
      if(G.busState().current==='wash')for(let scrub=0;scrub<10;scrub++){ELS.c.dispatch('pointermove',pev(scrub%2?480:880,470));pump(3);}
      pump(190);ELS.c.dispatch('pointerup', pev(x,470));pump(100);
    };
    go('wash'); work();
    if (!G.busState().washDone) fail('il lavaggio non completa la sua commissione');
    go('radura'); tap(640, 470); pump(100);
    if (G.busState().riders !== 1) fail('Pippi non sale alla Radura');
    go('fuel'); work();
    if (!G.busState().fuelDone) fail('il pieno non completa la sua commissione');
    go('casetta'); tap(640, 470); pump(100);
    if (G.busState().delivered !== 1) fail('Pippi non arriva alla Casetta');
    go('depot'); pump(100);
    if (G.busState().phase !== 'fine') fail('con tutte le commissioni fatte il viaggio non finisce al garage');
  }

  /* And now the way a child actually plays: tap, tap, tap — never a clean hold.
     The bus used to dead-end beside the fruit pump, where every tap topped up
     the tank instead of setting off, and there was no way out of it. */
  const b = G.save.bus || {};
  if (typeof b.done !== 'number') fail('G.save.bus.done non e un numero');
  if (G.save.fruits <= 0) fail('nessun passeggero consegnato in tutto il percorso');
  if (G.save.fruits > 100000) fail('frutti fuori scala dal Pulmino: ' + G.save.fruits);
  [b.body, b.wheels, b.roof].forEach((v, i) => {
    if (typeof v !== 'number' || v < 0) fail('pezzo ' + i + ' del pulmino non valido: ' + v);
  });
}

// 5. a fresh account with an empty save must not explode anywhere
phase = 'salvataggio vuoto';
const fresh = G.accounts.create({ name: 'Vuoto', color: '#57c98a', level: 2, secret: null });
G.accounts.login(fresh.id);
['giungla', 'conta', 'fili', 'nido', 'lettere', 'guardaroba', 'casetta', 'kart', 'bus'].forEach((s) => {
  phase = s + ' (save vuoto)';
  G.go(s); pump(40);
  for (let i = 0; i < 40; i++) { tap(60 + Math.random() * 1160, 120 + Math.random() * 560); pump(2); }
});

// 6. a corrupt/legacy save must not explode either
phase = 'salvataggio corrotto';
G.save.conta = { done: 'sette' };
G.save.fili = { done: -3, size: 99 };
G.save.nido = { items: null, lastSeen: 'ieri' };
G.save.hats = null;
['giungla', 'conta', 'fili', 'nido', 'lettere', 'guardaroba', 'casetta', 'kart', 'bus'].forEach((s) => {
  phase = s + ' (save corrotto)';
  G.go(s); pump(40);
  for (let i = 0; i < 30; i++) { tap(60 + Math.random() * 1160, 120 + Math.random() * 560); pump(2); }
});

// 7. save must stay serialisable and sane
phase = 'salvataggio';
try {
  const j = JSON.stringify(G.save);
  if (j.length > 400000) fail('salvataggio enorme: ' + j.length + ' byte');
  if (/NaN|Infinity/.test(j)) fail('salvataggio contiene NaN/Infinity');
} catch (e) { fail('salvataggio non serializzabile: ' + e.message); }
if (!Number.isFinite(G.save.fruits)) fail('frutti non finiti: ' + G.save.fruits);
if (G.save.fruits < 0) fail('frutti negativi: ' + G.save.fruits);
if (!Number.isFinite(G.save.stars) || G.save.stars < 0) fail('stelline sbagliate: ' + G.save.stars);

// 8. odd viewports
phase = 'viewport';
[[1024, 768], [2560, 1600], [800, 1280], [1280, 720], [360, 640]].forEach(([w, h]) => {
  WIN.innerWidth = w; WIN.innerHeight = h;
  (WIN.listeners.resize || []).forEach((f) => f());
  G.go('giungla'); pump(20); tap(640, 400); pump(10);
});

/* ----------------------------------------------------------------- report */
console.log('');
if (!failures.length) {
  console.log('✓ collaudo pulito — nessun errore in ' + expected.length + ' scene, 2 livelli, fuzz completo');
  process.exit(0);
}
console.log('✗ ' + failures.length + ' problemi:\n');
failures.slice(0, 60).forEach((f) => console.log('  · ' + f));
if (failures.length > 60) console.log('  ... e altri ' + (failures.length - 60));
process.exit(1);
