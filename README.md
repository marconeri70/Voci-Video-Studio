# Voci Video Studio

Webapp statica pronta per GitHub Pages.

## Funzioni incluse

- Incolla un articolo o testo
- Carica più foto reali
- Scegli durata 30 / 45 / 60 secondi
- Scegli formato 9:16, 1:1 o 16:9
- Generazione locale di uno storyboard sintetico
- Modifica manuale delle scene
- Anteprima animata con zoom/pan
- Lettura del copione con la voce disponibile nel browser
- Esportazione dello storyboard in JSON
- Supporto installazione come PWA/offline di base

## Pubblicazione su GitHub Pages

1. Crea un nuovo repository GitHub, ad esempio `voci-video-studio`.
2. Carica **tutti i file e le cartelle contenuti in questo ZIP** nella root del repository.
3. Apri `Settings` → `Pages`.
4. In `Build and deployment`, scegli `Deploy from a branch`.
5. Seleziona branch `main` e cartella `/ (root)`.
6. Salva.

Dopo la pubblicazione GitHub mostrerà il link della webapp.

## Struttura

```text
voci-video-studio/
├── index.html
├── manifest.webmanifest
├── service-worker.js
├── config.example.js
├── .nojekyll
├── .gitignore
├── README.md
├── css/
│   └── style.css
├── js/
│   └── app.js
└── assets/
    └── logo.svg
```

## Sicurezza

Non inserire chiavi API di Google, Gemini/Veo, OpenAI, ElevenLabs o altri servizi direttamente nei file JavaScript del repository pubblico.

Le integrazioni AI future dovranno usare un backend o una funzione serverless con variabili d'ambiente.

## Prossimi moduli previsti

- Generazione MP4 finale
- Voce narrante esportata nel video
- Musica e volume automatico
- Sottotitoli impressi nel video
- Intro/outro Segnala Facile
- Animazione AI delle foto tramite API
- Salvataggio progetti
