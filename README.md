# Voci Video Studio V2.3

Webapp pronta per GitHub Pages, con nuova sezione **voce narrante naturale**.

## Novità V2

- Copione narratore separato e modificabile
- Normalizzazione del testo per una pronuncia più naturale
- Modalità **AI realistica ElevenLabs** tramite backend sicuro
- Preset: giornalistica, calda, incisiva, neutra
- Controllo espressività e velocità
- Player audio integrato
- Download del file MP3 generato
- Fallback con le voci italiane del dispositivo
- Selezione automatica preferenziale di voci Natural/Premium/Enhanced
- Worker Cloudflare già incluso: la chiave API non finisce mai su GitHub Pages

## Funzioni della V1 mantenute

- Articolo/testo → storyboard
- Foto reali multiple
- Durata 30 / 45 / 60 secondi
- Formati 9:16, 1:1 e 16:9
- Modifica scene
- Anteprima con zoom/pan
- Esportazione storyboard JSON
- PWA/offline per il frontend

## Pubblicazione frontend su GitHub Pages

1. Carica tutti i file e le cartelle di questo progetto nella root del repository.
2. GitHub → `Settings` → `Pages`.
3. `Deploy from a branch` → `main` → `/ (root)`.
4. Salva.

La modalità voce dispositivo funziona senza backend.

## Attivazione voce AI naturale

Leggi **SETUP_VOCE_NATURALE.md**.

In sintesi:

1. ottieni una chiave ElevenLabs;
2. pubblichi la cartella `worker` su Cloudflare Workers;
3. salvi la chiave come secret `ELEVENLABS_API_KEY`;
4. metti l'URL del Worker in `config.js`.

## Struttura

```text
voci-video-studio-v2/
├── index.html
├── config.js
├── config.example.js
├── SETUP_VOCE_NATURALE.md
├── manifest.webmanifest
├── service-worker.js
├── .nojekyll
├── .gitignore
├── README.md
├── css/
│   └── style.css
├── js/
│   └── app.js
├── assets/
│   └── logo.svg
└── worker/
    ├── package.json
    ├── wrangler.toml
    ├── README.md
    └── src/
        └── index.js
```

## Sicurezza

Non inserire mai `ELEVENLABS_API_KEY` in `config.js`, `app.js` o altri file pubblici. Il frontend deve conoscere solo l'URL pubblico del Worker.

## Prossima fase

La base V2 è pronta per collegare l'MP3 della voce al rendering finale del Reel, aggiungendo musica, sottotitoli sincronizzati e generazione MP4.


## Configurazione Worker collegata

Questa build è già configurata per usare:
`https://voci-video-studio.vocidicassino.workers.dev`

Non inserire mai la chiave ElevenLabs nei file del frontend.


## Se compare ancora la vecchia interfaccia
Dopo aver caricato tutti i file, apri una volta `reset.html` dal sito GitHub Pages. La pagina elimina il vecchio service worker/cache e riapre automaticamente la V2.3.
