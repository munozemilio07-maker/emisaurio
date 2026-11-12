// Visión local: detección de caras y recorte de personas (MediaPipe, incluido en vendor/) + croma en WebGL.
const BASE = new URL('../vendor/mediapipe/', import.meta.url).href;
const loaded = new Map();
function loadScript(src) {
  if (loaded.has(src)) return loaded.get(src);
  const p = new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('No se pudo cargar ' + src)); document.head.appendChild(s); });
  loaded.set(src, p);
  return p;
}

// ---------- Caras ----------
let face = null, faceRes = null;
async function getFace() {
  if (face) return face;
  face = (async () => {
    await loadScript(BASE + 'face/face_detection.js');
    const fd = new window.FaceDetection({ locateFile: (f) => BASE + 'face/' + f });
    fd.setOptions({ model: 'full', minDetectionConfidence: 0.45 });
    fd.onResults((r) => (faceRes = r));
    await fd.initialize();
    return fd;
  })();
  return face;
}

// Devuelve caras normalizadas [{x, y, w, h, score}] (x/y = centro, 0..1)
export async function detectFaces(image) {
  const fd = await getFace();
  faceRes = null;
  await fd.send({ image });
  return (faceRes?.detections || []).map((d) => ({ x: d.boundingBox.xCenter, y: d.boundingBox.yCenter, w: d.boundingBox.width, h: d.boundingBox.height, score: d.V?.[0]?.ga ?? 1 }));
}

// ---------- Personas ----------
let seg = null, segOut = null, segOk = false, segQueue = Promise.resolve();
async function getSeg() {
  if (seg) return seg;
  seg = (async () => {
    await loadScript(BASE + 'selfie/selfie_segmentation.js');
    const s = new window.SelfieSegmentation({ locateFile: (f) => BASE + 'selfie/' + f });
    s.setOptions({ modelSelection: 0, selfieMode: false });
    // La máscara sólo es válida dentro de este aviso: se copia aquí mismo
    s.onResults((r) => {
      const m = r.segmentationMask;
      if (!m || !segOut) return;
      if (segOut.width !== m.width || segOut.height !== m.height) { segOut.width = m.width; segOut.height = m.height; }
      const g = segOut.getContext('2d');
      g.clearRect(0, 0, segOut.width, segOut.height);
      g.drawImage(m, 0, 0);
      segOk = true;
    });
    await s.initialize();
    return s;
  })();
  return seg;
}

// Máscara de la persona en un canvas propio (alfa = persona). Las llamadas se encolan.
export function segmentPerson(image, out) {
  const job = segQueue.then(async () => {
    const s = await getSeg();
    segOut = out || document.createElement('canvas');
    segOk = false;
    await s.send({ image });
    const res = segOk ? segOut : null;
    segOut = null;
    return res;
  });
  segQueue = job.catch(() => {});
  return job;
}

export function visionReady() { return { face: !!face, seg: !!seg }; }

// ---------- Croma y máscara en GPU ----------
let gl = null, glc = null, prog = null, texImg = null, texMask = null, U = {};
const VS = `attribute vec2 p; varying vec2 uv; void main(){ uv = vec2((p.x+1.)/2., 1.-(p.y+1.)/2.); gl_Position = vec4(p,0.,1.); }`;
const FS = `precision mediump float; varying vec2 uv;
uniform sampler2D img; uniform sampler2D msk; uniform int useMask; uniform int useKey; uniform int maskMode;
uniform vec3 key; uniform float sim; uniform float smooth; uniform float spill; uniform float feather;
vec2 cbcr(vec3 c){ return vec2(-0.1687*c.r-0.3313*c.g+0.5*c.b, 0.5*c.r-0.4187*c.g-0.0813*c.b); }
void main(){
  vec4 c = texture2D(img, uv); float a = 1.0;
  if (useKey == 1) {
    float d = distance(cbcr(c.rgb), cbcr(key));
    a = smoothstep(sim, sim + smooth, d);
    // quitar el reflejo verde/azul en los bordes
    float s = pow(1.0 - a, 1.5) * spill + (1.0 - smoothstep(sim, sim + smooth * 4.0, d)) * spill * 0.6;
    float m = max(key.r, max(key.g, key.b));
    if (key.g >= m) c.g = mix(c.g, min(c.g, max(c.r, c.b)), clamp(s * 2.0, 0.0, 1.0));
    else if (key.b >= m) c.b = mix(c.b, min(c.b, max(c.r, c.g)), clamp(s * 2.0, 0.0, 1.0));
  }
  if (useMask == 1) {
    vec4 mv = texture2D(msk, uv);
    float m = maskMode == 0 ? mv.a : mv.r;
    a *= smoothstep(0.5 - feather, 0.5 + feather, m);
  }
  gl_FragColor = vec4(c.rgb * a, a);
}`;

function initGL() {
  glc = document.createElement('canvas');
  gl = glc.getContext('webgl', { premultipliedAlpha: true, preserveDrawingBuffer: true, alpha: true });
  if (!gl) throw new Error('WebGL no disponible');
  const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog); gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const mk = () => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); for (const [k, v] of [[gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE], [gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR]]) gl.texParameteri(gl.TEXTURE_2D, k, v); return t; };
  texImg = mk(); texMask = mk();
  for (const n of ['img', 'msk', 'useMask', 'useKey', 'maskMode', 'key', 'sim', 'smooth', 'spill', 'feather']) U[n] = gl.getUniformLocation(prog, n);
  gl.uniform1i(U.img, 0); gl.uniform1i(U.msk, 1);
}

const hex = (h) => { const n = parseInt(h.replace('#', ''), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };

// Aplica croma y/o máscara. Devuelve un canvas con alfa (reutilizado: dibújalo enseguida).
export function keyFrame(src, k, mask, maxSide = 1920) {
  if (!gl) initGL();
  const sw = src.videoWidth || src.width, sh = src.videoHeight || src.height;
  const s = Math.min(1, maxSide / Math.max(sw, sh));
  const w = Math.max(2, Math.round(sw * s)), h = Math.max(2, Math.round(sh * s));
  if (glc.width !== w || glc.height !== h) { glc.width = w; glc.height = h; }
  gl.viewport(0, 0, w, h);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texImg);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  const useKey = k.type === 'chroma';
  gl.uniform1i(U.useKey, useKey ? 1 : 0);
  gl.uniform1i(U.useMask, mask ? 1 : 0);
  gl.uniform1i(U.maskMode, k.maskMode || 0);
  if (useKey) { gl.uniform3fv(U.key, hex(k.color || '#00ff00')); gl.uniform1f(U.sim, k.sim ?? 0.12); gl.uniform1f(U.smooth, k.smooth ?? 0.08); gl.uniform1f(U.spill, k.spill ?? 0.5); }
  if (mask) { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texMask); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mask); gl.uniform1f(U.feather, k.feather ?? 0.18); }
  gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  return glc;
}
