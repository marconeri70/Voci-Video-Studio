const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
});

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGIN || '').trim();
  const allowOrigin = allowed && origin === allowed ? origin : (allowed ? allowed : '*');
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Accept',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function isOriginAllowed(request, env) {
  const allowed = (env.ALLOWED_ORIGIN || '').trim();
  if (!allowed) return true;
  return request.headers.get('Origin') === allowed;
}

async function elevenRequest(path, env, init = {}) {
  if (!env.ELEVENLABS_API_KEY) throw new Error('ELEVENLABS_API_KEY non configurata nel Worker.');
  const headers = new Headers(init.headers || {});
  headers.set('xi-api-key', env.ELEVENLABS_API_KEY);
  return fetch(`https://api.elevenlabs.io${path}`, { ...init, headers });
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (!isOriginAllowed(request, env)) return json({ error: 'Origine non autorizzata.' }, 403, cors);

    const url = new URL(request.url);

    try {
      if (url.pathname === '/health' && request.method === 'GET') {
        return json({ ok: true, provider: 'elevenlabs' }, 200, cors);
      }

      if (url.pathname === '/voices' && request.method === 'GET') {
        // Leggiamo anche il piano: sul tier Free le voci della Voice Library / Professional
        // non sono utilizzabili via API, anche quando compaiono tra le voci salvate.
        const [voicesResponse, subResponse] = await Promise.all([
          elevenRequest('/v2/voices?page_size=100', env, { headers: { Accept: 'application/json' } }),
          elevenRequest('/v1/user/subscription', env, { headers: { Accept: 'application/json' } }),
        ]);

        const data = await voicesResponse.json().catch(() => ({}));
        if (!voicesResponse.ok) {
          const detail = data?.detail?.message || (typeof data?.detail === 'string' ? data.detail : '') || 'Errore nel caricamento voci ElevenLabs.';
          return json({ error: detail }, voicesResponse.status, cors);
        }

        const subscription = await subResponse.json().catch(() => ({}));
        const tier = String(subscription?.tier || 'unknown').toLowerCase();
        const isFree = tier === 'free';

        let voices = (data.voices || []).map((voice) => ({
          voice_id: voice.voice_id,
          name: voice.name,
          category: voice.category || '',
          labels: voice.labels || {},
        }));

        const before = voices.length;
        if (isFree) {
          // Le Professional/Voice Library non sono disponibili via API sul piano Free.
          // Manteniamo premade/default/legacy/generated e altre voci dell'account non Professional.
          voices = voices.filter((voice) => String(voice.category || '').toLowerCase() !== 'professional');
        }

        return json({
          voices,
          tier,
          filtered: before - voices.length,
          note: isFree ? 'Sul piano Free sono escluse le voci Professional/Voice Library non utilizzabili via API.' : '',
        }, 200, cors);
      }

      if (url.pathname === '/tts' && request.method === 'POST') {
        const body = await request.json().catch(() => null);
        if (!body) return json({ error: 'JSON non valido.' }, 400, cors);

        const text = String(body.text || '').trim();
        const voiceId = String(body.voice_id || '').trim();
        const modelId = ['eleven_multilingual_v2', 'eleven_flash_v2_5'].includes(body.model_id)
          ? body.model_id
          : 'eleven_multilingual_v2';

        if (!text) return json({ error: 'Testo mancante.' }, 400, cors);
        if (!voiceId || !/^[A-Za-z0-9_-]{6,64}$/.test(voiceId)) return json({ error: 'voice_id non valido.' }, 400, cors);
        if (text.length > 5000) return json({ error: 'Testo troppo lungo: massimo 5.000 caratteri per richiesta.' }, 413, cors);

        const incoming = body.voice_settings || {};
        const clamp = (n, min, max, fallback) => Number.isFinite(Number(n)) ? Math.min(max, Math.max(min, Number(n))) : fallback;
        const voiceSettings = {
          stability: clamp(incoming.stability, 0, 1, 0.48),
          similarity_boost: clamp(incoming.similarity_boost, 0, 1, 0.78),
          style: clamp(incoming.style, 0, 1, 0.18),
          use_speaker_boost: true,
          speed: clamp(incoming.speed, 0.7, 1.2, 0.96),
        };

        const response = await elevenRequest(`/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, env, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
          body: JSON.stringify({ text, model_id: modelId, voice_settings: voiceSettings }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          let detail = data?.detail?.message || '';
          if (!detail && typeof data?.detail === 'string') detail = data.detail;
          if (!detail && data?.detail?.status) detail = String(data.detail.status);
          if (!detail) detail = `ElevenLabs: errore ${response.status}`;
          return json({ error: detail, status: response.status }, response.status, cors);
        }

        const headers = new Headers(cors);
        headers.set('Content-Type', response.headers.get('Content-Type') || 'audio/mpeg');
        headers.set('Cache-Control', 'no-store');
        const requestId = response.headers.get('request-id');
        if (requestId) headers.set('X-ElevenLabs-Request-Id', requestId);
        return new Response(response.body, { status: 200, headers });
      }

      return json({ error: 'Endpoint non trovato.' }, 404, cors);
    } catch (error) {
      return json({ error: error.message || 'Errore interno.' }, 500, cors);
    }
  },
};
