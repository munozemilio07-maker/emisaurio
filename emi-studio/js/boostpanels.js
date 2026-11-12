// UI de la etapa 5: puntuación viral, efectos de sonido + zooms, y clips automáticos.
import { FORMATS } from './presets.js';
import { makeClip, clipsOnTrack, clipEnd, fmtTime, fmtBytes } from './state.js';
import { media } from './media.js';
import { SFX, sfxMedia, previewSfx } from './sfx.js';
import { autoZooms, autoSfx, viralScore, findClips, clipProject } from './boost.js';
import { normalizeLoudness, voiceTrackId } from './viral.js';
import { exportProject, download } from './export.js';
import * as MB from 'mediabunny';
import { esc } from './ui.js';

export function createBoostPanels(app) {
  const prefs = { zk: 1.18, cutsSfx: 'whoosh', zoomSfx: 'pop', sfxVol: 0.55, clipLen: [20, 60], clipMedia: null, clips: null, picked: new Set(), exporting: false, expStatus: '' };

  // ---------- Puntuación viral ----------
  function mountScore(el) {
    const { score, items, plat } = viralScore(app.P);
    const color = score >= 80 ? 'var(--ok)' : score >= 55 ? 'var(--warn)' : 'var(--bad)';
    const card = document.createElement('div');
    card.className = 'score-card';
    card.innerHTML = `
      <div class="score-top">
        <div class="ring" style="--p:${score};--c:${color}"><b>${score}</b><small>/100</small></div>
        <div><b>Puntuación viral</b><span class="sub">Para ${esc(plat.name)}. ${score >= 80 ? '¡Listo para publicar!' : score >= 55 ? 'Bien, pero puedes subirla.' : 'Arregla lo marcado en rojo.'}</span></div>
      </div>
      <ul class="score-list">${items.map((it, i) => `
        <li class="${it.v >= 0.99 ? 'ok' : it.v >= 0.5 ? 'mid' : 'bad'}">
          <i>${it.v >= 0.99 ? '✓' : it.v >= 0.5 ? '!' : '✗'}</i>
          <div><b>${it.label}</b><span>${esc(it.msg)}</span></div>
          ${it.fix ? `<button class="btn tiny" data-fix="${i}">${it.fix.label}</button>` : ''}
        </li>`).join('')}</ul>`;
    el.prepend(card);
    card.querySelectorAll('[data-fix]').forEach((b) => b.addEventListener('click', async () => {
      const fix = items[+b.dataset.fix].fix;
      if (fix.tab) return app.showTab(fix.tab);
      if (fix.async === 'normalize') { b.disabled = true; app.history.push(app.P); await normalizeLoudness(app.P); app.refresh(); return; }
      app.commit((P) => fix.run(P));
    }));
  }

  // ---------- Efectos y zooms ----------
  function renderFx(el) {
    const zoomN = app.P.clips.reduce((a, c) => a + (c.zooms?.filter((z) => z.auto).length || 0), 0);
    const autoN = app.P.clips.filter((c) => c.autoSfx).length;
    el.innerHTML = `<h3>Zooms y efectos</h3>
      <div class="tool">
        <div class="tool-h"><b>🔍 Zooms en las palabras fuertes</b><span class="sub">Detecto lo que dices más fuerte, números y palabras clave, como Submagic</span></div>
        <div class="chips" id="zK">${[[1.1, 'Suave'], [1.18, 'Medio'], [1.3, 'Fuerte']].map(([v, l]) => `<button class="chip${prefs.zk === v ? ' on' : ''}" data-v="${v}">${l}</button>`).join('')}</div>
        <div class="row"><button class="btn small" id="zGo">Aplicar zooms</button>${zoomN ? `<button class="btn small ghost" id="zOff">Quitar (${zoomN})</button>` : ''}</div>
      </div>
      <div class="tool">
        <div class="tool-h"><b>🔊 Efectos automáticos</b><span class="sub">Un sonido en cada corte y en cada zoom, con el volumen bajo la voz</span></div>
        <div class="field wide"><label>En cortes</label><select id="sCut"><option value="">Nada</option>${SFX.map((s) => `<option value="${s.id}">${s.icon} ${s.name}</option>`).join('')}</select></div>
        <div class="field wide"><label>En zooms</label><select id="sZoom"><option value="">Nada</option>${SFX.map((s) => `<option value="${s.id}">${s.icon} ${s.name}</option>`).join('')}</select></div>
        <div class="row"><span class="sub">Volumen</span><input type="range" id="sVol" min="0.1" max="1" step="0.05" value="${prefs.sfxVol}" style="flex:1"></div>
        <div class="row"><button class="btn small" id="sGo">Poner efectos</button>${autoN ? `<button class="btn small ghost" id="sOff">Quitar (${autoN})</button>` : ''}</div>
      </div>
      <h3 style="margin-top:14px">Biblioteca de efectos</h3>
      <p class="sub">Generados aquí mismo: sin derechos de autor. ▶ escuchar · ＋ añadir en el cabezal.</p>
      <div class="sfx-grid">${SFX.map((s) => `<div class="sfx"><span class="sfx-i">${s.icon}</span><b>${s.name}</b><button class="btn tiny" data-play="${s.id}" title="Escuchar">▶</button><button class="btn tiny" data-add="${s.id}" title="Añadir">＋</button></div>`).join('')}</div>`;
    const $ = (s) => el.querySelector(s);
    $('#sCut').value = prefs.cutsSfx; $('#sZoom').value = prefs.zoomSfx;
    $('#sCut').onchange = (e) => (prefs.cutsSfx = e.target.value);
    $('#sZoom').onchange = (e) => (prefs.zoomSfx = e.target.value);
    $('#sVol').oninput = (e) => (prefs.sfxVol = +e.target.value);
    $('#zK').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) { prefs.zk = +b.dataset.v; renderFx(el); } });
    $('#zGo').addEventListener('click', () => {
      let n = 0;
      app.commit((P) => (n = autoZooms(P, { k: prefs.zk })));
      app.toast(n ? `🔍 ${n} zooms de énfasis. Reproduce para verlos.` : 'No encontré palabras fuertes. Transcribe primero en ¶ Transcr. para mejores resultados.', n ? 'ok' : 'warn', 5000);
    });
    $('#zOff')?.addEventListener('click', () => app.commit((P) => P.clips.forEach((c) => { if (c.zooms) c.zooms = c.zooms.filter((z) => !z.auto); })));
    $('#sGo').addEventListener('click', async (e) => {
      e.target.disabled = true;
      app.history.push(app.P);
      const n = await autoSfx(app.P, { cuts: prefs.cutsSfx, zooms: prefs.zoomSfx, vol: prefs.sfxVol }, () => app.renderPanel?.('media'));
      app.refresh();
      app.toast(n ? `🔊 ${n} efectos colocados en la pista Efectos.` : 'No hay cortes ni zooms todavía. Aplica zooms o divide tu video primero.', n ? 'ok' : 'warn');
    });
    $('#sOff')?.addEventListener('click', () => app.commit((P) => (P.clips = P.clips.filter((c) => !c.autoSfx))));
    el.querySelectorAll('[data-play]').forEach((b) => b.addEventListener('click', () => previewSfx(b.dataset.play)));
    el.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', async () => {
      const m = await sfxMedia(b.dataset.add, () => app.renderPanel?.('media'));
      const tr = app.P.tracks.find((t) => t.sfx);
      const c = makeClip('audio', tr.id, app.player.t, m.duration, { mediaId: m.id, volume: prefs.sfxVol });
      app.commit((P) => P.clips.push(c));
      app.toast(`${b.closest('.sfx').querySelector('b').textContent} añadido en ${fmtTime(app.player.t)}.`, 'ok', 2000);
    }));
  }

  // ---------- Clips automáticos ----------
  function transcribed() { return [...media.values()].filter((m) => app.P.transcripts?.[m.id] && !m.missing); }

  function timelineSpot(clip) {
    const tid = voiceTrackId(app.P);
    for (const c of tid ? clipsOnTrack(app.P, tid) : []) {
      if (c.mediaId !== clip.mediaId) continue;
      if (clip.a >= c.in && clip.a < c.in + c.dur * c.speed) {
        const t0 = c.start + (clip.a - c.in) / c.speed;
        return [t0, Math.min(clipEnd(c), t0 + (clip.b - clip.a) / c.speed)];
      }
    }
    return null;
  }

  function renderClips(el) {
    const list = transcribed();
    if (!prefs.clipMedia || !list.find((m) => m.id === prefs.clipMedia)) prefs.clipMedia = list[0]?.id || null;
    el.innerHTML = `<h3>Clips automáticos</h3>
      <p class="sub">De un video largo (podcast, stream, clase) saco los mejores momentos como shorts verticales con subtítulos y zooms, igual que Opus Clip.</p>
      ${!list.length ? `<div class="tool"><b>Primero transcribe tu video largo</b><span class="sub">Ponlo en la línea de tiempo y pulsa Transcribir en ¶ Transcr.</span><button class="btn small" id="clGoTx">Ir a ¶ Transcr.</button></div>` : `
        <div class="field wide"><label>Video</label><select id="clMedia">${list.map((m) => `<option value="${m.id}">${esc(m.name)} · ${fmtTime(m.duration)}</option>`).join('')}</select></div>
        <div class="field wide"><label>Duración</label><div class="chips" id="clLen">${[[[15, 30], '15–30 s'], [[20, 60], '20–60 s'], [[45, 90], '45–90 s']].map(([v, l]) => `<button class="chip${prefs.clipLen[0] === v[0] ? ' on' : ''}" data-v="${v.join(',')}">${l}</button>`).join('')}</div></div>
        <button class="btn primary wide" id="clFind">✂ Buscar los mejores momentos</button>`}
      ${prefs.clips ? (prefs.clips.length ? `
        <div class="clip-list">${prefs.clips.map((c, i) => `
          <div class="clipc">
            <label class="clip-pick"><input type="checkbox" data-pick="${i}"${prefs.picked.has(i) ? ' checked' : ''}></label>
            <div class="clip-score" style="--c:${c.score >= 80 ? 'var(--ok)' : c.score >= 60 ? 'var(--warn)' : 'var(--dim)'}">${c.score}</div>
            <div class="clip-body"><b>“${esc(c.title)}”</b><small>${fmtTime(c.a)} → ${fmtTime(c.b)} · ${(c.b - c.a).toFixed(0)} s</small>
              <div class="row"><button class="btn tiny" data-see="${i}">▶ Ver</button><button class="btn tiny" data-use="${i}">Usar aquí</button></div></div>
          </div>`).join('')}</div>
        <button class="btn primary wide" id="clExp"${prefs.picked.size && !prefs.exporting ? '' : ' disabled'}>⇪ Exportar ${prefs.picked.size || ''} clip${prefs.picked.size === 1 ? '' : 's'} para TikTok / Reels / Shorts</button>
        <div class="vstatus" id="clStat">${prefs.expStatus}</div>` : '<p class="sub">No encontré tramos de esa duración. Prueba otra duración.</p>') : ''}`;
    const $ = (s) => el.querySelector(s);
    $('#clGoTx')?.addEventListener('click', () => app.showTab('transcript'));
    if ($('#clMedia')) { $('#clMedia').value = prefs.clipMedia; $('#clMedia').onchange = (e) => { prefs.clipMedia = e.target.value; prefs.clips = null; renderClips(el); }; }
    $('#clLen')?.addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) { prefs.clipLen = b.dataset.v.split(',').map(Number); renderClips(el); } });
    $('#clFind')?.addEventListener('click', () => {
      prefs.clips = findClips(app.P, prefs.clipMedia, { min: prefs.clipLen[0], max: prefs.clipLen[1], count: 8 });
      prefs.picked = new Set(prefs.clips.map((_, i) => i).filter((i) => i < 3));
      renderClips(el);
    });
    el.querySelectorAll('[data-pick]').forEach((i) => i.addEventListener('change', () => { i.checked ? prefs.picked.add(+i.dataset.pick) : prefs.picked.delete(+i.dataset.pick); renderClips(el); }));
    el.querySelectorAll('[data-see]').forEach((b) => b.addEventListener('click', () => {
      const r = timelineSpot(prefs.clips[+b.dataset.see]);
      if (!r) return app.toast('Ese tramo no está en tu línea de tiempo. Usa «Usar aquí» para verlo.', 'warn');
      app.player.loopRange = r; app.player.seek(r[0]); app.player.play();
      app.timeline.drawRuler();
    }));
    el.querySelectorAll('[data-use]').forEach((b) => b.addEventListener('click', () => {
      const Q = clipProject(app.P, prefs.clips[+b.dataset.use]);
      app.history.push(app.P);
      const keep = { id: app.P.id, name: app.P.name, transcripts: app.P.transcripts };
      app.P = { ...Q, ...keep };
      app.player.loopRange = null;
      app.selection.clear();
      app.refresh(); app.timeline.zoomFit(); app.player.seek(0);
      app.toast('Clip listo en vertical con subtítulos, zooms y barra de progreso. Ctrl+Z vuelve al video completo.', 'ok', 6000);
    }));
    $('#clExp')?.addEventListener('click', async () => {
      prefs.exporting = true;
      const fmt = (await MB.canEncodeVideo('avc', { width: 1080, height: 1920 }).catch(() => false)) ? FORMATS.find((f) => f.id === 'mp4-h264') : FORMATS.find((f) => f.id === 'webm-vp9');
      const picked = [...prefs.picked].sort((a, b) => a - b);
      const set = (t) => { prefs.expStatus = t; const s = document.getElementById('clStat'); if (s) s.innerHTML = t; };
      renderClips(el);
      try {
        for (let k = 0; k < picked.length; k++) {
          const c = prefs.clips[picked[k]];
          const Q = clipProject(app.P, c, { name: `${app.P.name} - clip ${k + 1}` });
          const res = await exportProject(Q, { fmt, w: 1080, h: 1920, fps: 30, mbps: 8 }, ({ p }) => set(`Clip ${k + 1} de ${picked.length}: ${Math.round(p * 100)}%`));
          download(res.blob, res.name);
          set(`Clip ${k + 1} de ${picked.length} listo (${fmtBytes(res.blob.size)}).`);
        }
        set(`✓ ${picked.length} clips exportados.`);
        app.toast(`⇪ ${picked.length} clips exportados.`, 'ok');
      } catch (e) {
        console.error(e); set('⚠ ' + esc(e.message));
      } finally { prefs.exporting = false; renderClips(el); }
    });
  }

  return {
    mountScore,
    fx: { label: 'Efectos', icon: '✺', render: renderFx },
    clips: { label: 'Clips', icon: '✂', render: renderClips },
  };
}
