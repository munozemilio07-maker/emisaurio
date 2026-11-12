// Herramientas virales de un clic: cortes de silencio, zoom en cortes, gancho, auto-color, sonido listo para redes.
import { clipEnd, clipsOnTrack, rippleDeleteRange, makeClip, clamp, splitClip } from './state.js';
import { detectSilences, loudnessGain, detectBeats } from './audio.js';
import { media } from './media.js';
import { TEXT_STYLES, LOOKS, DEFAULT_COLOR } from './presets.js';

export const HOOKS = [
  'Espera a ver el final 👀', 'Nadie te cuenta esto…', 'POV: lo descubres hoy', '3 cosas que debes saber',
  'Esto cambió todo 🤯', 'No cometas este error ❌', 'Guárdalo para después 📌', 'El truco que nadie usa 💡',
  'Antes vs. después', 'Mira esto hasta el final',
];

export function voiceTrackId(P) {
  // La pista con más audio que no sea música: normalmente la principal, o la de voz en off
  let best = null, bestDur = 0;
  for (const tr of P.tracks) {
    if (tr.type !== 'video' && tr.type !== 'audio' || tr.music || tr.sfx) continue;
    const d = P.clips.filter((c) => c.trackId === tr.id && c.volume > 0 && media.get(c.mediaId)?.audio).reduce((a, c) => a + c.dur, 0);
    if (d > bestDur) { bestDur = d; best = tr.id; }
  }
  return best;
}

// Rangos de silencio en tiempo de la línea de tiempo
export function findSilences(P, { thresholdDb = -38, minDur = 0.55 } = {}) {
  const tid = voiceTrackId(P);
  if (!tid) return [];
  const out = [];
  for (const c of clipsOnTrack(P, tid)) {
    const m = media.get(c.mediaId);
    if (!m?.audio) continue;
    for (const [a, b] of detectSilences(m.audio, { thresholdDb, minDur })) {
      const ta = Math.max(c.start, c.start + (a - c.in) / c.speed);
      const tb = Math.min(clipEnd(c), c.start + (b - c.in) / c.speed);
      if (tb - ta > 0.2) out.push([ta, tb]);
    }
  }
  return out.sort((x, y) => x[0] - y[0]);
}

export function removeSilences(P, ranges) {
  const tracks = P.tracks.filter((t) => !t.music).map((t) => t.id);
  let total = 0;
  for (const [a, b] of [...ranges].sort((x, y) => y[0] - x[0])) { rippleDeleteRange(P, a, b, tracks); total += b - a; }
  return total;
}

// Zoom alterno entre cortes (estilo jump-cut de creadores)
export function alternateZoom(P, amount = 1.14) {
  const main = P.tracks.find((t) => t.main);
  const list = clipsOnTrack(P, main.id).filter((c) => c.kind === 'video' || c.kind === 'image');
  list.forEach((c, i) => { c.transform.scale = i % 2 ? amount : 1; if (i % 2 && c.fit === 'contain') c.fit = 'cover'; });
  return list.length;
}

export function addHook(P, text, t = 0) {
  const st = TEXT_STYLES.find((s) => s.id === 'impact');
  const c = makeClip('text', P.tracks.find((x) => x.type === 'text').id, t, 2.6, { text: { ...st.s, content: text } });
  c.transform.y = -0.24;
  P.clips.push(c);
  return c;
}

// Auto-color a partir de las estadísticas de la miniatura
export function autoColor(c) {
  const m = media.get(c.mediaId);
  const s = m?.stats;
  if (!s) return false;
  const col = { ...DEFAULT_COLOR, ...c.color };
  col.exposure = +clamp((0.47 - s.lum) * 0.9, -0.25, 0.4).toFixed(2);
  col.contrast = +clamp((0.21 - s.contrast) * 1.3, -0.08, 0.25).toFixed(2);
  col.saturation = +clamp((0.42 - s.sat) * 0.7, -0.1, 0.3).toFixed(2);
  col.sharpen = 0.25;
  col.preset = 'auto';
  c.color = col;
  return true;
}

export function applyLook(c, lookId, intensity = 1) {
  const look = LOOKS.find((l) => l.id === lookId);
  if (!look) return;
  const base = { ...DEFAULT_COLOR };
  for (const [k, v] of Object.entries(look.c)) base[k] = +(v * intensity).toFixed(3);
  base.preset = lookId;
  c.color = base;
}

export async function normalizeLoudness(P) {
  const r = await loudnessGain(P, media);
  P.masterGain = +(r.gain).toFixed(3);
  P.loudnessDone = true;
  return r;
}

// Clips de los que sacar el ritmo: el sonido guía si existe; si no, la música
function rhythmClips(P) {
  const isT = (c, k) => P.tracks.find((t) => t.id === c.trackId)?.[k];
  const guide = P.clips.filter((c) => c.kind === 'audio' && isT(c, 'guide'));
  return guide.length ? guide : P.clips.filter((c) => c.kind === 'audio' && isT(c, 'music'));
}

export function guideInfo(P) {
  const g = P.clips.filter((c) => c.kind === 'audio' && P.tracks.find((t) => t.id === c.trackId)?.guide).sort((a, b) => a.start - b.start)[0];
  return g ? { clip: g, offset: g.in, at: g.start, name: media.get(g.mediaId)?.name } : null;
}

export function beatMarkers(P) {
  P.markers = P.markers.filter((m) => !m.beat);
  const times = [];
  for (const c of rhythmClips(P)) {
    const m = media.get(c.mediaId);
    if (!m?.audio) continue;
    if (!m.beats) m.beats = detectBeats(m.audio);
    for (const bt of m.beats) {
      const t = c.start + (bt - c.in) / c.speed;
      if (t >= c.start && t < clipEnd(c)) times.push(t);
    }
  }
  times.sort((a, b) => a - b);
  for (const t of times) P.markers.push({ t, beat: true });
  return { n: times.length, bpm: estimateBpm(times) };
}

export function estimateBpm(times) {
  if (times.length < 4) return null;
  const iv = [];
  for (let i = 1; i < times.length; i++) iv.push(times[i] - times[i - 1]);
  iv.sort((a, b) => a - b);
  let p = iv[Math.floor(iv.length / 2)];
  let bpm = 60 / p;
  while (bpm < 70) bpm *= 2;
  while (bpm > 180) bpm /= 2;
  return Math.round(bpm);
}

const beatTimes = (P, every) => P.markers.filter((m) => m.beat).map((m) => m.t).sort((a, b) => a - b).filter((_, i) => i % every === 0);

// Corta los clips de la pista principal en cada N beats (cortes al ritmo)
export function cutAtBeats(P, every = 2) {
  const main = P.tracks.find((t) => t.main).id;
  let n = 0;
  for (const b of beatTimes(P, every)) {
    const c = P.clips.find((x) => x.trackId === main && b > x.start + 0.05 && b < clipEnd(x) - 0.05);
    if (c && splitClip(P, c, b)) n++;
  }
  return n;
}

// Montaje: coloca los clips de la pista principal uno tras otro, cada uno durando N beats
export function beatMontage(P, every = 2) {
  const main = P.tracks.find((t) => t.main).id;
  const beats = P.markers.filter((m) => m.beat).map((m) => m.t).sort((a, b) => a - b);
  if (beats.length < 2) return 0;
  const avg = (beats[beats.length - 1] - beats[0]) / (beats.length - 1);
  const at = (i) => (i < beats.length ? beats[i] : beats[beats.length - 1] + (i - beats.length + 1) * avg);
  const list = clipsOnTrack(P, main).filter((c) => c.kind !== 'audio');
  list.forEach((c, k) => {
    const a = k === 0 ? 0 : at(k * every), b = at((k + 1) * every);
    let d = b - a;
    const m = media.get(c.mediaId);
    if (c.kind === 'video' && m) d = Math.min(d, (m.duration - c.in) / c.speed);
    c.start = a; c.dur = Math.max(0.1, d);
  });
  return list.length;
}
