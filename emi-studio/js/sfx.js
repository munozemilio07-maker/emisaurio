// Efectos de sonido sintetizados en el navegador: sin archivos externos y sin derechos de autor.
import { media, importFile } from './media.js';

const SR = 48000;
function noise(ctx, dur) {
  const b = ctx.createBuffer(2, Math.ceil(dur * SR), SR);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = ctx.createBufferSource(); s.buffer = b; return s;
}
function env(ctx, g, pts) { g.gain.setValueAtTime(pts[0][1], pts[0][0]); for (const [t, v] of pts.slice(1)) g.gain.linearRampToValueAtTime(v, t); }
const expEnv = (g, t0, peak, dur) => { g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); };

export const SFX = [
  { id: 'whoosh', name: 'Whoosh', icon: '💨', dur: 0.7, build(ctx) {
    const n = noise(ctx, 0.7), f = ctx.createBiquadFilter(), g = ctx.createGain(), p = ctx.createStereoPanner();
    f.type = 'bandpass'; f.Q.value = 1.4; f.frequency.setValueAtTime(250, 0); f.frequency.exponentialRampToValueAtTime(4500, 0.38); f.frequency.exponentialRampToValueAtTime(900, 0.7);
    env(ctx, g, [[0, 0], [0.32, 0.9], [0.7, 0]]); p.pan.setValueAtTime(-0.8, 0); p.pan.linearRampToValueAtTime(0.8, 0.7);
    n.connect(f).connect(g).connect(p).connect(ctx.destination); n.start(0);
  } },
  { id: 'swish', name: 'Swish rápido', icon: '🌀', dur: 0.35, build(ctx) {
    const n = noise(ctx, 0.35), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'highpass'; f.frequency.setValueAtTime(800, 0); f.frequency.exponentialRampToValueAtTime(6000, 0.2);
    env(ctx, g, [[0, 0], [0.12, 0.8], [0.35, 0]]);
    n.connect(f).connect(g).connect(ctx.destination); n.start(0);
  } },
  { id: 'pop', name: 'Pop', icon: '🫧', dur: 0.25, build(ctx) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(900, 0); o.frequency.exponentialRampToValueAtTime(180, 0.09);
    expEnv(g, 0, 0.9, 0.2); o.connect(g).connect(ctx.destination); o.start(0); o.stop(0.25);
  } },
  { id: 'ding', name: 'Ding', icon: '🔔', dur: 1.4, build(ctx) {
    for (const [f, a] of [[1320, 0.5], [2640, 0.18], [3960, 0.08]]) {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; expEnv(g, 0, a, 1.35); o.connect(g).connect(ctx.destination); o.start(0); o.stop(1.4);
    }
  } },
  { id: 'boom', name: 'Boom / impacto', icon: '💥', dur: 1.2, build(ctx) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(90, 0); o.frequency.exponentialRampToValueAtTime(32, 0.9); expEnv(g, 0, 1, 1.1);
    o.connect(g).connect(ctx.destination); o.start(0); o.stop(1.2);
    const n = noise(ctx, 0.4), f = ctx.createBiquadFilter(), g2 = ctx.createGain();
    f.type = 'lowpass'; f.frequency.value = 900; expEnv(g2, 0, 0.7, 0.35); n.connect(f).connect(g2).connect(ctx.destination); n.start(0);
  } },
  { id: 'riser', name: 'Riser (tensión)', icon: '📈', dur: 2.2, build(ctx) {
    const o = ctx.createOscillator(), g = ctx.createGain(), n = noise(ctx, 2.2), f = ctx.createBiquadFilter(), g2 = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(180, 0); o.frequency.exponentialRampToValueAtTime(1400, 2.1);
    env(ctx, g, [[0, 0], [2.05, 0.18], [2.2, 0]]);
    f.type = 'bandpass'; f.frequency.setValueAtTime(400, 0); f.frequency.exponentialRampToValueAtTime(7000, 2.1);
    env(ctx, g2, [[0, 0], [2.05, 0.6], [2.2, 0]]);
    o.connect(g).connect(ctx.destination); n.connect(f).connect(g2).connect(ctx.destination); o.start(0); o.stop(2.2); n.start(0);
  } },
  { id: 'click', name: 'Clic', icon: '🖱', dur: 0.08, build(ctx) {
    const n = noise(ctx, 0.08), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'highpass'; f.frequency.value = 2500; expEnv(g, 0, 0.8, 0.05); n.connect(f).connect(g).connect(ctx.destination); n.start(0);
  } },
  { id: 'shutter', name: 'Cámara', icon: '📸', dur: 0.3, build(ctx) {
    for (const t0 of [0, 0.12]) { const n = noise(ctx, 0.3), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'bandpass'; f.frequency.value = 3000; expEnv(g, t0, 0.8, 0.06); n.connect(f).connect(g).connect(ctx.destination); n.start(0); }
  } },
  { id: 'notif', name: 'Notificación', icon: '📱', dur: 0.7, build(ctx) {
    [[880, 0], [1320, 0.13]].forEach(([fr, t0]) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = fr; expEnv(g, t0, 0.5, 0.45); o.connect(g).connect(ctx.destination); o.start(t0); o.stop(t0 + 0.55); });
  } },
  { id: 'glitch', name: 'Glitch', icon: '⚡', dur: 0.45, build(ctx) {
    for (let i = 0; i < 9; i++) { const o = ctx.createOscillator(), g = ctx.createGain(), t0 = i * 0.045; o.type = 'square'; o.frequency.value = 120 + Math.random() * 1800; g.gain.setValueAtTime(0.25, t0); g.gain.setValueAtTime(0, t0 + 0.03); o.connect(g).connect(ctx.destination); o.start(t0); o.stop(t0 + 0.04); }
  } },
  { id: 'scratch', name: 'Rayón de disco', icon: '💿', dur: 0.6, build(ctx) {
    const n = noise(ctx, 0.6), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'bandpass'; f.Q.value = 6; f.frequency.setValueAtTime(2000, 0); f.frequency.exponentialRampToValueAtTime(300, 0.25); f.frequency.exponentialRampToValueAtTime(1800, 0.5);
    env(ctx, g, [[0, 0.9], [0.55, 0.5], [0.6, 0]]); n.connect(f).connect(g).connect(ctx.destination); n.start(0);
  } },
  { id: 'coin', name: 'Moneda', icon: '🪙', dur: 0.6, build(ctx) {
    [[988, 0], [1319, 0.08]].forEach(([fr, t0]) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'square'; o.frequency.value = fr; g.gain.setValueAtTime(0.18, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45); o.connect(g).connect(ctx.destination); o.start(t0); o.stop(t0 + 0.5); });
  } },
];

const cache = new Map();
export async function renderSfx(id) {
  if (cache.has(id)) return cache.get(id);
  const s = SFX.find((x) => x.id === id);
  const ctx = new OfflineAudioContext(2, Math.ceil(s.dur * SR), SR);
  s.build(ctx);
  const buf = await ctx.startRendering();
  cache.set(id, buf);
  return buf;
}

function toWav(buf) {
  const ch = buf.numberOfChannels, len = buf.length, out = new DataView(new ArrayBuffer(44 + len * ch * 2));
  const w = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); out.setUint32(4, 36 + len * ch * 2, true); w(8, 'WAVEfmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true);
  out.setUint16(22, ch, true); out.setUint32(24, buf.sampleRate, true); out.setUint32(28, buf.sampleRate * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true);
  w(36, 'data'); out.setUint32(40, len * ch * 2, true);
  const data = [...Array(ch)].map((_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, data[c][i])); out.setInt16(o, v * 32767, true); o += 2; }
  return new Blob([out], { type: 'audio/wav' });
}

// Devuelve el medio del efecto (lo crea la primera vez y se guarda con el proyecto)
export async function sfxMedia(id, onUpdate) {
  const s = SFX.find((x) => x.id === id);
  const name = `SFX ${s.name}.wav`;
  for (const m of media.values()) if (m.name === name && !m.missing && !m.loading) return m;
  const buf = await renderSfx(id);
  return importFile(new File([toWav(buf)], name, { type: 'audio/wav' }), onUpdate);
}

let previewCtx = null;
export async function previewSfx(id) {
  const buf = await renderSfx(id);
  previewCtx = previewCtx || new AudioContext();
  await previewCtx.resume();
  const src = previewCtx.createBufferSource(); src.buffer = buf; src.connect(previewCtx.destination); src.start();
}
