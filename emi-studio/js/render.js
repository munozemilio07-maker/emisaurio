// Compositor: dibuja un fotograma del proyecto en un canvas 2D.
// Se usa igual para la vista previa y para la exportación, así lo que ves es lo que exportas.
import { clamp, clipEnd, clipsOnTrack } from './state.js';

const ease = {
  out: (x) => 1 - Math.pow(1 - x, 3),
  inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  back: (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  bounce: (x) => {
    const n1 = 7.5625, d1 = 2.75;
    if (x < 1 / d1) return n1 * x * x;
    if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
    if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
    return n1 * (x -= 2.625 / d1) * x + 0.984375;
  },
};

let grainCanvas = null;
function grain() {
  if (grainCanvas) return grainCanvas;
  grainCanvas = document.createElement('canvas');
  grainCanvas.width = grainCanvas.height = 256;
  const g = grainCanvas.getContext('2d');
  const img = g.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (Math.random() - 0.5) * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return grainCanvas;
}

export function colorFilter(c) {
  if (!c) return '';
  const f = [];
  if (c.exposure) f.push(`brightness(${(1 + c.exposure).toFixed(3)})`);
  const contrast = (c.contrast || 0) + (c.sharpen || 0) * 0.08;
  if (contrast) f.push(`contrast(${(1 + contrast).toFixed(3)})`);
  const sat = (c.saturation || 0) + (c.sharpen || 0) * 0.04;
  if (sat) f.push(`saturate(${Math.max(0, 1 + sat).toFixed(3)})`);
  if (c.sepia) f.push(`sepia(${c.sepia.toFixed(3)})`);
  if (c.hue) f.push(`hue-rotate(${c.hue}deg)`);
  if (c.blur) f.push(`blur(${c.blur}px)`);
  return f.join(' ');
}

const srcSize = (s) => [s.videoWidth || s.displayWidth || s.width || 1, s.videoHeight || s.displayHeight || s.height || 1];

export function sourceTime(c, t) { return c.in + (t - c.start) * c.speed; }

function motionFor(c, t, W, H) {
  const lt = t - c.start, lp = clamp(lt / Math.max(0.01, c.dur), 0, 1);
  let s = 1, dx = 0, dy = 0;
  switch (c.motion) {
    case 'zoom-in': s = 1 + 0.15 * lp; break;
    case 'zoom-out': s = 1.15 - 0.15 * lp; break;
    case 'pan-left': s = 1.15; dx = (0.5 - lp) * 0.12 * W; break;
    case 'pan-right': s = 1.15; dx = (lp - 0.5) * 0.12 * W; break;
    case 'punch': s = 1 + 0.18 * ease.out(clamp(lt / 0.18, 0, 1)); break;
    case 'shake': s = 1.06; dx = Math.sin(t * 47) * W * 0.008 + Math.sin(t * 13) * W * 0.004; dy = Math.cos(t * 39) * H * 0.006; break;
  }
  return { s, dx, dy };
}

// Dibuja un clip visual (vídeo, imagen, sólido o texto) con sus efectos y un modificador opcional (transiciones).
export function drawClip(ctx, P, c, t, prov, ex = {}) {
  const W = P.width, H = P.height;
  const alpha = (ex.alpha ?? 1) * (c.transform.opacity ?? 1);
  if (alpha <= 0.001) return;
  if (c.kind === 'text' || c.kind === 'caption') {
    ctx.save();
    ctx.globalAlpha = alpha;
    if (ex.filter) ctx.filter = ex.filter;
    ctx.translate(ex.dx || 0, ex.dy || 0);
    drawText(ctx, P, c, t);
    ctx.restore();
    return;
  }
  let src = null, sw = W, sh = H;
  if (c.kind !== 'solid') {
    src = prov.frame(c, ex.holdT ?? sourceTime(c, t));
    if (!src) return;
    [sw, sh] = srcSize(src);
  }
  const tr = c.transform, mo = motionFor(c, t, W, H);
  const fit = c.fit || 'cover';
  let base;
  if (fit === 'contain' || fit === 'blurfill') base = Math.min(W / sw, H / sh);
  else if (fit === 'stretch') base = 1;
  else base = Math.max(W / sw, H / sh);
  let dw = sw * base, dh = sh * base;
  if (fit === 'stretch') { dw = W; dh = H; }
  const scale = tr.scale * mo.s * (ex.scale ?? 1);
  const filt = [colorFilter(c.color), ex.filter || ''].join(' ').trim();

  ctx.save();
  if (ex.clip) ex.clip(ctx);
  ctx.globalAlpha = alpha;

  if (fit === 'blurfill' && src) {
    const cb = Math.max(W / sw, H / sh) * 1.08;
    ctx.save();
    ctx.filter = `blur(${Math.round(Math.min(W, H) * 0.035)}px) brightness(0.62) saturate(1.2) ${filt}`;
    ctx.translate(W / 2 + (ex.dx || 0), H / 2 + (ex.dy || 0));
    ctx.drawImage(src, -sw * cb / 2, -sh * cb / 2, sw * cb, sh * cb);
    ctx.restore();
  }

  ctx.translate(W / 2 + tr.x * W + mo.dx + (ex.dx || 0), H / 2 + tr.y * H + mo.dy + (ex.dy || 0));
  const rot = (tr.rot || 0) + (ex.rot || 0);
  if (rot) ctx.rotate((rot * Math.PI) / 180);
  ctx.scale(scale * (tr.flipX ? -1 : 1), scale);
  if (filt) ctx.filter = filt;

  if (c.kind === 'solid') {
    const g = ctx.createLinearGradient(-W / 2, -H / 2, W / 2, H / 2);
    g.addColorStop(0, c.fill[0]); g.addColorStop(1, c.fill[1]);
    ctx.fillStyle = g;
    ctx.fillRect(-W / 2, -H / 2, W, H);
  } else {
    ctx.drawImage(src, -dw / 2, -dh / 2, dw, dh);
  }
  ctx.filter = 'none';

  const col = c.color || {};
  // Temperatura y tinte: superposición suave sólo sobre el área del clip
  if (col.temp || col.tint) {
    ctx.globalCompositeOperation = 'soft-light';
    if (col.temp) {
      ctx.fillStyle = col.temp > 0 ? `rgba(255,150,40,${Math.abs(col.temp) * 0.8})` : `rgba(40,140,255,${Math.abs(col.temp) * 0.8})`;
      ctx.fillRect(-dw / 2, -dh / 2, dw, dh);
    }
    if (col.tint) {
      ctx.fillStyle = col.tint > 0 ? `rgba(255,40,200,${Math.abs(col.tint) * 0.7})` : `rgba(40,255,120,${Math.abs(col.tint) * 0.7})`;
      ctx.fillRect(-dw / 2, -dh / 2, dw, dh);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  if (col.grain) {
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = alpha * col.grain * 0.55;
    const pat = ctx.createPattern(grain(), 'repeat');
    const off = (Math.floor(t * 24) * 73) % 256;
    ctx.translate(off - 256, (off * 7) % 256 - 256);
    ctx.fillStyle = pat;
    ctx.fillRect(-dw / 2, -dh / 2, dw + 512, dh + 512);
    ctx.translate(-(off - 256), -((off * 7) % 256 - 256));
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = alpha;
  }
  if (col.vignette) {
    const r = Math.hypot(dw, dh) / 2;
    const g = ctx.createRadialGradient(0, 0, r * 0.35, 0, 0, r);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${col.vignette * 0.9})`);
    ctx.fillStyle = g;
    ctx.fillRect(-dw / 2, -dh / 2, dw, dh);
  }
  ctx.restore();
}

// ---------- Texto ----------
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

export function textFontPx(P, T) { return T.size * Math.sqrt(P.width * P.height) * 0.85; }

export function drawText(ctx, P, c, t) {
  const W = P.width, H = P.height, T = c.text;
  const fs = textFontPx(P, T);
  const lt = t - c.start, rem = clipEnd(c) - t;
  let words;
  if (c.words && c.words.length) words = c.words.map((w) => ({ w: T.upper ? w.w.toUpperCase() : w.w, s: w.s, e: w.e }));
  else {
    const txt = T.upper ? T.content.toUpperCase() : T.content;
    words = [];
    txt.split('\n').forEach((line, li) => {
      if (li > 0) words.push({ br: true });
      line.split(/\s+/).filter(Boolean).forEach((w) => words.push({ w }));
    });
  }
  const realWords = words.filter((w) => !w.br);
  if (!realWords.length) return;

  // Animaciones
  const inDur = T.animIn === 'typewriter' ? Math.min(c.dur * 0.7, realWords.length * 0.14) : 0.35;
  const ai = clamp(lt / inDur, 0, 1), ao = clamp(1 - rem / 0.3, 0, 1);
  let a = 1, s = 1, dx = 0, dy = 0, blur = 0, visible = realWords.length;
  switch (T.animIn) {
    case 'fade': a *= ease.out(ai); break;
    case 'pop': s *= 0.4 + 0.6 * ease.back(ai); a *= clamp(ai * 3, 0, 1); break;
    case 'slide-up': dy += (1 - ease.out(ai)) * fs * 1.2; a *= ai; break;
    case 'slide-right': dx -= (1 - ease.out(ai)) * W * 0.25; a *= ai; break;
    case 'bounce': dy -= (1 - ease.bounce(ai)) * fs * 2; a *= clamp(ai * 4, 0, 1); break;
    case 'zoom': s *= 2 - ease.out(ai); a *= ai; break;
    case 'blur': blur += (1 - ai) * fs * 0.3; a *= ai; break;
    case 'typewriter': visible = Math.ceil(ai * realWords.length); break;
  }
  if (rem < 0.3) switch (T.animOut) {
    case 'fade': a *= 1 - ao; break;
    case 'pop': s *= 1 - ease.inOut(ao) * 0.7; a *= 1 - ao; break;
    case 'slide-up': dy -= ease.inOut(ao) * fs; a *= 1 - ao; break;
    case 'blur': blur += ao * fs * 0.3; a *= 1 - ao; break;
  }
  if (a <= 0.001) return;

  ctx.save();
  ctx.globalAlpha *= a;
  if (blur > 0.3) ctx.filter = `blur(${blur.toFixed(1)}px)`;
  ctx.font = `${T.italic ? 'italic ' : ''}${T.weight} ${fs}px "${T.font}", Inter, system-ui, sans-serif`;
  ctx.textBaseline = 'middle';
  try { ctx.letterSpacing = `${(T.letter || 0) * fs}px`; } catch {}
  const space = ctx.measureText(' ').width;
  const maxW = (T.maxW || 0.86) * W / Math.max(0.2, c.transform.scale);

  // Distribución en líneas
  const lines = [[]];
  let lw = 0;
  for (const w of words) {
    if (w.br) { lines.push([]); lw = 0; continue; }
    const ww = ctx.measureText(w.w).width;
    const cur = lines[lines.length - 1];
    if (cur.length && lw + space + ww > maxW) { lines.push([]); lw = 0; }
    const line = lines[lines.length - 1];
    if (line.length) lw += space;
    line.push({ ...w, ww, x: lw });
    lw += ww;
  }
  const lh = fs * T.lineH;
  const totalH = lines.length * lh;
  ctx.translate(W / 2 + c.transform.x * W + dx, H / 2 + c.transform.y * H + dy);
  if (c.transform.rot) ctx.rotate((c.transform.rot * Math.PI) / 180);
  ctx.scale(c.transform.scale * s, c.transform.scale * s);

  let idx = 0;
  const padX = fs * 0.35, padY = fs * 0.12;
  const widths = lines.map((l) => (l.length ? l[l.length - 1].x + l[l.length - 1].ww : 0));
  const blockW = Math.max(...widths);

  if (T.bg === 'pill') {
    ctx.fillStyle = hexA(T.bgColor, T.bgAlpha);
    const bx = T.align === 'left' ? -blockW / 2 : -blockW / 2;
    rr(ctx, bx - padX * 1.4, -totalH / 2 - padY * 2, blockW + padX * 2.8, totalH + padY * 4, Math.min(fs, totalH) * 0.6);
    ctx.fill();
  }

  lines.forEach((line, li) => {
    const w = widths[li];
    const x0 = T.align === 'left' ? -blockW / 2 : T.align === 'right' ? blockW / 2 - w : -w / 2;
    const y = -totalH / 2 + lh * (li + 0.5);
    if (T.bg === 'box' && line.length) {
      ctx.save();
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = hexA(T.bgColor, T.bgAlpha);
      rr(ctx, x0 - padX, y - lh / 2 - padY * 0.2, w + padX * 2, lh + padY * 0.4, fs * 0.22);
      ctx.fill();
      ctx.restore();
    }
    for (const wd of line) {
      idx++;
      if (idx > visible) continue;
      const active = wd.s !== undefined && t >= wd.s && t < wd.e;
      const x = x0 + wd.x;
      if (active && T.hlBox) {
        ctx.save(); ctx.fillStyle = T.highlight;
        rr(ctx, x - fs * 0.12, y - lh * 0.48, wd.ww + fs * 0.24, lh * 0.96, fs * 0.18); ctx.fill(); ctx.restore();
      }
      ctx.save();
      if (active && !T.hlBox && c.kind === 'caption') {
        const k = 1.08; ctx.translate(x + wd.ww / 2, y); ctx.scale(k, k); ctx.translate(-(x + wd.ww / 2), -y);
      }
      if (T.shadow) {
        ctx.shadowColor = T.shadow > 1 ? T.color : 'rgba(0,0,0,0.7)';
        ctx.shadowBlur = fs * 0.22 * T.shadow;
        ctx.shadowOffsetY = T.shadow > 1 ? 0 : fs * 0.04;
      }
      if (T.strokeW) {
        ctx.lineJoin = 'round'; ctx.miterLimit = 2;
        ctx.lineWidth = T.strokeW * fs; ctx.strokeStyle = T.stroke;
        ctx.strokeText(wd.w, x, y);
        ctx.shadowColor = 'transparent';
      }
      ctx.fillStyle = active && !T.hlBox ? T.highlight : T.color;
      ctx.fillText(wd.w, x, y);
      ctx.restore();
    }
  });
  ctx.restore();
}

function hexA(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// ---------- Transiciones ----------
function transitionPair(type, p, W, H, seed) {
  const e = ease.inOut(p);
  const prev = {}, cur = {};
  switch (type) {
    case 'fade': cur.alpha = e; break;
    case 'dip-black': case 'dip-white': {
      const col = type === 'dip-black' ? 0 : 1;
      if (p < 0.5) { prev.filter = `brightness(${col ? 1 + p * 6 : 1 - p * 2})`; cur.alpha = 0; }
      else { prev.alpha = 0; cur.filter = `brightness(${col ? 1 + (1 - p) * 6 : (p - 0.5) * 2})`; }
      break;
    }
    case 'slide-left': cur.dx = (1 - e) * W; break;
    case 'slide-up': cur.dy = (1 - e) * H; break;
    case 'push': prev.dx = -e * W; cur.dx = (1 - e) * W; break;
    case 'zoom-in': prev.scale = 1 + e * 0.6; prev.alpha = 1 - e; cur.scale = 0.85 + 0.15 * e; cur.alpha = e; break;
    case 'zoom-out': prev.scale = 1 - e * 0.3; prev.alpha = 1 - e; cur.scale = 1.4 - 0.4 * e; cur.alpha = e; break;
    case 'wipe': cur.clip = (ctx) => { ctx.beginPath(); ctx.rect(0, 0, W * e, H); ctx.clip(); }; break;
    case 'circle': cur.clip = (ctx) => { ctx.beginPath(); ctx.arc(W / 2, H / 2, Math.hypot(W, H) / 2 * e, 0, Math.PI * 2); ctx.clip(); }; break;
    case 'blur': prev.filter = `blur(${(e * 40).toFixed(1)}px)`; prev.alpha = 1 - e; cur.filter = `blur(${((1 - e) * 40).toFixed(1)}px)`; cur.alpha = e; break;
    case 'whip': prev.dx = -e * W * 1.2; prev.filter = `blur(${(Math.sin(p * Math.PI) * 30).toFixed(1)}px)`; cur.dx = (1 - e) * W * 1.2; cur.filter = prev.filter; break;
    case 'spin': cur.rot = (1 - e) * -180; cur.scale = Math.max(0.01, e); prev.alpha = 1 - e * 0.5; break;
    case 'glitch': {
      const r = Math.sin(seed * 999 + Math.floor(p * 18) * 12.9898) * 43758.5453 % 1;
      const on = p > 0.45;
      cur.alpha = on ? 1 : 0;
      const j = (1 - Math.abs(p - 0.5) * 2) * W * 0.06;
      (on ? cur : prev).dx = r * j;
      (on ? cur : prev).filter = `hue-rotate(${Math.round(r * 180)}deg) saturate(2)`;
      break;
    }
    default: cur.alpha = 1;
  }
  return { prev, cur };
}

// Track visual de abajo hacia arriba (el último en la lista de tracks se dibuja primero)
export function visualTracks(P) {
  return P.tracks.filter((t) => t.type !== 'audio').slice().reverse();
}

export function activeVisuals(P, t) {
  // Devuelve [{clip, holdPrev?}] para saber qué fuentes necesitan cargarse
  const out = [];
  for (const tr of visualTracks(P)) {
    if (tr.hidden) continue;
    const list = clipsOnTrack(P, tr.id);
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (t >= c.start && t < clipEnd(c)) {
        out.push({ clip: c });
        const prev = list[i - 1];
        if (c.trans?.type !== 'none' && prev && Math.abs(clipEnd(prev) - c.start) < 0.05 && t < c.start + c.trans.dur) out.push({ clip: prev, hold: true });
      }
    }
  }
  return out;
}

export function renderFrame(ctx, P, t, prov, k = 1) {
  const W = P.width, H = P.height;
  ctx.save();
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.globalAlpha = 1; ctx.filter = 'none'; ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = P.bg || '#000';
  ctx.fillRect(0, 0, W, H);
  for (const tr of visualTracks(P)) {
    if (tr.hidden) continue;
    const list = clipsOnTrack(P, tr.id);
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (!(t >= c.start && t < clipEnd(c))) continue;
      const tt = c.trans;
      if (tt && tt.type !== 'none' && t < c.start + tt.dur) {
        const p = clamp((t - c.start) / tt.dur, 0, 1);
        const prev = list[i - 1];
        const hasPrev = prev && Math.abs(clipEnd(prev) - c.start) < 0.05;
        const { prev: pe, cur: ce } = transitionPair(tt.type, p, W, H, c.start);
        if (hasPrev) {
          const holdT = prev.in + (prev.dur - 1 / P.fps) * prev.speed;
          drawClip(ctx, P, prev, clipEnd(prev) - 0.001, prov, { ...pe, holdT });
        }
        drawClip(ctx, P, c, t, prov, ce);
      } else {
        drawClip(ctx, P, c, t, prov);
      }
    }
  }
  ctx.restore();
}
