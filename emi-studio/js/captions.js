// Subtítulos: transcripción local, agrupación estilo viral, emojis automáticos, SRT.
import { makeClip, clipEnd, projectDuration } from './state.js';
import { mixOffline } from './audio.js';
import { media } from './media.js';
import { CAPTION_STYLES } from './presets.js';

export const LANGS = [['spanish', 'Español'], ['english', 'Inglés'], ['portuguese', 'Portugués'], ['french', 'Francés'], ['italian', 'Italiano'], ['german', 'Alemán'], ['', 'Detectar automáticamente']];
export const MODELS = [['onnx-community/whisper-base', 'Rápido (≈80 MB)'], ['onnx-community/whisper-small', 'Preciso (≈250 MB)'], ['onnx-community/whisper-tiny', 'Ultraligero (≈40 MB)']];

// Audio de voz del proyecto a 16 kHz mono (sin la pista de música)
export async function voiceAudio(P) {
  const buf = await mixOffline({ ...P, autoDuck: false, masterGain: 1 }, media, 16000, 0, projectDuration(P), { channels: 1, filter: (c, tr) => !tr.music });
  return buf.getChannelData(0).slice();
}

export function transcribe(audio, { model, language }, onMsg) {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL('./whisper-worker.js', import.meta.url), { type: 'module' });
    w.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'done') { w.terminate(); resolve(m); }
      else if (m.type === 'error') { w.terminate(); reject(new Error(m.message)); }
      else onMsg?.(m);
    };
    w.onerror = (e) => { w.terminate(); reject(new Error(e.message || 'No se pudo iniciar el transcriptor (¿sin conexión la primera vez?)')); };
    w.postMessage({ audio, model, language, wordLevel: true }, [audio.buffer]);
  });
}

// Convierte la salida de Whisper en palabras con tiempo [{w,s,e}]
export function toWords(res) {
  const out = [];
  for (const ch of res.chunks) {
    const [s, e0] = ch.timestamp;
    const e = e0 ?? s + 0.5;
    const text = ch.text.trim();
    if (!text) continue;
    if (res.words) { out.push({ w: text, s, e }); continue; }
    // Sin tiempos por palabra: repartir el segmento según la longitud de cada palabra
    const ws = text.split(/\s+/);
    const total = ws.reduce((a, x) => a + x.length + 1, 0);
    let t = s;
    for (const x of ws) { const d = ((x.length + 1) / total) * (e - s); out.push({ w: x, s: t, e: t + d }); t += d; }
  }
  return out;
}

const EMOJI = {
  dinero: '💰', money: '💰', plata: '💰', rico: '🤑', gratis: '🆓', free: '🆓', fuego: '🔥', fire: '🔥', increíble: '🤯', increible: '🤯', loco: '🤪', locura: '🤯',
  amor: '❤️', love: '❤️', corazón: '❤️', feliz: '😄', happy: '😄', triste: '😢', sad: '😢', risa: '😂', jaja: '😂', jajaja: '😂', lol: '😂',
  secreto: '🤫', secret: '🤫', ojo: '👀', mira: '👀', look: '👀', atención: '⚠️', cuidado: '⚠️', error: '❌', errores: '❌', mal: '❌', bien: '✅', correcto: '✅',
  idea: '💡', tip: '💡', truco: '💡', consejo: '💡', tiempo: '⏰', rápido: '⚡', rapido: '⚡', fast: '⚡', éxito: '🏆', exito: '🏆', ganar: '🏆', win: '🏆',
  comida: '🍔', food: '🍔', café: '☕', cafe: '☕', música: '🎵', musica: '🎵', video: '🎬', foto: '📸', teléfono: '📱', celular: '📱', phone: '📱',
  casa: '🏠', viaje: '✈️', travel: '✈️', playa: '🏖️', coche: '🚗', carro: '🚗', gym: '💪', fuerte: '💪', fuerza: '💪', mundo: '🌎', world: '🌎',
  cerebro: '🧠', mente: '🧠', pensar: '🤔', pregunta: '❓', nuevo: '✨', new: '✨', magia: '✨', top: '🔝', mejor: '🔝', best: '🔝', cien: '💯', perfecto: '💯',
  boom: '💥', wow: '😮', guau: '😮', miedo: '😱', terror: '😱', regalo: '🎁', fiesta: '🎉', party: '🎉', cumpleaños: '🎂', estrella: '⭐', star: '⭐', rey: '👑', king: '👑',
};
const clean = (w) => w.toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N}]/gu, '');

// Agrupa palabras en subtítulos cortos (estilo viral) y crea los clips
export function buildCaptionClips(P, words, { maxWords = 3, styleId = 'hormozi', emojis = true, pos = 'low' } = {}) {
  const style = CAPTION_STYLES.find((s) => s.id === styleId) || CAPTION_STYLES[0];
  const stripPunct = !!style.s.upper;
  const groups = [];
  let cur = [];
  const flush = () => { if (cur.length) groups.push(cur); cur = []; };
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const prev = words[i - 1];
    if (cur.length && (cur.length >= maxWords || (prev && w.s - prev.e > 0.45) || cur.map((x) => x.w).join(' ').length + w.w.length > (maxWords <= 2 ? 16 : maxWords * 7))) flush();
    let text = w.w;
    if (stripPunct) text = text.replace(/[.,;:]+$/g, '');
    if (emojis && EMOJI[clean(w.w)]) text += ' ' + EMOJI[clean(w.w)];
    if (text) cur.push({ w: text, s: w.s, e: Math.max(w.e, w.s + 0.12) });
    if (maxWords > 2 && /[.?!]$/.test(w.w)) flush();
  }
  flush();
  const y = pos === 'high' ? -0.28 : pos === 'mid' ? 0.04 : 0.2;
  return groups.map((g, i) => {
    const s = g[0].s;
    let e = g[g.length - 1].e;
    const next = groups[i + 1];
    if (next && next[0].s - e < 0.35) e = next[0].s;
    const c = makeClip('caption', 'tC', s, Math.max(0.25, e - s), { text: { ...style.s } });
    c.text.content = g.map((x) => x.w).join(' ');
    c.text.styleId = style.id;
    c.transform.y = y;
    c.words = g;
    return c;
  });
}

// Reparte el texto editado de un subtítulo sobre su tiempo
export function retimeCaption(c, text) {
  const ws = text.trim().split(/\s+/).filter(Boolean);
  c.text.content = text;
  if (!ws.length) { c.words = []; return; }
  const total = ws.reduce((a, x) => a + x.length + 1, 0);
  let t = c.start;
  c.words = ws.map((w) => { const d = ((w.length + 1) / total) * c.dur; const o = { w, s: t, e: t + d }; t += d; return o; });
}

export function parseSRT(txt) {
  const out = [];
  const toS = (x) => { const m = x.trim().replace(',', '.').split(':'); return +m[0] * 3600 + +m[1] * 60 + parseFloat(m[2]); };
  for (const block of txt.replace(/\r/g, '').split(/\n\n+/)) {
    const lines = block.split('\n').filter(Boolean);
    const i = lines.findIndex((l) => l.includes('-->'));
    if (i < 0) continue;
    const [a, b] = lines[i].split('-->');
    out.push({ s: toS(a), e: toS(b.split(' ')[1] ? b.trim().split(' ')[0] : b), text: lines.slice(i + 1).join(' ').replace(/<[^>]+>/g, '') });
  }
  return out;
}

export function captionClipsFromSegments(segs, styleId, pos) {
  const style = CAPTION_STYLES.find((s) => s.id === styleId) || CAPTION_STYLES[1];
  const y = pos === 'high' ? -0.28 : pos === 'mid' ? 0.04 : 0.2;
  return segs.map((sg) => {
    const c = makeClip('caption', 'tC', sg.s, Math.max(0.2, sg.e - sg.s), { text: { ...style.s } });
    c.transform.y = y;
    retimeCaption(c, sg.text);
    return c;
  });
}

export function applyCaptionStyle(P, styleId) {
  const style = CAPTION_STYLES.find((s) => s.id === styleId);
  if (!style) return;
  for (const c of P.clips) if (c.kind === 'caption') { Object.assign(c.text, style.s); c.text.styleId = styleId; }
}

export { clipEnd };
