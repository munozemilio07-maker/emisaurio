// Potenciadores: zooms de énfasis, efectos automáticos, puntuación viral y clips automáticos.
import { clipEnd, clipsOnTrack, projectDuration, makeClip, newProject, clamp, trackEnd } from './state.js';
import { media } from './media.js';
import { PLATFORMS, ASPECTS } from './presets.js';
import { EMOJI, clean, buildCaptionClips } from './captions.js';
import { buildTokens, voiceMedia } from './textedit.js';
import { findSilences, addHook, voiceTrackId } from './viral.js';
import { sfxMedia } from './sfx.js';

const STRONG = new Set(['nunca', 'siempre', 'nadie', 'todos', 'gratis', 'secreto', 'error', 'errores', 'importante', 'increíble', 'increible', 'brutal', 'locura', 'mejor', 'peor', 'jamás', 'jamas', 'millones', 'mil', 'dinero', 'rápido', 'rapido', 'fácil', 'facil', 'nuevo', 'prohibido', 'verdad', 'mentira', 'cuidado', 'ojo', 'mira', 'atención', 'never', 'always', 'nobody', 'everyone', 'free', 'secret', 'mistake', 'important', 'insane', 'best', 'worst', 'money', 'million', 'easy', 'new', 'truth', 'stop', 'wait', 'look']);

function wordEnergy(m, s, e) {
  if (!m?.peaks) return 0;
  let mx = 0;
  for (let i = Math.floor(s * 50); i <= Math.ceil(e * 50); i++) mx = Math.max(mx, m.peaks[i] || 0);
  return mx;
}

// ---- Zooms automáticos ----
export function autoZooms(P, { k = 1.18, gap = 2.4 } = {}) {
  const tokens = buildTokens(P).filter((t) => t.type === 'w');
  const tid = voiceTrackId(P);
  for (const c of P.clips) if (c.zooms) c.zooms = c.zooms.filter((z) => !z.auto);
  let picks = [];
  if (tokens.length) {
    // energía media por archivo para comparar
    const avg = new Map();
    for (const t of tokens) { const a = avg.get(t.mediaId) || [0, 0]; a[0] += wordEnergy(media.get(t.mediaId), t.s, t.e); a[1]++; avg.set(t.mediaId, a); }
    for (const t of tokens) {
      const w = clean(t.w);
      const en = wordEnergy(media.get(t.mediaId), t.s, t.e);
      const [sum, n] = avg.get(t.mediaId);
      let score = en / (sum / n || 1) - 1;
      if (STRONG.has(w)) score += 0.8;
      if (EMOJI[w]) score += 0.5;
      if (/\d/.test(t.w)) score += 0.7;
      if (/[!¡?¿]/.test(t.w)) score += 0.5;
      if (t.cat) score -= 2;
      picks.push({ t, score });
    }
    picks = picks.filter((p) => p.score > 0.45).sort((a, b) => b.score - a.score);
  } else if (tid) {
    // sin transcripción: picos de volumen
    for (const c of clipsOnTrack(P, tid)) {
      const m = media.get(c.mediaId); if (!m?.peaks) continue;
      const a = Math.floor(c.in * 50), b = Math.floor((c.in + c.dur * c.speed) * 50);
      const vals = [...m.peaks.slice(a, b)]; const sorted = [...vals].sort((x, y) => x - y); const thr = sorted[Math.floor(sorted.length * 0.93)] || 1;
      vals.forEach((v, i) => { if (v >= thr) picks.push({ t: { s: (a + i) / 50, e: (a + i) / 50 + 0.5, clipId: c.id, t0: c.start + ((a + i) / 50 - c.in) / c.speed }, score: v }); });
    }
    picks.sort((x, y) => y.score - x.score);
  }
  const chosen = [];
  for (const p of picks) if (chosen.every((q) => Math.abs(q.t.t0 - p.t.t0) >= gap)) chosen.push(p);
  // el zoom se aplica al clip visual bajo esa palabra en la pista principal
  const main = P.tracks.find((t) => t.main).id;
  let n = 0;
  for (const { t } of chosen) {
    const vc = P.clips.find((c) => c.trackId === main && t.t0 >= c.start && t.t0 < clipEnd(c) && (c.kind === 'video' || c.kind === 'image'));
    if (!vc) continue;
    const s0 = vc.in + (t.t0 - vc.start) * vc.speed - 0.04;
    const len = Math.max(0.7, (t.e - t.s) + 0.35);
    (vc.zooms ||= []).push({ s0, s1: s0 + len * vc.speed, k, auto: true, t0: t.t0 });
    n++;
  }
  return n;
}

// ---- Efectos automáticos ----
export async function autoSfx(P, { cuts = 'whoosh', zooms = 'pop', vol = 0.55 } = {}, onUpdate) {
  const tr = P.tracks.find((t) => t.sfx);
  P.clips = P.clips.filter((c) => !(c.trackId === tr.id && c.autoSfx));
  const add = async (id, t, lead = 0) => {
    const m = await sfxMedia(id, onUpdate);
    const c = makeClip('audio', tr.id, Math.max(0, t - lead), m.duration, { mediaId: m.id, volume: vol, autoSfx: true });
    P.clips.push(c);
  };
  let n = 0;
  if (cuts) {
    const list = clipsOnTrack(P, P.tracks.find((t) => t.main).id);
    for (let i = 1; i < list.length; i++) if (Math.abs(clipEnd(list[i - 1]) - list[i].start) < 0.05) { await add(cuts, list[i].start, cuts === 'whoosh' ? 0.32 : 0.12); n++; }
  }
  if (zooms) {
    for (const c of P.clips) for (const z of c.zooms || []) {
      const t = c.start + (z.s0 - c.in) / c.speed;
      if (t >= c.start && t < clipEnd(c)) { await add(zooms, t, 0.02); n++; }
    }
  }
  return n;
}

// ---- Puntuación viral ----
export function viralScore(P) {
  const dur = projectDuration(P);
  const plat = PLATFORMS.find((p) => p.id === P.platform) || PLATFORMS[0];
  const main = clipsOnTrack(P, P.tracks.find((t) => t.main).id).filter((c) => c.kind !== 'audio');
  const texts = P.clips.filter((c) => c.kind === 'text' || c.kind === 'caption');
  const caps = P.clips.filter((c) => c.kind === 'caption');
  const words = buildTokens(P).filter((t) => t.type === 'w');
  const hasVoice = voiceMedia(P).length > 0;
  const vertical = P.height > P.width;
  const items = [];
  const add = (id, label, w, v, msg, fix) => items.push({ id, label, w, v: clamp(v, 0, 1), msg, fix });

  // Gancho
  const textEarly = texts.some((c) => c.start < 1.5);
  const talkEarly = words.length ? words[0].t0 < 0.8 : !hasVoice;
  add('hook', 'Gancho en los primeros 2 s', 22, (textEarly ? 0.5 : 0) + (talkEarly ? 0.5 : 0),
    textEarly && talkEarly ? 'Arrancas fuerte: hay texto y voz desde el inicio.' : !talkEarly ? `Empiezas a hablar en el segundo ${words[0]?.t0.toFixed(1)}. Corta el inicio o añade un gancho.` : 'Añade un texto que enganche en el primer segundo.',
    !textEarly ? { label: 'Añadir gancho', run: (P) => addHook(P, 'Espera a ver el final 👀', 0) } : null);

  // Ritmo
  const zoomsN = P.clips.reduce((a, c) => a + (c.zooms?.length || 0), 0);
  const changes = Math.max(1, main.length + zoomsN);
  const avgShot = dur / changes;
  add('pace', 'Ritmo (cambios visuales)', 16, avgShot <= 3.5 ? 1 : avgShot <= 6 ? 0.55 : 0.15,
    `Un cambio cada ${avgShot.toFixed(1)} s. ${avgShot <= 3.5 ? 'Buen ritmo para shorts.' : 'En shorts funciona mejor un cambio cada 2–3 s.'}`,
    avgShot > 3.5 && hasVoice ? { label: 'Zooms automáticos', run: (P) => autoZooms(P) } : null);

  // Subtítulos
  if (hasVoice) add('caps', 'Subtítulos', vertical ? 14 : 8, caps.length ? 1 : 0, caps.length ? `${caps.length} subtítulos. Mucha gente ve sin sonido.` : 'Sin subtítulos: mucha gente ve los shorts sin sonido.', caps.length ? null : { label: 'Ir a Subtítulos', tab: 'captions' });

  // Silencios
  const sil = hasVoice ? findSilences(P) : [];
  const silT = sil.reduce((a, [x, y]) => a + y - x, 0);
  if (hasVoice) add('sil', 'Sin pausas muertas', 10, silT < 0.5 ? 1 : silT < 2 ? 0.5 : 0, silT < 0.5 ? 'No hay silencios largos.' : `${sil.length} silencios (${silT.toFixed(1)} s) que bajan la retención.`, silT >= 0.5 ? { label: 'Ir a quitarlos', tab: 'transcript' } : null);

  // Duración
  const [lo, hi] = plat.sweet;
  add('dur', `Duración para ${plat.name}`, 8, dur >= lo && dur <= hi ? 1 : dur <= plat.maxDur ? 0.5 : 0,
    dur > plat.maxDur ? `Dura ${dur.toFixed(0)} s y ${plat.name} admite ~${plat.maxDur} s.` : dur >= lo && dur <= hi ? `${dur.toFixed(0)} s: en el rango que mejor funciona (${lo}–${hi} s).` : `${dur.toFixed(0)} s. Suele rendir mejor entre ${lo} y ${hi} s.`, null);

  // Formato
  const fmtOk = !plat.aspect || plat.aspect === P.aspect;
  add('fmt', 'Formato de pantalla', 10, fmtOk ? 1 : 0, fmtOk ? `${P.aspect}, el formato de ${plat.name}.` : `${plat.name} usa ${plat.aspect} y tu proyecto es ${P.aspect}.`,
    fmtOk ? null : { label: `Cambiar a ${plat.aspect}`, run: (P) => { const a = ASPECTS.find((x) => x.id === plat.aspect); Object.assign(P, { aspect: a.id, width: a.w, height: a.h }); } });

  // Zonas seguras
  if (vertical && texts.length) {
    const bad = texts.filter((c) => c.transform.y > 0.3 || c.transform.y < -0.42 || c.transform.x > 0.3);
    add('safe', 'Texto fuera de los botones', 10, bad.length ? 0 : 1, bad.length ? `${bad.length} texto(s) quedan bajo los botones o la descripción de la app.` : 'Todo el texto está en zona segura.',
      bad.length ? { label: 'Moverlos', run: () => bad.forEach((c) => { c.transform.y = clamp(c.transform.y, -0.4, 0.24); c.transform.x = clamp(c.transform.x, -0.3, 0.25); }) } : null);
  }

  // Audio
  add('loud', 'Volumen para redes', 5, P.loudnessDone ? 1 : 0.5, P.loudnessDone ? 'Normalizado a ≈ −14 LUFS (estimación por RMS, no medición BS.1770).' : 'Sin normalizar: puede sonar más bajo que otros videos.', P.loudnessDone ? null : { label: 'Normalizar', async: 'normalize' });

  // Cierre
  const endText = texts.some((c) => clipEnd(c) > dur - 3 && c.kind === 'text');
  add('cta', 'Cierre con llamada a la acción', 5, endText ? 1 : 0, endText ? 'Hay un texto al final.' : 'Pide algo al final: seguir, comentar o ver la parte 2.',
    endText ? null : { label: 'Añadir cierre', run: (P) => { const c = addHook(P, 'Sígueme para la parte 2 👆', Math.max(0, dur - 2.5)); c.dur = Math.min(2.5, dur); c.text.size = 0.07; c.transform.y = -0.1; } });

  const tw = items.reduce((a, i) => a + i.w, 0);
  const score = Math.round((items.reduce((a, i) => a + i.w * i.v, 0) / tw) * 100);
  return { score, items, plat };
}

// ---- Clips automáticos (estilo Opus Clip) ----
const HOOKS = /(\?|¿|por qué|porque nadie|cómo|como hacer|secreto|error|nunca|nadie|el truco|la verdad|lo que|te voy a|imagina|sabías|no sabía|tienes que|deja de|why|how|secret|mistake|never|nobody|the truth|stop|you need)/i;

export function findClips(P, mediaId, { min = 20, max = 60, count = 6 } = {}) {
  const tr = P.transcripts?.[mediaId];
  const m = media.get(mediaId);
  if (!tr || !m) return [];
  const W = tr.words;
  // frases
  const sents = [];
  let cur = [];
  W.forEach((w, i) => {
    cur.push(w);
    const next = W[i + 1];
    if (/[.?!…]$/.test(w.w) || !next || next.s - w.e > 0.8) { sents.push(cur); cur = []; }
  });
  const energyAvg = (() => { let s = 0, n = 0; for (const v of m.peaks || []) { s += v; n++; } return s / (n || 1); })();
  const cands = [];
  for (let i = 0; i < sents.length; i++) {
    const first = sents[i].map((w) => w.w).join(' ');
    const a = sents[i][0].s;
    for (let j = i; j < sents.length; j++) {
      const b = sents[j][sents[j].length - 1].e;
      const d = b - a;
      if (d < min) continue;
      if (d > max) break;
      const ws = sents.slice(i, j + 1).flat();
      const text = ws.map((w) => w.w).join(' ');
      let kw = 0;
      for (const w of ws) { const c = clean(w.w); if (STRONG.has(c) || EMOJI[c] || /\d/.test(w.w)) kw++; }
      let en = 0, n = 0;
      if (m.peaks) for (let k = Math.floor(a * 50); k < b * 50; k++) { en += m.peaks[k] || 0; n++; }
      const energy = n ? en / n / (energyAvg || 1) : 1;
      let gaps = 0;
      for (let k = 1; k < ws.length; k++) gaps += Math.max(0, ws[k].s - ws[k - 1].e - 0.4);
      const rate = ws.length / d;
      const score = 40
        + (HOOKS.test(first) ? 18 : 0) + (/[?¿]/.test(first) ? 6 : 0)
        + Math.min(15, (kw / ws.length) * 120)
        + clamp((energy - 0.9) * 25, -8, 12)
        + clamp((rate - 2) * 6, -6, 8)
        - Math.min(15, gaps * 3)
        + (/[.?!]$/.test(ws[ws.length - 1].w) ? 4 : 0);
      cands.push({ a: Math.max(0, a - 0.15), b: Math.min(m.duration, b + 0.25), score: Math.round(clamp(score, 1, 99)), title: first.length > 70 ? first.slice(0, 67) + '…' : first, text, mediaId });
    }
  }
  cands.sort((x, y) => y.score - x.score);
  const out = [];
  for (const c of cands) {
    if (out.length >= count) break;
    if (out.every((o) => c.b <= o.a || c.a >= o.b)) out.push(c);
  }
  return out;
}

// Proyecto vertical listo para subir a partir de un tramo
export function clipProject(P, clip, { style = 'hormozi', zooms = true, name } = {}) {
  const m = media.get(clip.mediaId);
  const Q = newProject(ASPECTS[0]);
  Q.name = name || clip.title.replace(/[^\p{L}\p{N} ]/gu, '').slice(0, 40) || 'Clip';
  Q.platform = 'tiktok';
  Q.transcripts = { [m.id]: P.transcripts[m.id] };
  const kind = m.type === 'audio' ? 'audio' : 'video';
  const main = Q.tracks.find((t) => t.main).id;
  const c = makeClip(kind, kind === 'audio' ? 'tA1' : main, 0, clip.b - clip.a, { mediaId: m.id, in: clip.a });
  if (kind === 'video' && m.w > m.h) c.fit = 'blurfill';
  c.enhance = true;
  Q.clips.push(c);
  const words = P.transcripts[m.id].words.filter((w) => w.s >= clip.a && w.e <= clip.b).map((w) => ({ w: w.w, s: w.s - clip.a, e: w.e - clip.a }));
  Q.clips.push(...buildCaptionClips(Q, words, { maxWords: 3, styleId: style, emojis: true, pos: 'low' }));
  Q.progressBar = { on: true, pos: 'top', color: '#ec4899', color2: '#f59e0b', h: 0.008 };
  if (zooms) autoZooms(Q);
  return Q;
}

export { trackEnd };
