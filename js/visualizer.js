/* =========================================================================
 * Ergin DJ Lab — visualizer.js
 * Canvas audio visualisers driven by the master AnalyserNode.
 *  - Visualizer      : glowing spectrum bars with mirrored reflection + peaks
 *  - Scope           : soft oscilloscope waveform for a single deck bus
 * Designed & Created by Ergin Kaplan.
 * ========================================================================= */

(function (global) {
  'use strict';

  function fitCanvas(canvas) {
    const dpr = Math.min(global.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    return { w, h, dpr };
  }

  /* --------------------------- spectrum bars --------------------------- */
  class Visualizer {
    constructor(canvas, opts) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.opts = Object.assign({ bars: 64, accent: '#00e5ff', mirror: true }, opts || {});
      this.peaks = new Array(this.opts.bars).fill(0);
      this.smoothed = new Array(this.opts.bars).fill(0);
    }

    setAccent(color) { this.opts.accent = color; }

    /* `freq` is the Uint8Array from the analyser. */
    render(freq) {
      const { w, h } = fitCanvas(this.canvas);
      const c = this.ctx;
      const bars = this.opts.bars;
      const accent = this.opts.accent;
      c.clearRect(0, 0, w, h);

      const gap = Math.max(2, Math.floor(w / bars * 0.28));
      const bw = (w - gap * (bars - 1)) / bars;
      const usable = Math.floor(freq.length * 0.72); // ignore the dead top end
      const mirrorH = this.opts.mirror ? h * 0.32 : 0;

      for (let i = 0; i < bars; i++) {
        // Log-ish bin mapping so lows don't dominate the left third.
        const t0 = Math.pow(i / bars, 1.6);
        const t1 = Math.pow((i + 1) / bars, 1.6);
        const lo = Math.floor(t0 * usable);
        const hi = Math.max(lo + 1, Math.floor(t1 * usable));
        let sum = 0;
        for (let j = lo; j < hi; j++) sum += freq[j];
        const raw = (sum / (hi - lo)) / 255;

        // simple attack/release smoothing
        const target = raw;
        const s = this.smoothed[i];
        this.smoothed[i] = target > s ? target * 0.65 + s * 0.35 : s * 0.86 + target * 0.14;
        const v = this.smoothed[i];

        const barH = Math.max(2, v * (h - mirrorH - 6));
        const x = i * (bw + gap);
        const y = (h - mirrorH) - barH;

        const grad = c.createLinearGradient(0, y, 0, h - mirrorH);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.25, accent);
        grad.addColorStop(1, accent + '22');
        c.fillStyle = grad;
        c.shadowColor = accent;
        c.shadowBlur = 14;
        roundRect(c, x, y, bw, barH, Math.min(bw / 2, 4));
        c.fill();

        // peak cap
        const peak = Math.max(barH, this.peaks[i] - 1.6);
        this.peaks[i] = peak;
        c.shadowBlur = 0;
        c.fillStyle = 'rgba(255,255,255,0.85)';
        c.fillRect(x, (h - mirrorH) - peak - 2, bw, 2);

        if (this.opts.mirror) {
          const mg = c.createLinearGradient(0, h - mirrorH, 0, h);
          mg.addColorStop(0, accent + '55');
          mg.addColorStop(1, accent + '00');
          c.fillStyle = mg;
          c.fillRect(x, h - mirrorH, bw, Math.min(mirrorH, barH * 0.5));
        }
      }
    }
  }

  /* --------------------------- oscilloscope --------------------------- */
  class Scope {
    constructor(canvas, opts) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.opts = Object.assign({ accent: '#ff2d95' }, opts || {});
    }
    setAccent(color) { this.opts.accent = color; }

    /* `wave` is a Float32Array time-domain buffer. */
    render(wave) {
      const { w, h } = fitCanvas(this.canvas);
      const c = this.ctx;
      c.clearRect(0, 0, w, h);

      // centre line
      c.strokeStyle = 'rgba(255,255,255,0.06)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(0, h / 2);
      c.lineTo(w, h / 2);
      c.stroke();

      c.strokeStyle = this.opts.accent;
      c.shadowColor = this.opts.accent;
      c.shadowBlur = 12;
      c.lineWidth = 2;
      c.beginPath();
      const step = Math.floor(wave.length / w) || 1;
      for (let x = 0; x < w; x++) {
        const i = x * step;
        const v = wave[i] || 0;
        const y = h / 2 + v * (h / 2) * 0.9;
        x === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
      }
      c.stroke();
      c.shadowBlur = 0;
    }
  }

  function roundRect(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  global.DJVisual = { Visualizer, Scope };
})(window);
