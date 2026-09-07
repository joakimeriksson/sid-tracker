# Instrument-Table Integration Plan for SID Tracker

## Executive Summary

This document provides a detailed, step-by-step plan to integrate GoatTracker2-style table functionality into the SID Tracker's instrument system. The goal is to replace the current simple LFO system with a powerful, frame-accurate table-based modulation system while maintaining backward compatibility.

## Current State Analysis

### Current Instrument Structure
```javascript
{
  name: "Lead (Tri)",
  waveform: WAVE_TRIANGLE,      // Static waveform
  ad: 0x0F,                      // Attack/Decay
  sr: 0xFE,                      // Sustain/Release
  pulseWidth: 0x0800,            // Static pulse width

  // Current LFO system (to be replaced)
  pwmLFO: { enabled: false, freq: 0, depth: 0 },
  fmLFO: { enabled: false, freq: 0, depth: 0 },
  filterLFO: { enabled: false, freq: 0, depth: 0, continuous: false },

  sync: false,
  ringMod: false,
  arpeggio: { enabled: false, notes: [0, 4, 7], speed: 4 },
  filter: { enabled: false, frequency: 0x400, resonance: 0, type: 0x10 },

  // Placeholder for tables (currently unused)
  tables: { wave: -1, pulse: -1, filter: -1, speed: -1 }
}
```

### GoatTracker2 Instrument Structure
```c
typedef struct {
  unsigned char ad;              // Attack/Decay
  unsigned char sr;              // Sustain/Release
  unsigned char ptr[MAX_TABLES]; // Table pointers [wave, pulse, filter, speed]
  unsigned char vibdelay;        // Vibrato delay in ticks
  unsigned char gatetimer;       // Gate-off timer
  unsigned char firstwave;       // First frame waveform
  char name[MAX_INSTRNAMELEN];   // Instrument name
} INSTR;
```

### Key Differences
1. **GT2 has no static waveform** - waveform comes from wavetable execution
2. **GT2 has no static pulse width** - pulse comes from pulsetable or instrument init
3. **GT2 uses table pointers** - instruments point to positions in shared tables
4. **GT2 has gate timer** - controls when note gate-off happens
5. **GT2 has first wave** - special waveform for note initialization frame

## Target Architecture

### Enhanced Instrument Structure
```javascript
{
  name: String,                  // Instrument name

  // Core ADSR (unchanged)
  ad: 0x00-0xFF,                 // Attack/Decay
  sr: 0x00-0xFF,                 // Sustain/Release

  // Table system (NEW - replaces LFOs)
  tables: {
    wave: 0-255 | -1,            // Wavetable pointer (-1 = not used)
    pulse: 0-255 | -1,           // Pulsetable pointer (-1 = not used)
    filter: 0-255 | -1,          // Filtertable pointer (-1 = not used)
    speed: 0-255 | -1,           // Speedtable pointer (-1 = not used, for vibrato)
  },

  // GoatTracker2 parameters (NEW)
  vibratoDelay: 0x00-0xFF,       // Ticks before vibrato starts (0 = off)
  gateTimer: 0x00-0xFF,          // Ticks before gate-off (bits: 0x80=no hardrestart, 0x40=no gateoff)
  firstWave: 0x00-0xFF,          // First frame waveform (0x09 = gate+testbit default)

  // Compatibility fallbacks (for instruments without tables)
  legacyWaveform: 0x10|0x20|0x40|0x80,  // Used if wavetable not set
  legacyPulseWidth: 0x0000-0x0FFF,      // Used if pulsetable not set
  legacyFilter: { ... },                // Used if filtertable not set

  // Deprecated (will auto-convert to tables on first edit)
  pwmLFO: { ... },               // → auto-generates pulsetable
  fmLFO: { ... },                // → auto-generates wavetable with vibrato
  filterLFO: { ... },            // → auto-generates filtertable
  arpeggio: { ... },             // → auto-generates wavetable

  sync: Boolean,                 // Oscillator sync flag
  ringMod: Boolean,              // Ring modulation flag
}
```

---

# Repository Guidelines

## Project Structure & Module Organization
- Source: top-level browser scripts such as `main.js`, `synth.js`, `sequencer.js`, `pattern-manager.js`, `arpeggio-engine.js`, `lfo-engine.js`, `instrument-editor.js`, `song-editor.js`, `keyboard-input.js`, `sid-exporter.js`, `tempo-control.js`.
- UI/Demos: `index.html`, `simple-test.html`, `manual-sid-test.html`, `jssid-debug-test.html`, `pico-test.html`.
- Assets: `sids/*.sid` example tunes and resources.
- Vendor: `jsSID/` contains the SID playback library and its demo assets. Treat as third‑party; avoid modifying unless necessary.

## Build, Test, and Development Commands
- Run locally (serves static files to avoid CORS):
  - Python: `python3 -m http.server 8000` then open `http://localhost:8000/index.html`.
  - Node (if installed): `npx serve .` then browse the shown URL.
- No build step: files are vanilla HTML/JS/CSS loaded by the browser.
- Quick check pages: open `simple-test.html` or `manual-sid-test.html` via the local server for focused tests.

## Coding Style & Naming Conventions
- Language: modern browser JavaScript (no bundler). Prefer ES5/ES6 compatible syntax.
- Indentation: 2 spaces; max line length ~100 chars.
- Naming: `camelCase` for functions/vars, `PascalCase` for classes. Module files use descriptive suffixes (e.g., `*-engine.js`, `*-editor.js`, `*-manager.js`).
- Imports: keep modules self‑contained; avoid global leakage. Do not rename vendor files in `jsSID/`.

## Testing Guidelines
- Framework: none. Use demo pages to validate audio, sequencing, editing, and export flows.
- Manual checks: load a `.sid` from `sids/`, verify playback, arpeggio/LFO behavior, recording, and export via `sid-exporter.js`.
- Add small, isolated test pages when adding features (e.g., `feature-x-test.html`).

## Commit & Pull Request Guidelines
- Messages: imperative and concise (“Add arpeggio hold mode”). Conventional prefixes like `feat:`, `fix:`, `docs:` are welcome but not required.
- Scope: keep changes focused; avoid mixing vendor updates with app code.
- PRs: include a clear description, linked issues, and screenshots/GIFs of UI changes. Note any impacts on `sids/` assets or browser permissions.

## Security & Configuration Tips
- Serve over `http://localhost` to allow Web Audio and avoid CORS issues.
- Keep large or licensed `.sid` files out of commits unless required. Place local test assets under `sids/` and document their provenance.
