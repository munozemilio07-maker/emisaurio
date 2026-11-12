// Ventana de exportación: plataformas, formatos, calidad, rango, progreso y compartir.
import { PLATFORMS, FORMATS, ASPECTS } from './presets.js';
import { projectDuration, fmtTime, fmtBytes } from './state.js';
import { exportProject, supportMatrix, evenDims, download } from './export.js';

const QUALITY = [['eco', 'Ligero', 0.6], ['high', 'Alta', 1], ['max', 'Máxima', 1.6]];
let support = null;

export async function openExport(app) {
  const P = app.P;
  const modal = document.getElementById('exportModal');
  const dur = projectDuration(P);
  const hasGuide = P.clips.some((c) => P.tracks.find((t) => t.id === c.trackId)?.guide);
  const st = {
    plat: PLATFORMS.find((p) => p.id === P.platform && (p.aspect === P.aspect || !p.aspect)) || PLATFORMS.find((p) => p.aspect === P.aspect) || PLATFORMS.find((p) => p.id === 'custom'),
    fmt: FORMATS[0], q: 'high', fps: P.fps, range: 'all', scale: 1, abort: null, result: null,
  };
  st.fmt = FORMATS.find((f) => f.id === st.plat.format) || FORMATS[0];
  st.fps = st.plat.id === 'custom' ? P.fps : st.plat.fps;

  modal.hidden = false;
  modal.innerHTML = `
    <div class="dialog" role="dialog" aria-label="Exportar">
      <header><div><h2>Exportar</h2><p>Sin marca de agua · codificado en tu equipo con aceleración por hardware cuando está disponible</p></div>
        <button class="btn ghost icon" data-x title="Cerrar">✕</button></header>
      <div class="dlg-body">
        <div class="dlg-col">
          <h4>¿Dónde lo vas a subir?</h4>
          <div class="plat-grid" id="platGrid"></div>
          <h4>Formato de archivo</h4>
          <div class="fmt-grid" id="fmtGrid"></div>
        </div>
        <div class="dlg-col">
          <h4>Ajustes</h4>
          <div class="field wide"><label>Nombre</label><input type="text" id="exName" value="${P.name}"></div>
          <div class="field wide"><label>Resolución</label><select id="exRes"></select></div>
          <div class="field wide"><label>FPS</label><select id="exFps">${[24, 25, 30, 50, 60].map((f) => `<option value="${f}">${f} fps</option>`).join('')}</select></div>
          <div class="field wide"><label>Calidad</label><div class="chips" id="exQ">${QUALITY.map(([id, l]) => `<button class="chip" data-q="${id}">${l}</button>`).join('')}</div></div>
          <div class="field wide"><label>Rango</label><div class="chips" id="exRange">
            <button class="chip" data-r="all">Todo (${fmtTime(dur)})</button>
            ${app.player.loopRange ? `<button class="chip" data-r="loop">Bucle</button>` : ''}
            ${app.selected().length ? `<button class="chip" data-r="sel">Selección</button>` : ''}
          </div></div>
          ${hasGuide ? `<div class="field wide"><label>Sonido guía</label><div><label class="switch"><input type="checkbox" id="exGuide"><i></i></label>
            <p class="sub" style="margin:6px 0 0">Déjalo apagado y añade el mismo sonido en TikTok: tu video entra en la página de la tendencia y evitas que lo silencien.</p></div></div>` : ''}
          <h4 style="margin-top:16px">Resumen</h4>
          <div class="summary" id="exSum"></div>
          <div id="exWarn"></div>
        </div>
      </div>
      <footer>
        <div class="progress" id="exProg"><div class="bar"><i></i></div><span id="exProgTxt">0%</span><button class="btn small" id="exCancel">Cancelar</button></div>
        <div class="done-box" id="exDone"></div>
        <span class="grow" style="flex:1" id="exSpacer"></span>
        <button class="btn primary" id="exGo">⇪ Exportar</button>
      </footer>
    </div>`;
  const $ = (s) => modal.querySelector(s);
  const close = () => { if (st.abort) return; modal.hidden = true; modal.innerHTML = ''; };
  $('[data-x]').addEventListener('click', () => { st.abort?.abort(); st.abort = null; close(); });
  modal.onclick = (e) => { if (e.target === modal) close(); };

  if (!support) support = await supportMatrix(1920, 1080).catch(() => ({}));
  const fmtOk = (f) => {
    if (f.kind === 'video') return support[f.v] && f.a.some((a) => support[a]) || support[f.v];
    if (f.kind === 'audio') return f.a.some((a) => support[a]);
    if (f.kind === 'text') return P.clips.some((c) => c.kind === 'caption');
    return true;
  };

  function renderPlats() {
    $('#platGrid').innerHTML = PLATFORMS.map((p) => `
      <button class="plat${p.id === st.plat.id ? ' on' : ''}" data-p="${p.id}">
        <span class="pi" style="color:${p.color}">${p.icon}</span>
        <b>${p.name}</b><small>${p.w ? `${p.aspect} · ${p.w}×${p.h} · ${p.fps}fps` : 'Tú eliges'}</small>
      </button>`).join('');
    $('#platGrid').querySelectorAll('.plat').forEach((b) => b.addEventListener('click', () => {
      st.plat = PLATFORMS.find((p) => p.id === b.dataset.p);
      if (st.plat.id !== 'custom') { st.fps = st.plat.fps; const f = FORMATS.find((x) => x.id === st.plat.format); if (f && fmtOk(f)) st.fmt = f; }
      P.platform = st.plat.id;
      update();
    }));
  }
  function renderFmts() {
    $('#fmtGrid').innerHTML = FORMATS.map((f) => {
      const ok = fmtOk(f);
      return `<button class="fmt${f.id === st.fmt.id ? ' on' : ''}${ok ? '' : ' na'}" data-f="${f.id}" ${ok ? '' : 'title="Tu navegador no puede generar este formato"'}><b>${f.label}</b><small>${ok ? f.note : f.kind === 'text' ? 'Añade subtítulos primero' : 'No disponible aquí'}</small></button>`;
    }).join('');
    $('#fmtGrid').querySelectorAll('.fmt:not(.na)').forEach((b) => b.addEventListener('click', () => { st.fmt = FORMATS.find((f) => f.id === b.dataset.f); update(); }));
  }
  function resOptions() {
    const base = st.plat.w ? { w: st.plat.w, h: st.plat.h } : { w: P.width, h: P.height };
    const d = evenDims(P, base.w, base.h);
    const longSide = Math.max(d.w, d.h);
    const opts = [];
    for (const target of [4320, 2160, 1440, 1080, 720, 480, 360]) {
      const k = target / Math.min(d.w, d.h);
      if (target > Math.min(d.w, d.h) * 2.01) continue;
      opts.push(evenDims(P, Math.round(d.w * k), Math.round(d.h * k)));
    }
    if (!opts.find((o) => o.w === d.w)) opts.unshift(d);
    return { d, opts: opts.sort((a, b) => b.w - a.w), longSide };
  }
  function range() {
    if (st.range === 'loop' && app.player.loopRange) return app.player.loopRange;
    if (st.range === 'sel' && app.selected().length) { const s = app.selected(); return [Math.min(...s.map((c) => c.start)), Math.max(...s.map((c) => c.start + c.dur))]; }
    return [0, dur];
  }

  function update() {
    renderPlats(); renderFmts();
    const { d, opts } = resOptions();
    const sel = $('#exRes');
    const prev = sel.value;
    sel.innerHTML = opts.map((o) => `<option value="${o.w}x${o.h}"${o.w === d.w ? ' selected' : ''}>${o.w}×${o.h}${o.w === d.w ? ' (recomendada)' : ''}</option>`).join('');
    if (prev && opts.some((o) => `${o.w}x${o.h}` === prev) && st.keepRes) sel.value = prev;
    $('#exFps').value = st.fps;
    $('#exQ').querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c.dataset.q === st.q));
    $('#exRange').querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c.dataset.r === st.range));
    const isVid = st.fmt.kind === 'video' || st.fmt.kind === 'gif';
    $('#exRes').closest('.field').style.display = st.fmt.kind === 'audio' || st.fmt.kind === 'text' ? 'none' : '';
    $('#exFps').closest('.field').style.display = isVid ? '' : 'none';
    $('#exQ').closest('.field').style.display = st.fmt.kind === 'video' ? '' : 'none';
    $('#exRange').closest('.field').style.display = st.fmt.kind === 'image' || st.fmt.kind === 'text' ? 'none' : '';
    summary();
  }

  function settings() {
    const [w, h] = $('#exRes').value.split('x').map(Number);
    const q = QUALITY.find((x) => x[0] === st.q)[2];
    const codecK = st.fmt.v === 'avc' || st.fmt.v === 'vp8' ? 1 : 0.65;
    const pixK = (w * h) / (st.plat.w ? st.plat.w * st.plat.h : 1920 * 1080);
    const fpsK = st.fps / (st.plat.fps || 30);
    const mbps = Math.max(0.5, (st.plat.mbps || 10) * q * codecK * Math.sqrt(Math.max(0.05, pixK)) * Math.sqrt(fpsK));
    return { w, h, fps: st.fps, mbps, range: range() };
  }

  function summary() {
    const s = settings();
    const len = s.range[1] - s.range[0];
    let size = 0;
    if (st.fmt.kind === 'video') size = (s.mbps * 1e6 / 8 + 24000) * len;
    else if (st.fmt.kind === 'audio') size = (st.fmt.id === 'wav' ? 192000 : st.fmt.id === 'flac' ? 110000 : 24000) * len;
    else if (st.fmt.kind === 'gif') size = s.w * s.h * 0.25 * len * 15;
    const rows = [
      ['Destino', st.plat.name],
      ['Formato', st.fmt.label],
      st.fmt.kind !== 'audio' && st.fmt.kind !== 'text' ? ['Resolución', `${s.w}×${s.h}`] : null,
      st.fmt.kind === 'video' ? ['Bitrate', `${s.mbps.toFixed(1)} Mbps · ${s.fps} fps`] : null,
      st.fmt.kind === 'image' ? ['Fotograma', fmtTime(app.player.t)] : ['Duración', fmtTime(len)],
      size ? ['Tamaño aprox.', fmtBytes(size)] : null,
    ].filter(Boolean);
    $('#exSum').innerHTML = rows.map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('');

    // Avisos inteligentes
    const w = [];
    const p = st.plat;
    if (p.aspect && p.aspect !== P.aspect && st.fmt.kind !== 'audio') {
      w.push(`<div class="warnbox">⚠ ${p.name} usa formato <b>${p.aspect}</b> y tu proyecto es <b>${P.aspect}</b>. Se exportará con tu formato actual.<br><button class="btn small" data-asp="${p.aspect}">Cambiar el proyecto a ${p.aspect}</button></div>`);
    }
    if (p.maxDur && len > p.maxDur && st.fmt.kind === 'video') w.push(`<div class="warnbox">⏱ ${p.name} admite como máximo ~${fmtTime(p.maxDur)}. Tu video dura ${fmtTime(len)}: recórtalo o divídelo en partes.</div>`);
    else if (p.sweet && st.fmt.kind === 'video' && p.id !== 'custom' && (len < p.sweet[0] || len > p.sweet[1])) w.push(`<div class="warnbox">💡 Para ${p.name} suelen rendir mejor los videos de ${p.sweet[0]}–${p.sweet[1] >= 600 ? Math.round(p.sweet[1] / 60) + ' min' : p.sweet[1] + ' s'}. El tuyo dura ${fmtTime(len)}.</div>`);
    if (st.fmt.kind === 'gif' && len > 15) w.push(`<div class="warnbox">GIF largo (${Math.round(len)} s): el archivo será pesado. Usa el bucle (I/O) para exportar sólo un tramo.</div>`);
    if (!w.length && st.fmt.kind === 'video') w.push(`<div class="warnbox ok">✓ Listo para ${p.name}. Sin marca de agua.</div>`);
    $('#exWarn').innerHTML = w.join('');
    $('#exWarn').querySelectorAll('[data-asp]').forEach((b) => b.addEventListener('click', () => { app.setAspect(b.dataset.asp); update(); }));
  }

  $('#exRes').addEventListener('change', () => { st.keepRes = true; summary(); });
  $('#exFps').addEventListener('change', (e) => { st.fps = +e.target.value; summary(); });
  $('#exQ').addEventListener('click', (e) => { const q = e.target.closest('[data-q]'); if (q) { st.q = q.dataset.q; update(); } });
  $('#exRange').addEventListener('click', (e) => { const r = e.target.closest('[data-r]'); if (r) { st.range = r.dataset.r; update(); } });

  $('#exGo').addEventListener('click', async () => {
    const s = settings();
    const name = $('#exName').value.trim() || P.name;
    const ctrl = new AbortController();
    st.abort = ctrl;
    $('#exGo').disabled = true;
    $('#exDone').classList.remove('on');
    $('#exSpacer').style.display = 'none';
    $('#exProg').classList.add('on');
    const bar = $('#exProg .bar i'), txt = $('#exProgTxt');
    $('#exCancel').onclick = () => ctrl.abort();
    const t0 = performance.now();
    try {
      const fps = st.fmt.kind === 'gif' ? Math.min(15, s.fps) : s.fps;
      const res = await exportProject({ ...P, name }, { fmt: st.fmt, w: s.w, h: s.h, fps, mbps: s.mbps, range: s.range, at: app.player.t, includeGuide: !!modal.querySelector('#exGuide')?.checked }, ({ p, label, eta }) => {
        bar.style.width = (p * 100).toFixed(1) + '%';
        txt.textContent = `${Math.round(p * 100)}% · ${label}${eta != null ? ` · quedan ~${Math.ceil(eta)} s` : ''}`;
      }, ctrl.signal);
      st.result = res;
      bar.style.width = '100%';
      const secs = ((performance.now() - t0) / 1000).toFixed(1);
      $('#exProg').classList.remove('on');
      const done = $('#exDone');
      done.classList.add('on');
      const canShare = navigator.canShare && navigator.canShare({ files: [new File([res.blob], res.name, { type: res.blob.type })] });
      done.innerHTML = `✓ <b>${res.name}</b> · ${fmtBytes(res.blob.size)} · ${secs} s ${res.aCodec ? `· audio ${res.aCodec.toUpperCase()}` : ''}
        <button class="btn small" id="exDl">⬇ Descargar de nuevo</button>
        ${canShare ? '<button class="btn small" id="exShare">↗ Compartir</button>' : ''}`;
      download(res.blob, res.name);
      $('#exDl').onclick = () => download(res.blob, res.name);
      $('#exShare')?.addEventListener('click', () => navigator.share({ files: [new File([res.blob], res.name, { type: res.blob.type })], title: res.name }).catch(() => {}));
      app.toast(`Exportado <b>${res.name}</b> (${fmtBytes(res.blob.size)})`, 'ok');
    } catch (e) {
      $('#exProg').classList.remove('on');
      $('#exSpacer').style.display = '';
      if (e.name === 'AbortError' || /cancel/i.test(e.message)) app.toast('Exportación cancelada.', 'warn');
      else { console.error(e); app.toast('Error al exportar: ' + e.message, 'err', 9000); }
    } finally {
      st.abort = null;
      $('#exGo').disabled = false;
    }
  });

  update();
}

export { ASPECTS };
