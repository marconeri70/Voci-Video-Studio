const $ = (s) => document.querySelector(s);
const storyEl = $('#story');
const canvas = $('#canvas');
const ctx = canvas.getContext('2d');

let files = [];
let scenes = [];
let playing = false;
let raf = 0;
let startTime = 0;

const stopwords = new Set(
  'il lo la i gli le un uno una di a da in con su per tra fra e ed o ma che del dello della dei degli delle al allo alla ai agli alle nel nello nella nei negli nelle sul sullo sulla sui sugli sulle come più anche non si è sono essere questo questa questi queste quello quella quelli quelle'.split(' ')
);

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
      <button class="secondary" data-del="${index}" aria-label="Elimina scena ${index + 1}">×</button>
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
  const firstScene = scenes[0] || { text: $('#title').value || 'Voci Video Studio', img: null };
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

function speak() {
  if (!('speechSynthesis' in window)) {
    alert('Voce non supportata dal browser.');
    return;
  }
  if (!scenes.length) {
    $('#status').textContent = 'Crea prima lo storyboard.';
    return;
  }

  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(scenes.map((scene) => scene.text).join('. '));
  utterance.lang = 'it-IT';
  utterance.rate = 0.95;
  speechSynthesis.speak(utterance);
}

function exportStoryboard() {
  const data = {
    app: 'Voci Video Studio',
    version: 1,
    title: $('#title').value,
    cta: $('#cta').value,
    duration: $('#duration').value,
    format: $('#format').value,
    style: $('#style').value,
    scenes: scenes.map(({ text, seconds }) => ({ text, seconds })),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'voci-video-storyboard.json';
  link.click();
  URL.revokeObjectURL(link.href);
}

function clearAll() {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  $('#article').value = '';
  $('#title').value = '';
  $('#images').value = '';
  scenes = [];
  files = [];
  renderStory();
  drawIdle();
  $('#status').textContent = 'Azzerato.';
}

function loadDemo() {
  $('#article').value = 'A Cassino cresce l’attenzione dei cittadini sulla manutenzione urbana. Le segnalazioni riguardano strade, verde pubblico, illuminazione e decoro. Il tema non è soltanto intervenire quando il problema diventa evidente, ma programmare controlli e manutenzione con continuità. I cittadini chiedono tempi chiari, trasparenza sugli interventi e una comunicazione più puntuale. Voci di Cassino continuerà a raccogliere segnalazioni e a verificare i fatti, distinguendo sempre tra problemi documentati, responsabilità accertate e opinioni.';
  $('#title').value = 'CASSINO, MANUTENZIONE E SEGNALAZIONI: I CITTADINI CHIEDONO RISPOSTE';
  build();
}

$('#build').onclick = build;
$('#play').onclick = play;
$('#speak').onclick = speak;
$('#export').onclick = exportStoryboard;
$('#format').onchange = drawIdle;
$('#clear').onclick = clearAll;
$('#demo').onclick = loadDemo;

window.addEventListener('resize', drawIdle);
window.addEventListener('load', drawIdle);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  });
}
