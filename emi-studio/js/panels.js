// Paneles de la izquierda: Viral, Texto, Subtítulos, Audio, Filtros y Transiciones.
import { TEXT_STYLES, CAPTION_STYLES, LOOKS, TRANSITIONS, DEFAULT_COLOR } from './presets.js';
import { makeClip, clipEnd, clipsOnTrack, projectDuration, fmtTime } from './state.js';
import { drawClip } from './render.js';
import { media } from './media.js';
import { LANGS, MODELS, voiceAudio, transcribe, toWords, buildCaptionClips, parseSRT, captionClipsFromSegments, applyCaptionStyle, retimeCaption } from './captions.js';
import { HOOKS, findSilences, removeSilences, alternateZoom, addHook, autoColor, applyLook, normalizeLoudness, beatMarkers, guideInfo, cutAtBeats, beatMontage, estimateBpm } from './viral.js';
import { importFile } from './media.js';
import { voiceMedia, timelineWords } from './textedit.js';
import { esc, pct } from './ui.js';

export function createPanels(app, ui) {
  const prefs = { beatEvery: 2, silence: 'normal', capLang: 'spanish', capModel: MODELS[0][0], capStyle: 'hormozi', capWords: 3, capEmoji: true, capPos: 'low', lookK: 1, transDur: 0.45 };
  const SIL = { soft: { thresholdDb: -44, minDur: 0.8 }, normal: { thresholdDb: -38, minDur: 0.55 }, hard: { thresholdDb: -33, minDur: 0.35 } };
  let capBusy = false, capStatus = '';
  const mainClips = () => clipsOnTrack(app.P, app.P.tracks.find((t) => t.main).id);
  const visualTargets = () => {
    const sel = app.selected().filter((c) => c.kind === 'video' || c.kind === 'image' || c.kind === 'solid');
    return sel.length ? sel : null;
  };

  // ---------------- VIRAL ----------------
  const viralSteps = [
    ['fmt', 'Formato vertical 9:16 con fondo desenfocado', true],
    ['sil', 'Quitar silencios (jump cuts)', true],
    ['zoom', 'Zoom alterno en cada corte', true],
    ['voice', 'Voz clara (EQ + compresión)', true],
    ['loud', 'Volumen listo para redes (≈ −14 LUFS)', true],
    ['duck', 'Bajar la música cuando hablas', true],
    ['color', 'Auto-color en todos los clips', true],
    ['bar', 'Barra de progreso', false],
    ['caps', 'Subtítulos automáticos con emojis', true],
  ];
  const viralOn = Object.fromEntries(viralSteps.map(([k, , v]) => [k, v]));

  let vStatus = '';
  async function makeViral() {
    if (!app.P.clips.length) return app.toast('Primero añade tu video.', 'warn');
    const say = (t) => { vStatus = t; const e = document.getElementById('vStat'); if (e) e.innerHTML = t; };
    app.history.push(app.P);
    const P = app.P;
    const log = [];
    if (viralOn.fmt && P.aspect !== '9:16') { P.aspect = '9:16'; P.width = 1080; P.height = 1920; log.push('formato 9:16'); }
    if (viralOn.fmt) for (const c of P.clips) { const m = media.get(c.mediaId); if (m && (c.kind === 'video' || c.kind === 'image') && m.w > m.h && c.fit !== 'blurfill') c.fit = 'blurfill'; }
    if (viralOn.sil) {
      say('Buscando silencios…');
      const r = findSilences(P, SIL[prefs.silence]);
      if (r.length) { const s = removeSilences(P, r); log.push(`${r.length} silencios fuera (−${s.toFixed(1)} s)`); }
    }
    if (viralOn.zoom) { alternateZoom(P); log.push('zoom en cortes'); }
    if (viralOn.voice) { for (const c of P.clips) if ((c.kind === 'video' || c.kind === 'audio') && !P.tracks.find((t) => t.id === c.trackId)?.music) c.enhance = true; log.push('voz clara'); }
    if (viralOn.duck) { P.autoDuck = true; log.push('ducking'); }
    if (viralOn.color) { let n = 0; for (const c of P.clips) if ((c.kind === 'video' || c.kind === 'image') && autoColor(c)) n++; if (n) log.push(`color en ${n} clips`); }
    if (viralOn.bar) { P.progressBar = { on: true, pos: 'top', color: '#ec4899', color2: '#f59e0b', h: 0.008 }; log.push('barra de progreso'); }
    if (viralOn.loud) { say('Midiendo volumen…'); const r = await normalizeLoudness(P); log.push(`volumen ${r.db > -99 ? r.db.toFixed(1) + ' dB → ' : ''}−14 LUFS`); }
    app.refresh();
    if (viralOn.caps) {
      say('Generando subtítulos… (la primera vez descarga el modelo)');
      const ok = await generateCaptions('vStat', true);
      log.push(ok ? 'subtítulos ✓' : 'subtítulos ✗ (revisa la conexión)');
    }
    say(`✓ Listo: ${log.join(' · ')}`);
    app.toast('✨ Video optimizado para redes. Revisa el resultado y ajusta lo que quieras.', 'ok', 6000);
  }

  function renderViral(el) {
    el.innerHTML = `
      <div class="hero-card">
        <div class="hero-t">✦ Hazlo viral en 1 clic</div>
        <p>Aplica los ajustes que usan los creadores. Después puedes cambiar cualquier cosa.</p>
        <div class="checks">${viralSteps.map(([k, l]) => `<label class="chk"><input type="checkbox" data-k="${k}"${viralOn[k] ? ' checked' : ''}><span>${l}</span></label>`).join('')}</div>
        <button class="btn primary wide" id="vGo">✨ Optimizar mi video</button>
        <div class="vstatus" id="vStat">${vStatus}</div>
      </div>

      ${guideCard()}

      <div class="tool">
        <div class="tool-h"><b>✂ Cortes de silencio</b><span class="sub">Quita pausas y muletillas largas</span></div>
        <div class="chips" id="silK">${[['soft', 'Suave'], ['normal', 'Normal'], ['hard', 'Agresivo']].map(([k, l]) => `<button class="chip${prefs.silence === k ? ' on' : ''}" data-k="${k}">${l}</button>`).join('')}</div>
        <div class="row"><button class="btn small" id="silScan">Analizar</button><span class="sub" id="silInfo"></span></div>
      </div>

      <div class="tool">
        <div class="tool-h"><b>🪝 Gancho de los primeros 3 s</b><span class="sub">Un texto que haga que se queden</span></div>
        <div class="chips">${HOOKS.map((h, i) => `<button class="chip" data-hook="${i}">${esc(h)}</button>`).join('')}</div>
      </div>

      <div class="tool">
        <div class="tool-h"><b>🔍 Zoom en cortes</b><span class="sub">Alterna 100% / 114% en cada clip para dar ritmo</span></div>
        <div class="row"><button class="btn small" id="zoomGo">Aplicar</button><button class="btn small ghost" id="zoomOff">Quitar</button></div>
      </div>

      <div class="tool">
        <div class="tool-h"><b>▬ Barra de progreso</b><span class="sub">Muestra cuánto falta y sube la retención</span></div>
        <div class="row">
          <label class="switch"><input type="checkbox" id="pbOn"${app.P.progressBar?.on ? ' checked' : ''}><i></i></label>
          <div class="chips" id="pbPos">${[['top', 'Arriba'], ['bottom', 'Abajo']].map(([k, l]) => `<button class="chip${(app.P.progressBar?.pos || 'top') === k ? ' on' : ''}" data-k="${k}">${l}</button>`).join('')}</div>
          <input type="color" id="pbCol" value="${app.P.progressBar?.color || '#ec4899'}" title="Color">
        </div>
      </div>`;
    const $ = (s) => el.querySelector(s);
    el.querySelectorAll('.chk input').forEach((i) => i.addEventListener('change', () => (viralOn[i.dataset.k] = i.checked)));
    $('#vGo').addEventListener('click', async (e) => { e.target.disabled = true; try { await makeViral(); } catch (err) { console.error(err); vStatus = 'Error: ' + esc(err.message); } const b = document.getElementById('vGo'); if (b) b.disabled = false; const st = document.getElementById('vStat'); if (st) st.innerHTML = vStatus; });
    $('#silK').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b) { prefs.silence = b.dataset.k; renderViral(el); } });
    $('#silScan').addEventListener('click', () => {
      const r = findSilences(app.P, SIL[prefs.silence]);
      const tot = r.reduce((a, [x, y]) => a + y - x, 0);
      if (!r.length) { $('#silInfo').textContent = 'No encontré silencios largos.'; return; }
      $('#silInfo').innerHTML = `${r.length} silencios · ${tot.toFixed(1)} s <button class="btn small primary-lite" id="silCut">Cortarlos</button>`;
      app.P.markers = app.P.markers.filter((m) => !m.sil).concat(r.map(([a]) => ({ t: a, sil: true, label: 'silencio' })));
      app.timeline.render();
      $('#silCut').addEventListener('click', () => {
        app.commit((P) => { P.markers = P.markers.filter((m) => !m.sil); removeSilences(P, r); });
        app.toast(`✂ ${r.length} silencios eliminados. Tu video es ${tot.toFixed(1)} s más corto.`, 'ok');
        $('#silInfo').textContent = '';
      });
    });
    el.querySelectorAll('[data-hook]').forEach((b) => b.addEventListener('click', () => {
      let c;
      app.commit((P) => { c = addHook(P, HOOKS[+b.dataset.hook], 0); });
      app.select(c.id); app.player.seek(0.4);
    }));
    $('#zoomGo').addEventListener('click', () => { let n; app.commit((P) => (n = alternateZoom(P))); app.toast(`Zoom alterno en ${n} clips.`, 'ok'); });
    $('#zoomOff').addEventListener('click', () => app.commit(() => mainClips().forEach((c) => (c.transform.scale = 1))));
    const pb = () => (app.P.progressBar ||= { on: false, pos: 'top', color: '#ec4899', color2: '#f59e0b', h: 0.008 });
    $('#pbOn').addEventListener('change', (e) => app.commit(() => (pb().on = e.target.checked)));
    $('#pbPos').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b) { app.commit(() => { pb().pos = b.dataset.k; pb().on = true; }); renderViral(el); } });
    $('#pbCol').addEventListener('change', (e) => app.commit(() => { pb().color = e.target.value; pb().color2 = e.target.value; }));
    bindGuide(el, () => renderViral(el));
    app.mountScore?.(el);
  }

  // ---------------- SONIDO VIRAL (guía) ----------------
  function guideCard() {
    const g = guideInfo(app.P);
    const beats = app.P.markers.filter((m) => m.beat).map((m) => m.t);
    const bpm = estimateBpm(beats);
    const hasMusic = app.P.clips.some((c) => c.kind === 'audio' && app.P.tracks.find((t) => t.id === c.trackId)?.music);
    return `<div class="tool guide-tool">
      <div class="tool-h"><b>🎵 Sonido viral de TikTok</b><span class="sub">Edita al ritmo de un audio en tendencia y ponlo después en TikTok</span></div>
      ${g ? `
        <div class="row"><span class="bpm">${bpm ? bpm + ' BPM' : '— BPM'}</span><span class="sub">${beats.length} beats · ${esc(g.name || '')}</span></div>
        <div class="offset-box">En TikTok: <b>Añadir sonido</b> → el mismo audio → <b>Recortar</b> para que empiece en <b>${fmtTime(g.offset).replace(/\.\d$/, '')}</b>${g.at > 0.05 ? ` y entre en el segundo ${g.at.toFixed(1)} de tu video` : ''}.</div>
        <div class="field wide"><label>Cortar cada</label><div class="chips" id="gEvery">${[[1, 'beat'], [2, '2 beats'], [4, 'compás'], [8, '2 compases']].map(([v, l]) => `<button class="chip${prefs.beatEvery === v ? ' on' : ''}" data-v="${v}">${l}</button>`).join('')}</div></div>
        <div class="row">
          <button class="btn small" id="gCut" title="Divide tu video en cada golpe y alterna el zoom">✂ Cortes al ritmo</button>
          <button class="btn small" id="gMont" title="Cada clip o foto dura exactamente N beats">🖼 Montaje al ritmo</button>
        </div>
        <div class="row"><button class="btn small ghost" id="gNew">Cambiar sonido</button><button class="btn small ghost" id="gDel">Quitar guía</button></div>
        <p class="sub" style="margin:0">La pista rosa <b>no se exporta</b>. Arrastra su borde izquierdo para usar otra parte de la canción.</p>`
      : `<ol class="steps">
          <li>En TikTok abre el video con el sonido → <b>Compartir → Guardar video</b> (o graba el audio).</li>
          <li>Súbelo aquí: uso sólo su sonido como <b>guía</b> y detecto los beats.</li>
          <li>Cuadra tus clips al ritmo con un clic.</li>
          <li>Exporta <b>sin la canción</b> y en TikTok añade el mismo sonido. Así entras en la tendencia y no te silencian.</li>
        </ol>
        <button class="btn primary wide" id="gNew">🎵 Elegir el TikTok guardado o el audio</button>
        ${hasMusic ? '<button class="btn small wide" id="gBeats">o detectar beats de mi pista Música</button>' : ''}`}
      <input type="file" id="gFile" accept="video/*,audio/*" hidden>
    </div>`;
  }

  function bindGuide(el, rerender) {
    const $ = (s) => el.querySelector(s);
    $('#gNew')?.addEventListener('click', () => $('#gFile').click());
    $('#gFile')?.addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      app.toast('Analizando el sonido…');
      try {
        const m = await importFile(f, () => app.renderPanel?.('media'));
        for (let i = 0; i < 300 && !m.audioReady; i++) await new Promise((r) => setTimeout(r, 100));
        if (!m.audio) throw new Error('ese archivo no tiene audio');
        const gid = app.P.tracks.find((t) => t.guide).id;
        app.P.clips = app.P.clips.filter((c) => c.trackId !== gid);
        app.addMediaClip(m.id, gid, 0);
        let r;
        app.commit((P) => (r = beatMarkers(P)));
        app.toast(`🎵 Sonido guía listo: ${r.bpm ? r.bpm + ' BPM · ' : ''}${r.n} beats. Pulsa Espacio para escucharlo con tu video.`, 'ok', 6000);
        rerender();
      } catch (err) { app.toast('No pude usar ese sonido: ' + esc(err.message), 'err'); }
    });
    $('#gBeats')?.addEventListener('click', () => { let r; app.commit((P) => (r = beatMarkers(P))); app.toast(r.n ? `${r.n} beats marcados${r.bpm ? ` (${r.bpm} BPM)` : ''}.` : 'No encontré beats claros.', r.n ? 'ok' : 'warn'); rerender(); });
    $('#gEvery')?.addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) { prefs.beatEvery = +b.dataset.v; rerender(); } });
    $('#gCut')?.addEventListener('click', () => {
      let n = 0;
      app.commit((P) => { beatMarkers(P); n = cutAtBeats(P, prefs.beatEvery); alternateZoom(P); });
      app.toast(n ? `✂ ${n} cortes al ritmo con zoom alterno.` : 'No hay clips bajo los beats. Pon tu video en la pista Principal.', n ? 'ok' : 'warn');
    });
    $('#gMont')?.addEventListener('click', () => {
      let n = 0;
      app.commit((P) => { beatMarkers(P); n = beatMontage(P, prefs.beatEvery); });
      app.toast(n ? `🖼 ${n} clips cuadrados al ritmo.` : 'Añade fotos o clips a la pista Principal.', n ? 'ok' : 'warn');
    });
    $('#gDel')?.addEventListener('click', () => {
      app.commit((P) => { const gid = P.tracks.find((t) => t.guide).id; P.clips = P.clips.filter((c) => c.trackId !== gid); P.markers = P.markers.filter((m) => !m.beat); });
      rerender();
    });
  }

  // ---------------- TEXTO ----------------
  function renderText(el) {
    el.innerHTML = `<h3>Textos</h3><p class="sub">Clic para añadirlo en el cabezal. Edítalo en el panel derecho.</p>
      <div class="style-grid">${TEXT_STYLES.map((s) => `<button class="style-card" data-id="${s.id}" style="${styleCss(s.s)}"><span>${esc(s.name)}</span></button>`).join('')}</div>`;
    el.querySelectorAll('.style-card').forEach((b) => b.addEventListener('click', () => {
      const st = TEXT_STYLES.find((s) => s.id === b.dataset.id);
      const tr = app.P.tracks.find((t) => t.type === 'text');
      const c = makeClip('text', tr.id, app.player.t, 3, { text: { ...st.s, content: st.id === 'lower' ? 'Tu nombre\nTu cargo' : 'Escribe aquí' } });
      if (st.id === 'lower') { c.transform.x = -0.18; c.transform.y = 0.3; }
      app.commit((P) => P.clips.push(c));
      app.select(c.id);
      setTimeout(() => document.querySelector('#inspector textarea')?.select(), 50);
    }));
  }
  function styleCss(s) {
    const bg = s.bg === 'box' || s.bg === 'pill' ? `background:${s.bgColor};` : '';
    return `font-family:'${s.font}',Inter,sans-serif;font-weight:${s.weight};${s.italic ? 'font-style:italic;' : ''}${s.upper ? 'text-transform:uppercase;' : ''}color:${s.color || '#fff'};${bg}${s.strokeW ? `-webkit-text-stroke:${Math.min(2, s.strokeW * 12)}px ${s.stroke};paint-order:stroke fill;` : ''}${s.shadow > 1 ? `text-shadow:0 0 12px ${s.color};` : ''}`;
  }

  // ---------------- SUBTÍTULOS ----------------
  async function generateCaptions(statusId = 'cStat', quiet = false) {
    if (capBusy) return false;
    const hasVoice = app.P.clips.some((c) => (c.kind === 'video' || c.kind === 'audio') && media.get(c.mediaId)?.audio && !app.P.tracks.find((t) => t.id === c.trackId)?.music);
    if (!hasVoice) { app.toast('No hay audio de voz para transcribir.', 'warn'); return false; }
    capBusy = true;
    const set = (t) => { capStatus = t; const e = document.getElementById(statusId); if (e) e.innerHTML = t; if (statusId !== 'cStat') { const c2 = document.getElementById('cStat'); if (c2) c2.innerHTML = t; } };
    try {
      const vm = voiceMedia(app.P);
      if (vm.length && vm.every((m) => app.P.transcripts?.[m.id])) {
        // Ya hay transcripción: no hace falta volver a pasar Whisper
        const words = timelineWords(app.P);
        const clips = buildCaptionClips(app.P, words, { maxWords: prefs.capWords, styleId: prefs.capStyle, emojis: prefs.capEmoji, pos: prefs.capPos });
        if (!quiet) app.history.push(app.P);
        app.P.clips = app.P.clips.filter((c) => c.kind !== 'caption').concat(clips);
        app.refresh();
        set(`✓ ${clips.length} subtítulos desde la transcripción guardada`);
        return true;
      }
      set('Preparando el audio…');
      const audio = await voiceAudio(app.P);
      const files = {};
      const res = await transcribe(audio, { model: prefs.capModel, language: prefs.capLang }, (m) => {
        if (m.type === 'status') set(m.text);
        if (m.type === 'progress' && m.total) {
          files[m.file] = [m.loaded, m.total];
          const [l, t] = Object.values(files).reduce((a, [x, y]) => [a[0] + x, a[1] + y], [0, 0]);
          set(`Descargando modelo (sólo la primera vez)… ${Math.round((l / t) * 100)}% · ${(t / 1048576).toFixed(0)} MB`);
        }
      });
      const words = toWords(res);
      if (!words.length) throw new Error('No se detectó voz.');
      const clips = buildCaptionClips(app.P, words, { maxWords: prefs.capWords, styleId: prefs.capStyle, emojis: prefs.capEmoji, pos: prefs.capPos });
      if (!quiet) app.history.push(app.P);
      app.P.clips = app.P.clips.filter((c) => c.kind !== 'caption').concat(clips);
      app.refresh();
      set(`✓ ${clips.length} subtítulos · ${words.length} palabras${res.words ? '' : ' (tiempos aproximados)'} · ${res.device === 'webgpu' ? 'GPU' : 'CPU'}`);
      if (!quiet) app.toast(`🎙 ${clips.length} subtítulos generados.`, 'ok');
      return true;
    } catch (e) {
      console.error(e);
      set(`⚠ ${esc(e.message)}. Necesitas conexión a internet la primera vez para descargar el modelo.`);
      app.toast('No se pudieron generar los subtítulos: ' + esc(e.message), 'err', 8000);
      return false;
    } finally { capBusy = false; app.renderPanel?.('captions'); }
  }

  function renderCaptions(el) {
    const caps = app.P.clips.filter((c) => c.kind === 'caption').sort((a, b) => a.start - b.start);
    el.innerHTML = `<h3>Subtítulos automáticos</h3>
      <p class="sub">Whisper corre en tu equipo: sin créditos y sin subir tu audio.</p>
      <div class="field wide"><label>Idioma</label><select id="cLang">${LANGS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>
      <div class="field wide"><label>Precisión</label><select id="cModel">${MODELS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>
      <div class="field wide"><label>Palabras</label><div class="chips" id="cWords">${[[1, '1 (TikTok)'], [2, '2'], [3, '3'], [5, '5'], [8, 'Frase']].map(([v, l]) => `<button class="chip${prefs.capWords === v ? ' on' : ''}" data-v="${v}">${l}</button>`).join('')}</div></div>
      <div class="field wide"><label>Posición</label><div class="chips" id="cPos">${[['high', 'Arriba'], ['mid', 'Centro'], ['low', 'Abajo']].map(([v, l]) => `<button class="chip${prefs.capPos === v ? ' on' : ''}" data-v="${v}">${l}</button>`).join('')}</div></div>
      <div class="field wide"><label>Emojis</label><label class="switch"><input type="checkbox" id="cEmoji"${prefs.capEmoji ? ' checked' : ''}><i></i></label></div>
      <h3 style="margin-top:14px">Estilo</h3>
      <div class="cap-styles">${CAPTION_STYLES.map((s) => `<button class="cap-card${prefs.capStyle === s.id ? ' on' : ''}" data-id="${s.id}"><span style="${styleCss(s.s)}">ESTO ES <em style="color:${s.s.hlBox ? '#fff' : s.s.highlight};${s.s.hlBox ? `background:${s.s.highlight};padding:0 4px;border-radius:4px;` : ''}font-style:normal">VIRAL</em></span><small>${s.name}</small></button>`).join('')}</div>
      <button class="btn primary wide" id="cGo"${capBusy ? ' disabled' : ''}>🎙 ${caps.length ? 'Volver a generar' : 'Generar subtítulos'}</button>
      <div class="vstatus" id="cStat">${capStatus}</div>
      <div class="row" style="margin-top:8px"><button class="btn small" id="cSrt">Importar SRT</button>${caps.length ? '<button class="btn small ghost" id="cClear">Borrar todos</button>' : ''}</div>
      ${caps.length ? `<h3 style="margin-top:16px">Editar (${caps.length})</h3><div class="cap-list">${caps.map((c) => `
        <div class="cap-line" data-id="${c.id}"><button class="cap-t" title="Ir">${fmtTime(c.start)}</button><input value="${esc(c.words?.length ? c.words.map((w) => w.w).join(' ') : c.text.content)}"></div>`).join('')}</div>` : ''}
      <input type="file" id="srtIn" accept=".srt,.vtt" hidden>`;
    const $ = (s) => el.querySelector(s);
    $('#cLang').value = prefs.capLang; $('#cModel').value = prefs.capModel;
    $('#cLang').addEventListener('change', (e) => (prefs.capLang = e.target.value));
    $('#cModel').addEventListener('change', (e) => (prefs.capModel = e.target.value));
    $('#cWords').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) { prefs.capWords = +b.dataset.v; renderCaptions(el); } });
    $('#cPos').addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]'); if (!b) return;
      prefs.capPos = b.dataset.v;
      const y = prefs.capPos === 'high' ? -0.28 : prefs.capPos === 'mid' ? 0.04 : 0.2;
      if (caps.length) app.commit((P) => P.clips.forEach((c) => { if (c.kind === 'caption') c.transform.y = y; }));
      renderCaptions(el);
    });
    $('#cEmoji').addEventListener('change', (e) => (prefs.capEmoji = e.target.checked));
    el.querySelectorAll('.cap-card').forEach((b) => b.addEventListener('click', () => {
      prefs.capStyle = b.dataset.id;
      if (caps.length) app.commit((P) => applyCaptionStyle(P, prefs.capStyle));
      renderCaptions(el);
    }));
    $('#cGo').addEventListener('click', () => generateCaptions('cStat'));
    $('#cSrt').addEventListener('click', () => $('#srtIn').click());
    $('#srtIn').addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      const segs = parseSRT(await f.text());
      app.commit((P) => { P.clips = P.clips.filter((c) => c.kind !== 'caption').concat(captionClipsFromSegments(segs, prefs.capStyle, prefs.capPos)); });
      app.toast(`${segs.length} subtítulos importados.`, 'ok');
      renderCaptions(el);
    });
    $('#cClear')?.addEventListener('click', () => { app.commit((P) => (P.clips = P.clips.filter((c) => c.kind !== 'caption'))); renderCaptions(el); });
    el.querySelectorAll('.cap-line').forEach((row) => {
      const c = app.P.clips.find((x) => x.id === row.dataset.id);
      row.querySelector('.cap-t').addEventListener('click', () => { app.player.seek(c.start + 0.01); app.select(c.id); });
      const inp = row.querySelector('input');
      inp.addEventListener('focus', () => { app.player.seek(c.start + 0.01); });
      inp.addEventListener('change', () => {
        app.commit(() => {
          const cc = app.P.clips.find((x) => x.id === row.dataset.id);
          const ws = inp.value.trim().split(/\s+/);
          if (cc.words?.length === ws.length) cc.words.forEach((w, i) => (w.w = ws[i]));
          else retimeCaption(cc, inp.value);
          cc.text.content = inp.value;
        });
      });
    });
  }

  // ---------------- AUDIO ----------------
  function renderAudio(el) {
    const P = app.P;
    const voiceClips = P.clips.filter((c) => (c.kind === 'video' || c.kind === 'audio') && !P.tracks.find((t) => t.id === c.trackId)?.music);
    const allEnh = voiceClips.length && voiceClips.every((c) => c.enhance);
    el.innerHTML = `<h3>Audio</h3>
      <div class="tool"><div class="tool-h"><b>🎙 Voz clara</b><span class="sub">Quita graves que retumban, da presencia y nivela la voz</span></div>
        <div class="row"><label class="switch"><input type="checkbox" id="aEnh"${allEnh ? ' checked' : ''}><i></i></label><span class="sub">${voiceClips.length} clips con voz</span></div></div>
      <div class="tool"><div class="tool-h"><b>📢 Volumen para redes</b><span class="sub">Ajusta todo a ≈ −14 LUFS, el nivel que usan TikTok, YouTube e Instagram</span></div>
        <div class="row"><button class="btn small" id="aNorm">Normalizar</button><span class="sub" id="aNormInfo"></span></div></div>
      <div class="tool"><div class="tool-h"><b>🎵 Bajar música al hablar</b><span class="sub">Ducking automático en la pista Música</span></div>
        <div class="row"><label class="switch"><input type="checkbox" id="aDuck"${P.autoDuck ? ' checked' : ''}><i></i></label>
        <input type="range" id="aDuckAmt" min="0.05" max="0.8" step="0.01" value="${P.duckAmount}" style="flex:1"><output id="aDuckOut">${pct(P.duckAmount)}</output></div></div>
      <div class="tool"><div class="tool-h"><b>🔊 Volumen general</b></div>
        <div class="row"><input type="range" id="aMaster" min="0" max="3" step="0.01" value="${P.masterGain}" style="flex:1"><output id="aMasterOut">${pct(P.masterGain)}</output></div></div>
      <div class="tool guide-tool"><div class="tool-h"><b>🎵 Sonido viral de TikTok</b><span class="sub">Cuadra tu video al ritmo de un audio en tendencia</span></div><button class="btn small" id="aGuide">Abrir en Viral</button></div>
      <p class="sub">Música: importa tu canción en Medios y se coloca en la pista Música. Volumen, fundidos y velocidad de cada clip están en el panel derecho.</p>`;
    const $ = (s) => el.querySelector(s);
    $('#aGuide').addEventListener('click', () => app.showTab('viral'));
    $('#aEnh').addEventListener('change', (e) => app.commit(() => voiceClips.forEach((c) => (c.enhance = e.target.checked))));
    $('#aNorm').addEventListener('click', async () => {
      $('#aNormInfo').textContent = 'Midiendo…';
      app.history.push(app.P);
      const r = await normalizeLoudness(app.P);
      app.refresh();
      $('#aNormInfo').textContent = r.db > -99 ? `Antes ${r.db.toFixed(1)} dB RMS → ganancia ${pct(r.gain)}` : 'No hay audio.';
      $('#aMaster').value = app.P.masterGain; $('#aMasterOut').textContent = pct(app.P.masterGain);
    });
    $('#aDuck').addEventListener('change', (e) => app.commit((P) => (P.autoDuck = e.target.checked)));
    $('#aDuckAmt').addEventListener('input', (e) => { app.P.duckAmount = +e.target.value; $('#aDuckOut').textContent = pct(+e.target.value); app.player.invalidate(); });
    $('#aDuckAmt').addEventListener('pointerdown', () => app.beginEdit());
    $('#aDuckAmt').addEventListener('change', () => app.endEdit());
    $('#aMaster').addEventListener('input', (e) => { app.P.masterGain = +e.target.value; $('#aMasterOut').textContent = pct(+e.target.value); app.player.invalidate(); });
    $('#aMaster').addEventListener('pointerdown', () => app.beginEdit());
    $('#aMaster').addEventListener('change', () => app.endEdit());
  }

  // ---------------- FILTROS ----------------
  function thumbFor(look, src, ar) {
    const cv = document.createElement('canvas');
    cv.width = 150; cv.height = Math.round(150 / ar);
    if (!src) return cv;
    const fakeP = { width: cv.width, height: cv.height };
    const c = makeClip('image', 'x', 0, 1, {});
    applyLook(c, look.id, prefs.lookK);
    const g = cv.getContext('2d');
    drawClip(g, fakeP, c, 0.5, { frame: () => src });
    return cv;
  }
  function renderFilters(el) {
    const sel = visualTargets();
    const ref = (sel?.[0]) || mainClips().find((c) => c.kind === 'video' || c.kind === 'image');
    const m = ref && media.get(ref.mediaId);
    const ar = 1;
    el.innerHTML = `<h3>Filtros</h3>
      <p class="sub">${sel ? `Se aplica a ${sel.length} clip${sel.length > 1 ? 's' : ''} seleccionado${sel.length > 1 ? 's' : ''}.` : 'Sin selección: se aplica a todos los clips.'}</p>
      <div class="row" style="margin-bottom:10px"><button class="btn small" id="fAuto">✨ Auto-color</button><span class="sub">Intensidad</span><input type="range" id="fK" min="0.2" max="1.5" step="0.05" value="${prefs.lookK}" style="flex:1"></div>
      <div class="look-grid" id="lookGrid"></div>`;
    const grid = el.querySelector('#lookGrid');
    const draw = (img) => {
      grid.innerHTML = '';
      for (const look of LOOKS) {
        const b = document.createElement('button');
        b.className = 'look' + (ref?.color?.preset === look.id ? ' on' : '');
        b.appendChild(thumbFor(look, img, ar));
        const s = document.createElement('span'); s.textContent = look.name; b.appendChild(s);
        b.addEventListener('click', () => {
          const targets = sel || app.P.clips.filter((c) => c.kind === 'video' || c.kind === 'image' || c.kind === 'solid');
          app.commit(() => targets.forEach((c) => applyLook(c, look.id, prefs.lookK)));
          renderFilters(el);
        });
        grid.appendChild(b);
      }
    };
    if (m?.thumb) {
      if (!m.thumbImg) { m.thumbImg = new Image(); m.thumbImg.src = m.thumb; }
      if (m.thumbImg.complete) draw(m.thumbImg); else m.thumbImg.onload = () => draw(m.thumbImg);
    } else draw(null);
    el.querySelector('#fK').addEventListener('change', (e) => {
      prefs.lookK = +e.target.value;
      const targets = sel || app.P.clips.filter((c) => c.kind === 'video' || c.kind === 'image');
      app.commit(() => targets.forEach((c) => { if (c.color?.preset && c.color.preset !== 'auto' && c.color.preset !== 'none') applyLook(c, c.color.preset, prefs.lookK); }));
      renderFilters(el);
    });
    el.querySelector('#fAuto').addEventListener('click', () => {
      const targets = sel || app.P.clips.filter((c) => c.kind === 'video' || c.kind === 'image');
      let n = 0;
      app.commit(() => targets.forEach((c) => { if (autoColor(c)) n++; }));
      app.toast(`Auto-color aplicado a ${n} clip${n === 1 ? '' : 's'}.`, 'ok');
    });
  }

  // ---------------- TRANSICIONES ----------------
  function renderTransitions(el) {
    const sel = app.selected().filter((c) => c.kind !== 'audio');
    el.innerHTML = `<h3>Transiciones</h3>
      <p class="sub">${sel.length ? 'Se aplica a la entrada del clip seleccionado.' : 'Selecciona un clip, o aplícala a todos los cortes.'}</p>
      <div class="row" style="margin-bottom:10px"><span class="sub">Duración</span><input type="range" id="tDur" min="0.1" max="2" step="0.05" value="${prefs.transDur}" style="flex:1"><output id="tDurO">${prefs.transDur.toFixed(2)}s</output></div>
      <div class="trans-grid">${TRANSITIONS.map((t) => `<button class="trans${sel[0]?.trans?.type === t.id ? ' on' : ''}" data-id="${t.id}"><i class="tg tg-${t.id}"></i><span>${t.name}</span></button>`).join('')}</div>
      <button class="btn wide" id="tAll" style="margin-top:12px">Aplicar la última a todos los cortes</button>`;
    let last = sel[0]?.trans?.type && sel[0].trans.type !== 'none' ? sel[0].trans.type : 'fade';
    el.querySelector('#tDur').addEventListener('input', (e) => { prefs.transDur = +e.target.value; el.querySelector('#tDurO').textContent = prefs.transDur.toFixed(2) + 's'; });
    el.querySelector('#tDur').addEventListener('change', () => { if (sel.length) app.commit(() => sel.forEach((c) => (c.trans.dur = Math.min(prefs.transDur, c.dur)))); });
    el.querySelectorAll('.trans').forEach((b) => b.addEventListener('click', () => {
      last = b.dataset.id;
      if (!sel.length) { app.toast('Selecciona un clip en la línea de tiempo, o usa «Aplicar a todos los cortes».'); return; }
      app.commit(() => sel.forEach((c) => (c.trans = { type: last, dur: Math.min(prefs.transDur, c.dur) })));
      const c = sel[0];
      app.player.seek(Math.max(0, c.start - 0.4));
      app.player.loopRange = [Math.max(0, c.start - 0.6), c.start + c.trans.dur + 0.6];
      app.player.play();
      setTimeout(() => { app.player.loopRange = null; }, 2500);
      renderTransitions(el);
    }));
    el.querySelector('#tAll').addEventListener('click', () => {
      let n = 0;
      app.commit((P) => {
        for (const tr of P.tracks) {
          if (tr.type !== 'video') continue;
          const list = clipsOnTrack(P, tr.id);
          for (let i = 1; i < list.length; i++) if (Math.abs(clipEnd(list[i - 1]) - list[i].start) < 0.05) { list[i].trans = { type: last, dur: Math.min(prefs.transDur, list[i].dur) }; n++; }
        }
      });
      app.toast(n ? `Transición en ${n} cortes.` : 'No hay cortes entre clips pegados.', n ? 'ok' : 'warn');
    });
  }

  return {
    viral: { label: 'Viral', icon: '✦', render: renderViral },
    text: { label: 'Texto', icon: 'T', render: renderText },
    captions: { label: 'Subtítulos', icon: '≡', render: renderCaptions },
    audio: { label: 'Audio', icon: '♫', render: renderAudio },
    filters: { label: 'Filtros', icon: 'Fx', render: renderFilters },
    transitions: { label: 'Transic.', icon: '⟡', render: renderTransitions },
    generateCaptions,
  };
}

export { DEFAULT_COLOR, projectDuration };
