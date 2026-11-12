// Edición por texto: transcripción por archivo, tokens en la línea de tiempo, muletillas, pausas y guion.
import { clipEnd, clipsOnTrack, rippleDeleteRange, makeClip } from './state.js';
import { media } from './media.js';
import { voiceTrackId } from './viral.js';
import { transcribe, toWords } from './captions.js';

// Audio de un archivo a 16 kHz mono (lo que pide Whisper)
export async function mediaAudio16k(m) {
  return m.audio.getChannelData(0).slice(); // ya está a 16 kHz mono
}

// Archivos con voz que aparecen en la pista de voz
export function voiceMedia(P) {
  const tid = voiceTrackId(P);
  if (!tid) return [];
  const ids = new Set(clipsOnTrack(P, tid).map((c) => c.mediaId));
  return [...ids].map((id) => media.get(id)).filter((m) => m?.audio);
}

export async function transcribeMedia(P, m, opts, onMsg) {
  const audio = await mediaAudio16k(m);
  const res = await transcribe(audio, opts, onMsg);
  const raw = toWords(res).map((w) => ({ w: w.w, s: w.s, e: w.e }));
  const words = refineWords(raw, m).map((w) => ({ w: w.w, s: +w.s.toFixed(3), e: +w.e.toFixed(3) }));
  P.transcripts = P.transcripts || {};
  P.transcripts[m.id] = { words, lang: opts.language || 'auto', approx: !res.words, device: res.device };
  return words;
}

// Nivel de voz típico del archivo (para distinguir voz de silencio)
export function speechLevel(m) {
  if (m._lvl != null) return m._lvl;
  const v = [...(m.peaks || [])].filter((x) => x > 0.005).sort((a, b) => a - b);
  m._lvl = v.length ? v[Math.floor(v.length * 0.6)] : 0.1;
  return m._lvl;
}
const silentAt = (m, i, thr) => (m.peaks[i] || 0) < thr;

// Whisper entrega los tiempos con hasta ~0.5 s de desfase. Ajusta los bordes de cada palabra
// a los silencios reales del audio, para que un corte nunca se coma el inicio o el final de una palabra.
export function refineWords(words, m) {
  if (!m?.peaks || !words.length) return words;
  const thr = Math.max(0.012, speechLevel(m) * 0.22);
  const N = m.peaks.length, MINSIL = 4; // 80 ms de silencio
  const runs = (a, b) => { // silencios dentro de [a,b) en índices de picos
    const out = []; let st = null;
    for (let i = Math.max(0, a); i < Math.min(N, b); i++) {
      if (silentAt(m, i, thr)) { if (st == null) st = i; }
      else if (st != null) { if (i - st >= MINSIL) out.push([st, i]); st = null; }
    }
    if (st != null && Math.min(N, b) - st >= MINSIL) out.push([st, Math.min(N, b)]);
    return out;
  };
  const w = words.map((x) => ({ ...x }));
  const voiced = new Uint8Array(N);
  for (let i = 0; i < N; i++) voiced[i] = silentAt(m, i, thr) ? 0 : 1;
  // 1) Corrimiento por frase: el que mejor alinea "hay palabra" con "hay voz"
  const groups = [];
  let g = [w[0]];
  for (let i = 1; i < w.length; i++) { if (w[i].s - w[i - 1].e > 0.6) { groups.push(g); g = []; } g.push(w[i]); }
  groups.push(g);
  for (const G of groups) {
    const a0 = Math.max(0, Math.round((G[0].s - 1) * 50)), a1 = Math.min(N, Math.round((G[G.length - 1].e + 1) * 50));
    let best = 0, bestScore = -1;
    for (let d = -45; d <= 15; d++) { // -0.9 s … +0.3 s
      const pred = new Uint8Array(a1 - a0);
      for (const x of G) for (let i = Math.round(x.s * 50) + d; i < Math.round(x.e * 50) + d; i++) if (i >= a0 && i < a1) pred[i - a0] = 1;
      let sc = 0;
      for (let i = a0; i < a1; i++) sc += pred[i - a0] === voiced[i] ? 1 : 0;
      if (sc > bestScore || (sc === bestScore && Math.abs(d) < Math.abs(best))) { bestScore = sc; best = d; }
    }
    for (const x of G) { x.s += best / 50; x.e += best / 50; }
  }
  // 2) Bordes entre palabras: al silencio real más cercano al hueco previsto
  for (let i = 0; i < w.length - 1; i++) {
    const a = w[i], b = w[i + 1];
    const mid = (a.e + b.s) / 2;
    const lo = Math.round(Math.max(a.s + 0.06, a.e - 0.2) * 50), hi = Math.round(Math.min(b.e - 0.06, b.s + 0.2) * 50);
    if (hi <= lo) continue;
    const r = runs(lo, hi);
    if (!r.length) continue;
    const near = r.reduce((p, q) => (Math.abs((q[0] + q[1]) / 100 - mid) < Math.abs((p[0] + p[1]) / 100 - mid) ? q : p));
    a.e = Math.max(a.s + 0.05, near[0] / 50);
    b.s = Math.min(b.e - 0.05, near[1] / 50);
  }
  // inicio de la primera palabra y final de la última: hasta donde realmente hay voz
  const f = w[0];
  let i0 = Math.round(f.s * 50);
  const minI = Math.max(0, Math.round((f.s - 0.6) * 50));
  while (i0 > minI && !(silentAt(m, i0 - 1, thr) && silentAt(m, i0 - 2, thr))) i0--;
  f.s = i0 / 50;
  const l = w[w.length - 1];
  for (let i = Math.round(l.e * 50); i < Math.min(N, Math.round((l.e + 0.6) * 50)); i++) { if (silentAt(m, i, thr) && silentAt(m, i + 1, thr)) { l.e = i / 50; break; } }
  return w;
}

// ---- Muletillas ----
const SURE = new Set(['eh', 'ehh', 'ehm', 'em', 'emm', 'mm', 'mmm', 'hmm', 'ah', 'ahh', 'um', 'umm', 'uh', 'uhh', 'erm', 'er', 'mhm']);
const MAYBE_ONE = new Set(['este', 'esto', 'pues', 'bueno', 'digamos', 'tipo', 'osea', 'like', 'basically', 'literally', 'actually', 'so', 'okay', 'ok', 'vale', 'entonces', 'básicamente', 'literalmente', 'nada']);
const MAYBE_TWO = new Set(['o sea', 'you know', 'i mean', 'es que', 'o sea que', 'sabes qué', 'kind of', 'sort of']);
const norm = (w) => w.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]/g, '').trim();

// Tokens visibles en la línea de tiempo: palabras, pausas y "sonidos sin palabra"
export function buildTokens(P) {
  const tid = voiceTrackId(P);
  if (!tid) return [];
  const out = [];
  for (const c of clipsOnTrack(P, tid)) {
    const m = media.get(c.mediaId);
    const tr = P.transcripts?.[c.mediaId];
    if (!m || !tr) continue;
    const a = c.in, b = c.in + c.dur * c.speed;
    const toT = (s) => c.start + (s - c.in) / c.speed;
    const ws = tr.words.filter((w) => (w.s + w.e) / 2 >= a && (w.s + w.e) / 2 < b);
    if (out.length) out.push({ type: 'br' });
    let prevE = a;
    ws.forEach((w, i) => {
      const gap = w.s - prevE;
      if (gap > 0.35) out.push(gapToken(m, c, prevE, w.s, toT));
      const t = { type: 'w', w: w.w, s: w.s, e: w.e, t0: toT(Math.max(a, w.s)), t1: toT(Math.min(b, w.e)), clipId: c.id, mediaId: c.mediaId, cat: null };
      out.push(t);
      prevE = w.e;
    });
    if (b - prevE > 0.35 && ws.length) out.push(gapToken(m, c, prevE, b, toT));
  }
  classify(out);
  return out;
}

function gapToken(m, c, s, e, toT) {
  // ¿Hay voz en el hueco? Usa los picos (50 por segundo)
  // Con los bordes ya ajustados, voz dentro del hueco = sonido sin transcribir (eh, mmm)
  const thr = Math.max(0.012, speechLevel(m) * 0.3);
  let run = 0, best = 0;
  if (m.peaks) for (let i = Math.floor(s * 50) + 2; i < Math.floor(e * 50) - 2; i++) { if ((m.peaks[i] || 0) > thr) { run++; best = Math.max(best, run); } else run = 0; }
  const isSound = best >= 8; // al menos 160 ms seguidos de voz
  return { type: isSound ? 'sound' : 'pause', s, e, t0: toT(s), t1: toT(e), clipId: c.id, mediaId: c.mediaId };
}

function classify(tokens) {
  const ws = tokens.filter((t) => t.type === 'w');
  for (let i = 0; i < ws.length; i++) {
    const a = norm(ws[i].w), nx = ws[i + 1] ? norm(ws[i + 1].w) : '';
    if (SURE.has(a) || /^(e+h+|e{2,}|e+m+|m{2,}|h+m+|a{2,}h*|a+h+|u+m+|u+h+|m+h+m+)$/.test(a) || (a === 'e' && /[,.…]$/.test(ws[i].w))) ws[i].cat = 'filler';
    else if (MAYBE_TWO.has(a + ' ' + nx)) { ws[i].cat = 'maybe'; ws[i + 1].cat = 'maybe'; i++; }
    else if (MAYBE_ONE.has(a) && (/[,.]$/.test(ws[i].w) || /^[,]/.test(ws[i + 1]?.w || '') || i === 0 || /[.?!,]$/.test(ws[i - 1].w))) ws[i].cat = 'maybe';
    else if (a && a === nx && a.length > 0 && ws[i + 1].t0 - ws[i].t1 < 0.6) ws[i].cat = 'repeat';
  }
}

export function stats(tokens, pauseMin = 0.6) {
  const st = { filler: [], maybe: [], repeat: [], sound: [], pause: [] };
  for (const t of tokens) {
    if (t.type === 'w' && t.cat) st[t.cat].push(t);
    if (t.type === 'sound') st.sound.push(t);
    if (t.type === 'pause' && t.t1 - t.t0 >= pauseMin) st.pause.push(t);
  }
  return st;
}

// Rangos de línea de tiempo a borrar para un conjunto de tokens
export function rangesFor(tokens, picked, { keepPause = 0.25 } = {}) {
  const idx = new Map(tokens.map((t, i) => [t, i]));
  const ranges = [];
  for (const t of picked) {
    const i = idx.get(t);
    if (t.type === 'pause') {
      const len = t.t1 - t.t0;
      if (len > keepPause + 0.05) ranges.push([t.t0 + keepPause / 2, t.t1 - keepPause / 2]);
      continue;
    }
    if (t.type === 'sound') { ranges.push([t.t0 + 0.04, t.t1 - 0.04]); continue; }
    const prev = tokens[i - 1], next = tokens[i + 1];
    const lo = prev && prev.t1 != null && prev.clipId === t.clipId ? Math.max(prev.t1, t.t0 - 0.06) : t.t0 - 0.03;
    const hi = next && next.t0 != null && next.clipId === t.clipId ? Math.min(next.t0, t.t1 + 0.06) : t.t1 + 0.03;
    ranges.push([lo, hi]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const r of ranges) {
    if (r[1] - r[0] < 0.03) continue;
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1] + 0.05) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }
  return merged;
}

export function cutRanges(P, ranges) {
  const tracks = P.tracks.filter((t) => !t.music).map((t) => t.id);
  let total = 0;
  for (const [a, b] of [...ranges].sort((x, y) => y[0] - x[0])) { rippleDeleteRange(P, a, b, tracks); total += b - a; }
  return total;
}

// Palabras en tiempo de línea (para crear subtítulos sin volver a transcribir)
export function timelineWords(P) {
  return buildTokens(P).filter((t) => t.type === 'w').map((t) => ({ w: t.w, s: t.t0, e: t.t1 }));
}

// ---- Armar desde guion (IntelliScript ligero) ----
export function matchScript(P, script) {
  const sentences = script.split(/\n+|(?<=[.?!¿¡])\s+/).map((s) => s.trim()).filter((s) => norm(s).length > 1);
  const pool = [];
  for (const [mid, tr] of Object.entries(P.transcripts || {})) if (media.get(mid)) pool.push({ mid, words: tr.words, nw: tr.words.map((w) => norm(w.w)) });
  const result = [];
  for (const sent of sentences) {
    const target = norm(sent).split(/\s+/).filter(Boolean);
    const tset = new Map();
    for (const w of target) tset.set(w, (tset.get(w) || 0) + 1);
    let best = null;
    for (const p of pool) {
      const L = target.length;
      for (let len = Math.max(1, Math.floor(L * 0.7)); len <= Math.ceil(L * 1.3); len++) {
        for (let i = 0; i + len <= p.nw.length; i++) {
          const cnt = new Map(tset);
          let hit = 0;
          for (let j = i; j < i + len; j++) { const k = p.nw[j]; if (cnt.get(k) > 0) { hit++; cnt.set(k, cnt.get(k) - 1); } }
          const score = (2 * hit) / (L + len) + (p.nw[i] === target[0] ? 0.05 : 0) + (p.nw[i + len - 1] === target[L - 1] ? 0.05 : 0);
          // a igual puntuación gana la toma más reciente (suele ser la buena)
          if (!best || score > best.score + 1e-6 || (Math.abs(score - best.score) < 1e-6 && p.words[i].s >= best.s)) best = { score, mid: p.mid, s: p.words[i].s, e: p.words[i + len - 1].e };
        }
      }
    }
    result.push({ text: sent, match: best && best.score >= 0.55 ? best : null });
  }
  return result;
}

export function assembleScript(P, matches) {
  const main = P.tracks.find((t) => t.main).id;
  const voice = P.tracks.find((t) => t.type === 'audio' && !t.music && !t.guide && !t.sfx)?.id;
  P.clips = P.clips.filter((c) => c.trackId !== main && c.kind !== 'caption');
  let t = 0;
  for (const mt of matches) {
    if (!mt.match) continue;
    const m = media.get(mt.match.mid);
    const s = Math.max(0, mt.match.s - 0.08), e = Math.min(m.duration, mt.match.e + 0.15);
    const kind = m.type === 'audio' ? 'audio' : 'video';
    const c = makeClip(kind, kind === 'audio' ? voice : main, t, e - s, { mediaId: m.id, in: s });
    if (kind === 'video' && m.w > m.h && P.height > P.width) c.fit = 'blurfill';
    P.clips.push(c);
    t += e - s;
  }
  return t;
}

export { clipEnd };
