# Table System Implementation Plan - Detailed Guide

## Phase 1: Core Table Infrastructure (Week 1)

### Step 1.1: Create Table Manager Module ✓
**File:** `table-manager.js`

```javascript
// ===================================================================
// TABLE MANAGER - Core table storage and execution
// ===================================================================

// Table storage - 4 tables, 256 entries each, left+right columns
export const tables = {
  wave: {
    left: new Uint8Array(256),   // Waveform/delay/command
    right: new Uint8Array(256),  // Note/parameter
  },
  pulse: {
    left: new Uint8Array(256),   // Time/pulse high nibble
    right: new Uint8Array(256),  // Speed/pulse low byte
  },
  filter: {
    left: new Uint8Array(256),   // Command/time
    right: new Uint8Array(256),  // Cutoff/speed/params
  },
  speed: {
    left: new Uint8Array(256),   // Vibrato speed or portamento MSB
    right: new Uint8Array(256),  // Vibrato depth or portamento LSB
  }
};

// Table execution state per voice
export const tableState = [
  {
    wavePtr: -1,
    waveDelay: 0,
    pulsePtr: -1,
    pulseModTime: 0,
    pulseValue: 0x0800,
    filterPtr: -1,
    filterModTime: 0,
    filterValue: 0x00,
    speedPtr: -1,
    vibDelay: 0,
    vibDirection: 1,
    vibCounter: 0,
  },
  // Voice 1
  { ...same... },
  // Voice 2
  { ...same... },
];

// Initialize tables with default programs
export function initializeTables() {
  // Default wavetable 0: Simple triangle wave
  tables.wave.left[0] = 0x11;   // Triangle waveform + gate
  tables.wave.right[0] = 0x00;  // Original pitch
  tables.wave.left[1] = 0xFF;   // Jump
  tables.wave.right[1] = 0x00;  // Stop

  // Default pulsetable 0: Static pulse width 0x0800
  tables.pulse.left[0] = 0x88;  // Set pulse width high nibble = 8
  tables.pulse.right[0] = 0x00; // Low byte = 0x00
  tables.pulse.left[1] = 0xFF;  // Jump
  tables.pulse.right[1] = 0x00; // Stop

  // Default filtertable 0: Low-pass filter
  tables.filter.left[0] = 0x90; // Low-pass filter
  tables.filter.right[0] = 0xF1; // Resonance F, channel 1
  tables.filter.left[1] = 0x00;  // Set cutoff
  tables.filter.right[1] = 0x40; // Cutoff value
  tables.filter.left[2] = 0xFF;  // Jump
  tables.filter.right[2] = 0x00; // Stop

  // Default speedtable 0: Vibrato
  tables.speed.left[0] = 0x03;  // Speed (direction change every 3 ticks)
  tables.speed.right[0] = 0x40; // Depth
}

// Table utilities
export function findFreeTableSpace(tableType, requiredLength = 10) {
  const table = tables[tableType];
  for (let i = 0; i < 256 - requiredLength; i++) {
    let isFree = true;
    for (let j = 0; j < requiredLength; j++) {
      if (table.left[i + j] !== 0x00) {
        isFree = false;
        break;
      }
    }
    if (isFree) return i;
  }
  return -1; // No free space
}

export function copyTableSegment(tableType, src, dest, length) {
  const table = tables[tableType];
  for (let i = 0; i < length; i++) {
    table.left[dest + i] = table.left[src + i];
    table.right[dest + i] = table.right[src + i];
  }
}

export function getTableLength(tableType, startPos) {
  const table = tables[tableType];
  let len = 0;
  for (let i = startPos; i < 256; i++) {
    len++;
    if (table.left[i] === 0xFF && table.right[i] === 0x00) break; // Stop
    if (table.left[i] === 0xFF) break; // Jump (end of segment)
  }
  return len;
}

export function optimizeTable(tableType) {
  // Remove duplicate segments, compact table
  // TODO: Implement deduplication logic
}
```

**Tasks:**
- [ ] Create `table-manager.js` file
- [ ] Implement table storage arrays
- [ ] Implement table state tracking per voice
- [ ] Add initialization with default programs
- [ ] Add utility functions (find, copy, optimize)
- [ ] Test basic table operations

### Step 1.2: Update Instrument Structure ✓
**File:** `synth.js` - Modify instrument structure

```javascript
// Helper to create enhanced instrument
const createInstrument = (name, params = {}) => ({
  name,
  ad: params.ad ?? 0x0F,
  sr: params.sr ?? 0xF8,

  // NEW: Table pointers
  tables: {
    wave: params.tables?.wave ?? -1,
    pulse: params.tables?.pulse ?? -1,
    filter: params.tables?.filter ?? -1,
    speed: params.tables?.speed ?? -1,
  },

  // NEW: GT2 parameters
  vibratoDelay: params.vibratoDelay ?? 0,
  gateTimer: params.gateTimer ?? 2,
  firstWave: params.firstWave ?? 0x09,  // gate + testbit

  // Legacy fallbacks
  legacyWaveform: params.waveform ?? 0x11,
  legacyPulseWidth: params.pulseWidth ?? 0x0800,
  legacyFilter: params.filter ?? { enabled: false, frequency: 0x400, resonance: 0, type: 0x10 },

  sync: params.sync ?? false,
  ringMod: params.ringMod ?? false,
});

// Update preset instruments
export const instruments = [
  createInstrument("Lead (Tri)", {
    waveform: WAVE_TRIANGLE,
    ad: 0x0F,
    sr: 0xFE,
    tables: { wave: -1, pulse: -1, filter: -1, speed: -1 }
  }),
  // ... more presets
];

// Migration function: convert old LFO to tables
export function migrateInstrumentToTables(instrument) {
  let migrated = false;

  // Migrate PWM LFO → pulsetable
  if (instrument.pwmLFO?.enabled) {
    const tablePos = convertPWMLFOToTable(instrument.pwmLFO);
    if (tablePos >= 0) {
      instrument.tables.pulse = tablePos;
      delete instrument.pwmLFO;
      migrated = true;
    }
  }

  // Migrate arpeggio → wavetable
  if (instrument.arpeggio?.enabled) {
    const tablePos = convertArpeggioToWavetable(instrument.arpeggio);
    if (tablePos >= 0) {
      instrument.tables.wave = tablePos;
      delete instrument.arpeggio;
      migrated = true;
    }
  }

  // Migrate filter LFO → filtertable
  if (instrument.filterLFO?.enabled) {
    const tablePos = convertFilterLFOToTable(instrument.filterLFO);
    if (tablePos >= 0) {
      instrument.tables.filter = tablePos;
      delete instrument.filterLFO;
      migrated = true;
    }
  }

  return migrated;
}

// LFO to table converters
function convertPWMLFOToTable(pwmLFO) {
  const tablePos = findFreeTableSpace('pulse', 5);
  if (tablePos < 0) return -1;

  const modulationRange = Math.floor(pwmLFO.depth * 0x0400);
  const frames = Math.floor(60 / pwmLFO.freq);
  const speedUp = Math.floor(modulationRange / frames);

  // Set center pulse width
  tables.pulse.left[tablePos] = 0x88;
  tables.pulse.right[tablePos] = 0x00;

  // Modulate up
  tables.pulse.left[tablePos + 1] = Math.min(frames, 0x7F);
  tables.pulse.right[tablePos + 1] = speedUp;

  // Modulate down
  tables.pulse.left[tablePos + 2] = Math.min(frames, 0x7F);
  tables.pulse.right[tablePos + 2] = (256 - speedUp) & 0xFF;

  // Loop
  tables.pulse.left[tablePos + 3] = 0xFF;
  tables.pulse.right[tablePos + 3] = tablePos + 1;

  return tablePos;
}

function convertArpeggioToWavetable(arpeggio) {
  const tablePos = findFreeTableSpace('wave', arpeggio.notes.length * 2 + 1);
  if (tablePos < 0) return -1;

  let pos = tablePos;
  for (let i = 0; i < arpeggio.notes.length; i++) {
    tables.wave.left[pos] = 0x11;  // Triangle + gate
    tables.wave.right[pos] = arpeggio.notes[i];  // Relative note
    pos++;

    if (arpeggio.speed > 1) {
      tables.wave.left[pos] = Math.min(arpeggio.speed - 1, 0x0F);
      tables.wave.right[pos] = 0x80;  // Keep freq unchanged
      pos++;
    }
  }

  // Loop
  tables.wave.left[pos] = 0xFF;
  tables.wave.right[pos] = tablePos;

  return tablePos;
}

function convertFilterLFOToTable(filterLFO) {
  // TODO: Implement filter LFO conversion
  return -1;
}
```

**Tasks:**
- [ ] Update instrument creation helper
- [ ] Add migration function
- [ ] Implement LFO → table converters
- [ ] Update all preset instruments
- [ ] Test instrument creation and migration

### Step 1.3: Integrate with playNote ✓
**File:** `synth.js` - Update note initialization

```javascript
export function playNoteWithInstrument(voice, frequencyHz, duration, instrumentIdOrObject) {
  const instr = (typeof instrumentIdOrObject === 'number')
    ? instruments[instrumentIdOrObject]
    : instrumentIdOrObject;

  if (!instr) return;

  // Auto-migrate if needed
  if (instr.pwmLFO || instr.arpeggio || instr.filterLFO) {
    migrateInstrumentToTables(instr);
  }

  // Store base note for wavetable relative notes
  const baseNote = frequencyToNoteNumber(frequencyHz);

  // 1. Set ADSR
  const voiceOffset = voice * VOICE_OFFSET;
  sidPlayer.synth.poke(voiceOffset + ATTACK_DECAY, instr.ad);
  sidPlayer.synth.poke(voiceOffset + SUSTAIN_RELEASE, instr.sr);

  // 2. Initialize table pointers
  const state = tableState[voice];

  if (instr.tables.wave >= 0) {
    state.wavePtr = instr.tables.wave;
    state.waveDelay = 0;
    state.baseNote = baseNote;
  } else {
    state.wavePtr = -1;
  }

  if (instr.tables.pulse >= 0) {
    state.pulsePtr = instr.tables.pulse;
    state.pulseModTime = 0;
    state.pulseValue = instr.legacyPulseWidth;
  } else {
    state.pulsePtr = -1;
    setPulseWidth(voice, instr.legacyPulseWidth);
  }

  if (instr.tables.filter >= 0) {
    state.filterPtr = instr.tables.filter;
    state.filterModTime = 0;
  } else {
    state.filterPtr = -1;
    if (instr.legacyFilter.enabled) {
      applyFilter(voice, instr.legacyFilter);
    }
  }

  if (instr.tables.speed >= 0 && instr.vibratoDelay > 0) {
    state.speedPtr = instr.tables.speed;
    state.vibDelay = instr.vibratoDelay;
    state.vibDirection = 1;
    state.vibCounter = 0;
  } else {
    state.speedPtr = -1;
  }

  // 3. Set first frame waveform
  let waveform = instr.firstWave;
  if (waveform === 0x00) {
    // 0x00 = keep unchanged, use legacy
    waveform = instr.legacyWaveform;
  } else if (waveform === 0xFE || waveform === 0xFF) {
    // 0xFE = gate off, 0xFF = gate on
    // Keep waveform, just change gate
    waveform = instr.legacyWaveform;
    if (waveform === 0xFE) waveform &= ~0x01;
    if (waveform === 0xFF) waveform |= 0x01;
  }

  // Apply sync/ringmod
  if (instr.sync) waveform |= 0x02;
  if (instr.ringMod) waveform |= 0x04;

  sidPlayer.synth.poke(voiceOffset + CONTROL, waveform);

  // 4. Set frequency
  setFrequency(voice, frequencyHz);

  // 5. Schedule gate-off if needed
  if (instr.gateTimer > 0 && !(instr.gateTimer & 0x40)) {
    const gateOffTime = instr.gateTimer & 0x3F;
    setTimeout(() => {
      const currentWave = sidPlayer.synth.peek(voiceOffset + CONTROL);
      sidPlayer.synth.poke(voiceOffset + CONTROL, currentWave & ~0x01);
    }, gateOffTime * (1000 / 60)); // Convert ticks to ms (assuming 60Hz)
  }

  // 6. Send to worklet if available
  if (sidWorkletNode) {
    sidWorkletNode.port.postMessage({
      type: 'initInstrument',
      voice,
      tables: instr.tables,
      vibratoDelay: instr.vibratoDelay,
      gateTimer: instr.gateTimer,
      firstWave: waveform,
      baseNote,
    });
  }
}

// Helper: frequency to note number
function frequencyToNoteNumber(freq) {
  const A4 = 440;
  const C0 = A4 * Math.pow(2, -4.75); // C0 frequency
  return Math.round(12 * Math.log2(freq / C0));
}
```

**Tasks:**
- [ ] Update playNoteWithInstrument function
- [ ] Add table state initialization
- [ ] Implement firstWave handling
- [ ] Add gate timer scheduling
- [ ] Add worklet communication
- [ ] Test note playback with tables

---

## Phase 2: Wavetable Execution (Week 1-2)

### Step 2.1: Wavetable Execution Logic ✓
**File:** `table-manager.js`

```javascript
export function executeWavetable(voice) {
  const state = tableState[voice];
  if (state.wavePtr < 0) return false;  // No wavetable active

  const left = tables.wave.left[state.wavePtr];
  const right = tables.wave.right[state.wavePtr];

  // Handle delay (0x01-0x0F)
  if (left >= 0x01 && left <= 0x0F) {
    if (state.waveDelay > 0) {
      state.waveDelay--;
      return true;  // Still in delay
    }
    state.waveDelay = left;
    state.wavePtr++;
    return executeWavetable(voice);  // Recurse to next step
  }

  // Handle jump (0xFF)
  if (left === 0xFF) {
    if (right === 0x00) {
      state.wavePtr = -1;  // Stop
      return false;
    }
    state.wavePtr = right;  // Jump to position
    return true;
  }

  // Handle command execution (0xF0-0xFE)
  if (left >= 0xF0 && left <= 0xFE) {
    const command = left & 0x0F;
    executePatternCommand(voice, command, right);
    state.wavePtr++;
    return true;
  }

  // Handle waveform change
  let waveform = left;
  if (left >= 0xE0 && left <= 0xEF) {
    // Inaudible waveforms (0x00-0x0F)
    waveform = left - 0xE0;
  }

  if (left !== 0x00 && left >= 0x10) {
    setWaveform(voice, waveform);
  }

  // Handle note/frequency (right side)
  if (right === 0x80) {
    // Keep frequency unchanged
  } else if (right >= 0x81 && right <= 0xDF) {
    // Absolute note (C#0 = 0x81, B-7 = 0xDF)
    const absoluteNote = right - 0x81;
    const freq = noteNumberToFrequency(absoluteNote + 1); // +1 because C#0 is note 1
    setFrequency(voice, freq);
  } else if (right >= 0x60 && right <= 0x7F) {
    // Negative relative note
    const semitones = -(right - 0x5F);
    const freq = noteNumberToFrequency(state.baseNote + semitones);
    setFrequency(voice, freq);
  } else if (right >= 0x00 && right <= 0x5F) {
    // Positive relative note
    const freq = noteNumberToFrequency(state.baseNote + right);
    setFrequency(voice, freq);
  }

  state.wavePtr++;
  return true;
}

// Helper: note number to frequency
function noteNumberToFrequency(noteNum) {
  const A4 = 440;
  const C0 = A4 * Math.pow(2, -4.75);
  return C0 * Math.pow(2, noteNum / 12);
}
```

**Tasks:**
- [ ] Implement wavetable execution
- [ ] Add delay handling
- [ ] Add jump logic
- [ ] Add waveform changes
- [ ] Add note handling (relative/absolute)
- [ ] Add pattern command execution
- [ ] Test with simple wavetable programs

### Step 2.2: Integrate with Sequencer ✓
**File:** `sequencer.js`

```javascript
import { executeWavetable, executePulsetable, executeFiltertable, executeVibrato } from './table-manager.js';

// Add to step execution (called every tick)
function executeStep() {
  // ... existing pattern playback ...

  // Execute tables for all active voices
  for (let voice = 0; voice < 3; voice++) {
    if (voiceState[voice].active) {
      executeWavetable(voice);
      executePulsetable(voice);
      executeFiltertable(voice);
      executeVibrato(voice);
    }
  }
}
```

**Tasks:**
- [ ] Import table execution functions
- [ ] Call table execution every step
- [ ] Ensure correct timing (60Hz vs BPM)
- [ ] Test with sequencer playback

---

## Phase 3-5: Pulse/Filter/Speed Tables (Week 2-3)

### Step 3.1: Pulsetable Execution ✓
**File:** `table-manager.js`

```javascript
export function executePulsetable(voice) {
  const state = tableState[voice];
  if (state.pulsePtr < 0) return false;

  const left = tables.pulse.left[state.pulsePtr];
  const right = tables.pulse.right[state.pulsePtr];

  // Jump
  if (left === 0xFF) {
    state.pulsePtr = (right === 0x00) ? -1 : right;
    return state.pulsePtr >= 0;
  }

  // Set pulse width (0x80-0xFE)
  if (left >= 0x80 && left <= 0xFE) {
    const highNibble = left & 0x0F;
    const pulseWidth = (highNibble << 8) | right;
    setPulseWidth(voice, pulseWidth);
    state.pulsePtr++;
    return true;
  }

  // Modulation step (0x01-0x7F)
  if (left >= 0x01 && left <= 0x7F) {
    const time = left;
    const speed = (right >= 0x80) ? -(256 - right) : right;

    if (state.pulseModTime > 0) {
      state.pulseValue += speed;
      state.pulseValue = Math.max(0, Math.min(0x0FFF, state.pulseValue));
      setPulseWidth(voice, state.pulseValue);
      state.pulseModTime--;

      if (state.pulseModTime === 0) {
        state.pulsePtr++;
      }
    } else {
      state.pulseModTime = time;
    }
    return true;
  }

  return false;
}
```

### Step 4.1: Filtertable Execution ✓
**File:** `table-manager.js`

```javascript
export function executeFiltertable(voice) {
  const state = tableState[voice];
  if (state.filterPtr < 0) return false;

  const left = tables.filter.left[state.filterPtr];
  const right = tables.filter.right[state.filterPtr];

  // Jump
  if (left === 0xFF) {
    state.filterPtr = (right === 0x00) ? -1 : right;
    return state.filterPtr >= 0;
  }

  // Set filter parameters (0x80-0xF0)
  if (left >= 0x80 && left <= 0xF0) {
    const filterType = left & 0x70;
    const resonance = right & 0xF0;
    const channelMask = right & 0x0F;

    sidPlayer.synth.poke(0x17, resonance | channelMask);
    sidPlayer.synth.poke(0x18, filterType | (sidPlayer.synth.peek(0x18) & 0x0F));

    state.filterPtr++;

    // Check next entry for cutoff
    if (tables.filter.left[state.filterPtr] === 0x00) {
      const cutoff = tables.filter.right[state.filterPtr];
      sidPlayer.synth.poke(0x15, cutoff & 0x07);
      sidPlayer.synth.poke(0x16, cutoff >> 3);
      state.filterPtr++;
    }
    return true;
  }

  // Set cutoff (0x00)
  if (left === 0x00) {
    const cutoff = right;
    sidPlayer.synth.poke(0x15, cutoff & 0x07);
    sidPlayer.synth.poke(0x16, cutoff >> 3);
    state.filterPtr++;
    return true;
  }

  // Modulation step (0x01-0x7F)
  if (left >= 0x01 && left <= 0x7F) {
    // Similar to pulsetable modulation
    const time = left;
    const speed = (right >= 0x80) ? -(256 - right) : right;

    if (state.filterModTime > 0) {
      state.filterValue += speed;
      state.filterValue = Math.max(0, Math.min(0xFF, state.filterValue));

      sidPlayer.synth.poke(0x15, state.filterValue & 0x07);
      sidPlayer.synth.poke(0x16, state.filterValue >> 3);

      state.filterModTime--;
      if (state.filterModTime === 0) {
        state.filterPtr++;
      }
    } else {
      state.filterModTime = time;
    }
    return true;
  }

  return false;
}
```

### Step 5.1: Speedtable Vibrato ✓
**File:** `table-manager.js`

```javascript
export function executeVibrato(voice) {
  const state = tableState[voice];

  // Check vibrato delay
  if (state.vibDelay > 0) {
    state.vibDelay--;
    return false;
  }

  if (state.speedPtr < 0) return false;

  const speed = tables.speed.left[state.speedPtr];
  const depth = tables.speed.right[state.speedPtr];

  // Initialize vibrato
  if (state.vibCounter === 0) {
    state.vibCounter = speed;
    state.vibDirection = 1;
  }

  // Apply vibrato to frequency
  const voiceOffset = voice * VOICE_OFFSET;
  const currentFreqLo = sidPlayer.synth.peek(voiceOffset + FREQ_LO);
  const currentFreqHi = sidPlayer.synth.peek(voiceOffset + FREQ_HI);
  let currentFreq = (currentFreqHi << 8) | currentFreqLo;

  const pitchChange = depth * state.vibDirection;
  currentFreq += pitchChange;

  sidPlayer.synth.poke(voiceOffset + FREQ_LO, currentFreq & 0xFF);
  sidPlayer.synth.poke(voiceOffset + FREQ_HI, (currentFreq >> 8) & 0xFF);

  // Update counter and direction
  state.vibCounter--;
  if (state.vibCounter <= 0) {
    state.vibDirection = -state.vibDirection;
    state.vibCounter = speed;
  }

  return true;
}
```

**Tasks for Phases 3-5:**
- [ ] Implement pulsetable execution
- [ ] Implement filtertable execution
- [ ] Implement speedtable vibrato
- [ ] Test pulse width sweeps
- [ ] Test filter sweeps
- [ ] Test vibrato with various settings

---

## Phase 6: Pattern Commands (Week 3)

### Step 6.1: Add Table Control Commands ✓
**File:** `sequencer.js`

```javascript
// Pattern command handlers
function executePatternCommand(voice, command, dataByte) {
  switch (command) {
    case 0x0: // Do nothing
      break;

    case 0x8: // Set wavetable pointer
      if (dataByte === 0x00) {
        tableState[voice].wavePtr = -1;
      } else {
        tableState[voice].wavePtr = dataByte;
      }
      break;

    case 0x9: // Set pulsetable pointer
      if (dataByte === 0x00) {
        tableState[voice].pulsePtr = -1;
      } else {
        tableState[voice].pulsePtr = dataByte;
      }
      break;

    case 0xA: // Set filtertable pointer
      if (dataByte === 0x00) {
        tableState[voice].filterPtr = -1;
      } else {
        tableState[voice].filterPtr = dataByte;
      }
      break;

    case 0xB: // Set filter control
      if (dataByte === 0x00) {
        tableState[voice].filterPtr = -1; // Stop filtertable too
      }
      // Set filter control register
      sidPlayer.synth.poke(0x17, dataByte);
      break;

    case 0xC: // Set filter cutoff
      const cutoff = dataByte;
      sidPlayer.synth.poke(0x15, cutoff & 0x07);
      sidPlayer.synth.poke(0x16, cutoff >> 3);
      break;

    // ... existing commands (1-4 portamento/vibrato, 5-7 ADSR/waveform) ...
  }
}
```

**Tasks:**
- [ ] Add table control commands (8XY, 9XY, AXY)
- [ ] Update pattern editor to support new commands
- [ ] Add visual display of table commands in pattern
- [ ] Test dynamic table switching

---

## Phase 7-8: UI Integration (Week 4)

### Step 7.1: Instrument Editor Updates ✓
**File:** `instrument-editor.js`

```html
<!-- Add to instrument editor modal -->
<div id="tableSection">
  <h4>Table Pointers</h4>
  <div class="table-ptr-row">
    <label>Wave Table:</label>
    <input type="number" id="waveTablePtr" min="-1" max="255" value="-1">
    <span id="waveTableInfo"></span>
    <button id="editWaveTable">Edit Table →</button>
  </div>
  <div class="table-ptr-row">
    <label>Pulse Table:</label>
    <input type="number" id="pulseTablePtr" min="-1" max="255" value="-1">
    <span id="pulseTableInfo"></span>
    <button id="editPulseTable">Edit Table →</button>
  </div>
  <div class="table-ptr-row">
    <label>Filter Table:</label>
    <input type="number" id="filterTablePtr" min="-1" max="255" value="-1">
    <span id="filterTableInfo"></span>
    <button id="editFilterTable">Edit Table →</button>
  </div>
  <div class="table-ptr-row">
    <label>Speed Table:</label>
    <input type="number" id="speedTablePtr" min="-1" max="255" value="-1">
    <span id="speedTableInfo"></span>
    <button id="editSpeedTable">Edit Table →</button>
  </div>
</div>

<div id="gt2ParamsSection">
  <h4>Advanced Parameters</h4>
  <label>Vibrato Delay: <input type="number" id="vibDelay" min="0" max="255"></label>
  <label>Gate Timer: <input type="number" id="gateTimer" min="0" max="255"></label>
  <label>First Wave: <input type="number" id="firstWave" min="0" max="255"></label>
</div>
```

```javascript
// Update instrument editor JavaScript
function loadInstrumentToEditor(instrIndex) {
  const instr = instruments[instrIndex];

  // ... existing ADSR, waveform, etc. ...

  // Load table pointers
  document.getElementById('waveTablePtr').value = instr.tables.wave;
  document.getElementById('pulseTablePtr').value = instr.tables.pulse;
  document.getElementById('filterTablePtr').value = instr.tables.filter;
  document.getElementById('speedTablePtr').value = instr.tables.speed;

  // Load GT2 params
  document.getElementById('vibDelay').value = instr.vibratoDelay;
  document.getElementById('gateTimer').value = instr.gateTimer;
  document.getElementById('firstWave').value = instr.firstWave;

  // Update table info displays
  updateTableInfo();
}

function saveInstrumentFromEditor(instrIndex) {
  const instr = instruments[instrIndex];

  // ... save existing params ...

  // Save table pointers
  instr.tables.wave = parseInt(document.getElementById('waveTablePtr').value);
  instr.tables.pulse = parseInt(document.getElementById('pulseTablePtr').value);
  instr.tables.filter = parseInt(document.getElementById('filterTablePtr').value);
  instr.tables.speed = parseInt(document.getElementById('speedTablePtr').value);

  // Save GT2 params
  instr.vibratoDelay = parseInt(document.getElementById('vibDelay').value);
  instr.gateTimer = parseInt(document.getElementById('gateTimer').value);
  instr.firstWave = parseInt(document.getElementById('firstWave').value);
}

function updateTableInfo() {
  // Show table length and first few values
  const wavePtr = parseInt(document.getElementById('waveTablePtr').value);
  if (wavePtr >= 0) {
    const len = getTableLength('wave', wavePtr);
    document.getElementById('waveTableInfo').textContent = `(${len} steps)`;
  }
  // Similar for other tables...
}
```

### Step 8.1: Create Table Editor UI ✓
**File:** `table-editor.js`

```html
<!-- Table Editor Modal -->
<div id="tableEditorModal" class="modal">
  <div class="modal-content">
    <h2>Table Editor</h2>

    <div class="table-selector">
      <button id="selectWaveTable">Wave</button>
      <button id="selectPulseTable">Pulse</button>
      <button id="selectFilterTable">Filter</button>
      <button id="selectSpeedTable">Speed</button>
    </div>

    <div class="table-grid">
      <table id="tableEditor">
        <thead>
          <tr>
            <th>Pos</th>
            <th>Left</th>
            <th>Right</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody id="tableRows">
          <!-- Dynamically populated -->
        </tbody>
      </table>
    </div>

    <div class="table-controls">
      <input type="number" id="tableStartPos" min="0" max="255" value="0">
      <button id="insertTableRow">Insert Row</button>
      <button id="deleteTableRow">Delete Row</button>
      <button id="optimizeTable">Optimize</button>
    </div>

    <button id="closeTableEditor">Close</button>
  </div>
</div>
```

```javascript
// Table editor implementation
let currentTableType = 'wave';
let currentTablePos = 0;

function openTableEditor(tableType, startPos = 0) {
  currentTableType = tableType;
  currentTablePos = startPos;

  document.getElementById('tableEditorModal').style.display = 'block';
  renderTableEditor();
}

function renderTableEditor() {
  const table = tables[currentTableType];
  const tbody = document.getElementById('tableRows');
  tbody.innerHTML = '';

  for (let i = 0; i < 32; i++) {  // Show 32 rows at a time
    const pos = currentTablePos + i;
    if (pos >= 256) break;

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${pos.toString(16).padStart(2, '0').toUpperCase()}</td>
      <td><input type="text" value="${table.left[pos].toString(16).padStart(2, '0').toUpperCase()}"
          data-pos="${pos}" data-column="left" maxlength="2"></td>
      <td><input type="text" value="${table.right[pos].toString(16).padStart(2, '0').toUpperCase()}"
          data-pos="${pos}" data-column="right" maxlength="2"></td>
      <td>${describeTableEntry(currentTableType, table.left[pos], table.right[pos])}</td>
    `;
    tbody.appendChild(row);

    // Stop at jump-to-stop
    if (table.left[pos] === 0xFF && table.right[pos] === 0x00) break;
  }

  // Add input handlers
  tbody.querySelectorAll('input').forEach(input => {
    input.addEventListener('change', handleTableInputChange);
  });
}

function handleTableInputChange(event) {
  const pos = parseInt(event.target.dataset.pos);
  const column = event.target.dataset.column;
  const value = parseInt(event.target.value, 16);

  if (isNaN(value) || value < 0 || value > 255) {
    event.target.value = '00';
    return;
  }

  tables[currentTableType][column][pos] = value;
  renderTableEditor();  // Re-render to update descriptions
}

function describeTableEntry(tableType, left, right) {
  if (tableType === 'wave') {
    if (left === 0xFF) return right === 0x00 ? 'Stop' : `Jump → ${right}`;
    if (left >= 0xF0) return `Cmd ${(left & 0x0F).toString(16)}, ${right.toString(16)}`;
    if (left >= 0xE0) return `Silent waveform ${left - 0xE0}, Note ${right}`;
    if (left >= 0x10) {
      const waveNames = { 0x10: 'Tri', 0x20: 'Saw', 0x40: 'Pulse', 0x80: 'Noise' };
      const waveName = waveNames[left & 0xF0] || 'Unknown';
      const noteStr = right === 0x80 ? 'Keep' : `+${right}`;
      return `${waveName}, ${noteStr}`;
    }
    if (left >= 0x01) return `Delay ${left} frames`;
    return 'No change';
  }
  // Similar for pulse, filter, speed tables...
  return '';
}
```

**Tasks:**
- [ ] Create instrument editor table section HTML/CSS
- [ ] Add table pointer inputs to instrument editor
- [ ] Implement "Edit Table" jump buttons
- [ ] Create table editor modal HTML/CSS
- [ ] Implement table editor rendering
- [ ] Add table editing (insert/delete/modify)
- [ ] Add table descriptions/tooltips
- [ ] Test UI workflow

---

## Phase 9: Testing & Polish (Week 5)

### Comprehensive Test Suite

```javascript
// test-tables.js - Automated table testing

function testWavetable() {
  console.log('Testing wavetable...');

  // Test 1: Simple waveform change
  tables.wave.left[0] = 0x11;  // Triangle
  tables.wave.right[0] = 0x00;
  tables.wave.left[1] = 0xFF;
  tables.wave.right[1] = 0x00;
  // ... execute and verify

  // Test 2: Arpeggio
  // Test 3: Delays
  // Test 4: Jumps
  // Test 5: Command execution
}

function testPulsetable() {
  console.log('Testing pulsetable...');
  // Similar tests for pulse modulation
}

function testFiltertable() {
  console.log('Testing filtertable...');
  // Filter sweep tests
}

function testSpeedtable() {
  console.log('Testing speedtable vibrato...');
  // Vibrato tests
}

function testBackwardCompatibility() {
  console.log('Testing backward compatibility...');

  // Test old LFO instruments still work
  // Test migration to tables
  // Test old songs load correctly
}

// Run all tests
function runAllTests() {
  testWavetable();
  testPulsetable();
  testFiltertable();
  testSpeedtable();
  testBackwardCompatibility();
  console.log('All tests complete!');
}
```

**Test Checklist:**
- [ ] Wavetable waveform changes
- [ ] Wavetable relative notes
- [ ] Wavetable absolute notes
- [ ] Wavetable delays
- [ ] Wavetable jumps/loops
- [ ] Wavetable command execution
- [ ] Pulsetable set pulse width
- [ ] Pulsetable modulation
- [ ] Filtertable cutoff setting
- [ ] Filtertable parameter changes
- [ ] Filtertable modulation sweeps
- [ ] Speedtable vibrato
- [ ] Pattern commands (8XY, 9XY, AXY)
- [ ] Multiple tables per instrument
- [ ] LFO → table migration
- [ ] Old instruments still work
- [ ] AudioWorklet integration
- [ ] Save/load with tables
- [ ] Table optimization
- [ ] Edge cases (jumps to jumps, etc.)

---

## Implementation Timeline Summary

**Week 1: Foundation**
- Create table-manager.js
- Update instrument structure
- Basic wavetable execution
- Integration with playNote

**Week 2: Core Tables**
- Complete wavetable features
- Pulsetable execution
- Filtertable execution

**Week 3: Advanced Features**
- Speedtable vibrato
- Pattern commands
- Table optimization

**Week 4: UI**
- Instrument editor updates
- Table editor creation
- Visual feedback

**Week 5: Testing & Polish**
- Comprehensive testing
- Bug fixes
- Documentation
- Migration guides

---

## Success Metrics

1. **Functional**: All 4 table types work correctly
2. **Performant**: No audio glitches, maintains 60fps
3. **Compatible**: Old instruments/songs work unchanged
4. **Usable**: Intuitive UI, clear documentation
5. **Authentic**: Matches GoatTracker2 behavior

## Next Steps

1. Begin Phase 1: Create table-manager.js module
2. Set up basic table storage and state
3. Implement first wavetable program test
4. Verify integration with playNote function
5. Test with simple instrument

Start with the fundamentals and build incrementally, testing each component before moving to the next phase!
