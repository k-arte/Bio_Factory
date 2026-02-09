# Bio-Factory: Clean Architecture Specification

**Status**: Architectural Design Phase (February 2026)  
**Purpose**: Reconstruct the simulation as a biologically-agnostic, data-driven engine

---

## 🎯 Core Principle

> **If a value exists both in code and JSON: the code is wrong**  
> **If a mechanic is in code but can't be expressed in JSON: the mechanic is invalid**

This is the single source of truth for how Bio-Factory should be architecturally structured.

---

## 📊 Clean Simulation Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                       BioDatabase.json                           │
│  (Genome: All game constants, mechanics, progression rules)      │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                    SimulationCore                                │
│  - Reads BioDatabase                                             │
│  - Executes production/consumption recipes                       │
│  - Applies modifiers (multiplicative, never subtractive)         │
│  - Updates pH, biomarkers                                        │
│  - Spreads diseases                                              │
│  - Emits events for EVERY state change                           │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                      EventBus                                    │
│  Central message dispatch for all simulation events              │
│  Events:                                                         │
│    - RESOURCE_PRODUCED(id, amount)                               │
│    - RESOURCE_CONSUMED(id, amount)                               │
│    - RECIPE_STARTED(buildingId, recipeId)                       │
│    - RECIPE_COMPLETED(buildingId, recipeId)                     │
│    - BUILDING_PLACED(id, x, y)                                   │
│    - BUILDING_DESTROYED(id, x, y)                               │
│    - pH_CHANGED(local, systemic, delta)                         │
│    - BIOMARKER_UPDATED(markerId, newValue, oldValue)            │
│    - DISEASE_ONSET(diseaseId, severity)                         │
│    - DISEASE_PROGRESSED(diseaseId, newSeverity)                 │
│    - DISEASE_SYMPTOMS_MANIFESTED(diseaseId, symptom)            │
│    - INFLAMMATION_TRIGGERED(x, y, radius)                       │
│    - CYTOKINE_EMITTED(buildingId, cytokineId, spread)           │
│    - MEDICATION_ADMINISTERED(drugId, amount, method)            │
│    - UNIT_SPAWNED(unitId, x, y, type)                           │
│    - UNIT_KILLED(unitId, x, y, killerId)                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
      ┌──────────────────────┼──────────────────────┐
      │                      │                      │
      ▼                      ▼                      ▼
┌──────────────┐  ┌──────────────┐    ┌──────────────┐
│ Progression  │  │ Pathology    │    │ UI           │
│ Manager      │  │ System       │    │ Manager      │
│              │  │              │    │              │
│ Listens for: │  │ Listens for: │    │ Listens for: │
│ - Stat       │  │ - Disease    │    │ - All events │
│   thresholds │  │   progression│    │   for        │
│ - Kills      │  │ - pH changes │    │   display    │
│ - Items      │  │ - Biomarkers │    │   updates    │
│ - Research   │  │ - Cytokines  │    │              │
│              │  │              │    │              │
│ Outputs:     │  │ Outputs:     │    │ Outputs:     │
│ - Unlocks    │  │ - Modifiers  │    │ - DOM        │
│ - Stats      │  │ - Debuffs    │    │   updates    │
│ - Events     │  │ - Zone       │    │              │
│              │  │   effects    │    │              │
└──────────────┘  └──────────────┘    └──────────────┘
```

---

## 🧬 BioDatabase Schema (MANDATORY)

### Structure
```javascript
const BioDatabase = {
  meta: { version, last_updated },
  
  resources: [
    {
      id: "RES_GLUCOSE",
      name: "Glucose",
      icon: "🍯",
      unit: "mg/dL",
      normal_range: "70-100",
      // NEW FIELDS FOR COMPLETENESS:
      metabolic_role: "anaerobic_fuel",
      unlock_condition: null
    }
  ],
  
  buildings: [
    {
      id: "BLD_MITOCHONDRIA",
      name: "Mitochondria Factory",
      production: { RES_ATP: 15 },  // outputs
      consumption: { RES_GLUCOSE: 5, RES_OXYGEN: 3 },  // inputs
      tags: ["system_structure", "high_salience", "aerobic"],
      unlock_condition: { type: "STAT_THRESHOLD", stat: "total_energy_produced", value: 500 },
      // NEW FIELDS:
      maintenance_cost: { RES_ATP: 2 },  // per cycle
      acid_output: { RES_LACTATE: 0 },  // if anaerobic pathway
      max_health: 100,
      destruction_modifiers: { build_cost: 1.1, resource_gain: 0.9 }
    }
  ],
  
  units: [
    {
      id: "UNIT_NEUTROPHIL",
      name: "Neutrophil",
      type: "immune_cell",
      aggro_targets: ["system_structures", "pathogens"],
      behavior_modes: ["patrolling", "attacking", "attracted_to_inflammation"],
      unlock_condition: null
    }
  ],
  
  diseases: [
    {
      id: "DIS_LACTIC_ACIDOSIS",
      name: "Lactic Acidosis",
      trigger: { lactate_accumulation: 50 },
      severity_tiers: [
        { level: 1, symptoms: ["ph_lowered_local"], local_debuff: { resource_gain: 0.95 } },
        { level: 2, symptoms: ["ph_lowered_systemic"], systemic_debuff: { build_cost: 1.05 } },
        { level: 3, symptoms: ["organ_dysfunction"], block_construction: true }
      ],
      medication_profile: { RES_BUFFER_SOLUTION: 0.8 },  // effectiveness
      unlock_condition: { type: "DISEASE_DETECTED", disease: "DIS_LACTIC_ACIDOSIS" }
    }
  ],
  
  biomarkers: [
    {
      id: "BM_GLUCOSE",
      name: "Blood Glucose",
      unit: "mg/dL",
      normal_range: [70, 100],
      sources: ["RES_GLUCOSE"],
      diagnostic_thresholds: {
        low: 70,
        high: 100,
        critical_low: 40,
        critical_high: 300
      },
      unlock_condition: null
    }
  ],
  
  modifiers: [
    {
      id: "MOD_SYSTEM_DESTROYED",
      name: "System Structure Destroyed",
      applies_to: "systemic",
      type: "multiplicative",
      values: { resource_gain: 0.9, build_cost: 1.1 },
      triggered_by: { event: "BUILDING_DESTROYED", tag: "system_structure" }
    }
  ],
  
  pharmacology: [
    {
      id: "RES_INSULIN",
      name: "Insulin",
      type: "medication",
      crafting_recipe: { inputs: { RES_GLUCOSE: 10 }, outputs: { self: 1 }, time: 30 },
      delivery_method: ["immune_cell_carrier", "specialized_turret"],
      accumulation_half_life: 3600,  // seconds until 50% cleared
      kidney_clearance: true,
      toxicity_threshold: 1000,
      unlock_condition: { type: "DISEASE_DETECTED", disease: "DIS_DIABETES" },
      side_effects: [
        { threshold: 500, effect: "hypoglycemia_risk", modifier_id: "MOD_HYPOGLYCEMIA" }
      ]
    }
  ],
  
  progression: [
    {
      id: "TECH_AEROBIC_RESPIRATION",
      type: "research",
      unlock_condition: { type: "STAT_THRESHOLD", stat: "total_energy_produced", value: 1000 },
      unlocks: ["RECIPE_ATP_AEROBIC"]
    }
  ]
}
```

### Mandatory Invariants
- **Every entity has a unique ID** (BLD_, RES_, DIS_, UNIT_, BM_, MOD_, TECH_)
- **Every value that affects gameplay lives in BioDatabase**
- **Modifiers are multiplicative**: `final_value = base * (1 + mod1) * (1 + mod2)`
- **Never subtract from resources** (use multiplicative modifiers with <1.0)
- **Tags enable automatic behavior** (e.g., `tag: "system_structure"` enables destruction logic)
- **Unlock conditions block EVERYTHING** until met

---

## ⚙️ SimulationCore

### Responsibilities
- Read BioDatabase (single load at startup)
- Execute recipes defined in buildings
- Apply modifiers to resources and costs
- Update pH (local and systemic)
- Update biomarkers from resource data
- Spread diseases via tiles and units
- Emit events to EventBus (NEVER update UI directly)

### Core Loop (Pseudo-code)
```javascript
class SimulationCore {
  constructor(database) {
    this.database = database;
    this.eventBus = null;  // Injected
  }
  
  update(deltaTime) {
    // 1. Process all active buildings
    for (const building of this.activeBuildings) {
      const recipeData = this.database.getRecipeFor(building.id);
      
      // Check if inputs available
      if (this.checkResourcesAvailable(recipeData.inputs)) {
        // Consume inputs
        this.consumeResources(recipeData.inputs);
        this.eventBus.emit('RESOURCE_CONSUMED', { items: recipeData.inputs });
        
        // Progress recipe timer
        building.recipeProgress += deltaTime;
        
        // If recipe complete
        if (building.recipeProgress >= recipeData.time) {
          // Apply modifiers to output
          const finalOutput = this.applyModifiers(recipeData.outputs);
          this.produceResources(finalOutput);
          this.eventBus.emit('RESOURCE_PRODUCED', { items: finalOutput });
          this.eventBus.emit('RECIPE_COMPLETED', { building: building.id, recipe: recipeData.id });
          
          building.recipeProgress = 0;
        }
      }
    }
    
    // 2. Update pH
    const phData = this.calculatePH();
    if (phData.changed) {
      this.eventBus.emit('pH_CHANGED', { local: phData.local, systemic: phData.systemic });
    }
    
    // 3. Update biomarkers
    const markerUpdates = this.updateBiomarkers();
    markerUpdates.forEach(update => {
      this.eventBus.emit('BIOMARKER_UPDATED', update);
    });
    
    // 4. Check disease triggers
    const diseaseChanges = this.updateDiseases();
    diseaseChanges.forEach(change => {
      if (change.event === 'onset') {
        this.eventBus.emit('DISEASE_ONSET', { disease: change.id, severity: change.severity });
      }
      if (change.event === 'progressed') {
        this.eventBus.emit('DISEASE_PROGRESSED', { disease: change.id, severity: change.severity });
      }
    });
    
    // 5. Spread cytokines (inflammation cascade)
    this.spreadCytokines();
  }
  
  applyModifiers(values) {
    let final = { ...values };
    for (const modifier of this.activeModifiers) {
      for (const [key, mult] of Object.entries(modifier.values)) {
        if (final[key]) {
          final[key] *= mult;
        }
      }
    }
    return final;
  }
}
```

### Key Properties
- **NO hardcoded constants** (all from BioDatabase)
- **NO direct DOM manipulation** (only events)
- **NO stat tracking** (delegated to ProgressionManager listening to events)
- **Purely data transformation**: Input (state + delta) → Event stream

---

## 🔔 EventBus

### Architecture
Central message dispatcher. All systems communicate through events.

```javascript
class EventBus {
  constructor() {
    this.listeners = {}; // { eventType: [callback, callback, ...] }
  }
  
  on(eventType, callback) {
    if (!this.listeners[eventType]) {
      this.listeners[eventType] = [];
    }
    this.listeners[eventType].push(callback);
  }
  
  emit(eventType, data) {
    if (!this.listeners[eventType]) return;
    this.listeners[eventType].forEach(cb => {
      try {
        cb(data);
      } catch (err) {
        console.error(`[EventBus] Error in ${eventType} listener:`, err);
      }
    });
  }
  
  off(eventType, callback) {
    if (!this.listeners[eventType]) return;
    this.listeners[eventType] = this.listeners[eventType].filter(cb => cb !== callback);
  }
}
```

### Event Taxonomy
All events follow the pattern: `EVENT_CATEGORY_SUBCATEGORY`.

**Simulation Events** (emitted by SimulationCore):
- `RECIPE_STARTED`, `RECIPE_COMPLETED`
- `RESOURCE_PRODUCED`, `RESOURCE_CONSUMED`
- `pH_CHANGED`, `BIOMARKER_UPDATED`
- `DISEASE_ONSET`, `DISEASE_PROGRESSED`, `DISEASE_SYMPTOMS_MANIFESTED`
- `INFLAMMATION_TRIGGERED`, `CYTOKINE_EMITTED`
- `UNIT_SPAWNED`, `UNIT_KILLED`

**Gameplay Events** (emitted by user actions):
- `BUILDING_PLACED`, `BUILDING_DESTROYED`
- `MEDICATION_ADMINISTERED`

**Progression Events** (emitted by ProgressionManager):
- `ENTRY_UNLOCKED`
- `STAT_THRESHOLD_REACHED`

**UI Events** (emitted by UI responding to simulation):
- `DISPLAY_UPDATED`, `HUD_REFRESHED`

---

## 🔄 System Responsibilities

### ProgressionManager
**Should listen to**:
- `RESOURCE_PRODUCED` → increment `stats.total_energy_produced`
- `UNIT_KILLED` → increment `stats.enemies_killed`, check kill-count unlocks
- `BUILDING_PLACED` → increment `stats.buildings_built`
- `RECIPE_COMPLETED` → check item-collected unlocks

**Should NOT**:
- Call ResourceManager directly
- Hardcode gameplay rules
- Track resource amounts (only counts/statistics)

### UIManager
**Should listen to**:
- ALL events (needed for live display updates)
- `RESOURCE_PRODUCED` → update resource display
- `pH_CHANGED` → update pH bar
- `BIOMARKER_UPDATED` → update biomarker panel
- `DISEASE_ONSET` → show disease alert

**Should NOT**:
- Make gameplay decisions
- Modify simulation data
- Cache values (always compute from latest data)

### PathologySystem (New)
**Should listen to**:
- `pH_CHANGED` → apply pH debuffs
- `DISEASE_PROGRESSED` → apply severity modifiers
- `BUILDING_DESTROYED` → apply system-collapse modifiers
- `INFLAMMATION_TRIGGERED` → spread through terrain

**Emits**: Modifier updates to SimulationCore

### Input/Placement Systems
**Should emit**:
- `BUILDING_PLACED` events
- `MEDICATION_ADMINISTERED` events

**Should read**: Game data from BioDatabase for validation

---

## 🚫 Complete Architectural Prohibition List

### ❌ FORBIDDEN
1. **Hardcoded values**
   - ❌ `const GLUCOSE_PRODUCTION = 5`
   - ✅ `const value = database.buildings.find(b => b.id === 'BLD_EXTRACTOR').production.glucose`

2. **Direct stat manipulation**
   - ❌ `if (glucose > 500) unlockMitochondria()`
   - ✅ `eventBus.emit('RESOURCE_PRODUCED', { id: 'RES_GLUCOSE', amount })`
   - ✅ `progressionManager.onResourceProduced('RES_GLUCOSE', amount)` (via listener)

3. **Unused code**
   - Delete it immediately
   - If "might be needed later" → add it when needed

4. **Duplicate systems**
   - One way to represent each concept
   - No "alternative" implementations

5. **Logic outside BioDatabase**
   - ❌ Building placement logic in InputManager
   - ✅ Placement rules in BioDatabase (e.g., `placeable_on_terrain: ['TERRAIN_ENDOTHELIUM']`)

6. **Polling for state changes**
   - ❌ `if (pH !== lastPH) { updateUI() }`
   - ✅ Listen to `pH_CHANGED` event

7. **Caching game state**
   - ✅ Cache rendering assets
   - ❌ Cache gameplay data (always read current)

8. **Tight coupling between systems**
   - ❌ `resourceManager.notifyProgressionManager()`
   - ✅ Both listen to EventBus independently

---

## 📈 Example: Complete Glucose→ATP→Lactate Pathway

### Data (BioDatabase)
```javascript
{
  resources: [
    { id: "RES_GLUCOSE", ... },
    { id: "RES_ATP", unit: "μmol" },
    { id: "RES_LACTATE", ... }
  ],
  
  buildings: [
    {
      id: "BLD_MITOCHONDRIA",
      recipes: [
        // Anaerobic (always available)
        {
          id: "RECIPE_GLYCOLYSIS",
          inputs: { RES_GLUCOSE: 1 },
          outputs: { RES_ATP: 2, RES_LACTATE: 1 },
          time: 3
        },
        // Aerobic (unlocked after energy threshold)
        {
          id: "RECIPE_AEROBIC",
          inputs: { RES_GLUCOSE: 1, RES_OXYGEN: 6 },
          outputs: { RES_ATP: 32, RES_LACTATE: 0 },
          time: 5,
          unlock_condition: { type: "STAT_THRESHOLD", stat: "total_energy_produced", value: 1000 }
        }
      ]
    }
  ],
  
  diseases: [
    {
      id: "DIS_LACTIC_ACIDOSIS",
      trigger: { lactate_accumulation: 50 },
      severity_tiers: [
        { level: 1, ph_decrease: 0.5, systemic_debuff: { resource_gain: 0.95 } }
      ]
    }
  ]
}
```

### Simulation Flow
1. **SimulationCore.update()**
   - Mitochondria has inputs available (glucose, oxygen)
   - Progress recipe timer
   - When complete: Produce 32 ATP, 0 Lactate (aerobic) OR 2 ATP, 1 Lactate (anaerobic)
   - Emit: `RESOURCE_PRODUCED`, `RECIPE_COMPLETED`, `BIOMARKER_UPDATED`

2. **EventBus dispatches**
   - ProgressionManager listens: increments `total_energy_produced`
   - UIManager listens: updates ATP display
   - PathologySystem listens: checks lactate accumulation

3. **If lactate > 50 threshold**
   - PathologySystem emits modifier: `resource_gain *= 0.95`
   - SimulationCore reads modifier on next cycle
   - All future production affected

4. **ProgressionManager checks**
   - `total_energy_produced >= 1000`? 
   - Unlock "RECIPE_AEROBIC"
   - Emit: `ENTRY_UNLOCKED`

**No hardcoding. No direct manipulation. Pure data transformation.**

---

## 🗺️ File Structure (Target)

```
src/
├── core/
│   ├── Engine.js (rendering + loop orchestration ONLY)
│   ├── EventBus.js (NEW - central event dispatcher)
│   └── InputManager.js (user input → game events)
├── simulation/
│   ├── SimulationCore.js (NEW - data-driven engine)
│   ├── ModifierSystem.js (NEW - apply multiplicative modifiers)
│   └── PathologySystem.js (NEW - disease/pH/biomarker logic)
├── systems/
│   ├── ProgressionManager.js (REFACTOR - listen to EventBus)
│   ├── SaveManager.js (unchanged)
│   └── ResourceManager.js (REFACTOR - remove callbacks, listen to EventBus)
├── ui/
│   ├── UIManager.js (REFACTOR - listen to EventBus for all updates)
│   └── HUD_NEW.js (unchanged)
├── world/
│   ├── Grid.js (unchanged)
│   └── MapGenerator.js (REFACTOR - data-driven from BioDatabase)
├── data/
│   ├── BioDatabase.js (REFACTOR - expand schema)
│   └── Colors.js (unchanged)
└── entities/
    ├── PlacementManager.js (REFACTOR - emit events, read from BioDatabase)
    └── TransportSystem.js (unchanged)
```

---

## ✅ Validation Checklist

After implementing this architecture, verify:

- [ ] BioDatabase contains ALL gameplay rules (no hardcoded values in code)
- [ ] SimulationCore never calls UI (only emits events)
- [ ] All systems listen to EventBus, not each other directly
- [ ] Every game change produces an event
- [ ] ProgressionManager only increments stats, never makes decisions
- [ ] Engine.js < 300 lines (not monolithic)
- [ ] No file imports UI from simulation layer
- [ ] ModifierSystem is purely multiplicative
- [ ] Can swap BioDatabase with different organism and game runs
- [ ] Zero polling; 100% event-driven

---

## 📝 Implementation Order

1. **Create EventBus** (15 min) - central dispatch
2. **Create SimulationCore skeleton** (30 min) - update loop structure
3. **Expand BioDatabase** (1 hour) - complete schema
4. **Create ModifierSystem** (30 min) - multiplicative scaling
5. **Create PathologySystem** (1 hour) - disease/pH/biomarker logic
6. **Refactor ResourceManager** (30 min) - remove callbacks, listen to EventBus
7. **Refactor ProgressionManager** (30 min) - listen to EventBus
8. **Refactor UIManager** (1 hour) - listen to EventBus for all display updates
9. **Refactor PlacementManager** (30 min) - emit events, use BioDatabase
10. **Delete polluting code** (15 min) - remove unused files/functions

**Total: ~5 hours for clean architecture foundation.**

---

## 🧪 Testing the Architecture

At each stage, ask:
- **"Could I run this game with a different BioDatabase?"**
- **"Where is this value defined? (Should be in JSON)"**
- **"What event triggered this state change?"**
- **"Is any system polling instead of listening?"**

If you can't answer all four, the architecture still has pollution.

