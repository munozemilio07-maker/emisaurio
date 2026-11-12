// Audio: decodificación, picos de onda, mezcla offline (exportación) y análisis.
import { clipEnd, clamp } from './state.js';

let actx = null;
export function audioCtx() {
  if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
  return actx;
}

export async function decodeFile(file) {
  try {
    const buf = await file.arrayBuffer();
    return await audioCtx().decodeAudioData(buf);
  } catch { return null; }
}

export function computePeaks(buffer, perSecond = 50) {
  const n = Math.max(1, Math.ceil(buffer.duration * perSecond));
  const ch = buffer.getChannelData(0);
  const ch2 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : null;
  const step = ch.length / n;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let m = 0;
    const a = Math.floor(i * step), b = Math.min(ch.length, Math.floor((i + 1) * step));
    for (let j = a; j < b; j += 4) {
      const v = Math.abs(ch[j]) + (ch2 ? Math.abs(ch2[j]) : 0);
      if (v > m) m = v;
    }
    out[i] = ch2 ? m / 2 : m;
  }
  return out;
}

// Ganancia de un clip en un tiempo de línea (volumen + fundidos)
export function clipGainAt(c, t) {
  let g = c.volume;
  const lt = t - c.start, rem = clipEnd(c) - t;
  if (c.fadeIn > 0 && lt < c.fadeIn) g *= clamp(lt / c.fadeIn, 0, 1);
  if (c.fadeOut > 0 && rem < c.fadeOut) g *= clamp(rem / c.fadeOut, 0, 1);
  return g;
}

export function audibleClips(P, media) {
  return P.clips.filter((c) => {
    const tr = P.tracks.find((x) => x.id === c.trackId);
    if (!tr || tr.muted) return false;
    const m = media.get(c.mediaId);
    return m && m.audio && (c.kind === 'audio' || c.kind === 'video') && c.volume > 0;
  });
}

// Envolvente de voz (20 Hz) para el ducking automático de la música
export function voiceEnvelope(P, media) {
  const rate = 20;
  let dur = 0;
  for (const c of P.clips) dur = Math.max(dur, clipEnd(c));
  const env = new Float32Array(Math.ceil(dur * rate) + 1);
  for (const c of audibleClips(P, media)) {
    const tr = P.tracks.find((x) => x.id === c.trackId);
    if (tr.music) continue;
    const m = media.get(c.mediaId);
    const pk = m.peaks; if (!pk) continue;
    for (let i = Math.floor(c.start * rate); i < Math.ceil(clipEnd(c) * rate) && i < env.length; i++) {
      const st = c.in + (i / rate - c.start) * c.speed;
      const v = pk[Math.floor(st * 50)] || 0;
      if (v > env[i]) env[i] = v;
    }
  }
  // umbral + suavizado (ataque rápido, liberación lenta)
  const out = new Float32Array(env.length);
  let cur = 0;
  for (let i = 0; i < env.length; i++) {
    const target = env[i] > 0.06 ? 1 : 0;
    cur = target > cur ? Math.min(1, cur + 0.5) : Math.max(0, cur - 0.08);
    out[i] = cur;
  }
  return { rate, env: out };
}

export function duckGain(P, venv, t) {
  if (!P.autoDuck || !venv) return 1;
  const v = venv.env[Math.floor(t * venv.rate)] || 0;
  return 1 - v * (1 - P.duckAmount);
}

// Cadena "Voz clara": corta graves, realza presencia y aire, comprime y compensa.
// Se activa/desactiva por parámetros, así no hay que recablear durante la reproducción.
export function voiceChain(ctx) {
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.Q.value = 0.7;
  const mud = ctx.createBiquadFilter(); mud.type = 'peaking'; mud.frequency.value = 300; mud.Q.value = 1;
  const pres = ctx.createBiquadFilter(); pres.type = 'peaking'; pres.frequency.value = 3200; pres.Q.value = 0.9;
  const air = ctx.createBiquadFilter(); air.type = 'highshelf'; air.frequency.value = 9000;
  const comp = ctx.createDynamicsCompressor(); comp.knee.value = 8; comp.attack.value = 0.005; comp.release.value = 0.12;
  const makeup = ctx.createGain();
  hp.connect(mud).connect(pres).connect(air).connect(comp).connect(makeup);
  const set = (on) => {
    hp.frequency.value = on ? 90 : 10;
    mud.gain.value = on ? -2.5 : 0;
    pres.gain.value = on ? 4 : 0;
    air.gain.value = on ? 2.5 : 0;
    comp.threshold.value = on ? -26 : 0;
    comp.ratio.value = on ? 3.5 : 1;
    makeup.gain.value = on ? 1.7 : 1;
  };
  set(false);
  return { input: hp, output: makeup, set };
}

// Mezcla offline de todo el proyecto → AudioBuffer
// opts.filter(clip, track) decide qué clips entran; opts.channels (1 ó 2)
export async function mixOffline(P, media, sampleRate = 48000, t0 = 0, t1 = null, opts = {}) {
  let dur = 0;
  for (const c of P.clips) dur = Math.max(dur, clipEnd(c));
  if (t1 == null) t1 = dur;
  const len = Math.max(1, Math.ceil((t1 - t0) * sampleRate));
  const ctx = new OfflineAudioContext(opts.channels || 2, len, sampleRate);
  const master = ctx.createGain();
  master.gain.value = P.masterGain ?? 1;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -1.5; limiter.knee.value = 0; limiter.ratio.value = 20;
  limiter.attack.value = 0.002; limiter.release.value = 0.08;
  master.connect(limiter).connect(ctx.destination);
  const venv = P.autoDuck ? voiceEnvelope(P, media) : null;

  for (const c of audibleClips(P, media)) {
    const a = Math.max(c.start, t0), b = Math.min(clipEnd(c), t1);
    if (b <= a) continue;
    const m = media.get(c.mediaId);
    if (opts.filter && !opts.filter(c, P.tracks.find((x) => x.id === c.trackId))) continue;
    const src = ctx.createBufferSource();
    src.buffer = m.audio;
    src.playbackRate.value = c.speed;
    const g = ctx.createGain();
    const tr = P.tracks.find((x) => x.id === c.trackId);
    // automatización de ganancia cada 50 ms (fundidos + ducking)
    const steps = Math.ceil((b - a) * 20);
    for (let i = 0; i <= steps; i++) {
      const tt = Math.min(b, a + i / 20);
      let v = clipGainAt(c, tt);
      if (tr.music) v *= duckGain(P, venv, tt);
      g.gain.setValueAtTime(v, tt - t0);
    }
    if (c.enhance) { const ch = voiceChain(ctx); ch.set(true); src.connect(ch.input); ch.output.connect(g); }
    else src.connect(g);
    g.connect(master);
    const offset = c.in + (a - c.start) * c.speed;
    src.start(a - t0, offset, (b - a) * c.speed);
  }
  return await ctx.startRendering();
}

// Nivel RMS en dBFS (aprox. de sonoridad)
export function rmsDb(buffer) {
  let sum = 0, n = 0;
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const d = buffer.getChannelData(ch);
    for (let i = 0; i < d.length; i += 8) { sum += d[i] * d[i]; n++; }
  }
  return 10 * Math.log10(sum / Math.max(1, n) + 1e-12);
}

// Detección de silencios en un AudioBuffer → [[a,b], ...] en tiempo de la fuente
export function detectSilences(buffer, { thresholdDb = -38, minDur = 0.6, pad = 0.12 } = {}) {
  const sr = buffer.sampleRate, win = Math.floor(sr * 0.02);
  const d = buffer.getChannelData(0);
  const thr = Math.pow(10, thresholdDb / 20);
  const res = [];
  let start = null;
  for (let i = 0; i < d.length; i += win) {
    let s = 0;
    for (let j = i; j < Math.min(d.length, i + win); j += 2) s += d[j] * d[j];
    const rms = Math.sqrt(s / (win / 2));
    const t = i / sr;
    if (rms < thr) { if (start === null) start = t; }
    else if (start !== null) {
      if (t - start >= minDur) res.push([start + pad, t - pad]);
      start = null;
    }
  }
  if (start !== null && buffer.duration - start >= minDur) res.push([start + pad, buffer.duration]);
  return res.filter(([a, b]) => b - a > 0.2);
}

// Detección de beats (onsets de energía) → tiempos en segundos de la fuente
export function detectBeats(buffer) {
  const sr = buffer.sampleRate, hop = Math.floor(sr * 0.01);
  const d = buffer.getChannelData(0);
  const energy = [];
  for (let i = 0; i < d.length; i += hop) {
    let s = 0;
    for (let j = i; j < Math.min(d.length, i + hop); j++) s += d[j] * d[j];
    energy.push(s);
  }
  const beats = [];
  let last = -1;
  for (let i = 43; i < energy.length; i++) {
    let avg = 0;
    for (let j = i - 43; j < i; j++) avg += energy[j];
    avg /= 43;
    const t = i * 0.01;
    if (energy[i] > avg * 1.6 && energy[i] > 0.01 && t - last > 0.28) { beats.push(t); last = t; }
  }
  return beats;
}

// Mide la sonoridad aproximada del proyecto y devuelve la ganancia para llegar a ~-14 LUFS (redes sociales)
export async function loudnessGain(P, media) {
  const mix = await mixOffline({ ...P, masterGain: 1 }, media, 16000, 0, null, { channels: 1 });
  // RMS sólo de las partes con sonido (ignora silencios largos)
  const d = mix.getChannelData(0), win = 1600;
  let sum = 0, n = 0;
  for (let i = 0; i < d.length; i += win) {
    let s = 0;
    for (let j = i; j < Math.min(d.length, i + win); j++) s += d[j] * d[j];
    const r = s / win;
    if (r > 1e-5) { sum += r; n++; }
  }
  if (!n) return { db: -Infinity, gain: 1 };
  const db = 10 * Math.log10(sum / n);
  const target = -15.5; // RMS en dBFS ≈ -14 LUFS para voz/música
  return { db, gain: Math.max(0.2, Math.min(4, Math.pow(10, (target - db) / 20))) };
}
