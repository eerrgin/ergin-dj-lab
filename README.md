<div align="center">

# 🎧 Ergin DJ Lab

**A high-end, award-grade web DJ console that runs entirely in your browser.**
Two decks · full mixer · live FX · real-time audio visualisation.

**100% procedural audio — synthesised live with the Web Audio API. No samples. No uploads. No copyright.**

Designed &amp; Created by **Ergin Kaplan**

</div>

---

## ✨ Highlights

| | |
|---|---|
| 🎛️ **Two independent decks** | Deck A & Deck B, each with Play/Pause, CUE and its own tempo. |
| 🎚️ **Full mixer strip** | Trim, Gain, 3-band EQ (Low / Mid / High) and a 132px volume fader per deck. |
| 🎚️ **Equal-power crossfader** | Smooth, click-free A↔B transitions with auto-gain balancing. |
| 🌊 **Live performance FX** | Per-deck Reverb send, Delay send and a Low-Pass / High-Pass filter sweep. |
| 🥁 **Real synthesis** | Kicks, snares, claps, hi-hats, rims, bass, chords and leads — all generated from oscillators and filtered noise. |
| 🎼 **Four vibes** | Fast/Upbeat: **Disco**, **House** · Slow/Chill: **Lo-Fi**, **Ambient**. |
| 📊 **Visualisers** | 72-band spectrum analyser, per-deck oscilloscopes and VU meters, all canvas-driven. |
| 📱 **Fully responsive** | Designed for desktop and mobile browsers. |
| 🛡️ **Copyright-safe** | No external audio files, streams or uploads. Everything is generated on your device. |

---

## 🚀 Run it

The app is a pure static site — there is no build step and no dependencies.

### Option 1 — open directly
Just open `index.html` in a modern browser (Chrome, Edge, Firefox or Safari).
Click **Power On** to start the audio engine (browsers require a user gesture
before audio can play).

### Option 2 — serve locally (recommended)
A tiny local server avoids any `file://` restrictions:

```bash
# Python 3
python3 -m http.server 8080
# then open http://localhost:8080

# or Node
npx serve .
```

### Option 3 — deploy
Because it is fully static, you can drop the repository straight onto
GitHub Pages, Netlify, Vercel or any static host.

---

## 🎹 How to play

1. Press **Power On** (top-right) — the audio engine starts and both decks begin playing.
2. Pick a **vibe** from the preset bar, or use the dropdown on each deck.
3. Drag the **crossfader** in the centre mixer to blend Deck A ↔ Deck B.
4. Shape the sound with the per-deck **EQ**, **FILTER**, **DELAY** and **REVERB** knobs.
5. Use **SYNC BPM** to lock Deck B to Deck A's tempo, and **PANIC STOP** to stop everything.
6. Tune the delay time, feedback and reverb mix from the master knobs.

**Keyboard shortcuts**

| Key | Action |
|---|---|
| `Space` | Play / Pause Deck A |
| `Shift` + `Space` | Play / Pause Deck B |
| `Esc` | Close a modal |
| Drag a knob + `Shift` | Fine adjust |
| `↑` / `↓` on a focused knob | Step the value |

---

## 🗂️ Project structure

```
ergin-dj-lab/
├── index.html            # SPA shell: header, decks, mixer, footer, modals
├── css/
│   └── styles.css        # Design system: glassmorphism, neon, responsive
├── js/
│   ├── patterns.js       # Procedural music data for the four vibes
│   ├── audio-engine.js   # Web Audio synthesis + mixing graph (the engine)
│   ├── visualizer.js     # Canvas spectrum + oscilloscope renderers
│   ├── ui.js             # Reusable Knob / Fader / XFader / VU widgets
│   └── app.js            # Wires the engine, controls and visuals together
├── LICENSE               # MIT
└── README.md
```

### Audio signal flow

```
Deck synth voices ─► pre-gain ─► LP/HP filter ─► 3-band EQ ─┬─► deck fader ─┬─► crossfader gain ─┐
                                                            │               │                    │
                                                            ├─► delay send ─┤                    │
                                                            └─► reverb send┘                    │
                                                                                                 ▼
                                                    shared Delay / Reverb returns ──► master bus ─► limiter ─► analyser ─► 🔊
```

The sequencer uses a **look-ahead scheduler** (25 ms timer, 120 ms scheduling
window) so notes are scheduled on the audio clock, keeping playback glitch-free
even under UI load.

---

## 🧠 How the sound is made

Nothing is loaded from disk or the network. Every element is built on the fly:

* **Kick** — pitch-swept sine (150 Hz → 44 Hz) plus a filtered noise transient.
* **Snare** — band-passed noise body plus a tuned triangle for tone.
* **Clap** — three short noise bursts and an airy high-passed tail.
* **Hi-hats** — high-passed noise; the open hat simply decays longer.
* **Bass** — saw + sub sine through a resonant low-pass with an envelope sweep.
* **Chords** — detuned saw stack through a gentle low-pass.
* **Lead** — square-wave melody voice.
* **Reverb** — a ConvolverNode fed by a procedurally generated impulse response (no IR file).

---

## ⚖️ Disclaimer &amp; Copyright

All audio is procedurally generated in your browser using the Web Audio API.
No copyrighted material or user uploads are used. **100% Copyright-Free.**

This application is strictly for personal entertainment. It does not load,
stream or accept any third-party audio content.

---

## 📄 License

Released under the [MIT License](LICENSE).

<div align="center">

**Designed &amp; Created by Ergin Kaplan**

</div>
