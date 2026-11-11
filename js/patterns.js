/* =========================================================================
 * Ergin DJ Lab — patterns.js
 * Procedural music patterns for the built-in vibes.
 * Everything here is data only: 16-step drum grids plus note sequences that
 * the synth engine turns into sound in real time. No samples, no audio files.
 * Designed & Created by Ergin Kaplan.
 * ========================================================================= */

(function (global) {
  'use strict';

  /* Note name -> frequency helper (A4 = 440Hz). */
  const SEMITONE = {
    C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5,
    'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11
  };

  function noteToFreq(note) {
    const m = /^([A-G][#b]?)(-?\d)$/.exec(note);
    if (!m) return 440;
    const semis = SEMITONE[m[1]] + (parseInt(m[2], 10) + 1) * 12;
    return 440 * Math.pow(2, (semis - 69) / 12);
  }

  /* Build a 16-step grid from a compact string.
   *   "x...x...x...x..." -> [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0]
   *   "." and "-" mean "no hit", "x" a full hit, "o" a softer ghost hit. */
  function grid(str) {
    const out = [];
    for (let i = 0; i < 16; i++) {
      const c = str[i] || '.';
      out.push(c === 'x' ? 1 : c === 'o' ? 0.55 : 0);
    }
    return out;
  }

  /* ---------------------------------------------------------------------
   * Vibe definitions. `family` groups fast/upbeat vs slow/chill styles.
   * ------------------------------------------------------------------- */
  const PATTERNS = {
    disco: {
      id: 'disco',
      name: 'Disco',
      icon: 'DISCO',
      family: 'fast',
      bpm: 120,
      swing: 0.06,
      accent: '#ff2d95',
      kick: grid('x...x...x...x...'),
      snare: grid('................'),
      clap: grid('....x.......x..x'),
      hatClosed: grid('x.x.x.x.x.x.x.x.'),
      hatOpen: grid('..x...x...x...x.'),
      rim: grid('..............o.'),
      bass: [
        { s: 0, n: 'A1', d: 2 }, { s: 2, n: 'A1', d: 1 }, { s: 3, n: 'E2', d: 1 },
        { s: 6, n: 'C2', d: 2 }, { s: 8, n: 'A1', d: 2 }, { s: 10, n: 'G1', d: 1 },
        { s: 11, n: 'E2', d: 1 }, { s: 14, n: 'D2', d: 2 }
      ],
      chords: [
        { s: 2, n: ['A3', 'C4', 'E4', 'G4'], d: 1.4 },
        { s: 6, n: ['F3', 'A3', 'C4', 'E4'], d: 1.4 },
        { s: 10, n: ['C4', 'E4', 'G4', 'B4'], d: 1.4 },
        { s: 14, n: ['G3', 'B3', 'D4', 'F4'], d: 1.4 }
      ],
      lead: [
        { s: 0, n: 'E4', d: 1 }, { s: 4, n: 'A4', d: 1 },
        { s: 8, n: 'C5', d: 1 }, { s: 12, n: 'B4', d: 1 }
      ]
    },

    house: {
      id: 'house',
      name: 'House',
      icon: 'HOUSE',
      family: 'fast',
      bpm: 124,
      swing: 0.0,
      accent: '#00e5ff',
      kick: grid('x...x...x...x...'),
      snare: grid('................'),
      clap: grid('....x.......x...'),
      hatClosed: grid('x.xxx.xxx.xxx.xx'),
      hatOpen: grid('..x...x...x...x.'),
      rim: grid('..............x.'),
      bass: [
        { s: 2, n: 'A1', d: 1 }, { s: 6, n: 'A1', d: 1 },
        { s: 10, n: 'G1', d: 1 }, { s: 14, n: 'F1', d: 1 }
      ],
      chords: [
        { s: 2, n: ['A3', 'C4', 'E4'], d: 1 },
        { s: 6, n: ['A3', 'C4', 'E4'], d: 1 },
        { s: 10, n: ['G3', 'B3', 'D4'], d: 1 },
        { s: 14, n: ['F3', 'A3', 'C4'], d: 1 }
      ],
      lead: [
        { s: 3, n: 'E5', d: 0.5 }, { s: 7, n: 'C5', d: 0.5 },
        { s: 11, n: 'D5', d: 0.5 }, { s: 15, n: 'A4', d: 0.5 }
      ]
    },

    lofi: {
      id: 'lofi',
      name: 'Lo-Fi',
      icon: 'LO-FI',
      family: 'slow',
      bpm: 82,
      swing: 0.18,
      accent: '#7c4dff',
      kick: grid('x.....x...x.....'),
      snare: grid('....x.......x...'),
      clap: grid('................'),
      hatClosed: grid('o.x.o.x.o.x.o.x.'),
      hatOpen: grid('..............x.'),
      rim: grid('....o.......o...'),
      bass: [
        { s: 0, n: 'A1', d: 3 }, { s: 6, n: 'C2', d: 2 },
        { s: 8, n: 'D2', d: 3 }, { s: 14, n: 'F2', d: 2 }
      ],
      chords: [
        { s: 0, n: ['A3', 'C4', 'E4', 'G4'], d: 4 },
        { s: 8, n: ['D3', 'F3', 'A3', 'C4'], d: 4 }
      ],
      lead: [
        { s: 4, n: 'E5', d: 1 }, { s: 7, n: 'C5', d: 1 },
        { s: 12, n: 'A4', d: 1 }, { s: 14, n: 'G4', d: 1 }
      ]
    },

    ambient: {
      id: 'ambient',
      name: 'Ambient',
      icon: 'AMBIENT',
      family: 'slow',
      bpm: 64,
      swing: 0.0,
      accent: '#b6ff2e',
      kick: grid('x.......x.......'),
      snare: grid('................'),
      clap: grid('................'),
      hatClosed: grid('o.......o.......'),
      hatOpen: grid('................'),
      rim: grid('..............o.'),
      bass: [
        { s: 0, n: 'A1', d: 6 }, { s: 8, n: 'F1', d: 6 }
      ],
      chords: [
        { s: 0, n: ['A3', 'E4', 'C5', 'B4'], d: 8 },
        { s: 8, n: ['F3', 'C4', 'A4', 'E4'], d: 8 }
      ],
      lead: [
        { s: 2, n: 'C5', d: 2 }, { s: 6, n: 'A4', d: 2 },
        { s: 10, n: 'E5', d: 2 }, { s: 14, n: 'B4', d: 2 }
      ]
    }
  };

  const ORDER = ['disco', 'house', 'lofi', 'ambient'];

  global.DJPatterns = { PATTERNS, ORDER, noteToFreq, grid };
})(window);
