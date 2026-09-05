'use strict';
const http=require('http'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../..');
const allowed=new Set(['dino-giungla','dino-kart','dino-officina','dino-stazione','dino-run']);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
http.createServer((req,res)=>{
  let rel;try{rel=decodeURIComponent(req.url.split('?')[0]);}catch{res.writeHead(400).end();return;}
  if(rel==='/')rel='/dino-giungla/collection.html';
  const parts=rel.split('/').filter(Boolean);
  if(!allowed.has(parts[0])||parts.some(p=>p.startsWith('.')||p==='server')){res.writeHead(404).end();return;}
  let file=path.resolve(root,'.'+rel);
  if(!file.startsWith(root+path.sep)){res.writeHead(404).end();return;}
  if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
  if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-cache');fs.createReadStream(file).pipe(res);
}).listen(8088,'0.0.0.0',()=>console.log('Dino giochi: http://localhost:8088'));
