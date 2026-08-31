#!/usr/bin/env node
'use strict';
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..');
const CHROME = process.platform === 'win32'
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : '/usr/bin/google-chrome';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'dino-lettere-look-'));

const server = http.createServer((req, res) => {
  const rel = req.url === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
  const file = path.resolve(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
async function main() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  const child = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + temp, '--no-first-run', '--disable-gpu', url], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
  let browserWs = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', chunk => { const m = chunk.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (m) browserWs = m[1]; });
  for (let i = 0; i < 80 && !browserWs; i++) await delay(100);
  if (!browserWs) throw new Error('Chrome non ha aperto DevTools');
  const port = new URL(browserWs).port;
  let targets = [];
  for (let i = 0; i < 40; i++) { targets = await fetch('http://127.0.0.1:' + port + '/json/list').then(r => r.json()); if (targets.some(t => t.type === 'page')) break; await delay(100); }
  const page = targets.find(t => t.type === 'page');
  if (!page) throw new Error('Nessuna pagina Chrome');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let seq = 0; const pending = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  function call(method, params) { return new Promise((resolve, reject) => { const id = ++seq; pending.set(id, m => m.error ? reject(new Error(m.error.message)) : resolve(m.result)); ws.send(JSON.stringify({ id, method, params: params || {} })); }); }
  await call('Page.enable'); await call('Runtime.enable'); await delay(700);
  const setup = await call('Runtime.evaluate', { expression: "(function(){var a=G.accounts.create({name:'Prova',color:G.C.berry,level:2});G.accounts.login(a.id);G.start('lettere');return G.current;})()", returnByValue: true });
  if (setup.exceptionDetails) throw new Error('Setup pagina fallito');
  await delay(1700);
  const shot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const dir = path.join(__dirname, 'frames'); fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'lettere-grande.png'); fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
  console.log('✓ fotogramma reale salvato in test/frames/lettere-grande.png');
  ws.close(); child.kill(); server.close();
  await Promise.race([new Promise(resolve => child.once('exit', resolve)), delay(2500)]);
  for (let i = 0; i < 8; i++) {
    try { fs.rmSync(temp, { recursive: true, force: true }); break; }
    catch (e) { if (i === 7) console.warn('profilo Chrome temporaneo ancora occupato: ' + temp); else await delay(250); }
  }
}
main().catch(err => { console.error('✗ ' + err.message); server.close(); try { fs.rmSync(temp, { recursive: true, force: true }); } catch (_) {} process.exit(1); });
