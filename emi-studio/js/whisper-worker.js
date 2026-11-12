// Worker de transcripción: Whisper (Transformers.js) corriendo en tu equipo (WebGPU o WASM).
// El modelo se descarga una vez y queda en la caché del navegador.
// Se carga desde jsDelivr (versión fija). Los modelos y el motor quedan en la caché del navegador tras el primer uso.
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1/dist/transformers.min.js';

env.allowLocalModels = false;
const cache = new Map();

async function getPipe(model, device, onProgress) {
  const key = model + '|' + device;
  if (cache.has(key)) return cache.get(key);
  const dtype = device === 'webgpu' ? { encoder_model: 'fp32', decoder_model_merged: 'q4' } : 'q8';
  const p = await pipeline('automatic-speech-recognition', model, { device, dtype, progress_callback: onProgress });
  cache.set(key, p);
  return p;
}

self.onmessage = async (e) => {
  const { audio, model, language, wordLevel, forceCpu } = e.data;
  const post = (m) => self.postMessage(m);
  const onProgress = (x) => { if (x.status === 'progress') post({ type: 'progress', file: x.file, progress: x.progress, loaded: x.loaded, total: x.total }); };
  const devices = [];
  if (!forceCpu && self.navigator?.gpu) { try { if (await navigator.gpu.requestAdapter()) devices.push('webgpu'); } catch {} }
  devices.push('wasm');
  let lastErr = null;
  for (const device of devices) {
    for (const [m, words] of wordLevel ? [[model + '_timestamped', true], [model, false]] : [[model, false]]) {
      try {
        post({ type: 'status', text: `Cargando modelo (${device === 'webgpu' ? 'GPU' : 'CPU'})…` });
        const asr = await getPipe(m, device, onProgress);
        post({ type: 'status', text: 'Transcribiendo…' });
        const out = await asr(audio, {
          language: language || null, task: 'transcribe',
          return_timestamps: words ? 'word' : true,
          chunk_length_s: 30, stride_length_s: 5,
        });
        post({ type: 'done', words, chunks: out.chunks || [], text: out.text, device, model: m });
        return;
      } catch (err) { lastErr = err; console.warn('Whisper', device, m, err); }
    }
  }
  post({ type: 'error', message: String(lastErr?.message || lastErr) });
};
