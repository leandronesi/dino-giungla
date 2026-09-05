/* Dino Giungla — Il Pulmino. A map of choices followed by tiny side activities.
   Owns G.save.bus. Nothing expires and the reserve always reaches the pump. */
(function () {
  'use strict';
  var C=G.C,W=G.W,H=G.H,ROAD=604,HUB={x:625,y:410};
  var PLACES={
    radura:{id:'radura',name:'la Radura',color:'#e8536b',glyph:'fruit'},
    casetta:{id:'casetta',name:'la Casetta',color:'#4d80e4',glyph:'house'},
    nido:{id:'nido',name:'il Nido',color:'#ff9f43',glyph:'egg'}
  };
  var CAST=[{name:'Pippi',color:'#ff6fae'},{name:'Bubu',color:'#4d80e4'}];
  function big(){return G.level===2;}
  function clampInt(v,a,b){v=Math.round(Number(v));return isFinite(v)?Math.max(a,Math.min(b,v)):a;}
  function br(){
    var g=G.save.bus;
    if(!g||typeof g!=='object'||Array.isArray(g))g=G.save.bus={};
    if(typeof g.done!=='number'||!isFinite(g.done)||g.done<0)g.done=0;
    if(typeof g.trips!=='number'||!isFinite(g.trips)||g.trips<0)g.trips=0;
    g.body=clampInt(g.body,0,(A.BUS_BODY||[0]).length-1);
    g.wheels=clampInt(g.wheels,0,(A.BUS_WHEEL||[0]).length-1);
    g.roof=clampInt(g.roof,0,(A.BUS_ROOF||[0]).length-1);
    return g;
  }
  function partsOpen(){return Math.min(5,1+Math.floor(br().trips/2));}

  var S={phase:'map',nodes:[],current:null,target:null,from:null,k:0,t:0,held:false,done:false,
    waiting:[],riders:[],delivered:0,goal:0,tank:.5,dirt:.72,fuel:false,wash:false,
    banked:0,spin:0,idle:0,hint:null,sayT:0,sayMsg:null,lastTouch:null,status:'',duration:1.8};
  function node(id){for(var i=0;i<S.nodes.length;i++)if(S.nodes[i].id===id)return S.nodes[i];return null;}
  function say(s,d){S.status=s;S.sayMsg=s;S.sayT=d===undefined?.1:Math.max(.01,d);}
  function build(){
    S.nodes=[
      {id:'depot',kind:'depot',name:'il Garage',x:160,y:570,color:C.tangerine},
      {id:'fuel',kind:'fuel',name:'la Benzina',x:310,y:300,color:C.sun},
      {id:'wash',kind:'wash',name:'il Lavaggio',x:650,y:560,color:C.water},
      {id:'radura',kind:'stop',place:PLACES.radura,x:900,y:300,color:PLACES.radura.color},
      {id:'casetta',kind:'stop',place:PLACES.casetta,x:1090,y:535,color:PLACES.casetta.color}
    ];
    if(big())S.nodes.push({id:'nido',kind:'stop',place:PLACES.nido,x:610,y:300,color:PLACES.nido.color});
    S.waiting=[{at:'radura',to:'casetta',name:CAST[0].name,color:CAST[0].color,hop:0}];
    if(big())S.waiting.push({at:'nido',to:'radura',name:CAST[1].name,color:CAST[1].color,hop:1.7});
    S.riders=[];S.goal=S.waiting.length;
  }
  function reset(){
    build();S.phase='map';S.current=node('depot');S.target=S.from=null;S.k=S.t=0;S.held=S.done=false;
    S.lastTouch=null;S.status='Scegli la prossima fermata';S.sayT=0;S.sayMsg=null;
    S.delivered=0;S.tank=big()?.43:.52;S.dirt=.72;S.fuel=S.wash=false;S.banked=S.spin=S.idle=0;S.hint=null;
  }
  function allDone(){return S.fuel&&S.wash&&S.delivered>=S.goal&&!S.waiting.length&&!S.riders.length;}
  function hint(){if(S.tank<.28&&!S.fuel)return'fuel';if(S.riders.length)return S.riders[0].to;
    if(S.waiting.length)return S.waiting[0].at;if(!S.fuel)return'fuel';if(!S.wash)return'wash';return'depot';}
  function choose(id){
    if(S.phase!=='map')return;var n=node(id);if(!n||n===S.current){if(n)G.fx.ring(n.x,n.y,C.cream,58);return;}
    S.from=S.current;S.target=n;S.k=0;S.duration=(Math.hypot(S.from.x-HUB.x,S.from.y-HUB.y)+Math.hypot(n.x-HUB.x,n.y-HUB.y))/310;S.phase='travel';S.idle=0;S.hint=null;G.sfx('whoosh');
  }
  function arrive(){
    S.current=S.target;S.target=null;S.phase='activity';S.t=0;S.done=S.held=false;
    if(S.current.kind==='fuel')say('Facciamo il pieno! Tocca la pompa.');
    else if(S.current.kind==='wash')say('Strofina il pulmino per lavare il fango.');
    else if(S.current.kind==='stop')say('Siamo a '+S.current.place.name+'. Tocca le porte del pulmino!');
    else if(allDone())finish();else say('Manca ancora una commissione!');
  }
  function back(){if(S.phase==='fine')return;S.lastTouch=null;S.phase='map';S.t=0;S.done=S.held=false;S.idle=0;
    say(allDone()?'Tutto fatto! Torniamo al garage!':'Dove andiamo adesso?',.15);}
  function reward(n){S.banked+=n;G.addFruits(n,640,300);}
  function serve(){
    if(S.done)return;var id=S.current.id,i,r,did=false;
    for(i=S.riders.length-1;i>=0;i--){r=S.riders[i];if(r.to!==id)continue;S.riders.splice(i,1);S.delivered++;did=true;
      reward(big()?9:6);G.sfx('good');G.fx.confetti();say(r.name+' e arrivato a '+S.current.place.name+'!',0);}
    for(i=S.waiting.length-1;i>=0;i--){r=S.waiting[i];if(r.at!==id)continue;S.waiting.splice(i,1);S.riders.push(r);did=true;
      G.sfx('pop');say(r.name+' vuole andare a '+node(r.to).place.name+'!',.35);}
    if(!did){G.sfx('pop');say('Qui e tutto a posto!',0);}S.done=true;S.t=.9;
  }
  function finish(){if(S.phase==='fine')return;var g=br();g.done++;g.trips++;G.saveNow();S.phase='fine';S.held=false;
    G.addStars(1,640,280);G.sfx('win');G.fx.confetti();say('Tutte le commissioni sono fatte!',.2);}
  G.busState=function(){return{phase:S.phase,current:S.current&&S.current.id,target:S.target&&S.target.id,tank:S.tank,dirt:S.dirt,
    fuelDone:S.fuel,washDone:S.wash,delivered:S.delivered,goal:S.goal,waiting:S.waiting.length,riders:S.riders.length,allDone:allDone(),travel:S.k,position:mapPosition(),status:S.status};};
  G.busChoose=choose;
  function mapPosition(){
    if(S.phase!=='travel')return{x:S.current?S.current.x:160,y:S.current?S.current.y:570};
    var first=Math.hypot(S.from.x-HUB.x,S.from.y-HUB.y),second=Math.hypot(S.target.x-HUB.x,S.target.y-HUB.y),distance=G.ease(S.k)*(first+second);
    var a=distance<first?S.from:HUB,b=distance<first?HUB:S.target,k=distance<first?distance/first:(distance-first)/second;
    return{x:G.lerp(a.x,b.x,k),y:G.lerp(a.y,b.y,k)};
  }


  G.scene('bus',{
    enter:function(){br();reset();if(!G.save.seen||typeof G.save.seen!=='object')G.save.seen={};var first=!G.save.seen.bus;
      G.save.seen.bus=true;G.saveNow();setTimeout(function(){if(G.current==='bus')G.say(first?
        'Scegli sulla mappa: facciamo benzina, laviamo il pulmino e accompagniamo gli amici!':'Dove andiamo per prima cosa?');},420);},
    exit:function(){S.held=false;S.lastTouch=null;S.sayMsg=null;G.hush();},
    update:function(dt){
      var i;if(S.sayT>0){S.sayT-=dt;if(S.sayT<=0&&S.sayMsg){G.say(S.sayMsg);S.sayMsg=null;}}
      for(i=0;i<S.waiting.length;i++)S.waiting[i].hop+=dt;S.spin+=dt*(S.phase==='travel'?13:1.5);
      if(S.phase==='map'){S.idle+=dt;if(S.idle>(big()?10:7)){S.hint=hint();S.idle=0;if(!big())say('Tocca il posto che brilla!',0);}return;}
      if(S.phase==='travel'){S.k=Math.min(1,S.k+dt/Math.max(1.2,S.duration));if(S.k>=1){var dx=S.target.x-S.from.x,dy=S.target.y-S.from.y;
        S.tank=Math.max(.06,S.tank-(.10+Math.hypot(dx,dy)/2600));S.dirt=Math.min(1,S.dirt+.10);arrive();}return;}
      if(S.phase!=='activity')return;if(!G.pointer||!G.pointer.down)S.held=false;S.t+=dt;
      if(S.current.kind==='fuel'&&S.held&&!S.done)S.tank=Math.min(1,S.tank+dt*.65);
      if(S.current.kind==='wash'&&S.held&&!S.done)S.dirt=Math.max(0,S.dirt-dt*.3);
      if(!S.done&&S.current.kind==='fuel'&&S.tank>=.995){S.tank=1;S.fuel=S.done=true;S.t=.95;G.sfx('coin');G.fx.confetti();say('Pieno di frutta!',0);}
      if(!S.done&&S.current.kind==='wash'&&S.dirt<=.02){S.dirt=0;S.wash=S.done=true;S.t=.95;G.sfx('chime');G.fx.confetti();say('Che pulito!',0);}
      if(S.done){S.t-=dt*2;if(S.t<=0)back();}else if(S.current.kind==='depot'&&S.t>1.1)back();
    },
    onDown:function(p){
      if(S.phase!=='activity'||S.done)return;
      if(S.current.kind==='fuel'&&p.x>=140&&p.x<=430&&p.y>=290&&p.y<=620){S.held=true;S.tank=Math.min(1,S.tank+.16);G.sfx('pop');}
      else if(S.current.kind==='stop'&&p.x>=460&&p.x<=960&&p.y>=300&&p.y<=620){serve();}
      else if(S.current.kind==='wash'&&p.x>=400&&p.x<=960&&p.y>=300&&p.y<=620){S.held=true;S.lastTouch=p;S.dirt=Math.max(0,S.dirt-.12);G.sfx('pop');}
    },
    onMove:function(p){if(S.phase==='activity'&&S.current.kind==='wash'&&S.held&&S.lastTouch){
      if(p.x>=400&&p.x<=960&&p.y>=300&&p.y<=620){var distance=Math.hypot(p.x-S.lastTouch.x,p.y-S.lastTouch.y);S.dirt=Math.max(0,S.dirt-Math.min(distance,100)/1500);if(distance>12)G.fx.burst(p.x,p.y,{color:C.cream,count:2,speed:70,life:.35,size:8});}S.lastTouch=p;
    }},
    onUp:function(){S.held=false;S.lastTouch=null;},
    draw:function(c){if(S.phase==='map'||S.phase==='travel'||S.phase==='garage')drawMap(c);else drawActivity(c);if(S.phase==='fine')drawEnd(c);if(S.phase==='garage')drawGarage(c);}
  });

  function glyph(c,n,x,y,r){
    c.save();c.lineCap='round';c.lineJoin='round';
    if(n.kind==='fuel'){
      c.fillStyle=C.cream;c.strokeStyle=C.ink;c.lineWidth=Math.max(3,r*.09);
      G.roundRect(c,x-r*.40,y-r*.46,r*.62,r*.92,r*.10);c.fill();c.stroke();
      c.fillStyle=C.sun;G.roundRect(c,x-r*.29,y-r*.32,r*.40,r*.28,r*.05);c.fill();
      c.beginPath();c.moveTo(x+r*.22,y-r*.25);c.quadraticCurveTo(x+r*.58,y-r*.12,x+r*.48,y+r*.30);c.stroke();
      if(A.fruit)A.fruit(c,x-r*.09,y+r*.20,r*.18,'fragola');
    }
    else if(n.kind==='wash'){c.fillStyle='#e0f6ff';c.strokeStyle='#2587a1';c.lineWidth=3;[[-.3,-.06,.27],[.1,-.28,.22],[.3,.15,.18],[-.05,.27,.16]].forEach(function(b){c.beginPath();c.arc(x+b[0]*r,y+b[1]*r,b[2]*r,0,7);c.fill();c.stroke();});}
    else if(n.kind==='depot'){c.strokeStyle=C.cream;c.lineWidth=r*.15;c.beginPath();c.moveTo(x-r*.52,y);c.lineTo(x,y-r*.46);c.lineTo(x+r*.52,y);c.moveTo(x-r*.37,y);c.lineTo(x-r*.37,y+r*.45);c.lineTo(x+r*.37,y+r*.45);c.lineTo(x+r*.37,y);c.stroke();}
    else if(n.place.glyph==='fruit'&&A.fruit)A.fruit(c,x,y,r*.52,'fragola');
    else if(n.place.glyph==='egg'&&A.egg)A.egg(c,x,y,r*.82,{color:C.cream});
    else{c.fillStyle=C.cream;c.strokeStyle=C.ink;c.lineWidth=4;c.beginPath();c.moveTo(x-r*.5,y);c.lineTo(x,y-r*.48);c.lineTo(x+r*.5,y);c.lineTo(x+r*.36,y+r*.43);c.lineTo(x-r*.36,y+r*.43);c.closePath();c.fill();c.stroke();}c.restore();
  }
  function tick(c,x,y,r){c.save();c.strokeStyle='#fff';c.lineWidth=Math.max(4,r*.3);c.lineCap='round';c.lineJoin='round';c.beginPath();c.moveTo(x-r*.5,y);c.lineTo(x-r*.1,y+r*.45);c.lineTo(x+r*.55,y-r*.45);c.stroke();c.restore();}
  function miniBus(c,x,y,s){var g=br(),col=(A.BUS_BODY&&A.BUS_BODY[g.body])||C.tangerine;c.save();c.translate(x,y);c.scale(s,s);c.fillStyle='rgba(43,29,18,.22)';c.beginPath();c.ellipse(0,25,55,20,0,0,7);c.fill();c.fillStyle=col;c.strokeStyle=C.ink;c.lineWidth=5;G.roundRect(c,-55,-32,110,66,20);c.fill();c.stroke();c.fillStyle='#dff6ff';G.roundRect(c,-35,-22,70,28,9);c.fill();c.fillStyle=C.barkDark;c.beginPath();c.arc(-34,34,14,0,7);c.arc(34,34,14,0,7);c.fill();c.restore();}
  function objectives(c){var a=[{d:S.fuel,n:node('fuel')},{d:S.wash,n:node('wash')},{d:S.delivered>=S.goal,n:{kind:'stop',place:PLACES.casetta}}];for(var i=0;i<a.length;i++){var x=850+i*142,y=156;c.fillStyle=a[i].d?'rgba(56,217,169,.92)':'rgba(255,246,224,.92)';c.beginPath();c.arc(x,y,38,0,7);c.fill();glyph(c,a[i].n,x,y,46);if(a[i].d)tick(c,x+28,y-25,15);}}
  function drawNode(c,n){var wait=S.waiting.filter(function(r){return r.at===n.id;}),arr=S.riders.filter(function(r){return r.to===n.id;});var done=n.kind==='fuel'&&S.fuel||n.kind==='wash'&&S.wash;var glow=S.hint===n.id||allDone()&&n.kind==='depot';if(glow){c.save();c.globalAlpha=.3+Math.sin(G.t*5)*.18;c.fillStyle=C.sun;c.beginPath();c.arc(n.x,n.y,78,0,7);c.fill();c.restore();}G.ui.round({id:'map-'+n.id,x:n.x,y:n.y,r:55,color:done?C.leaf:n.color,icon:function(cc,x,y,r){glyph(cc,n,x,y,r);},onTap:function(){choose(n.id);}});if(done)tick(c,n.x+42,n.y-42,18);if(wait.length&&A.chick)A.chick(c,n.x+68,n.y+58+Math.sin(wait[0].hop*5)*5,72,{t:G.t,color:wait[0].color});if(wait.length){var wanted=node(wait[0].to);c.fillStyle=C.cream;G.roundRect(c,n.x-70,n.y-109,140,45,18);c.fill();glyph(c,wanted,n.x,n.y-87,35);}
    G.text(n.name||n.place.name,n.x,n.y+83,{size:21,color:C.ink});
    if(arr.length){c.fillStyle=arr[0].color;c.beginPath();c.arc(n.x-58,n.y-48,19,0,7);c.fill();c.strokeStyle=C.cream;c.lineWidth=4;c.stroke();}}
  function drawMap(c){
    if(A.jungle)A.jungle(c,G.t,{dim:.16});else{c.fillStyle=C.sky;c.fillRect(0,0,W,H);}c.fillStyle='rgba(255,246,224,.88)';G.roundRect(c,38,112,W-76,574,42);c.fill();c.fillStyle='#a8d481';G.roundRect(c,58,132,W-116,534,32);c.fill();
    var hub=HUB,i,n;c.save();c.strokeStyle='#d3b47c';c.lineWidth=34;c.lineCap='round';for(i=0;i<S.nodes.length;i++){n=S.nodes[i];c.beginPath();c.moveTo(hub.x,hub.y);c.lineTo(n.x,n.y);c.stroke();}c.strokeStyle='rgba(255,246,224,.72)';c.lineWidth=5;c.setLineDash([18,18]);for(i=0;i<S.nodes.length;i++){n=S.nodes[i];c.beginPath();c.moveTo(hub.x,hub.y);c.lineTo(n.x,n.y);c.stroke();}c.setLineDash([]);c.restore();objectives(c);for(i=0;i<S.nodes.length;i++)drawNode(c,S.nodes[i]);
    var position=mapPosition();miniBus(c,position.x,position.y-6,.85);
    if(S.riders.length){c.fillStyle=C.cream;G.roundRect(c,380,594,500,64,22);c.fill();G.text(S.riders[0].name+' ? '+node(S.riders[0].to).place.name,630,626,{size:25,color:C.ink});}
    G.text('Dove andiamo?',180,153,{size:28,color:C.leafDark});
    gauge(c,85,200,165,24,S.tank,C.sun);
    if(S.phase==='map')G.ui.round({id:'busgarage',x:W-60,y:H-60,r:48,color:C.tangerine,icon:function(cc,x,y,r){glyph(cc,node('depot'),x,y,r);},onTap:function(){S.phase='garage';G.sfx('pop');}});
  }
  function gauge(c,x,y,w,h,k,col){c.fillStyle='rgba(43,29,18,.28)';G.roundRect(c,x,y,w,h,h/2);c.fill();c.fillStyle=col;G.roundRect(c,x+5,y+5,Math.max(1,(w-10)*G.clamp(k,0,1)),h-10,(h-10)/2);c.fill();}
  function drawActivity(c){
    if(A.jungle)A.jungle(c,G.t,{dim:.1});else{c.fillStyle=C.sky;c.fillRect(0,0,W,H);}c.fillStyle='#8fbf63';c.fillRect(0,ROAD-10,W,H-ROAD+10);c.fillStyle='#b39a72';c.fillRect(0,ROAD,W,104);c.fillStyle='rgba(255,246,224,.72)';for(var i=0;i<12;i++)c.fillRect(i*120,ROAD+48,62,9);
    var g=br(),bx=690;if(S.current.kind==='fuel'&&A.pump)A.pump(c,300,ROAD,220,{level:S.tank});if(S.current.kind==='wash'&&A.wash)A.wash(c,690,ROAD,570,{on:S.held||S.done});if(S.current.kind==='stop'){if(A.busStop)A.busStop(c,930,ROAD,190,{here:true,icon:function(cc,x,y,r){glyph(cc,S.current,x,y,r*1.35);}});var list=S.waiting.filter(function(r){return r.at===S.current.id;});if(list.length&&A.chick)A.chick(c,1040,ROAD-8,92,{t:G.t,color:list[0].color});}
    A.bus(c,bx,ROAD,420,{body:g.body,wheels:g.wheels,roof:g.roof,spin:S.spin,dirt:S.dirt,doorOpen:S.current.kind==='stop',riders:S.riders,driverColor:(G.account&&G.account.color)||C.dino});
    c.fillStyle='rgba(255,246,224,.94)';G.roundRect(c,240,112,800,100,26);c.fill();G.text(S.status,640,161,{size:28,color:C.ink,maxWidth:750});
    if(S.phase==='activity')G.ui.button({id:'bus-map',x:26,y:116,w:194,h:96,r:24,color:C.water,label:'Mappa',fontSize:29,onTap:back});
    if(S.done)return;
    if(S.current.kind==='stop'){var destination=S.riders.length?node(S.riders[0].to):null;if(destination){c.fillStyle=C.cream;G.roundRect(c,420,234,400,76,24);c.fill();glyph(c,destination,462,272,40);G.text(destination.place.name,632,272,{size:28,color:C.ink});}
      G.ui.button({id:'bus-doors',x:920,y:260,w:300,h:104,r:28,color:C.leaf,label:'Apri le porte',fontSize:28,onTap:serve});}
    c.save();c.globalAlpha=.6+Math.sin(G.t*5)*.25;c.fillStyle='rgba(255,246,224,.92)';c.beginPath();c.arc(640,255,38,0,7);c.fill();c.restore();if(S.current.kind==='fuel'){if(A.fruit)A.fruit(c,640,255,26,'fragola');gauge(c,780,234,260,42,S.tank,C.sun);}else if(S.current.kind==='wash'){glyph(c,node('wash'),640,255,45);gauge(c,780,234,260,42,1-S.dirt,C.water);}else if(S.current.kind==='stop'){c.fillStyle=C.leaf;c.beginPath();c.moveTo(610,220);c.lineTo(670,235);c.lineTo(610,250);c.closePath();c.fill();}
  }
  function drawGarage(c){var g=br(),open=partsOpen(),i;c.save();c.fillStyle='rgba(9,32,21,.62)';c.fillRect(0,0,W,H);c.restore();A.panel(c,120,118,1040,530,{r:34});G.text('Il tuo pulmino',640,172,{ctx:c,size:44,color:C.ink});A.bus(c,640,360,205,{body:g.body,wheels:g.wheels,roof:g.roof,spin:G.t*2});for(i=0;i<A.BUS_BODY.length;i++)choice('body',i,190+i*122,430,open,g);for(i=0;i<A.BUS_WHEEL.length;i++)choice('wheels',i,190+i*122,548,open,g);for(i=0;i<A.BUS_ROOF.length;i++)choice('roof',i,700+i*122,548,open,g);G.ui.button({id:'busclose',x:920,y:424,w:210,h:108,r:26,label:'Mappa',color:C.leaf,fontSize:34,onTap:function(){S.phase='map';}});}
  function choice(key,idx,x,y,open,g){var ok=idx<open;G.ui.button({id:'bus-'+key+idx,x:x,y:y,w:108,h:100,r:22,color:ok?(key==='body'?A.BUS_BODY[idx]:C.cream):'#a49889',icon:function(c,cx,cy){if(!ok){c.fillStyle='rgba(255,246,224,.7)';G.roundRect(c,cx-18,cy-8,36,32,7);c.fill();return;}if(key!=='body'){var o={body:g.body,wheels:g.wheels,roof:g.roof};o[key]=idx;A.bus(c,cx,cy+25,72,o);}if(g[key]===idx)tick(c,cx+30,cy-26,17);},onTap:function(){if(!ok){G.say('Fai ancora un viaggio!');return;}g[key]=idx;G.saveNow();G.sfx('chime');}});}
  function drawEnd(c){c.save();c.fillStyle='rgba(9,32,21,.52)';c.fillRect(0,0,W,H);c.restore();A.panel(c,300,180,680,370,{r:34});G.text('Tutto fatto!',640,258,{ctx:c,size:58,color:C.ink});if(A.fruit)A.fruit(c,505,346,30,'fragola');G.text('+'+S.banked,555,350,{ctx:c,size:46,color:C.ink,align:'left'});if(G.starIcon)G.starIcon(c,720,346,28);G.text('+1',758,350,{ctx:c,size:46,color:C.ink,align:'left'});G.ui.button({id:'busagain',x:350,y:414,w:280,h:104,r:28,color:C.leaf,label:'Ancora!',fontSize:38,onTap:reset});G.ui.button({id:'busleave',x:660,y:414,w:280,h:104,r:28,color:C.tangerine,label:'Giungla',fontSize:34,onTap:G.home});}
})();
