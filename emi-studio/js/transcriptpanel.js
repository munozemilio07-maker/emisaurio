// Panel «Transcripción»: edita el video como un documento de texto.
import { fmtTime } from './state.js';
import { LANGS, MODELS, buildCaptionClips } from './captions.js';
import { voiceMedia, transcribeMedia, buildTokens, stats, rangesFor, cutRanges, timelineWords, matchScript, assembleScript } from './textedit.js';
import { esc } from './ui.js';
import { audioPending } from './media.js';

export function createTranscriptPanel(app) {
  const prefs = { lang: 'spanish', model: MODELS[0][0], clean: { filler: true, repeat: true, sound: false, pause: true, maybe: false }, pauseMin: 0.6, query: '', script: '', matches: null };
  let busy = false, status = '', tokens = [], el = null, nowEl = null;

  app.player.on((t) => {
    if (!el || el.hidden || !tokens.length) return;
    const i = tokens.findIndex((k) => k.t0 != null && t >= k.t0 && t < k.t1);
    const span = i >= 0 ? el.querySelector(`[data-i="${i}"]`) : null;
    if (span === nowEl) return;
    nowEl?.classList.remove('now');
    nowEl = span;
    if (span) {
      span.classList.add('now');
      if (app.player.playing) {
        const box = el.querySelector('.tx');
        const r = span.offsetTop - box.offsetTop;
        if (r < box.scrollTop || r > box.scrollTop + box.clientHeight - 40) box.scrollTop = r - 60;
      }
    }
  });

  async function transcribeAll() {
    if (busy) return;
    const list = voiceMedia(app.P).filter((m) => !app.P.transcripts?.[m.id]);
    if (!list.length) { app.toast('Todo lo que suena en tu pista de voz ya está transcrito.'); return; }
    busy = true;
    const t0 = Date.now();
    const set = (t) => { status = t + ` · ${Math.round((Date.now() - t0) / 1000)} s`; const s = el?.querySelector('#txStat'); if (s) s.innerHTML = status; };
    const tick = setInterval(() => { const s = el?.querySelector('#txStat'); if (s && busy) s.innerHTML = status.replace(/ · \d+ s$/, '') + ` · ${Math.round((Date.now() - t0) / 1000)} s (en CPU tarda más o menos lo que dura el audio)`; }, 1000);
    app.history.push(app.P);
    try {
      for (let k = 0; k < list.length; k++) {
        const m = list[k];
        const files = {};
        set(`(${k + 1}/${list.length}) Preparando ${esc(m.name)}…`);
        await transcribeMedia(app.P, m, { model: prefs.model, language: prefs.lang }, (msg) => {
          if (msg.type === 'status') set(`(${k + 1}/${list.length}) ${msg.text}`);
          if (msg.type === 'progress' && msg.total) {
            files[msg.file] = [msg.loaded, msg.total];
            const [l, t] = Object.values(files).reduce((a, [x, y]) => [a[0] + x, a[1] + y], [0, 0]);
            set(`Descargando modelo (sólo la primera vez)… ${Math.round((l / t) * 100)}%`);
          }
        });
      }
      const dev = Object.values(app.P.transcripts || {}).map((t) => t.device).filter(Boolean).pop();
      status = `✓ Transcripción lista (${dev === 'webgpu' ? 'con la GPU' : 'con la CPU'}). Selecciona palabras y pulsa Supr para cortarlas.`;
      app.refresh();
      app.toast('¶ Transcripción lista.', 'ok');
    } catch (e) {
      console.error(e);
      status = `⚠ ${esc(e.message)}. La primera vez necesitas internet para descargar el modelo.`;
      app.toast('No se pudo transcribir: ' + esc(e.message), 'err', 8000);
    } finally { clearInterval(tick); busy = false; render(el); }
  }

  function picked(st) {
    const out = [];
    for (const k of ['filler', 'maybe', 'repeat', 'sound', 'pause']) if (prefs.clean[k]) out.push(...st[k]);
    return out;
  }

  function render(root) {
    el = root;
    nowEl = null;
    const P = app.P;
    const vm = voiceMedia(P);
    const pending = vm.filter((m) => !P.transcripts?.[m.id]);
    const analyzing = audioPending(P);
    const isMusic = (c) => { const t = P.tracks.find((x) => x.id === c.trackId); return t?.music && !t.guide; };
    const musicAudio = P.clips.filter((c) => c.kind === 'audio' && isMusic(c));
    const shownStatus = analyzing.length ? `Analizando el audio de ${analyzing.map((m) => esc(m.name)).join(', ')}…` : status;
    tokens = buildTokens(P);
    const st = stats(tokens, prefs.pauseMin);
    const toCut = new Set(picked(st));
    const save = rangesFor(tokens, [...toCut]).reduce((a, [x, y]) => a + y - x, 0);
    const q = prefs.query.trim().toLowerCase();
    let hits = 0;
    const html = tokens.map((t, i) => {
      if (t.type === 'br') return '<span class="tbr"></span>';
      if (t.type === 'pause') return `<span class="tp${toCut.has(t) ? ' cut' : ''}" data-i="${i}" title="Pausa">⏸ ${(t.t1 - t.t0).toFixed(1)}s</span>`;
      if (t.type === 'sound') return `<span class="ts${toCut.has(t) ? ' cut' : ''}" data-i="${i}" title="Sonido sin palabra (eh, mmm…)">〰 ${(t.t1 - t.t0).toFixed(1)}s</span>`;
      const hit = q && t.w.toLowerCase().includes(q);
      if (hit) hits++;
      return `<span class="tw${t.cat ? ' c-' + t.cat : ''}${toCut.has(t) ? ' cut' : ''}${hit ? ' hit' : ''}" data-i="${i}">${esc(t.w)}</span>`;
    }).join(' ');

    root.innerHTML = `<h3 class="sec-h"><span>Editar con el texto</span><button class="btn tiny" id="txWide" title="Más espacio para leer">${document.querySelector('.workspace').classList.contains('wide-left') ? '⤡ Reducir' : '⤢ Ampliar'}</button></h3>
      <p class="sub">Borra palabras de la transcripción y el video se corta solo, como en Descript o Premiere.</p>
      ${vm.length === 0 ? `<div class="tool"><b>Primero añade un video o audio donde hables</b><span class="sub">Debe estar en la pista Principal o en Voz / Audio.</span>${musicAudio.length ? '<button class="btn small" id="txMoveVoice">Mover el audio de Música a Voz</button>' : ''}</div>` : ''}
      ${pending.length ? `
        <div class="tool">
          <div class="field wide"><label>Idioma</label><select id="txLang">${LANGS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>
          <div class="field wide"><label>Precisión</label><select id="txModel">${MODELS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>
          <label class="chk"><input type="checkbox" id="txCpu"${(() => { try { return localStorage.getItem('emi.cpu') === '1'; } catch { return false; } })() ? ' checked' : ''}><span>Sólo CPU (más lento; úsalo si con la GPU sale texto raro o se traba)</span></label>
          <button class="btn primary wide" id="txGo"${busy || analyzing.length ? ' disabled' : ''}>¶ Transcribir ${pending.length} archivo${pending.length > 1 ? 's' : ''}</button>
        </div>` : ''}
      <div class="vstatus" id="txStat">${shownStatus}</div>
      ${tokens.length ? `
        <div class="tx-tools">
          <input type="search" id="txFind" placeholder="Buscar en lo que dices…" value="${esc(prefs.query)}">
          <span class="sub">${q ? `${hits} resultado${hits === 1 ? '' : 's'}` : ''}</span>
        </div>
        <div class="tx" tabindex="0" aria-label="Transcripción editable">${html}</div>
        <div class="row tx-actions">
          <button class="btn small" id="txCut">✂ Cortar selección <kbd>Supr</kbd></button>
          <button class="btn small" id="txCaps">≡ Subtítulos desde el texto</button>
          <button class="btn small ghost" id="txRedo" title="Vuelve a transcribir todo">↻ Transcribir de nuevo</button>
        </div>
        <div class="tool clean-tool">
          <div class="tool-h"><b>✨ Limpieza automática</b><span class="sub">Lo tachado en el texto es lo que se cortará</span></div>
          <div class="checks">
            ${[['filler', 'Muletillas (eh, em, mmm, um)'], ['sound', 'Sonidos sin palabra (revisa antes: puede incluir voz real)'], ['repeat', 'Palabras repetidas'], ['pause', `Pausas de más de ${prefs.pauseMin}s → 0.25s`], ['maybe', 'Posibles muletillas (este, o sea, pues, tipo…)']]
              .map(([k, l]) => `<label class="chk"><input type="checkbox" data-k="${k}"${prefs.clean[k] ? ' checked' : ''}><span class="dot d-${k}"></span><span>${l} <b>${st[k].length}</b></span></label>`).join('')}
          </div>
          <button class="btn primary wide" id="txClean"${toCut.size ? '' : ' disabled'}>Limpiar ${toCut.size} cosas · −${save.toFixed(1)} s</button>
        </div>
        <details class="script-box"${prefs.matches ? ' open' : ''}>
          <summary><b>🎬 Armar el video desde un guion</b></summary>
          <p class="sub">Pega tu guion. Busco cada frase en tus tomas (la más reciente gana) y las pongo en orden.</p>
          <textarea id="txScript" rows="5" placeholder="Pega aquí tu guion, una frase por línea…">${esc(prefs.script)}</textarea>
          <div class="row"><button class="btn small" id="txMatch">Buscar tomas</button>${prefs.matches?.some((m) => m.match) ? '<button class="btn small primary-lite" id="txBuild">Armar video</button>' : ''}</div>
          ${prefs.matches ? `<ol class="match-list">${prefs.matches.map((m) => `<li class="${m.match ? 'ok' : 'no'}">${m.match ? '✓' : '✗'} ${esc(m.text)} ${m.match ? `<small>${fmtTime(m.match.s)}–${fmtTime(m.match.e)} · ${Math.min(100, Math.round(m.match.score * 100))}%</small>` : '<small>no encontrada</small>'}</li>`).join('')}</ol>` : ''}
        </details>` : ''}`;

    const $ = (s) => root.querySelector(s);
    if ($('#txLang')) { $('#txLang').value = prefs.lang; $('#txLang').onchange = (e) => (prefs.lang = e.target.value); }
    if ($('#txModel')) { $('#txModel').value = prefs.model; $('#txModel').onchange = (e) => (prefs.model = e.target.value); }
    $('#txGo')?.addEventListener('click', transcribeAll);
    $('#txCpu')?.addEventListener('change', (e) => { try { localStorage.setItem('emi.cpu', e.target.checked ? '1' : '0'); } catch {} });
    $('#txMoveVoice')?.addEventListener('click', () => {
      const voice = app.P.tracks.find((t) => t.type === 'audio' && !t.music && !t.guide && !t.sfx);
      app.commit(() => musicAudio.forEach((c) => (c.trackId = voice.id)));
      app.toast('Audio movido a la pista Voz / Audio. Ya puedes transcribirlo.', 'ok');
    });
    $('#txWide').addEventListener('click', () => { document.querySelector('.workspace').classList.toggle('wide-left'); app.player.resize(); render(root); });
    root.querySelectorAll('.clean-tool input[data-k]').forEach((i) => i.addEventListener('change', () => { prefs.clean[i.dataset.k] = i.checked; render(root); }));
    $('#txClean')?.addEventListener('click', () => {
      const ranges = rangesFor(tokens, picked(stats(tokens, prefs.pauseMin)));
      let total = 0;
      app.commit((P) => (total = cutRanges(P, ranges)));
      app.toast(`✨ Limpio: ${ranges.length} cortes, ${total.toFixed(1)} s menos. Ctrl+Z para deshacer.`, 'ok', 5000);
    });
    const find = $('#txFind');
    find?.addEventListener('input', () => {
      prefs.query = find.value;
      const pos = find.selectionStart;
      render(root);
      const f2 = root.querySelector('#txFind'); f2.focus(); f2.setSelectionRange(pos, pos);
    });
    find?.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const all = [...root.querySelectorAll('.tw.hit')];
      if (!all.length) return;
      const t = app.player.t;
      const next = all.map((s) => tokens[+s.dataset.i]).find((k) => k.t0 > t + 0.05) || tokens[+all[0].dataset.i];
      app.player.seek(next.t0 + 0.001);
    });
    const tx = $('.tx');
    if (tx) {
      tx.addEventListener('click', (e) => {
        const s = e.target.closest('[data-i]');
        if (!s || !window.getSelection().isCollapsed) return;
        const t = tokens[+s.dataset.i];
        app.player.seek(t.t0 + 0.001);
      });
      tx.addEventListener('keydown', (e) => {
        if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); e.stopPropagation(); cutSelection(); }
        else if (e.key === ' ') { e.preventDefault(); e.stopPropagation(); app.player.toggle(); }
      });
    }
    $('#txCut')?.addEventListener('click', cutSelection);
    $('#txCaps')?.addEventListener('click', () => {
      const words = timelineWords(app.P);
      if (!words.length) return;
      app.commit((P) => { P.clips = P.clips.filter((c) => c.kind !== 'caption').concat(buildCaptionClips(P, words, { maxWords: 3, styleId: 'hormozi', emojis: true, pos: 'low' })); });
      app.toast('≡ Subtítulos creados desde la transcripción (sin volver a transcribir). Cambia el estilo en Subtítulos.', 'ok', 5000);
    });
    $('#txRedo')?.addEventListener('click', () => { app.history.push(app.P); for (const m of voiceMedia(app.P)) delete app.P.transcripts[m.id]; render(root); transcribeAll(); });
    $('#txScript')?.addEventListener('input', (e) => (prefs.script = e.target.value));
    $('#txMatch')?.addEventListener('click', () => {
      if (!prefs.script.trim()) return app.toast('Pega primero tu guion.');
      prefs.matches = matchScript(app.P, prefs.script);
      const ok = prefs.matches.filter((m) => m.match).length;
      app.toast(`Encontré ${ok} de ${prefs.matches.length} frases.`, ok ? 'ok' : 'warn');
      render(root);
    });
    $('#txBuild')?.addEventListener('click', () => {
      let d = 0;
      app.commit((P) => (d = assembleScript(P, prefs.matches)));
      app.toast(`🎬 Video armado desde el guion: ${fmtTime(d)}. Ctrl+Z para volver.`, 'ok', 5000);
      prefs.matches = null;
      app.timeline.zoomFit();
    });
  }

  function cutSelection() {
    const sel = window.getSelection();
    const tx = el?.querySelector('.tx');
    if (!tx || sel.isCollapsed) { app.toast('Selecciona con el ratón las palabras que quieres cortar.'); return; }
    const picked = [...tx.querySelectorAll('[data-i]')].filter((s) => sel.containsNode(s, true)).map((s) => tokens[+s.dataset.i]);
    if (!picked.length) return;
    const ranges = rangesFor(tokens, picked);
    let total = 0;
    app.commit((P) => (total = cutRanges(P, ranges)));
    sel.removeAllRanges();
    app.toast(`✂ Cortado ${total.toFixed(1)} s.`, 'ok', 2500);
  }

  return { label: 'Transcr.', icon: '¶', render };
}
