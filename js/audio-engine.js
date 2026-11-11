/* =========================================================================
 * Ergin DJ Lab — audio-engine.js
 * A complete, 100% copyright-free synthesis + mixing engine built purely on
 * the browser's native Web Audio API. No audio files, no samples, no uploads:
 * every kick, snare, hat, bass, chord and lead is generated from oscillators
 * and filtered noise in real time.
 *
 * Signal flow (per deck):
 *   synth voices -> deck pre-gain -> [ LP/HP filter ] -> 3-band EQ
 *                -> [ delay send ] [ reverb send ] -> deck gain
 *                -> crossfader gain -> master bus -> limiter -> speakers
 *
 * Designed & Created by Ergin Kaplan.
 * ========================================================================= */

(function (global) {
  'use strict';

  const { PATTERNS, noteToFreq } = global.DJPatterns;

  /* ------------------------------------------------------------------ *
   * Impulse response generator — synthesises a reverb tail from noise so
   * we never need to load an external IR file.
   * ------------------------------------------------------------------ */
  function makeImpulse(ctx, seconds, decay) {
    const rate = ctx.sampleRate;
    const len = Math.max(1, Math.floor(rate * seconds));
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        // slightly different curve per channel keeps the tail wide
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (ch ? 0.96 : 1);
      }
    }
    return buf;
  }

  /* ------------------------------------------------------------------ *
   * StudioKit — a bank of procedurally synthesised drum voices.
   * Each voice schedules its own oscillators/envelopes at a given time.
   * ------------------------------------------------------------------ */
  class StudioKit {
    constructor(ctx, out) {
      this.ctx = ctx;
      this.out = out;                 // shared drum bus (GainNode)
      this.noiseBuf = this._makeNoise(2);
      this.kick = null;               // created lazily for round-robin tuning
    }

    _makeNoise(seconds) {
      const ctx = this.ctx;
      const len = Math.floor(ctx.sampleRate * seconds);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return buf;
    }

    /* Creates (but does not start) a looping noise source. Callers schedule it
       with their own start/stop times so it never starts twice. */
    _noise() {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      src.playbackRate.value = 0.96 + Math.random() * 0.08;
      return src;
    }

    /* Punchy electronic kick: pitch-swept sine + short click. */
    kickHit(t, gain) {
      const ctx = this.ctx;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const click = this._noise();
      const clickG = ctx.createGain();
      const clickF = ctx.createBiquadFilter();

      osc.type = 'sine';
      const startF = 150, endF = 44;
      osc.frequency.setValueAtTime(startF, t);
      osc.frequency.exponentialRampToValueAtTime(endF, t + 0.09);

      const amp = 1.05 * gain;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(amp, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);

      // transient click for definition
      clickF.type = 'highpass';
      clickF.frequency.value = 1200;
      clickG.gain.setValueAtTime(0.35 * gain, t);
      clickG.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
      click.connect(clickF).connect(clickG).connect(this.out);

      osc.connect(g).connect(this.out);
      osc.start(t); osc.stop(t + 0.45);
      click.start(t, Math.random()); click.stop(t + 0.05);
    }

    /* Snare: band-passed noise body + a tuned triangle for tone. */
    snareHit(t, gain) {
      const ctx = this.ctx;
      const n = this._noise();
      const bp = ctx.createBiquadFilter();
      const g = ctx.createGain();
      bp.type = 'bandpass';
      bp.frequency.value = 1900;
      bp.Q.value = 0.8;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.55 * gain, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.19);
      n.connect(bp).connect(g).connect(this.out);

      const tone = ctx.createOscillator();
      const tg = ctx.createGain();
      tone.type = 'triangle';
      tone.frequency.setValueAtTime(210, t);
      tone.frequency.exponentialRampToValueAtTime(150, t + 0.1);
      tg.gain.setValueAtTime(0.28 * gain, t);
      tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
      tone.connect(tg).connect(this.out);
      tone.start(t); tone.stop(t + 0.13);
      n.start(t, Math.random()); n.stop(t + 0.24);
    }

    /* Clap: three short noise bursts plus a filtered tail. */
    clapHit(t, gain) {
      const ctx = this.ctx;
      const burst = (delay, amp) => {
        const n = this._noise();
        const bp = ctx.createBiquadFilter();
        const g = ctx.createGain();
        bp.type = 'bandpass';
        bp.frequency.value = 1100;
        bp.Q.value = 1.1;
        g.gain.setValueAtTime(amp * gain, t + delay);
        g.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.045);
        n.connect(bp).connect(g).connect(this.out);
        n.start(t + delay, Math.random()); n.stop(t + delay + 0.06);
      };
      burst(0, 0.5); burst(0.011, 0.45); burst(0.023, 0.4);
      // airy tail
      const tail = this._noise();
      const hp = ctx.createBiquadFilter();
      const tg = ctx.createGain();
      hp.type = 'highpass';
      hp.frequency.value = 900;
      tg.gain.setValueAtTime(0.22 * gain, t + 0.02);
      tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      tail.connect(hp).connect(tg).connect(this.out);
      tail.start(t + 0.02, Math.random()); tail.stop(t + 0.22);
    }

    /* Closed hi-hat: short high-passed noise. */
    hatClosedHit(t, gain) {
      const ctx = this.ctx;
      const n = this._noise();
      const hp = ctx.createBiquadFilter();
      const g = ctx.createGain();
      hp.type = 'highpass';
      hp.frequency.value = 8200;
      g.gain.setValueAtTime(0.34 * gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      n.connect(hp).connect(g).connect(this.out);
      n.start(t, Math.random()); n.stop(t + 0.07);
    }

    /* Open hi-hat: same source, longer decay. */
    hatOpenHit(t, gain) {
      const ctx = this.ctx;
      const n = this._noise();
      const hp = ctx.createBiquadFilter();
      const g = ctx.createGain();
      hp.type = 'highpass';
      hp.frequency.value = 7600;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.26 * gain, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.36);
      n.connect(hp).connect(g).connect(this.out);
      n.start(t, Math.random()); n.stop(t + 0.4);
    }

    /* Rim / percussion tick. */
    rimHit(t, gain) {
      const ctx = this.ctx;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const bp = ctx.createBiquadFilter();
      osc.type = 'square';
      osc.frequency.value = 1750;
      bp.type = 'bandpass';
      bp.frequency.value = 2100;
      bp.Q.value = 3;
      g.gain.setValueAtTime(0.3 * gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
      osc.connect(bp).connect(g).connect(this.out);
      osc.start(t); osc.stop(t + 0.06);
    }
  }

  /* ------------------------------------------------------------------ *
   * Deck — one mixer channel with its own synth voices, filter, EQ, FX
   * sends, fader and transport (16-step sequencer).
   * ------------------------------------------------------------------ */
  class Deck {
    constructor(ctx, masterIn, shared, name) {
      this.ctx = ctx;
      this.name = name;
      this.shared = shared;             // shared FX buses (delay/reverb)
      this.pattern = PATTERNS.house;
      this.step = 0;
      this.nextNoteTime = 0;
      this.playing = false;
      this.timer = null;
      this.onStep = null;               // UI hook (step index)

      /* --- channel strip --- */
      this.preGain = ctx.createGain();          // sums all synth voices
      this.filter = ctx.createBiquadFilter();   // live LP/HP performance filter
      this.filter.type = 'lowpass';
      this.filter.frequency.value = 20000;
      this.filter.Q.value = 0.7;

      this.eqLow = ctx.createBiquadFilter();
      this.eqLow.type = 'lowshelf';
      this.eqLow.frequency.value = 200;
      this.eqMid = ctx.createBiquadFilter();
      this.eqMid.type = 'peaking';
      this.eqMid.frequency.value = 1200;
      this.eqMid.Q.value = 0.8;
      this.eqHigh = ctx.createBiquadFilter();
      this.eqHigh.type = 'highshelf';
      this.eqHigh.frequency.value = 5200;

      this.fader = ctx.createGain();            // deck volume
      this.fader.gain.value = 0.85;

      /* --- FX sends (parallel, return into shared buses) --- */
      this.delaySend = ctx.createGain();
      this.delaySend.gain.value = 0;
      this.reverbSend = ctx.createGain();
      this.reverbSend.gain.value = 0;

      /* --- crossfader gain --- */
      this.xfade = ctx.createGain();
      this.xfade.gain.value = 0.85;

      /* wire it up */
      this.preGain.connect(this.filter);
      this.filter.connect(this.eqLow);
      this.eqLow.connect(this.eqMid);
      this.eqMid.connect(this.eqHigh);
      this.eqHigh.connect(this.fader);
      this.fader.connect(this.xfade);
      this.fader.connect(this.delaySend);
      this.fader.connect(this.reverbSend);
      this.delaySend.connect(shared.delayIn);
      this.reverbSend.connect(shared.reverbIn);
      this.xfade.connect(masterIn);

      /* --- drum voices --- */
      this.drums = new StudioKit(ctx, this.preGain);
    }

    setPattern(id) {
      this.pattern = PATTERNS[id] || this.pattern;
    }

    /* Live LP/HP sweep. `norm` is 0..1 (0 = HP full open low, 1 = LP open). */
    setFilter(norm) {
      const t = this.ctx.currentTime;
      // Map to an exponential 120Hz .. 20kHz sweep
      const f = 120 * Math.pow(20000 / 120, norm);
      this.filter.frequency.setTargetAtTime(f, t, 0.02);
    }

    setFilterType(type) {
      this.filter.type = type === 'highpass' ? 'highpass' : 'lowpass';
    }

    setEQ(band, db) {
      const node = band === 'low' ? this.eqLow : band === 'mid' ? this.eqMid : this.eqHigh;
      node.gain.setTargetAtTime(db, this.ctx.currentTime, 0.02);
    }

    setVolume(v) {
      this.fader.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
    }

    setCrossfade(v) {
      this.xfade.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
    }

    setSend(fx, amount) {
      const node = fx === 'delay' ? this.delaySend : this.reverbSend;
      node.gain.setTargetAtTime(amount, this.ctx.currentTime, 0.03);
    }

    /* ------------------------- transport ------------------------- */
    play() {
      if (this.playing) return;
      this.playing = true;
      this.nextNoteTime = this.ctx.currentTime + 0.08;
      this.step = 0;
      this.timer = setInterval(() => this._scheduler(), 25);
    }

    stop() {
      this.playing = false;
      if (this.timer) { clearInterval(this.timer); this.timer = null; }
    }

    toggle() { this.playing ? this.stop() : this.play(); return this.playing; }

    get bpm() { return this._bpm || this.pattern.bpm; }
    set bpm(v) { this._bpm = Math.max(40, Math.min(220, v)); }

    _stepDur() { return 60 / this.bpm / 4; }  // 16th note

    _scheduler() {
      const lookahead = 0.12;
      while (this.nextNoteTime < this.ctx.currentTime + lookahead) {
        this._playStep(this.step, this.nextNoteTime);
        this.nextNoteTime += this._stepDur();
        this.step = (this.step + 1) % 16;
      }
    }

    _playStep(step, t) {
      const p = this.pattern;
      const sw = p.swing * this._stepDur() * (step % 2 === 1 ? 1 : 0);
      const tt = t + sw;
      const g = 1;

      if (p.kick[step]) this.drums.kickHit(tt, p.kick[step] * g);
      if (p.snare[step]) this.drums.snareHit(tt, p.snare[step] * g);
      if (p.clap[step]) this.drums.clapHit(tt, p.clap[step] * g);
      if (p.hatClosed[step]) this.drums.hatClosedHit(tt, p.hatClosed[step] * g);
      if (p.hatOpen[step]) this.drums.hatOpenHit(tt, p.hatOpen[step] * g);
      if (p.rim && p.rim[step]) this.drums.rimHit(tt, p.rim[step] * g);

      this._seqNotes(p.bass, step, tt, this._bass);
      this._seqNotes(p.chords, step, tt, this._chord);
      this._seqNotes(p.lead, step, tt, this._lead);

      if (this.onStep) this.onStep(step);
    }

    /* Walk a sparse note list and fire any note that lands on `step`. */
    _seqNotes(list, step, t, fn) {
      if (!list) return;
      for (let i = 0; i < list.length; i++) {
        const ev = list[i];
        if (ev.s === step) fn.call(this, ev, t);
      }
    }

    /* --- synth voices (all bound to the deck pre-gain) --- */
    _bass(ev, t) {
      const ctx = this.ctx;
      const dur = ev.d * this._stepDur();
      const osc = ctx.createOscillator();
      const sub = ctx.createOscillator();
      const g = ctx.createGain();
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(520, t);
      lp.frequency.exponentialRampToValueAtTime(180, t + Math.max(0.08, dur));
      lp.Q.value = 6;
      osc.type = 'sawtooth';
      osc.frequency.value = noteToFreq(ev.n);
      sub.type = 'sine';
      sub.frequency.value = noteToFreq(ev.n) / 2;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.5, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(lp);
      sub.connect(lp);
      lp.connect(g).connect(this.preGain);
      osc.start(t); sub.start(t);
      osc.stop(t + dur + 0.05); sub.stop(t + dur + 0.05);
    }

    _chord(ev, t) {
      const ctx = this.ctx;
      const dur = ev.d * this._stepDur();
      const g = ctx.createGain();
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2600;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.98);
      g.connect(lp).connect(this.preGain);
      ev.n.forEach((note) => {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = noteToFreq(note);
        o.detune.value = (Math.random() * 12 - 6);
        o.connect(g);
        o.start(t); o.stop(t + dur + 0.05);
      });
    }

    _lead(ev, t) {
      const ctx = this.ctx;
      const dur = ev.d * this._stepDur();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.value = noteToFreq(ev.n);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.09, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.preGain);
      o.start(t); o.stop(t + dur + 0.04);
    }
  }

  /* ------------------------------------------------------------------ *
   * AudioEngine — owns the context, the two decks, shared FX and master.
   * ------------------------------------------------------------------ */
  class AudioEngine {
    constructor() {
      const Ctx = global.AudioContext || global.webkitAudioContext;
      this.ctx = new Ctx();
      this.started = false;

      /* master chain */
      this.masterIn = this.ctx.createGain();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.85;
      this.limiter = this.ctx.createDynamicsCompressor();
      this.limiter.threshold.value = -6;
      this.limiter.knee.value = 6;
      this.limiter.ratio.value = 12;
      this.limiter.attack.value = 0.003;
      this.limiter.release.value = 0.18;

      /* analyser sits on the master bus for the visualiser */
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.82;

      /* shared FX buses */
      this.delayIn = this.ctx.createGain();
      this.delay = this.ctx.createDelay(1.0);
      this.delay.delayTime.value = 0.34;
      this.delayFb = this.ctx.createGain();
      this.delayFb.gain.value = 0.42;
      this.delayTone = this.ctx.createBiquadFilter();
      this.delayTone.type = 'lowpass';
      this.delayTone.frequency.value = 4200;
      this.delayOut = this.ctx.createGain();
      this.delayOut.gain.value = 0.9;

      this.reverbIn = this.ctx.createGain();
      this.convolver = this.ctx.createConvolver();
      this.convolver.buffer = makeImpulse(this.ctx, 2.4, 2.6);
      this.reverbOut = this.ctx.createGain();
      this.reverbOut.gain.value = 0.9;

      /* wire master */
      this.masterIn.connect(this.masterGain);
      this.masterGain.connect(this.limiter);
      this.limiter.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);

      /* wire FX */
      this.delayIn.connect(this.delay);
      this.delay.connect(this.delayTone);
      this.delayTone.connect(this.delayFb);
      this.delayFb.connect(this.delay);
      this.delayTone.connect(this.delayOut);
      this.delayOut.connect(this.masterIn);

      this.reverbIn.connect(this.convolver);
      this.convolver.connect(this.reverbOut);
      this.reverbOut.connect(this.masterIn);

      /* decks */
      const shared = { delayIn: this.delayIn, reverbIn: this.reverbIn };
      this.deckA = new Deck(this.ctx, this.masterIn, shared, 'A');
      this.deckB = new Deck(this.ctx, this.masterIn, shared, 'B');

      this.decks = { A: this.deckA, B: this.deckB };

      /* UI hooks */
      this.onLevel = null;
    }

    /* Browsers require a gesture before audio can start. */
    async resume() {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      this.started = true;
      return this.ctx.state;
    }

    setMaster(v) { this.masterGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02); }
    setDelayTime(v) { this.delay.delayTime.setTargetAtTime(v, this.ctx.currentTime, 0.05); }
    setDelayFeedback(v) { this.delayFb.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); }
    setReverbMix(v) { this.reverbOut.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); }

    /* Equal-power crossfader. pos 0 = full A, 1 = full B. */
    setCrossfader(pos) {
      const a = Math.cos(pos * Math.PI / 2);
      const b = Math.sin(pos * Math.PI / 2);
      this.deckA.setCrossfade(a);
      this.deckB.setCrossfade(b);
    }

    /* Push the master spectrum to the visualiser. */
    getSpectrum() {
      const data = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.getByteFrequencyData(data);
      return data;
    }
  }

  global.DJAudio = { AudioEngine, StudioKit, Deck, makeImpulse };
})(window);
