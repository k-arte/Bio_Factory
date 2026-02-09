# Event Taxonomy & System Communication Map

**Purpose**: Define all events in the system and which systems should listen to them  
**Audience**: Developers refactoring existing systems  
**Status**: Reference specification (not code)

---

## 📡 All Events (By Category)

### Simulation Events (Emitted by SimulationCore)

| Event | Payload | Listeners | Purpose |
|-------|---------|-----------|---------|
| `BUILDING_REGISTERED` | `{ buildingId, x, y }` | UI, Pathology | Building added to active production |
| `BUILDING_UNREGISTERED` | `{ buildingId, x, y }` | UI, Pathology | Building destroyed or removed |
| `RECIPE_STARTED` | `{ buildingId, recipeId }` | UI | Recipe production begins |
| `RECIPE_COMPLETED` | `{ buildingId, inputs, outputs }` | Progression, UI | Recipe finished, milestone for unlocks |
| `RESOURCES_PRODUCED` | `{ buildingId, resources: {...} }` | Progression, UI, Pathology (lactate check) | Resources added to pool |
| `RESOURCES_CONSUMED` | `{ buildingId, resources: {...} }` | Progression, UI | Resources removed from pool |
| `BIOMARKER_UPDATED` | `{ biomarkerId, oldValue, newValue, unit, normalRange }` | UI (display update) | Diagnostic value changed |
| `BIOMARKER_CRITICAL_LOW` | `{ biomarkerId, value, critical }` | Pathology, UI (warn) | Biomarker dropped below critical |
| `BIOMARKER_CRITICAL_HIGH` | `{ biomarkerId, value, critical }` | Pathology, UI (warn) | Biomarker exceeded critical |
| `pH_CHANGED` | `{ delta, source, severity }` | UI (display), Pathology (check thresholds) | pH changed (local or systemic) |
| `DISEASE_ONSET` | `{ disease, severity }` | Progression (unlock), UI (alert), Pathology | Disease activated |
| `DISEASE_PROGRESSED` | `{ disease, oldSeverity, newSeverity }` | Pathology (apply mods), UI (update), Progression | Severity increased |
| `DISEASE_SYMPTOMS_MANIFESTED` | `{ disease, symptom }` | UI (player notification) | New symptom appeared |

---

### Gameplay Events (Emitted by Input/Placement Systems)

| Event | Payload | Listeners | Purpose |
|-------|---------|-----------|---------|
| `BUILDING_PLACEMENT_REQUESTED` | `{ buildingId, x, y }` | PlacementManager (validate) | Player requests building |
| `BUILDING_PLACED` | `{ buildingId, x, y }` | SimulationCore (register), Progression, UI, SaveManager | Building actually placed |
| `BUILDING_DESTROYED` | `{ buildingId, x, y }` | SimulationCore (unregister), Pathology, Progression, SaveManager | Building destroyed by player/disease/enemies |
| `MEDICATION_ADMINISTERED` | `{ medication, amount }` | Pathology (pharmacokinetics), SimulationCore (apply effects), Progression, UI, SaveManager | Drug given to system |
| `UNIT_SPAWNED` | `{ unitId, x, y, type }` | Progression, UI | Unit created |
| `UNIT_KILLED` | `{ unitId, x, y, killerId }` | Progression (kill count), UI, SaveManager | Unit destroyed |

---

### Progression Events (Emitted by ProgressionManager)

| Event | Payload | Listeners | Purpose |
|-------|---------|-----------|---------|
| `ENTRY_UNLOCKED` | `{ entryId, entryType, hint }` | UI (show notification), SaveManager (persist) | Building/tech/unit unlocked |
| `STAT_THRESHOLD_REACHED` | `{ stat, value, threshold }` | UI (display), SaveManager | Progression gate crossed |

---

### Pathology Events (Emitted by PathologySystem)

| Event | Payload | Listeners | Purpose |
|-------|---------|-----------|---------|
| `DISEASE_TRIGGERED_BY_BIOMARKER` | `{ biomarker, disease, value, critical }` | UI (alert) | Biomarker caused disease onset |
| `CONSTRUCTION_BLOCKED` | `{ reason, severity }` | UI (disable placement), PlacementManager (validate) | Building placement forbidden |
| `MEDICATION_SIDE_EFFECT_TRIGGERED` | `{ medication, effect, dose }` | UI (alert), SaveManager | Drug toxicity manifested |
| `SYSTEM_STRUCTURE_DESTROYED` | `{ building, modifiers }` | UI (alert) | Critical system damaged |
| `INFLAMMATION_TRIGGERED` | `{ x, y, radius, intensity }` | UI (visual), Pathology (spread) | Immune cascade started |
| `CYTOKINE_EMITTED` | `{ buildingId, cytokineId, spread }` | Pathology (cascade) | Chemical signal released |

---

### UI Events (Emitted by UIManager for other systems to listen to)

| Event | Payload | Listeners | Purpose |
|-------|---------|-----------|---------|
| `DISPLAY_UPDATED` | `{ system, data }` | SaveManager (optional) | UI refreshed (most systems don't listen) |
| `PLAYER_SELECTED_BUILDING` | `{ buildingId }` | UI properties panel | Player focused on building |

---

### Infrastructure Events (SaveManager, etc.)

| Event | Payload | Listeners | Purpose |
|-------|---------|-----------|---------|
| `GAME_SAVED` | `{ timestamp, slotId }` | UI (save indicator) | Game state persisted |
| `GAME_LOADED` | `{ timestamp, slotId }` | UI, SimulationCore (restore state) | Game state restored |

---

## 🔄 Event Flow Diagrams

### Example 1: Building production cycle
```
SimulationCore.update(deltaTime)
  ├─→ Check inputs available
  ├─→ Progress recipe timer
  ├─→ If complete:
  │    ├─→ Consume inputs
  │    ├─→ emit RESOURCES_CONSUMED
  │    │    ├─ Progression: stats.totalConsumed++
  │    │    └─ UI: update resource display
  │    ├─→ Produce outputs (with modifiers)
  │    ├─→ emit RESOURCES_PRODUCED
  │    │    ├─ Progression: stats.totalProduced++
  │    │    ├─ UI: update resource display
  │    │    ├─ Pathology: check if lactate exceeds disease trigger
  │    │    └─ check_unlock_conditions
  │    └─→ emit RECIPE_COMPLETED
  │         └─ Progression: check ITEM_COLLECTED unlocks
```

### Example 2: Disease cascade
```
Lactate accumulation (RESOURCES_PRODUCED event)
  ├─→ BIOMARKER_UPDATED(RES_LACTATE, 60)
  │    └─ PathologySystem listens
  ├─→ SimulationCore detects disease trigger (lactate > 50)
  ├─→ emit DISEASE_ONSET(DIS_LACTIC_ACIDOSIS)
  │    ├─ Progression: unlock disease entry
  │    ├─ UI: show alert
  │    └─ Pathology: initialize disease
  ├─→ emit DISEASE_PROGRESSED(DIS_LACTIC_ACIDOSIS, severity 2)
  │    ├─ Pathology: apply modifier { resource_gain: 0.85 }
  │    ├─ UI: show status effect
  │    └─ SimulationCore: apply modifiers on next recipe
  └─→ emit pH_CHANGED(delta: -0.5, source: disease)
       ├─ UI: update pH bar
       └─ Pathology: check if buffer medication is available
```

### Example 3: Medication pharmacokinetics
```
Player administers insulin (10 units)
  ├─→ Input: MEDICATION_ADMINISTERED(RES_INSULIN, 10)
  │    ├─ Pathology: add to medication.doses[]
  │    ├─ UI: show "Medication applied" notification
  │    └─ SimulationCore: apply medication effects
  │
  ├─→ Pathology.updateMedicationState(deltaTime)
  │    ├─ Calculate halfLife decay (50% every 600s)
  │    ├─ Current effective dose: 10 → 9.5 → 8.6 → 7.3 (as time passes)
  │    ├─ Check if exceeds toxicity: no (threshold 100)
  │    └─ If exceeded: emit MEDICATION_SIDE_EFFECT_TRIGGERED
  │
  └─→ SimulationCore: include medication effectiveness in modifiers
       └─ Next recipe cycle: glucose regulation improved
```

---

## 📋 System Listener Checklist

### ResourceManager
**Must listen to**: (None - was using callbacks before)  
**Must emit**: (None - events handled by SimulationCore now)  
**Responsibility**: Object pooling ONLY (rendering assets)

### ProgressionManager
**Must listen to**:
- [ ] `RESOURCES_PRODUCED` → increment `stats.totalProduced[resourceId]`
- [ ] `RESOURCES_CONSUMED` → increment `stats.totalConsumed[resourceId]`
- [ ] `RECIPE_COMPLETED` → check ITEM_COLLECTED unlocks
- [ ] `BUILDING_PLACED` → increment `stats.buildings_built`
- [ ] `UNIT_KILLED` → increment `stats.enemies_killed[unitId]`
- [ ] `DISEASE_ONSET` → check DISEASE_DETECTED unlocks
- [ ] `ENTRY_UNLOCKED` → save to persistence

**Must NOT do**: Call other systems, make gameplay decisions

### UIManager
**Must listen to**:
- [ ] `RESOURCES_PRODUCED` → update resource display
- [ ] `RESOURCES_CONSUMED` → update resource display
- [ ] `RECIPE_COMPLETED` → show notification
- [ ] `BIOMARKER_UPDATED` → update biomarker panel
- [ ] `BIOMARKER_CRITICAL_LOW` → warn user
- [ ] `BIOMARKER_CRITICAL_HIGH` → warn user
- [ ] `pH_CHANGED` → update pH bar
- [ ] `DISEASE_ONSET` → show alert
- [ ] `DISEASE_PROGRESSED` → update status effects
- [ ] `ENTRY_UNLOCKED` → show "NEW" badge
- [ ] `BUILDING_PLACED` → show feedback
- [ ] `MEDICATION_SIDE_EFFECT_TRIGGERED` → show warning

**Must NOT do**: Modify simulation state

### PlacementManager
**Must listen to**: (None - triggered by user input)  
**Must emit**:
- [ ] `BUILDING_PLACEMENT_REQUESTED` → validate against BioDatabase
- [ ] `BUILDING_PLACED` → after successful placement

**Must call**: `simulationCore.registerBuilding(buildingId, x, y)`

### PathologySystem
**Must listen to**:
- [ ] `DISEASE_PROGRESSED` → apply modifiers
- [ ] `DISEASE_ONSET` → initialize effects
- [ ] `BIOMARKER_CRITICAL_HIGH` → apply threshold effects
- [ ] `BIOMARKER_CRITICAL_LOW` → apply threshold effects
- [ ] `RESOURCES_PRODUCED` → check disease triggers
- [ ] `BUILDING_UNREGISTERED` → apply system collapse modifiers
- [ ] `MEDICATION_ADMINISTERED` → track pharmacokinetics

**Must emit**:
- [ ] `CONSTRUCTION_BLOCKED` (if disease blocks building)
- [ ] `MEDICATION_SIDE_EFFECT_TRIGGERED` (if toxicity exceeded)
- [ ] `SYSTEM_STRUCTURE_DESTROYED` (if system building destroyed)

### SaveManager
**Must listen to**:
- [ ] `ENTRY_UNLOCKED` → persist unlockedIds
- [ ] `BUILDING_PLACED` → persist building positions
- [ ] `RESOURCES_PRODUCED` → accumulate stats
- [ ] `UNIT_KILLED` → accumulate stats

**Responsibility**: Periodically dump state to localStorage

---

## 🚫 Events to AVOID Creating

❌ **DON'T create events that are "convenience shortcuts"**
- Wrong: `MITOCHONDRIA_PRODUCING_ATP` when you could use `RESOURCES_PRODUCED`
- Why: Increases event count, creates redundancy

❌ **DON'T create events that relay state**
- Wrong: `PROGRESSION_STATS_UPDATED` to notify of stat changes when event already fired
- Why: Events from source (RESOURCES_PRODUCED, etc.) are the source of truth

❌ **DON'T create events with duplicate information**
- Wrong: `DISEASE_ONSETS` (plural) in one event vs separate events per disease
- Why: Listeners need granular control

---

## ✅ Event Best Practices

### ✓ DO create events at the source of change
```javascript
// RIGHT: Event in the system that CAUSED the change
class SimulationCore {
  update() {
    // ... production logic ...
    this.eventBus.emit('RESOURCES_PRODUCED', { buildingId, resources });
  }
}

// Listeners react
class ProgressionManager {
  constructor(eventBus) {
    eventBus.on('RESOURCES_PRODUCED', (data) => {
      this.stats.totalProduced += data.resources.RES_ATP;
    });
  }
}
```

### ✓ DO include all relevant data in event payload
```javascript
// RIGHT: Complete context
{ 
  biomarkerId: 'BM_GLUCOSE',
  oldValue: 80,
  newValue: 120,
  unit: 'mg/dL',
  normalRange: [70, 100]
}

// WRONG: Missing context
{ value: 120 } // Can't do anything with this
```

### ✓ DO use consistent naming
```javascript
// All events follow CATEGORY_SUBCATEGORY pattern
'RESOURCE_PRODUCED'      ✓
'RESOURCES_CONSUMED'     ✓
'BUILDING_PLACED'        ✓
'DISEASE_ONSET'          ✓
'BIOMARKER_UPDATED'      ✓

'PRODUCE_RESOURCE'       ✗ (verb-first is unclear)
'RES_PROD'               ✗ (too abbreviated)
'GLUCOSE_MADE'           ✗ (too specific - not generalized)
```

---

## 🧪 Testing Event Flow

After refactoring, verify events with this test:

```javascript
// Inject a logger into EventBus
const eventLog = [];
const originalEmit = eventBus.emit;
eventBus.emit = function(eventType, data) {
  eventLog.push({ eventType, data, timestamp: Date.now() });
  return originalEmit.call(this, eventType, data);
};

// Run simulation
simulationCore.update(10);

// Verify sequence
console.table(eventLog);
// Should show:
// 1. RESOURCES_CONSUMED (inputs)
// 2. RESOURCES_PRODUCED (outputs)
// 3. RECIPE_COMPLETED
// 4. BIOMARKER_UPDATED (if applicable)
// No system-to-system calls in between
```

---

## 📞 Quick Reference: "What event should I emit?"

**Q: Player placed a building?**  
A: Emit `BUILDING_PLACED` from PlacementManager (after validation)

**Q: Resource amount changed?**  
A: Emit `RESOURCES_PRODUCED` or `RESOURCES_CONSUMED` from SimulationCore

**Q: Biomarker value changed?**  
A: Emit `BIOMARKER_UPDATED` from SimulationCore

**Q: Player gave medication?**  
A: Emit `MEDICATION_ADMINISTERED` from InputManager/UI

**Q: Disease got worse?**  
A: Emit `DISEASE_PROGRESSED` from SimulationCore

**Q: Something unlocked?**  
A: Emit `ENTRY_UNLOCKED` from ProgressionManager ONLY

---

