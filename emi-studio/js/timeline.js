// Línea de tiempo: pistas, clips, recorte, movimiento con imán, regla y cabezal.
import { clipEnd, clipsOnTrack, projectDuration, fmtTime, clamp } from './state.js';
import { media } from './media.js';

const HEAD_W = 150;
const ICON = { video: '▣', audio: '♫', text: 'T', caption: '≡' };

export class Timeline {
  constructor(root, app) {
    this.root = root; this.app = app;
    this.pps = 70; // píxeles por segundo
    this.snap = true;
    root.innerHTML = `
      <div class="tl-scroll" tabindex="-1">
        <div class="tl-content">
          <div class="tl-row tl-ruler-row"><div class="tl-head tl-corner"><span class="tl-time">00:00.0</span></div><div class="tl-ruler"><canvas></canvas></div></div>
          <div class="tl-rows"></div>
          <div class="tl-playhead"><div class="tl-playhead-knob"></div></div>
        </div>
      </div>`;
    this.scroll = root.querySelector('.tl-scroll');
    this.content = root.querySelector('.tl-content');
    this.rows = root.querySelector('.tl-rows');
    this.ruler = root.querySelector('.tl-ruler canvas');
    this.playhead = root.querySelector('.tl-playhead');
    this.timeLabel = root.querySelector('.tl-time');
    this.bindRuler();
    this.scroll.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const rect = this.scroll.getBoundingClientRect();
        const x = e.clientX - rect.left - HEAD_W + this.scroll.scrollLeft;
        const tAt = x / this.pps;
        this.setZoom(this.pps * (e.deltaY < 0 ? 1.15 : 1 / 1.15));
        this.scroll.scrollLeft = tAt * this.pps - (e.clientX - rect.left - HEAD_W);
      }
    }, { passive: false });
    this.scroll.addEventListener('scroll', () => this.drawRuler());
    new ResizeObserver(() => this.drawRuler()).observe(this.scroll);
  }

  setZoom(pps) { this.pps = clamp(pps, 8, 600); this.render(); this.app.onZoom?.(this.pps); }
  zoomFit() {
    const d = Math.max(5, projectDuration(this.app.P));
    this.setZoom((this.scroll.clientWidth - HEAD_W - 40) / d);
  }

  totalWidth() {
    const d = Math.max(projectDuration(this.app.P) + 30, (this.scroll.clientWidth - HEAD_W) / this.pps + 5);
    return d * this.pps;
  }

  render() {
    const P = this.app.P;
    const W = this.totalWidth();
    this.content.style.width = HEAD_W + W + 'px';
    this.rows.innerHTML = '';
    for (const tr of P.tracks) {
      const row = document.createElement('div');
      row.className = `tl-row tl-track type-${tr.type}${tr.hidden ? ' is-hidden' : ''}${tr.muted ? ' is-muted' : ''}${tr.locked ? ' is-locked' : ''}`;
      row.dataset.track = tr.id;
      const canHide = tr.type !== 'audio', canMute = tr.type === 'audio' || tr.type === 'video';
      row.innerHTML = `
        <div class="tl-head">
          <span class="tl-ico">${ICON[tr.type]}</span>
          <span class="tl-name" title="${tr.name}">${tr.name}</span>
          <span class="tl-btns">
            ${canHide ? `<button data-act="hide" title="Ocultar">${tr.hidden ? '◌' : '◉'}</button>` : ''}
            ${canMute ? `<button data-act="mute" title="Silenciar">${tr.muted ? '🔇' : '🔊'}</button>` : ''}
            <button data-act="lock" title="Bloquear">${tr.locked ? '🔒' : '🔓'}</button>
          </span>
        </div>
        <div class="tl-lane" style="width:${W}px"></div>`;
      row.querySelectorAll('.tl-btns button').forEach((b) => b.addEventListener('click', (e) => {
        e.stopPropagation();
        const act = b.dataset.act;
        this.app.commit(() => {
          if (act === 'hide') tr.hidden = !tr.hidden;
          if (act === 'mute') tr.muted = !tr.muted;
          if (act === 'lock') tr.locked = !tr.locked;
        });
      }));
      const lane = row.querySelector('.tl-lane');
      this.bindLane(lane, tr);
      for (const c of clipsOnTrack(P, tr.id)) lane.appendChild(this.clipEl(c, tr));
      this.rows.appendChild(row);
    }
    // marcadores
    for (const m of P.markers) {
      const mk = document.createElement('div');
      mk.className = 'tl-marker' + (m.beat ? ' beat' : '');
      mk.style.left = HEAD_W + m.t * this.pps + 'px';
      mk.title = m.label || '';
      this.rows.appendChild(mk);
    }
    this.drawRuler();
    this.updatePlayhead(this.app.player.t);
  }

  clipEl(c, tr) {
    const P = this.app.P;
    const m = media.get(c.mediaId);
    const el = document.createElement('div');
    const sel = this.app.selection.has(c.id);
    el.className = `tl-clip kind-${c.kind}${sel ? ' selected' : ''}${tr.guide ? ' guide' : ''}`;
    el.dataset.id = c.id;
    el.style.left = c.start * this.pps + 'px';
    el.style.width = Math.max(4, c.dur * this.pps) + 'px';
    let label = m ? m.name : c.kind === 'solid' ? 'Fondo' : (c.words?.map((w) => w.w).join(' ') || c.text?.content || '');
    if (c.speed !== 1) label = `${c.speed}× · ` + label;
    if (tr.guide) label = 'GUÍA · no se exporta · ' + label;
    let inner = '';
    if (m?.thumb && (c.kind === 'video' || c.kind === 'image')) inner += `<div class="tl-thumbs" style="background-image:url(${m.thumb})"></div>`;
    if (c.kind === 'solid') inner += `<div class="tl-thumbs" style="background:linear-gradient(90deg,${c.fill[0]},${c.fill[1]})"></div>`;
    inner += `<span class="tl-label">${escapeHtml(label)}</span>`;
    if (c.trans && c.trans.type !== 'none') inner += `<span class="tl-trans" style="width:${c.trans.dur * this.pps}px" title="Transición">⟡</span>`;
    if (c.fadeIn) inner += `<span class="tl-fade in" style="width:${c.fadeIn * this.pps}px"></span>`;
    if (c.fadeOut) inner += `<span class="tl-fade out" style="width:${c.fadeOut * this.pps}px"></span>`;
    inner += `<div class="tl-h l"></div><div class="tl-h r"></div>`;
    el.innerHTML = inner;
    if (m?.peaks && (c.kind === 'audio' || c.kind === 'video')) {
      const cv = document.createElement('canvas');
      cv.className = 'tl-wave';
      const w = Math.min(4000, Math.max(4, Math.round(c.dur * this.pps)));
      cv.width = w; cv.height = 40;
      el.appendChild(cv);
      drawWave(cv, m.peaks, c, tr.muted ? '#666' : tr.guide ? '#f472b6' : c.kind === 'audio' ? (tr.music ? '#34d399' : '#38bdf8') : 'rgba(255,255,255,.55)');
    }
    if (!tr.locked) this.bindClip(el, c);
    return el;
  }

  snapPoints(excludeIds) {
    const P = this.app.P;
    const pts = [0, this.app.player.t];
    for (const c of P.clips) if (!excludeIds.has(c.id)) pts.push(c.start, clipEnd(c));
    for (const m of P.markers) pts.push(m.t);
    return pts;
  }
  snapT(t, pts) {
    if (!this.snap) return t;
    const thr = 8 / this.pps;
    let best = t, bd = thr;
    for (const p of pts) { const d = Math.abs(p - t); if (d < bd) { bd = d; best = p; } }
    return best;
  }

  bindClip(el, c) {
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      const mode = e.target.classList.contains('l') ? 'l' : e.target.classList.contains('r') ? 'r' : 'move';
      if (e.shiftKey || e.metaKey || e.ctrlKey) this.app.toggleSelect(c.id);
      else if (!this.app.selection.has(c.id)) this.app.select(c.id);
      const P = this.app.P;
      const m = media.get(c.mediaId);
      const x0 = e.clientX, y0 = e.clientY;
      const orig = { start: c.start, dur: c.dur, in: c.in, trackId: c.trackId, words: c.words ? c.words.map((w) => ({ ...w })) : null };
      const group = [...this.app.selection].map((id) => P.clips.find((x) => x.id === id)).filter(Boolean);
      const origs = new Map(group.map((g) => [g.id, g.start]));
      const pts = this.snapPoints(new Set(group.map((g) => g.id)));
      let moved = false, snapshotTaken = false;
      const maxSrc = m && (m.type === 'video' || m.type === 'audio') ? m.duration : Infinity;
      const move = (ev) => {
        const dx = (ev.clientX - x0) / this.pps;
        if (!moved && Math.abs(ev.clientX - x0) < 3 && Math.abs(ev.clientY - y0) < 3) return;
        if (!snapshotTaken) { this.app.beginEdit(); snapshotTaken = true; }
        moved = true;
        if (mode === 'move') {
          let ns = Math.max(0, orig.start + dx);
          const s1 = this.snapT(ns, pts), s2 = this.snapT(ns + c.dur, pts) - c.dur;
          ns = Math.abs(s1 - ns) <= Math.abs(s2 - ns) ? s1 : s2;
          const delta = Math.max(-Math.min(...group.map((g) => origs.get(g.id))), ns - orig.start);
          for (const g of group) g.start = origs.get(g.id) + delta;
          // cambio de pista (sólo clip único, tipo compatible)
          if (group.length === 1) {
            const lane = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.tl-row');
            const tr = lane && P.tracks.find((t) => t.id === lane.dataset.track);
            if (tr && !tr.locked && compatible(c, tr)) c.trackId = tr.id;
          }
        } else if (mode === 'l') {
          let ns = this.snapT(orig.start + dx, pts);
          ns = Math.min(ns, orig.start + orig.dur - 0.1);
          ns = Math.max(ns, 0, orig.start - orig.in / c.speed);
          c.start = ns; c.dur = orig.dur - (ns - orig.start); c.in = orig.in + (ns - orig.start) * c.speed;
          if (orig.words) c.words = orig.words.map((w) => ({ ...w, s: w.s - (ns - orig.start), e: w.e - (ns - orig.start) })).filter((w) => w.e > 0);
        } else {
          let ne = this.snapT(orig.start + orig.dur + dx, pts);
          ne = Math.max(ne, orig.start + 0.1);
          ne = Math.min(ne, orig.start + (maxSrc - orig.in) / c.speed);
          c.dur = ne - orig.start;
        }
        this.app.livePreview();
        this.render();
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        if (moved) this.app.endEdit();
        else if (!e.shiftKey && !e.metaKey && !e.ctrlKey) this.app.select(c.id);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
    el.addEventListener('dblclick', () => this.app.player.seek(c.start));
  }

  bindLane(lane, tr) {
    lane.addEventListener('pointerdown', (e) => {
      if (e.target !== lane) return;
      this.app.select(null);
      const x = e.clientX - lane.getBoundingClientRect().left;
      this.app.player.seek(x / this.pps);
    });
    lane.addEventListener('dragover', (e) => { e.preventDefault(); lane.classList.add('drop'); });
    lane.addEventListener('dragleave', () => lane.classList.remove('drop'));
    lane.addEventListener('drop', (e) => {
      e.preventDefault(); lane.classList.remove('drop');
      const id = e.dataTransfer.getData('text/emi-media');
      const x = e.clientX - lane.getBoundingClientRect().left;
      if (id) this.app.addMediaClip(id, tr.id, Math.max(0, x / this.pps));
      else if (e.dataTransfer.files?.length) this.app.importFiles(e.dataTransfer.files, { trackId: tr.id, t: x / this.pps });
    });
  }

  bindRuler() {
    const rr = this.ruler.parentElement;
    rr.addEventListener('pointerdown', (e) => {
      rr.setPointerCapture(e.pointerId);
      const seek = (ev) => {
        const x = ev.clientX - rr.getBoundingClientRect().left + this.scroll.scrollLeft;
        this.app.player.seek(Math.max(0, x / this.pps));
      };
      seek(e);
      const was = this.app.player.playing;
      if (was) this.app.player.pause();
      rr.onpointermove = seek;
      rr.onpointerup = () => { rr.onpointermove = null; rr.onpointerup = null; };
    });
    this.playhead.addEventListener('pointerdown', (e) => {
      this.playhead.setPointerCapture(e.pointerId);
      const mv = (ev) => {
        const x = ev.clientX - this.scroll.getBoundingClientRect().left - HEAD_W + this.scroll.scrollLeft;
        this.app.player.seek(Math.max(0, x / this.pps));
      };
      this.playhead.onpointermove = mv;
      this.playhead.onpointerup = () => { this.playhead.onpointermove = null; };
    });
  }

  drawRuler() {
    const cv = this.ruler;
    const w = this.scroll.clientWidth - HEAD_W, h = 26, dpr = devicePixelRatio || 1;
    if (w <= 0) return;
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    cv.style.transform = `translateX(${this.scroll.scrollLeft}px)`;
    cv.width = w * dpr; cv.height = h * dpr;
    const g = cv.getContext('2d');
    g.scale(dpr, dpr);
    g.clearRect(0, 0, w, h);
    const sl = this.scroll.scrollLeft;
    const steps = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
    const major = steps.find((s) => s * this.pps >= 80) || 600;
    const minor = major / (major >= 1 ? 5 : 2);
    g.font = '10px Inter, system-ui';
    g.fillStyle = 'rgba(255,255,255,.5)';
    g.strokeStyle = 'rgba(255,255,255,.18)';
    const t0 = Math.floor(sl / this.pps / minor) * minor;
    for (let t = t0; t * this.pps - sl < w; t += minor) {
      const x = Math.round(t * this.pps - sl) + 0.5;
      const isMajor = Math.abs(t / major - Math.round(t / major)) < 1e-6;
      g.beginPath(); g.moveTo(x, isMajor ? 10 : 18); g.lineTo(x, h); g.stroke();
      if (isMajor) g.fillText(fmtTime(t).replace(/\.0$/, ''), x + 3, 10);
    }
    const lr = this.app.player.loopRange;
    if (lr) { g.fillStyle = 'rgba(139,92,246,.35)'; g.fillRect(lr[0] * this.pps - sl, 0, (lr[1] - lr[0]) * this.pps, 5); }
  }

  updatePlayhead(t) {
    const x = HEAD_W + t * this.pps;
    this.playhead.style.transform = `translateX(${x}px)`;
    this.timeLabel.textContent = fmtTime(t);
    if (this.app.player.playing) {
      const vis0 = this.scroll.scrollLeft + HEAD_W, vis1 = vis0 + this.scroll.clientWidth - HEAD_W;
      if (x > vis1 - 40 || x < vis0) this.scroll.scrollLeft = x - HEAD_W - 60;
    }
  }
}

function compatible(c, tr) {
  if (c.kind === 'audio') return tr.type === 'audio';
  if (c.kind === 'text') return tr.type === 'text';
  if (c.kind === 'caption') return tr.type === 'caption';
  return tr.type === 'video';
}

function drawWave(cv, peaks, c, color) {
  const g = cv.getContext('2d');
  const w = cv.width, h = cv.height;
  g.fillStyle = color;
  const srcSpan = c.dur * c.speed;
  for (let x = 0; x < w; x++) {
    const st = c.in + (x / w) * srcSpan;
    const v = peaks[Math.floor(st * 50)] || 0;
    const ph = Math.max(1, Math.min(1, v * c.volume) * h);
    g.fillRect(x, (h - ph) / 2, 1, ph);
  }
}

function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m])); }
