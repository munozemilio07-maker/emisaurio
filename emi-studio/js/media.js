// Biblioteca de medios: importación de vídeo, imagen y audio.
import { uid } from './state.js';
import { decodeFile, computePeaks } from './audio.js';

export const media = new Map();

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
      c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
      res({ duration: v.duration, w: v.videoWidth, h: v.videoHeight, thumb: c.toDataURL('image/jpeg', 0.75) });
      v.removeAttribute('src'); v.load();
    };
    v.onerror = () => rej(new Error('No se pudo leer el vídeo (¿códec no soportado por el navegador?)'));
  });
}

export async function importFile(file, onUpdate) {
  const kind = kindOf(file);
  if (!kind) throw new Error(`Formato no reconocido: ${file.name}`);
  const id = uid('m');
  const url = URL.createObjectURL(file);
  const m = { id, name: file.name, type: kind, file, url, duration: 0, w: 0, h: 0, thumb: null, audio: null, peaks: null, loading: true };
  media.set(id, m);
  onUpdate?.();
  if (kind === 'video') {
    Object.assign(m, await loadVideoMeta(url));
    m.loading = false; onUpdate?.();
    // Audio en segundo plano
    decodeFile(file).then((buf) => {
      if (buf) { m.audio = buf; m.peaks = computePeaks(buf); }
      m.audioReady = true; onUpdate?.('audio', m);
    });
  } else if (kind === 'image') {
    m.bitmap = await createImageBitmap(file);
    m.w = m.bitmap.width; m.h = m.bitmap.height; m.duration = 5;
    const c = document.createElement('canvas');
    const s = 240 / Math.max(m.w, m.h);
    c.width = Math.round(m.w * s); c.height = Math.round(m.h * s);
    c.getContext('2d').drawImage(m.bitmap, 0, 0, c.width, c.height);
    m.thumb = c.toDataURL('image/jpeg', 0.8);
    m.loading = false; m.audioReady = true;
  } else {
    const buf = await decodeFile(file);
    if (!buf) throw new Error(`No se pudo decodificar el audio: ${file.name}`);
    m.audio = buf; m.peaks = computePeaks(buf); m.duration = buf.duration;
    m.loading = false; m.audioReady = true;
  }
  onUpdate?.();
  return m;
}
