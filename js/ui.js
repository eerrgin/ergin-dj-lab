/* =========================================================================
 * Ergin DJ Lab — ui.js
 * Reusable control widgets: rotary Knob, Fader, XFader and VU meter.
 * Each widget renders into a canvas (or DOM) and emits value changes via a
 * callback. They support mouse, touch and keyboard so the app works on both
 * desktop and mobile.
 * Designed & Created by Ergin Kaplan.
 * ========================================================================= */

(function (global) {
  'use strict';

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ------------------------------ Knob ------------------------------ */
  class Knob {
    /**
     * @param {HTMLElement} root - container element
     * @param {Object} opts - { min, max, value, label, accent, unit, bipolar,
     *                          curve: 'lin'|'log', onChange }
     */
    constructor(root, opts) {
      this.root = root;
      this.opts = Object.assign({
        min: 0, max: 1, value: 0.5, label: '', accent: '#00e5ff',
        unit: '', bipolar: false, curve: 'lin', size: 62, onChange: null
      }, opts || {});

      this._angle = this._valueToAngle(this.opts.value);

      this.canvas = document.createElement('canvas');
      this.canvas.className = 'knob-canvas';
      this.canvas.setAttribute('role', 'slider');
      this.canvas.setAttribute('tabindex', '0');
      this.canvas.setAttribute('aria-label', this.opts.label);
      this.canvas.width = this.opts.size * 2;
      this.canvas.height = this.opts.size * 2;
      this.canvas.style.width = this.opts.size + 'px';
      this.canvas.style.height = this.opts.size + 'px';

      this.readout = document.createElement('div');
      this.readout.className = 'knob-readout';

      const lab = document.createElement('div');
      lab.className = 'knob-label';
      lab.textContent = this.opts.label;

      root.appendChild(this.canvas);
      root.appendChild(this.readout);
      root.appendChild(lab);

      this._bind();
      this._paint();
      this._updateReadout();
    }

    _valueToAngle(v) {
      const t = (v - this.opts.min) / (this.opts.max - this.opts.min);
      return lerp(-135, 135, clamp(t, 0, 1));
    }

    setValue(v, silent) {
      v = clamp(v, this.opts.min, this.opts.max);
      this.opts.value = v;
      this._angle = this._valueToAngle(v);
      this._paint();
      this._updateReadout();
      if (!silent && this.opts.onChange) this.opts.onChange(v);
    }

    get value() { return this.opts.value; }

    _updateReadout() {
      const v = this.opts.value;
      const digits = this.opts.max - this.opts.min <= 2 ? 2 : 0;
      this.readout.textContent = v.toFixed(digits) + this.opts.unit;
    }

    _bind() {
      const c = this.canvas;
      let dragging = false, startY = 0, startVal = 0;

      const down = (e) => {
        dragging = true;
        c.classList.add('active');
        startY = (e.touches ? e.touches[0].clientY : e.clientY);
        startVal = this.opts.value;
        e.preventDefault();
      };
      const move = (e) => {
        if (!dragging) return;
        const y = (e.touches ? e.touches[0].clientY : e.clientY);
        const dy = startY - y;                     // up increases
        const range = this.opts.max - this.opts.min;
        const fine = e.shiftKey ? 0.25 : 1;
        const nv = startVal + (dy / 160) * range * fine;
        this.setValue(nv);
        e.preventDefault();
      };
      const up = () => { dragging = false; c.classList.remove('active'); };

      c.addEventListener('mousedown', down);
      global.addEventListener('mousemove', move);
      global.addEventListener('mouseup', up);
      c.addEventListener('touchstart', down, { passive: false });
      global.addEventListener('touchmove', move, { passive: false });
      global.addEventListener('touchend', up);

      // double click resets to default
      c.addEventListener('dblclick', () => this.setValue(this.opts.bipolar ? 0 : this.opts.value));

      c.addEventListener('keydown', (e) => {
        const range = this.opts.max - this.opts.min;
        const step = e.shiftKey ? range / 100 : range / 40;
        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { this.setValue(this.opts.value + step); e.preventDefault(); }
        if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { this.setValue(this.opts.value - step); e.preventDefault(); }
      });
    }

    _paint() {
      const c = this.canvas.getContext('2d');
      const S = this.canvas.width;
      const cx = S / 2, cy = S / 2;
      const R = S * 0.42;
      const accent = this.opts.accent;
      c.clearRect(0, 0, S, S);

      // track arc
      const a0 = (-135 - 90) * Math.PI / 180;
      const a1 = (135 - 90) * Math.PI / 180;
      c.lineWidth = S * 0.055;
      c.lineCap = 'round';
      c.strokeStyle = 'rgba(255,255,255,0.08)';
      c.beginPath();
      c.arc(cx, cy, R, a0, a1);
      c.stroke();

      // value arc
      const va = (this._angle - 90) * Math.PI / 180;
      const startA = this.opts.bipolar ? (-90) * Math.PI / 180 : a0;
      const grad = c.createLinearGradient(0, 0, S, S);
      grad.addColorStop(0, accent);
      grad.addColorStop(1, '#ffffff');
      c.strokeStyle = grad;
      c.shadowColor = accent;
      c.shadowBlur = S * 0.08;
      c.beginPath();
      c.arc(cx, cy, R, Math.min(startA, va), Math.max(startA, va));
      c.stroke();
      c.shadowBlur = 0;

      // knob body
      const bodyR = R - S * 0.075;
      const bg = c.createRadialGradient(cx - bodyR * 0.3, cy - bodyR * 0.4, bodyR * 0.15, cx, cy, bodyR);
      bg.addColorStop(0, '#2a2f45');
      bg.addColorStop(0.65, '#141826');
      bg.addColorStop(1, '#05070d');
      c.fillStyle = bg;
      c.beginPath();
      c.arc(cx, cy, bodyR, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.10)';
      c.lineWidth = 2;
      c.stroke();

      // indicator
      const ix = cx + Math.cos((this._angle - 90) * Math.PI / 180) * bodyR * 0.86;
      const iy = cy + Math.sin((this._angle - 90) * Math.PI / 180) * bodyR * 0.86;
      c.strokeStyle = accent;
      c.lineWidth = S * 0.045;
      c.lineCap = 'round';
      c.shadowColor = accent;
      c.shadowBlur = S * 0.06;
      c.beginPath();
      c.moveTo(cx + Math.cos((this._angle - 90) * Math.PI / 180) * bodyR * 0.3,
               cy + Math.sin((this._angle - 90) * Math.PI / 180) * bodyR * 0.3);
      c.lineTo(ix, iy);
      c.stroke();
      c.shadowBlur = 0;
    }
  }

  /* ------------------------------ Fader ------------------------------ */
  class Fader {
    constructor(root, opts) {
      this.opts = Object.assign({ value: 0.8, label: '', accent: '#00e5ff', onChange: null }, opts || {});
      this.track = document.createElement('div');
      this.track.className = 'fader-track';
      this.fill = document.createElement('div');
      this.fill.className = 'fader-fill';
      this.thumb = document.createElement('div');
      this.thumb.className = 'fader-thumb';
      this.track.appendChild(this.fill);
      this.track.appendChild(this.thumb);
      const lab = document.createElement('div');
      lab.className = 'fader-label';
      lab.textContent = this.opts.label;
      root.appendChild(this.track);
      root.appendChild(lab);

      this.track.style.setProperty('--accent', this.opts.accent);
      this.setValue(this.opts.value, true);
      this._bind();
    }

    setValue(v, silent) {
      this.value = clamp(v, 0, 1);
      this.fill.style.height = (this.value * 100) + '%';
      this.thumb.style.bottom = 'calc(' + (this.value * 100) + '% - 9px)';
      if (!silent && this.opts.onChange) this.opts.onChange(this.value);
    }

    _bind() {
      const t = this.track;
      let dragging = false;
      const set = (clientY) => {
        const r = t.getBoundingClientRect();
        this.setValue(1 - (clientY - r.top) / r.height);
      };
      t.addEventListener('mousedown', (e) => { dragging = true; t.classList.add('active'); set(e.clientY); e.preventDefault(); });
      global.addEventListener('mousemove', (e) => { if (dragging) set(e.clientY); });
      global.addEventListener('mouseup', () => { dragging = false; t.classList.remove('active'); });
      t.addEventListener('touchstart', (e) => { dragging = true; set(e.touches[0].clientY); e.preventDefault(); }, { passive: false });
      global.addEventListener('touchmove', (e) => { if (dragging) set(e.touches[0].clientY); }, { passive: false });
      global.addEventListener('touchend', () => { dragging = false; });
    }
  }

  /* ------------------------------ XFader ----------------------------- */
  class XFader {
    constructor(root, opts) {
      this.opts = Object.assign({ value: 0.5, onChange: null }, opts || {});
      this.track = document.createElement('div');
      this.track.className = 'xfader-track';
      this.thumb = document.createElement('div');
      this.thumb.className = 'xfader-thumb';
      this.track.appendChild(this.thumb);
      root.appendChild(this.track);
      this.setValue(this.opts.value, true);
      this._bind();
    }
    setValue(v, silent) {
      this.value = clamp(v, 0, 1);
      this.thumb.style.left = 'calc(' + (this.value * 100) + '% - 14px)';
      if (!silent && this.opts.onChange) this.opts.onChange(this.value);
    }
    _bind() {
      const t = this.track;
      let dragging = false;
      const set = (clientX) => {
        const r = t.getBoundingClientRect();
        this.setValue((clientX - r.left) / r.width);
      };
      t.addEventListener('mousedown', (e) => { dragging = true; t.classList.add('active'); set(e.clientX); e.preventDefault(); });
      global.addEventListener('mousemove', (e) => { if (dragging) set(e.clientX); });
      global.addEventListener('mouseup', () => { dragging = false; t.classList.remove('active'); });
      t.addEventListener('touchstart', (e) => { dragging = true; set(e.touches[0].clientX); e.preventDefault(); }, { passive: false });
      global.addEventListener('touchmove', (e) => { if (dragging) set(e.touches[0].clientX); }, { passive: false });
      global.addEventListener('touchend', () => { dragging = false; });
    }
  }

  /* ------------------------------ VU meter --------------------------- */
  class VUMeter {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.level = 0;
      this.peak = 0;
    }
    /* Feed a 0..1 normalised loudness value. */
    update(v) {
      this.level = v;
      this.peak = Math.max(this.peak * 0.97, v);
      this._draw();
    }
    _draw() {
      const dpr = Math.min(global.devicePixelRatio || 1, 2);
      const rect = this.canvas.getBoundingClientRect();
      const w = Math.floor(rect.width * dpr), h = Math.floor(rect.height * dpr);
      if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
      const c = this.ctx;
      c.clearRect(0, 0, w, h);
      const seg = 22, gap = 3;
      const sh = (h - gap * (seg - 1)) / seg;
      for (let i = 0; i < seg; i++) {
        const t = i / (seg - 1);
        const on = this.level > t * 0.98;
        const y = h - (i + 1) * sh - i * gap;
        c.fillStyle = on
          ? (t > 0.85 ? '#ff3b5c' : t > 0.65 ? '#ffd166' : '#2eff9b')
          : 'rgba(255,255,255,0.06)';
        c.fillRect(0, y, w, sh);
      }
    }
  }

  global.DJUI = { Knob, Fader, XFader, VUMeter, clamp, lerp };
})(window);
