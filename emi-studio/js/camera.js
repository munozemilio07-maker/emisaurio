// Cámara inteligente: reencuadre siguiendo caras, quitar fondo y multicámara automática.
import * as MB from 'mediabunny';
import { clipEnd, clipsOnTrack, makeClip, clamp } from './state.js';
import { media } from './media.js';
import { detectFaces } from './vision.js';

// ---------- Reencuadre automático ----------
// Analiza las caras en los tramos usados por los clips y guarda una "trayectoria de cámara" por archivo.
export async function analyzeReframe(P, clips, onProgress, signal) {
  P.faceTracks = P.faceTracks || {};
  const byMedia = new Map();
  for (const c of clips) {
    if (c.kind !== 'video') continue;
    if (!byMedia.has(c.mediaId)) byMedia.set(c.mediaId, []);
    byMedia.get(c.mediaId).push([c.in, c.in + c.dur * c.speed]);
  }
  let done = 0, total = 0;
  const STEP = 0.2;
  for (const r of byMedia.values()) for (const [a, b] of r) total += Math.ceil((b - a) / STEP);
  for (const [mid, ranges] of byMedia) {
    const m = media.get(mid);
    const input = new MB.Input({ source: new MB.BlobSource(m.file), formats: MB.ALL_FORMATS });
    const track = await input.getPrimaryVideoTrack();
    const first = Math.max(0, await track.getFirstTimestamp().catch(() => 0));
    const sink = new MB.CanvasSink(track, { width: 480, poolSize: 2 });
    const times = [];
    ranges.sort((x, y) => x[0] - y[0]);
    for (const [a, b] of ranges) for (let s = a; s < b; s += STEP) if (!times.length || s > times[times.length - 1] + STEP * 0.5) times.push(+s.toFixed(3));
    const raw = [];
    let k = 0;
    for await (const fr of sink.canvasesAtTimestamps(times.map((t) => t + first))) {
      if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError');
      const s = times[k++];
      const faces = fr ? await detectFaces(fr.canvas) : [];
      raw.push([s, faces]);
      onProgress?.(++done / total);
    }
    const path = cameraPath(raw, m.w / m.h);
    const old = P.faceTracks[mid]?.pts || [];
    const lo = times[0] ?? 0, hi = times[times.length - 1] ?? 0;
    const merged = old.filter(([s]) => s < lo || s > hi).concat(path).sort((x, y) => x[0] - y[0]);
    P.faceTracks[mid] = { pts: merged.map(([s, x, y]) => [+s.toFixed(3), +x.toFixed(4), +y.toFixed(4)]) };
  }
  for (const c of clips) if (c.kind === 'video') { c.reframe = true; c.fit = 'cover'; }
  return byMedia.size;
}

// "Camarógrafo virtual": zona muerta, paneo suave y corte cuando la persona cambia de lugar
function cameraPath(raw, ar) {
  let cx = null, cy = 0.4, pend = 0, pendX = 0;
  const out = [];
  const DEAD = 0.05, MAXV = 0.06; // fracción del ancho por muestra (0.2 s)
  for (const [s, faces] of raw) {
    let target = null;
    if (faces.length) {
      const big = Math.max(...faces.map((f) => f.w * f.h));
      const cands = faces.filter((f) => f.w * f.h >= big * 0.6);
      // se queda con la cara más cercana a la que ya seguía (evita saltos entre dos personas)
      target = cx == null ? cands.sort((a, b) => b.w * b.h - a.w * a.h)[0] : cands.sort((a, b) => Math.abs(a.x - cx) - Math.abs(b.x - cx))[0];
      if (cx != null && big > target.w * target.h * 1.5) target = faces.find((f) => f.w * f.h === big);
    }
    if (!target) { if (cx != null) out.push([s, cx, cy]); continue; }
    const ty = clamp(target.y - target.h * 0.1, 0.2, 0.8);
    if (cx == null) { cx = target.x; cy = ty; out.push([s, cx, cy]); continue; }
    const d = target.x - cx;
    if (Math.abs(d) > 0.28) {
      // salto grande: si se mantiene ~0.6 s, corte seco
      pend = Math.abs(pendX - target.x) < 0.12 ? pend + 1 : 1; pendX = target.x;
      if (pend >= 3) { out.push([s - 0.001, cx, cy]); cx = target.x; cy = ty; pend = 0; }
    } else {
      pend = 0;
      if (Math.abs(d) > DEAD) cx += Math.sign(d) * Math.min(MAXV, Math.abs(d) - DEAD * 0.5);
      cy += (ty - cy) * 0.2;
    }
    out.push([s, cx, cy]);
  }
  return out;
}

export function camAt(track, s) {
  const p = track?.pts;
  if (!p?.length) return null;
  if (s <= p[0][0]) return [p[0][1], p[0][2]];
  if (s >= p[p.length - 1][0]) return [p[p.length - 1][1], p[p.length - 1][2]];
  let lo = 0, hi = p.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (p[mid][0] <= s) lo = mid; else hi = mid; }
  const [s0, x0, y0] = p[lo], [s1, x1, y1] = p[hi];
  const k = s1 > s0 ? (s - s0) / (s1 - s0) : 0;
  return [x0 + (x1 - x0) * k, y0 + (y1 - y0) * k];
}

// ---------- Croma: color de fondo automático (bordes del fotograma) ----------
export function guessKeyColor(src) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 36;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(src, 0, 0, 64, 36);
  const d = g.getImageData(0, 0, 64, 36).data;
  let r = 0, gg = 0, b = 0, n = 0;
  for (let y = 0; y < 36; y++) for (let x = 0; x < 64; x++) {
    if (x > 3 && x < 60 && y > 3 && y < 32) continue;
    const i = (y * 64 + x) * 4; r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++;
  }
  const h = (v) => Math.round(v / n).toString(16).padStart(2, '0');
  return '#' + h(r) + h(gg) + h(b);
}

// ---------- Multicámara ----------
function envelope(m, rate = 10) {
  const pk = m.peaks; const k = 50 / rate;
  const out = new Float32Array(Math.floor(pk.length / k));
  for (let i = 0; i < out.length; i++) {
    const a = Math.floor(i * k), b = Math.max(a + 1, Math.floor((i + 1) * k));
    let s = 0; for (let j = a; j < b; j++) s += pk[j] || 0;
    out[i] = s / (b - a);
  }
  return out;
}

// Desfase (s) de B respecto a A por correlación cruzada de la envolvente de audio: tiempoB = tiempoA + d
export function syncOffset(mA, mB, maxLag = 120) {
  const rate = 20;
  // Cambios del volumen en escala logarítmica: así coinciden aunque cada micro tenga otra ganancia
  const feat = (m) => {
    const e = envelope(m, rate);
    const d = new Float32Array(e.length);
    // |cambio|: cuando uno habla, un micro sube y el otro baja, pero los dos cambian a la vez
    for (let i = 1; i < e.length; i++) d[i] = Math.abs(Math.log(e[i] + 1e-3) - Math.log(e[i - 1] + 1e-3));
    let mu = 0; for (const v of d) mu += v; mu /= d.length || 1;
    let s = 0; for (const v of d) s += (v - mu) ** 2;
    const k = 1 / Math.sqrt(s / d.length || 1);
    return d.map((v) => Math.max(-3, Math.min(4, (v - mu) * k)));
  };
  const A = feat(mA), B = feat(mB);
  const L = Math.min(maxLag * rate, Math.max(A.length, B.length));
  let best = 0, bestV = -Infinity;
  for (let d = -L; d <= L; d++) {
    let s = 0, n = 0;
    for (let i = Math.max(0, -d); i < A.length && i + d < B.length; i++) { s += A[i] * B[i + d]; n++; }
    if (n > rate * 3) { const v = s / Math.sqrt(n); if (v > bestV) { bestV = v; best = d; } }
  }
  return best / rate;
}

// Monta los ángulos: cambia al que tiene más voz (si cada uno tiene su micro) o alterna con ritmo
export function buildMulticam(P, mediaIds, { minShot = 2.2, audioFrom = 0 } = {}) {
  const ms = mediaIds.map((id) => media.get(id));
  const offs = ms.map((m, i) => (i === 0 ? 0 : syncOffset(ms[0], m)));
  // tramo común en el tiempo del ángulo 0
  const start = Math.max(0, ...offs.map((d) => -d));
  const end = Math.min(...ms.map((m, i) => m.duration - offs[i]));
  if (end - start < 1) throw new Error('Los videos no coinciden en el tiempo.');
  const win = 0.5;
  const energy = ms.map((m) => m.peaks);
  const level = (k, t) => { const pk = energy[k]; if (!pk) return 0; const s0 = Math.floor((t + offs[k]) * 50), s1 = Math.floor((t + win + offs[k]) * 50); let s = 0; for (let i = s0; i < s1; i++) s += pk[i] || 0; return s / Math.max(1, s1 - s0); };
  const med = ms.map((_, k) => { const v = []; for (let t = start; t < end; t += 2) v.push(level(k, t)); v.sort((a, b) => a - b); return v[Math.floor(v.length / 2)] || 1e-3; });
  // ¿micros independientes? si las envolventes son casi iguales, no sirve para elegir
  let diff = 0, cnt = 0;
  for (let t = start; t < end; t += 1) { const l = ms.map((_, k) => level(k, t) / med[k]); diff += Math.max(...l) - Math.min(...l); cnt++; }
  const independent = diff / cnt > 0.35 && ms.length > 1;
  const segs = [];
  let cur = 0, since = start;
  for (let t = start; t < end; t += win) {
    let want = cur;
    if (independent) {
      const l = ms.map((_, k) => level(k, t) / med[k]);
      const best = l.indexOf(Math.max(...l));
      if (best !== cur && l[best] > l[cur] * 1.35) want = best;
    } else if (t - since >= 4 + ((segs.length * 7) % 3)) want = (cur + 1) % ms.length;
    if (want !== cur && t - since >= minShot) { segs.push([since, t, cur]); since = t; cur = want; }
  }
  if (end - since > 0.1 || !segs.length) segs.push([since, end, cur]);
  else segs[segs.length - 1][1] = end;
  const main = P.tracks.find((t) => t.main).id;
  const voice = P.tracks.find((t) => t.type === 'audio' && !t.music && !t.guide && !t.sfx).id;
  P.clips = P.clips.filter((c) => c.trackId !== main && c.trackId !== voice);
  for (const [a, b, k] of segs) {
    const m = ms[k];
    const c = makeClip('video', main, a - start, b - a, { mediaId: m.id, in: a + offs[k], volume: 0 });
    if (m.w > m.h && P.height > P.width) c.fit = 'cover';
    P.clips.push(c);
  }
  const am = ms[audioFrom];
  P.clips.push(makeClip('audio', voice, 0, end - start, { mediaId: am.id, in: start + offs[audioFrom] }));
  return { offsets: offs, segments: segs.length, independent, duration: end - start };
}

export { clipEnd, clipsOnTrack };
