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

const expected = ['accesso', 'nuovo', 'segreto', 'gate', 'genitori', 'giungla', 'conta', 'fili', 'nido'];
const missing = expected.filter((s) => !G.sceneOf(s));
if (missing.length) fail('scene mancanti: ' + missing.join(', '));

if (!sandbox.A) fail('namespace A (grafica) assente');
else {
  const need = ['dino', 'jungle', 'canopy', 'fruit', 'egg', 'chick', 'bush', 'tree', 'flower', 'rock', 'cloud', 'panel', 'sign', 'star', 'hat', 'HATS', 'SHAPES'];
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
const scenes = ['giungla', 'conta', 'fili', 'nido', 'genitori', 'gate', 'accesso'];
[1, 2].forEach((lvl) => {
  if (!G.account) return;
  G.accounts.update(G.account.id, { level: lvl });
  G.level = lvl;
  scenes.forEach((s) => {
    phase = s + ' L' + lvl;
    G.go(s, s === 'gate' ? { then: 'giungla', back: 'giungla' } : null);
    pump(30);
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

// 5. a fresh account with an empty save must not explode anywhere
phase = 'salvataggio vuoto';
const fresh = G.accounts.create({ name: 'Vuoto', color: '#57c98a', level: 2, secret: null });
G.accounts.login(fresh.id);
['giungla', 'conta', 'fili', 'nido'].forEach((s) => {
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
['giungla', 'conta', 'fili', 'nido'].forEach((s) => {
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
