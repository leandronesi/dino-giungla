# Collezione Dino — aggiornamento locale

Avvio: `node tools/serve-collection.js`, poi http://localhost:8088.
Il server serve soltanto le cinque cartelle Dino. Da un tablet sulla stessa rete
si può usare l'indirizzo IP del PC con porta 8088, se consentito dal firewall.
L'installazione offline richiede HTTPS oppure localhost.

## Modifiche

- Kart: indice degli oggetti per segmento al posto della scansione completa;
  interpolazione della camera e degli avversari; proiezione dei kart vicini
  corretta; cinque livree e comportamenti differenti; colline e alberi arrotondati.
- Stazione: due leve comandano un percorso a biforcazioni; il treno segue le
  stesse coordinate dei binari. Le leve si bloccano durante il passaggio.
  Un binario resta impegnato fino al termine della partenza. I treni in attesa
  ripartono con un tocco, così il bambino deve decidere la precedenza.
  Dodici turni e aiuti ritardati secondo l'età.
- Officina: banco, pannello degli attrezzi e finestra ridisegnati senza blur.
  Conservati i cento progetti e il ciclo di montaggio e correzione.
- Run: nuovo progetto autonomo nella cartella `../dino-run`, tre corsie,
  salti, passaggi bassi, tre vite, protezione dopo l'urto, pausa, record e
  soste al tempio per recuperare un cuore riconoscendo un simbolo.
- Accesso: grafica e sequenza di Giungla negli altri quattro giochi;
  dinosauro, nome, colore, età e segreto ordinato di tre figure. Pagine per
  più di quattro profili. Officina conserva la lettura dei simboli precedenti.
  Il cambio di profilo salva subito i progressi del giocatore uscente.
- Canvas limitato a 1440 pixel sul lato lungo e DPR massimo 1,5 negli altri
  quattro giochi. Cache offline separate fra tutti e cinque i giochi.

I profili e i progressi conservano le chiavi originali: l'accesso è uniforme,
ma non è stata introdotta una sincronizzazione degli account fra giochi o dispositivi.
Le librerie di disegno e la UI di accesso sono copie locali per permettere
a ogni gioco di essere distribuito autonomamente, senza dipendenze di rete.

## Verifica

- `node build.js` in ciascun progetto.
- `node test/smoke.js` in Kart, Officina, Stazione e Run.
- `node test/collection-browser.js` da Giungla: Chrome reale, segreti corretti
  e sbagliati, separazione dei profili, dodici turni con le leve, montaggio,
  vite e record Run, simboli al tempio, pausa, viewport tablet e screenshot.
- Immagini in `test/collection-frames/`.

Il test browser registra i tempi dei fotogrammi su desktop e con CPU rallentata
?4. Le misure variano con il carico del PC; non sono una garanzia di prestazioni
sul tablet dei bambini. Pubblicazione richiesta sui cinque repository tramite
commit, push e workflow GitHub Pages.

## Secondo passaggio

Run parte pi? veloce e accelera gradualmente per 150 secondi (limiti distinti
per et?); verificati swipe destra/sinistra/su/gi? con eventi touch Chrome.
Kart usa frecce sinistra/destra e spazio; blur e cambio scena rilasciano lo sterzo.
La musica non completa pi? le risposte in automatico e la voce non copre
ogni nota; palco e strumenti pi? grandi, pulsante Riascolta.
Il pulmino segue le strade, mostra le destinazioni dei passeggeri e richiede
di toccare pompa, carrozzeria o porte; aggiunti ritorno alla mappa e guidatore
nel finestrino.
