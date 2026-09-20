# Voci Video Studio V3.2

Webapp statica per GitHub Pages: articolo + foto reali → storyboard → voce naturale ElevenLabs → Reel finale.

## Novità V3.2
- Rendering locale del Reel nel browser.
- Voce ElevenLabs sincronizzata nel video.
- Sottotitoli impressi automaticamente.
- Intro con titolo e outro con CTA Segnala Facile.
- Musica di sottofondo opzionale caricata dall'utente.
- Controlli volume voce/musica.
- 720p consigliata e 1080p opzionale.
- 25/30 fps.
- Salvataggio/apertura progetto `.vvs.json`.
- Download finale MP4 quando supportato; fallback WebM con tentativo di conversione MP4 tramite FFmpeg WebAssembly.

## Pubblicazione GitHub Pages
Carica tutti i file della cartella nella root del repository e abilita Settings → Pages → Deploy from a branch → main → /root.

## Backend voce
`config.js` contiene già l'URL del Worker:
`https://voci-video-studio.vocidicassino.workers.dev`

La chiave ElevenLabs deve restare esclusivamente nel Secret `ELEVENLABS_API_KEY` del Worker Cloudflare.

## Come creare un Reel
1. Incolla articolo e carica foto reali.
2. Crea storyboard.
3. Genera la voce naturale.
4. Facoltativo: carica un brano musicale di cui hai diritto all'uso.
5. Premi `CREA REEL COMPLETO`.
6. Al termine scarica il video.

## Nota sul rendering
Il rendering avviene sul dispositivo e richiede alcuni secondi/minuti a seconda di durata, risoluzione e potenza del PC. La conversione MP4 via FFmpeg viene caricata da CDN solo quando necessaria; se non è disponibile, il video WebM resta comunque scaricabile.


### Libreria musicale integrata
La V3.2 include quattro basi originali: Cronaca sobria, Editoriale moderna, Città soft e Istituzionale soft. È sempre possibile scegliere Nessuna musica oppure caricare un MP3/WAV personale.


## V3.2 — Libreria audio utente
Aggiunti 11 file audio forniti dall’utente, organizzati per News/Cronaca, Jingle/Apertura e Documentario/Riflessivo.
