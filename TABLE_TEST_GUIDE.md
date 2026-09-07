# GT2 Table System - Quick Test Guide

## What I've Done

I've activated the GT2 table system that was already partially implemented in your codebase. Here's what changed:

### 1. **Enabled Table Usage in Instruments**

- **"PWM Test" instrument** → Now uses pulsetable 0 (was disabled with `-1`)
- **"Arp Major" instrument** → Now uses wavetable 0 (was disabled with `-1`)
- **"Sync Lead" instrument** → Already had wave & filter tables enabled

### 2. **Enhanced Debug Output**

Added console logging to track:
- ✅ GT2 Frame Engine start
- 🎵 Table trigger events (when notes play)
- 📊 Per-frame table execution (wave/pulse/filter values)
- ⏸️ Frame engine pause when tables finish

### 3. **Default Tables Already Configured**

The `table-manager-gt2.js` already has working default tables:

**WTBL 0 (Wavetable):**
```
Pos 0: $21, $00  → Sawtooth, base note
Pos 1: $00, $04  → No wave change, +4 semitones
Pos 2: $00, $07  → No wave change, +7 semitones
Pos 3: $FF, $01  → Jump to position 1
```
Result: Sawtooth arpeggio (root, major 3rd, perfect 5th)

**PTBL 0 (Pulsetable):**
```
Pos 0: $88, $00  → Set pulse $800 (center)
Pos 1: $20, $40  → 32 ticks, speed +$40
Pos 2: $40, $E0  → 64 ticks, speed -$20
Pos 3: $FF, $01  → Jump to position 1
```
Result: Triangle wave PWM sweep

## How to Test

### Test 1: Wavetable Arpeggio
1. Open `index.html` in your browser
2. Open browser console (F12)
3. Select instrument **"Arp Major" (index 8)**
4. Play a note (keyboard or sequencer)
5. **Expected console output:**
   ```
   🎵 GT2 Frame Engine: Triggered tables for voice X - wave:0, pulse:-1, filter:-1, speed:-1
   ✅ GT2 Frame Engine started at 50Hz
   📊 V0 Wave: waveform=21, note=0
   📊 V0 Wave: waveform=0, note=4
   📊 V0 Wave: waveform=0, note=7
   📊 V0 Wave: waveform=21, note=0  (looped back)
   ```
6. **Expected audio:** Sawtooth wave arpeggios through major chord

### Test 2: Pulsetable PWM
1. Select instrument **"PWM Test" (index 4)**
2. Play a note
3. **Expected console output:**
   ```
   🎵 GT2 Frame Engine: Triggered tables for voice X - wave:-1, pulse:0, filter:-1, speed:-1
   ✅ GT2 Frame Engine started at 50Hz
   📊 V0 Pulse: $800
   📊 V0 Pulse: $840
   📊 V0 Pulse: $880
   ... (sweeping)
   ```
4. **Expected audio:** Pulse wave with PWM effect (sweeping timbre)

### Test 3: Combined Wave + Filter
1. Select instrument **"Sync Lead" (index 6)**
2. Play a note
3. **Expected console output:**
   ```
   🎵 GT2 Frame Engine: Triggered tables for voice X - wave:0, pulse:-1, filter:0, speed:-1
   📊 V0 Wave: ...
   📊 V0 Filter: ...
   ```
4. **Expected audio:** Sync lead with filter sweep

## Troubleshooting

### Issue: No console output
**Cause:** Tables might not be triggering
**Check:**
- Verify instrument has `tables: { wave: 0, pulse: 0, ... }` (not -1)
- Check sequencer is calling `gt2FrameEngine.triggerNoteTables()`

### Issue: "GT2 Frame Engine already running" but no frame output
**Cause:** Frame loop may have stopped
**Solution:** Refresh page and try again

### Issue: Tables execute but no audio changes
**Cause:** SID register writes might not be applying
**Check:**
- Open sequencer.js line 457 - ensure `triggerNoteTables()` is called
- Verify `setSIDRegister()` function is working in synth.js

## Current Architecture

```
sequencer.js (play note)
    ↓
gt2FrameEngine.triggerNoteTables(voice, note, instrument)
    ↓
GT2TablePlaybackState.startTables() [per voice]
    ↓
gt2FrameEngine.start() [if not running]
    ↓
requestAnimationFrame loop @ 50Hz
    ↓
GT2TablePlaybackState.executeWavetable/Pulsetable/etc()
    ↓
setSIDRegister() → SID chip
```

## Next Steps

Once you confirm tables are working:

1. **Create custom tables** using the table editor (already exists in `table-editor-gt2.js`)
2. **Fine-tune default tables** for better sound
3. **Add more table-based instruments**
4. **Integrate with pattern editor** to allow table pointer changes mid-pattern

## Quick Reference

### Wavetable Commands (Left Byte)
- `$00` = No waveform change
- `$01-$0F` = Delay 1-15 frames
- `$10-$DF` = Set waveform
- `$E0-$EF` = Inaudible waveform (testbit)
- `$F0-$FE` = Pattern command
- `$FF` = Jump (right byte = position, $00 = stop)

### Wavetable Note Values (Right Byte)
- `$00-$5F` = Relative note +0 to +95
- `$60-$7F` = Relative note -1 to -32
- `$80` = Keep frequency unchanged
- `$81-$DF` = Absolute note C#0 to B-7

### Pulsetable Commands (Left Byte)
- `$01-$7F` = Modulation (ticks), right = speed
- `$80-$FE` = Set pulse width directly
- `$FF` = Jump

## Files Modified

1. **synth.js** - Updated instruments to use tables
2. **gt2-frame-engine.js** - Enhanced debug output

## Files Already Present (No Changes Needed)

1. **table-manager-gt2.js** - Table storage & execution logic ✅
2. **gt2-frame-engine.js** - Frame-based execution engine ✅
3. **table-editor-gt2.js** - UI for editing tables ✅
4. **sequencer.js** - Calls to trigger tables ✅

The table system is **ready to test!** Just load the page and try the instruments listed above.
