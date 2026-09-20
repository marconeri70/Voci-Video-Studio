# Attivare la voce narrante naturale

La V2 funziona subito con le voci installate nel dispositivo. Per la voce AI realistica usa il Worker Cloudflare incluso nel progetto.

## 1. Crea una chiave ElevenLabs

1. Accedi a ElevenLabs.
2. Apri le impostazioni/API Keys.
3. Crea una chiave API.
4. Non inserirla mai in `config.js` o in altri file pubblici GitHub.

## 2. Pubblica il Worker Cloudflare

Serve un account Cloudflare.

Apri un terminale nella cartella `worker` e lancia:

```bash
npm install
npx wrangler login
npx wrangler secret put ELEVENLABS_API_KEY
```

Quando richiesto, incolla la chiave ElevenLabs.

Poi modifica `worker/wrangler.toml` e imposta il dominio GitHub Pages:

```toml
ALLOWED_ORIGIN = "https://TUO-USERNAME.github.io"
```

Pubblica:

```bash
npm run deploy
```

Wrangler mostrerà un URL simile a:

```text
https://voci-video-voice.nomeutente.workers.dev
```

## 3. Collega la webapp

Apri `config.js` nella root del progetto e inserisci solo l'URL del Worker:

```js
window.VVS_CONFIG = {
  apiBaseUrl: 'https://voci-video-voice.nomeutente.workers.dev'
};
```

Salva e carica la nuova versione su GitHub.

## 4. Uso

1. Crea lo storyboard.
2. Controlla il testo nel campo `Copione voce`.
3. Seleziona una voce.
4. Lascia `Giornalistica naturale` per iniziare.
5. Premi `Genera voce naturale`.
6. Ascolta il risultato e, se ti piace, premi `Scarica MP3`.

## Come rendere la voce meno robotica

- frasi non troppo lunghe;
- punteggiatura naturale;
- velocità 0,93–0,98× per un servizio giornalistico;
- espressività media (45–60);
- evitare testi tutti in maiuscolo;
- scrivere sigle e numeri come devono essere pronunciati quando necessario.

La webapp applica già alcune correzioni automatiche al copione prima della sintesi.
