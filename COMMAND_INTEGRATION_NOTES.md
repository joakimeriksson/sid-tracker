# Pattern Command Integration Notes

## Current Status

Created `pattern-commands.js` with all 16 GT2 pattern commands (0XY-FXY) implemented.

## Integration Challenges

### Tick-Based Execution

GoatTracker2 commands operate at the **tick level**, not the step level:
- Each pattern row = multiple ticks (tempo value)
- Example: Tempo 6 = each row has 6 ticks (@ 50Hz = 300ms per row)
- Realtime commands (1XY-4XY) execute on **each tick**
- One-shot commands (5XY-FXY) execute on **tick 0 only**

### Current Architecture Gap

The AudioWorklet currently operates in **step mode**:
- `handleSequencerStep()` triggers once per pattern row
- No tick subdivision within rows
- Commands need tick-level timing for portamento/vibrato

### Solution: Two-Phase Integration

#### Phase 1: Basic Command Recognition (CURRENT)
- ✅ Pattern data stores command/cmdData
- ✅ Command engine created with all 16 commands
- ⚠️ Commands execute at step level (not tick level yet)
- Use case: Test command parsing, table pointers, one-shot commands

#### Phase 2: Tick-Based Execution (NEXT)
- Add tick subdivision to AudioWorklet
- Execute realtime commands on each tick
- Proper portamento/vibrato smoothness
- Match GT2 timing exactly

## Integration Steps

### Step 1: Pattern Data Structure ✅
Patterns already support command/cmdData fields (4 bytes per row):
```javascript
{
  note: 'C-4',      // Note name
  instrument: 1,    // Instrument index
  command: 0x4,     // Command (0-F)
  cmdData: 0x01     // Parameter (00-FF)
}
```

### Step 2: Command Engine ✅
Created `pattern-commands.js` with:
- All 16 commands implemented
- Speedtable integration
- Filter control
- ADSR modification
- Tempo changes

### Step 3: Sequencer Integration (IN PROGRESS)
Need to:
1. ✅ Import patternCommandEngine in sequencer-gt2.js
2. ⚠️ Call command engine when playing pattern rows
3. ⚠️ Handle realtime command continuation
4. ⚠️ Add tick-based timing

### Step 4: Worklet Integration (TODO)
Need to:
1. Add command/cmdData to worklet pattern data
2. Execute commands in handleSequencerStep
3. Add tick subdivision loop
4. Run realtime commands on each tick

## Command Testing Strategy

### Without Tick-Based Execution
Can test:
- ✅ Command 0XY (do nothing)
- ✅ Commands 5-7XY (ADSR, waveform - one-shot)
- ✅ Commands 8-AXY (table pointers)
- ✅ Commands B-CXY (filter control)
- ✅ Command DXY (master volume)
- ✅ Command FXY (tempo changes)

Cannot fully test:
- ❌ Commands 1-2XY (portamento - needs ticks)
- ❌ Command 3XY (toneportamento - needs ticks)
- ❌ Command 4XY (vibrato - needs ticks)
- ❌ Command EXY (funktempo - needs per-row tempo switching)

### With Tick-Based Execution
All commands work correctly with smooth modulation.

## Next Immediate Steps

1. **Add command import to main.js** ✅
2. **Update pattern editor to show commands**
   - Display command column in GT2 pattern editor
   - Allow editing command/cmdData values
   - Color-code command types

3. **Basic command execution**
   - Call patternCommandEngine.executeCommand() in sequencer
   - Test one-shot commands (5-7, 8-A, B-C, D, F)
   - Verify table pointers work

4. **Add tick subdivision**
   - Modify worklet to loop ticks within each step
   - Call realtime commands on each tick
   - Test portamento/vibrato smoothness

## Pattern Command Quick Reference

| Cmd | Name | Type | Description |
|-----|------|------|-------------|
| 0XY | Do Nothing | - | Stop realtime effects |
| 1XY | Porta Up | Realtime | Increase pitch (speedtable) |
| 2XY | Porta Down | Realtime | Decrease pitch (speedtable) |
| 3XY | Toneporta | Realtime | Slide to target note |
| 4XY | Vibrato | Realtime | Pitch modulation (speedtable) |
| 5XY | Set AD | One-shot | Attack/Decay register |
| 6XY | Set SR | One-shot | Sustain/Release register |
| 7XY | Set Wave | One-shot | Waveform register |
| 8XY | Wave Ptr | One-shot | Wavetable pointer |
| 9XY | Pulse Ptr | One-shot | Pulsetable pointer |
| AXY | Filter Ptr | One-shot | Filtertable pointer |
| BXY | Filter Ctrl | One-shot | Resonance + channel mask |
| CXY | Filter Cut | One-shot | Filter cutoff |
| DXY | Master Vol | One-shot | Volume or timing mark |
| EXY | Funktempo | One-shot | Alternating tempo |
| FXY | Set Tempo | One-shot | Global or per-channel |

## Realtime vs One-Shot Behavior

**Realtime commands (1-4):**
- Execute on tick 0 and continue on subsequent ticks
- Stop when command 0 or new note encountered
- Can "run underneath" one-shot commands

**One-shot commands (5-F):**
- Execute only on tick 0
- Don't interrupt realtime commands
- Example: Vibrato + ADSR change = both work together

## Implementation Priority

1. ✅ **Create command engine** - DONE
2. ⚠️ **Basic integration** - IN PROGRESS
3. ⚠️ **Pattern editor command display** - TODO
4. ⚠️ **One-shot command testing** - TODO
5. ⚠️ **Tick-based execution** - TODO (Week 2)
6. ⚠️ **Realtime command testing** - TODO (Week 2)

---

*Last Updated: 2025-11-02*
*Phase: Basic Command Integration*
