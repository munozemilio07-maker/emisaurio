// Emisaurio Studio — punto de entrada: estado global, paneles, inspector y atajos.
import { ASPECTS, GRADIENTS } from './presets.js';
import { newProject, makeClip, History, clipEnd, splitClip, rippleDeleteRange, trackEnd, projectDuration, fmtTime, uid, clone, clamp } from './state.js';
import { media, importFile, audioPending } from './media.js';
import { Player } from './player.js';
import { Timeline } from './timeline.js';
import { openExport } from './exportui.js';
import { initUI, esc } from './ui.js';
import { createPanels } from './panels.js';
import { renderInspector as drawInspector } from './inspector.js';
import { TEXT_STYLES } from './presets.js';
import { ensureFonts } from './render.js';
import { initProjects } from './projects.js';
import { createTranscriptPanel } from './transcriptpanel.js';
import { createBoostPanels } from './boostpanels.js';
import { createCameraPanel } from './camerapanel.js';

const $ = (s, r = document) => r.querySelector(s);

const app = {
  P: newProject(ASPECTS[0]),
  history: new History(),
  selection: new Set(),
  _snap: null,

  commit(fn) {
    this.history.push(this.P);
    fn?.(this.P);
    this.refresh();
  },
  beginEdit() { this._snap = JSON.stringify(this.P); },
  endEdit() {
    if (this._snap && this._snap !== JSON.stringify(this.P)) {
      this.history.stack.push(this._snap);
      this.history.redo.length = 0;
    }
    this._snap = null;
    this.refresh();
  },
  livePreview() { this.player.invalidate(); },
  refresh() {
    ensureFonts(this.P).then(() => this.player.requestDraw());
    this.timeline.render();
    renderInspector();
    if (curTab !== 'media') renderPanel();
    this.player.resize();
    this.player.invalidate();
    updateChrome();
    scheduleAutosave();
  },
  select(id) { this.selection.clear(); if (id) this.selection.add(id); this.timeline.render(); renderInspector(); if (['filters', 'transitions', 'camera'].includes(curTab)) renderPanel(); },
  toggleSelect(id) { this.selection.has(id) ? this.selection.delete(id) : this.selection.add(id); this.timeline.render(); renderInspector(); },
  selected() { return this.P.clips.filter((c) => this.selection.has(c.id)); },
  toast,
  importFiles,
  addMediaClip,
};
window.emi = app; // útil para depurar desde la consola

// ---------- Utilidades UI ----------
function toast(msg, type = '', ms = 3600) {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, ms);
}

// ---------- Vista previa ----------
const canvas = $('#preview');
app.player = new Player(canvas, () => app.P);
app.timeline = new Timeline($('#timeline'), app);
app.player.on((t, playing) => {
  app.timeline.updatePlayhead(t);
  $('#tcCur').textContent = fmtTime(t, app.P.fps, true).replace('.', ':');
  $('#playBtn').textContent = playing ? '❚❚' : '▶';
});

function fitStage() {
  const st = $('#stage');
  const W = st.clientWidth - 36, H = st.clientHeight - 36;
  const ar = app.P.width / app.P.height;
  let w = W, h = W / ar;
  if (h > H) { h = H; w = H * ar; }
  const wrap = $('#canvasWrap');
  wrap.style.width = Math.max(10, w) + 'px';
  wrap.style.height = Math.max(10, h) + 'px';
  renderSafeZones();
}
new ResizeObserver(fitStage).observe($('#stage'));

function renderSafeZones() {
  const sz = $('#safeZone');
  if (sz.hidden) return;
  const vertical = app.P.width / app.P.height < 0.7;
  sz.innerHTML = vertical
    ? `<div class="z" style="left:0;right:0;top:0;height:9%">Barra superior</div>
       <div class="z" style="right:0;width:15%;top:38%;height:44%">Botones<br>❤ 💬 ↗</div>
       <div class="z" style="left:0;right:0;bottom:0;height:18%">Descripción · usuario · música</div>`
    : `<div class="z" style="left:0;right:0;bottom:0;height:12%">Controles del reproductor</div>`;
}

function updateChrome() {
  const P = app.P;
  const d = projectDuration(P);
  $('#tcDur').textContent = fmtTime(d, P.fps, true).replace('.', ':');
  $('#emptyHint').style.display = P.clips.length ? 'none' : '';
  $('#canvasWrap').style.visibility = P.clips.length ? 'visible' : 'hidden';
  const a = ASPECTS.find((x) => x.id === P.aspect);
  $('#aspectLabel').textContent = a ? a.id : `${P.width}×${P.height}`;
  const ico = $('.aspect-ico');
  const s = 14 / Math.max(P.width, P.height);
  ico.className = 'aspect-ico ar-box';
  ico.style.cssText = `display:inline-block;width:${P.width * s}px;height:${P.height * s}px;margin-right:6px;vertical-align:-2px`;
  $('#undoBtn').disabled = !app.history.stack.length;
  $('#redoBtn').disabled = !app.history.redo.length;
  if ($('#projName').value !== P.name) $('#projName').value = P.name;
  fitStage();
}

// ---------- Selector de formato (aspecto) ----------
function buildAspectMenu() {
  const menu = $('#aspectMenu');
  menu.innerHTML = ASPECTS.map((a) => {
    const s = 22 / Math.max(a.w, a.h);
    return `<button class="menu-item${a.id === app.P.aspect ? ' active' : ''}" data-id="${a.id}">
      <span class="ar-box" style="width:${a.w * s}px;height:${a.h * s}px"></span>
      <span><b>${a.label}</b><small>${a.hint}</small></span></button>`;
  }).join('');
  menu.querySelectorAll('.menu-item').forEach((b) => b.addEventListener('click', () => {
    setAspect(b.dataset.id);
    menu.classList.remove('open');
  }));
}
export function setAspect(id) {
  const a = ASPECTS.find((x) => x.id === id);
  if (!a) return;
  app.commit((P) => { P.aspect = a.id; P.width = a.w; P.height = a.h; });
  toast(`Formato cambiado a <b>${a.label}</b>. Los clips se reencuadran solos; ajusta el “Encuadre” en el inspector si lo necesitas.`, 'ok');
}
app.setAspect = setAspect;
$('#aspectBtn').addEventListener('click', (e) => { e.stopPropagation(); buildAspectMenu(); $('#aspectMenu').classList.toggle('open'); });
document.addEventListener('click', (e) => { if (!e.target.closest('.aspect-pick')) $('#aspectMenu').classList.remove('open'); });

// ---------- Importación ----------
async function importFiles(files, at = null) {
  const list = [...files];
  const wasEmpty = !app.P.clips.length;
  let added = 0;
  for (const f of list) {
    try {
      const m = await importFile(f, (what) => { renderMediaPanel(); if (what === 'audio') { app.timeline.render(); app.player.invalidate(); renderPanel(); } });
      added++;
      if (at) { addMediaClip(m.id, at.trackId, at.t); at.t += m.duration; }
      else if (wasEmpty) addMediaClip(m.id);
    } catch (e) { toast(e.message, 'err', 6000); }
  }
  renderMediaPanel();
  if (wasEmpty && added) app.timeline.zoomFit();
  if (added) toast(`${added} archivo${added > 1 ? 's' : ''} importado${added > 1 ? 's' : ''}. Pulsa <b>+</b> o arrástralos a la línea de tiempo.`, 'ok');
}

function defaultTrackFor(m) {
  if (m.type === 'audio') {
    // proyecto sólo de audio (podcast, nota de voz): el primer audio es la voz, para poder transcribirlo
    const voice = app.P.tracks.find((t) => t.type === 'audio' && !t.music && !t.guide && !t.sfx);
    const hasVisual = app.P.clips.some((c) => c.kind === 'video' || c.kind === 'image');
    const hasVoice = app.P.clips.some((c) => c.trackId === voice?.id);
    if (!hasVisual && !hasVoice && voice) return voice.id;
    return app.P.tracks.find((t) => t.music && !t.guide)?.id || 'tA2';
  }
  return app.P.tracks.find((t) => t.main)?.id || 'tV1';
}

function addMediaClip(mediaId, trackId = null, t = null) {
  const m = media.get(mediaId);
  if (!m || m.loading) return toast('Espera a que termine de cargar…');
  trackId = trackId || defaultTrackFor(m);
  const tr = app.P.tracks.find((x) => x.id === trackId);
  // ajustar a una pista compatible
  // un video soltado en una pista de audio aporta sólo su sonido (p. ej. un TikTok guardado como sonido guía)
  const audioOnly = m.type === 'video' && tr.type === 'audio' && m.audio;
  if (m.type === 'audio' && tr.type !== 'audio') trackId = defaultTrackFor(m);
  if (m.type !== 'audio' && !audioOnly && tr.type !== 'video') trackId = defaultTrackFor(m);
  if (t == null) t = trackEnd(app.P, trackId);
  const kind = m.type === 'audio' || audioOnly ? 'audio' : m.type === 'image' ? 'image' : 'video';
  const c = makeClip(kind, trackId, t, m.duration, { mediaId });
  // vídeo horizontal en proyecto vertical → fondo desenfocado (lo que la gente suele querer)
  if (kind !== 'audio') {
    const projV = app.P.height > app.P.width, srcV = m.h > m.w;
    if (projV !== srcV) c.fit = 'blurfill';
    if (kind === 'image') c.motion = 'zoom-in';
  }
  app.commit((P) => P.clips.push(c));
  app.select(c.id);
  if (app.P.clips.length === 1) {
    // primer clip: sugerir formato
    const srcV = m.h > m.w;
    if (kind !== 'audio' && !srcV && app.P.height > app.P.width) {
      toast(`Tu video es horizontal y el proyecto vertical (9:16). Lo puse con <b>fondo desenfocado</b>. <button class="btn small" id="swAsp">Cambiar a 16:9</button>`, 'warn', 9000);
      setTimeout(() => $('#swAsp')?.addEventListener('click', () => setAspect('16:9')));
    }
  }
}

$('#fileInput').addEventListener('change', (e) => { importFiles(e.target.files); e.target.value = ''; });
$('#emptyImport').addEventListener('click', () => $('#fileInput').click());
let dragDepth = 0;
window.addEventListener('dragenter', (e) => { if (e.dataTransfer?.types?.includes('Files')) { dragDepth++; $('#dropOverlay').hidden = false; } });
window.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) $('#dropOverlay').hidden = true; });
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
  e.preventDefault(); dragDepth = 0; $('#dropOverlay').hidden = true;
  if (e.defaultPrevented && e.target.closest?.('.tl-lane')) return;
  if (!e.target.closest?.('.tl-lane') && e.dataTransfer.files?.length) importFiles(e.dataTransfer.files);
});

// ---------- Panel de medios ----------
function renderMediaPanel() {
  const el = $('#panel-media');
  const items = [...media.values()];
  el.innerHTML = `
    <h3>Tus medios</h3>
    <button class="import-btn" id="impBtn">＋ Importar video, foto o audio</button>
    <div class="media-grid">${items.map((m) => `
      ${m.missing ? `<div class="mcard missing" data-id="${m.id}" title="${esc(m.name)}"><span>⚠ Falta</span><small>${esc(m.name)}</small><button class="btn tiny" data-relink="${m.id}">Volver a vincular</button></div>` : `<div class="mcard ${m.type === 'audio' ? 'audio' : ''} ${m.loading ? 'loading' : ''}" draggable="true" data-id="${m.id}" title="${esc(m.name)}">
        ${m.thumb ? `<img src="${m.thumb}" alt="">` : m.type === 'audio' ? '♫' : ''}
        <span class="mtype">${{ video: 'Video', image: 'Foto', audio: 'Audio' }[m.type]}${m.type === 'video' && m.audioReady && !m.audio ? ' · sin audio' : ''}${(m.type === 'video' || m.type === 'audio') && !m.audioReady && !m.loading ? ' · analizando audio…' : ''}</span>
        <button class="madd" title="Añadir a la línea de tiempo">+</button>
        <div class="mmeta"><span>${esc(m.name)}</span><span>${m.type === 'image' ? '' : fmtTime(m.duration)}</span></div>
      </div>`}`).join('')}
    </div>
    ${items.length ? '' : '<p class="sub" style="margin-top:12px">Formatos: MP4, MOV, WebM, MKV, JPG, PNG, WebP, MP3, WAV, M4A, OGG, FLAC… (lo que tu navegador pueda leer).</p>'}
    <h3 style="margin-top:20px">Fondos de color</h3>
    <div class="swatches">${GRADIENTS.map((g, i) => `<button class="swatch" data-g="${i}" style="background:linear-gradient(135deg,${g[0]},${g[1]})" title="Añadir fondo"></button>`).join('')}</div>`;
  $('#impBtn', el).addEventListener('click', () => $('#fileInput').click());
  el.querySelectorAll('[data-relink]').forEach((b) => b.addEventListener('click', () => app.relink(b.dataset.relink)));
  el.querySelectorAll('.mcard:not(.missing)').forEach((card) => {
    card.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/emi-media', card.dataset.id); e.dataTransfer.effectAllowed = 'copy'; });
    card.querySelector('.madd').addEventListener('click', (e) => { e.stopPropagation(); addMediaClip(card.dataset.id); });
    card.addEventListener('dblclick', () => addMediaClip(card.dataset.id));
  });
  el.querySelectorAll('.swatch').forEach((s) => s.addEventListener('click', () => {
    const tr = app.P.tracks.find((t) => t.main);
    const c = makeClip('solid', tr.id, trackEnd(app.P, tr.id), 3, { fill: [...GRADIENTS[+s.dataset.g]] });
    app.commit((P) => P.clips.push(c)); app.select(c.id);
  }));
}

// ---------- Inspector y paneles ----------
let ui, panels, curTab = 'media';
function renderInspector() { drawInspector(app, ui); }
function renderPanel(id = curTab) {
  if (id !== curTab) return;
  if (id === 'media') return renderMediaPanel();
  const el = $('#panel-' + id);
  if (el && panels[id]) panels[id].render(el);
}
app.renderPanel = renderPanel;

function buildTabs() {
  const nav = $('#leftTabs');
  const tabs = [['media', 'Medios', '▣'], ...Object.entries(panels).filter(([, v]) => v.render).map(([k, v]) => [k, v.label, v.icon])];
  nav.innerHTML = tabs.map(([id, l, i]) => `<button data-tab="${id}" class="${id === curTab ? 'active' : ''}${id === 'viral' ? ' tab-viral' : ''}"><i>${i}</i><span>${l}</span></button>`).join('');
  const left = $('.left');
  for (const [id] of tabs) if (!$('#panel-' + id)) { const s = document.createElement('section'); s.className = 'panel'; s.id = 'panel-' + id; s.hidden = true; left.appendChild(s); }
  nav.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
}
function showTab(id) {
  curTab = id;
  document.querySelectorAll('#leftTabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === id));
  document.querySelectorAll('.left .panel').forEach((p) => (p.hidden = p.id !== 'panel-' + id));
  renderPanel(id);
}
app.showTab = showTab;

// ---------- Acciones de edición ----------
function splitAtPlayhead() {
  const t = app.player.t;
  let targets = app.selected().filter((c) => t > c.start && t < clipEnd(c));
  if (!targets.length) targets = app.P.clips.filter((c) => t > c.start && t < clipEnd(c) && !app.P.tracks.find((x) => x.id === c.trackId)?.locked);
  if (!targets.length) return toast('No hay ningún clip bajo el cabezal.');
  app.commit((P) => { for (const c of targets) splitClip(P, c, t); });
}
function deleteSel(ripple = false) {
  const sel = app.selected();
  if (!sel.length) return;
  app.commit((P) => {
    if (ripple) {
      for (const c of [...sel].sort((a, b) => b.start - a.start)) {
        P.clips = P.clips.filter((x) => x.id !== c.id);
        // cerrar hueco sólo en la pista del clip
        for (const x of P.clips) if (x.trackId === c.trackId && x.start >= clipEnd(c) - 1e-6) x.start -= c.dur;
      }
    } else P.clips = P.clips.filter((x) => !app.selection.has(x.id));
  });
  app.select(null);
}
function duplicateSel() {
  const sel = app.selected();
  if (!sel.length) return;
  const copies = sel.map((c) => ({ ...clone(c), id: uid('c'), start: trackEnd(app.P, c.trackId) }));
  app.commit((P) => P.clips.push(...copies));
  app.selection = new Set(copies.map((c) => c.id));
  app.refresh();
}
function undo() { const p = app.history.undo(app.P); if (p) { app.P = p; app.selection.clear(); app.refresh(); } }
function redo() { const p = app.history.redoStep(app.P); if (p) { app.P = p; app.selection.clear(); app.refresh(); } }
app.undo = undo; app.redo = redo;

$('#splitBtn').addEventListener('click', splitAtPlayhead);
$('#delBtn').addEventListener('click', () => deleteSel(false));
$('#rippleBtn').addEventListener('click', () => deleteSel(true));
$('#dupBtn').addEventListener('click', duplicateSel);
$('#undoBtn').addEventListener('click', undo);
$('#redoBtn').addEventListener('click', redo);
$('#snapBtn').addEventListener('click', (e) => { app.timeline.snap = !app.timeline.snap; e.currentTarget.classList.toggle('on', app.timeline.snap); });
$('#zoom').addEventListener('input', (e) => app.timeline.setZoom(+e.target.value));
app.onZoom = (pps) => ($('#zoom').value = pps);
$('#fitBtn').addEventListener('click', () => app.timeline.zoomFit());
$('#playBtn').addEventListener('click', () => app.player.toggle());
$('#toStart').addEventListener('click', () => app.player.seek(0));
$('#toEnd').addEventListener('click', () => app.player.seek(projectDuration(app.P)));
$('#frameBack').addEventListener('click', () => app.player.seek(app.player.t - 1 / app.P.fps));
$('#frameFwd').addEventListener('click', () => app.player.seek(app.player.t + 1 / app.P.fps));
$('#safeBtn').addEventListener('click', (e) => { const z = $('#safeZone'); z.hidden = !z.hidden; e.currentTarget.classList.toggle('toggle', true); e.currentTarget.classList.toggle('on', !z.hidden); renderSafeZones(); });
$('#loopBtn').addEventListener('click', (e) => {
  const pl = app.player;
  if (pl.loopRange) pl.loopRange = null;
  else {
    const sel = app.selected();
    pl.loopRange = sel.length ? [Math.min(...sel.map((c) => c.start)), Math.max(...sel.map(clipEnd))] : [0, projectDuration(app.P)];
  }
  e.currentTarget.classList.toggle('toggle', true);
  e.currentTarget.classList.toggle('on', !!pl.loopRange);
  app.timeline.drawRuler();
});
$('#projName').addEventListener('change', (e) => { app.commit((P) => (P.name = e.target.value.trim() || 'Mi video')); });
$('#exportBtn').addEventListener('click', () => {
  if (!app.P.clips.length) return toast('Añade algún clip antes de exportar.', 'warn');
  const pend = audioPending(app.P);
  if (pend.length) return toast(`Analizando el audio de ${pend.map((m) => esc(m.name)).join(', ')}… espera unos segundos y vuelve a exportar.`, 'warn', 5000);
  app.player.pause();
  openExport(app);
});

// ---------- Atajos de teclado ----------
window.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, select, [contenteditable]')) return;
  const mod = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();
  if (k === ' ') { e.preventDefault(); app.player.toggle(); }
  else if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  else if (mod && k === 'y') { e.preventDefault(); redo(); }
  else if (mod && k === 'd') { e.preventDefault(); duplicateSel(); }
  else if (mod && k === 'b' || k === 's' && !mod) { e.preventDefault(); splitAtPlayhead(); }
  else if (mod && k === 'a') { e.preventDefault(); app.selection = new Set(app.P.clips.map((c) => c.id)); app.timeline.render(); renderInspector(); }
  else if (k === 'delete' || k === 'backspace') { e.preventDefault(); deleteSel(e.shiftKey); }
  else if (k === 'arrowleft') { e.preventDefault(); app.player.seek(app.player.t - (e.shiftKey ? 1 : 1 / app.P.fps)); }
  else if (k === 'arrowright') { e.preventDefault(); app.player.seek(app.player.t + (e.shiftKey ? 1 : 1 / app.P.fps)); }
  else if (k === 'home') app.player.seek(0);
  else if (k === 'end') app.player.seek(projectDuration(app.P));
  else if (k === 'n') $('#snapBtn').click();
  else if (k === 't' && !mod) { e.preventDefault(); addTextAtPlayhead(); }
  else if (k === '+' || k === '=') app.timeline.setZoom(app.timeline.pps * 1.25);
  else if (k === '-') app.timeline.setZoom(app.timeline.pps / 1.25);
  else if (k === 'i') { const pl = app.player; pl.loopRange = [pl.t, Math.max(pl.t + 0.5, pl.loopRange?.[1] ?? projectDuration(app.P))]; app.timeline.drawRuler(); }
  else if (k === 'o') { const pl = app.player; pl.loopRange = [Math.min(pl.loopRange?.[0] ?? 0, pl.t - 0.5), pl.t]; app.timeline.drawRuler(); }
  else if (k === 'escape') { app.select(null); }
});

// ---------- Autoguardado (se completa en una etapa posterior) ----------
let saveTimer = null;
function scheduleAutosave() { clearTimeout(saveTimer); saveTimer = setTimeout(() => app.onAutosave?.(), 1500); }

function addTextAtPlayhead() {
  const st = TEXT_STYLES[0];
  const tr = app.P.tracks.find((t) => t.type === 'text');
  const c = makeClip('text', tr.id, app.player.t, 3, { text: { ...st.s, content: 'Escribe aquí' } });
  app.commit((P) => P.clips.push(c));
  app.select(c.id);
  setTimeout(() => document.querySelector('#inspector textarea')?.select(), 50);
}

// ---------- Modo Pro ----------
try { app.pro = localStorage.getItem('emi.pro') === '1'; } catch { app.pro = false; }
function syncPro() {
  $('#proBtn').classList.toggle('on', app.pro);
  $('#proBtn').innerHTML = app.pro ? '◆ Modo Pro' : '◇ Modo Fácil';
  document.body.classList.toggle('pro', app.pro);
}
$('#proBtn').addEventListener('click', () => {
  app.pro = !app.pro;
  try { localStorage.setItem('emi.pro', app.pro ? '1' : '0'); } catch {}
  syncPro(); renderInspector();
  toast(app.pro ? 'Modo Pro: todos los controles a la vista.' : 'Modo Fácil: sólo lo esencial.', 'ok', 2200);
});

// ---------- Inicio ----------
ui = initUI(app);
{
  const base = createPanels(app, ui);
  const { viral, ...rest } = base;
  const boost = createBoostPanels(app);
  app.mountScore = boost.mountScore;
  panels = { viral, transcript: createTranscriptPanel(app), clips: boost.clips, camera: createCameraPanel(app, ui), fx: boost.fx, ...rest };
}
buildTabs();
syncPro();
renderMediaPanel();
app.refresh();
setTimeout(() => app.timeline.zoomFit(), 50);
const projects = initProjects(app, { renderMediaPanel });
app.projects = projects;
$('#projBtn').addEventListener('click', () => projects.showProjects());
projects.restoreLast();
if (!('VideoEncoder' in window)) toast('Tu navegador no soporta WebCodecs: la exportación no funcionará. Usa Chrome, Edge o Brave actualizados.', 'err', 12000);
