'use strict';
// Real Chrome: one installable collection, existing saves and all six games offline.
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const games = ['dino-giungla', 'dino-kart', 'dino-officina', 'dino-stazione', 'dino-run', 'dino-mario'];
const root = path.resolve(__dirname, '../..');
const published = process.argv.includes('--live');
const delay = ms => new Promise(r => setTimeout(r, ms));
let server, chrome, ws;
let blockedAsset = '/dino-mario/icon-maskable-512.png';
let updatingKart = false;
let missingCollectionScript = false;
let stalledCollectionScript = false;
async function main() {
  assert(fs.existsSync(path.join(root, 'dino-giungla/collection/index.html')), 'Missing installable collection entry');
  server = http.createServer((req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (missingCollectionScript && req.url === '/dino-giungla/collection/app.js') { res.writeHead(503).end('Script unavailable'); return; }
    if (stalledCollectionScript && req.url === '/dino-giungla/collection/app.js') {
      setTimeout(() => res.end(fs.readFileSync(path.join(root, 'dino-giungla/collection/app.js'))), 6500); return;
    }
    if (req.url === blockedAsset) { res.writeHead(503).end('Temporary download failure'); return; }
    let file = path.resolve(root, '.' + decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404).end(); return; }
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    if (updatingKart && req.url === '/dino-kart/sw.js') {
      res.end(fs.readFileSync(file, 'utf8').replace(/var CACHE = '[^']+'/, "var CACHE = 'dino-kart-update-test'")); return;
    }
    if (updatingKart && ['/dino-kart/', '/dino-kart/index.html'].includes(req.url)) {
      setTimeout(() => res.end(fs.readFileSync(file)), 1500); return;
    }
    res.end(fs.readFileSync(file));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origin = published ? 'https://leandronesi.github.io' : 'http://127.0.0.1:' + server.address().port;
  const binary = process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/usr/bin/google-chrome';
  chrome = spawn(binary, ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + fs.mkdtempSync(path.join(os.tmpdir(), 'dino-app-')), '--no-first-run', '--mute-audio', 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let endpoint;
  chrome.stderr.on('data', b => { const m = b.toString().match(/DevTools listening on (ws:\/\/\S+)/); if (m) endpoint = m[1]; });
  for (let i = 0; i < 100 && !endpoint; i++) await delay(100);
  assert(endpoint, 'Chrome startup timeout');
  const targets = await fetch('http://127.0.0.1:' + new URL(endpoint).port + '/json/list').then(r => r.json());
  ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  const pending = new Map(); let seq = 0;
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(m.error) : p.resolve(m.result); } };
  const call = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
  async function run(expression) { const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); assert(!r.exceptionDetails, JSON.stringify(r.exceptionDetails)); return r.result.value; }
  async function until(expression, label) { for (let i = 0; i < 200; i++) { if (await run(expression)) return; await delay(100); } assert.fail(label); }
  async function reloadPage() {
    const previous = await run('performance.timeOrigin');
    await call('Page.reload');
    await until(`performance.timeOrigin !== ${previous} && document.readyState === 'complete'`, 'Reload did not finish');
  }
  await call('Page.enable'); await call('Runtime.enable');
  await call('Page.addScriptToEvaluateOnNewDocument', { source: 'window.AudioContext=window.webkitAudioContext=undefined;try{speechSynthesis.speak=function(){};}catch(e){}' });
  // Reproduce a mobile browser that never delivers the native install event to the app.
  await call('Page.addScriptToEvaluateOnNewDocument', { source: "window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();e.stopImmediatePropagation();});" });
  await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  async function tapInstall() {
    await run("document.querySelector('#install-app').scrollIntoView({block:'center'})");
    const point = await run("(()=>{const r=document.querySelector('#install-app').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()");
    await call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await delay(400);
  }
  if (!published) {
    // A visible installation control must respond even before its script loads.
    missingCollectionScript = true;
    await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await call('Page.navigate', { url: origin + '/dino-giungla/collection/' });
    await until("document.readyState === 'complete'", 'Script failure page did not load');
    await tapInstall();
    assert(await run("document.querySelector('#install-help').getBoundingClientRect().height > 0"), 'Installation tap does nothing when app.js is unavailable');
    missingCollectionScript = false;
    await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  }
  // A profile created at the original game URL must be available inside the collection.
  await call('Page.navigate', { url: origin + '/dino-run/' });
  await until('!!window.G', 'Run failed to start');
  const account = await run("G.accounts.create({name:'Salvataggio esistente',color:G.C.dino,level:1}).id");
  await call('Page.navigate', { url: origin + '/dino-giungla/collection.html' });
  await until("location.pathname.endsWith('/collection/') && !!document.querySelector('#catalog')", 'Legacy collection did not open app');
  await until("document.readyState === 'complete'", 'Collection scripts did not finish loading');
  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  assert.equal(await run("document.querySelector('#install-app').hidden"), false, 'Install action disappeared without a native event');
  await tapInstall();
  assert(await run("document.querySelector('#install-help').getBoundingClientRect().height > 0"), 'Missing install event left a dead button');
  assert(await run("document.querySelector('#install-help-body').textContent.includes('schermata Home')"), 'Missing manual install instructions');
  await run("document.querySelector('#close-install-help').click()");
  assert.equal(await run("document.querySelector('#install-options').open"), false);
  await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  if (!published) {
    await until("document.querySelector('#offline-status').dataset.state === 'error'", 'Incomplete download was reported as ready');
    assert.equal(await run("document.querySelector('#retry-download').hidden"), false);
    blockedAsset = null;
    await run("document.querySelector('#retry-download').click()");
  }
  await until("document.querySelector('#offline-status').dataset.state === 'ready'", 'Retry did not finish the six downloads');
  if (!published) {
    // An in-flight replacement must not turn old cache contents into a false ready signal.
    updatingKart = true; blockedAsset = '/dino-kart/icon-maskable-512.png';
    await run("navigator.serviceWorker.getRegistration('/dino-kart/').then(r=>r.update())");
    await run("document.querySelector('#retry-download').click()");
    await until("document.querySelector('#offline-status').dataset.state !== 'loading'", 'Pending update never settled');
    assert.equal(await run("document.querySelector('#offline-status').dataset.state"), 'error', 'Pending update discarded offline files after false ready');
    blockedAsset = null;
    await run("document.querySelector('#retry-download').click()");
    await until("document.querySelector('#offline-status').dataset.state === 'ready'", 'Update retry did not repair offline files');
  }
  const manifest = await call('Page.getAppManifest');
  assert.deepEqual(manifest.errors, []);
  assert.equal(JSON.parse(manifest.data).name, 'Il mondo dei Dino');
  assert.equal(JSON.parse(manifest.data).scope, './');
  assert.deepEqual((await call('Page.getInstallabilityErrors')).installabilityErrors, []);
  assert.equal(await run("document.querySelectorAll('[data-game]').length"), 6);
  const keys = await run('caches.keys()');
  for (const game of games) assert(keys.some(k => k.startsWith(game + '-')), 'Missing cache: ' + game);
  async function open(game) {
    await run(`document.querySelector('[data-game="${game}"]').click()`);
    await until(`!!document.querySelector('#game-frame')?.contentWindow.G`, game + ' failed to open');
    assert.equal(await run('location.pathname'), '/dino-giungla/collection/');
    assert.equal(await run("document.querySelector('#game-frame').contentWindow.location.pathname"), '/' + game + '/');
  }
  async function home() { await run("document.querySelector('#back-to-games').click()"); await until("!document.querySelector('#game-frame') && !document.querySelector('#catalog').hidden", 'Home did not unload game'); }
  await open('dino-run');
  assert(await run(`document.querySelector('#game-frame').contentWindow.G.accounts.list().some(a => a.id === ${JSON.stringify(account)})`), 'Original account lost');
  await run(`(()=>{const g=document.querySelector('#game-frame').contentWindow.G;g.accounts.login(${JSON.stringify(account)});g.save.stars=37;g.saveNow();})()`);
  await home(); await open('dino-run');
  await run(`document.querySelector('#game-frame').contentWindow.G.accounts.login(${JSON.stringify(account)})`);
  assert.equal(await run('document.querySelector("#game-frame").contentWindow.G.save.stars'), 37, 'Back to collection lost pending save');
  await home();
  await call('Network.enable');
  await call('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await reloadPage();
  await until("document.querySelector('#offline-status')?.dataset.state === 'ready'", 'Collection failed to reload offline');
  for (const game of games) { await open(game); await home(); console.log('PASS offline ' + game); }
  await run('window.scrollTo(0,0)');
  const picture = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  fs.writeFileSync(path.join(os.tmpdir(), 'dino-collection-app.png'), Buffer.from(picture.data, 'base64'));
  await open('dino-run');
  await call('Emulation.setDeviceMetricsOverride', { width: 960, height: 600, deviceScaleFactor: 1.5, mobile: true });
  await delay(400);
  assert(await run("document.querySelector('#back-to-games').getBoundingClientRect().height >= 44"));
  const gamePicture = await call('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(os.tmpdir(), 'dino-collection-player.png'), Buffer.from(gamePicture.data, 'base64'));
  if (!published) {
    await home();
    // Reproduce the original cached handler: no native event means an immediate return.
    const staleScript = "window.staleInstallScript=true;document.getElementById('install-app').addEventListener('click',function(){return;});";
    async function seedStaleScript() {
      await run(`caches.keys().then(keys=>caches.open(keys.find(k=>k.startsWith('dino-collection-')))).then(c=>c.put(new URL('app.js',location.href),new Response(${JSON.stringify(staleScript)},{headers:{'Content-Type':'text/javascript'}})))`);
    }
    await seedStaleScript();
    await call('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await reloadPage();
    await until("document.querySelector('#offline-status')?.dataset.state === 'ready'", 'Online reload kept stale script');
    assert.equal(await run('!!window.staleInstallScript'), false, 'Online reload served obsolete installation code');
    await seedStaleScript();
    missingCollectionScript = true;
    await call('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
    await reloadPage();
    await until("document.readyState === 'complete'", 'Stale cached page did not load');
    assert.equal(await run('window.staleInstallScript'), true, 'Stale script fixture was not served');
    await tapInstall();
    assert.equal(await run("document.querySelector('#install-options').open"), true, 'Old cached handler blocked installation instructions');
    await run("document.querySelector('#close-install-help').click()");
    assert.equal(await run("document.querySelector('#install-options').open"), false, 'Close depends on the current app script');
    missingCollectionScript = false; stalledCollectionScript = true;
    await call('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    const launchStarted = Date.now();
    await reloadPage();
    await until("document.readyState === 'complete'", 'Stalled network blocked cached launch');
    assert(Date.now() - launchStarted < 5000, 'Cached launch waited for the stalled network');
    assert.equal(await run('window.staleInstallScript'), true, 'Timeout did not fall back to cached script');
    console.log('PASS real touch with missing script and obsolete cached install handler; online refresh repairs cache');
  }
  console.log('PASS ' + (published ? 'GitHub Pages' : 'local + interrupted download and retry') + ': single installable app, original account, pending save, offline reload and all six games. Screenshots: ' + os.tmpdir());
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => { if (ws) ws.close(); if (chrome) chrome.kill(); if (server) server.close(); });
