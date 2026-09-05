/* Real Chrome checks for the sibling Dino games. node test/collection-browser.js */
'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),os=require('os'),assert=require('assert');
const {spawn}=require('child_process');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'collection-frames');
const chrome=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let child,ws,server;
async function main(){
  assert(chrome,'Chrome required');fs.mkdirSync(out,{recursive:true});
  server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}let f=file;if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');if(!fs.existsSync(f)){res.writeHead(404).end();return;}res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':f.endsWith('.svg')?'image/svg+xml':'application/octet-stream');res.end(fs.readFileSync(f));});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  child=spawn(chrome,['--headless=new','--remote-debugging-port=0','--user-data-dir='+fs.mkdtempSync(path.join(os.tmpdir(),'dino-collection-')),'--no-first-run','--hide-scrollbars','--window-size=1280,720','about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
  let endpoint='';child.stderr.on('data',b=>{const m=b.toString().match(/DevTools listening on (ws:\/\/\S+)/);if(m)endpoint=m[1];});
  for(let i=0;i<100&&!endpoint;i++)await delay(100);assert(endpoint,'Chrome startup timeout');
  const targets=await fetch('http://127.0.0.1:'+new URL(endpoint).port+'/json/list').then(r=>r.json());
  ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
  let seq=0;const pending=new Map(),errors=[];
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(p)m.error?p.reject(m.error):p.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);};
  const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  async function run(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;}
  async function shot(name){await delay(200);const s=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(s.data,'base64'));}
  async function tap(x,y){await call('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});await delay(30);await call('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});await delay(100);}
  async function swipe(x,y,dx,dy){await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});for(let i=1;i<=6;i++){await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*i/6,y:y+dy*i/6,id:1}]});await delay(20);}await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await delay(80);}
  await call('Runtime.enable');await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
  await call('Page.addScriptToEvaluateOnNewDocument',{source:`window.__scenes={};Object.defineProperty(window,'G',{configurable:true,get(){return this.__game;},set(g){this.__game=g;Object.defineProperty(g,'scene',{configurable:true,get(){return this.__register;},set(f){this.__register=function(n,s){window.__scenes[n]=s;return f(n,s);};}});}});`});
  for(const game of ['dino-kart','dino-officina','dino-stazione','dino-run']){
    await call('Page.navigate',{url:origin+'/'+game+'/'});for(let i=0;i<100;i++){await delay(50);if(await run("!!(window.G && G.current==='accesso')"))break;}
    await run(`G.accounts.create({name:'Leo',color:G.C.dino,level:1});G.accounts.create({name:'Teo',color:G.C.blueberry,level:2,secret:[3,4,6]});G.go('accesso')`);await shot(game+'-login');
    await run(`G.go('segreto',{id:G.accounts.list()[1].id})`);await delay(700);await shot(game+'-secret');
    await tap(765,223);await tap(765,223);await tap(765,223);assert.equal(await run('G.current'),'segreto','wrong secret accepted');
    await tap(765,387);await tap(929,387);await tap(765,551);await delay(700);assert.equal(await run('G.current'),'menu','secret did not unlock');
    await run("G.save.stars=17;G.saveNow();if(G.saveFlush)G.saveFlush()");
    await run(`(G.familyLogin||G.accounts.login)(G.accounts.list()[0].id);G.go('menu')`);await delay(700);
    assert.equal(await run('G.save.stars'),0,'sibling save leaked');
    if(game==='dino-kart'){
      await run("G.go('pista')");await delay(1900);await shot(game+'-race');
      const perf=await run(`new Promise(resolve=>{let times=[],last=performance.now();function frame(t){times.push(t-last);last=t;if(times.length<90)requestAnimationFrame(frame);else resolve({median:times.sort((a,b)=>a-b)[45],p95:times[85],canvas:[document.getElementById('c').width,document.getElementById('c').height]});}requestAnimationFrame(frame);})`);console.log(game,perf);
      await call('Emulation.setCPUThrottlingRate',{rate:4});
      const slow=await run(`new Promise(resolve=>{let times=[],last=performance.now();function frame(t){times.push(t-last);last=t;if(times.length<90)requestAnimationFrame(frame);else resolve({median:times.sort((a,b)=>a-b)[45],p95:times[85]});}requestAnimationFrame(frame);})`);console.log('kart CPU x4 (desktop simulation)',slow);await call('Emulation.setCPUThrottlingRate',{rate:1});
      await run("__scenes.pista.enter();__scenes.pista.update(4)");
      await call('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowLeft',code:'ArrowLeft'});await delay(100);assert((await run('G.kartState().x'))<0,'left arrow does not steer');
      await call('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowLeft',code:'ArrowLeft'});
      await call('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight'});await delay(100);
      const right=await run('G.kartState().x');await delay(100);assert((await run('G.kartState().x'))>right,'right arrow does not steer');
      await call('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight'});
      await run("for(let i=0;i<4000&&!G.kartState().ammo;i++){const s=G.kartState();__scenes.pista.onDown({x:s.x>0?200:1080,y:400,id:42});G.t+=1/60;__scenes.pista.update(1/60);}__scenes.pista.onUp({id:42});if(!G.kartState().ammo)throw Error('No item collected');");await call('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space'});await call('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space'});assert.equal(await run('G.kartState().ammo'),null,'space did not launch');
    }
    if(game==='dino-officina'){
      await run("G.go('officina',{id:'spazio-1'});G.officinaAutoBuild(false)");await shot(game+'-workbench');
      await run("G.officinaTest();for(let i=0;i<150;i++)__scenes.officina.update(1/60)");assert.equal(await run('G.officinaState().state'),'win');
    }
    if(game==='dino-stazione'){
      await run("G.go('stazione',{level:7})");await delay(700);await run('G.stationTapTrain()');await shot(game+'-switches');
      const result=await run(`(()=>{let levels=[];for(let level=1;level<=12;level++){__scenes.stazione.enter({level});for(let frame=0;frame<30000&&!G.stationState().fine;frame++){const s=G.stationState();s.occupied.forEach((t,i)=>{if(t&&t.ready)G.stationDepart(i);});s.actives.forEach(t=>{if(t.phase==='waiting')G.stationTapTrain(t.id);if(t.phase==='choose'||t.phase==='choose-route'){G.stationTapTrain(t.id);const state=G.stationState();if((t.target===0?0:1)!==state.switches[0])G.stationToggle(0);if(t.target>0&&t.target-1!==state.switches[1])G.stationToggle(1);G.stationLaunch();}});__scenes.stazione.update(1/60);}const s=G.stationState();levels.push({level,fine:s.fine,arrived:s.arrived,total:s.total});}return levels;})()`);
      assert(result.every(s=>s.fine&&s.arrived===s.total),JSON.stringify(result));console.log('stazione: all 12 levels solved through actual levers');
    }
    if(game==='dino-run'){
      await run("G.go('run')");await delay(700);await run('G.runStart()');await delay(3000);await shot(game+'-running');
      await run('__scenes.run.enter();G.runStart()');await swipe(640,420,-150,0);assert.equal(await run('G.runState().lane'),0);await swipe(640,420,150,0);assert.equal(await run('G.runState().lane'),1);await swipe(640,430,0,-120);assert((await run('G.runState().jump'))>0);await swipe(640,330,0,120);assert((await run('G.runState().duck'))>0);console.log('run: all four real touch swipes pass');
      const result=await run(`(()=>{__scenes.run.enter();G.runStart();let safe=true;for(let frame=0;frame<30000&&G.runState().phase!=='over';frame++){let s=G.runState();safe=safe&&s.rows.every(r=>r.cells.includes('fruit'));if(s.phase==='camp'){G.runCampChoice(s.target);continue;}const next=s.rows.find(r=>!r.hit);if(next){let lane=next.cells.findIndex(k=>k!=='fruit');G.runAction(lane<s.lane?'left':lane>s.lane?'right':'none');}__scenes.run.update(1/60);}const s=G.runState();return {safe,lives:s.lives,phase:s.phase,saved:G.save.run.runs};})()`);assert(result.safe&&result.lives===0&&result.phase==='over'&&result.saved>=1,JSON.stringify(result));
      await shot(game+'-retry');console.log('run: solvable rows, three hearts, game over and record saved');
      const camp=await run(`(()=>{__scenes.run.enter();G.runStart();for(let frame=0;frame<20000&&G.runState().phase==='run';frame++){let s=G.runState(),row=s.rows.find(r=>!r.hit);if(row){let lane=row.cells.indexOf('fruit');G.runAction(lane<s.lane?'left':lane>s.lane?'right':'none');}__scenes.run.update(1/60);}let s=G.runState(),wrong=G.runCampChoice((s.target+1)%3),stayed=G.runState().phase==='camp',correct=G.runCampChoice(s.target);G.runAction('pause');let before=G.runState().distance;__scenes.run.update(10);return {camp:s.phase,wrong,stayed,correct,paused:before===G.runState().distance};})()`);assert(camp.camp==='camp'&&!camp.wrong&&camp.stayed&&camp.correct&&camp.paused,JSON.stringify(camp));
      await call('Emulation.setDeviceMetricsOverride',{width:960,height:600,deviceScaleFactor:2,mobile:true});await run("G.runAction('pause')");await shot('dino-run-tablet');assert((await run('document.getElementById("c").width'))<=1440);await call('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
    }
    assert.equal(errors.length,0,game+': '+JSON.stringify(errors));console.log('PASS '+game);
  }
  await call('Page.navigate',{url:origin+'/dino-giungla/'});await delay(1800);
  await run("const child=G.accounts.create({name:'Collaudo',color:G.C.dino,level:1});G.accounts.login(child.id);G.go('kart')");await delay(2000);await shot('giungla-music-stage');
  const music=await run(`(()=>{let results=[];for(const age of [1,2]){G.level=age;__scenes.kart.enter();let before=G.save.kart.done;for(let i=0;i<1800;i++)__scenes.kart.update(1/60);let idle=G.save.kart.done===before&&G.soundState().index===0;for(let i=0;i<10000&&G.soundState().phase!=='festa';i++){let s=G.soundState();if(s.phase==='input'||s.phase==='smallInput')G.soundChoose(s.expected);__scenes.kart.update(1/60);}results.push({age,idle,party:G.soundState().phase==='festa',rounds:G.save.kart.done-before});}return results;})()`);assert(music.every(r=>r.idle&&r.party&&r.rounds===4),JSON.stringify(music));console.log('music: both ages require child input and complete four rounds');
  await run("G.level=2;G.go('bus')");await delay(3200);await shot('giungla-bus-map');
  async function busGo(id){await run(`G.busChoose('${id}');for(let i=0;i<600&&G.busState().phase==='travel';i++)__scenes.bus.update(1/60)`);await delay(100);}
  async function settleBus(){await run('for(let i=0;i<140;i++)__scenes.bus.update(1/60)');await delay(100);}
  await busGo('fuel');await shot('giungla-bus-pump');
  const tank=await run('G.busState().tank');await tap(1120,460);assert.equal(await run('G.busState().tank'),tank,'tapping sky refuels');
  await call('Input.dispatchMouseEvent',{type:'mousePressed',x:290,y:470,button:'left',clickCount:1});await run('for(let i=0;i<180;i++)__scenes.bus.update(1/60)');await call('Input.dispatchMouseEvent',{type:'mouseReleased',x:290,y:470,button:'left',clickCount:1});await settleBus();assert(await run('G.busState().fuelDone'));
  await busGo('wash');await shot('giungla-bus-wash');for(let i=0;i<12&&(await run("G.busState().phase==='activity'"));i++)await swipe(480,460,360,0);await settleBus();assert(await run('G.busState().washDone'));
  await busGo('nido');await tap(1070,310);await settleBus();await busGo('radura');await shot('giungla-bus-stop');await tap(1070,310);await settleBus();await busGo('casetta');await tap(1070,310);await settleBus();await busGo('depot');await settleBus();assert.equal(await run('G.busState().phase'),'fine');assert.equal(await run('G.busState().delivered'),2);console.log('bus: actual pump, wash swipes, doors and two-passenger journey pass');
  await run('navigator.serviceWorker.ready.then(()=>true)');await delay(500);
  const keys=await run('caches.keys()');for(const game of ['dino-giungla','dino-kart','dino-officina','dino-stazione','dino-run'])assert(keys.some(k=>k.startsWith(game+'-')),'missing offline cache '+game);
  await call('Network.enable');await call('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
  for(const game of ['dino-giungla','dino-kart','dino-officina','dino-stazione','dino-run']){
    await call('Page.navigate',{url:origin+'/'+game+'/'});await delay(1000);assert(['accesso','giungla','segreto'].includes(await run('G.current')),game+' failed offline');
  }
  console.log('PASS: all five games reopen offline after visiting the whole collection');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{if(ws)ws.close();if(child)child.kill();if(server)server.close();});
