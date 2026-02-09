# ONE SIMULATION TICK: Complete Step-by-Step Walkthrough

**Scenario**: Mitochondria Factory producing ATP from glucose for 8 seconds  
**Starting state**: 500 glucose available, 0 ATP, 0 lactate  
**Goal**: Show EXACT order of operations

---

## INITIAL STATE (Before tick)

```javascript
// From SimulationCore
this.state.resources = {
  RES_GLUCOSE: 500,
  RES_OXYGEN: 100,
  RES_ATP: 0,
  RES_LACTATE: 0,
  RES_AMINO_ACIDS: 0
};

this.buildingStates = new Map([
  ['BLD_MITOCHONDRIA_active_recipe', {
    buildingId: 'BLD_MITOCHONDRIA',
    position: { x: 5, y: 10 },
    active: true,
    recipeProgress: 0.0,    // No progress yet
    inputs: { RES_GLUCOSE: 1, RES_OXYGEN: 6 },    // From BioDatabase
    outputs: { RES_ATP: 32, RES_LACTATE: 0 },    // From BioDatabase (aerobic)
    craftTime: 5.0          // seconds (hardcoded for now)
  }]
]);

this.state.diseases = new Map();
this.state.biomarkers = {};
this.state.pH = { local: 7.4, systemic: 7.4 };
this.state.modifiers = [];  // No active modifiers yet
```

---

## CALL: `simulationCore.update(8)`

**Input**: deltaTime = 8 seconds

---

## STEP 1: `_updateRecipes(8)`

Called at line ~220 in SimulationCore.js

### Loop iteration 1: BLD_MITOCHONDRIA_active_recipe

**Line 224**: `for (const [key, buildingState] of this.buildingStates)`

```javascript
key = 'BLD_MITOCHONDRIA_active_recipe'
buildingState = {
  buildingId: 'BLD_MITOCHONDRIA',
  active: true,
  recipeProgress: 0.0,
  inputs: { RES_GLUCOSE: 1, RES_OXYGEN: 6 },
  outputs: { RES_ATP: 32, RES_LACTATE: 0 },
  craftTime: 5.0
}
```

**Line 225**: `if (!buildingState.active) continue;`
- Result: FALSE (building IS active)
- Action: Continue

**Line 228**: `if (!this._checkInputsAvailable(buildingState.inputs))`

Jumps to `_checkInputsAvailable()` at line ~305:
```javascript
function _checkInputsAvailable(inputs) {
  // inputs = { RES_GLUCOSE: 1, RES_OXYGEN: 6 }
  
  // Check RES_GLUCOSE
  if (!this.state.resources['RES_GLUCOSE'] || this.state.resources['RES_GLUCOSE'] < 1)
    return false;
  // this.state.resources['RES_GLUCOSE'] = 500
  // 500 >= 1? YES ✓
  
  // Check RES_OXYGEN
  if (!this.state.resources['RES_OXYGEN'] || this.state.resources['RES_OXYGEN'] < 6)
    return false;
  // this.state.resources['RES_OXYGEN'] = 100
  // 100 >= 6? YES ✓
  
  return true;  // All inputs available
}
```

Returns: **TRUE** (both inputs available)

Back at line 228: `if (!this._checkInputsAvailable(...))` = `if (!true)` = `if (false)`
- Action: Continue (don't skip)

**Line 232**: `buildingState.recipeProgress += deltaTime;`
```javascript
buildingState.recipeProgress = 0.0 + 8 = 8.0
```

**Line 235**: `if (buildingState.recipeProgress >= buildingState.craftTime)`
```
8.0 >= 5.0?  → TRUE
```

**Recipe COMPLETES. Enter completion block (line 236-262).**

---

## STEP 1A: Consume Inputs

**Line 237**: `this._consumeResources(buildingState.inputs);`

Jumps to `_consumeResources()` at line ~314:
```javascript
function _consumeResources(inputs) {
  // inputs = { RES_GLUCOSE: 1, RES_OXYGEN: 6 }
  
  for (const [resourceId, amount] of Object.entries(inputs)) {
    // ITERATION 1: RES_GLUCOSE
    this.state.resources['RES_GLUCOSE'] -= 1;
    this.stats.totalConsumed['RES_GLUCOSE'] = (0 || 0) + 1 = 1;
    
    // ITERATION 2: RES_OXYGEN
    this.state.resources['RES_OXYGEN'] -= 6;
    this.stats.totalConsumed['RES_OXYGEN'] = (0 || 0) + 6 = 6;
  }
}
```

**State after consumption**:
```javascript
this.state.resources = {
  RES_GLUCOSE: 499,      // was 500, consumed 1
  RES_OXYGEN: 94,        // was 100, consumed 6
  RES_ATP: 0,            // unchanged yet
  RES_LACTATE: 0,        // unchanged yet
  RES_AMINO_ACIDS: 0
};

this.stats.totalConsumed = {
  RES_GLUCOSE: 1,
  RES_OXYGEN: 6
};
```

**Line 238**: `this.eventBus.emit('RESOURCES_CONSUMED', { buildingId: 'BLD_MITOCHONDRIA', resources: { RES_GLUCOSE: 1, RES_OXYGEN: 6 } });`

**EVENT #1 EMITTED**: `RESOURCES_CONSUMED`
```
Payload: { 
  buildingId: 'BLD_MITOCHONDRIA',
  resources: { RES_GLUCOSE: 1, RES_OXYGEN: 6 }
}
Listeners notified (if any registered)
```

---

## STEP 1B: Produce Outputs (with modifiers)

**Line 241**: `const finalOutputs = this.modifierSystem ? this.modifierSystem.applyModifiers(buildingState.outputs) : buildingState.outputs;`

Check: `this.modifierSystem` exists? = YES (was injected)

Call `ModifierSystem.applyModifiers({ RES_ATP: 32, RES_LACTATE: 0 })`:

```javascript
function applyModifiers(baseValues) {
  // baseValues = { RES_ATP: 32, RES_LACTATE: 0 }
  const result = { ...baseValues };  // Copy: { RES_ATP: 32, RES_LACTATE: 0 }
  
  for (const [statKey, baseValue] of Object.entries(baseValues)) {
    let multiplier = 1.0;
    
    // ITERATION 1: statKey = 'RES_ATP', baseValue = 32
    for (const modifier of this.modifiers) {  // this.modifiers = [] (empty, no diseases)
      // No iterations (empty array)
    }
    multiplier remains 1.0
    result['RES_ATP'] = 32 * 1.0 = 32;
    
    // ITERATION 2: statKey = 'RES_LACTATE', baseValue = 0
    for (const modifier of this.modifiers) {  // still empty
      // No iterations
    }
    multiplier remains 1.0
    result['RES_LACTATE'] = 0 * 1.0 = 0;
  }
  
  return { RES_ATP: 32, RES_LACTATE: 0 };
}
```

**Result**: `finalOutputs = { RES_ATP: 32, RES_LACTATE: 0 }` (no modifiers applied)

---

## STEP 1C: Produce Resources

**Line 244**: `this._produceResources(finalOutputs);`

Jumps to `_produceResources()` at line ~328:
```javascript
function _produceResources(outputs) {
  // outputs = { RES_ATP: 32, RES_LACTATE: 0 }
  
  for (const [resourceId, amount] of Object.entries(outputs)) {
    // ITERATION 1: RES_ATP, 32
    if (32 <= 0) continue;  // FALSE, so continue
    this.state.resources['RES_ATP'] = (0 || 0) + 32 = 32;
    this.stats.totalProduced['RES_ATP'] = (0 || 0) + 32 = 32;
    
    // ITERATION 2: RES_LACTATE, 0
    if (0 <= 0) continue;  // TRUE, so skip this iteration
  }
}
```

**State after production**:
```javascript
this.state.resources = {
  RES_GLUCOSE: 499,
  RES_OXYGEN: 94,
  RES_ATP: 32,           // was 0, produced 32
  RES_LACTATE: 0,        // still 0
  RES_AMINO_ACIDS: 0
};

this.stats.totalProduced = {
  RES_ATP: 32
};
```

**Line 245**: `this.eventBus.emit('RESOURCES_PRODUCED', { buildingId: 'BLD_MITOCHONDRIA', resources: finalOutputs });`

**EVENT #2 EMITTED**: `RESOURCES_PRODUCED`
```
Payload: {
  buildingId: 'BLD_MITOCHONDRIA',
  resources: { RES_ATP: 32, RES_LACTATE: 0 }
}
```

---

## STEP 1D: Mark Recipe Complete

**Line 248**: `this.eventBus.emit('RECIPE_COMPLETED', { buildingId: 'BLD_MITOCHONDRIA', inputs: { RES_GLUCOSE: 1, RES_OXYGEN: 6 }, outputs: { RES_ATP: 32, RES_LACTATE: 0 } });`

**EVENT #3 EMITTED**: `RECIPE_COMPLETED`
```
Payload: {
  buildingId: 'BLD_MITOCHONDRIA',
  inputs: { RES_GLUCOSE: 1, RES_OXYGEN: 6 },
  outputs: { RES_ATP: 32, RES_LACTATE: 0 }
}
```

**Line 250**: `this.stats.recipesCompleted++;`
```
this.stats.recipesCompleted = 0 + 1 = 1;
```

**Line 251**: `buildingState.recipeProgress = 0;`
```
buildingState.recipeProgress = 0.0  // Reset for next cycle
```

**End of loop iteration. No more buildings to process.**

---

## STEP 2: `_updateDiseases(8)`

Called at line ~260

```javascript
function _updateDiseases(deltaTime) {
  // deltaTime = 8
  if (!this.database.diseases) return;  // Database HAS diseases array
  
  for (const disease of this.database.diseases) {
    // DISEASE 1: DIS_LACTIC_ACIDOSIS
    const diseaseState = this.state.diseases.get('DIS_LACTIC_ACIDOSIS') || {
      id: 'DIS_LACTIC_ACIDOSIS',
      severity: 0,
      onset_time: 0,
      active: false
    };
    
    // diseaseState = fresh default (not in map yet)
    
    // Check trigger condition
    if (!diseaseState.active && this._checkDiseaseTrigger(disease)) {
      // disease.trigger = { type: 'RESOURCE_ACCUMULATION', resource: 'RES_LACTATE', threshold: 50 }
      
      // Call _checkDiseaseTrigger at line ~343
      switch (disease.trigger.type) {
        case 'RESOURCE_ACCUMULATION':
          const resourceAmount = this.state.resources['RES_LACTATE'] || 0;  // 0
          return resourceAmount >= 50;  // 0 >= 50? FALSE
      }
    }
    
    // FALSE, so skip the if block
    
    // No severity update (disease not active)
    
    this.state.diseases.set('DIS_LACTIC_ACIDOSIS', diseaseState);
    // Stored, but no change reported
    
    // DISEASE 2: DIS_HYPOXIA
    // trigger.type = 'RESOURCE_THRESHOLD'
    // trigger.below = 20
    const currentAmount = this.state.resources['RES_OXYGEN'] || 0;  // 94
    return currentAmount < 20;  // 94 < 20? FALSE
    
    // Skip
    
    // DISEASE 3: DIS_INFLAMMATION
    // trigger.type = 'EVENT'
    return false;  // Events are triggered elsewhere
    
    // Skip
  }
}
```

**Result**: No diseases triggered. No events emitted.

**State unchanged**.

---

## STEP 3: `_updateBiomarkers()`

Called at line ~263

```javascript
function _updateBiomarkers() {
  if (!this.database.biomarkers) return;  // Has biomarkers
  
  for (const biomarker of this.database.biomarkers) {
    // BIOMARKER 1: BM_GLUCOSE
    const lastValue = this.state.biomarkers['BM_GLUCOSE']?.current || null;  // null (first time)
    
    if (biomarker.source) {  // source = 'RES_GLUCOSE'
      currentValue = this.state.resources['RES_GLUCOSE'] || 0;  // 499
    }
    
    // Only emit if changed
    if (null !== 499) {  // true
      this.eventBus.emit('BIOMARKER_UPDATED', {
        biomarkerId: 'BM_GLUCOSE',
        oldValue: null,
        newValue: 499,
        unit: 'mg/dL',
        normalRange: [70, 100]
      });
    }
    
    this.state.biomarkers['BM_GLUCOSE'] = {
      current: 499,
      lastUpdate: Date.now()
    };
    
    // BIOMARKER 2: BM_OXYGEN_SATURATION
    const lastValue = this.state.biomarkers['BM_OXYGEN_SATURATION']?.current || null;  // null
    
    if (biomarker.source) {  // source = 'RES_OXYGEN'
      currentValue = this.state.resources['RES_OXYGEN'] || 0;  // 94
    }
    
    if (null !== 94) {  // true
      this.eventBus.emit('BIOMARKER_UPDATED', {
        biomarkerId: 'BM_OXYGEN_SATURATION',
        oldValue: null,
        newValue: 94,
        unit: '%',
        normalRange: [90, 100]
      });
    }
    
    this.state.biomarkers['BM_OXYGEN_SATURATION'] = {
      current: 94,
      lastUpdate: Date.now()
    };
    
    // BIOMARKER 3: BM_PH_BLOOD
    // systemic_only: true, no source
    if (!biomarker.source) continue;  // skip
    
    // BIOMARKER 4: BM_LACTATE
    const lastValue = this.state.biomarkers['BM_LACTATE']?.current || null;  // null
    
    if (biomarker.source) {  // source = 'RES_LACTATE'
      currentValue = this.state.resources['RES_LACTATE'] || 0;  // 0
    }
    
    if (null !== 0) {  // true
      this.eventBus.emit('BIOMARKER_UPDATED', {
        biomarkerId: 'BM_LACTATE',
        oldValue: null,
        newValue: 0,
        unit: 'mmol/L',
        normalRange: [0.5, 2.5]
      });
    }
    
    this.state.biomarkers['BM_LACTATE'] = {
      current: 0,
      lastUpdate: Date.now()
    };
    
    // BIOMARKER 5: BM_ATP_ENERGY
    const lastValue = this.state.biomarkers['BM_ATP_ENERGY']?.current || null;  // null
    
    if (biomarker.source) {  // source = 'RES_ATP'
      currentValue = this.state.resources['RES_ATP'] || 0;  // 32
    }
    
    if (null !== 32) {  // true
      this.eventBus.emit('BIOMARKER_UPDATED', {
        biomarkerId: 'BM_ATP_ENERGY',
        oldValue: null,
        newValue: 32,
        unit: 'μmol',
        normalRange: [2.5, 4.0]
      });
    }
    
    this.state.biomarkers['BM_ATP_ENERGY'] = {
      current: 32,
      lastUpdate: Date.now()
    };
  }
}
```

**EVENTS EMITTED**:
- **EVENT #4**: `BIOMARKER_UPDATED` (BM_GLUCOSE: null → 499)
- **EVENT #5**: `BIOMARKER_UPDATED` (BM_OXYGEN_SATURATION: null → 94)
- **EVENT #6**: `BIOMARKER_UPDATED` (BM_LACTATE: null → 0)
- **EVENT #7**: `BIOMARKER_UPDATED` (BM_ATP_ENERGY: null → 32)

**State updated**:
```javascript
this.state.biomarkers = {
  BM_GLUCOSE: { current: 499, lastUpdate: 1707495632157 },
  BM_OXYGEN_SATURATION: { current: 94, lastUpdate: 1707495632157 },
  BM_LACTATE: { current: 0, lastUpdate: 1707495632157 },
  BM_ATP_ENERGY: { current: 32, lastUpdate: 1707495632157 }
};
```

---

## STEP 4: `_checkBiomarkerThresholds()`

Called at line ~281

```javascript
function _checkBiomarkerThresholds() {
  for (const biomarker of this.database.biomarkers) {
    const current = this.state.biomarkers['BM_GLUCOSE']?.current || 0;  // 499
    
    // BM_GLUCOSE: critical_low = 40, critical_high = (none)
    
    if (biomarker.critical_low && current < biomarker.critical_low) {
      // 40 && 499 < 40?  → FALSE, skip
    }
    
    if (biomarker.critical_high && current > biomarker.critical_high) {
      // (no critical_high defined), skip
    }
    
    // Repeat for each biomarker...
    // All pass (none hit critical thresholds)
  }
}
```

**Result**: All biomarker thresholds normal. No events emitted.

---

## STEP 5: `_recalculateModifiers()`

Called at line ~293

```javascript
function _recalculateModifiers() {
  if (!this.modifierSystem) return;  // modifierSystem EXISTS
  
  this.state.modifiers = [];  // Clear any old modifiers
  
  for (const [diseaseId, diseaseState] of this.state.diseases) {
    // diseases map is empty (no active diseases)
  }
  
  this.modifierSystem.setModifiers(this.state.modifiers);  // Set to empty array
}
```

**Result**: Modifiers cleared. No change (were already empty).

---

## FINAL STATE (After tick)

```javascript
this.state = {
  resources: {
    RES_GLUCOSE: 499,      // Consumed 1
    RES_OXYGEN: 94,        // Consumed 6
    RES_ATP: 32,           // Produced 32
    RES_LACTATE: 0,        // No change
    RES_AMINO_ACIDS: 0     // No change
  },
  diseases: Map {
    'DIS_LACTIC_ACIDOSIS': { active: false, severity: 0, ... },
    'DIS_HYPOXIA': { active: false, severity: 0, ... },
    'DIS_INFLAMMATION': { active: false, severity: 0, ... }
  },
  biomarkers: {
    BM_GLUCOSE: { current: 499, lastUpdate: ... },
    BM_OXYGEN_SATURATION: { current: 94, lastUpdate: ... },
    BM_LACTATE: { current: 0, lastUpdate: ... },
    BM_ATP_ENERGY: { current: 32, lastUpdate: ... }
  },
  pH: { local: 7.4, systemic: 7.4 }  // Unchanged
};

this.stats = {
  totalProduced: {
    RES_ATP: 32
  },
  totalConsumed: {
    RES_GLUCOSE: 1,
    RES_OXYGEN: 6
  },
  recipesCompleted: 1,
  diseaseOnsets: 0,
  buildingsDestroyed: 0
};

buildingState.recipeProgress = 0;  // Reset for next cycle
```

---

## COMPLETE EVENT SEQUENCE (In Order)

```
┌─────────────────────────────────────────────────────────────┐
│ ONE SIMULATION TICK: simulationCore.update(8)                │
└─────────────────────────────────────────────────────────────┘

1. EVENT: RESOURCES_CONSUMED
   Payload: { buildingId: 'BLD_MITOCHONDRIA', resources: { RES_GLUCOSE: 1, RES_OXYGEN: 6 } }
   Emitted by: Line 238 in SimulationCore._updateRecipes()
   Triggered: ProgressionManager updates stats.totalConsumed
   Triggered: UIManager updates resource display
   
   After this event:
   - RES_GLUCOSE: 500 → 499
   - RES_OXYGEN: 100 → 94
   - stats.totalConsumed updated

2. EVENT: RESOURCES_PRODUCED
   Payload: { buildingId: 'BLD_MITOCHONDRIA', resources: { RES_ATP: 32, RES_LACTATE: 0 } }
   Emitted by: Line 245 in SimulationCore._updateRecipes()
   Triggered: ProgressionManager updates stats.totalProduced
   Triggered: UIManager updates resource display
   Triggered: PathologySystem checks lactate thresholds
   
   After this event:
   - RES_ATP: 0 → 32
   - stats.totalProduced updated
   - (No disease triggered: 0 < 50 threshold)

3. EVENT: RECIPE_COMPLETED
   Payload: { buildingId: 'BLD_MITOCHONDRIA', inputs: {...}, outputs: {...} }
   Emitted by: Line 248 in SimulationCore._updateRecipes()
   Triggered: ProgressionManager checks item-collected unlocks
   Triggered: UIManager shows "Recipe Done" notification
   
   After this event:
   - stats.recipesCompleted: 0 → 1
   - buildingState.recipeProgress: 8.0 → 0 (reset)

4. EVENT: BIOMARKER_UPDATED (BM_GLUCOSE)
   Payload: { biomarkerId: 'BM_GLUCOSE', oldValue: null, newValue: 499, unit: 'mg/dL', normalRange: [70, 100] }
   Emitted by: Line 355 in SimulationCore._updateBiomarkers()
   Triggered: UIManager updates glucose panel
   
   After this event:
   - biomarker.current: 499
   - (No critical threshold: 499 > 70 and < 100)

5. EVENT: BIOMARKER_UPDATED (BM_OXYGEN_SATURATION)
   Payload: { biomarkerId: 'BM_OXYGEN_SATURATION', oldValue: null, newValue: 94, unit: '%', normalRange: [90, 100] }
   Emitted by: Line 355 in SimulationCore._updateBiomarkers()
   Triggered: UIManager updates oxygen panel
   
   After this event:
   - biomarker.current: 94
   - (No critical threshold: 94 >= 90)

6. EVENT: BIOMARKER_UPDATED (BM_LACTATE)
   Payload: { biomarkerId: 'BM_LACTATE', oldValue: null, newValue: 0, unit: 'mmol/L', normalRange: [0.5, 2.5] }
   Emitted by: Line 355 in SimulationCore._updateBiomarkers()
   Triggered: UIManager updates lactate panel
   
   After this event:
   - biomarker.current: 0
   - (No disease triggered: 0 < 50)

7. EVENT: BIOMARKER_UPDATED (BM_ATP_ENERGY)
   Payload: { biomarkerId: 'BM_ATP_ENERGY', oldValue: null, newValue: 32, unit: 'μmol', normalRange: [2.5, 4.0] }
   Emitted by: Line 355 in SimulationCore._updateBiomarkers()
   Triggered: UIManager updates ATP energy panel
   
   After this event:
   - biomarker.current: 32
   - (No critical threshold: 32 > 4.0)

Total events emitted: 7
```

---

## WHAT LISTENERS (SYSTEMS) DO

### ProgressionManager listens to RESOURCES_PRODUCED (Event #2)

```javascript
progressionManager.onResourceProduced = function(data) {
  const { resources } = data;  // { RES_ATP: 32, RES_LACTATE: 0 }
  
  // From ProgressionManager source:
  for (const [resourceId, amount] of Object.entries(resources)) {
    // RES_ATP
    this.stats.total_energy_produced += 32;
    this._checkStatThreshold('total_energy_produced');
    // Check: is 32 >= unlock threshold for any entry?
    // Search BioDatabase for entries with:
    //   unlock_condition: { type: 'STAT_THRESHOLD', stat: 'total_energy_produced', value: X }
    // If 32 >= value, entry unlocks
    
    // RES_LACTATE
    // 0 lactate, skip
  }
};
```

After event:
```
progressionManager.stats = {
  total_energy_produced: 32,  // was 0
  // (If any entry with threshold <= 32 was waiting, it unlocks)
}
```

### UIManager listens to BIOMARKER_UPDATED (Events #4-7)

```javascript
uiManager.onBiomarkerUpdated = function(data) {
  const { biomarkerId, newValue, normalRange } = data;
  
  // For BM_GLUCOSE:
  const element = document.getElementById(`biomarker-${biomarkerId}`);
  element.textContent = `${newValue} mg/dL`;
  
  // Check if in normal range
  if (newValue >= normalRange[0] && newValue <= normalRange[1]) {
    element.style.color = 'green';  // Normal
  } else if (newValue < normalRange[0]) {
    element.style.color = 'red';    // Too low
  } else {
    element.style.color = 'orange'; // Too high
  }
};
```

DOM after update:
```html
<div id="biomarker-BM_GLUCOSE">499 mg/dL</div>  <!-- green -->
<div id="biomarker-BM_OXYGEN_SATURATION">94%</div>  <!-- green -->
<div id="biomarker-BM_ATP_ENERGY">32 μmol</div>  <!-- orange (above normal 2.5-4.0) -->
```

---

## IF THERE WERE MODIFIERS ACTIVE

Hypothetically, if PathologySystem had applied a modifier before this tick:

```javascript
modifierSystem.addModifier('disease_hypoxia', {
  atp_production: 0.75,
  resource_gain: 0.85
});
```

Then at **STEP 1B** (line 241):

```javascript
const finalOutputs = this.modifierSystem.applyModifiers({ RES_ATP: 32, RES_LACTATE: 0 });

// Inside ModifierSystem.applyModifiers:
for (const [statKey, baseValue] of Object.entries(baseValues)) {
  if (statKey === 'RES_ATP' && baseValue === 32) {
    let multiplier = 1.0;
    multiplier *= 0.75;  // from disease_hypoxia modifier
    result['RES_ATP'] = 32 * 0.75 = 24;  // NOT 32!
  }
}

// finalOutputs = { RES_ATP: 24, RES_LACTATE: 0 }
```

**EVENT #2 would emit different payload**:
```
RESOURCES_PRODUCED:
  buildingId: 'BLD_MITOCHONDRIA'
  resources: { RES_ATP: 24, RES_LACTATE: 0 }  // 24 instead of 32!
```

And final resources would be:
```
RES_ATP: 24  // Not 32
```

---

## SUMMARY

**One 8-second simulation tick produced**:
- **1 completed recipe** (Mitochondria cycle)
- **1 glucose consumed**, resulting in:
  - **32 ATP produced** (because no disease modifiers active)
  - **0 lactate** (aerobic respiration has no lactate)
- **0 diseases triggered** (lactate threshold not reached)
- **5 biomarker updates** (initial values)
- **7 events emitted** in exact sequence
- **All rules came from BioDatabase**, no hardcoding
- **All state changes via events**, no direct system calls

If you changed BioDatabase to make aerobic respiration cost 2 glucose instead of 1, next tick would consume 2 glucose. If you added a disease modifier, ATP production would multiply by the modifier. **Everything is data-driven.**

