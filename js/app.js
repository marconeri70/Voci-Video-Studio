const $ = (s) => document.querySelector(s);
const storyEl = $('#story');
const canvas = $('#canvas');
const ctx = canvas.getContext('2d');

let files = [];
let scenes = [];
let playing = false;
let raf = 0;
let startTime = 0;
let audioBlobUrl = '';
let generatedAudioBlob = null;
let browserVoices = [];
let finalVideoBlob = null;
let finalVideoUrl = '';
let musicObjectUrl = '';

const builtInMusic = {
  cronaca: './assets/music/cronaca-sobria.mp3',
  editoriale: './assets/music/editoriale-moderna.mp3',
  citta: './assets/music/citta-soft.mp3',
  istituzionale: './assets/music/istituzionale-soft.mp3',
  alex_news: './assets/music/alex-news-background.mp3',
  audiodollar_news: './assets/music/audiodollar-news-background.mp3',
  elevenlabs_jingle: './assets/music/elevenlabs-headline-jingle.mp3',
  elislane_news: './assets/music/elislane-news.mp3',
  better_today: './assets/music/better-today-documentary.mp3',
  mrwashington_jingle: './assets/music/mrwashington-news-jingle.mp3',
  thinking_time: './assets/music/thinking-time.mp3',
  news_sports: './assets/music/news-and-sports.mp3',
  sigma_news: './assets/music/sigmamusicart-news-background.mp3',
  mountain_news: './assets/music/the-mountain-news.mp3',
  breaking_news: './assets/music/breaking-news.mp3',
};

const API_BASE = String(window.VVS_CONFIG?.apiBaseUrl || '').replace(/\/$/, '');

const stopwords = new Set(
  'il lo la i gli le un uno una di a da in con su per tra fra e ed o ma che del dello della dei degli delle al allo alla ai agli alle nel nello nella nei negli nelle sul sullo sulla sui sugli sulle come più anche non si è sono essere questo questa questi queste quello quella quelli quelle'.split(' ')
);

const voicePresets = {
  news: { stability: 0.48, similarity_boost: 0.78, style: 0.18, speed: 0.96 },
  warm: { stability: 0.40, similarity_boost: 0.76, style: 0.30, speed: 0.94 },
  incisive: { stability: 0.38, similarity_boost: 0.80, style: 0.34, speed: 1.00 },
  neutral: { stability: 0.58, similarity_boost: 0.75, style: 0.06, speed: 0.97 },
};

function sentences(text) {
  return text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/).filter(Boolean);
}

function summarize(text, count) {
  const list = sentences(text);
  if (!list.length) return [];
  const words = text.toLowerCase().match(/[a-zàèéìòù0-9]{3,}/g) || [];
  const freq = {};
  words.forEach((word) => { if (!stopwords.has(word)) freq[word] = (freq[word] || 0) + 1; });
  const scored = list.map((sentence, index) => ({
    sentence, index,
    score: (sentence.toLowerCase().match(/[a-zàèéìòù0-9]{3,}/g) || []).reduce((acc, word) => acc + (freq[word] || 0), 0) / (sentence.length || 1),
  }));
  const top = scored.sort((a, b) => b.score - a.score).slice(0, count).sort((a, b) => a.index - b.index).map((item) => item.sentence);
  return top.length ? top : list.slice(0, count);
}

function makeTitle(text) {
  const first = sentences(text)[0] || 'Voci di Cassino';
  return first.replace(/[.!?]+$/, '').slice(0, 92);
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function naturalizeNarration(text) {
  return text.replace(/\s+/g, ' ').replace(/\s*[-–—]\s*/g, ', ').replace(/\b([A-ZÀ-ÖØ-Þ]{4,})\b/g, (word) => word.charAt(0) + word.slice(1).toLowerCase()).replace(/([.!?])(?=[A-ZÀÈÉÌÒÙ])/g, '$1 ').replace(/\.{2,}/g, '.').trim();
}

function narrationFromScenes() {
  const body = scenes.map((scene) => scene.text.trim()).filter(Boolean).join(' ');
  const cta = $('#cta').value.trim();
  return naturalizeNarration([body, cta].filter(Boolean).join(' '));
}

function syncNarration() { $('#narration').value = narrationFromScenes(); updateCharCount(); }
function updateCharCount() { $('#charCount').textContent = `${$('#narration').value.length.toLocaleString('it-IT')} caratteri`; }

function distributeSceneSeconds(total, count) {
  const base = Math.floor(total / count);
  let rest = total - base * count;
  return Array.from({ length: count }, () => base + (rest-- > 0 ? 1 : 0));
}

async function build() {
  const article = $('#article').value.trim();
  files = [...$('#images').files];
  if (!article) { $('#status').textContent = 'Inserisci prima un articolo.'; return; }
  $('#status').textContent = 'Creazione storyboard...';
  const duration = Number($('#duration').value);
  const sceneCount = Math.max(4, Math.min(files.length || 6, Math.round(duration / 7)));
  const summary = summarize(article, sceneCount);
  if (!$('#title').value.trim()) $('#title').value = makeTitle(article);
  const urls = await Promise.all(files.map(fileToDataURL));
  const secs = distributeSceneSeconds(duration, sceneCount);
  scenes = Array.from({ length: sceneCount }, (_, i) => ({
    text: summary[i] || summary[summary.length - 1] || article.slice(0, 180),
    img: urls[i % Math.max(urls.length, 1)] || null,
    seconds: secs[i],
  }));
  renderStory(); syncNarration(); drawIdle();
  $('#status').textContent = `Storyboard creato: ${scenes.length} scene.`;
}

function renderStory() {
  storyEl.innerHTML = '';
  scenes.forEach((scene, index) => {
    const row = document.createElement('div');
    row.className = 'scene';
    row.innerHTML = `${scene.img ? `<img class="thumb" src="${scene.img}" alt="Anteprima scena ${index + 1}">` : '<div class="thumb"></div>'}<div><span class="badge">Scena ${index + 1}</span><textarea data-i="${index}" aria-label="Testo scena ${index + 1}">${scene.text}</textarea><div class="meta">${scene.seconds}s • zoom/pan leggero</div></div><button class="secondary compactButton" data-del="${index}" aria-label="Elimina scena ${index + 1}">×</button>`;
    storyEl.appendChild(row);
  });
  storyEl.querySelectorAll('textarea').forEach((textarea) => { textarea.oninput = (event) => { scenes[Number(event.target.dataset.i)].text = event.target.value; }; });
  storyEl.querySelectorAll('[data-del]').forEach((button) => { button.onclick = (event) => { scenes.splice(Number(event.target.dataset.del), 1); renderStory(); syncNarration(); drawIdle(); }; });
}

function getDimensions(format = $('#format').value, quality = 1080) {
  if (format === '1:1') return { width: quality, height: quality };
  if (format === '16:9') return quality === 1080 ? { width: 1920, height: 1080 } : { width: 1280, height: 720 };
  return quality === 1080 ? { width: 1080, height: 1920 } : { width: 720, height: 1280 };
}

function fitCanvas() { const d = getDimensions($('#format').value, 1080); canvas.width = d.width; canvas.height = d.height; }
function wrapTextFor(c, text, maxWidth, fontSize, weight = 700, maxLines = 5) {
  c.font = `${weight} ${fontSize}px Arial`; const words = String(text || '').split(' '); const lines = []; let line = '';
  for (const word of words) { const test = `${line} ${word}`.trim(); if (c.measureText(test).width > maxWidth && line) { lines.push(line); line = word; } else line = test; }
  if (line) lines.push(line); return lines.slice(0, maxLines);
}
function drawBackgroundOn(c, target, img, progress) {
  c.fillStyle = '#000'; c.fillRect(0, 0, target.width, target.height); if (!img) return;
  const scale = Math.max(target.width / img.width, target.height / img.height) * (1 + 0.075 * progress);
  const w = img.width * scale, h = img.height * scale;
  const x = (target.width - w) / 2 + Math.sin(progress * Math.PI) * target.width * 0.012;
  const y = (target.height - h) / 2 - progress * target.height * 0.018;
  c.globalAlpha = 0.94; c.drawImage(img, x, y, w, h); c.globalAlpha = 1;
  const gradient = c.createLinearGradient(0, 0, 0, target.height); gradient.addColorStop(0, 'rgba(0,0,0,.18)'); gradient.addColorStop(.58, 'rgba(0,0,0,.12)'); gradient.addColorStop(1, 'rgba(0,0,0,.82)'); c.fillStyle = gradient; c.fillRect(0, 0, target.width, target.height);
}
function loadImage(src) { return new Promise((resolve) => { if (!src) return resolve(null); const image = new Image(); image.onload = () => resolve(image); image.onerror = () => resolve(null); image.src = src; }); }

async function drawScene(scene, progress = 0, index = 0) {
  fitCanvas(); const img = await loadImage(scene?.img); drawBackgroundOn(ctx, canvas, img, progress);
  const padding = canvas.width * .07, fontSize = Math.max(34, Math.round(canvas.width * .055)); const lines = wrapTextFor(ctx, scene?.text || 'Inserisci contenuto', canvas.width - padding * 2, fontSize); let y = canvas.height * .66;
  ctx.textBaseline = 'top'; lines.forEach((line) => { ctx.font = `700 ${fontSize}px Arial`; ctx.fillStyle = 'rgba(0,0,0,.48)'; ctx.fillText(line, padding + 3, y + 3); ctx.fillStyle = '#fff'; ctx.fillText(line, padding, y); y += fontSize * 1.18; });
  ctx.font = `700 ${Math.max(24, canvas.width * .025)}px Arial`; ctx.fillStyle = '#fff'; ctx.fillText('VOCI DI CASSINO', padding, canvas.height - padding * 1.25); ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillText(`${index + 1}/${Math.max(1, scenes.length)}`, canvas.width - padding, canvas.height - padding * 1.25); ctx.textAlign = 'left';
}
async function drawIdle() { fitCanvas(); await drawScene(scenes[0] || { text: $('#title').value || 'Voci Video Studio V3.2', img: null }, 0, 0); }

async function play() {
  if (!scenes.length) { $('#status').textContent = 'Crea prima lo storyboard.'; return; }
  if (playing) { playing = false; cancelAnimationFrame(raf); $('#play').textContent = '▶ Anteprima'; return; }
  playing = true; $('#play').textContent = '■ Ferma'; startTime = performance.now(); const total = scenes.reduce((a, s) => a + s.seconds, 0);
  async function frame(now) {
    if (!playing) return; const time = (now - startTime) / 1000;
    if (time >= total) { playing = false; $('#play').textContent = '▶ Anteprima'; await drawIdle(); return; }
    let elapsed = 0, index = 0; for (; index < scenes.length; index += 1) { if (time < elapsed + scenes[index].seconds) break; elapsed += scenes[index].seconds; }
    const progress = (time - elapsed) / scenes[index].seconds; await drawScene(scenes[index], progress, index); raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
}

function rankBrowserVoice(voice) { let score = 0; const name = voice.name.toLowerCase(), lang = String(voice.lang || '').toLowerCase(); if (lang === 'it-it') score += 100; else if (lang.startsWith('it')) score += 80; if (/natural|premium|enhanced|neural|online/.test(name)) score += 30; if (/microsoft|google|apple/.test(name)) score += 10; if (voice.localService) score += 3; return score; }
function loadBrowserVoices() { if (!('speechSynthesis' in window)) return; browserVoices = speechSynthesis.getVoices().filter((v) => String(v.lang || '').toLowerCase().startsWith('it')).sort((a, b) => rankBrowserVoice(b) - rankBrowserVoice(a)); const select = $('#browserVoice'); select.innerHTML = ''; if (!browserVoices.length) { select.innerHTML = '<option value="">Nessuna voce italiana trovata</option>'; return; } browserVoices.forEach((v, i) => { const o = document.createElement('option'); o.value = String(i); o.textContent = `${v.name} — ${v.lang}${i === 0 ? ' ★ consigliata' : ''}`; select.appendChild(o); }); }
function speakBrowser() { if (!('speechSynthesis' in window)) return; const text = naturalizeNarration($('#narration').value.trim()); if (!text) { $('#voiceStatus').textContent = 'Inserisci o genera prima il copione voce.'; return; } speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text), selected = browserVoices[Number($('#browserVoice').value || 0)]; if (selected) u.voice = selected; u.lang = selected?.lang || 'it-IT'; u.rate = Number($('#browserRate').value) / 100; speechSynthesis.speak(u); }
function stopBrowserSpeech() { if ('speechSynthesis' in window) speechSynthesis.cancel(); }
function setCloudState(ok, text) { const b = $('#cloudState'); b.textContent = text; b.classList.toggle('on', ok); b.classList.toggle('off', !ok); }

async function loadCloudVoices() {
  const select = $('#cloudVoice'); if (!API_BASE) { setCloudState(false, 'Cloud non configurato'); select.innerHTML = '<option value="">Configura config.js</option>'; return; }
  setCloudState(false, 'Connessione...'); $('#voiceStatus').textContent = 'Caricamento voci disponibili...';
  try {
    const response = await fetch(`${API_BASE}/voices`, { headers: { Accept: 'application/json' } }); if (!response.ok) throw new Error(await response.text() || `Errore ${response.status}`); const data = await response.json(); const voices = Array.isArray(data.voices) ? data.voices : []; select.innerHTML = '';
    if (!voices.length) { select.innerHTML = '<option value="">Nessuna voce API compatibile</option>'; throw new Error('Nessuna voce disponibile via API.'); }
    voices.forEach((voice) => { const option = document.createElement('option'); option.value = voice.voice_id; const accent = voice.labels?.accent ? ` • ${voice.labels.accent}` : ''; const useCase = voice.labels?.use_case ? ` • ${voice.labels.use_case}` : ''; const category = voice.category ? ` • ${voice.category}` : ''; option.textContent = `${voice.name || 'Voce'}${category}${accent}${useCase}`; select.appendChild(option); });
    setCloudState(true, data.tier === 'free' ? 'Cloud connesso • Free' : 'Cloud connesso'); const filteredText = data.filtered ? ` ${data.filtered} voci Professional escluse sul piano Free.` : ''; $('#voiceStatus').textContent = `${voices.length} voci compatibili caricate.${filteredText}`;
  } catch (error) { setCloudState(false, 'Cloud non disponibile'); $('#voiceStatus').textContent = `Connessione voce: ${error.message}`; }
}
function getCloudVoiceSettings() { const base = { ...voicePresets[$('#voicePreset').value] }; const expressive = Number($('#expressiveness').value) / 100; base.stability = Math.max(.25, Math.min(.75, .70 - expressive * .48)); base.style = Math.max(0, Math.min(.55, expressive * .55)); base.speed = Number($('#cloudSpeed').value) / 100; return base; }
async function requestNaturalVoice(text, autoPlay = true) {
  const voiceId = $('#cloudVoice').value; if (!API_BASE) throw new Error('Manca l’URL del Worker in config.js.'); if (!text) throw new Error('Il testo della voce è vuoto.'); if (!voiceId) throw new Error('Seleziona una voce ElevenLabs.');
  const response = await fetch(`${API_BASE}/tts`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'audio/mpeg' }, body: JSON.stringify({ text, voice_id: voiceId, model_id: $('#cloudModel').value, voice_settings: getCloudVoiceSettings() }) });
  if (!response.ok) { let detail = ''; try { const payload = await response.json(); detail = typeof payload?.error === 'string' ? payload.error : JSON.stringify(payload?.error || payload); } catch { detail = await response.text(); } throw new Error(detail || `Errore ${response.status}`); }
  generatedAudioBlob = await response.blob(); if (!generatedAudioBlob.size) throw new Error('ElevenLabs ha restituito un file audio vuoto.'); if (audioBlobUrl) URL.revokeObjectURL(audioBlobUrl); audioBlobUrl = URL.createObjectURL(generatedAudioBlob); const player = $('#voicePlayer'); player.src = audioBlobUrl; player.load(); $('#downloadVoice').disabled = false; if (autoPlay) { try { await player.play(); } catch {} } return generatedAudioBlob;
}
async function testNaturalVoice() { const button = $('#testVoice'); button.disabled = true; button.textContent = 'Test in corso...'; $('#voiceStatus').textContent = 'Genero una prova breve...'; try { const blob = await requestNaturalVoice('Questa è una prova di Voci Video Studio. La voce narrante è pronta per il tuo prossimo reel.', true); $('#voiceStatus').textContent = `Test riuscito: ${(blob.size / 1024).toFixed(0)} KB.`; } catch (e) { $('#voiceStatus').textContent = `TEST NON RIUSCITO: ${e.message}`; } finally { button.disabled = false; button.textContent = '▶ Test voce'; } }
async function generateNaturalVoice() { const text = naturalizeNarration($('#narration').value.trim()); if (!text) { $('#voiceStatus').textContent = 'Inserisci o genera prima il copione voce.'; return; } const b = $('#generateVoice'); b.disabled = true; b.textContent = 'Generazione...'; $('#voiceStatus').textContent = 'Sto creando la voce naturale...'; try { const blob = await requestNaturalVoice(text, true); $('#voiceStatus').textContent = `Voce creata: ${(blob.size / 1024).toFixed(0)} KB. Ora puoi creare il Reel completo.`; } catch (e) { $('#voiceStatus').textContent = `Generazione non riuscita: ${e.message}`; } finally { b.disabled = false; b.textContent = '✨ Genera voce naturale'; } }
function downloadVoice() { if (!generatedAudioBlob || !audioBlobUrl) return; const a = document.createElement('a'); a.href = audioBlobUrl; a.download = `${safeFileName($('#title').value || 'narrazione')}.mp3`; a.click(); }
function setVoiceTab(tab) { const cloud = tab === 'cloud'; $('#tabCloud').classList.toggle('active', cloud); $('#tabBrowser').classList.toggle('active', !cloud); $('#cloudPanel').classList.toggle('hidden', !cloud); $('#browserPanel').classList.toggle('hidden', cloud); }

function safeFileName(s) { return String(s || 'voci-video').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'voci-video'; }
function getProjectData() { return { app: 'Voci Video Studio', version: '3.2', article: $('#article').value, title: $('#title').value, cta: $('#cta').value, duration: $('#duration').value, format: $('#format').value, style: $('#style').value, narration: $('#narration').value, render: { quality: $('#renderQuality').value, fps: $('#fps').value, mode: $('#renderMode').value, intro: $('#useIntro').checked, outro: $('#useOutro').checked, subtitles: $('#useSubtitles').checked, voiceVolume: $('#voiceVolume').value, musicVolume: $('#musicVolume').value, musicPreset: $('#musicPreset').value }, voice: { cloud_voice_id: $('#cloudVoice').value, model: $('#cloudModel').value, preset: $('#voicePreset').value, settings: getCloudVoiceSettings() }, scenes: scenes.map(({ text, seconds, img }) => ({ text, seconds, img })) }; }
function saveProjectFile() { const blob = new Blob([JSON.stringify(getProjectData(), null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${safeFileName($('#title').value || 'voci-video-progetto')}.vvs.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
async function loadProjectFile(file) { try { const data = JSON.parse(await file.text()); $('#article').value = data.article || ''; $('#title').value = data.title || ''; $('#cta').value = data.cta || $('#cta').value; $('#duration').value = data.duration || '45'; $('#format').value = data.format || '9:16'; $('#style').value = data.style || 'news'; $('#narration').value = data.narration || ''; scenes = Array.isArray(data.scenes) ? data.scenes.map(s => ({ text: s.text || '', seconds: Number(s.seconds) || 6, img: s.img || null })) : []; if (data.render) { $('#renderQuality').value = data.render.quality || '720'; $('#fps').value = data.render.fps || '25'; $('#renderMode').value = data.render.mode || 'adapt'; $('#useIntro').checked = data.render.intro !== false; $('#useOutro').checked = data.render.outro !== false; $('#useSubtitles').checked = data.render.subtitles !== false; $('#voiceVolume').value = data.render.voiceVolume || '100'; $('#musicVolume').value = data.render.musicVolume || '12'; $('#musicPreset').value = data.render.musicPreset || 'cronaca'; updateMusicUi(); } renderStory(); updateCharCount(); bindRangeLabels(); await drawIdle(); $('#status').textContent = 'Progetto caricato. Rigenera la voce naturale prima del rendering finale.'; } catch (e) { $('#status').textContent = `Impossibile aprire il progetto: ${e.message}`; } }
function exportStoryboard() { const data = getProjectData(); data.scenes = data.scenes.map(({ text, seconds }) => ({ text, seconds })); const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'voci-video-storyboard-v3.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }

function clearAll() { stopBrowserSpeech(); stopMusicPreview(); $('#article').value = ''; $('#title').value = ''; $('#images').value = ''; $('#narration').value = ''; $('#musicFile').value = ''; $('#musicPreset').value = 'cronaca'; updateMusicUi(); scenes = []; files = []; generatedAudioBlob = null; if (audioBlobUrl) URL.revokeObjectURL(audioBlobUrl); audioBlobUrl = ''; if (musicObjectUrl) URL.revokeObjectURL(musicObjectUrl); musicObjectUrl = ''; resetFinalVideo(); renderStory(); updateCharCount(); drawIdle(); $('#status').textContent = 'Azzerato.'; }
function loadDemo() { $('#article').value = 'A Cassino cresce l’attenzione dei cittadini sulla manutenzione urbana. Le segnalazioni riguardano strade, verde pubblico, illuminazione e decoro. Il tema non è soltanto intervenire quando il problema diventa evidente, ma programmare controlli e manutenzione con continuità. I cittadini chiedono tempi chiari, trasparenza sugli interventi e una comunicazione più puntuale. Voci di Cassino continuerà a raccogliere segnalazioni e a verificare i fatti, distinguendo sempre tra problemi documentati, responsabilità accertate e opinioni.'; $('#title').value = 'CASSINO, MANUTENZIONE E SEGNALAZIONI: I CITTADINI CHIEDONO RISPOSTE'; build(); }


function updateMusicUi() {
  const custom = $('#musicPreset').value === 'custom';
  const wrap = $('#customMusicWrap');
  if (wrap) wrap.classList.toggle('hidden', !custom);
}
function stopMusicPreview() {
  const player = $('#musicPreviewPlayer');
  if (!player) return;
  player.pause();
  try { player.currentTime = 0; } catch {}
  if (musicObjectUrl) { URL.revokeObjectURL(musicObjectUrl); musicObjectUrl = ''; }
  if ($('#musicPreset').value === 'custom') player.removeAttribute('src');
}
function getSelectedMusicUrl({ forPreview = false } = {}) {
  const preset = $('#musicPreset').value;
  if (preset === 'none') return '';
  if (preset === 'custom') {
    const file = $('#musicFile').files?.[0];
    if (!file) return '';
    if (forPreview) {
      if (musicObjectUrl) URL.revokeObjectURL(musicObjectUrl);
      musicObjectUrl = URL.createObjectURL(file);
      return musicObjectUrl;
    }
    return URL.createObjectURL(file);
  }
  return builtInMusic[preset] || '';
}
async function previewSelectedMusic() {
  const preset = $('#musicPreset').value;
  if (preset === 'none') { $('#renderStatus').textContent = 'Hai scelto “Nessuna musica”.'; return; }
  const url = getSelectedMusicUrl({ forPreview: true });
  if (!url) { $('#renderStatus').textContent = 'Seleziona un file MP3/WAV personale oppure scegli una base inclusa.'; return; }
  const player = $('#musicPreviewPlayer');
  player.src = url; player.loop = true; player.volume = Math.min(1, Number($('#musicVolume').value) / 100);
  player.load();
  try { await player.play(); $('#renderStatus').textContent = 'Anteprima musica in riproduzione.'; }
  catch (e) { $('#renderStatus').textContent = `Non riesco ad avviare l’anteprima musicale: ${e.message}`; }
}

function getAudioDuration(blob) { return new Promise((resolve) => { if (!blob) return resolve(0); const url = URL.createObjectURL(blob), audio = new Audio(); audio.preload = 'metadata'; audio.onloadedmetadata = () => { const d = Number.isFinite(audio.duration) ? audio.duration : 0; URL.revokeObjectURL(url); resolve(d); }; audio.onerror = () => { URL.revokeObjectURL(url); resolve(0); }; audio.src = url; }); }
function splitCaptionChunks(text, maxWords = 8) { const words = naturalizeNarration(text).split(/\s+/).filter(Boolean); const chunks = []; for (let i = 0; i < words.length; i += maxWords) chunks.push(words.slice(i, i + maxWords).join(' ')); return chunks; }
function captionAtTime(chunks, bodyTime, bodyDuration) { if (!chunks.length || bodyDuration <= 0) return ''; const idx = Math.min(chunks.length - 1, Math.floor((bodyTime / bodyDuration) * chunks.length)); return chunks[Math.max(0, idx)] || ''; }
async function makeImageCache() { const map = new Map(); await Promise.all(scenes.map(async s => { if (s.img && !map.has(s.img)) map.set(s.img, await loadImage(s.img)); })); return map; }

function drawCaption(c, target, text) {
  if (!text) return; const pad = target.width * .055; const fs = Math.max(30, Math.round(target.width * .044)); const lines = wrapTextFor(c, text, target.width - pad * 2, fs, 700, 3); const lineH = fs * 1.18; const boxH = lines.length * lineH + pad * .55; const y = target.height - boxH - target.height * .075;
  c.fillStyle = 'rgba(0,0,0,.68)'; c.fillRect(pad * .45, y - pad * .18, target.width - pad * .9, boxH);
  c.font = `700 ${fs}px Arial`; c.fillStyle = '#fff'; c.textBaseline = 'top'; let yy = y; lines.forEach(line => { c.fillText(line, pad, yy); yy += lineH; });
}
function drawBrand(c, target) { const pad = target.width * .055; c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(pad, pad, Math.max(170, target.width * .23), Math.max(42, target.width * .05)); c.fillStyle = '#fff'; c.font = `800 ${Math.max(20, target.width * .022)}px Arial`; c.textBaseline = 'middle'; c.fillText('VOCI DI CASSINO', pad * 1.25, pad + Math.max(42, target.width * .05) / 2); }
function drawCenteredText(c, target, text, sub = '') { c.fillStyle = '#050507'; c.fillRect(0, 0, target.width, target.height); const pad = target.width * .08; const fs = Math.max(46, target.width * .068); const lines = wrapTextFor(c, text, target.width - pad * 2, fs, 800, 5); const lh = fs * 1.14; let y = target.height / 2 - (lines.length * lh) / 2; c.textBaseline = 'top'; c.fillStyle = '#fff'; lines.forEach(line => { c.font = `800 ${fs}px Arial`; c.fillText(line, pad, y); y += lh; }); if (sub) { c.font = `600 ${Math.max(24, target.width * .03)}px Arial`; c.fillStyle = 'rgba(255,255,255,.72)'; c.fillText(sub, pad, y + fs * .45); } drawBrand(c, target); }

async function drawRenderFrame(c, target, imageCache, t, total, intro, outro, captionChunks) {
  if (intro > 0 && t < intro) { const img = scenes[0]?.img ? imageCache.get(scenes[0].img) : null; drawBackgroundOn(c, target, img, Math.min(1, t / intro)); c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(0, 0, target.width, target.height); const pad = target.width * .07, fs = Math.max(44, target.width * .065); const lines = wrapTextFor(c, $('#title').value || 'Voci di Cassino', target.width - pad * 2, fs, 800, 5); let y = target.height * .55; c.textBaseline = 'top'; c.fillStyle = '#fff'; for (const line of lines) { c.font = `800 ${fs}px Arial`; c.fillText(line, pad, y); y += fs * 1.12; } drawBrand(c, target); return; }
  if (outro > 0 && t >= total - outro) { drawCenteredText(c, target, $('#cta').value || 'Segnala Facile', 'Voci di Cassino'); return; }
  const bodyStart = intro, bodyDuration = Math.max(.1, total - intro - outro), bodyTime = Math.max(0, t - bodyStart); const sceneSlot = bodyDuration / Math.max(1, scenes.length); const index = Math.min(scenes.length - 1, Math.floor(bodyTime / sceneSlot)); const scene = scenes[index] || scenes[0]; const local = Math.max(0, Math.min(1, (bodyTime - index * sceneSlot) / sceneSlot)); const img = scene?.img ? imageCache.get(scene.img) : null; drawBackgroundOn(c, target, img, local); drawBrand(c, target);
  const topPad = target.width * .06; c.font = `800 ${Math.max(26, target.width * .035)}px Arial`; c.fillStyle = 'rgba(255,255,255,.96)'; const titleLines = wrapTextFor(c, scene?.text || '', target.width - topPad * 2, Math.max(26, target.width * .035), 800, 2); let ty = target.height * .12; titleLines.forEach(line => { c.fillText(line, topPad, ty); ty += target.width * .043; });
  if ($('#useSubtitles').checked) drawCaption(c, target, captionAtTime(captionChunks, bodyTime, bodyDuration));
}

function chooseRecorderMime() { const candidates = ['video/mp4;codecs="avc1.42E01E,mp4a.40.2"', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']; return candidates.find(type => window.MediaRecorder?.isTypeSupported?.(type)) || ''; }
function setRenderProgress(p) { $('#renderProgress').style.width = `${Math.max(0, Math.min(100, p))}%`; }
function resetFinalVideo() { if (finalVideoUrl) URL.revokeObjectURL(finalVideoUrl); finalVideoUrl = ''; finalVideoBlob = null; const v = $('#finalVideo'); v.pause(); v.removeAttribute('src'); v.load(); v.classList.add('hidden'); $('#downloadVideo').disabled = true; }

async function convertWebMToMP4(webmBlob) {
  $('#renderStatus').textContent = 'Conversione MP4: caricamento del motore FFmpeg…'; setRenderProgress(94);
  const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
    import('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/esm/index.js'),
    import('https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.2/dist/esm/index.js'),
  ]);
  const ffmpeg = new FFmpeg();
  ffmpeg.on('progress', ({ progress }) => { if (Number.isFinite(progress)) setRenderProgress(94 + Math.max(0, Math.min(1, progress)) * 6); });
  const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd';
  await ffmpeg.load({ coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'), wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm') });
  await ffmpeg.writeFile('input.webm', new Uint8Array(await webmBlob.arrayBuffer()));
  await ffmpeg.exec(['-i', 'input.webm', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '24', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', 'output.mp4']);
  const data = await ffmpeg.readFile('output.mp4');
  try { ffmpeg.terminate(); } catch {}
  return new Blob([data.buffer], { type: 'video/mp4' });
}

async function renderFullVideo() {
  if (!scenes.length) { $('#renderStatus').textContent = 'Crea prima lo storyboard.'; return; }
  if (!generatedAudioBlob) { $('#renderStatus').textContent = 'Genera prima la voce naturale ElevenLabs: serve l’MP3 per inserirla nel video.'; return; }
  if (!window.MediaRecorder) { $('#renderStatus').textContent = 'Questo browser non supporta MediaRecorder. Prova Chrome o Edge aggiornato.'; return; }
  const button = $('#renderVideo'); button.disabled = true; button.textContent = 'Rendering in corso…'; resetFinalVideo(); setRenderProgress(1);
  let audioCtx, voiceUrl = '', musicUrl = '', voiceEl, musicEl;
  try {
    const selected = Number($('#duration').value), useIntro = $('#useIntro').checked, useOutro = $('#useOutro').checked; const intro = useIntro ? 1.4 : 0, outro = useOutro ? 2.4 : 0; const voiceDuration = await getAudioDuration(generatedAudioBlob); let total = selected; if ($('#renderMode').value === 'adapt' && voiceDuration + intro + outro + .4 > total) total = Math.ceil(voiceDuration + intro + outro + .4);
    const quality = Number($('#renderQuality').value), fps = Number($('#fps').value); const dims = getDimensions($('#format').value, quality); const rc = document.createElement('canvas'); rc.width = dims.width; rc.height = dims.height; const rctx = rc.getContext('2d', { alpha: false });
    const imageCache = await makeImageCache(); const captionChunks = splitCaptionChunks($('#narration').value, 8); setRenderProgress(4);
    const canvasStream = rc.captureStream(fps); audioCtx = new (window.AudioContext || window.webkitAudioContext)(); await audioCtx.resume(); const audioDest = audioCtx.createMediaStreamDestination();
    voiceUrl = URL.createObjectURL(generatedAudioBlob); voiceEl = new Audio(voiceUrl); voiceEl.preload = 'auto'; const voiceSrc = audioCtx.createMediaElementSource(voiceEl); const voiceGain = audioCtx.createGain(); voiceGain.gain.value = Number($('#voiceVolume').value) / 100; voiceSrc.connect(voiceGain).connect(audioDest);
    const musicPreset = $('#musicPreset').value; if (musicPreset !== 'none') { musicUrl = getSelectedMusicUrl(); if (!musicUrl && musicPreset === 'custom') throw new Error('Hai scelto musica personale ma non hai caricato alcun MP3/WAV.'); if (musicUrl) { musicEl = new Audio(musicUrl); musicEl.preload = 'auto'; musicEl.loop = true; const musicSrc = audioCtx.createMediaElementSource(musicEl); const musicGain = audioCtx.createGain(); musicGain.gain.value = Number($('#musicVolume').value) / 100; musicSrc.connect(musicGain).connect(audioDest); } }
    const combined = new MediaStream([...canvasStream.getVideoTracks(), ...audioDest.stream.getAudioTracks()]); const mimeType = chooseRecorderMime(); const recorder = new MediaRecorder(combined, { ...(mimeType ? { mimeType } : {}), videoBitsPerSecond: quality === 1080 ? 10000000 : 5500000, audioBitsPerSecond: 128000 }); const chunks = []; recorder.ondataavailable = e => { if (e.data?.size) chunks.push(e.data); };
    const stopped = new Promise(resolve => { recorder.onstop = resolve; }); recorder.start(1000); const renderStart = performance.now(); if (musicEl) { musicEl.currentTime = 0; try { await musicEl.play(); } catch {} }
    const voiceTimer = setTimeout(() => { voiceEl.currentTime = 0; voiceEl.play().catch(() => {}); }, intro * 1000);
    await new Promise((resolve) => {
      const frame = async (now) => { const t = (now - renderStart) / 1000; if (t >= total) { resolve(); return; } await drawRenderFrame(rctx, rc, imageCache, t, total, intro, outro, captionChunks); setRenderProgress(5 + (t / total) * 86); requestAnimationFrame(frame); }; requestAnimationFrame(frame);
    });
    clearTimeout(voiceTimer); voiceEl.pause(); if (musicEl) musicEl.pause(); recorder.stop(); await stopped; combined.getTracks().forEach(t => t.stop()); await audioCtx.close(); audioCtx = null;
    let blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' }); if (!blob.size) throw new Error('Il browser non ha prodotto il file video.');
    const isMp4 = /mp4/i.test(blob.type || recorder.mimeType); if (!isMp4) { try { blob = await convertWebMToMP4(blob); $('#renderStatus').textContent = 'Reel MP4 creato con successo.'; } catch (conversionError) { $('#renderStatus').textContent = `Reel creato in WebM. Conversione MP4 non riuscita (${conversionError.message}). Puoi comunque scaricare il video.`; } } else $('#renderStatus').textContent = 'Reel MP4 creato con successo.';
    finalVideoBlob = blob; finalVideoUrl = URL.createObjectURL(blob); const player = $('#finalVideo'); player.src = finalVideoUrl; player.classList.remove('hidden'); player.load(); $('#downloadVideo').disabled = false; setRenderProgress(100); try { await player.play(); } catch {}
  } catch (e) { $('#renderStatus').textContent = `Rendering non riuscito: ${e.message}`; setRenderProgress(0); try { if (audioCtx) await audioCtx.close(); } catch {} } finally { if (voiceUrl) URL.revokeObjectURL(voiceUrl); if (musicUrl) URL.revokeObjectURL(musicUrl); button.disabled = false; button.textContent = '🎬 CREA REEL COMPLETO'; }
}
function downloadFinalVideo() { if (!finalVideoBlob || !finalVideoUrl) return; const ext = /mp4/i.test(finalVideoBlob.type) ? 'mp4' : 'webm'; const a = document.createElement('a'); a.href = finalVideoUrl; a.download = `${safeFileName($('#title').value || 'voci-di-cassino-reel')}.${ext}`; a.click(); }

function bindRangeLabels() { $('#expressivenessValue').textContent = $('#expressiveness').value; $('#cloudSpeedValue').textContent = `${(Number($('#cloudSpeed').value) / 100).toFixed(2).replace('.', ',')}×`; $('#browserRateValue').textContent = `${(Number($('#browserRate').value) / 100).toFixed(2).replace('.', ',')}×`; $('#voiceVolumeValue').textContent = `${$('#voiceVolume').value}%`; $('#musicVolumeValue').textContent = `${$('#musicVolume').value}%`; }
$('#expressiveness').addEventListener('input', bindRangeLabels); $('#cloudSpeed').addEventListener('input', bindRangeLabels); $('#browserRate').addEventListener('input', bindRangeLabels); $('#voiceVolume').addEventListener('input', bindRangeLabels); $('#musicVolume').addEventListener('input', () => { bindRangeLabels(); const p = $('#musicPreviewPlayer'); if (p) p.volume = Math.min(1, Number($('#musicVolume').value) / 100); }); $('#musicPreset').addEventListener('change', () => { stopMusicPreview(); updateMusicUi(); }); $('#previewMusic').onclick = previewSelectedMusic; $('#stopMusic').onclick = stopMusicPreview;

$('#build').onclick = build; $('#play').onclick = play; $('#export').onclick = exportStoryboard; $('#format').onchange = drawIdle; $('#clear').onclick = clearAll; $('#demo').onclick = loadDemo; $('#syncNarration').onclick = syncNarration; $('#narration').addEventListener('input', updateCharCount); $('#tabCloud').onclick = () => setVoiceTab('cloud'); $('#tabBrowser').onclick = () => setVoiceTab('browser'); $('#generateVoice').onclick = generateNaturalVoice; $('#testVoice').onclick = testNaturalVoice; $('#refreshVoices').onclick = loadCloudVoices; $('#downloadVoice').onclick = downloadVoice; $('#speak').onclick = speakBrowser; $('#stopSpeak').onclick = stopBrowserSpeech; $('#saveProject').onclick = saveProjectFile; $('#loadProject').addEventListener('change', e => { const f = e.target.files?.[0]; if (f) loadProjectFile(f); e.target.value = ''; }); $('#renderVideo').onclick = renderFullVideo; $('#downloadVideo').onclick = downloadFinalVideo;

window.addEventListener('resize', drawIdle);
window.addEventListener('load', () => { drawIdle(); updateCharCount(); loadBrowserVoices(); loadCloudVoices(); bindRangeLabels(); updateMusicUi(); });
if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = loadBrowserVoices;
