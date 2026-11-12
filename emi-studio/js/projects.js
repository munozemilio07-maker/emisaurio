// Mis proyectos: autoguardado, abrir, duplicar, borrar y volver a vincular archivos.
import { newProject, projectDuration, fmtTime, fmtBytes, uid, History, migrate } from './state.js';
import { ASPECTS } from './presets.js';
import { media, importFile, setPersist } from './media.js';
import { putFile, getFile, saveProject, getProject, listProjects, deleteProject, storageInfo, lastProjectId, setLastProjectId } from './storage.js';
import { esc } from './ui.js';

export function initProjects(app, { renderMediaPanel }) {
  const chip = document.getElementById('saveState');
  const setChip = (txt, cls = '') => { if (chip) { chip.textContent = txt; chip.className = 'save-chip ' + cls; } };
  let saving = false, again = false, lastJson = '';

  setPersist((id, file) => {
    putFile(id, file).then((ok) => {
      const m = media.get(id);
      if (!ok && m) { m.unsaved = true; app.toast(`«${esc(file.name)}» pesa más de 2 GB: no lo copio. Si cierras, te pediré volver a elegirlo.`, 'warn', 7000); }
    }).catch((e) => console.warn('No se pudo guardar el archivo', e));
  });

  function thumb() {
    try {
      const src = document.getElementById('preview');
      if (!src.width || !app.P.clips.length) return null;
      const c = document.createElement('canvas');
      const k = 160 / Math.max(src.width, src.height);
      c.width = Math.round(src.width * k); c.height = Math.round(src.height * k);
      c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.7);
    } catch { return null; }
  }

  async function autosave() {
    if (!app.P.clips.length && !media.size) return;
    if (saving) { again = true; return; }
    const P = app.P;
    P.media = [...media.values()].map((m) => ({ id: m.id, name: m.name, type: m.type }));
    const data = JSON.stringify(P);
    if (data === lastJson) return;
    saving = true; setChip('Guardando…', 'busy');
    try {
      await saveProject({ id: P.id, name: P.name, updated: Date.now(), duration: projectDuration(P), aspect: P.aspect, clips: P.clips.length, thumb: thumb(), data });
      lastJson = data;
      setLastProjectId(P.id);
      setChip('✓ Guardado', 'ok');
    } catch (e) {
      console.error(e);
      setChip('⚠ Sin guardar', 'err');
      app.toast('No pude guardar el proyecto: ' + esc(e.message) + '. Puede que el disco o el navegador estén llenos.', 'err', 8000);
    } finally {
      saving = false;
      if (again) { again = false; autosave(); }
    }
  }
  app.onAutosave = autosave;
  window.addEventListener('beforeunload', () => { autosave(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) autosave(); });

  function resetWorkspace() {
    app.player.pause();
    for (const id of [...app.player.els.keys()]) app.player.drop(id);
    for (const m of media.values()) if (m.url) URL.revokeObjectURL(m.url);
    media.clear();
    app.selection.clear();
    app.history = new History();
  }

  async function openProject(id, { quiet = false } = {}) {
    await autosave();
    const rec = await getProject(id);
    if (!rec) throw new Error('No encontré ese proyecto.');
    resetWorkspace();
    const P = migrate(JSON.parse(rec.data));
    app.P = P;
    lastJson = rec.data;
    const missing = [];
    // Crear primero los huecos para que la línea de tiempo se pinte al instante
    for (const ref of P.media || []) media.set(ref.id, { ...ref, loading: true, duration: 0 });
    app.refresh(); renderMediaPanel();
    await Promise.all((P.media || []).map(async (ref) => {
      try {
        const f = await getFile(ref.id);
        if (!f) throw new Error('falta');
        await importFile(new File([f.blob], f.name, { type: f.type }), () => renderMediaPanel(), { id: ref.id, persist: false });
      } catch {
        media.set(ref.id, { ...ref, missing: true, loading: false, duration: 0 });
        missing.push(ref.name);
      }
    }));
    setLastProjectId(P.id);
    app.refresh(); renderMediaPanel();
    app.timeline.zoomFit();
    setChip('✓ Guardado', 'ok');
    if (missing.length) app.toast(`Faltan ${missing.length} archivo(s): ${missing.map(esc).join(', ')}. Pulsa «Volver a vincular» en Medios.`, 'warn', 9000);
    else if (!quiet) app.toast(`Abierto «${esc(P.name)}».`, 'ok');
  }

  async function createProject(aspectId = '9:16') {
    await autosave();
    resetWorkspace();
    const a = ASPECTS.find((x) => x.id === aspectId) || ASPECTS[0];
    app.P = newProject(a);
    lastJson = '';
    setLastProjectId(app.P.id);
    app.refresh(); renderMediaPanel();
    setChip('Nuevo', '');
  }

  async function duplicate(id) {
    const rec = await getProject(id);
    if (!rec) return;
    const P = JSON.parse(rec.data);
    P.id = uid('p'); P.name = P.name + ' (copia)';
    await saveProject({ ...rec, id: P.id, name: P.name, updated: Date.now(), data: JSON.stringify(P) });
  }

  // Volver a vincular un archivo que falta
  app.relink = (mediaId) => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'video/*,audio/*,image/*';
    inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return;
      try {
        await importFile(f, () => renderMediaPanel(), { id: mediaId });
        app.refresh(); renderMediaPanel();
        app.toast(`Vinculado «${esc(f.name)}».`, 'ok');
      } catch (e) { app.toast(esc(e.message), 'err'); }
    };
    inp.click();
  };

  async function showProjects() {
    await autosave();
    const modal = document.getElementById('projModal');
    const list = await listProjects();
    const info = await storageInfo();
    let confirmDel = null;
    const draw = () => {
      modal.innerHTML = `<div class="dialog proj-dialog" role="dialog" aria-label="Mis proyectos">
        <header><div><h2>Mis proyectos</h2><p>Se guardan solos en este navegador${info.quota ? ` · usando ${fmtBytes(info.usage)} de ${fmtBytes(info.quota)}` : ''}</p></div>
          <button class="btn ghost icon" data-x title="Cerrar">✕</button></header>
        <div class="proj-body">
          <div class="proj-new">
            <b>Nuevo proyecto</b>
            <div class="chips">${ASPECTS.slice(0, 5).map((a) => `<button class="chip" data-new="${a.id}">${a.label}</button>`).join('')}</div>
          </div>
          <div class="proj-grid">${list.length ? list.map((p) => `
            <div class="proj${p.id === app.P.id ? ' current' : ''}" data-id="${p.id}">
              <button class="proj-open" data-open="${p.id}">
                <div class="proj-thumb">${p.thumb ? `<img src="${p.thumb}" alt="">` : '<span>◆</span>'}</div>
                <b>${esc(p.name)}</b>
                <small>${p.aspect || ''} · ${fmtTime(p.duration || 0)} · ${new Date(p.updated).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })}</small>
              </button>
              <div class="proj-actions">
                ${p.id === app.P.id ? '<span class="tag">Abierto</span>' : ''}
                <button class="btn tiny" data-dup="${p.id}">Duplicar</button>
                <button class="btn tiny ${confirmDel === p.id ? 'danger' : ''}" data-del="${p.id}">${confirmDel === p.id ? '¿Seguro? Borrar' : 'Borrar'}</button>
              </div>
            </div>`).join('') : '<p class="sub">Aún no tienes proyectos guardados. Empieza uno arriba o importa un video.</p>'}</div>
        </div></div>`;
      modal.hidden = false;
      modal.querySelector('[data-x]').onclick = () => (modal.hidden = true);
      modal.onclick = (e) => { if (e.target === modal) modal.hidden = true; };
      modal.querySelectorAll('[data-new]').forEach((b) => (b.onclick = async () => { modal.hidden = true; await createProject(b.dataset.new); }));
      modal.querySelectorAll('[data-open]').forEach((b) => (b.onclick = async () => {
        modal.hidden = true;
        if (b.dataset.open === app.P.id) return;
        try { await openProject(b.dataset.open); } catch (e) { app.toast(esc(e.message), 'err'); }
      }));
      modal.querySelectorAll('[data-dup]').forEach((b) => (b.onclick = async () => { await duplicate(b.dataset.dup); list.splice(0, list.length, ...(await listProjects())); draw(); }));
      modal.querySelectorAll('[data-del]').forEach((b) => (b.onclick = async () => {
        const id = b.dataset.del;
        if (confirmDel !== id) { confirmDel = id; draw(); return; }
        await deleteProject(id);
        if (id === app.P.id) await createProject(app.P.aspect);
        confirmDel = null;
        list.splice(0, list.length, ...(await listProjects()));
        draw();
      }));
    };
    draw();
  }

  async function restoreLast() {
    const id = lastProjectId();
    if (!id) return false;
    try {
      const rec = await getProject(id);
      if (!rec) return false;
      await openProject(id, { quiet: true });
      app.toast(`Recuperé tu proyecto «${esc(app.P.name)}». Todo se guarda solo.`, 'ok', 4000);
      return true;
    } catch (e) { console.warn(e); return false; }
  }

  return { autosave, openProject, createProject, showProjects, restoreLast };
}
