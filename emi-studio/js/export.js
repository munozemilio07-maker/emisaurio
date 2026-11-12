// Exportación fotograma a fotograma con WebCodecs (Mediabunny). Sin marca de agua, sin créditos, todo local.
import * as MB from 'mediabunny';
import { GIFEncoder, quantize, applyPalette } from '../vendor/gifenc.esm.js';
import { projectDuration, clipEnd } from './state.js';
import { renderFrame, activeVisuals, sourceTime, ensureFonts } from './render.js';
import { mixOffline } from './audio.js';
import { segmentPerson } from './vision.js';
import { media } from './media.js';

let encodersReady = null;
async function ensureEncoders() {
  if (encodersReady) return encodersReady;
  encodersReady = (async () => {
    if (!(await MB.canEncodeAudio('aac'))) {
      try { const m = await import('../vendor/mediabunny-aac-encoder.min.mjs'); m.registerAacEncoder(); } catch (e) { console.warn('AAC', e); }
    }
    if (!(await MB.canEncodeAudio('flac'))) {
      try { const m = await import('../vendor/mediabunny-flac-encoder.min.mjs'); m.registerFlacEncoder(); } catch (e) { console.warn('FLAC', e); }
    }
    if (!(await MB.canEncodeAudio('mp3'))) {
      try { const m = await import('../vendor/mediabunny-mp3-encoder.min.mjs'); m.registerMp3Encoder(); } catch (e) { console.warn('MP3', e); }
    }
  })();
  return encodersReady;
}

export async function supportMatrix(w = 1920, h = 1080) {
  await ensureEncoders();
  const res = {};
  for (const v of ['avc', 'hevc', 'vp9', 'av1', 'vp8']) res[v] = await MB.canEncodeVideo(v, { width: w, height: h }).catch(() => false);
  for (const a of ['aac', 'opus', 'mp3', 'flac', 'pcm-s16']) res[a] = await MB.canEncodeAudio(a).catch(() => false);
  return res;
}

function outFormat(container, streaming = false) {
  switch (container) {
    case 'mp4': return new MB.Mp4OutputFormat({ fastStart: streaming ? false : 'in-memory' });
    case 'mov': return new MB.MovOutputFormat({ fastStart: streaming ? false : 'in-memory' });
    case 'webm': return new MB.WebMOutputFormat();
    case 'mkv': return new MB.MkvOutputFormat();
    case 'ts': return new MB.MpegTsOutputFormat();
    case 'mp3': return new MB.Mp3OutputFormat();
    case 'wav': return new MB.WavOutputFormat();
    case 'flac': return new MB.FlacOutputFormat();
    case 'ogg': return new MB.OggOutputFormat();
    case 'adts': return new MB.AdtsOutputFormat();
  }
  throw new Error('Contenedor desconocido ' + container);
}

const MIME = { mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska', ts: 'video/mp2t', mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac', ogg: 'audio/ogg', adts: 'audio/aac', m4a: 'audio/mp4' };

// ---------- Fuente de fotogramas para exportar ----------
class ExportFrames {
  constructor(P, fps, a, b) { this.P = P; this.fps = fps; this.a = a; this.b = b; this.cur = new Map(); this.iters = new Map(); this.inputs = new Map(); this.fallback = new Map(); this.masks = new Map(); }

  async prepare() {
    const P = this.P, N = Math.ceil((this.b - this.a) * this.fps);
    this.N = N;
    const plan = new Map(); // clipId -> [{i, st}]
    for (let i = 0; i < N; i++) {
      const t = this.a + i / this.fps;
      for (const v of activeVisuals(P, t)) {
        const c = v.clip;
        if (c.kind !== 'video') continue;
        const st = v.hold ? c.in + (c.dur - 1 / P.fps) * c.speed : sourceTime(c, t);
        if (!plan.has(c.id)) plan.set(c.id, { clip: c, list: [] });
        plan.get(c.id).list.push({ i, st });
      }
    }
    this.plan = plan;
    // fotos con fondo quitado: la máscara se calcula una vez
    for (const c of P.clips) {
      const m = media.get(c.mediaId);
      if (c.kind === 'image' && m?.bitmap && c.key?.on && c.key.type === 'person') this.masks.set(c.id, await segmentPerson(m.bitmap, document.createElement('canvas')));
    }
    this.need = new Map(); // i -> [clipId]
    for (const [id, p] of plan) for (const x of p.list) { if (!this.need.has(x.i)) this.need.set(x.i, []); this.need.get(x.i).push(id); }
    for (const [id, p] of plan) {
      const m = media.get(p.clip.mediaId);
      if (!m || m.missing) continue;
      try {
        let inp = this.inputs.get(m.id);
        if (!inp) {
          const input = new MB.Input({ source: new MB.BlobSource(m.file), formats: MB.ALL_FORMATS });
          const track = await input.getPrimaryVideoTrack();
          if (!track || !(await track.canDecode())) throw new Error('no decodificable');
          const first = await track.getFirstTimestamp().catch(() => 0);
          inp = { input, track, first: Math.max(0, first) };
          this.inputs.set(m.id, inp);
        }
        const sink = new MB.CanvasSink(inp.track, { poolSize: 3 });
        const ts = p.list.map((x) => x.st + inp.first);
        this.iters.set(id, sink.canvasesAtTimestamps(ts));
      } catch (e) {
        console.warn('Usando decodificación de respaldo para', m.name, e);
        const v = document.createElement('video');
        v.src = m.url; v.muted = true; v.preload = 'auto';
        await new Promise((r) => { v.onloadeddata = r; v.onerror = r; });
        this.fallback.set(id, v);
      }
    }
  }

  async load(i) {
    this.cur.clear();
    const ids = this.need.get(i) || [];
    for (const id of ids) {
      const it = this.iters.get(id);
      if (it) {
        const r = await it.next();
        this.cur.set(id, r.value ? r.value.canvas : null);
        const clip = this.plan.get(id).clip;
        if (r.value && clip.key?.on && clip.key.type === 'person') {
          const mc = this.masks.get(id) || document.createElement('canvas');
          this.masks.set(id, await segmentPerson(r.value.canvas, mc));
        }
      } else {
        const v = this.fallback.get(id);
        const x = this.plan.get(id).list.find((y) => y.i === i);
        if (v && x) {
          if (Math.abs(v.currentTime - x.st) > 0.001) {
            await new Promise((r) => { const done = () => { v.removeEventListener('seeked', done); r(); }; v.addEventListener('seeked', done); v.currentTime = x.st; setTimeout(done, 3000); });
          }
          this.cur.set(id, v);
          const clip = this.plan.get(id).clip;
          if (clip.key?.on && clip.key.type === 'person') this.masks.set(id, await segmentPerson(v, this.masks.get(id) || document.createElement('canvas')));
        }
      }
    }
  }

  provider() {
    return {
      frame: (c) => {
        const m = media.get(c.mediaId);
        if (!m || m.missing) return null;
        if (m.type === 'image') return m.bitmap;
        return this.cur.get(c.id) || null;
      },
      mask: (c) => this.masks.get(c.id) || null,
    };
  }

  dispose() {
    for (const it of this.iters.values()) it.return?.();
    for (const v of this.fallback.values()) { v.removeAttribute('src'); v.load(); }
    for (const x of this.inputs.values()) try { x.input.dispose?.(); } catch {}
  }
}

function sliceBuffer(buf, from, to) {
  const len = Math.max(1, to - from);
  const out = new AudioBuffer({ length: len, sampleRate: buf.sampleRate, numberOfChannels: buf.numberOfChannels });
  for (let ch = 0; ch < buf.numberOfChannels; ch++) out.copyToChannel(buf.getChannelData(ch).subarray(from, to), ch);
  return out;
}

export function evenDims(P, targetW, targetH) {
  // Ajusta a la relación de aspecto del proyecto, dimensiones pares
  const k = Math.min(targetW / P.width, targetH / P.height);
  const w = Math.max(2, Math.round((P.width * k) / 2) * 2), h = Math.max(2, Math.round((P.height * k) / 2) * 2);
  return { w, h, k: w / P.width };
}

// opts: { fmt, w, h, fps, mbps, range:[a,b], audioKbps }
export async function exportProject(P, opts, onProgress, signal) {
  await ensureFonts(P);
  await ensureEncoders();
  const fmt = opts.fmt;
  const a = opts.range?.[0] ?? 0, b = opts.range?.[1] ?? projectDuration(P);
  if (b - a <= 0) throw new Error('El proyecto está vacío.');
  const t0 = performance.now();
  const prog = (p, label) => {
    const el = (performance.now() - t0) / 1000;
    onProgress?.({ p, label, eta: p > 0.02 ? el / p - el : null });
  };

  if (fmt.kind === 'image') {
    const { w, h, k } = evenDims(P, opts.w, opts.h);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const fr = new ExportFrames(P, P.fps, opts.at, opts.at + 1 / P.fps);
    await fr.prepare(); await fr.load(0);
    renderFrame(cv.getContext('2d'), P, opts.at, fr.provider(), k);
    fr.dispose();
    const blob = await new Promise((r) => cv.toBlob(r, fmt.mime, 0.93));
    return { blob, name: `${P.name}.${fmt.ext}` };
  }

  if (fmt.kind === 'text') return { blob: new Blob([fmt.ext === 'vtt' ? toVTT(P) : toSRT(P)], { type: 'text/plain' }), name: `${P.name}.${fmt.ext}` };

  if (fmt.kind === 'gif') {
    const fps = opts.fps || 15;
    const { w, h, k } = evenDims(P, opts.w, opts.h);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    const fr = new ExportFrames(P, fps, a, b);
    await fr.prepare();
    const gif = GIFEncoder();
    for (let i = 0; i < fr.N; i++) {
      if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError');
      await fr.load(i);
      renderFrame(ctx, P, a + i / fps, fr.provider(), k);
      const data = ctx.getImageData(0, 0, w, h).data;
      const pal = quantize(data, 256);
      gif.writeFrame(applyPalette(data, pal), w, h, { palette: pal, delay: Math.round(1000 / fps) });
      if (i % 3 === 0) { prog(i / fr.N, `GIF ${i}/${fr.N}`); await new Promise((r) => setTimeout(r)); }
    }
    fr.dispose();
    gif.finish();
    return { blob: new Blob([gif.bytes()], { type: 'image/gif' }), name: `${P.name}.gif` };
  }

  // Audio
  // Audio mezclado por tramos de 10 s: la memoria no crece con la duración del video
  const CH = 10;
  let chunkK = 0;
  const nextChunk = async () => {
    const s0 = a + chunkK * CH;
    if (s0 >= b - 1e-6) return null;
    chunkK++;
    // 0.5 s de precalentamiento: filtros y compresor llegan estables a la unión y no hay clics entre tramos
    const PRE = 0.5;
    const buf = await mixOffline(P, media, 48000, s0 - PRE, Math.min(b, s0 + CH), { includeGuide: !!opts.includeGuide });
    return sliceBuffer(buf, Math.round(PRE * 48000), buf.length);
  };
  const pickAudio = async () => {
    for (const c of fmt.a || []) if (await MB.canEncodeAudio(c, { numberOfChannels: 2, sampleRate: 48000 }).catch(() => false)) return c;
    return null;
  };
  const aCodec = await pickAudio();
  if (fmt.kind === 'audio' && !aCodec) throw new Error('Este navegador no puede codificar ' + fmt.label);

  // Archivos grandes: se escriben directo al disco (sin acumular GB en memoria)
  const target = opts.writable ? new MB.StreamTarget(opts.writable, { chunked: true }) : new MB.BufferTarget();
  const output = new MB.Output({ format: outFormat(fmt.container, !!opts.writable), target });
  let vSrc = null, cv = null, ctx = null, k = 1, fr = null, fps = opts.fps || P.fps;
  if (fmt.kind === 'video') {
    const d = evenDims(P, opts.w, opts.h);
    k = d.k;
    if (!(await MB.canEncodeVideo(fmt.v, { width: d.w, height: d.h }).catch(() => false)))
      throw new Error(`Tu navegador no puede codificar ${fmt.label} a ${d.w}×${d.h}. Prueba MP4 · H.264 o WebM · VP9.`);
    cv = document.createElement('canvas'); cv.width = d.w; cv.height = d.h;
    ctx = cv.getContext('2d', { alpha: false });
    const bitrate = Math.round((opts.mbps || 10) * 1e6);
    vSrc = new MB.CanvasSource(cv, { codec: fmt.v, bitrate, keyFrameInterval: 2, latencyMode: 'quality' });
    output.addVideoTrack(vSrc, { frameRate: fps });
  }
  let aSrc = null;
  if (aCodec) {
    aSrc = new MB.AudioBufferSource({ codec: aCodec, bitrate: aCodec.startsWith('pcm') || aCodec === 'flac' ? undefined : (opts.audioKbps || 192) * 1000 });
    output.addAudioTrack(aSrc);
  }
  await output.start();
  const onAbort = () => output.cancel();
  signal?.addEventListener('abort', onAbort);
  try {
    if (fmt.kind === 'video') {
      fr = new ExportFrames(P, fps, a, b);
      prog(0, 'Preparando decodificadores…');
      await fr.prepare();
      let aTime = 0;
      for (let i = 0; i < fr.N; i++) {
        if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError');
        await fr.load(i);
        renderFrame(ctx, P, a + i / fps, fr.provider(), k);
        await vSrc.add(i / fps, 1 / fps);
        // audio intercalado: un tramo de 10 s cada vez que el video lo alcanza
        while (aSrc && aTime < (i + 1) / fps) {
          const ch = await nextChunk();
          if (!ch) break;
          await aSrc.add(ch); aTime += ch.duration;
        }
        if (i % 5 === 0) prog(i / fr.N, `Fotograma ${i} de ${fr.N}`);
      }
      if (aSrc) for (let ch; (ch = await nextChunk());) await aSrc.add(ch);
    } else {
      for (let ch, done = 0; (ch = await nextChunk());) {
        if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError');
        await aSrc.add(ch); done += ch.duration;
        prog(done / (b - a), 'Mezclando y codificando audio…');
      }
    }
    prog(0.99, 'Finalizando archivo…');
    await output.finalize();
  } finally {
    signal?.removeEventListener('abort', onAbort);
    fr?.dispose();
  }
  const ext = fmt.ext;
  const mime = fmt.id === 'm4a' ? MIME.m4a : MIME[fmt.container] || 'application/octet-stream';
  if (opts.writable) { try { await opts.writable.close(); } catch {} return { streamed: true, name: `${P.name}.${ext}`, aCodec }; }
  return { blob: new Blob([output.target.buffer], { type: mime }), name: `${P.name}.${ext}`, aCodec };
}

// ---------- Subtítulos ----------
function stamp(s, sep) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = Math.floor(s % 60), ms = Math.round((s % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}${sep}${String(ms).padStart(3, '0')}`;
}
function captionList(P) {
  return P.clips.filter((c) => c.kind === 'caption').sort((x, y) => x.start - y.start)
    .map((c) => ({ a: c.start, b: clipEnd(c), text: c.words?.length ? c.words.map((w) => w.w).join(' ') : c.text.content }));
}
export function toSRT(P) { return captionList(P).map((c, i) => `${i + 1}\n${stamp(c.a, ',')} --> ${stamp(c.b, ',')}\n${c.text}\n`).join('\n'); }
export function toVTT(P) { return 'WEBVTT\n\n' + captionList(P).map((c) => `${stamp(c.a, '.')} --> ${stamp(c.b, '.')}\n${c.text}\n`).join('\n'); }

export function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name.replace(/[\\/:*?"<>|]+/g, '_');
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return url;
}
