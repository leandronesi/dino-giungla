/* Dino Giungla — "Il Pulmino" (scene: bus). Owns G.save.bus.

   A ride with errands, not a race: you drive a little bus along a road, stop to
   pick friends up, take them where they want to go, and do small jobs on the way
   — fill up with fruit, go through the wash, open the gate.

   WHY IT IS A SIDE VIEW, and it is not a style preference: A.dino is drawn in
   profile, anchored at the feet, with facing 1 or -1. A side-scrolling bus is
   the one camera in which a driving dino costs nothing. The top-down ring next
   door had the opposite problem.

   AND WHY IT DOES NOT FIGHT THE CONTRACT the way a racer did: a bus that picks
   passengers up has no position, no last place, no clock running out. Rule 3 is
   not something to work around here, it is satisfied by the shape of the thing.
   Nothing here can be failed:
     - The bus never runs out of anything. The fruit tank empties, and an empty
       tank makes the passengers wave for a top-up — it never stops the bus.
     - The gate always opens; it just waits for a tap.
     - Nobody is ever left behind: a passenger who is not picked up stays exactly
       where he is, for ever, with no timer and no complaint.
     - There is no wrong stop. Dropping someone at the wrong place simply does
       not trigger the drop-off, and nothing says so.

   Level 1: three stops, everybody wants the NEXT one, so the answer is always
   "keep going". Level 2: six stops, everyone wants a specific place shown by its
   symbol, and the road is longer. */
(function () {
  'use strict';

  var C = G.C, W = G.W, H = G.H;

  var ROAD_Y = 596;            // where the wheels touch
  var SKY_TOP = 96;
  var BUS_X = 400;             // the bus stays here; the world scrolls
  var BUS_S = 190;

  /* The stops carry the symbols of the places that already exist, so a child who
     cannot read still knows where he is being asked to go. */
  var PLACES = [
    { id: 'radura', name: 'la Radura', color: '#e8536b' },
    { id: 'fili', name: 'i Fili', color: '#8f5bd6' },
    { id: 'nido', name: 'il Nido', color: '#ff9f43' },
    { id: 'casetta', name: 'la Casetta', color: '#4d80e4' },
    { id: 'guardaroba', name: 'il Guardaroba', color: '#38d9a9' },
    { id: 'girotondo', name: 'il Girotondo', color: '#ff6fae' }
  ];

  var CAST = [
    { name: 'Pippi', color: '#ff6fae' },
    { name: 'Bubu', color: '#4d80e4' },
    { name: 'Momo', color: '#ffd75e' },
    { name: 'Nina', color: '#38d9a9' },
    { name: 'Rufo', color: '#ff9f43' },
    { name: 'Lulu', color: '#8f5bd6' }
  ];

  function big() { return G.level === 2; }
  function nStops() { return big() ? 6 : 3; }
  function roadLen() { return 900 + nStops() * (big() ? 900 : 800); }
  function speedMax() { return big() ? 330 : 260; }

  /* ------------------------------------------------------------ save branch */
  function br() {
    var g = G.save.bus;
    if (!g || typeof g !== 'object' || Array.isArray(g)) g = G.save.bus = {};
    if (typeof g.done !== 'number' || !isFinite(g.done) || g.done < 0) g.done = 0;
    if (typeof g.trips !== 'number' || !isFinite(g.trips) || g.trips < 0) g.trips = 0;
    g.body = clampInt(g.body, 0, (A.BUS_BODY || [0]).length - 1);
    g.wheels = clampInt(g.wheels, 0, (A.BUS_WHEEL || [0]).length - 1);
    g.roof = clampInt(g.roof, 0, (A.BUS_ROOF || [0]).length - 1);
    return g;
  }
  function clampInt(v, a, b) {
    v = Math.round(Number(v));
    return isFinite(v) ? Math.max(a, Math.min(b, v)) : a;
  }
  /* Parts unlock by TRIPS, never by price: this scene has no shop and takes no
     fruit. Something you earn by playing cannot be refused. */
  function partsOpen() { return 1 + Math.floor(br().trips / 2); }

  /* ---------------------------------------------------------------- state */
  var S = {
    phase: 'guida',       // 'guida' | 'garage' | 'fine'
    x: 0, spd: 0, held: false, gasLatch: 0, spin: 0,
    stops: [], jobs: [], riders: [], waiting: [],
    dirt: 0, tank: 1,
    doorT: 0, atStop: -1,
    delivered: 0, banked: 0,
    sayT: 0, sayMsg: null, idle: 0, nudges: 0, stuck: 0,
    tilt: 0
  };

  function say(msg, delay) { S.sayMsg = msg; S.sayT = delay === undefined ? 0.1 : delay; }

  function build() {
    var i, k, g = br();
    S.stops.length = 0; S.jobs.length = 0;
    S.riders.length = 0; S.waiting.length = 0;
    var n = nStops(), gap = (roadLen() - 700) / n;
    for (i = 0; i < n; i++) {
      S.stops.push({ x: 560 + i * gap, place: PLACES[i % PLACES.length], i: i });
    }
    /* Passengers wait at every stop but the last one. At level 1 everybody wants
       the NEXT stop, so the answer to "where do I go" is always "keep going". */
    for (i = 0; i < n - 1; i++) {
      k = CAST[i % CAST.length];
      S.waiting.push({
        at: i, to: big() ? (i + 1 + G.rndi(0, n - i - 2)) : (i + 1),
        name: k.name, color: k.color, hop: 0
      });
    }
    S.jobs.push({ kind: 'pump', x: 560 + gap * 0.45, done: 0 });
    S.jobs.push({ kind: 'wash', x: 560 + gap * (n > 2 ? 1.5 : 1.2), done: 0 });
    S.jobs.push({ kind: 'gate', x: 560 + gap * (n > 3 ? 2.5 : 2.1), open: 0 });
    void g;
  }

  function reset() {
    S.phase = 'guida';
    S.x = 0; S.spd = 0; S.held = false; S.gasLatch = 0; S.spin = 0;
    S.dirt = 0; S.tank = 1; S.doorT = 0; S.atStop = -1;
    S.delivered = 0; S.banked = 0; S.idle = 0; S.nudges = 0; S.tilt = 0; S.stuck = 0;
    S.sayMsg = null; S.sayT = 0;
    build();
  }

  /* The only place fruit is handed out. Rewards are for DELIVERING, so the loop
     the child is taught is "take your friend where he wants to go". */
  function reward(n, x, y) {
    if (n <= 0) return;
    S.banked += n;
    G.addFruits(n, x, y);
  }

  /* ================================================================ SCENE */
  G.scene('bus', {
    enter: function () {
      br();
      reset();
      if (!G.save.seen) G.save.seen = {};
      var first = !G.save.seen.bus;
      G.save.seen.bus = true;
      G.saveNow();
      setTimeout(function () {
        if (G.current !== 'bus') return;
        G.say(first
          ? 'Questo e il tuo pulmino! Tieni premuto per andare, e fermati alle fermate.'
          : G.pick(['Si parte!', 'Chi accompagniamo oggi?', 'Tutti a bordo!']));
      }, 420);
    },

    exit: function () { S.held = false; },

    update: function (dt) {
      var i, j, st, r;
      if (S.sayT > 0) {
        S.sayT -= dt;
        if (S.sayT <= 0 && S.sayMsg) { G.say(S.sayMsg); S.sayMsg = null; }
      }
      if (S.phase !== 'guida') return;

      /* Safety net: window.blur zeroes pointer.down without calling onUp. */
      if (!G.pointer || !G.pointer.down) S.held = false;

      /* THE GAS LATCHES, and this is not a nicety. A three-year-old taps, he
         does not hold: one tap keeps the finger down for a single frame, and
         over the eight released frames that follow, braking at 520/s eats the
         whole 340/s of acceleration — so tapping moved the bus exactly nowhere.
         One tap is now worth 0.9s of throttle, so hammering, holding, and
         anything in between all drive. */
      S.gasLatch = Math.max(0, S.gasLatch - dt);
      var going = S.held || S.gasLatch > 0;

      var gate = S.jobs.filter(function (o) { return o.kind === 'gate'; })[0];
      var blocked = gate && gate.open < 0.9 && S.x > gate.x - 150 && S.x < gate.x + 40;

      var want = (going && !blocked) ? speedMax() : 0;

      /* THE BUS PARKS ITSELF wherever there is something to do. Asking a
         three-year-old to let go at exactly the right spot is precision, and
         precision is the one thing this game never asks for. He holds to go; the
         bus knows where it has to stop. No flag is needed: once the stop has
         been served it has no business left, so the bus drives on by itself. */
      var duty = -1, dd;
      for (i = 0; i < S.stops.length; i++) {
        if (S.stops[i].x < S.x - 40) continue;
        if (!hasBusiness(i)) continue;
        duty = i; break;
      }
      if (duty >= 0) {
        dd = S.stops[duty].x - S.x;
        if (dd < 240) want = Math.min(want, Math.max(0, dd * 1.5));
      }
      S.spd += G.clamp(want - S.spd, -520 * dt, 340 * dt);
      S.spd = Math.max(0, S.spd);

      /* Last-resort anti-deadlock. No situation in this scene may end with a
         child holding the screen and nothing happening: if the finger is down,
         the bus is not moving, and there is nothing to wait for here, push it
         along regardless of why. */
      if (going && S.spd < 6 && duty < 0 && !blocked) {
        S.stuck += dt;
        if (S.stuck > 1.5) { S.spd = 130; S.stuck = 0; }
      } else {
        S.stuck = 0;
      }
      S.x += S.spd * dt;
      S.spin += S.spd * dt / 26;
      S.tilt += ((S.held ? -0.03 : 0) - S.tilt) * Math.min(1, dt * 6);

      if (S.x > roadLen()) { finish(); return; }

      /* Tank and mud: both purely cosmetic pressure. An empty tank never stops
         the bus, it only makes the passengers wave for a top-up. */
      S.tank = Math.max(0, S.tank - dt * (big() ? 0.018 : 0.010));
      S.dirt = Math.min(1, S.dirt + dt * 0.020);

      // jobs
      for (j = 0; j < S.jobs.length; j++) {
        var job = S.jobs[j];
        if (job.kind === 'wash' && Math.abs(S.x - job.x) < 60 && S.spd > 20) {
          S.dirt = Math.max(0, S.dirt - dt * 1.4);
          if (S.dirt < 0.02 && !job.done) { job.done = 1; G.sfx('chime'); say('Che bel pulmino pulito!', 0); }
        }
        if (job.kind === 'gate' && job.open > 0 && job.open < 1) job.open = Math.min(1, job.open + dt * 2.2);
      }

      // stops: the door opens on its own when the bus halts by a sign
      S.atStop = -1;
      for (i = 0; i < S.stops.length; i++) {
        st = S.stops[i];
        if (Math.abs(S.x - st.x) < 90) { S.atStop = i; break; }
      }
      if (S.atStop >= 0 && S.spd < 12) {
        S.doorT = Math.min(1, S.doorT + dt * 4);
        if (S.doorT >= 1) serve(S.atStop);
      } else {
        S.doorT = Math.max(0, S.doorT - dt * 4);
      }

      for (i = 0; i < S.riders.length; i++) {
        r = S.riders[i];
        r.hop = Math.abs(Math.sin(G.t * 5 + i)) * 4;
      }

      /* A nudge that shows instead of telling: the bus creeps forward by itself
         so a three-year-old sees what the screen is for. */
      S.idle += dt;
      if (!big() && S.spd < 5 && S.idle > 9 && S.nudges < 2 && duty < 0) {
        S.idle = 0; S.nudges++;
        say('Tieni il dito sullo schermo per andare!', 0);
        S.spd = 90;
      }
      if (S.spd > 20) S.idle = 0;
    },

    onDown: function (p) {
      if (p.y < 112) return;
      S.idle = 0;
      if (S.phase !== 'guida') return;

      /* A tap does the job here AND drives, never one instead of the other.
         These two branches used to `return` before setting S.held, which meant
         that standing next to the pump every single tap topped up the tank and
         the bus could never set off again — a dead end you could not get out of,
         which is the worst thing this game can do. */
      var gate = S.jobs.filter(function (o) { return o.kind === 'gate'; })[0];
      if (gate && gate.open <= 0 && Math.abs(S.x - gate.x) < 220) {
        gate.open = 0.01; G.sfx('pop'); say('Apriti!', 0);
      }
      var pump = S.jobs.filter(function (o) { return o.kind === 'pump'; })[0];
      if (pump && Math.abs(S.x - pump.x) < 150 && S.spd < 20 && S.tank < 0.98) {
        S.tank = 1; pump.done = 1;
        G.sfx('coin'); G.fx.confetti();
        say('Pieno di frutta!', 0);
      }
      S.held = true; S.gasLatch = 0.9;
    },

    onUp: function () { S.held = false; },

    draw: function (c) { drawAll(c); }
  });

  /* Everyone whose destination is this stop gets off; everyone waiting here gets
     on. There is no wrong stop: dropping somebody in the wrong place simply does
     not fire, and nothing tells him off. */
  /* Somebody to drop off here, or somebody waiting to get on. */
  function hasBusiness(i) {
    var k;
    for (k = 0; k < S.riders.length; k++) if (S.riders[k].to === i) return true;
    for (k = 0; k < S.waiting.length; k++) if (S.waiting[k].at === i) return true;
    return false;
  }

  function serve(i) {
    var st = S.stops[i], k, r;
    for (k = S.riders.length - 1; k >= 0; k--) {
      r = S.riders[k];
      if (r.to !== i) continue;
      S.riders.splice(k, 1);
      S.delivered++;
      reward(big() ? 9 : 6, BUS_X + 60, ROAD_Y - 120);
      G.sfx('good'); G.fx.confetti();
      G.fx.ring(BUS_X + 60, ROAD_Y - 110, r.color);
      say(r.name + ' e arrivato a ' + st.place.name + '!', 0);
    }
    for (k = S.waiting.length - 1; k >= 0; k--) {
      r = S.waiting[k];
      if (r.at !== i) continue;
      S.waiting.splice(k, 1);
      S.riders.push(r);
      G.sfx('pop');
      say(r.name + ' vuole andare a ' + S.stops[r.to].place.name + '!', 0.4);
    }
  }

  function finish() {
    var g = br();
    g.done++; g.trips++;
    G.saveNow();
    S.phase = 'fine';
    G.sfx('win'); G.fx.confetti();
    G.addStars(1, 640, 300);
    say(G.pick(['Che bel viaggio!', 'Tutti arrivati!', 'Bravo autista!']), 0.2);
  }

  /* ----------------------------------------------------------------- draw */
  function wx(x) { return x - S.x + BUS_X; }        // world x -> screen x

  function drawAll(c) {
    var i;
    drawSky(c);
    drawRoad(c);
    for (i = 0; i < S.jobs.length; i++) drawJob(c, S.jobs[i]);
    for (i = 0; i < S.stops.length; i++) drawStop(c, S.stops[i]);
    for (i = 0; i < S.waiting.length; i++) drawWaiting(c, S.waiting[i]);
    drawBus(c);
    drawHudBits(c);
    if (S.phase === 'fine') drawEnd(c);
    else drawGarageButton(c);
    if (S.phase === 'garage') drawGarage(c);
  }

  function drawSky(c) {
    if (A.jungle) { A.jungle(c, G.t, { dim: 0.10 }); return; }
    c.fillStyle = C.sky; c.fillRect(0, 0, W, H);
  }

  function drawRoad(c) {
    var i, x;
    c.save();
    c.fillStyle = '#8fbf63'; c.fillRect(0, ROAD_Y - 6, W, H - ROAD_Y + 6);
    c.fillStyle = '#b39a72'; c.fillRect(0, ROAD_Y, W, 96);
    c.fillStyle = '#8d7351'; c.fillRect(0, ROAD_Y, W, 8);
    c.fillStyle = 'rgba(255,246,224,.72)';           // dashes, scrolling
    for (i = -1; i < 14; i++) {
      x = ((i * 120) - (S.x % 120));
      c.fillRect(x, ROAD_Y + 46, 62, 9);
    }
    c.restore();
    void SKY_TOP;
  }

  function placeGlyph(pl) {
    return function (c, x, y, r) {
      c.save();
      c.fillStyle = pl.color;
      c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
      c.strokeStyle = C.ink; c.lineWidth = Math.max(2, r * 0.18); c.stroke();
      c.fillStyle = C.cream;
      c.beginPath(); c.arc(x, y, r * 0.42, 0, 6.2832); c.fill();
      c.restore();
    };
  }

  function drawStop(c, st) {
    var x = wx(st.x);
    if (x < -160 || x > W + 160) return;
    A.busStop(c, x, ROAD_Y, 150, {
      here: S.atStop === st.i && S.doorT > 0.5,
      icon: placeGlyph(st.place)
    });
  }

  function drawWaiting(c, r) {
    var st = S.stops[r.at], x = wx(st.x) + 76;
    if (x < -120 || x > W + 120) return;
    if (A.chick) A.chick(c, x, ROAD_Y - 8, 74, { t: G.t + r.at, color: r.color });
    /* Where he wants to go, shown as the symbol of the place — never a word. */
    var dst = S.stops[r.to];
    if (dst) {
      c.save();
      c.fillStyle = 'rgba(255,246,224,.94)';
      c.beginPath(); c.arc(x + 6, ROAD_Y - 104, 30, 0, 6.2832); c.fill();
      c.strokeStyle = r.color; c.lineWidth = 5; c.stroke();
      c.restore();
      placeGlyph(dst.place)(c, x + 6, ROAD_Y - 104, 15);
    }
  }

  function drawJob(c, job) {
    var x = wx(job.x);
    if (x < -220 || x > W + 220) return;
    if (job.kind === 'pump') A.pump(c, x, ROAD_Y, 190, { level: S.tank });
    else if (job.kind === 'wash') A.wash(c, x, ROAD_Y, 250, { on: Math.abs(S.x - job.x) < 60 && S.spd > 20 });
    else if (job.kind === 'gate') A.gate(c, x, ROAD_Y, 220, { open: job.open });
  }

  function drawBus(c) {
    var g = br();
    A.bus(c, BUS_X, ROAD_Y, BUS_S, {
      body: g.body, wheels: g.wheels, roof: g.roof,
      spin: S.spin, dirt: S.dirt, tilt: S.tilt,
      doorOpen: S.doorT > 0.5, riders: S.riders
    });
    /* The driver: the current player, so no `hat` and no `gear` — A.dino reads
       the live save and brings the glasses and the bow tie along. */
    var col = (G.account && G.account.color) || C.dino;
    A.dino(c, BUS_X - BUS_S * 0.30, ROAD_Y - BUS_S * 0.16, BUS_S * 0.46, {
      facing: 1, pose: S.spd > 30 ? 'happy' : 'idle', t: G.t, color: col
    });
  }

  /* Two dials, both readable without numbers: how full the tank is, and who is
     on board. Neither can reach a state that stops the game. */
  function drawHudBits(c) {
    var i, r;
    for (i = 0; i < S.riders.length && i < 5; i++) {
      r = S.riders[i];
      c.save();
      c.fillStyle = 'rgba(255,246,224,.92)';
      c.beginPath(); c.arc(120 + i * 74, 150, 32, 0, 6.2832); c.fill();
      c.strokeStyle = r.color; c.lineWidth = 5; c.stroke();
      c.restore();
      var dst = S.stops[r.to];
      if (dst) placeGlyph(dst.place)(c, 120 + i * 74, 150, 16);
    }
    if (S.tank < 0.35) {
      c.save();
      c.globalAlpha = 0.6 + Math.sin(G.t * 4) * 0.3;
      if (A.fruit) A.fruit(c, W - 90, 150, 26, 'fragola');
      c.restore();
    }
  }

  function drawGarageButton(c) {
    G.ui.round({
      id: 'garage', x: W - 84, y: H - 84, r: 54, color: C.tangerine,
      icon: function (cc, x, y, r) {
        cc.save();
        cc.strokeStyle = '#fff'; cc.lineWidth = Math.max(4, r * 0.16);
        cc.lineCap = 'round'; cc.lineJoin = 'round';
        cc.beginPath();
        cc.moveTo(x - r * 0.5, y + r * 0.1); cc.lineTo(x, y - r * 0.45);
        cc.lineTo(x + r * 0.5, y + r * 0.1);
        cc.moveTo(x - r * 0.34, y + r * 0.05); cc.lineTo(x - r * 0.34, y + r * 0.5);
        cc.lineTo(x + r * 0.34, y + r * 0.5); cc.lineTo(x + r * 0.34, y + r * 0.05);
        cc.stroke();
        cc.restore();
      },
      onTap: function () { S.phase = S.phase === 'garage' ? 'guida' : 'garage'; G.sfx('pop'); }
    });
    void c;
  }

  /* The garage. Parts unlock by TRIPS, never by price: a thing you earn by
     playing cannot say no to you, so there is no soft refusal to design. */
  function drawGarage(c) {
    var g = br(), open = partsOpen(), i;
    c.save(); c.fillStyle = 'rgba(9,32,21,.55)'; c.fillRect(0, 0, W, H); c.restore();
    A.panel(c, 150, 120, 980, 480, { r: 32 });
    G.text('Il tuo pulmino', 640, 176, { ctx: c, size: 44, color: C.ink });

    A.bus(c, 640, 336, 200, { body: g.body, wheels: g.wheels, roof: g.roof, spin: G.t * 2 });

    var rows = [
      { key: 'body', list: A.BUS_BODY, y: 400, label: 'Colore' },
      { key: 'wheels', list: A.BUS_WHEEL, y: 490, label: 'Ruote' },
      { key: 'roof', list: A.BUS_ROOF, y: 490, label: 'Tetto' }
    ];
    // colours on one row, wheels and roof share the next
    for (i = 0; i < A.BUS_BODY.length; i++) {
      (function (idx) {
        var bx = 210 + idx * 118;
        G.ui.button({
          id: 'bbody' + idx, x: bx, y: 396, w: 106, h: 106, r: 22,
          color: idx < open ? A.BUS_BODY[idx] : '#a49889',
          icon: function (cc, cx, cy) {
            if (idx >= open) { lockGlyph(cc, cx, cy, 26); return; }
            if (g.body === idx) tick(cc, cx, cy, 26);
          },
          onTap: function () {
            if (idx >= open) { G.sfx('pop'); G.say('Fai ancora un viaggio!'); return; }
            g.body = idx; G.saveNow(); G.sfx('chime');
          }
        });
      })(i);
    }
    for (i = 0; i < A.BUS_WHEEL.length; i++) {
      (function (idx) {
        var bx = 210 + idx * 118;
        G.ui.button({
          id: 'bwheel' + idx, x: bx, y: 508, w: 106, h: 106, r: 22,
          color: idx < open ? C.cream : '#a49889',
          icon: function (cc, cx, cy) {
            if (idx >= open) { lockGlyph(cc, cx, cy, 26); return; }
            A.bus(cc, cx, cy + 26, 78, { body: g.body, wheels: idx, roof: 0 });
            if (g.wheels === idx) tick(cc, cx + 32, cy - 26, 18);
          },
          onTap: function () {
            if (idx >= open) { G.sfx('pop'); G.say('Fai ancora un viaggio!'); return; }
            g.wheels = idx; G.saveNow(); G.sfx('chime');
          }
        });
      })(i);
    }
    for (i = 0; i < A.BUS_ROOF.length; i++) {
      (function (idx) {
        var bx = 600 + idx * 118;
        G.ui.button({
          id: 'broof' + idx, x: bx, y: 508, w: 106, h: 106, r: 22,
          color: idx < open ? C.cream : '#a49889',
          icon: function (cc, cx, cy) {
            if (idx >= open) { lockGlyph(cc, cx, cy, 26); return; }
            A.bus(cc, cx, cy + 26, 78, { body: g.body, wheels: g.wheels, roof: idx });
            if (g.roof === idx) tick(cc, cx + 32, cy - 26, 18);
          },
          onTap: function () {
            if (idx >= open) { G.sfx('pop'); G.say('Fai ancora un viaggio!'); return; }
            g.roof = idx; G.saveNow(); G.sfx('chime');
          }
        });
      })(i);
    }
    G.ui.button({
      id: 'bclose', x: 940, y: 508, w: 180, h: 106, r: 24, color: C.leaf,
      label: 'Vai!', fontSize: 38,
      onTap: function () { S.phase = 'guida'; G.sfx('pop'); }
    });
    void rows;
  }

  function lockGlyph(c, x, y, r) {
    c.save();
    c.fillStyle = 'rgba(255,246,224,.7)';
    G.roundRect(c, x - r * 0.6, y - r * 0.2, r * 1.2, r * 0.9, r * 0.16); c.fill();
    c.strokeStyle = 'rgba(255,246,224,.7)'; c.lineWidth = Math.max(3, r * 0.16);
    c.beginPath(); c.arc(x, y - r * 0.2, r * 0.38, Math.PI, 0); c.stroke();
    c.restore();
  }
  function tick(c, x, y, r) {
    c.save();
    c.strokeStyle = '#fff'; c.lineWidth = Math.max(4, r * 0.3);
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(x - r * 0.5, y); c.lineTo(x - r * 0.1, y + r * 0.45); c.lineTo(x + r * 0.55, y - r * 0.45);
    c.stroke();
    c.restore();
  }

  function drawEnd(c) {
    c.save(); c.fillStyle = 'rgba(9,32,21,.45)'; c.fillRect(0, 0, W, H); c.restore();
    A.panel(c, 300, 190, 680, 340, { r: 32 });
    G.text('Che bel viaggio!', 640, 268, { ctx: c, size: 54, color: C.ink });
    if (A.fruit) A.fruit(c, 520, 350, 30, 'fragola');
    G.text('+' + S.banked, 570, 352, { ctx: c, size: 46, color: C.ink, align: 'left' });
    if (G.starIcon) G.starIcon(c, 720, 350, 28);
    G.text('+1', 762, 352, { ctx: c, size: 46, color: C.ink, align: 'left' });
    G.ui.button({
      id: 'bagain', x: 350, y: 400, w: 280, h: 104, r: 28, color: C.leaf,
      label: 'Ancora!', fontSize: 38, onTap: function () { reset(); }
    });
    G.ui.button({
      id: 'bleave', x: 660, y: 400, w: 280, h: 104, r: 28, color: C.tangerine,
      label: 'Giungla', fontSize: 34, onTap: function () { G.home(); }
    });
  }
})();
