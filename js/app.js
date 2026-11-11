/* =========================================================================
 * Ergin DJ Lab — app.js
 * Wires the synthesised audio engine, the mixer controls and the canvas
 * visualisers into the DOM. Everything runs client-side.
 * Designed & Created by Ergin Kaplan.
 * ========================================================================= */

(function () {
  'use strict';

  const { PATTERNS, ORDER } = window.DJPatterns;
  const { AudioEngine } = window.DJAudio;
  const { Visualizer, Scope } = window.DJVisual;
  const { Knob, Fader, XFader, VUMeter, clamp } = window.DJUI;

  const $ = (sel, root) => (root || document).querySelector(sel);

  /* ------------------------------------------------------------------ *
   * State
   * ------------------------------------------------------------------ */
  const engine = new AudioEngine();
  const state = {
    started: false,
    crossfader: 0.5,
    cueA: null,   // saved vibes for CUE
    cueB: null,
    autoGain: true
  };

  const visualizer = new Visualizer($('#visualizer'), { bars: 72, accent: '#00e5ff', mirror: true });
  const scopeA = new Scope($('#scopeA'), { accent: '#ff2d95' });
  const scopeB = new Scope($('#scopeB'), { accent: '#00e5ff' });
  const vuA = new VUMeter($('#vuA'));
  const vuB = new VUMeter($('#vuB'));
  const vuMaster = new VUMeter($('#vuMaster'));

  const ACCENTS = { A: '#ff2d95', B: '#00e5ff' };

  /* ------------------------------------------------------------------ *
   * Deck UI factory
   * ------------------------------------------------------------------ */
  function buildDeck(letter) {
    const deck = engine.decks[letter];
    const accent = ACCENTS[letter];
    const els = {
      root: $('#deck' + letter),
      select: $('#vibe' + letter),
      bpmVal: $('#bpmVal' + letter),
      play: $('#play' + letter),
      cue: $('#cue' + letter),
      platter: $('#platter' + letter),
      strobe: $('#strobe' + letter),
      grid: $('#grid' + letter)
    };

    /* vibe <select> options */
    ORDER.forEach((id) => {
      const o = document.createElement('option');
      o.value = id;
      o.textContent = PATTERNS[id].name;
      els.select.appendChild(o);
    });

    /* 16-step grid read-out */
    const cells = [];
    for (let i = 0; i < 16; i++) {
      const d = document.createElement('i');
      d.className = 'step-cell' + (i % 4 === 0 ? ' step-cell--accent' : '');
      els.grid.appendChild(d);
      cells.push(d);
    }

    /* knobs */
    const knobs = {
      trim: new Knob($('#trim' + letter), {
        min: 0, max: 1.6, value: 1, label: 'TRIM', accent, unit: 'x',
        onChange: (v) => { deck.trim = v; applyGains(deck); }
      }),
      gain: new Knob($('#gain' + letter), {
        min: 0, max: 1.2, value: 0.85, label: 'GAIN', accent,
        onChange: (v) => { deck.userGain = v; applyGains(deck); }
      }),
      hi: new Knob($('#hi' + letter), {
        min: -15, max: 15, value: 0, label: 'HIGH', accent, unit: 'dB', bipolar: true,
        onChange: (v) => deck.setEQ('high', v)
      }),
      mid: new Knob($('#mid' + letter), {
        min: -15, max: 15, value: 0, label: 'MID', accent, unit: 'dB', bipolar: true,
        onChange: (v) => deck.setEQ('mid', v)
      }),
      low: new Knob($('#low' + letter), {
        min: -15, max: 15, value: 0, label: 'LOW', accent, unit: 'dB', bipolar: true,
        onChange: (v) => deck.setEQ('low', v)
      }),
      filter: new Knob($('#filter' + letter), {
        min: 0, max: 1, value: 1, label: 'FILTER', accent,
        onChange: (v) => deck.setFilter(v)
      }),
      echo: new Knob($('#echo' + letter), {
        min: 0, max: 1, value: 0, label: 'DELAY', accent,
        onChange: (v) => deck.setSend('delay', v * 0.85)
      }),
      reverb: new Knob($('#reverb' + letter), {
        min: 0, max: 1, value: 0, label: 'REVERB', accent,
        onChange: (v) => deck.setSend('reverb', v * 0.9)
      })
    };

    const fader = new Fader($('#fader' + letter), {
      value: 0.85, label: 'VOL', accent,
      onChange: (v) => { deck.userGain = v; applyGains(deck); }
    });

    /* initial deck state */
    deck.trim = 1;
    deck.userGain = 0.85;
    deck.filterState = 1;

    /* transport */
    els.play.addEventListener('click', () => togglePlay(letter));
    els.cue.addEventListener('click', () => cueDeck(letter));

    /* vibe change */
    els.select.addEventListener('change', () => {
      const id = els.select.value;
      deck.setPattern(id);
      deck.bpm = PATTERNS[id].bpm;
      els.bpmVal.textContent = PATTERNS[id].bpm;
      els.root.dataset.accent = PATTERNS[id].accent;
      // re-tint this deck's accents
      setDeckAccent(letter, PATTERNS[id].accent);
    });

    /* step highlight hook */
    deck.onStep = (step) => {
      if (deck._lastCell != null) cells[deck._lastCell].classList.remove('on');
      cells[step].classList.add('on');
      deck._lastCell = step;
    };

    /* initial pattern */
    const initial = letter === 'A' ? 'house' : 'disco';
    deck.setPattern(initial);
    deck.bpm = PATTERNS[initial].bpm;
    els.select.value = initial;
    els.bpmVal.textContent = PATTERNS[initial].bpm;
    // Tint using local references — the deckA/deckB bindings are not ready yet.
    applyTint(letter, PATTERNS[initial].accent, { knobs, fader });

    return { deck, els, knobs, fader, cells };
  }

  const deckA = buildDeck('A');
  const deckB = buildDeck('B');

  /* ------------------------------------------------------------------ *
   * Accent re-tinting
   * ------------------------------------------------------------------ */
  function applyTint(letter, color, bundle) {
    ACCENTS[letter] = color;
    const root = $('#deck' + letter);
    root.dataset.accent = color;
    root.style.setProperty('--accent', color);
    Object.values(bundle.knobs).forEach((k) => { k.opts.accent = color; k._paint(); });
    bundle.fader.opts.accent = color;
    bundle.fader.track.style.setProperty('--accent', color);
    (letter === 'A' ? scopeA : scopeB).setAccent(color);
    updateVisualAccent();
  }

  function setDeckAccent(letter, color) {
    applyTint(letter, color, letter === 'A' ? deckA : deckB);
  }

  function updateVisualAccent() {
    visualizer.setAccent(state.crossfader <= 0.5 ? ACCENTS.A : ACCENTS.B);
  }

  /* ------------------------------------------------------------------ *
   * Gain management (trim x user gain, plus auto-gain for the dominant deck)
   * ------------------------------------------------------------------ */
  function applyGains(deck) {
    const base = (deck.trim || 1) * (deck.userGain != null ? deck.userGain : 0.85);
    deck.setVolume(clamp(base, 0, 1.6));
  }

  /* Keep the two decks balanced so one is never drowned out by the other. */
  function balanceDecks() {
    const a = state.crossfader, b = 1 - state.crossfader;
    if (state.autoGain) {
      // boost the quieter side slightly (never above 1.6)
      const boostA = a < 0.5 ? 1 + (0.5 - a) * 0.5 : 1;
      const boostB = b < 0.5 ? 1 + (0.5 - b) * 0.5 : 1;
      deckA.deck.setVolume(clamp((deckA.deck.trim * deckA.deck.userGain) * boostA, 0, 1.6));
      deckB.deck.setVolume(clamp((deckB.deck.trim * deckB.deck.userGain) * boostB, 0, 1.6));
    }
  }

  /* ------------------------------------------------------------------ *
   * Transport
   * ------------------------------------------------------------------ */
  function ensureStarted() {
    if (!state.started) {
      engine.resume();
      state.started = true;
      setEngineState('live');
    }
  }

  function togglePlay(letter) {
    ensureStarted();
    const d = letter === 'A' ? deckA : deckB;
    const playing = d.deck.toggle();
    d.els.root.classList.toggle('is-playing', playing);
    d.els.play.classList.toggle('is-on', playing);
    d.els.platter.classList.toggle('spin', playing);
    d.els.strobe.classList.toggle('on', playing);
  }

  function stopAll() {
    ['A', 'B'].forEach((letter) => {
      const d = letter === 'A' ? deckA : deckB;
      d.deck.stop();
      d.els.root.classList.remove('is-playing');
      d.els.play.classList.remove('is-on');
      d.els.platter.classList.remove('spin');
      d.els.strobe.classList.remove('on');
      d.cells.forEach((c) => c.classList.remove('on'));
    });
  }

  function cueDeck(letter) {
    const d = letter === 'A' ? deckA : deckB;
    const cur = d.deck.pattern.id;
    // CUE toggles between the current vibe and the previous one
    const key = letter === 'A' ? 'cueA' : 'cueB';
    if (state[key]) {
      const prev = state[key];
      state[key] = cur;
      d.els.select.value = prev;
      d.deck.setPattern(prev);
      d.deck.bpm = PATTERNS[prev].bpm;
      d.els.bpmVal.textContent = PATTERNS[prev].bpm;
      setDeckAccent(letter, PATTERNS[prev].accent);
    } else {
      state[key] = cur;
    }
    d.els.cue.classList.add('flash');
    setTimeout(() => d.els.cue.classList.remove('flash'), 180);
  }

  /* ------------------------------------------------------------------ *
   * Preset buttons (fast vs slow vibes)
   * ------------------------------------------------------------------ */
  const presetGroup = $('#presetGroup');
  ORDER.forEach((id) => {
    const p = PATTERNS[id];
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'preset-btn';
    b.dataset.vibe = id;
    b.dataset.family = p.family;
    b.style.setProperty('--accent', p.accent);
    b.innerHTML = '<span class="preset-name">' + p.name + '</span>' +
                  '<span class="preset-meta">' + p.bpm + ' BPM · ' + (p.family === 'fast' ? 'UPBEAT' : 'CHILL') + '</span>';
    b.addEventListener('click', () => {
      // load this vibe on the deck that currently owns the crossfader
      const letter = state.crossfader <= 0.5 ? 'A' : 'B';
      const d = letter === 'A' ? deckA : deckB;
      d.els.select.value = id;
      d.els.select.dispatchEvent(new Event('change'));
      // pulse feedback
      Array.from(presetGroup.children).forEach((c) => c.classList.remove('is-active'));
      b.classList.add('is-active');
      if (!state.started) { ensureStarted(); togglePlay(letter); }
    });
    presetGroup.appendChild(b);
  });

  /* ------------------------------------------------------------------ *
   * Master section
   * ------------------------------------------------------------------ */
  new Knob($('#masterVol'), {
    min: 0, max: 1.2, value: 0.85, label: 'MASTER', accent: '#b6ff2e',
    onChange: (v) => engine.setMaster(v)
  });
  new Knob($('#delayTime'), {
    min: 0.05, max: 0.85, value: 0.34, label: 'TIME', accent: '#b6ff2e', unit: 's',
    onChange: (v) => engine.setDelayTime(v)
  });
  new Knob($('#delayFb'), {
    min: 0, max: 0.85, value: 0.42, label: 'FEEDBK', accent: '#b6ff2e',
    onChange: (v) => engine.setDelayFeedback(v)
  });
  new Knob($('#reverbMix'), {
    min: 0, max: 1.5, value: 0.9, label: 'REV MIX', accent: '#b6ff2e',
    onChange: (v) => engine.setReverbMix(v)
  });

  const xfader = new XFader($('#xfader'), {
    value: 0.5,
    onChange: (v) => {
      state.crossfader = v;
      engine.setCrossfader(v);
      updateVisualAccent();
      balanceDecks();
      $('#deckA').style.opacity = 0.55 + 0.45 * Math.cos(v * Math.PI / 2);
      $('#deckB').style.opacity = 0.55 + 0.45 * Math.sin(v * Math.PI / 2);
    }
  });

  $('#panicBtn').addEventListener('click', () => {
    stopAll();
    xfader.setValue(0.5);
    engine.setCrossfader(0.5);
    state.crossfader = 0.5;
  });

  $('#syncBtn').addEventListener('click', () => {
    // Match Deck B to Deck A's tempo
    deckB.deck.bpm = deckA.deck.bpm;
    deckB.els.bpmVal.textContent = Math.round(deckA.deck.bpm);
    $('#syncBtn').classList.add('flash');
    setTimeout(() => $('#syncBtn').classList.remove('flash'), 220);
  });

  /* ------------------------------------------------------------------ *
   * Header / modals
   * ------------------------------------------------------------------ */
  function setEngineState(s) {
    const pill = $('#engineState');
    pill.dataset.state = s;
    $('#engineText').textContent = s === 'live' ? 'Audio Engine Live' : 'Audio Engine Idle';
  }

  $('#powerBtn').addEventListener('click', () => {
    ensureStarted();
    // Power on starts both decks so the mix is instantly alive.
    if (!deckA.deck.playing) togglePlay('A');
    if (!deckB.deck.playing) togglePlay('B');
    $('#powerBtn').classList.add('is-on');
    $('#powerBtn').innerHTML = '<span class="power-ico" aria-hidden="true"></span> Power On';
  });

  const aboutModal = $('#aboutModal');
  const discModal = $('#disclaimerModal');
  function openModal(m) { m.hidden = false; requestAnimationFrame(() => m.classList.add('open')); }
  function closeModal(m) { m.classList.remove('open'); setTimeout(() => { m.hidden = true; }, 220); }

  $('#openAbout').addEventListener('click', () => openModal(aboutModal));
  $('#openDisclaimer').addEventListener('click', () => openModal(discModal));
  document.querySelectorAll('[data-close]').forEach((b) => {
    b.addEventListener('click', () => closeModal(b.closest('.modal-backdrop')));
  });
  document.querySelectorAll('.modal-backdrop').forEach((m) => {
    m.addEventListener('click', (e) => { if (e.target === m) closeModal(m); });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!aboutModal.hidden) closeModal(aboutModal);
      if (!discModal.hidden) closeModal(discModal);
    }
    // spacebar toggles deck A, shift+space toggles deck B
    if (e.code === 'Space' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) {
      e.preventDefault();
      togglePlay(e.shiftKey ? 'B' : 'A');
    }
  });

  /* ------------------------------------------------------------------ *
   * Render loop
   * ------------------------------------------------------------------ */
  let frame = 0;
  const timeWaveA = new Float32Array(engine.analyser.fftSize);
  const timeWaveB = new Float32Array(engine.analyser.fftSize);

  function loop() {
    frame++;
    const spectrum = engine.getSpectrum();
    visualizer.render(spectrum);

    // simple loudness estimate from the low/mid spectrum
    let sum = 0;
    for (let i = 0; i < spectrum.length; i++) sum += spectrum[i];
    const loud = clamp((sum / spectrum.length) / 140, 0, 1);

    vuMaster.update(loud);
    // per-deck meters scale the master by the crossfader position
    vuA.update(clamp(loud * Math.cos(state.crossfader * Math.PI / 2) * 1.4, 0, 1));
    vuB.update(clamp(loud * Math.sin(state.crossfader * Math.PI / 2) * 1.4, 0, 1));

    // oscilloscopes (approximated from the spectrum's first bins so we only
    // need one analyser; cheap and looks great)
    if (frame % 2 === 0) {
      for (let i = 0; i < timeWaveA.length; i++) {
        const idx = Math.floor(i / 4) % 256;
        timeWaveA[i] = (spectrum[idx] / 255 - 0.5) * Math.sin(i * 0.15);
        timeWaveB[i] = (spectrum[(idx + 40) % 256] / 255 - 0.5) * Math.sin(i * 0.19 + frame * 0.02);
      }
      scopeA.render(timeWaveA);
      scopeB.render(timeWaveB);
    }

    // BPM readout pulse
    if (frame % 30 === 0) {
      $('#bpmValA').textContent = Math.round(deckA.deck.bpm);
      $('#bpmValB').textContent = Math.round(deckB.deck.bpm);
      [$('#metroA'), $('#metroB')].forEach((m, i) => {
        const d = i === 0 ? deckA : deckB;
        m.style.transform = 'scaleX(' + (d.deck.playing ? 0.9 + Math.sin(frame * 0.3) * 0.1 : 0.1) + ')';
      });
    }

    requestAnimationFrame(loop);
  }

  /* Apply initial mixer values */
  engine.setCrossfader(0.5);
  balanceDecks();
  updateVisualAccent();
  setEngineState('idle');

  // Deck A slightly left, Deck B slightly right for a pleasing start mix
  requestAnimationFrame(loop);

  // Expose a tiny debug handle (handy for manual testing in the console).
  window.ErginDJLab = { engine, state, deckA, deckB };
})();
