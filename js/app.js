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
  words.forEach((word) => {
    if (!stopwords.has(word)) freq[word] = (freq[word] || 0) + 1;
  });

  const scored = list.map((sentence, index) => ({
    sentence,
    index,
    score: (sentence.toLowerCase().match(/[a-zàèéìòù0-9]{3,}/g) || [])
      .reduce((acc, word) => acc + (freq[word] || 0), 0) / (sentence.length || 1),
  }));

  const top = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .sort((a, b) => a.index - b.index)
    .map((item) => item.sentence);

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
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s*[-–—]\s*/g, ', ')
    .replace(/\b([A-ZÀ-ÖØ-Þ]{4,})\b/g, (word) => word.charAt(0) + word.slice(1).toLowerCase())
    .replace(/([.!?])(?=[A-ZÀÈÉÌÒÙ])/g, '$1 ')
    .replace(/\.{2,}/g, '.')
    .trim();
}

function narrationFromScenes() {
  const body = scenes.map((scene) => scene.text.trim()).filter(Boolean).join(' ');
  const cta = $('#cta').value.trim();
  return naturalizeNarration([body, cta].filter(Boolean).join(' '));
}

function syncNarration() {
  $('#narration').value = narrationFromScenes();
  updateCharCount();
}

function updateCharCount() {
  const n = $('#narration').value.length;
  $('#charCount').textContent = `${n.toLocaleString('it-IT')} caratteri`;
}

async function build() {
  const article = $('#article').value.trim();
  files = [...$('#images').files];

  if (!article) {
    $('#status').textContent = 'Inserisci prima un articolo.';
    return;
  }

  $('#status').textContent = 'Creazione storyboard...';
  const duration = Number($('#duration').value);
  const sceneCount = Math.max(4, Math.min(files.length || 6, Math.round(duration / 7)));
  const summary = summarize(article, sceneCount);

  if (!$('#title').value.trim()) $('#title').value = makeTitle(article);

  const urls = await Promise.all(files.map(fileToDataURL));
  scenes = [];

  for (let i = 0; i < sceneCount; i += 1) {
    scenes.push({
      text: summary[i] || summary[summary.length - 1] || article.slice(0, 180),
      img: urls[i % Math.max(urls.length, 1)] || null,
      seconds: Math.max(4, Math.floor(duration / sceneCount)),
    });
  }

  renderStory();
  syncNarration();
  drawIdle();
  $('#status').textContent = `Storyboard creato: ${scenes.length} scene.`;
}

function renderStory() {
  storyEl.innerHTML = '';

  scenes.forEach((scene, index) => {
    const row = document.createElement('div');
    row.className = 'scene';
    row.innerHTML = `
      ${scene.img ? `<img class="thumb" src="${scene.img}" alt="Anteprima scena ${index + 1}">` : '<div class="thumb"></div>'}
      <div>
        <span class="badge">Scena ${index + 1}</span>
        <textarea data-i="${index}" aria-label="Testo scena ${index + 1}">${scene.text}</textarea>
        <div class="meta">${scene.seconds}s • zoom/pan leggero</div>
      </div>
      <button class="secondary compactButton" data-del="${index}" aria-label="Elimina scena ${index + 1}">×</button>
    `;
    storyEl.appendChild(row);
  });

  storyEl.querySelectorAll('textarea').forEach((textarea) => {
    textarea.oninput = (event) => {
      scenes[Number(event.target.dataset.i)].text = event.target.value;
    };
  });

  storyEl.querySelectorAll('[data-del]').forEach((button) => {
    button.onclick = (event) => {
      scenes.splice(Number(event.target.dataset.del), 1);
      renderStory();
      syncNarration();
      drawIdle();
    };
  });
}

function fitCanvas() {
  const format = $('#format').value;
  if (format === '1:1') {
    canvas.width = 1080;
    canvas.height = 1080;
  } else if (format === '16:9') {
    canvas.width = 1920;
    canvas.height = 1080;
  } else {
    canvas.width = 1080;
    canvas.height = 1920;
  }
}

function wrapText(text, maxWidth, fontSize) {
  ctx.font = `700 ${fontSize}px Arial`;
  const words = text.split(' ');
  const lines = [];
  let line = '';

  for (const word of words) {
    const test = `${line} ${word}`.trim();
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 5);
}

function drawBackground(img, progress) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!img) return;

  const scale = Math.max(canvas.width / img.width, canvas.height / img.height) * (1 + 0.08 * progress);
  const width = img.width * scale;
  const height = img.height * scale;
  const x = (canvas.width - width) / 2 + Math.sin(progress * Math.PI) * 20;
  const y = (canvas.height - height) / 2 - progress * 30;

  ctx.globalAlpha = 0.92;
  ctx.drawImage(img, x, y, width, height);
  ctx.globalAlpha = 1;

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, 'rgba(0,0,0,.15)');
  gradient.addColorStop(0.6, 'rgba(0,0,0,.12)');
  gradient.addColorStop(1, 'rgba(0,0,0,.78)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const image = new Image();
    image.onload = () => resolve(image);
    image.src = src;
  });
}

async function drawScene(scene, progress = 0, index = 0) {
  fitCanvas();
  const img = await loadImage(scene?.img);
  drawBackground(img, progress);

  const padding = canvas.width * 0.07;
  const fontSize = Math.max(34, Math.round(canvas.width * 0.055));
  const lines = wrapText(scene?.text || 'Inserisci contenuto', canvas.width - padding * 2, fontSize);
  let y = canvas.height * 0.66;

  ctx.textBaseline = 'top';
  lines.forEach((line) => {
    ctx.font = `700 ${fontSize}px Arial`;
    ctx.fillStyle = 'rgba(0,0,0,.48)';
    ctx.fillText(line, padding + 3, y + 3);
    ctx.fillStyle = '#fff';
    ctx.fillText(line, padding, y);
    y += fontSize * 1.18;
  });

  ctx.font = `700 ${Math.max(24, canvas.width * 0.025)}px Arial`;
  ctx.fillStyle = '#fff';
  ctx.fillText('VOCI DI CASSINO', padding, canvas.height - padding * 1.25);

  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.fillText(`${index + 1}/${Math.max(1, scenes.length)}`, canvas.width - padding, canvas.height - padding * 1.25);
  ctx.textAlign = 'left';
}

async function drawIdle() {
  fitCanvas();
  const firstScene = scenes[0] || { text: $('#title').value || 'Voci Video Studio V2', img: null };
  await drawScene(firstScene, 0, 0);
}

async function play() {
  if (!scenes.length) {
    $('#status').textContent = 'Crea prima lo storyboard.';
    return;
  }

  if (playing) {
    playing = false;
    cancelAnimationFrame(raf);
    $('#play').textContent = '▶ Anteprima';
    return;
  }

  playing = true;
  $('#play').textContent = '■ Ferma';
  startTime = performance.now();
  const total = scenes.reduce((acc, scene) => acc + scene.seconds, 0);

  async function frame(now) {
    if (!playing) return;
    const time = (now - startTime) / 1000;

    if (time >= total) {
      playing = false;
      $('#play').textContent = '▶ Anteprima';
      await drawIdle();
      return;
    }

    let elapsed = 0;
    let index = 0;
    for (; index < scenes.length; index += 1) {
      if (time < elapsed + scenes[index].seconds) break;
      elapsed += scenes[index].seconds;
    }

    const progress = (time - elapsed) / scenes[index].seconds;
    await drawScene(scenes[index], progress, index);
    raf = requestAnimationFrame(frame);
  }

  raf = requestAnimationFrame(frame);
}

function rankBrowserVoice(voice) {
  let score = 0;
  const name = voice.name.toLowerCase();
  const lang = String(voice.lang || '').toLowerCase();
  if (lang === 'it-it') score += 100;
  else if (lang.startsWith('it')) score += 80;
  if (/natural|premium|enhanced|neural|online/.test(name)) score += 30;
  if (/microsoft|google|apple/.test(name)) score += 10;
  if (voice.localService) score += 3;
  return score;
}

function loadBrowserVoices() {
  if (!('speechSynthesis' in window)) return;
  browserVoices = speechSynthesis.getVoices()
    .filter((voice) => String(voice.lang || '').toLowerCase().startsWith('it'))
    .sort((a, b) => rankBrowserVoice(b) - rankBrowserVoice(a));

  const select = $('#browserVoice');
  select.innerHTML = '';
  if (!browserVoices.length) {
    select.innerHTML = '<option value="">Nessuna voce italiana trovata</option>';
    return;
  }

  browserVoices.forEach((voice, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = `${voice.name} — ${voice.lang}${index === 0 ? ' ★ consigliata' : ''}`;
    select.appendChild(option);
  });
}

function speakBrowser() {
  if (!('speechSynthesis' in window)) {
    $('#voiceStatus').textContent = 'Voce non supportata dal browser.';
    return;
  }
  const text = naturalizeNarration($('#narration').value.trim());
  if (!text) {
    $('#voiceStatus').textContent = 'Inserisci o genera prima il copione voce.';
    return;
  }

  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const selected = browserVoices[Number($('#browserVoice').value || 0)];
  if (selected) utterance.voice = selected;
  utterance.lang = selected?.lang || 'it-IT';
  utterance.rate = Number($('#browserRate').value) / 100;
  utterance.pitch = 1;
  utterance.volume = 1;
  speechSynthesis.speak(utterance);
}

function stopBrowserSpeech() {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

function setCloudState(ok, text) {
  const badge = $('#cloudState');
  badge.textContent = text;
  badge.classList.toggle('on', ok);
  badge.classList.toggle('off', !ok);
}

async function loadCloudVoices() {
  const select = $('#cloudVoice');
  if (!API_BASE) {
    setCloudState(false, 'Cloud non configurato');
    select.innerHTML = '<option value="">Configura config.js</option>';
    return;
  }

  setCloudState(false, 'Connessione...');
  $('#voiceStatus').textContent = 'Caricamento voci disponibili...';
  try {
    const response = await fetch(`${API_BASE}/voices`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(await response.text() || `Errore ${response.status}`);
    const data = await response.json();
    const voices = Array.isArray(data.voices) ? data.voices : [];
    select.innerHTML = '';

    if (!voices.length) {
      select.innerHTML = '<option value="">Nessuna voce API compatibile</option>';
      throw new Error(data.tier === 'free'
        ? 'Sul piano Free non risultano voci compatibili via API. Apri ElevenLabs e aggiungi/usa una voce premade disponibile nel tuo account.'
        : 'Nessuna voce disponibile nell’account ElevenLabs.');
    }

    voices.forEach((voice) => {
      const option = document.createElement('option');
      option.value = voice.voice_id;
      const accent = voice.labels?.accent ? ` • ${voice.labels.accent}` : '';
      const useCase = voice.labels?.use_case ? ` • ${voice.labels.use_case}` : '';
      const category = voice.category ? ` • ${voice.category}` : '';
      option.textContent = `${voice.name || 'Voce'}${category}${accent}${useCase}`;
      select.appendChild(option);
    });

    setCloudState(true, data.tier === 'free' ? 'Cloud connesso • Free' : 'Cloud connesso');
    const filteredText = data.filtered ? ` ${data.filtered} voci Professional escluse perché non utilizzabili via API sul piano Free.` : '';
    $('#voiceStatus').textContent = `${voices.length} voci compatibili caricate.${filteredText} Premi “Test voce” per ascoltare una prova breve.`;
  } catch (error) {
    setCloudState(false, 'Cloud non disponibile');
    $('#voiceStatus').textContent = `Connessione voce: ${error.message}`;
  }
}

function getCloudVoiceSettings() {
  const base = { ...voicePresets[$('#voicePreset').value] };
  const expressive = Number($('#expressiveness').value) / 100;
  base.stability = Math.max(0.25, Math.min(0.75, 0.70 - expressive * 0.48));
  base.style = Math.max(0, Math.min(0.55, expressive * 0.55));
  base.speed = Number($('#cloudSpeed').value) / 100;
  return base;
}

async function requestNaturalVoice(text, autoPlay = true) {
  const voiceId = $('#cloudVoice').value;
  if (!API_BASE) throw new Error('Manca l’URL del Worker in config.js.');
  if (!text) throw new Error('Il testo della voce è vuoto.');
  if (!voiceId) throw new Error('Seleziona una voce ElevenLabs.');

  const response = await fetch(`${API_BASE}/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text,
      voice_id: voiceId,
      model_id: $('#cloudModel').value,
      voice_settings: getCloudVoiceSettings(),
    }),
  });

  if (!response.ok) {
    let detail = '';
    try {
      const payload = await response.json();
      detail = typeof payload?.error === 'string' ? payload.error : JSON.stringify(payload?.error || payload);
    } catch {
      detail = await response.text();
    }
    throw new Error(detail || `Errore ${response.status}`);
  }

  generatedAudioBlob = await response.blob();
  if (!generatedAudioBlob.size) throw new Error('ElevenLabs ha restituito un file audio vuoto.');
  if (audioBlobUrl) URL.revokeObjectURL(audioBlobUrl);
  audioBlobUrl = URL.createObjectURL(generatedAudioBlob);
  const player = $('#voicePlayer');
  player.src = audioBlobUrl;
  player.load();
  $('#downloadVoice').disabled = false;
  if (autoPlay) {
    try { await player.play(); } catch { /* Il browser può bloccare autoplay: usa il tasto Play del player. */ }
  }
  return generatedAudioBlob;
}

async function testNaturalVoice() {
  const button = $('#testVoice');
  button.disabled = true;
  button.textContent = 'Test in corso...';
  $('#voiceStatus').textContent = 'Genero una prova breve della voce selezionata...';
  try {
    const sample = 'Questa è una prova di Voci Video Studio. La voce narrante è pronta per il tuo prossimo reel.';
    const blob = await requestNaturalVoice(sample, true);
    $('#voiceStatus').textContent = `Test riuscito: ${(blob.size / 1024).toFixed(0)} KB. Se non parte da solo, premi ▶ nel lettore qui sotto.`;
  } catch (error) {
    $('#voiceStatus').textContent = `TEST NON RIUSCITO: ${error.message}`;
  } finally {
    button.disabled = false;
    button.textContent = '▶ Test voce';
  }
}

async function generateNaturalVoice() {
  const text = naturalizeNarration($('#narration').value.trim());
  const voiceId = $('#cloudVoice').value;
  if (!API_BASE) {
    $('#voiceStatus').textContent = 'Manca l’URL del Worker in config.js. Segui SETUP_VOCE_NATURALE.md.';
    return;
  }
  if (!text) {
    $('#voiceStatus').textContent = 'Inserisci o genera prima il copione voce.';
    return;
  }
  if (!voiceId) {
    $('#voiceStatus').textContent = 'Seleziona una voce ElevenLabs.';
    return;
  }

  const button = $('#generateVoice');
  button.disabled = true;
  button.textContent = 'Generazione...';
  $('#voiceStatus').textContent = 'Sto creando la voce naturale...';

  try {
    const blob = await requestNaturalVoice(text, true);
    $('#voiceStatus').textContent = `Voce creata: ${(blob.size / 1024).toFixed(0)} KB. Se non parte automaticamente, premi ▶ nel lettore qui sotto.`;
  } catch (error) {
    $('#voiceStatus').textContent = `Generazione non riuscita: ${error.message}`;
  } finally {
    button.disabled = false;
    button.textContent = '✨ Genera voce naturale';
  }
}

function downloadVoice() {
  if (!generatedAudioBlob || !audioBlobUrl) return;
  const safeTitle = ($('#title').value || 'voci-video-narrazione')
    .toLowerCase().replace(/[^a-z0-9àèéìòù]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  const link = document.createElement('a');
  link.href = audioBlobUrl;
  link.download = `${safeTitle || 'narrazione'}.mp3`;
  link.click();
}

function setVoiceTab(tab) {
  const cloud = tab === 'cloud';
  $('#tabCloud').classList.toggle('active', cloud);
  $('#tabBrowser').classList.toggle('active', !cloud);
  $('#cloudPanel').classList.toggle('hidden', !cloud);
  $('#browserPanel').classList.toggle('hidden', cloud);
}

function exportStoryboard() {
  const data = {
    app: 'Voci Video Studio',
    version: '2.3',
    title: $('#title').value,
    cta: $('#cta').value,
    duration: $('#duration').value,
    format: $('#format').value,
    style: $('#style').value,
    narration: $('#narration').value,
    voice: {
      provider: 'elevenlabs-or-browser',
      cloud_voice_id: $('#cloudVoice').value,
      model: $('#cloudModel').value,
      preset: $('#voicePreset').value,
      settings: getCloudVoiceSettings(),
    },
    scenes: scenes.map(({ text, seconds }) => ({ text, seconds })),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'voci-video-storyboard-v2.json';
  link.click();
  URL.revokeObjectURL(link.href);
}

function clearAll() {
  stopBrowserSpeech();
  $('#article').value = '';
  $('#title').value = '';
  $('#images').value = '';
  $('#narration').value = '';
  scenes = [];
  files = [];
  renderStory();
  updateCharCount();
  drawIdle();
  $('#status').textContent = 'Azzerato.';
}

function loadDemo() {
  $('#article').value = 'A Cassino cresce l’attenzione dei cittadini sulla manutenzione urbana. Le segnalazioni riguardano strade, verde pubblico, illuminazione e decoro. Il tema non è soltanto intervenire quando il problema diventa evidente, ma programmare controlli e manutenzione con continuità. I cittadini chiedono tempi chiari, trasparenza sugli interventi e una comunicazione più puntuale. Voci di Cassino continuerà a raccogliere segnalazioni e a verificare i fatti, distinguendo sempre tra problemi documentati, responsabilità accertate e opinioni.';
  $('#title').value = 'CASSINO, MANUTENZIONE E SEGNALAZIONI: I CITTADINI CHIEDONO RISPOSTE';
  build();
}

function bindRangeOutputs() {
  $('#expressiveness').addEventListener('input', () => {
    $('#expressivenessValue').textContent = $('#expressiveness').value;
  });
  $('#cloudSpeed').addEventListener('input', () => {
    $('#cloudSpeedValue').textContent = `${(Number($('#cloudSpeed').value) / 100).toFixed(2).replace('.', ',')}×`;
  });
  $('#browserRate').addEventListener('input', () => {
    $('#browserRateValue').textContent = `${(Number($('#browserRate').value) / 100).toFixed(2).replace('.', ',')}×`;
  });
}

$('#build').onclick = build;
$('#play').onclick = play;
$('#export').onclick = exportStoryboard;
$('#format').onchange = drawIdle;
$('#clear').onclick = clearAll;
$('#demo').onclick = loadDemo;
$('#syncNarration').onclick = syncNarration;
$('#narration').addEventListener('input', updateCharCount);
$('#tabCloud').onclick = () => setVoiceTab('cloud');
$('#tabBrowser').onclick = () => setVoiceTab('browser');
$('#generateVoice').onclick = generateNaturalVoice;
$('#testVoice').onclick = testNaturalVoice;
$('#refreshVoices').onclick = loadCloudVoices;
$('#downloadVoice').onclick = downloadVoice;
$('#speak').onclick = speakBrowser;
$('#stopSpeak').onclick = stopBrowserSpeech;

bindRangeOutputs();
window.addEventListener('resize', drawIdle);
window.addEventListener('load', () => {
  drawIdle();
  updateCharCount();
  loadBrowserVoices();
  loadCloudVoices();
});

if ('speechSynthesis' in window) {
  speechSynthesis.onvoiceschanged = loadBrowserVoices;
}

// V2.2: service worker disattivato per evitare cache obsolete su GitHub Pages.
