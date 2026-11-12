// Biblioteca de medios: importación de vídeo, imagen y audio.
import { uid } from './state.js';
import { decodeFile, computePeaks } from './audio.js';
import { analyzeAudio, analysisBuffer } from './audiostream.js';

export const media = new Map();

// Estadísticas de imagen (luz, contraste, saturación) para el auto-color
export function imageStats(canvas) {
  const g = canvas.getContext('2d');
  const d = g.getImageData(0, 0, canvas.width, canvas.height).data;
  let L = 0, L2 = 0, S = 0, n = 0;
  for (let i = 0; i < d.length; i += 16) {
    const r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255;
    const l = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
    const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
    L += l; L2 += l * l; S += mx ? (mx - mn) / mx : 0; n++;
  }
  L /= n; S /= n;
  return { lum: L, contrast: Math.sqrt(Math.max(0, L2 / n - L * L)), sat: S };
}

function kindOf(file) {
  const t = file.type || '';
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (t.startsWith('video/') || ['mp4', 'mov', 'webm', 'mkv', 'm4v', 'avi', '3gp', 'ogv'].includes(ext)) return 'video';
  if (t.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif', 'heic'].includes(ext)) return 'image';
  if (t.startsWith('audio/') || ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'opus', 'flac', 'weba'].includes(ext)) return 'audio';
  return null;
}

function loadVideoMeta(url) {
  return new Promise((res, rej) => {
    const v = document.createElement('video');
    v.preload = 'auto'; v.muted = true; v.playsInline = true; v.src = url;
    v.onloadedmetadata = () => {
      const seekTo = Math.min(0.5, (v.duration || 1) / 3);
      v.currentTime = seekTo;
    };
    v.onseeked = () => {
      const c = document.createElement('canvas');
      const s = 240 / Math.max(v.videoWidth, v.videoHeight);
      c.width = Math.max(1, Math.round(v.videoWidth * s)); c.height = Math.max(1, Math.round(v.videoHeight * s));
      c.getContext('2d', { willReadFrequently: true }).drawImage(v, 0, 0, c.width, c.height);
      res({ duration: v.duration, w: v.videoWidth, h: v.videoHeight, thumb: c.toDataURL('image/jpeg', 0.75), stats: imageStats(c) });
      v.removeAttribute('src'); v.load();
    };
    v.onerror = () => rej(new Error('No se pudo leer el vídeo (¿códec no soportado por el navegador?)'));
  });
}

// Archivos usados en la línea de tiempo cuyo audio aún se está analizando
export function audioPending(P) {
  const ids = new Set(P.clips.map((c) => c.mediaId).filter(Boolean));
  return [...ids].map((id) => media.get(id)).filter((m) => m && (m.type === 'video' || m.type === 'audio') && !m.missing && !m.audioReady);
}

let persistFn = null;
export function setPersist(fn) { persistFn = fn; }

// opts.id: reutilizar un id (al abrir un proyecto guardado o volver a vincular). opts.persist=false: no guardar copia.
async function to16k(buf) {
  const ctx = new OfflineAudioContext(1, Math.ceil(buf.duration * 16000), 16000);
  const s = ctx.createBufferSource(); s.buffer = buf; s.connect(ctx.destination); s.start();
  return (await ctx.startRendering()).getChannelData(0);
}

// Audio: lectura en streaming (sirve para archivos enormes). Si el navegador no puede, respaldo para archivos pequeños.
async function loadAudio(m, file) {
  try {
    const r = await analyzeAudio(file);
    if (!r) return;
    Object.assign(m, { audio: analysisBuffer(r.a16, r.duration), peaks: r.peaks, sampleRate: r.sampleRate, channels: r.channels });
    if (m.type === 'audio') m.duration = r.duration;
  } catch (e) {
    console.warn('Audio por streaming no disponible, uso el método clásico:', e);
    if (file.size > 400 * 1024 * 1024) { m.audioError = 'Archivo demasiado grande para decodificar su audio en este navegador.'; return; }
    const buf = await decodeFile(file);
    if (!buf) return;
    Object.assign(m, { fullAudio: buf, peaks: computePeaks(buf), audio: analysisBuffer(await to16k(buf), buf.duration), sampleRate: buf.sampleRate, channels: buf.numberOfChannels });
    if (m.type === 'audio') m.duration = buf.duration;
  }
}

export async function importFile(file, onUpdate, opts = {}) {
  const kind = kindOf(file);
  if (!kind) throw new Error(`Formato no reconocido: ${file.name}`);
  const id = opts.id || uid('m');
  if (opts.persist !== false && persistFn) persistFn(id, file);
  const url = URL.createObjectURL(file);
  const m = { id, name: file.name, type: kind, file, url, duration: 0, w: 0, h: 0, thumb: null, audio: null, peaks: null, loading: true };
  media.set(id, m);
  onUpdate?.();
  if (kind === 'video') {
    Object.assign(m, await loadVideoMeta(url));
    m.loading = false; onUpdate?.();
    // Audio en segundo plano
    loadAudio(m, file).finally(() => { m.audioReady = true; onUpdate?.('audio', m); });
  } else if (kind === 'image') {
    m.bitmap = await createImageBitmap(file);
    m.w = m.bitmap.width; m.h = m.bitmap.height; m.duration = 5;
    const c = document.createElement('canvas');
    const s = 240 / Math.max(m.w, m.h);
    c.width = Math.round(m.w * s); c.height = Math.round(m.h * s);
    c.getContext('2d', { willReadFrequently: true }).drawImage(m.bitmap, 0, 0, c.width, c.height);
    m.thumb = c.toDataURL('image/jpeg', 0.8);
    m.stats = imageStats(c);
    m.loading = false; m.audioReady = true;
  } else {
    await loadAudio(m, file);
    if (!m.audio) { media.delete(id); throw new Error(`No se pudo leer el audio de ${file.name}`); }
    m.loading = false; m.audioReady = true;
  }
  onUpdate?.();
  return m;
}
