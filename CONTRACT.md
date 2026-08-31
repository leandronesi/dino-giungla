# Dino Giungla — contratto dei moduli

Gioco per tablet Android, **2 bambini: 3 anni e 6 anni**. Italiano. Offline. Zero
dipendenze, zero asset esterni: tutto disegnato a runtime su canvas.

Il gioco è **un solo file HTML** prodotto da `build.js` che concatena `src/*.js`
in ordine alfabetico dentro un unico `<script>`.

---

## Regole non negoziabili

1. **Nessun `import`, nessun modulo ES, nessuna libreria.** Ogni file in `src/` è
   un IIFE: `(function(){ 'use strict'; ... })();`. Si comunica solo via `G` e `A`.
2. **Nessuna risorsa esterna**: niente `fetch`, `<img src>`, font web, CDN. Ogni
   disegno è vettoriale su canvas.
3. **Nessuno stato di fallimento.** Non si perde mai. Niente timer che puniscono,
   niente vite, niente "game over". Risposta sbagliata = feedback dolce e si
   riprova. Un bambino di 3 anni non deve mai vedere una schermata triste.
4. **Nessun testo indispensabile.** Chi non sa leggere deve poter giocare: icone
   grandi, numeri, e la voce (`G.say`) che legge la consegna in italiano.
5. **Aree tap ≥ 96px logici.** Dita piccole, imprecise.
6. **Sistema di coordinate logico fisso 1280×720.** Il core fa lettering/scala.
   Disegna sempre in coordinate logiche, mai in pixel schermo.
7. **Due difficoltà**: `G.level === 1` (Piccolo, 3 anni) e `G.level === 2`
   (Grande, 6 anni). Ogni modulo DEVE differenziare.
8. Commenti e nomi in **inglese**; testo mostrato all'utente in **italiano**.
9. **La banda in alto `y < 96` è riservata all'HUD.** Non metterci niente di
   toccabile né di importante. Idem gli ultimi 300px in alto a destra.
10. Ogni modulo tocca **solo il proprio ramo** di `G.save`. Mai `G.save.fruits`
    direttamente per aggiungere: si usa `G.addFruits()` / `G.spend()`.

---

## API del core (`src/00-core.js`) — già scritto, non modificarlo

### Costanti / stato
```js
G.W, G.H            // 1280, 720 — mondo logico
G.ctx               // CanvasRenderingContext2D già trasformato in coord. logiche
G.t                 // secondi dall'avvio (float)
G.dt                // secondi dall'ultimo frame (clampato a 0.05)
G.profile           // 'piccolo' | 'grande'
G.level             // 1 | 2
G.save              // oggetto salvataggio del profilo corrente (vedi sotto)
G.C                 // palette colori (vedi sotto)
```

### Scene
```js
G.scene(name, obj)  // registra una scena
G.go(name, params)  // transizione con dissolvenza verso la scena
G.home()            // torna all'overworld ('giungla')
G.current           // nome scena corrente
```
Una scena è un oggetto con metodi opzionali:
```js
{
  hud: true,                  // mostra HUD in alto (default true)
  back: true,                 // mostra il tasto "casa" (default true fuori da giungla)
  enter(params) {},           // chiamato all'ingresso
  exit() {},                  // chiamato all'uscita
  update(dt) {},              // logica
  draw(ctx) {},               // disegno (coord. logiche 1280x720)
  onDown(p) {}, onMove(p) {}, onUp(p) {}   // p = {x, y} in coord. logiche
}
```
`onDown/onMove/onUp` **non** vengono chiamati se il tocco ha colpito un bottone
UI: il core consuma l'evento.

### UI immediata (dichiarata dentro `draw`, ridisegnata ogni frame)
```js
G.ui.button({ x, y, w, h, label, color, textColor, r, icon, onTap,
              disabled, sub, fontSize })
// x,y = angolo alto-sinistra. icon = function(ctx, cx, cy, size).
// Ritorna true se premuto in questo frame (per effetti).

G.ui.round({ x, y, r, icon, color, onTap })   // bottone circolare (x,y = centro)
```
I bottoni gestiscono da soli ombra, pressione, hit test. **Usali sempre**: non
fare hit test a mano per i bottoni.

### Ricompense, effetti, suoni
```js
G.addFruits(n, x, y)      // +n frutti con animazione di volo verso l'HUD
G.addStars(n, x, y)       // +n stelline
G.fx.burst(x, y, opts)    // opts: {color, count, speed, life, gravity, size, shape}
G.fx.text(x, y, str, col) // testo che sale e svanisce
G.fx.confetti()           // festa a tutto schermo
G.fx.ring(x, y, color)    // onda circolare
G.sfx(name)               // 'tap' 'good' 'bad' 'pop' 'coin' 'win' 'whoosh' 'chime'
G.say(text)               // sintesi vocale it-IT (rispetta il mute)
G.shake(amount)           // scossa camera leggera (max 8)
```

### Utility
```js
G.rnd(a, b)          // float in [a,b)   |  G.rndi(a,b) intero in [a,b]
G.pick(arr)  G.shuffle(arr)
G.clamp(v,a,b)  G.lerp(a,b,t)
G.ease(t)            // easeOutCubic       | G.easeInOut(t)
G.font(size, weight) // stringa font "900 48px ..."
G.text(str, x, y, {size, color, align, baseline, weight, stroke, maxWidth})
G.roundRect(ctx, x, y, w, h, r)  // path, non riempie
G.shadow(ctx, blur, color, dy)   // imposta ombra; G.noShadow(ctx)
G.saveNow()          // persiste il salvataggio (già debounced: chiamalo pure)
```

### Palette `G.C`
```js
leaf:'#2f8f4e'  leafDark:'#1c5c33'  leafLight:'#63c777'
bark:'#7a4a26'  barkDark:'#4e2f18'  sky:'#8fd8e8'  skyDeep:'#4bb6d6'
sun:'#ffd75e'   sand:'#f2d9a8'      water:'#3fb6c9'
cream:'#fff6e0' ink:'#2b1d12'       shadow:'rgba(20,10,0,.22)'
berry:'#e8536b' plum:'#8f5bd6'      tangerine:'#ff9f43' mint:'#38d9a9'
pinkPop:'#ff6fae' blueberry:'#4d80e4'
dino:'#57c98a'  dinoDark:'#379a67'  dinoBelly:'#f6e7c1'
```

### Account (multi-giocatore)
Ogni bambino ha un account locale: nome, colore del dino, età (→ `G.level`) e un
"segreto" opzionale di 3 icone al posto della password.
```js
G.account            // { id, name, color, level, secret, created } o null
G.accounts.list() / .create(o) / .update(id,patch) / .remove(id) / .login(id) / .logout() / .last()
```
Nei moduli di gioco serve praticamente solo `G.account.name` (per salutare) e
`G.account.color` (colore del dino). `G.level` è già derivato dall'account.

### Salvataggio
`G.save` è un oggetto persistito in `localStorage` per profilo. Il core
garantisce l'esistenza di questi rami; **ogni modulo usa solo il proprio ramo**:
```js
G.save.fruits   // numero (gestito dal core)
G.save.stars    // numero (gestito dal core)
G.save.mute     // bool
G.save.hat      // id cappellino equipaggiato o null   — di 'guardaroba'
G.save.hats     // array di id cappellini posseduti    — di 'guardaroba'
G.save.conta    // ramo libero del minigioco "Conta i Frutti"
G.save.lettere  // ramo libero del minigioco "La Radura delle Lettere"
G.save.fili     // ramo libero del minigioco "Fili Intrecciati"
G.save.nido     // ramo libero della base "Il Nido"
G.save.guardaroba // ramo libero del "Guardaroba" (+ possiede hat/hats)
G.save.casetta  // ramo libero della "Casetta"
G.save.kart     // ramo libero del "Girotondo" ({done, best})
G.save.bus      // ramo libero del "Pulmino" ({done, trips, body, wheels, roof})
G.save.seen     // { nomeScena: bool } — per i tutorial una-tantum
```

**Le stelline sono monotone.** Da quando il negozio è uscito dal Nido, in tutto
`src/` **nessuno decrementa `G.save.stars`**: salgono e basta, e servono a
riempire le casse del Guardaroba (soglie in `starsFor()`). Se un domani si
reintroduce un posto dove spenderle, le soglie delle casse diventano bugiarde e
vanno ritarate. È una decisione di prodotto, non un caso.
Sono `{}` alla prima partita: inizializza le tue chiavi con `??=` dentro `enter()`.

---

## API dell'arte (`src/01-art.js`) — namespace `A`

Tutte disegnano in coordinate logiche, **centrate su (x,y)** salvo diverso avviso.

```js
A.dino(ctx, x, y, s, o)
//   s = altezza in px logici (tipico 120–260). o = {
//     facing: 1|-1, pose: 'idle'|'walk'|'happy'|'think'|'sleep',
//     t: tempo per l'animazione, hat: id|null, color: '#..'  }
//   (x,y) = PIEDI del dino (baricentro a terra)

A.jungle(ctx, t, o)      // fondale giungla a strati (riempie 1280x720)
A.canopy(ctx, t)         // fronde in primo piano (da chiamare dopo il resto)
A.fruit(ctx, x, y, r, kind)   // kind: 'fragola'|'banana'|'uva'|'melone'|'mela'|'cocco'
A.egg(ctx, x, y, s, o)        // o = {crack: 0..1, color}
A.chick(ctx, x, y, s, o)      // dino-cucciolo, o = {t, color}
A.bush(ctx, x, y, s, o)       // o = {berries: bool, color}
A.tree(ctx, x, y, s, o)       // o = {kind:'palma'|'felce'|'grande'}
A.flower(ctx, x, y, s, color)
A.rock(ctx, x, y, s)
A.cloud(ctx, x, y, s)
A.panel(ctx, x, y, w, h, o)   // cartello di legno (x,y = angolo alto-sx)
//   o = { color, border, r, tint }
A.sign(ctx, x, y, w, h, title) // cartello con titolo
A.star(ctx, x, y, r, color)
A.hat(ctx, x, y, s, id)       // disegna un cappello isolato (per le vetrine)
A.HATS                        // [{id, name, price, draw}] catalogo cappellini
A.SHAPES                      // funzioni per le forme dei fili (vedi 21)
```

## Accessori indossabili (`src/01c-art-gear.js`)

```js
A.SLOTS                  // ['testa', 'occhi', 'collo', 'coda']
A.GEAR                   // catalogo unico: [{id, slot, name, pose, say, draw}]
A.gearOf(id)             // voce del catalogo, o null
A.gear(ctx, id, x, y, s, o)   // disegna un pezzo non-cappello
G.look(save, out)        // cosa indossa QUEL salvataggio -> {testa, occhi, collo, coda}
```

`pose` e `say` sono la **reazione**: metti la cuffia e il dino si addormenta
davvero. È la ricompensa principale del Guardaroba e costa zero arte, perché le
pose esistono già in `A.dino`.

Tre regole dure:

1. **Chi passa `gear` o `hat` ad `A.dino` deve passare tutto l'aspetto.** Se non
   passi nulla, `A.dino` risolve da solo il salvataggio corrente. Se passi solo
   `hat`, stai disegnando il dino di qualcun altro e non viene aggiunto niente.
2. **Chi disegna più di un dino nello stesso frame DEVE passare a `G.look` un
   buffer `out` proprio.** Lo fanno la schermata "Chi gioca?", i ritratti e la
   finestrella del fratello. Senza, tutti finiscono vestiti come l'ultimo
   risolto — e per un bimbo di 3 anni non è un glitch, è un furto.
3. **Nessun pezzo può contenere una lettera, una cifra o un logo.** Tutto ciò che
   `A.dino` disegna sta dentro `ctx.scale(facing, 1)` e si specchia quando il
   dino cammina a sinistra. Le forme simmetriche reggono, i glifi no (vedi le
   `z` del sonno, disegnate fuori dalla trasformazione).

## La casa (`src/01d-art-casa.js`)

```js
A.room(ctx, {wall, floor})    // il guscio: parete, battiscopa, pavimento
A.house(ctx, id, x, y, s, o)  // un mobile, o = {c: indice colorway}
A.houseFront(ctx, id, ...)    // il pezzo che va DAVANTI al dino (la coperta)
A.HOUSE / A.HOUSE_FRONT       // i painter per id
A.FLOOR / A.TILT / A.roomDepth(y) / A.roomShadow / A.panelAt / A.jungleIn
```

**Convenzione di ancoraggio: `(x, y)` è il PUNTO DI CONTATTO COL PAVIMENTO**, come
`A.dino`. In giro ci sono già tre convenzioni (`A.egg` e `A.chick` sono centrate,
`A.panel` prende l'angolo alto-sinistra): senza questa riga qualcuno userà il
centro e ogni mobile galleggerà quaranta pixel sopra la sua ombra.

**La legge prospettica**, che è ciò che tiene insieme quattordici oggetti disegnati
a mano: `FLOOR = 470` è l'orizzonte (la stessa quota di `HORIZON` in 01b, così casa
e giungla condividono la linea); **ogni disco orizzontale è un'ellisse di rapporto
`TILT`**, senza eccezioni — se una forma non può esserlo, si disegna di fianco in
elevazione pura; `roomDepth(y)` scala da 0.88 a 1.08 e non di più, perché le pareti
sono ortografiche e un intervallo più largo si legge come "oggetti di dimensioni
diverse", non "oggetti a distanze diverse".

**Vietati, ognuno imparato a caro prezzo:** soffitti e lampadari (vogliono un punto
di fuga che le pareti non hanno); sedie a quattro gambe (35 righe, tre piani, e ogni
bambino sa com'è fatta una sedia, quindi ogni errore si vede — un pouf sono 8 righe
ed è sempre giusto); tavoli e tappeti rettangolari (un rettangolo sul pavimento
annuncia la proiezione che non stiamo facendo); `shadowBlur`; `Math.random`.

**Due stanze, e il catalogo si spezza — mai si duplica.** I dodici mobili da
pavimento sono 2.226px contro 1.100px di banda: con una stanza sola la
sovrapposizione era aritmetica. Divisi su due stanze da due corsie ciascuna
(fondo `y≈524`, fronte `y≈666`) nessuna corsia supera il 63%, e nessuna coppia di
posizioni-base sta sotto i 140px. Se un domani ogni stanza volesse il *suo*
catalogo, si torna al costo d'arte che aveva fatto scegliere una stanza sola.

### Le invarianti della Casetta sono verificate dal test

`test/smoke.js` legge `src/24-casetta.js` e **fallisce** se trova una chiamata a
`G.addFruits`/`G.addStars` (niente rubinetto: è l'unico posto a somma negativa del
gioco), a `Date.now`/`catchUp` (niente orologio: nulla cambia mentre la scena non
gira) o a `setLineDash` (niente sagome di cose non possedute — quel momento è del
Nido). Non sono buoni propositi nei commenti: sono asserzioni.

---

## Scene da implementare

| file | scena | chi |
|---|---|---|
| `src/10-overworld.js` | `giungla` | mappa con il dino che cammina fra i nodi |
| `src/20-conta.js` | `conta` | "La Radura dei Numeri" — matematica |
| `src/21-fili.js` | `fili` | "I Fili Intrecciati" — flow/pallini |
| `src/27-lettere.js` | `lettere` | "La Radura delle Lettere" — composizione di parole |
| `src/22-nido.js` | `nido` | "Il Nido" — idle/tycoon |
| `src/23-guardaroba.js` | `guardaroba` | "Il Guardaroba" — vestizione + casse |
| `src/24-casetta.js` | `casetta` | "La Casetta" — due stanze da arredare coi frutti |
| `src/25-kart.js` | `kart` | "Il Girotondo dei Suoni" — memoria e ritmo, senza eliminazioni |
| `src/26-bus.js` | `bus` | "Il Pulmino" — mappa, priorità e brevi attività laterali |

`src/90-boot.js` (già scritto) gestisce: scelta profilo, menu genitori, avvio.

---

## Test rapido

```
node build.js && node --check index_check.js   # build.js scrive anche il check
```
Apri `index.html` nel browser, ridimensiona la finestra: nessuna deformazione,
nessun errore in console.
