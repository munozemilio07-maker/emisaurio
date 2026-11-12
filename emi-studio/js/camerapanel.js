// Panel «Cámara»: reencuadre con caras, quitar fondo / croma y multicámara.
import { clipsOnTrack, fmtTime } from './state.js';
import { media } from './media.js';
import { analyzeReframe, guessKeyColor, buildMulticam } from './camera.js';
import { sourceTime } from './render.js';
import { esc, pct } from './ui.js';

export function createCameraPanel(app, ui) {
  const st = { busy: false, status: '', mc: new Set(), mcAudio: 0, mcInfo: '' };

  const targets = () => {
    const sel = app.selected().filter((c) => c.kind === 'video');
    if (sel.length) return sel;
    return clipsOnTrack(app.P, app.P.tracks.find((t) => t.main).id).filter((c) => c.kind === 'video');
  };

  function render(el) {
    const P = app.P;
    const sel = app.selected().find((c) => c.kind === 'video' || c.kind === 'image');
    const tg = targets();
    const reframed = P.clips.filter((c) => c.reframe).length;
    const vids = [...media.values()].filter((m) => m.type === 'video' && !m.missing && !m.loading);
    el.innerHTML = `<h3>Cámara inteligente</h3>
      <div class="tool">
        <div class="tool-h"><b>🎯 Reencuadre siguiendo tu cara</b><span class="sub">Al pasar de horizontal a vertical, la cámara virtual te sigue: paneo suave y corte cuando cambias de lugar.</span></div>
        <div class="row"><button class="btn small primary-lite" id="rfGo"${st.busy || !tg.length ? ' disabled' : ''}>Seguir caras en ${app.selected().some((c) => c.kind === 'video') ? 'la selección' : `${tg.length} clip${tg.length === 1 ? '' : 's'}`}</button>
        ${reframed ? `<button class="btn small ghost" id="rfOff">Quitar (${reframed})</button>` : ''}</div>
        <div class="vstatus" id="camStat">${st.status}</div>
      </div>

      <div class="tool">
        <div class="tool-h"><b>✂ Quitar el fondo</b><span class="sub">${sel ? `Clip: ${esc(media.get(sel.mediaId)?.name || '')}` : 'Selecciona un clip de video o foto en la línea de tiempo.'}</span></div>
        <div id="keyBox"></div>
      </div>

      <div class="tool">
        <div class="tool-h"><b>🎥 Multicámara automática</b><span class="sub">Varias cámaras del mismo momento (podcast, entrevista): las sincronizo por el audio y cambio a quien habla, como DaVinci.</span></div>
        ${vids.length < 2 ? '<span class="sub">Importa al menos 2 videos (uno por cámara) en Medios.</span>' : `
        <div class="checks">${vids.map((m) => `<label class="chk"><input type="checkbox" data-mc="${m.id}"${st.mc.has(m.id) ? ' checked' : ''}><span>${esc(m.name)} · ${fmtTime(m.duration)}${m.audio ? '' : ' (sin audio)'}</span></label>`).join('')}</div>
        <div class="field wide"><label>Audio de</label><select id="mcAudio">${[...st.mc].map((id, i) => `<option value="${i}">${esc(media.get(id)?.name || '')}</option>`).join('')}</select></div>
        <button class="btn small primary-lite" id="mcGo"${st.mc.size >= 2 ? '' : ' disabled'}>Sincronizar y montar</button>
        <div class="vstatus">${st.mcInfo}</div>`}
      </div>`;
    const $ = (s) => el.querySelector(s);

    $('#rfGo')?.addEventListener('click', async () => {
      st.busy = true;
      const set = (t) => { st.status = t; const s = document.getElementById('camStat'); if (s) s.innerHTML = t; };
      set('Cargando el detector de caras…');
      const list = targets();
      app.history.push(app.P);
      try {
        const n = await analyzeReframe(app.P, list, (p) => set(`Buscando caras… ${Math.round(p * 100)}%`));
        set(`✓ Cámara virtual lista en ${list.length} clip${list.length === 1 ? '' : 's'} (${n} archivo${n === 1 ? '' : 's'}).`);
        if (app.P.height <= app.P.width) app.toast('Tip: el reencuadre luce en formato vertical. Cambia a 9:16 arriba.', 'warn', 6000);
        app.refresh();
      } catch (e) { console.error(e); set('⚠ ' + esc(e.message)); }
      st.busy = false; render(el);
    });
    $('#rfOff')?.addEventListener('click', () => app.commit((P) => P.clips.forEach((c) => (c.reframe = false))));

    if (sel) renderKey($('#keyBox'), sel, () => render(el));

    el.querySelectorAll('[data-mc]').forEach((i) => i.addEventListener('change', () => { i.checked ? st.mc.add(i.dataset.mc) : st.mc.delete(i.dataset.mc); render(el); }));
    if ($('#mcAudio')) { $('#mcAudio').value = st.mcAudio; $('#mcAudio').onchange = (e) => (st.mcAudio = +e.target.value); }
    $('#mcGo')?.addEventListener('click', () => {
      try {
        let r;
        app.commit((P) => (r = buildMulticam(P, [...st.mc], { audioFrom: Math.min(st.mcAudio, st.mc.size - 1) })));
        st.mcInfo = `✓ ${r.segments} planos en ${fmtTime(r.duration)}. Desfases: ${r.offsets.map((d) => (d >= 0 ? '+' : '') + d.toFixed(1) + ' s').join(' / ')}. ${r.independent ? 'Cambio según quién habla.' : 'Los micros suenan igual: alterno con ritmo.'}`;
        app.timeline.zoomFit();
      } catch (e) { st.mcInfo = '⚠ ' + esc(e.message); }
      render(el);
    });
  }

  function renderKey(box, c, rerender) {
    const k = c.key || { on: false, type: 'person', bg: 'none', color: '#00d040', sim: 0.12, smooth: 0.08, spill: 0.5, feather: 0.18, bgColor: '#111111' };
    const set = (fn) => { app.commit(() => { c.key = { ...k }; fn(c.key); }); rerender(); };
    box.innerHTML = `
      <div class="chips" id="kMode">${[['off', 'Ninguno'], ['person', '👤 Persona (IA)'], ['chroma', '🟩 Pantalla verde/azul']].map(([v, l]) => `<button class="chip${(k.on ? k.type : 'off') === v ? ' on' : ''}" data-v="${v}">${l}</button>`).join('')}</div>
      ${k.on ? `<div class="field wide" style="margin-top:8px"><label>Fondo</label><div class="chips" id="kBg">${[['none', 'Transparente'], ['blur', 'Desenfocado (retrato)'], ['color', 'Color']].map(([v, l]) => `<button class="chip${(k.bg || 'none') === v ? ' on' : ''}" data-v="${v}">${l}</button>`).join('')}</div></div>` : ''}
      <div id="kFields"></div>
      ${k.on && k.bg === 'none' ? '<p class="sub" style="margin:4px 0 0">Para cambiar el fondo, mueve este clip a la pista <b>Overlay</b> y pon otro video o foto debajo en <b>Principal</b>.</p>' : ''}`;
    box.querySelector('#kMode').addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]'); if (!b) return;
      set((kk) => {
        kk.on = b.dataset.v !== 'off';
        if (kk.on) kk.type = b.dataset.v;
        if (kk.type === 'chroma' && kk.on) {
          const src = app.player.provider.frame(c, sourceTime(c, Math.max(c.start, Math.min(app.player.t, c.start + c.dur - 0.01))));
          if (src) kk.color = guessKeyColor(src);
        }
      });
    });
    box.querySelector('#kBg')?.addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) set((kk) => (kk.bg = b.dataset.v)); });
    if (!k.on) return;
    const f = box.querySelector('#kFields');
    const live = (key) => (v) => { c.key[key] = v; };
    c.key = c.key || k;
    if (k.bg === 'color') ui.field(f, { label: 'Color fondo', type: 'color', get: () => c.key.bgColor || '#111111', set: live('bgColor') });
    if (k.type === 'chroma') {
      ui.field(f, { label: 'Color a quitar', type: 'color', get: () => c.key.color, set: live('color') });
      ui.field(f, { label: 'Tolerancia', min: 0.01, max: 0.45, step: 0.005, def: 0.12, get: () => c.key.sim, set: live('sim'), fmt: pct });
      ui.field(f, { label: 'Suavizado', min: 0.005, max: 0.3, step: 0.005, def: 0.08, get: () => c.key.smooth, set: live('smooth'), fmt: pct });
      ui.field(f, { label: 'Quitar reflejo', min: 0, max: 1, step: 0.01, def: 0.5, get: () => c.key.spill, set: live('spill'), fmt: pct });
    } else {
      ui.field(f, { label: 'Borde', min: 0.02, max: 0.45, step: 0.01, def: 0.18, get: () => c.key.feather, set: live('feather'), fmt: pct });
    }
  }

  return { label: 'Cámara', icon: '◉', render };
}
