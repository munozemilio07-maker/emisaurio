// Inspector (panel derecho): propiedades del clip seleccionado o del proyecto.
import { FONTS, LOOKS, MOTIONS, TRANSITIONS, ANIMS_IN, ANIMS_OUT, CAPTION_STYLES, DEFAULT_COLOR } from './presets.js';
import { clipEnd, fmtTime } from './state.js';
import { media } from './media.js';
import { autoColor, applyLook } from './viral.js';
import { retimeCaption } from './captions.js';
import { pct, sec, signed, esc } from './ui.js';

export function renderInspector(app, ui) {
  const { field, section, button } = ui;
  const root = document.getElementById('inspector');
  const scroll = root.scrollTop;
  root.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'insp';
  root.appendChild(wrap);
  const sel = app.selected();
  const P = app.P;
  const rerender = () => renderInspector(app, ui);

  if (!sel.length) {
    const s = section(wrap, 'Proyecto');
    field(s, { label: 'FPS', type: 'select', options: [[24, '24 (cine)'], [25, '25 (PAL)'], [30, '30 (redes)'], [50, '50'], [60, '60 (fluido)']], get: () => P.fps, set: (v) => (P.fps = +v) });
    field(s, { label: 'Fondo', type: 'color', get: () => P.bg, set: (v) => (P.bg = v) });
    field(s, { label: 'Volumen', min: 0, max: 3, step: 0.01, def: 1, get: () => P.masterGain, set: (v) => (P.masterGain = v), fmt: pct });
    const tip = document.createElement('div');
    tip.className = 'empty';
    tip.innerHTML = `<div class="big">◇</div><p>Selecciona un clip para editarlo.</p>
      <div class="kbd">
        <kbd>Espacio</kbd><span>Reproducir / pausar</span>
        <kbd>S</kbd><span>Dividir en el cabezal</span>
        <kbd>Supr</kbd><span>Eliminar</span>
        <kbd>Shift+Supr</kbd><span>Eliminar y cerrar hueco</span>
        <kbd>Ctrl+D</kbd><span>Duplicar</span>
        <kbd>Ctrl+Z</kbd><span>Deshacer</span>
        <kbd>T</kbd><span>Texto en el cabezal</span>
        <kbd>← →</kbd><span>Fotograma a fotograma</span>
        <kbd>Shift+← →</kbd><span>Saltar 1 segundo</span>
        <kbd>I / O</kbd><span>Entrada / salida del bucle</span>
        <kbd>Ctrl+rueda</kbd><span>Zoom en la línea de tiempo</span>
      </div>`;
    wrap.appendChild(tip);
    root.scrollTop = scroll;
    return;
  }

  const c = sel[0];
  const m = media.get(c.mediaId);
  const isText = c.kind === 'text' || c.kind === 'caption';
  const isVisual = c.kind === 'video' || c.kind === 'image' || c.kind === 'solid';
  const head = document.createElement('div');
  head.className = 'clip-title';
  const title = m ? m.name : { solid: 'Fondo de color', text: 'Texto', caption: 'Subtítulo' }[c.kind] || c.kind;
  head.innerHTML = `${m?.thumb ? `<img src="${m.thumb}" alt="">` : `<span class="ct-ico">${isText ? 'T' : '■'}</span>`}<div><b>${esc(title)}</b><small>${sel.length > 1 ? `${sel.length} clips seleccionados` : `${fmtTime(c.start)} → ${fmtTime(clipEnd(c))}`}</small></div>`;
  wrap.appendChild(head);

  // ---- Texto ----
  if (isText) {
    const T = c.text;
    const s = section(wrap, c.kind === 'caption' ? 'Subtítulo' : 'Texto');
    field(s, { label: 'Texto', type: 'textarea', get: () => (c.words?.length ? c.words.map((w) => w.w).join(' ') : T.content), set: (v) => {
      if (c.kind === 'caption') {
        const ws = v.trim().split(/\s+/);
        if (c.words?.length === ws.length) c.words.forEach((w, i) => (w.w = ws[i])); else retimeCaption(c, v);
      }
      T.content = v;
    } });
    field(s, { label: 'Fuente', type: 'select', options: FONTS.map((f) => [f, f]), get: () => T.font, set: (v) => sel.forEach((x) => x.text && (x.text.font = v)) });
    field(s, { label: 'Tamaño', min: 0.02, max: 0.2, step: 0.002, def: 0.065, get: () => T.size, set: (v) => sel.forEach((x) => x.text && (x.text.size = v)), fmt: (v) => Math.round(v * 1000) });
    field(s, { label: 'Color', type: 'color', get: () => T.color, set: (v) => sel.forEach((x) => x.text && (x.text.color = v)) });
    if (c.kind === 'caption') field(s, { label: 'Resaltado', type: 'color', get: () => T.highlight, set: (v) => sel.forEach((x) => x.text && (x.text.highlight = v)) });
    field(s, { label: 'MAYÚSCULAS', type: 'checkbox', get: () => T.upper, set: (v) => sel.forEach((x) => x.text && (x.text.upper = v)) });
    field(s, { label: 'Contorno', min: 0, max: 0.3, step: 0.005, def: 0, get: () => T.strokeW, set: (v) => sel.forEach((x) => x.text && (x.text.strokeW = v)), fmt: (v) => Math.round(v * 100) });
    field(s, { label: 'Color contorno', type: 'color', get: () => T.stroke, set: (v) => sel.forEach((x) => x.text && (x.text.stroke = v)), pro: true });
    field(s, { label: 'Fondo', type: 'chips', options: [['none', 'Ninguno'], ['box', 'Caja'], ['pill', 'Píldora']], get: () => T.bg, set: (v) => sel.forEach((x) => x.text && (x.text.bg = v)), after: rerender });
    if (T.bg !== 'none') {
      field(s, { label: 'Color fondo', type: 'color', get: () => T.bgColor, set: (v) => sel.forEach((x) => x.text && (x.text.bgColor = v)) });
      field(s, { label: 'Opacidad fondo', min: 0, max: 1, step: 0.01, def: 0.6, get: () => T.bgAlpha, set: (v) => sel.forEach((x) => x.text && (x.text.bgAlpha = v)), fmt: pct });
    }
    field(s, { label: 'Sombra / brillo', min: 0, max: 2, step: 0.05, def: 0.5, get: () => T.shadow, set: (v) => sel.forEach((x) => x.text && (x.text.shadow = v)), fmt: (v) => v.toFixed(1), pro: true });
    field(s, { label: 'Alineación', type: 'chips', options: [['left', 'Izq.'], ['center', 'Centro'], ['right', 'Der.']], get: () => T.align, set: (v) => sel.forEach((x) => x.text && (x.text.align = v)), pro: true });
    field(s, { label: 'Espaciado', min: -0.05, max: 0.3, step: 0.005, def: 0, get: () => T.letter, set: (v) => sel.forEach((x) => x.text && (x.text.letter = v)), fmt: (v) => Math.round(v * 100), pro: true });
    field(s, { label: 'Interlineado', min: 0.8, max: 2, step: 0.02, def: 1.15, get: () => T.lineH, set: (v) => sel.forEach((x) => x.text && (x.text.lineH = v)), fmt: (v) => v.toFixed(2), pro: true });
    field(s, { label: 'Ancho máx.', min: 0.3, max: 1, step: 0.01, def: 0.86, get: () => T.maxW, set: (v) => sel.forEach((x) => x.text && (x.text.maxW = v)), fmt: pct, pro: true });
    const a = section(wrap, 'Animación');
    field(a, { label: 'Entrada', type: 'select', options: ANIMS_IN, get: () => T.animIn, set: (v) => sel.forEach((x) => x.text && (x.text.animIn = v)) });
    field(a, { label: 'Salida', type: 'select', options: ANIMS_OUT, get: () => T.animOut, set: (v) => sel.forEach((x) => x.text && (x.text.animOut = v)) });
    if (c.kind === 'caption') {
      const st = section(wrap, 'Estilo de subtítulos');
      const chips = document.createElement('div');
      chips.className = 'chips';
      for (const cs of CAPTION_STYLES) button(chips, cs.name, () => app.commit((P) => P.clips.forEach((x) => { if (x.kind === 'caption') { Object.assign(x.text, cs.s); x.text.styleId = cs.id; } })), 'chip' + (T.styleId === cs.id ? ' on' : ''));
      st.appendChild(chips);
      const r = document.createElement('div'); r.className = 'row'; r.style.marginTop = '10px';
      button(r, 'Copiar este diseño a todos', () => app.commit((P) => P.clips.forEach((x) => { if (x.kind === 'caption' && x !== c) { x.text = { ...JSON.parse(JSON.stringify(T)), content: x.text.content }; x.transform.y = c.transform.y; x.transform.scale = c.transform.scale; } })));
      st.appendChild(r);
    }
  }

  // ---- Clip ----
  const g = section(wrap, 'Clip');
  field(g, { label: 'Duración', type: 'number', step: 0.1, min: 0.1, get: () => +c.dur.toFixed(2), set: (v) => {
    let d = Math.max(0.1, v);
    if (m && (m.type === 'video' || m.type === 'audio')) d = Math.min(d, (m.duration - c.in) / c.speed);
    c.dur = d;
  } });
  if (c.kind === 'video' || c.kind === 'audio') {
    field(g, { label: 'Velocidad', type: 'chips', options: [[0.25, '0.25×'], [0.5, '0.5×'], [0.75, '0.75×'], [1, '1×'], [1.25, '1.25×'], [1.5, '1.5×'], [2, '2×'], [3, '3×']], get: () => c.speed, set: (v) => {
      sel.forEach((x) => { if (x.kind === 'video' || x.kind === 'audio') { const src = x.dur * x.speed; x.speed = +v; x.dur = src / x.speed; } });
    } });
    field(g, { label: 'Velocidad fina', min: 0.1, max: 8, step: 0.01, def: 1, pro: true, get: () => c.speed, set: (v) => { const src = c.dur * c.speed; c.speed = v; c.dur = src / v; }, fmt: (v) => v.toFixed(2) + '×' });
    field(g, { label: 'Volumen', min: 0, max: 2, step: 0.01, def: 1, get: () => c.volume, set: (v) => sel.forEach((x) => (x.volume = v)), fmt: pct });
    field(g, { label: 'Voz clara', type: 'checkbox', get: () => !!c.enhance, set: (v) => sel.forEach((x) => (x.enhance = v)) });
    field(g, { label: 'Fundido entrada', min: 0, max: Math.min(5, c.dur / 2), step: 0.05, def: 0, get: () => c.fadeIn, set: (v) => (c.fadeIn = v), fmt: sec });
    field(g, { label: 'Fundido salida', min: 0, max: Math.min(5, c.dur / 2), step: 0.05, def: 0, get: () => c.fadeOut, set: (v) => (c.fadeOut = v), fmt: sec });
  }

  // ---- Color ----
  if (isVisual) {
    const col = c.color || (c.color = { ...DEFAULT_COLOR });
    const right = `<button class="btn tiny" data-auto>✨ Auto</button>`;
    const s = section(wrap, 'Color', { right });
    s.parentElement.querySelector('[data-auto]').addEventListener('click', () => { app.commit(() => sel.forEach((x) => autoColor(x))); });
    field(s, { label: 'Filtro', type: 'select', options: [...LOOKS.map((l) => [l.id, l.name]), ['auto', 'Auto'], ['custom', 'Personalizado']], get: () => col.preset || 'none', set: (v) => sel.forEach((x) => applyLook(x, v)), after: rerender });
    const cset = (k) => (v) => sel.forEach((x) => { x.color[k] = v; x.color.preset = 'custom'; });
    field(s, { label: 'Exposición', min: -1, max: 1, step: 0.01, def: 0, get: () => col.exposure, set: cset('exposure'), fmt: signed });
    field(s, { label: 'Contraste', min: -1, max: 1, step: 0.01, def: 0, get: () => col.contrast, set: cset('contrast'), fmt: signed });
    field(s, { label: 'Saturación', min: -1, max: 1, step: 0.01, def: 0, get: () => col.saturation, set: cset('saturation'), fmt: signed });
    field(s, { label: 'Temperatura', min: -1, max: 1, step: 0.01, def: 0, get: () => col.temp, set: cset('temp'), fmt: signed });
    field(s, { label: 'Tinte', min: -1, max: 1, step: 0.01, def: 0, get: () => col.tint, set: cset('tint'), fmt: signed, pro: true });
    field(s, { label: 'Tono (hue)', min: -180, max: 180, step: 1, def: 0, get: () => col.hue, set: cset('hue'), fmt: (v) => v + '°', pro: true });
    field(s, { label: 'Nitidez', min: 0, max: 1, step: 0.01, def: 0, get: () => col.sharpen, set: cset('sharpen'), fmt: pct, pro: true });
    field(s, { label: 'Sepia', min: 0, max: 1, step: 0.01, def: 0, get: () => col.sepia, set: cset('sepia'), fmt: pct, pro: true });
    field(s, { label: 'Viñeta', min: 0, max: 1, step: 0.01, def: 0, get: () => col.vignette, set: cset('vignette'), fmt: pct });
    field(s, { label: 'Grano', min: 0, max: 1, step: 0.01, def: 0, get: () => col.grain, set: cset('grain'), fmt: pct, pro: true });
    field(s, { label: 'Desenfoque', min: 0, max: 30, step: 0.5, def: 0, get: () => col.blur, set: cset('blur'), fmt: (v) => v + 'px', pro: true });

    const f = section(wrap, 'Encuadre y movimiento');
    if (c.kind !== 'solid') field(f, { label: 'Encuadre', type: 'chips', options: [['cover', 'Llenar'], ['contain', 'Ajustar'], ['blurfill', 'Fondo desenfocado'], ['stretch', 'Estirar']], get: () => c.fit, set: (v) => sel.forEach((x) => (x.fit = v)) });
    field(f, { label: 'Movimiento', type: 'select', options: MOTIONS, get: () => c.motion, set: (v) => sel.forEach((x) => (x.motion = v)) });
  }
  if (c.kind !== 'audio') {
    const tr = section(wrap, 'Transición de entrada', { open: c.trans?.type !== 'none' });
    field(tr, { label: 'Tipo', type: 'select', options: TRANSITIONS.map((t) => [t.id, t.name]), get: () => c.trans.type, set: (v) => sel.forEach((x) => (x.trans = { type: v, dur: x.trans?.dur || 0.45 })), after: rerender });
    if (c.trans.type !== 'none') field(tr, { label: 'Duración', min: 0.1, max: Math.min(3, c.dur), step: 0.05, def: 0.45, get: () => c.trans.dur, set: (v) => sel.forEach((x) => (x.trans.dur = v)), fmt: sec });

    const t = section(wrap, 'Transformar', { open: app.pro });
    const T = c.transform;
    field(t, { label: 'Posición X', min: -1, max: 1, step: 0.005, def: 0, get: () => T.x, set: (v) => (T.x = v), fmt: pct });
    field(t, { label: 'Posición Y', min: -1, max: 1, step: 0.005, def: 0, get: () => T.y, set: (v) => (T.y = v), fmt: pct });
    field(t, { label: 'Escala', min: 0.1, max: 4, step: 0.01, def: 1, get: () => T.scale, set: (v) => (T.scale = v), fmt: pct });
    field(t, { label: 'Rotación', min: -180, max: 180, step: 1, def: 0, get: () => T.rot, set: (v) => (T.rot = v), fmt: (v) => v + '°' });
    field(t, { label: 'Opacidad', min: 0, max: 1, step: 0.01, def: 1, get: () => T.opacity, set: (v) => (T.opacity = v), fmt: pct });
    if (!isText) field(t, { label: 'Espejo', type: 'checkbox', get: () => T.flipX, set: (v) => (T.flipX = v) });
    const hint = document.createElement('p');
    hint.className = 'sub'; hint.style.marginTop = '8px';
    hint.textContent = 'Doble clic en un deslizador para restablecerlo.';
    t.appendChild(hint);
  }
  if (!app.pro) {
    const p = document.createElement('p');
    p.className = 'pro-hint';
    p.innerHTML = 'Activa <b>Modo Pro</b> arriba para ver todos los controles (tinte, grano, nitidez, velocidad fina, tipografía avanzada…).';
    wrap.appendChild(p);
  }
  root.scrollTop = scroll;
}
