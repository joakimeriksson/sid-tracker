# Pattern Commands - Testing Guide

## ✅ What's Been Implemented

### Phase 1: Basic Integration (COMPLETE)

**Files Modified:**
1. ✅ `sequencer-gt2.js` - Imported patternCommandEngine
2. ✅ `worklet/sid-processor.body.js` - Read command/cmdData from patterns, send to main thread
3. ✅ `synth.js` - Added 'executeCommand' message handler
4. ✅ `sid-processor.bundle.js` - Rebuilt with command execution

**How It Works:**
1. Worklet reads pattern data including `command` and `cmdData` fields
2. When command > 0, worklet sends 'executeCommand' message to main thread
3. Main thread receives message and calls `patternCommandEngine.executeCommand()`
4. Command engine executes the command (writes SID registers, triggers tables, etc.)

---

## 🧪 How to Test

### Prerequisites
1. **Web server running**: http://localhost:8080/
2. **Browser console open**: Press F12 to see command execution logs

### Test 1: Verify Command Reading

**Steps:**
1. Open http://localhost:8080/ in your browser
2. Open browser console (F12)
3. Click **Import GT2** button
4. Select a GoatTracker2 .sng file that has commands
5. Click **Play**

**Expected Result:**
- Console shows: `Command executed: V0 cmd=X data=XX` for each command
- Commands displayed in pattern editor (you can see them in the CMD and DATA columns)

---

### Test 2: One-Shot Commands (Most Likely to Work)

**Commands that should work immediately:**

| Cmd | Name | How to Test |
|-----|------|-------------|
| **5XY** | Set AD | Listen for attack/decay changes |
| **6XY** | Set SR | Listen for sustain/release changes |
| **7XY** | Set Wave | Listen for waveform changes |
| **8XY** | Wave Ptr | Check if wavetable execution changes |
| **9XY** | Pulse Ptr | Check if pulse modulation changes |
| **AXY** | Filter Ptr | Check if filter modulation changes |
| **BXY** | Filter Ctrl | Listen for filter enable/disable |
| **CXY** | Filter Cut | Listen for filter cutoff changes |
| **DXY** | Master Vol | Listen for volume changes |
| **FXY** | Set Tempo | Notice tempo changes |

**What to Look For:**
- Console logs showing commands executing
- Audible changes when commands execute
- No JavaScript errors in console

---

### Test 3: Realtime Commands (May Not Work Smoothly Yet)

**Commands that need tick-based execution:**

| Cmd | Name | Current Status |
|-----|------|----------------|
| **1XY** | Porta Up | ⚠️ Step-level only (not smooth) |
| **2XY** | Porta Down | ⚠️ Step-level only (not smooth) |
| **3XY** | Toneporta | ⚠️ Step-level only (not smooth) |
| **4XY** | Vibrato | ⚠️ Step-level only (not smooth) |

**Expected Behavior:**
- Commands execute, but pitch changes happen once per row (not smooth)
- Console shows commands executing
- May hear "stepping" instead of smooth sliding

**Why Not Smooth:**
- Need tick-based execution (Phase 2)
- Currently executes once per pattern row
- GT2 executes on each tick (6 times per row at tempo 6)

---

## 🔍 Debugging

### Console Messages

**Good:**
```
Command executed: V0 cmd=4 data=1
Command executed: V1 cmd=b data=f1
```
This means commands are being recognized and executed!

**Warning:**
```
Failed to execute pattern command: ...
```
Check if pattern-commands.js loaded correctly

**Error:**
```
Unknown command: X XX
```
Command number is outside 0-F range (shouldn't happen)

---

### Common Issues

**1. Commands Not Executing**
- Check browser console for errors
- Verify worklet bundle was rebuilt: `tools/build-worklet.sh`
- Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)

**2. No Audible Effect**
- Some commands are subtle (ADSR changes)
- Try commands with obvious effects first (BXY filter, FXY tempo)
- Check if the instrument/pattern uses the affected parameters

**3. Console Flooded with Messages**
- Normal! Commands execute on every pattern row
- Filter console to show only "Command executed" if needed

---

## 📝 Test Checklist

### Basic Integration Test

- [ ] Import a GT2 song with commands
- [ ] Open browser console
- [ ] Click Play
- [ ] See "Command executed" messages in console
- [ ] No JavaScript errors
- [ ] Song plays (even if commands don't sound perfect)

### One-Shot Command Test

- [ ] Find pattern with command BXY (filter control)
- [ ] Play pattern
- [ ] Hear filter turn on/off
- [ ] Console shows command execution

### Realtime Command Test

- [ ] Find pattern with command 4XY (vibrato)
- [ ] Play pattern
- [ ] Hear pitch modulation (may be steppy)
- [ ] Console shows command execution

---

## 🚀 Next Steps

**If Basic Test Passes:**
→ Proceed to Phase 2: Tick-based execution for smooth portamento/vibrato

**If Basic Test Fails:**
1. Check console errors
2. Verify worklet rebuild
3. Hard refresh browser
4. Check pattern data has command/cmdData fields

---

## 📊 Expected Results

### ✅ Success Criteria

**Minimum (Basic Integration Working):**
- Commands appear in console logs
- No JavaScript errors
- At least one audible command effect (filter, tempo, ADSR)

**Good (Most Commands Working):**
- One-shot commands (5-F) work correctly
- Table pointer commands (8-A) trigger frame engine
- Filter/tempo commands audible

**Excellent (All Commands Working):**
- Realtime commands (1-4) execute (even if not smooth)
- All 16 command types logged in console
- Imported GT2 songs sound close to original

---

## 🎵 Sample Test Pattern

If you want to create a test pattern manually:

**Pattern with commands:**
```
Row | Note | Inst | Cmd | Data
00  | C-4  | 01   | 04  | 01    (Vibrato)
01  | ---  | 00   | 00  | 00
02  | ---  | 00   | 00  | 00
03  | ---  | 00   | 00  | 00
04  | E-4  | 01   | 01  | 01    (Porta Up)
05  | ---  | 00   | 00  | 00
```

This pattern:
- Plays C-4 with vibrato
- After 4 rows, plays E-4 with portamento up

---

*Last Updated: 2025-11-02*
*Status: Phase 1 Complete - Ready for Testing*
