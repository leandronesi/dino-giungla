/* OPZIONALE — sincronizzazione fra dispositivi.
   Il gioco funziona benissimo senza: questo serve solo se vuoi che lo stesso
   bambino ritrovi i suoi progressi sia sul tablet sia sul PC.

   Deploy (gratis, 2 minuti):
     1. npm create cloudflare@latest dino-giungla-sync    (scegli "Hello World Worker")
     2. sostituisci src/index.js con questo file
     3. crea un KV namespace e legalo come  SAVES  in wrangler.toml:
          [[kv_namespaces]]
          binding = "SAVES"
          id = "<id che ti da la dashboard>"
     4. npx wrangler deploy
     5. metti l'URL risultante in SYNC_URL dentro src/02-cloud.js, poi `node build.js`

   Nota: non c'e autenticazione. E' un raccoglitore di salvataggi di un gioco
   per bambini, indicizzato da un id casuale; non metterci nulla di sensibile. */

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,PUT,OPTIONS',
  'access-control-allow-headers': 'content-type'
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/save\/([A-Za-z0-9_-]{1,64})$/);

    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (!m) return new Response('not found', { status: 404, headers: CORS });

    const key = 'save:' + m[1];

    if (request.method === 'GET') {
      const v = await env.SAVES.get(key);
      return new Response(v || 'null', {
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...CORS }
      });
    }

    if (request.method === 'PUT') {
      const body = await request.text();
      if (body.length > 200_000) return new Response('too big', { status: 413, headers: CORS });
      try { JSON.parse(body); } catch { return new Response('bad json', { status: 400, headers: CORS }); }
      await env.SAVES.put(key, body, { expirationTtl: 60 * 60 * 24 * 365 });
      return new Response('{"ok":true}', { headers: { 'content-type': 'application/json', ...CORS } });
    }

    return new Response('method not allowed', { status: 405, headers: CORS });
  }
};
