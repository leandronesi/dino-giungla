'use strict';
const vm=require('vm'),fs=require('fs'),path=require('path'),assert=require('assert');
async function main(){
  const games=['dino-giungla','dino-kart','dino-officina','dino-stazione','dino-run'];
  for(const game of games){
    const keys=games.map(g=>g+'-old').concat(game+'-__VERSION__','unrelated-site'),deleted=[],events={};
    let work;
    const sandbox={self:{addEventListener:(n,f)=>events[n]=f,clients:{claim:()=>Promise.resolve()}},caches:{keys:()=>Promise.resolve(keys),delete:k=>{deleted.push(k);return Promise.resolve(true);}},Promise,console};
    vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../..',game,'sw.template.js'),'utf8'),sandbox);
    events.activate({waitUntil:p=>work=p});await work;
    assert.deepEqual(deleted,[game+'-old'],game+' removed another application cache');
  }
  console.log('PASS: all five service workers preserve sibling and unrelated caches');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
