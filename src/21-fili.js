/* Dino Giungla — "I Fili Intrecciati" (scene: fili).
   Join every pair of matching dots with a thread; threads may not cross.
   Owns only G.save.fili = { done, size, pairs }.

   The whole point of this file is that a grid is ALWAYS solvable: puzzles are
   built backwards from a solution (the grid is partitioned into simple paths,
   the two ends of each path become a pair), never guessed and tested. A
   hand-written bank and a snake fallback stand behind the generator so the
   child can never be shown an empty or impossible board. */
(function () {
  'use strict';

  var G = window.G;
  if (!G || !G.scene) return;
  var C = G.C, W = G.W, H = G.H;

  /* ------------------------------------------------------------ pair kinds
     Colour AND shape differ, so the pairs stay readable without colour. */
  var KINDS = [
    { col: C.berry, name: 'rosso', shape: 'cuore' },
    { col: C.blueberry, name: 'blu', shape: 'quadrato' },
    { col: C.mint, name: 'verde', shape: 'triangolo' },
    { col: C.tangerine, name: 'arancione', shape: 'cerchio' },
    { col: C.plum, name: 'viola', shape: 'luna' },
    { col: C.sun, name: 'giallo', shape: 'stella' },
    { col: C.pinkPop, name: 'rosa', shape: 'fiore' },
    { col: C.water, name: 'azzurro', shape: 'rombo' }
  ];

  /* Local shape painters, same signature as A.SHAPES[id]: (ctx,x,y,r,color).
     Used only when the art module has no painter for that id. */
  var LOCAL = {
    cerchio: function (c, x, y, r, col) {
      c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
    },
    quadrato: function (c, x, y, r, col) {
      c.fillStyle = col; G.roundRect(c, x - r * .84, y - r * .84, r * 1.68, r * 1.68, r * .3); c.fill();
    },
    triangolo: function (c, x, y, r, col) {
      c.fillStyle = col; c.beginPath();
      c.moveTo(x, y - r); c.lineTo(x + r * .93, y + r * .72); c.lineTo(x - r * .93, y + r * .72);
      c.closePath(); c.fill();
    },
    rombo: function (c, x, y, r, col) {
      c.fillStyle = col; c.beginPath();
      c.moveTo(x, y - r); c.lineTo(x + r * .82, y); c.lineTo(x, y + r); c.lineTo(x - r * .82, y);
      c.closePath(); c.fill();
    },
    cuore: function (c, x, y, r, col) {
      c.fillStyle = col; c.beginPath();
      c.moveTo(x, y + r * .88);
      c.bezierCurveTo(x - r * 1.34, y - r * .18, x - r * .56, y - r * 1.12, x, y - r * .32);
      c.bezierCurveTo(x + r * .56, y - r * 1.12, x + r * 1.34, y - r * .18, x, y + r * .88);
      c.closePath(); c.fill();
    },
    stella: function (c, x, y, r, col) {
      c.fillStyle = col; G.starPath(c, x, y, r); c.fill();
    },
    fiore: function (c, x, y, r, col) {
      var i, a, px, py;
      c.fillStyle = col; c.beginPath();
      for (i = 0; i < 6; i++) {
        a = i * 1.0472;
        px = x + Math.cos(a) * r * .56; py = y + Math.sin(a) * r * .56;
        c.moveTo(px + r * .47, py); c.arc(px, py, r * .47, 0, 6.2832);
      }
      c.moveTo(x + r * .36, y); c.arc(x, y, r * .36, 0, 6.2832);
      c.fill();
    },
    luna: function (c, x, y, r, col) {
      c.fillStyle = col; c.beginPath();
      c.arc(x + r * .14, y, r, 1, -1);
      c.quadraticCurveTo(x - r * .28, y, x + r * .14 + Math.cos(1) * r, y + Math.sin(1) * r);
      c.closePath(); c.fill();
    }
  };

  var painter = {};        // shape id -> painter, resolved once per entry

  function resolvePainters() {
    var src = window.A && window.A.SHAPES, i, id;
    for (i = 0; i < KINDS.length; i++) {
      id = KINDS[i].shape;
      painter[id] = (src && typeof src[id] === 'function') ? src[id] : LOCAL[id];
    }
  }
  function glyph(c, id, x, y, r, col) {
    c.save();
    (painter[id] || LOCAL.cerchio)(c, x, y, r, col);
    c.restore();
  }

  /* ------------------------------------------------------------- generator
     A puzzle is a partition of the whole grid into simple paths. Endpoints of
     each path become one pair. Because the partition IS a solution, the puzzle
     is solvable by construction — and, since it covers every cell, a perfect
     (grid-filling) solution always exists too. */

  function freeNeighbours(free, n, r, c, out) {
    out.length = 0;
    if (r > 0 && free[(r - 1) * n + c]) out.push([r - 1, c]);
    if (r < n - 1 && free[(r + 1) * n + c]) out.push([r + 1, c]);
    if (c > 0 && free[r * n + c - 1]) out.push([r, c - 1]);
    if (c < n - 1 && free[r * n + c + 1]) out.push([r, c + 1]);
    return out;
  }
  function freeCount(free, n, r, c) {
    var k = 0;
    if (r > 0 && free[(r - 1) * n + c]) k++;
    if (r < n - 1 && free[(r + 1) * n + c]) k++;
    if (c > 0 && free[r * n + c - 1]) k++;
    if (c < n - 1 && free[r * n + c + 1]) k++;
    return k;
  }

  /* Grow a path from one of its ends, always stepping into the neighbour that
     has the fewest free cells around it (Warnsdorff): dead ends get eaten
     first, so we strand far fewer single cells. */
  function grow(free, n, path, atEnd) {
    var cand = [], guard = 0;
    for (; guard < 64; guard++) {
      var cell = atEnd ? path[path.length - 1] : path[0];
      freeNeighbours(free, n, cell[0], cell[1], cand);
      if (!cand.length) return;
      var order = G.shuffle(cand), best = null, bestK = 99, i, k;
      for (i = 0; i < order.length; i++) {
        k = freeCount(free, n, order[i][0], order[i][1]);
        if (k < bestK) { bestK = k; best = order[i]; }
      }
      free[best[0] * n + best[1]] = 0;
      if (atEnd) path.push(best); else path.unshift(best);
    }
  }

  function partition(n) {
    var total = n * n, free = new Uint8Array(total), paths = [], pool = [], i, left = total;
    for (i = 0; i < total; i++) free[i] = 1;
    var guard = 0;
    while (left > 0 && guard++ < total + 4) {
      pool.length = 0;
      for (i = 0; i < total; i++) if (free[i]) pool.push(i);
      var seed = pool[Math.floor(Math.random() * pool.length)];
      free[seed] = 0;
      var path = [[Math.floor(seed / n), seed % n]];
      grow(free, n, path, true);
      grow(free, n, path, false);
      paths.push(path);
      left = 0;
      for (i = 0; i < total; i++) if (free[i]) left++;
    }
    return paths;
  }

  function adjacent(a, b) { return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1; }

  /* Merge path i with any path it can be concatenated to end-to-end.
     Note: locals are pa/pb on purpose — `A` is the art namespace everywhere
     else in this file and shadowing it here would be a trap. */
  function mergeAt(paths, i) {
    var pa = paths[i], j, pb, merged, out, k;
    for (j = 0; j < paths.length; j++) {
      if (j === i) continue;
      pb = paths[j];
      merged = null;
      if (adjacent(pa[pa.length - 1], pb[0])) merged = pa.concat(pb);
      else if (adjacent(pa[pa.length - 1], pb[pb.length - 1])) merged = pa.concat(pb.slice().reverse());
      else if (adjacent(pa[0], pb[0])) merged = pa.slice().reverse().concat(pb);
      else if (adjacent(pa[0], pb[pb.length - 1])) merged = pb.concat(pa);
      if (merged) {
        out = [];
        for (k = 0; k < paths.length; k++) if (k !== i && k !== j) out.push(paths[k]);
        out.push(merged);
        return out;
      }
    }
    return null;
  }
  function mergeShortest(paths) {
    var order = [], i, res;
    for (i = 0; i < paths.length; i++) order.push(i);
    order.sort(function (a, b) { return paths[a].length - paths[b].length; });
    for (i = 0; i < order.length; i++) {
      res = mergeAt(paths, order[i]);
      if (res) return res;
    }
    return null;
  }
  function shortest(paths) {
    var m = 1e9, i;
    for (i = 0; i < paths.length; i++) if (paths[i].length < m) m = paths[i].length;
    return m;
  }
  /* Cut the longest path in two, both halves at least minLen long. */
  function splitLongest(paths, minLen) {
    var best = -1, bl = -1, i;
    for (i = 0; i < paths.length; i++) if (paths[i].length > bl) { bl = paths[i].length; best = i; }
    if (best < 0 || bl < minLen * 2) return null;
    var p = paths[best], lo = minLen - 1, hi = p.length - minLen - 1;
    var k = lo + Math.floor(Math.random() * (hi - lo + 1)), out = [], j;
    for (j = 0; j < paths.length; j++) if (j !== best) out.push(paths[j]);
    out.push(p.slice(0, k + 1));
    out.push(p.slice(k + 1));
    return out;
  }

  /* The referee. Every candidate grid — generated OR hand-written — goes
     through this before a child ever sees it. */
  function validate(paths, n) {
    if (!paths || paths.length < 2) return false;
    var total = n * n, seen = new Uint8Array(total), i, j, p, a, b, k, count = 0;
    for (i = 0; i < paths.length; i++) {
      p = paths[i];
      if (!p || p.length < 3) return false;                    // no pair on top of itself
      for (j = 0; j < p.length; j++) {
        a = p[j];
        if (!a || a.length !== 2) return false;
        if (a[0] < 0 || a[0] >= n || a[1] < 0 || a[1] >= n) return false;
        k = a[0] * n + a[1];
        if (seen[k]) return false;                             // two threads on one cell = crossing
        seen[k] = 1; count++;
        if (j > 0) {
          b = p[j - 1];
          if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) !== 1) return false;   // orthogonal steps only
        }
      }
      a = p[0]; b = p[p.length - 1];
      if (a[0] === b[0] && a[1] === b[1]) return false;         // the two dots must be distinct cells
    }
    return count === total;                                     // every cell covered
  }

  function generate(n, target) {
    var att, paths, guard, res, lo, hi;
    for (att = 0; att < 60; att++) {
      paths = partition(n);
      guard = 0;
      while (guard++ < 30 && shortest(paths) < 3 && paths.length > 1) {
        res = mergeShortest(paths); if (!res) break; paths = res;
      }
      guard = 0;
      while (guard++ < 30 && paths.length > target) {
        res = mergeShortest(paths); if (!res) break; paths = res;
      }
      guard = 0;
      while (guard++ < 30 && paths.length < target) {
        res = splitLongest(paths, 3); if (!res) break; paths = res;
      }
      lo = att < 40 ? target : target - 1;
      hi = att < 40 ? target : target + 1;
      if (lo < 2) lo = 2;
      if (paths.length >= lo && paths.length <= hi && validate(paths, n)) return paths;
    }
    return null;
  }

  /* ------------------------------------------------------------ safety net
     Hand-written grids, one string per path, two digits per cell ("rc").
     They are decoded and run through validate() like everything else, so a
     typo here degrades to "skip this grid", never to a broken puzzle. */
  var BANK = {
    3: [
      ['000102', '101112222120'],
      ['0010202122', '01021211'],
      ['02010010', '1112222120'],
      ['0001111020', '02122221']
    ],
    4: [
      ['0001020313', '101112222333', '3231302021'],
      ['00102030', '010203131211', '212223333231'],
      ['000111102030', '020313122223', '21313233'],
      ['30313233', '001020211101', '021222231303']
    ],
    5: [
      ['0001020304', '1413121110', '2021222324', '30313233344443424140'],
      ['0010203040', '0102030414', '1112132324', '22213132333444434241'],
      ['0001111020', '0203041413', '122221313040', '232434444333324241'],
      ['4041424344', '3433323130', '2021222324', '00010203041413121110']
    ],
    6: [
      ['000102030405', '151413121110', '202122232425', '353433323130', '404142434445555453525150'],
      ['001020304050', '010203040515', '111213142425', '212223333435', '313242415152534344545545'],
      ['000111102030', '020304051514', '121323222131', '242535343332', '404142434445555453525150'],
      ['505152535455', '454443424140', '303132333435', '252423222120', '000102030405151413121110']
    ]
  };

  function decodePath(str) {
    var out = [], i, r, c;
    if (typeof str !== 'string' || str.length < 6 || str.length % 2) return null;
    for (i = 0; i < str.length; i += 2) {
      r = str.charCodeAt(i) - 48; c = str.charCodeAt(i + 1) - 48;
      if (r < 0 || r > 9 || c < 0 || c > 9) return null;
      out.push([r, c]);
    }
    return out;
  }
  function fromBank(n) {
    var set = BANK[n];
    if (!set) return null;
    var order = G.shuffle(set), i, j, paths, p, ok;
    for (i = 0; i < order.length; i++) {
      paths = []; ok = true;
      for (j = 0; j < order[i].length; j++) {
        p = decodePath(order[i][j]);
        if (!p) { ok = false; break; }
        paths.push(p);
      }
      if (ok && validate(paths, n)) return paths;
    }
    return null;
  }
  /* Last resort: a boustrophedon path through the grid, cut into chunks.
     Boring, but valid by construction — the child always gets a puzzle. */
  function snake(n, target) {
    var cells = [], r, c, paths = [], i, start = 0, end;
    for (r = 0; r < n; r++) {
      if (r % 2 === 0) { for (c = 0; c < n; c++) cells.push([r, c]); }
      else { for (c = n - 1; c >= 0; c--) cells.push([r, c]); }
    }
    var k = Math.max(2, Math.min(target, Math.floor(cells.length / 3)));
    var per = Math.floor(cells.length / k);
    for (i = 0; i < k; i++) {
      end = (i === k - 1) ? cells.length : start + per;
      paths.push(cells.slice(start, end));
      start = end;
    }
    return validate(paths, n) ? paths : null;
  }

  /* Absolute floor: a 3x3 partition written out by hand. Every other source can
     in principle return null; this one cannot, so newGrid() always has a grid. */
  var FLOOR3 = [
    [[0, 0], [0, 1], [0, 2]],
    [[1, 0], [1, 1], [1, 2], [2, 2], [2, 1], [2, 0]]
  ];

  function buildPuzzle(n, target) {
    return generate(n, target) || fromBank(n) || snake(n, target) || snake(n, 2);
  }

  /* ------------------------------------------------------------ save branch */
  function branch() {
    if (!G.save.fili || typeof G.save.fili !== 'object') G.save.fili = {};
    var f = G.save.fili;
    f.done ??= 0;
    f.size ??= 4;
    f.pairs ??= 3;
    if (typeof f.done !== 'number' || !isFinite(f.done) || f.done < 0) f.done = 0;
    f.done = Math.floor(f.done);
    return f;
  }

  /* Level 1 (3 anni): tiny board, three warm-up games on 3x3 first.
     Level 2 (6 anni): starts at 5x5 and steps up to 6x6 once it is easy. */
  function plan() {
    var done = branch().done;
    if (G.level === 2) return done >= 5 ? { n: 6, pairs: 5 } : { n: 5, pairs: 4 };
    return done < 3 ? { n: 3, pairs: 2 } : { n: 4, pairs: 3 };
  }

  /* ----------------------------------------------------------------- state */
  var n = 4, pairs = 3, side = 520, cs = 130, gx = 0, gy = 0, fpad = 24;
  var sol = [];            // the construction solution (never shown)
  var kinds = [];          // colour slot -> KINDS index
  var dots = [];           // colour slot -> [[r,c],[r,c]]
  var dotOf = null;        // cell -> colour slot | -1
  var own = null;          // cell -> colour slot | -1
  var lines = [];          // colour slot -> { cells, closed, glow }
  var active = -1, lastBad = -9, pulse = 0;
  var won = false, winT = 0, perfect = false, spoke = false;
  var bgGrad = null;

  /* Reused every frame so the draw path allocates nothing. */
  var JUNGLE_OPT = { dim: .28 };
  var DINO_OPT = { facing: 1, t: 0, hat: null, color: C.dino, pose: 'idle' };
  var PANEL_OPT = { r: 28 }, WIN_PANEL_OPT = { r: 34 };

  /* A cell is the tap target, so it must never drop under 96 logical px:
     6x6 gets the largest board the 96..720 band can hold (576 / 6 = 96). */
  function sizeFor(k) { return k === 3 ? 486 : k === 4 ? 520 : k === 5 ? 540 : 576; }

  function layout() {
    side = sizeFor(n);
    cs = side / n;
    gx = Math.round(468 - side / 2);
    gy = Math.round(96 + (H - 96 - side) / 2);
    // Wooden frame: thick when there is room, never over the HUD band nor off-screen.
    fpad = Math.max(8, Math.min(24, gy - 100, H - 4 - (gy + side)));
  }

  function resetLines() {
    var i;
    lines = [];
    for (i = 0; i < pairs; i++) lines.push({ cells: [], closed: false, glow: 0 });
    active = -1; won = false; winT = 0; perfect = false; spoke = false;
    rebuildOwn();
  }

  function newGrid() {
    var p = plan(), i, path;
    n = p.n; pairs = p.pairs;
    sol = buildPuzzle(n, pairs);
    if (!sol) { n = 3; pairs = 2; sol = snake(3, 2) || FLOOR3; }  // never show nothing
    pairs = sol.length;
    layout();
    kinds = G.shuffle([0, 1, 2, 3, 4, 5, 6, 7]);
    while (kinds.length < pairs) kinds = kinds.concat(G.shuffle([0, 1, 2, 3, 4, 5, 6, 7]));
    kinds = kinds.slice(0, pairs);
    dots = [];
    dotOf = new Int8Array(n * n);
    for (i = 0; i < n * n; i++) dotOf[i] = -1;
    for (i = 0; i < pairs; i++) {
      path = sol[i];
      var a = path[0], b = path[path.length - 1];
      dots.push([a, b]);
      dotOf[a[0] * n + a[1]] = i;
      dotOf[b[0] * n + b[1]] = i;
    }
    var f = branch();
    f.size = n; f.pairs = pairs; G.saveNow();
    resetLines();
  }

  function rebuildOwn() {
    var i, k, cells;
    if (!own || own.length !== n * n) own = new Int8Array(n * n);
    for (i = 0; i < own.length; i++) own[i] = -1;
    for (k = 0; k < lines.length; k++) {
      cells = lines[k].cells;
      for (i = 0; i < cells.length; i++) own[cells[i][0] * n + cells[i][1]] = k;
    }
  }

  function kindOf(k) { return KINDS[(kinds[k] | 0) % KINDS.length] || KINDS[0]; }
  function colOf(k) { return kindOf(k).col; }
  function cxOf(c) { return gx + c * cs + cs / 2; }
  function cyOf(r) { return gy + r * cs + cs / 2; }
  function idxIn(cells, r, c) {
    var i;
    for (i = 0; i < cells.length; i++) if (cells[i][0] === r && cells[i][1] === c) return i;
    return -1;
  }
  /* Forgiving pick: the nearest cell centre, accepting a quarter of a cell of
     slop outside the board so edge dots stay easy to grab. */
  function cellAt(p) {
    if (!p) return null;
    var c = Math.floor((p.x - gx) / cs), r = Math.floor((p.y - gy) / cs);
    if (c < 0) c = 0; else if (c > n - 1) c = n - 1;
    if (r < 0) r = 0; else if (r > n - 1) r = n - 1;
    if (Math.abs(p.x - cxOf(c)) > cs * .75 || Math.abs(p.y - cyOf(r)) > cs * .75) return null;
    return [r, c];
  }
  function blockedFor(k, r, c) {
    var i = r * n + c;
    if (dotOf[i] >= 0 && dotOf[i] !== k) return true;
    return own[i] >= 0 && own[i] !== k;
  }
  /* The thread cannot go that way. There is no failure state here, so this is
     a soft, rate-limited nudge at the head of the thread — never the "wrong"
     buzzer, which would fire constantly while a small finger explores. */
  function softBad() {
    if (active < 0 || G.t - lastBad < .5) return;
    lastBad = G.t;
    var L = lines[active], last = L && L.cells[L.cells.length - 1];
    if (last) G.fx.ring(cxOf(last[1]), cyOf(last[0]), C.cream, cs * .5);
  }

  function closePair(k) {
    var L = lines[k], last = L.cells[L.cells.length - 1];
    var x = cxOf(last[1]), y = cyOf(last[0]), kk = kindOf(k);
    L.closed = true; L.glow = 1;
    G.sfx('pop');
    G.fx.ring(x, y, kk.col, cs * 1.1);
    G.fx.burst(x, y, { color: kk.col, count: 10, speed: 170, size: cs * .12, life: .6, gravity: 240 });
    if (G.level === 1) G.say(kk.name + '!');
  }

  function checkWin() {
    var i;
    for (i = 0; i < lines.length; i++) if (!lines[i].closed) return;
    var f = branch();
    f.done = f.done + 1; f.size = n; f.pairs = pairs;
    G.saveNow();
    won = true; winT = 0; spoke = false; active = -1;
    perfect = true;
    for (i = 0; i < own.length; i++) if (own[i] < 0) { perfect = false; break; }
    G.fx.confetti();
    G.sfx('win');
    G.shake(3);
    G.addStars(1, 468, 300);
    G.addFruits(G.level === 1 ? 10 : 16, 468, 340);
    if (perfect && G.level === 2) {
      G.addStars(1, 468, 260);
      G.fx.text(468, 230, 'Perfetto!', C.sun, 54);
    }
  }

  /* Walk the head of the active thread towards the touched cell, one
     orthogonal step at a time. A few steps per event keeps up with a fast
     finger without ever teleporting the thread. */
  function stepToward(tr, tc) {
    var L = lines[active], guard, moved, i, last, dr, dc, opts, nr, nc, hit;
    for (guard = 0; guard < 4; guard++) {
      last = L.cells[L.cells.length - 1];
      if (!last || (last[0] === tr && last[1] === tc)) return;
      if (L.closed) return;                                  // never grow past the far dot
      dr = tr - last[0]; dc = tc - last[1];
      opts = [];
      if (Math.abs(dr) >= Math.abs(dc)) {
        if (dr) opts.push([last[0] + (dr > 0 ? 1 : -1), last[1]]);
        if (dc) opts.push([last[0], last[1] + (dc > 0 ? 1 : -1)]);
      } else {
        if (dc) opts.push([last[0], last[1] + (dc > 0 ? 1 : -1)]);
        if (dr) opts.push([last[0] + (dr > 0 ? 1 : -1), last[1]]);
      }
      moved = false;
      for (i = 0; i < opts.length; i++) {
        nr = opts[i][0]; nc = opts[i][1];
        if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
        hit = idxIn(L.cells, nr, nc);
        if (hit >= 0) {                                      // back over our own thread: shorten it
          L.cells.length = hit + 1;
          L.closed = false;
          moved = true;
          break;
        }
        if (blockedFor(active, nr, nc)) continue;            // someone else's thread: just stop
        L.cells.push([nr, nc]);
        moved = true;
        if (dotOf[nr * n + nc] === active) closePair(active);
        break;
      }
      rebuildOwn();
      if (!moved) { softBad(); return; }
      if (L.closed) return;
    }
  }

  /* -------------------------------------------------------------- painting */
  function threadPath(c, cells, dy) {
    var i;
    c.beginPath();
    c.moveTo(cxOf(cells[0][1]), cyOf(cells[0][0]) + dy);
    for (i = 1; i < cells.length; i++) c.lineTo(cxOf(cells[i][1]), cyOf(cells[i][0]) + dy);
  }

  function drawThreads(c) {
    var k, L, col, w = cs * .42;
    c.save();
    c.lineCap = 'round';
    c.lineJoin = 'round';
    for (k = 0; k < lines.length; k++) {
      L = lines[k];
      if (L.cells.length < 2) continue;
      col = colOf(k);
      threadPath(c, L.cells, 0);
      c.lineWidth = w + 8; c.strokeStyle = G.shade(col, -66); c.stroke();
      threadPath(c, L.cells, 0);
      c.lineWidth = w; c.strokeStyle = col; c.stroke();
      threadPath(c, L.cells, -w * .17);
      c.lineWidth = w * .30; c.strokeStyle = G.shade(col, 52); c.stroke();
    }
    c.restore();
  }

  function drawDots(c) {
    var k, d, i, r, x, y, kk, done, beat, rr;
    for (k = 0; k < pairs; k++) {
      kk = kindOf(k);
      d = dots[k];
      done = lines[k].closed;
      beat = done ? 1 + Math.sin(pulse * 5 + k) * .04
        : (G.level === 1 ? 1 + Math.sin(pulse * 3.2 + k * 1.7) * .05 : 1);
      for (i = 0; i < 2; i++) {
        x = cxOf(d[i][1]); y = cyOf(d[i][0]);
        r = cs * .32 * beat;
        c.save();
        c.fillStyle = G.shade(kk.col, -66);
        c.beginPath(); c.arc(x, y + cs * .035, r, 0, 6.2832); c.fill();
        c.fillStyle = done ? G.shade(kk.col, 22) : kk.col;
        c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
        c.fillStyle = 'rgba(255,255,255,.26)';
        c.beginPath(); c.arc(x, y - r * .26, r * .70, Math.PI, 0); c.fill();
        c.restore();
        glyph(c, kk.shape, x, y, r * .58, C.cream);
        if (lines[k].glow > 0) {
          rr = r + (1 - lines[k].glow) * cs * .30;
          c.save();
          c.globalAlpha = lines[k].glow * .9;
          c.strokeStyle = C.cream; c.lineWidth = 6;
          c.beginPath(); c.arc(x, y, rr, 0, 6.2832); c.stroke();
          c.restore();
        }
      }
    }
  }

  function drawBoard(c) {
    var Art = window.A, r0, c0, x, y, pad = cs * .07, f = fpad, f2 = f * .66;
    if (Art && typeof Art.panel === 'function') Art.panel(c, gx - f, gy - f, side + f * 2, side + f * 2, PANEL_OPT);
    else {
      c.fillStyle = C.barkDark;
      G.roundRect(c, gx - f, gy - f, side + f * 2, side + f * 2, 28); c.fill();
      c.fillStyle = C.bark;
      G.roundRect(c, gx - f2, gy - f2, side + f2 * 2, side + f2 * 2, 22); c.fill();
    }
    for (r0 = 0; r0 < n; r0++) {
      for (c0 = 0; c0 < n; c0++) {
        x = gx + c0 * cs + pad; y = gy + r0 * cs + pad;
        c.fillStyle = ((r0 + c0) & 1) ? '#e7d9b6' : '#f0e5c8';
        G.roundRect(c, x, y, cs - pad * 2, cs - pad * 2, cs * .18); c.fill();
      }
    }
  }

  /* Button icons — a child who cannot read has to tell the buttons apart. */
  function iconRestart(cc, cx, cy, s) {
    cc.save();
    cc.strokeStyle = '#fff6e0'; cc.lineWidth = s * .17; cc.lineCap = 'round';
    cc.beginPath(); cc.arc(cx, cy, s * .34, .7, 5.3); cc.stroke();
    cc.fillStyle = '#fff6e0';
    cc.beginPath();
    cc.moveTo(cx + s * .40, cy - s * .46); cc.lineTo(cx + s * .48, cy + s * .04); cc.lineTo(cx + s * .02, cy - s * .18);
    cc.closePath(); cc.fill();
    cc.restore();
  }
  function iconHouse(cc, cx, cy, s) {
    cc.save();
    cc.fillStyle = '#fff6e0'; cc.strokeStyle = '#5b2c00';
    cc.lineWidth = Math.max(3, s * .09); cc.lineJoin = 'round';
    cc.beginPath();
    cc.moveTo(cx - s * .46, cy + s * .04); cc.lineTo(cx, cy - s * .44); cc.lineTo(cx + s * .46, cy + s * .04);
    cc.lineTo(cx + s * .33, cy + s * .04); cc.lineTo(cx + s * .33, cy + s * .42);
    cc.lineTo(cx - s * .33, cy + s * .42); cc.lineTo(cx - s * .33, cy + s * .04);
    cc.closePath(); cc.fill(); cc.stroke();
    cc.restore();
  }
  function iconGrid(cc, cx, cy, s) {
    var i, j, d = s * .21, o = s * .24;
    cc.save();
    cc.fillStyle = '#fff6e0';
    for (i = 0; i < 2; i++) for (j = 0; j < 2; j++) {
      G.roundRect(cc, cx - o - d / 2 + i * o * 2, cy - o - d / 2 + j * o * 2, d, d, d * .3);
      cc.fill();
    }
    cc.restore();
  }

  function drawExample(c, x, y, w, h) {
    var ax = x + w * .24, ay = y + h * .68, bx = x + w * .78, by = y + h * .34, mx = x + w * .52;
    c.save();
    c.fillStyle = 'rgba(255,246,224,.16)';
    G.roundRect(c, x, y, w, h, 20); c.fill();
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(ax, ay); c.lineTo(mx, ay); c.lineTo(mx, by); c.lineTo(bx, by);
    c.lineWidth = 24; c.strokeStyle = G.shade(C.mint, -66); c.stroke();
    c.beginPath();
    c.moveTo(ax, ay); c.lineTo(mx, ay); c.lineTo(mx, by); c.lineTo(bx, by);
    c.lineWidth = 16; c.strokeStyle = C.mint; c.stroke();
    c.fillStyle = C.mint;
    c.beginPath(); c.arc(ax, ay, 20, 0, 6.2832); c.fill();
    c.beginPath(); c.arc(bx, by, 20, 0, 6.2832); c.fill();
    c.restore();
    glyph(c, 'triangolo', ax, ay, 11, C.cream);
    glyph(c, 'triangolo', bx, by, 11, C.cream);
  }

  function drawSide(c) {
    var i, k, x, y, doneCount = 0, step, chipR;
    for (i = 0; i < lines.length; i++) if (lines[i].closed) doneCount++;
    // Chips are centred on the column and shrink with the pair count, so they
    // can never spill past x = 1190 however many pairs the generator returns.
    step = Math.min(74, 340 / (pairs > 0 ? pairs : 1));
    chipR = Math.min(30, step * .44);
    G.text('I Fili Intrecciati', 1000, 122, { size: 30, color: C.cream, stroke: 'rgba(12,40,25,.7)', strokeWidth: 8 });
    drawExample(c, 810, 142, 380, 116);
    for (k = 0; k < pairs; k++) {
      x = 1000 - (pairs - 1) * step / 2 + k * step; y = 300;
      c.save();
      c.globalAlpha = lines[k].closed ? 1 : .30;
      c.fillStyle = 'rgba(255,246,224,.92)';
      c.beginPath(); c.arc(x, y, chipR, 0, 6.2832); c.fill();
      c.restore();
      c.save();
      c.globalAlpha = lines[k].closed ? 1 : .45;
      glyph(c, kindOf(k).shape, x, y, chipR * .62, kindOf(k).col);
      c.restore();
    }
    G.text(doneCount + ' / ' + pairs, 1000, 366, { size: 38, color: C.cream, stroke: 'rgba(12,40,25,.7)', strokeWidth: 9 });
    if (won) return;
    G.ui.button({
      x: 810, y: G.level === 2 ? 396 : 424, w: 380, h: 140, r: 30,
      label: 'Ricomincia', color: C.leaf, fontSize: 40, iconSize: 60,
      icon: iconRestart,
      onTap: function () { resetLines(); }
    });
    if (G.level === 2) {
      G.ui.button({
        x: 810, y: 552, w: 380, h: 140, r: 30,
        label: 'Nuova', sub: 'griglia', color: C.blueberry, fontSize: 40, iconSize: 60,
        icon: iconGrid,
        onTap: function () { newGrid(); G.sfx('whoosh'); }
      });
    }
  }

  function drawWinPanel(c) {
    var Art = window.A, pw = 720, ph = 380, px = (W - pw) / 2, py = 176;
    c.save();
    c.fillStyle = 'rgba(9,32,21,.46)';
    c.fillRect(0, 0, W, H);
    c.restore();
    if (Art && typeof Art.panel === 'function') Art.panel(c, px, py, pw, ph, WIN_PANEL_OPT);
    else {
      c.fillStyle = C.barkDark; G.roundRect(c, px, py, pw, ph, 34); c.fill();
      c.fillStyle = C.cream; G.roundRect(c, px + 10, py + 10, pw - 20, ph - 20, 26); c.fill();
    }
    // Neutral wording: the two children are not necessarily both boys.
    G.text(perfect && G.level === 2 ? 'Perfetto!' : 'Evviva!', W / 2, py + 74, { size: 58, color: C.ink });
    var stars = (perfect && G.level === 2) ? 2 : 1, i;
    for (i = 0; i < stars; i++) G.starIcon(c, W / 2 + (i - (stars - 1) / 2) * 72, py + 146, 30);
    /* Third button only when a present is actually waiting, so the two-button
       panel the children already know is untouched the rest of the time. */
    var crate = (typeof G.crates === 'function') ? G.crates() : 0;
    if (crate > 0) {
      G.ui.button({
        x: px + 28, y: py + 196, w: 210, h: 150, r: 32,
        label: 'Ancora!', color: C.leaf, fontSize: 30, iconSize: 48,
        icon: iconRestart,
        onTap: function () { newGrid(); }
      });
      G.ui.button({
        x: px + 255, y: py + 196, w: 210, h: 150, r: 32,
        label: 'Apri la cassa!', color: C.plum, fontSize: 24,
        onTap: function () { G.go('guardaroba'); }
      });
      G.ui.button({
        x: px + 482, y: py + 196, w: 210, h: 150, r: 32,
        label: 'Giungla', color: C.tangerine, fontSize: 30, iconSize: 48,
        icon: iconHouse,
        onTap: function () { G.home(); }
      });
      return;
    }
    G.ui.button({
      x: px + 42, y: py + 196, w: 300, h: 150, r: 32,
      label: 'Ancora!', color: C.leaf, fontSize: 38, iconSize: 56,
      icon: iconRestart,
      onTap: function () { newGrid(); }
    });
    G.ui.button({
      x: px + pw - 342, y: py + 196, w: 300, h: 150, r: 32,
      label: 'Giungla', color: C.tangerine, fontSize: 36, iconSize: 56,
      icon: iconHouse,
      onTap: function () { G.home(); }
    });
  }

  /* ----------------------------------------------------------------- scene */
  G.scene('fili', {
    enter: function () {
      resolvePainters();
      if (!bgGrad && G.ctx && G.ctx.createLinearGradient) {
        bgGrad = G.ctx.createLinearGradient(0, 0, 0, H);
        bgGrad.addColorStop(0, C.skyDeep);
        bgGrad.addColorStop(1, C.leafDark);
      }
      branch();
      pulse = 0; lastBad = -9;
      newGrid();
      if (!G.save.seen || typeof G.save.seen !== 'object') G.save.seen = {};
      var first = !G.save.seen.fili;
      G.save.seen.fili = true; G.saveNow();
      if (G.level === 2) {
        G.say(first
          ? 'Unisci ogni coppia di pallini uguali, senza far incrociare i fili. Prova a riempire tutta la griglia!'
          : 'Unisci i pallini uguali senza incrociare i fili!');
      } else {
        G.say(first
          ? 'Unisci i pallini uguali! Metti il dito su un pallino e portalo fino al suo gemello.'
          : 'Unisci i pallini uguali!');
      }
    },

    exit: function () { active = -1; },

    update: function (dt) {
      var i;
      pulse += dt;
      for (i = 0; i < lines.length; i++) if (lines[i].glow > 0) lines[i].glow = Math.max(0, lines[i].glow - dt * 1.6);
      if (won) {
        winT += dt;
        if (!spoke && winT > .8) {
          spoke = true;
          G.say(perfect && G.level === 2 ? 'Perfetto! Hai riempito tutta la griglia!' : 'Evviva! Hai unito tutti i fili!');
        }
      }
    },

    draw: function (c) {
      var Art = window.A;
      if (Art && typeof Art.jungle === 'function') Art.jungle(c, G.t, JUNGLE_OPT);
      else { c.fillStyle = bgGrad || C.leafDark; c.fillRect(0, 0, W, H); }
      if (Art && typeof Art.dino === 'function') {
        DINO_OPT.t = G.t;
        DINO_OPT.hat = G.save.hat;
        DINO_OPT.color = (G.account && G.account.color) || C.dino;
        DINO_OPT.pose = won ? 'happy' : (active >= 0 ? 'think' : 'idle');
        Art.dino(c, 104, 692, 176, DINO_OPT);
      }
      drawBoard(c);
      drawThreads(c);
      drawDots(c);
      if (active >= 0 && lines[active].cells.length) {
        var L = lines[active], head = L.cells[L.cells.length - 1];
        c.save();
        c.globalAlpha = .55 + Math.sin(pulse * 9) * .25;
        c.strokeStyle = C.cream; c.lineWidth = 5;
        c.beginPath(); c.arc(cxOf(head[1]), cyOf(head[0]), cs * .40, 0, 6.2832); c.stroke();
        c.restore();
      }
      drawSide(c);
      if (won && winT > .85) drawWinPanel(c);
    },

    onDown: function (p) {
      if (won) return;
      var hit = cellAt(p);
      if (!hit) { active = -1; return; }
      var i = hit[0] * n + hit[1], k = own[i], at;
      if (k >= 0) {                                    // grabbed an existing thread: resume it there
        at = idxIn(lines[k].cells, hit[0], hit[1]);
        lines[k].cells.length = at + 1;
        lines[k].closed = lines[k].cells.length > 1 && dotOf[i] === k;
        active = k;
      } else if (dotOf[i] >= 0) {                      // grabbed a free dot: start from it
        k = dotOf[i];
        lines[k].cells = [[hit[0], hit[1]]];
        lines[k].closed = false;
        active = k;
      } else { active = -1; return; }
      rebuildOwn();
      G.sfx('tap');
      checkWin();          // belt and braces: a re-grab can close the last pair
    },

    onMove: function (p) {
      if (won || active < 0) return;
      var hit = cellAt(p);
      if (!hit) return;
      var L = lines[active];
      if (!L.cells.length) { active = -1; return; }
      var at = idxIn(L.cells, hit[0], hit[1]);
      if (at >= 0) {
        if (at < L.cells.length - 1) {                 // dragged back down the thread: shorten it
          L.cells.length = at + 1;
          L.closed = false;
          rebuildOwn();
        }
        return;
      }
      stepToward(hit[0], hit[1]);
      if (!won) checkWin();
    },

    onUp: function () { active = -1; }                 // whatever is drawn stays drawn
  });
})();
