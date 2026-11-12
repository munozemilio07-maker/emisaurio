// Audio de archivos grandes sin cargarlo entero en memoria.
// Al importar: una sola pasada en streaming que guarda picos (50/s) y una copia ligera a 16 kHz mono
// para analizar (silencios, beats, Whisper). Para exportar se decodifica por tramos.
import * as MB from 'mediabunny';

// Lee el audio en streaming. Devuelve { a16, peaks, duration, sampleRate, channels } o null si no hay audio.
export async function analyzeAudio(file, onProgress) {
  const input = new MB.Input({ source: new MB.BlobSource(file), formats: MB.ALL_FORMATS });
  const at = await input.getPrimaryAudioTrack();
  if (!at) return null;
  if (!(await at.canDecode())) throw new Error('códec de audio no soportado por el navegador');
  const duration = await input.computeDuration();
  const n16 = Math.ceil(duration * 16000) + 16000, nPk = Math.ceil(duration * 50) + 50;
  const a16 = new Float32Array(n16), peaks = new Float32Array(nPk);
  const sink = new MB.AudioBufferSink(at);
  let sr = 0, chs = 0, k16 = -1, acc = 0, cnt = 0, last = 0;
  for await (const { buffer, timestamp } of sink.buffers()) {
    sr = buffer.sampleRate; chs = buffer.numberOfChannels;
    const c0 = buffer.getChannelData(0), c1 = chs > 1 ? buffer.getChannelData(1) : null;
    const t0 = Math.max(0, timestamp);
    for (let j = 0; j < c0.length; j++) {
      const t = t0 + j / sr;
      const v = c1 ? (c0[j] + c1[j]) * 0.5 : c0[j];
      const p = Math.floor(t * 50);
      if (p < nPk) { const av = c1 ? (Math.abs(c0[j]) + Math.abs(c1[j])) * 0.5 : Math.abs(v); if (av > peaks[p]) peaks[p] = av; }
      // 16 kHz: promedio de las muestras que caen en cada hueco (filtro de caja, suficiente para analizar)
      const k = Math.floor(t * 16000);
      if (k !== k16) { if (k16 >= 0 && k16 < n16 && cnt) a16[k16] = acc / cnt; k16 = k; acc = 0; cnt = 0; }
      acc += v; cnt++;
    }
    if (onProgress && timestamp - last > 5) { last = timestamp; onProgress(Math.min(1, timestamp / duration)); }
  }
  if (k16 >= 0 && k16 < n16 && cnt) a16[k16] = acc / cnt;
  input.dispose?.();
  return { a16: a16.subarray(0, Math.ceil(duration * 16000)), peaks: peaks.subarray(0, Math.ceil(duration * 50)), duration, sampleRate: sr, channels: chs };
}

// Objeto con la forma mínima de un AudioBuffer (para el análisis) sobre la copia a 16 kHz
export function analysisBuffer(a16, duration) {
  return { sampleRate: 16000, duration, length: a16.length, numberOfChannels: 1, getChannelData: () => a16, analysis: true };
}

// Tramo [s0, s1) del audio original a su resolución completa, como AudioBuffer
const sinks = new WeakMap();
export async function decodeRange(m, s0, s1) {
  if (m.fullAudio) {
    // archivos pequeños decodificados de una vez
    const b = m.fullAudio, sr = b.sampleRate;
    const a = Math.max(0, Math.floor(s0 * sr)), z = Math.min(b.length, Math.ceil(s1 * sr));
    const out = new AudioBuffer({ length: Math.max(1, z - a), sampleRate: sr, numberOfChannels: b.numberOfChannels });
    for (let c = 0; c < b.numberOfChannels; c++) out.copyToChannel(b.getChannelData(c).subarray(a, z), c);
    return out;
  }
  let s = sinks.get(m);
  if (!s) {
    const input = new MB.Input({ source: new MB.BlobSource(m.file), formats: MB.ALL_FORMATS });
    const at = await input.getPrimaryAudioTrack();
    s = { input, sink: new MB.AudioBufferSink(at) };
    sinks.set(m, s);
  }
  const sr = m.sampleRate || 48000, chs = Math.max(1, Math.min(2, m.channels || 2));
  const len = Math.max(1, Math.ceil((s1 - s0) * sr));
  const out = new AudioBuffer({ length: len, sampleRate: sr, numberOfChannels: chs });
  for await (const { buffer, timestamp } of s.sink.buffers(Math.max(0, s0 - 0.05), s1)) {
    const off = Math.round((timestamp - s0) * sr);
    for (let c = 0; c < chs; c++) {
      const src = buffer.getChannelData(Math.min(c, buffer.numberOfChannels - 1));
      const from = Math.max(0, -off), to = Math.min(src.length, len - off);
      if (to > from) out.copyToChannel(src.subarray(from, to), c, off + from);
    }
  }
  return out;
}
