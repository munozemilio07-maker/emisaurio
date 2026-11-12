// Motor de vista previa en tiempo real: sincroniza <video>/<audio> por clip y compone en canvas.
import { clipEnd, projectDuration } from './state.js';
import { renderFrame, activeVisuals, sourceTime } from './render.js';
import { audioCtx, clipGainAt, voiceEnvelope, duckGain, voiceChain } from './audio.js';
import { media } from './media.js';

export class Player {
  constructor(canvas, getP) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.getP = getP;
    this.t = 0;
    this.playing = false;
    this.els = new Map();
    this.listeners = new Set();
    this.loopRange = null;
    this.venv = null;
    this._raf = null;
    this._drawQueued = false;
    this.master = null;
    this.provider = {
      frame: (c, st) => {
        const m = media.get(c.mediaId);
        if (!m || m.missing) return null;
        if (m.type === 'image') return m.bitmap;
        const e = this.els.get(c.id);
        return e && e.el.readyState >= 2 ? e.el : null;
      },
      mask: (c, src) => this.maskFor(c, src),
    };
    this.masks = new Map();
    this.segBusy = false;
  }

  // Máscara de persona: se calcula en segundo plano y se usa la última disponible
  maskFor(c, src) {
    let e = this.masks.get(c.id);
    if (!e) { e = { canvas: document.createElement('canvas'), ready: false, st: null }; this.masks.set(c.id, e); }
    const st = src.currentTime ?? 'img';
    if (!this.segBusy && e.st !== st) {
      this.segBusy = true;
      e.st = st;
      import('./vision.js').then((v) => v.segmentPerson(src, e.canvas)).then((m) => {
        e.ready = !!m; this.segBusy = false;
        if (!this.playing) this.requestDraw();
      }).catch((err) => { console.warn(err); this.segBusy = false; });
    }
    return e.ready ? e.canvas : null;
  }

  on(fn) { this.listeners.add(fn); }
  emit() { for (const f of this.listeners) f(this.t, this.playing); }

  invalidate() { this.venv = null; this.requestDraw(); }

  resize() {
    const P = this.getP();
    const k = Math.min(1, 1280 / Math.max(P.width, P.height));
    const w = Math.round(P.width * k), h = Math.round(P.height * k);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.k = k;
    this.requestDraw();
  }

  ensureMaster() {
    if (this.master) return this.master;
    const ac = audioCtx();
    this.master = ac.createGain();
    this.master.connect(ac.destination);
    return this.master;
  }

  el(c) {
    let e = this.els.get(c.id);
    const m = media.get(c.mediaId);
    if (e && e.mediaId === c.mediaId) return e;
    if (e) this.drop(c.id);
    const el = document.createElement(m.type === 'audio' || c.kind === 'audio' ? 'audio' : 'video');
    el.src = m.url; el.preload = 'auto'; el.playsInline = true; el.crossOrigin = 'anonymous';
    el.addEventListener('seeked', () => this.requestDraw());
    el.addEventListener('loadeddata', () => this.requestDraw());
    e = { el, mediaId: c.mediaId, gain: null };
    try {
      const ac = audioCtx();
      const node = ac.createMediaElementSource(el);
      e.chain = voiceChain(ac);
      e.gain = ac.createGain();
      node.connect(e.chain.input);
      e.chain.output.connect(e.gain).connect(this.ensureMaster());
    } catch { /* sin WebAudio: volumen nativo */ }
    this.els.set(c.id, e);
    return e;
  }

  drop(id) {
    const e = this.els.get(id);
    if (!e) return;
    e.el.pause(); e.el.removeAttribute('src'); e.el.load();
    try { e.gain?.disconnect(); } catch {}
    this.els.delete(id);
  }

  sync() {
    const P = this.getP();
    const t = this.t;
    const ids = new Set(P.clips.map((c) => c.id));
    for (const id of [...this.els.keys()]) if (!ids.has(id)) this.drop(id);
    if (this.master) this.master.gain.value = P.masterGain ?? 1;
    if (P.autoDuck && !this.venv) this.venv = voiceEnvelope(P, media);

    const holds = new Map();
    for (const v of activeVisuals(P, t)) if (v.hold) holds.set(v.clip.id, v.clip);

    for (const c of P.clips) {
      if (c.kind !== 'video' && c.kind !== 'audio') continue;
      const m = media.get(c.mediaId);
      if (!m || m.missing || m.loading) continue;
      const tr = P.tracks.find((x) => x.id === c.trackId);
      const active = t >= c.start && t < clipEnd(c);
      const soon = this.playing && c.start > t && c.start - t < 1.2;
      const hold = holds.get(c.id);
      if (!active && !soon && !hold) {
        const e = this.els.get(c.id);
        if (e && !e.el.paused) e.el.pause();
        continue;
      }
      const e = this.el(c);
      const el = e.el;
      if (hold) {
        if (!el.paused) el.pause();
        const ht = c.in + (c.dur - 1 / P.fps) * c.speed;
        if (Math.abs(el.currentTime - ht) > 0.05 && !el.seeking) el.currentTime = ht;
        continue;
      }
      if (soon) {
        if (!el.paused) el.pause();
        if (Math.abs(el.currentTime - c.in) > 0.05 && !el.seeking) el.currentTime = c.in;
        continue;
      }
      const expected = sourceTime(c, t);
      const muted = tr?.muted || !m.audio && m.type === 'video' && false;
      let g = muted ? 0 : clipGainAt(c, t);
      if (tr?.music) g *= duckGain(P, this.venv, t);
      if (e.chain && e.enh !== !!c.enhance) { e.enh = !!c.enhance; e.chain.set(e.enh); }
      if (e.gain) { e.gain.gain.value = g; el.volume = 1; } else el.volume = Math.min(1, g);
      if (el.playbackRate !== c.speed) el.playbackRate = c.speed;
      if (this.playing) {
        if (el.paused) { el.currentTime = expected; el.play().catch(() => {}); }
        else if (Math.abs(el.currentTime - expected) > 0.25) el.currentTime = expected;
      } else {
        if (!el.paused) el.pause();
        if (Math.abs(el.currentTime - expected) > 0.02 && !el.seeking) el.currentTime = expected;
      }
    }
  }

  draw() {
    const P = this.getP();
    this.ctx.save();
    this.ctx.setTransform(this.k, 0, 0, this.k, 0, 0);
    renderFrame(this.ctx, P, this.t, this.provider, this.k);
    this.ctx.restore();
  }

  requestDraw() {
    if (this._drawQueued) return;
    this._drawQueued = true;
    requestAnimationFrame(() => {
      this._drawQueued = false;
      if (!this.playing) { this.sync(); this.draw(); }
    });
  }

  seek(t) {
    const P = this.getP();
    this.t = Math.max(0, Math.min(t, Math.max(0, projectDuration(P))));
    this.sync(); this.draw(); this.emit();
  }

  play() {
    if (this.playing) return;
    const P = this.getP();
    const dur = projectDuration(P);
    if (dur <= 0) return;
    if (this.t >= dur - 0.05) this.t = this.loopRange ? this.loopRange[0] : 0;
    audioCtx().resume();
    this.playing = true;
    this._t0 = this.t; this._w0 = performance.now();
    const tick = () => {
      if (!this.playing) return;
      this.t = this._t0 + (performance.now() - this._w0) / 1000;
      const end = this.loopRange ? this.loopRange[1] : projectDuration(this.getP());
      if (this.t >= end) {
        if (this.loopRange) { this.t = this.loopRange[0]; this._t0 = this.t; this._w0 = performance.now(); }
        else { this.t = end; this.pause(); return; }
      }
      this.sync(); this.draw(); this.emit();
      this._raf = requestAnimationFrame(tick);
    };
    this.sync();
    this._raf = requestAnimationFrame(tick);
    this.emit();
  }

  pause() {
    this.playing = false;
    cancelAnimationFrame(this._raf);
    for (const e of this.els.values()) e.el.pause();
    this.sync(); this.draw(); this.emit();
  }

  toggle() { this.playing ? this.pause() : this.play(); }
}
