// Modelo del proyecto, historial (deshacer/rehacer) y utilidades de edición.
import { DEFAULT_COLOR, DEFAULT_TEXT } from './presets.js';

export const uid = (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const clone = (o) => JSON.parse(JSON.stringify(o));

export function newProject(aspect = { id: '9:16', w: 1080, h: 1920 }) {
  return {
    version: 1,
    name: 'Mi video',
    aspect: aspect.id, width: aspect.w, height: aspect.h, fps: 30,
    bg: '#000000', platform: 'tiktok', masterGain: 1, autoDuck: false, duckAmount: 0.25,
    tracks: [
      { id: 'tC', type: 'caption', name: 'Subtítulos', hidden: false, muted: false, locked: false },
      { id: 'tT', type: 'text', name: 'Texto', hidden: false, muted: false, locked: false },
      { id: 'tV2', type: 'video', name: 'Overlay', hidden: false, muted: false, locked: false },
      { id: 'tV1', type: 'video', name: 'Principal', hidden: false, muted: false, locked: false, main: true },
      { id: 'tA1', type: 'audio', name: 'Voz / Audio', hidden: false, muted: false, locked: false },
      { id: 'tA2', type: 'audio', name: 'Música', hidden: false, muted: false, locked: false, music: true },
    ],
    clips: [],
    markers: [],
  };
}

export function makeClip(kind, trackId, start, dur, extra = {}) {
  const base = {
    id: uid('c'), kind, trackId, start, dur, in: 0, speed: 1,
    volume: 1, fadeIn: 0, fadeOut: 0,
    transform: { x: 0, y: 0, scale: 1, rot: 0, opacity: 1, flipX: false },
    fit: 'cover', motion: 'none',
    color: { ...DEFAULT_COLOR },
    trans: { type: 'none', dur: 0.5 },
  };
  if (kind === 'text' || kind === 'caption') {
    base.text = { ...DEFAULT_TEXT, ...(extra.text || {}) };
    base.transform.y = kind === 'caption' ? 0.22 : 0;
    delete extra.text;
  }
  if (kind === 'solid') base.fill = extra.fill || ['#7c3aed', '#ec4899'];
  return Object.assign(base, extra);
}

export const clipEnd = (c) => c.start + c.dur;
export const srcDur = (c) => c.dur * c.speed;

export function projectDuration(P) {
  let d = 0;
  for (const c of P.clips) d = Math.max(d, clipEnd(c));
  return d;
}

export function trackById(P, id) { return P.tracks.find((t) => t.id === id); }
export function clipsOnTrack(P, trackId) {
  return P.clips.filter((c) => c.trackId === trackId).sort((a, b) => a.start - b.start);
}

// Historial
export class History {
  constructor(limit = 120) { this.stack = []; this.redo = []; this.limit = limit; }
  push(P) {
    this.stack.push(JSON.stringify(P));
    if (this.stack.length > this.limit) this.stack.shift();
    this.redo.length = 0;
  }
  undo(P) {
    if (!this.stack.length) return null;
    this.redo.push(JSON.stringify(P));
    return JSON.parse(this.stack.pop());
  }
  redoStep(P) {
    if (!this.redo.length) return null;
    this.stack.push(JSON.stringify(P));
    return JSON.parse(this.redo.pop());
  }
}

// Divide un clip en el tiempo t (tiempo de la línea). Devuelve el nuevo clip derecho.
export function splitClip(P, clip, t) {
  if (t <= clip.start + 0.03 || t >= clipEnd(clip) - 0.03) return null;
  const left = clip.dur;
  const offset = t - clip.start;
  const right = clone(clip);
  right.id = uid('c');
  right.start = t;
  right.dur = left - offset;
  right.in = clip.in + offset * clip.speed;
  right.trans = { type: 'none', dur: 0.5 };
  right.fadeIn = 0;
  clip.dur = offset;
  clip.fadeOut = 0;
  if (clip.words) {
    right.words = clip.words.filter((w) => w.s >= t);
    clip.words = clip.words.filter((w) => w.s < t);
  }
  P.clips.push(right);
  return right;
}

// Borra el rango [a,b) de toda la línea de tiempo y desplaza lo posterior (ripple).
export function rippleDeleteRange(P, a, b, onlyTracks = null) {
  const len = b - a;
  if (len <= 0) return;
  const affected = (c) => !onlyTracks || onlyTracks.includes(c.trackId);
  for (const c of [...P.clips]) {
    if (!affected(c)) continue;
    if (c.start < a && clipEnd(c) > a) splitClip(P, c, a);
  }
  for (const c of [...P.clips]) {
    if (!affected(c)) continue;
    if (c.start < b && clipEnd(c) > b) splitClip(P, c, b);
  }
  P.clips = P.clips.filter((c) => !(affected(c) && c.start >= a - 1e-6 && clipEnd(c) <= b + 1e-6));
  for (const c of P.clips) if (affected(c) && c.start >= b - 1e-6) c.start -= len;
  P.markers = P.markers.filter((m) => m.t < a || m.t >= b).map((m) => (m.t >= b ? { ...m, t: m.t - len } : m));
}

// Inserta un clip al final de un track
export function trackEnd(P, trackId) {
  let e = 0;
  for (const c of P.clips) if (c.trackId === trackId) e = Math.max(e, clipEnd(c));
  return e;
}

export function fmtTime(s, fps = 30, withFrames = false) {
  if (!isFinite(s)) s = 0;
  const neg = s < 0; s = Math.abs(s);
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  let out = `${neg ? '-' : ''}${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  if (withFrames) out += ':' + String(Math.floor((s % 1) * fps)).padStart(2, '0');
  else out += '.' + String(Math.floor((s % 1) * 10));
  return out;
}

export function fmtBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB';
  return (b / 1073741824).toFixed(2) + ' GB';
}
