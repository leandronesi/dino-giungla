# 🦕 Dino Giungla

Un piccolo mondo di giochi per bambini di **3 e 6 anni**. Un dinosauro cammina
in una giungla e si ferma in sei posti:

| Posto | Cosa si fa | Ispirazione |
|---|---|---|
| **La Radura dei Numeri** | conta, somma, sottrai — tutto con oggetti da contare a schermo | *Treasure MathStorm!* |
| **I Fili Intrecciati** | unisci i pallini uguali senza incrociare i fili | *Flow Free* |
| **Il Nido** | compri cespugli e nidi, producono frutti nel tempo, li raccogli | i gestionali/idle |
| **Il Guardaroba** | vesti il tuo dino, e lui reagisce a quello che gli metti | i giochi di vestizione |
| **La Casetta** | arredi due stanze coi frutti, e il dino ci abita davvero | i giochi di arredamento |
| **La Pista dei Gusci** | corri in un guscio d'uovo con quattro amici, e non si perde mai | i kart game |

I frutti si guadagnano giocando e si spendono al Nido — e alla Casetta, che è il
primo posto del gioco dove i frutti comprano qualcosa che **non** produce altri
frutti. Prima era un cerchio chiuso: i frutti compravano produttori, che facevano
altri frutti, e non c'era un motivo per averne che non fosse averne di più. Ora
il Nido ha uno scopo fuori da sé stesso.

Le stelline riempiono le
**casse** del Guardaroba, dove si trovano cappelli, occhiali, papillon e fiocchi
per il proprio dino: è quella la vera ricompensa.

**Niente ha un prezzo.** I pezzi non si comprano: arrivano in casse che si
aprono a mani nude, e una cassa che non è ancora pronta semplicemente non c'è —
non è grigia, non ha un lucchetto. Il guardaroba non sa dire di no.

E la ricompensa non è il pezzo, è la **reazione**: metti la cuffia e il dino si
addormenta davvero, metti il cappello da mago e si mette a pensare. A tre anni
la causa-effetto affidabile è la cosa che si ripete ottanta volte di fila.

**Nessuna pubblicità, nessun acquisto, nessuna rete.** Funziona anche in aereo.
E soprattutto: **non si perde mai.** Nessun timer, nessuna vita, nessuna
schermata triste. Una risposta sbagliata è solo un "riprova".

---

## Due giocatori, due salvataggi

All'avvio si sceglie chi gioca. Ogni bambino ha il suo dino (nome, colore, età)
e il suo salvataggio separato.

L'età scelta imposta la difficoltà, e non è un dettaglio cosmetico:

- **Piccolo (3-4 anni)** — numeri da 1 a 5, griglie 3×3 e 4×4, tutto letto ad
  alta voce dalla sintesi vocale italiana, bottoni enormi, tre soli produttori
  al Nido.
- **Grande (5-7 anni)** — addizioni e sottrazioni entro 10 e poi entro 20,
  addendo mancante, griglie fino a 6×6, cinque produttori con potenziamenti.
  E ai Fili non basta unire i pallini: va **riempita tutta la griglia**. È la
  regola per cui il generatore era già stato scritto — ogni puzzle è una
  partizione di tutte le celle, quindi una soluzione piena esiste sempre. Se
  restano buchi, i buchi pulsano: i fili restano dove sono e basta allungarne
  uno, non si può mai restare bloccati.

Si può cambiare l'età in qualsiasi momento dalle impostazioni.

### Il "segreto" al posto della password

Un bambino di 3 anni non digita una password, ma ricorda benissimo
*cuore → stella → luna*. Quindi la password è una **sequenza di 3 figure**
scelte da una griglia di 9. Si può anche creare un giocatore senza segreto.

> È una **serratura di famiglia**, non sicurezza: tiene un fratello fuori dai
> progressi dell'altra, e basta. I dati stanno in chiaro nel `localStorage` del
> dispositivo.

### Impostazioni (per i genitori)

L'ingranaggio in alto a destra si apre solo **tenendolo premuto ~1,5 secondi**,
e poi chiede una **moltiplicazione** (7 × 8): un bambino di 6 anni non ci passa.
Da lì: cambia giocatore, rinomina, cambia età/colore, azzera i progressi,
elimina un giocatore, schermo intero.

---

## Metterlo sul tablet

### 1. Pubblicarlo (una volta sola)

Crea su GitHub un repo **vuoto e pubblico** chiamato `dino-giungla`
(niente README, niente .gitignore), poi:

```bash
cd dino-giungla
git init && git add -A && git commit -m "Dino Giungla"
git branch -M main
git remote add origin https://github.com/<tuo-utente>/dino-giungla.git
git push -u origin main
```

Poi, **una volta sola**, su GitHub: **Settings → Pages → Source: GitHub
Actions**. Va fatto a mano: creare un sito Pages via API richiede diritti di
admin che il `GITHUB_TOKEN` del workflow non ha, quindi la Action non può
accendersi da sola (fallisce con *"Resource not accessible by integration"*).

Da lì in poi il workflow in
[.github/workflows/deploy.yml](.github/workflows/deploy.yml) ricostruisce
`index.html` da `src/` e pubblica a ogni push su `main`. Il primo deploy
richiede un paio di minuti; li segui in **Actions**. L'indirizzo sarà:

```
https://<tuo-utente>.github.io/dino-giungla/
```

> **Perché pubblico.** Con un account GitHub Free, Pages pubblica solo da repo
> pubbliche (su repo private serve un piano Pro/Team). Non è un problema: nel
> repo non c'è niente di personale. Nomi dei bambini, età e segreti a 3 figure
> si creano giocando e restano nel `localStorage` del tablet — non entrano mai
> nel codice. Se ti serve davvero una repo privata, l'alternativa gratuita è
> Cloudflare Pages (build: `node build.js && node make-icons.js`).

### 2. Installarlo sul tablet

Apri quell'indirizzo con **Chrome sul tablet** → menu **⋮** → **Aggiungi a
schermata Home**. Da lì in poi è un'icona come le altre, parte a schermo intero
senza barre del browser, e **funziona anche senza connessione** (il service
worker si tiene tutto in cache al primo avvio).

Tienilo in orizzontale: in verticale compare un "gira il tablet".

### 3. Senza pubblicarlo

Sulla rete di casa basta:

```bash
node --version && npx serve -l 8080 .    # oppure qualunque server statico
```

e apri `http://<ip-del-pc>:8080` dal tablet. (Il `file://` diretto **no**:
Chrome su Android non dà un `localStorage` affidabile, i salvataggi si
perderebbero.)

---

## Sincronizzare fra tablet e PC (opzionale)

Di default ogni dispositivo ha i suoi salvataggi. Se vuoi che lo stesso bambino
ritrovi i progressi ovunque, in [server/worker.js](server/worker.js) c'è un
Cloudflare Worker da 40 righe con le istruzioni: si deploya gratis, si mette
l'URL in `SYNC_URL` dentro [src/02-cloud.js](src/02-cloud.js), si rifà `node build.js`.
Senza URL, tutto il codice di sync è inerte.

---

## Com'è fatto

Niente framework, niente build tool, niente dipendenze. **Un solo `<canvas>`**
e tutta la grafica disegnata a runtime — nessuna immagine, nessun font
scaricato, nessuna emoji (rendono diverse su ogni dispositivo).

```
src/00-core.js      motore: mondo logico 1280×720, scene, UI a modo immediato,
                    audio sintetizzato, voce it-IT, salvataggi, effetti, HUD
src/01-art.js       tutta la grafica procedurale (namespace A): dino, giungla,
                    frutti, uova, cappellini, forme
src/01c-art-gear.js accessori indossabili (occhi, collo, coda), il catalogo
                    unico con le reazioni, e G.look: cosa indossa un salvataggio
src/02-cloud.js     sincronizzazione opzionale (inerte se non configurata)
src/10-overworld.js la giungla: mondo largo 2560, camera che segue il dino,
                    sei postazioni e due frecce per saltare da una meta a l altra
src/20-conta.js     La Radura dei Numeri
src/21-fili.js      I Fili Intrecciati (con generatore di griglie risolvibili)
src/22-nido.js      Il Nido
src/01d-art-casa.js il guscio della stanza, la legge prospettica e i mobili
src/23-guardaroba.js Il Guardaroba: casse, baule dei giocattoli, specchio,
                    ritratti, e il dino del fratello in sola lettura
src/24-casetta.js   La Casetta: due stanze, il negozio, il dino che ci abita
src/25-kart.js      La Pista: pista analitica, gara senza sconfitta, amici
src/90-account.js   accesso, nuovo giocatore, segreto, impostazioni genitori
src/99-boot.js      avvio, schermo intero, wake lock
```

`build.js` concatena `src/*.js` in ordine alfabetico dentro un unico
`index.html` autoportante, controlla la sintassi, e rigenera `sw.js` con una
nuova versione di cache. Il numero davanti al nome del file **è** l'ordine di
caricamento: è quella la sola "configurazione" del progetto.

```bash
node build.js        # ricostruisce index.html + sw.js
node make-icons.js   # rigenera le icone PNG (raro)
```

Le regole a cui ogni modulo deve stare — API del core, palette, tap target,
"mai uno stato di fallimento" — sono in [CONTRACT.md](CONTRACT.md).

### Aggiungere un minigioco

1. crea `src/23-tuogioco.js` con un IIFE che chiama `G.scene('tuogioco', {...})`
2. aggiungi la postazione in `src/10-overworld.js`
3. `node build.js`

---

## Nota per chi lo eredita

Il gioco è pensato perché un adulto **non debba stare seduto accanto**. Se
qualcosa richiede di saper leggere, di andare di fretta, o punisce un errore,
è un bug — non una scelta di design.
