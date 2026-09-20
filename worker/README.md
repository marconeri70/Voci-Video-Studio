# Worker voce naturale

Questo Worker tiene segreta la chiave ElevenLabs e offre al frontend due endpoint:

- `GET /voices`
- `POST /tts`

## Segreto richiesto

```bash
npx wrangler secret put ELEVENLABS_API_KEY
```

## Origine consentita

In `wrangler.toml`, imposta `ALLOWED_ORIGIN` sul dominio della webapp, ad esempio:

```toml
ALLOWED_ORIGIN = "https://nomeutente.github.io"
```

Poi:

```bash
npm install
npm run deploy
```

Copia l'URL `https://...workers.dev` ottenuto e inseriscilo nel file `/config.js` del frontend.
