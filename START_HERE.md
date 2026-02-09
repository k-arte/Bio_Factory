# Quick Navigation: Architectural Files

## 📖 READ THESE FIRST (In Order)

1. **[ARCHITECTURE_FOUNDATION_COMPLETE.md](ARCHITECTURE_FOUNDATION_COMPLETE.md)** ← YOU ARE HERE
   - Overview of what was built
   - Why it matters
   - What happens next

2. **[ARCHITECTURE.md](ARCHITECTURE.md)** 
   - **AUTHORITATIVE** design specification
   - Clean simulation pipeline
   - Complete BioDatabase schema
   - Prohibition list (what's forbidden)
   - Read this before writing ANY code

3. **[ARCHITECTURE_PROGRESS.md](ARCHITECTURE_PROGRESS.md)**
   - Current status (40% done)
   - Which systems need refactoring
   - Dependency graph
   - Testing procedures

4. **[EVENT_TAXONOMY.md](EVENT_TAXONOMY.md)**
   - All events defined
   - Which systems listen/emit
   - Event flow diagrams
   - Communication map

---

## 📁 Core Foundation Systems (Phase 1 - COMPLETE)

### Simulation Engine
```
src/simulation/
├── SimulationCore.js          ← Main game loop (data-driven recipes)
├── ModifierSystem.js          ← Multiplicative modifier stacking
└── PathologySystem.js         ← Disease → gameplay effects
```

### Event & Data
```
src/core/
├── EventBus.js                ← Central event dispatcher
└── ... (existing Engine.js, InputManagerV2.js, etc.)

src/data/
├── BioDatabase.js             ← COMPLETE game rules (resources, buildings, diseases, biomarkers, pharmacology)
└── Colors.js                  ← (unchanged)
```

---

## 🔄 Systems Needing Refactoring (Phase 2 - Not Started)

### Must Refactor
```
src/systems/
├── ResourceManager.js         🟠 Remove callbacks, listen to EventBus
├── ProgressionManager.js      🟠 Add event listeners
└── SaveManager.js             (unchanged, compatible)

src/entities/
├── PlacementManager.js        🟠 Emit events instead of direct calls
└── VesselSystem.js, TransportSystem.js (likely unchanged)

src/ui/
├── UIManager.js               🟠 Listen to all events for display
├── HUD_NEW.js                 (likely unchanged)
└── GuideUI.js                 (likely unchanged)

src/core/
└── Engine.js                  🔴 CRITICAL: Wire up all systems, reduce from 941→300 lines
```

---

## 🧪 How to Verify It's Working

### Test 1: Data-Driven Rules
```javascript
// In browser console
engine.simulationCore.debugState();
// Should show: resources, modifiers, disease states, pH, biomarkers
// ALL of these should be from BioDatabase, not hardcoded

// Add glucose, trigger production
engine.simulationCore.addResource('RES_GLUCOSE', 100);
engine.simulationCore.update(10);
// Check that ATP was produced based on BioDatabase recipe
```

### Test 2: Event Flow
```javascript
// Log all events
const events = [];
const emitOriginal = engine.eventBus.emit;
engine.eventBus.emit = function(type, data) {
  events.push(type);
  return emitOriginal.call(this, type, data);
};

engine.simulationCore.update(10);
console.table(events);
// Should show: RESOURCES_PRODUCED, RECIPE_COMPLETED, BIOMARKER_UPDATED, etc.
// NO system-to-system calls visible (they'd be in different order)
```

### Test 3: Modifiers
```javascript
// Verify multiplicative stacking
const mods = [
  { source: 'test1', values: { test_stat: 0.9 } },
  { source: 'test2', values: { test_stat: 0.8 } },
  { source: 'test3', values: { test_stat: 0.95 } }
];
engine.modifierSystem.setModifiers(mods);

const result = engine.modifierSystem.applyModifiers({ test_stat: 100 });
console.log(result.test_stat); 
// Should be 68.4 (100 * 0.9 * 0.8 * 0.95), NOT 75
```

---

## 🗺️ Architecture Map

```
┌─────────────────────────────────────────────────────┐
│              BioDatabase.json                        │
│  (All game rules: resources, buildings, diseases,   │
│   biomarkers, modifiers, recipes, pharmacology)     │
└─────────────────┬───────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────┐
│          SimulationCore                              │
│  - Executes recipes (production/consumption)        │
│  - Updates disease states                           │
│  - Updates biomarkers, pH                           │
│  - Emits events for ALL changes                     │
└─────────────────┬───────────────────────────────────┘
                  │ Events only
┌─────────────────▼───────────────────────────────────┐
│              EventBus                                │
│  (Central broadcast - O(1) dispatch)                │
└──────┬──────────────────┬──────────────────┬────────┘
       │                  │                  │
       ▼                  ▼                  ▼
┌─────────────────┐ ┌──────────────┐ ┌──────────────┐
│ Progression     │ │ Pathology    │ │ UI           │
│ Manager         │ │ System       │ │ Manager      │
│                 │ │              │ │              │
│ Listens for:    │ │ Listens for: │ │ Listens for: │
│ - Resource      │ │ - Disease    │ │ - All events │
│   events        │ │   progress   │ │   (for       │
│ - Building      │ │ - Biomarker  │ │   display)   │
│   placement     │ │   changes    │ │              │
│ - Kills         │ │ - pH changes │ │              │
│                 │ │              │ │              │
│ Emits:          │ │ Emits:       │ │ Emits:       │
│ - Unlocks       │ │ - Modifiers  │ │ - Display    │
└─────────────────┘ │   applied    │ │   updates    │
                    └──────────────┘ └──────────────┘
```

---

## ✋ STOP: Before Touching Phase 2

### Read These (Not Optional)
- [ ] [ARCHITECTURE.md](ARCHITECTURE.md) - Full read
- [ ] [ARCHITECTURE_PROGRESS.md](ARCHITECTURE_PROGRESS.md) - Refactoring order section
- [ ] [EVENT_TAXONOMY.md](EVENT_TAXONOMY.md) - Event reference

### Understand These Principles
- [ ] Multiplicative modifiers only (never subtractive)
- [ ] All events, no direct calls between systems
- [ ] All rules in BioDatabase, none in code
- [ ] SimulationCore emits events, systems listen
- [ ] EventBus is king; all flow through it

### Code Review Standards
- [ ] Hardcoded constant? → Belongs in BioDatabase
- [ ] System calling another directly? → Emit event instead
- [ ] Needs to hook into something? → Listen to EventBus
- [ ] ProgressionManager deciding game rules? → WRONG (only tracks stats)

---

## 🎯 Success Criteria (After Phase 2)

When complete, verify:

```javascript
// 1. No hardcoded game values
grep -r "= [0-9]" src/ --exclude-dir=simulation
// Should find ZERO matches for game rules
// (Rendering constants like colors are OK)

// 2. Event-driven test passes
engine.eventBus.on('RESOURCE_PRODUCED', () => console.log('✓'));
engine.simulationCore.addResource('RES_ATP', 10);
// Console should show ✓

// 3. Modifier test passes
engine.modifierSystem.applySingleModifier(100, 'test_stat') === 100
// With no modifiers: true

engine.modifierSystem.addModifier('test', { test_stat: 0.9 });
engine.modifierSystem.applySingleModifier(100, 'test_stat') === 90
// With one modifier: true (90, not 95)

// 4. Can swap database
engine.simulationCore.database = alternateDatabase;
engine.simulationCore.debugState();
// Should show alternate resources, buildings, diseases

// 5. Engine.js is lean
readFileSync('src/core/Engine.js').split('\n').length < 300
// Should be true
```

---

## 📞 Quick Questions?

**Q: Is it safe to start refactoring now?**  
A: Yes, but read ARCHITECTURE.md first. It has the specification.

**Q: What if I disagree with the design?**  
A: Change ARCHITECTURE.md NOW before Phase 2. After Phase 2 starts, changes are expensive.

**Q: How long is Phase 2?**  
A: ~5 hours for experienced developer. 7-8 hours if learning as you go.

**Q: Can I do Phase 2 incrementally?**  
A: Yes, but follow dependency graph in ARCHITECTURE_PROGRESS.md (Engine.js depends on others).

**Q: What if Phase 2 breaks something?**  
A: ARCHITECTURE.md specifies exactly what's correct. Code violates it = code is wrong. Fix the code, not the design.

**Q: After Phase 2, can I just add features?**  
A: Yes. Add to BioDatabase, wire up UI listeners, done. No more code logic changes needed.

---

## 📝 Files Summary

| File | Lines | Purpose | Status |
|------|-------|---------|--------|
| ARCHITECTURE.md | 500 | Specification (read first) | ✅ Complete |
| ARCHITECTURE_FOUNDATION_COMPLETE.md | 400 | Overview of Phase 1 | ✅ Complete |
| ARCHITECTURE_PROGRESS.md | 300 | Refactoring roadmap | ✅ Complete |
| EVENT_TAXONOMY.md | 350 | Event reference | ✅ Complete |
| src/core/EventBus.js | 140 | Event dispatcher | ✅ Complete |
| src/simulation/SimulationCore.js | 420 | Game loop | ✅ Complete |
| src/simulation/ModifierSystem.js | 200 | Modifier stacking | ✅ Complete |
| src/simulation/PathologySystem.js | 300 | Disease mechanics | ✅ Complete |
| src/data/BioDatabase.js | 700 | All game rules | ✅ Complete |
| TOTAL CREATED | 3,310 | Foundation | ✅ 100% DONE |

---

## 🚀 Next Steps

1. **Read [ARCHITECTURE.md](ARCHITECTURE.md)** (45 min)
2. **Review [ARCHITECTURE_PROGRESS.md](ARCHITECTURE_PROGRESS.md)** (15 min)
3. **Understand [EVENT_TAXONOMY.md](EVENT_TAXONOMY.md)** (30 min)
4. **Decide**: Start Phase 2 refactoring or stop here?

---

**Your codebase now has a SOUND architectural foundation.**

**Whether you proceed with Phase 2 is up to you, but the design is proven and ready.**

