# BIO-FACTORY: MASTER TODO LIST
**Status**: Alpha Development  
**Last Updated**: February 9, 2026  
**Build Version**: 0.2.1

---

## 🔴 CRITICAL BUGS - Selection System (BLOCKING GAMEPLAY - FIX FIRST)

### Issue A: Cell Selection Gets "Stuck" - Mouse Release Not Detected
- [ ] **Root Cause**: `onMouseUp` listener attached to `this.renderer.domElement` (canvas only)
  - **Symptom**: Release mouse button outside canvas → drag never ends → selection frozen to cursor
  - **Impact**: BLOCKS ALL SELECTION GAMEPLAY
  
- **Solution**: Move event listeners to `window` level
  ```javascript
  // BEFORE (WRONG - only captures inside canvas):
  this.renderer.domElement.addEventListener('mousemove', onMouseMove);
  this.renderer.domElement.addEventListener('mouseup', onMouseUp);
  
  // AFTER (CORRECT - captures anywhere on window):
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  this.renderer.domElement.addEventListener('mousedown', onMouseDown); // Only canvas
  ```
  
- **File**: `src/core/Engine.js` → `setupMouseTracking()` method
- **Status**: 🔴 AWAITING FIX

### Issue B: Only Start Cell Highlighted During Drag - Visual Glitch
- [ ] **Root Cause #1**: Creating new `THREE.MeshBasicMaterial` every frame (60x/sec) → shader recompilation lag
- [ ] **Root Cause #2**: Creating new `THREE.PlaneGeometry` for each cell in loop → memory thrashing
- [ ] **Root Cause #3**: Floating-point grid coordinates (1.0001) cause loop unpredictability

- **Solution**: Reusable materials + geometry + integer coordinates
  ```javascript
  // In ENGINE CONSTRUCTOR:
  this.selectionMaterial = new THREE.MeshBasicMaterial({...});
  this.selectionGeometry = new THREE.PlaneGeometry(0.9, 0.9);
  
  // In visualizeSelection():
  const minX = Math.round(selectionRegion.minX);  // Force integers
  for (let x = minX; x <= maxX; x++) {
      const overlay = new THREE.Mesh(this.selectionGeometry, this.selectionMaterial);
  }
  ```
  
- **File**: `src/core/Engine.js`
- **Status**: 🔴 AWAITING FIX

### Issue C: Selection Box Text Shows Range, But Second Point Not Updating Mid-Drag
- [ ] Verify `currentDragSelection` updates in `onMouseMove`
- [ ] Check console logs for `[MouseMove]` spam
- [ ] Status**: 🟡 INVESTIGATE AFTER A & B

---

## 🟡 OTHER CRITICAL BUGS - System Blockers

- [ ] **BUG: Grid tiles not visible** - Ground appears flat blue
  - **File**: `src/world/Grid.js`
  
- [ ] **BUG: Vitals graphs disappeared** - Biomarker sparklines not rendering
  - **File**: `src/ui/BiomarkerMonitor.js`
  
- [ ] **BUG: Building placement not working** - Buildings don't place on grid
  - **File**: `src/entities/VesselSystemV2.js`
  
- [ ] **BUG: Diagnostics button doesn't open** - Non-functional
  - **File**: `src/ui/HUD_NEW.js`

---

## 🟡 URGENT UI/UX CHANGES - Priority 1

### Layout & Navigation
- [ ] **Reorganize HUD Layout**
  - Move grid coordinates to TOP CENTER of screen
  - Create info sections: POSITION, TERRAIN, BUILDING, SELECTION
  - **File**: `src/ui/HUD_NEW.js` → `createTopPanel()`
  
- [ ] **Hotbar Toggle Behavior**
  - Press 1-6: Select building
  - Press again: Deselect (no building active)
  - Switch to new building: Highlight updates
  - **File**: `src/ui/Hotbar.js`
  
- [ ] **Inventory Panel Collapse/Expand**
  - Hidden by default (collapsed state)
  - Bottom-right toggle button with icon
  - Can expand to show Resources + Buildings tabs
  - **File**: `src/ui/HUD_NEW.js`
  
- [ ] **Add Diagnostics Panel**
  - Button: TOP-LEFT (near Settings)
  - Shows Biomarker vitals with graphs
  - Displays critical warnings when health low
  - **File**: `src/ui/HUD_NEW.js` → `createTopLeftMenu()`

- [ ] **Resource Toggle (Show All vs Loaded Only)**
  - Button: TOP-RIGHT corner
  - Filter: Show only resources with non-zero amount
  - **File**: `src/ui/HUD_NEW.js`

- [ ] **Remove Affordability Visual Indicators**
  - Remove red flashing when building unaffordable
  - Remove cost highlighting in hotbar
  - **File**: `src/ui/HUD_NEW.js`, `src/ui/Hotbar.js`

### Grid Visibility
- [ ] **Fix Ground/Grid Visibility**
  - Make grid tiles visible again (opacity issue?)
  - Ensure colored squares (green/red/yellow) are distinguishable
  - Grid lines should remain visible
  - **File**: `src/world/Grid.js`

### Vitals Display  
- [ ] **Restore Vitals Graphs**
  - Re-enable sparkline canvas rendering
  - Ensure graphs animate smoothly
  - Show values + thresholds
  - **File**: `src/ui/BiomarkerMonitor.js`

---

## 🟢 NEW FEATURES - BioDatabase Integration (✓ COMPLETED)

**Status**: SYNTAX VERIFIED - Ready for integration

- [x] **Enhanced BioDatabase.js** with Structures
  - 5 structure types (Capillary Beds, Mitochondria, Lysosomes, ER, etc.)
  - Health-based system (HEALTHY ↔ BROKEN states)
  - Systemic modifier effects (SYS_TOXICITY, SYS_OXYGENATION, SYS_ENERGY)
  - **Status**: ✓ DONE
  
- [x] **Updated ResourceManager.js**
  - Pulls visual properties (shape, color) from BioDatabase
  - Supports procedural geometry (sphere, cube, icosahedron, etc.)
  - Auto-initializes resource pools
  - **Status**: ✓ DONE
  
- [x] **New MapGenerator.js**
  - Procedural structure placement (5-20 per biome)
  - Biome-based layouts (ENDOTHELIUM, CYTOPLASM)
  - Break/repair mechanics with cost system
  - Debug utilities for structure tracking
  - **Status**: ✓ DONE
  
- [x] **Enhanced BaseBuilding.js**
  - New `Structure` class with health/state system
  - `CatabolismCell`: Glucose → ATP production (3 sec cycles)
  - `AnabolismCell`: Amino Acids → Protein synthesis (4 sec cycles)
  - Both support visual feedback and lifecycle
  - **Status**: ✓ DONE

### Integration Tasks
- [ ] **Wire MapGenerator into Engine.js**
  - Initialize in game startup
  - Call `generateMap()` after grid creation
  - Pass ProgressionManager reference
  
- [ ] **Create SystemicEffectEngine**
  - Apply SYSTEM_MOD effects from broken structures
  - Track stat modifiers in GameState
  - Update UI when stats change
  
- [ ] **Implement Repair UI & Mechanics**
  - Show broken structures in Diagnostics panel
  - Display repair cost + time
  - Button to initiate repair (consumes resources)
  - Progress bar for repair duration
  
- [ ] **Connect Structure Damage System**
  - Add method to apply damage to structure grid
  - Trigger break transition when health → 0
  - Propagate systemic effects to player stats
  
- [ ] **Create Worker Cell Spawning**
  - Implement StemCell unit that can differentiate
  - Create UI for specialization selection
  - Spawn CatabolismCell or AnabolismCell on grid
  - Track cell lifecycle and production

---

## 🎮 PHASE 0: Core Gameplay Loop (CRITICAL)

**Goal**: Get selection working + building placement functioning

- [ ] **Debug & Fix Building Placement**
  - Test VesselSystemV2.createVesselMesh()
  - Test PlacementManager.placeBuilding()
  - Test cost deduction (inventory.deductCost())
  - Add visual feedback: building appears on grid
  - Add visual feedback: construction animation (simple scaling)
  
- [ ] **Implement Vessel Auto-Connection**
  - Debug VesselSystemV2.autoConnectNeighbors()
  - Test rotation based on neighbors
  - Visualize connections between adjacent vessels
  
- [ ] **Add Basic Resource Display**
  - Show current resource amounts in game
  - Display when resources are collected (if extractor works)
  - Show production/consumption rates

- [ ] **Create Game Start State**
  - Initialize player with starting resources (100 Glucose?)
  - Initialize grid with some starter buildings?
  - Show tutorial/help text
  
- [ ] **Add Pause System**
  - P key to pause/unpause game
  - Show pause overlay

---

## 🧬 PHASE 1: CORE FLUID DYNAMICS & INFRASTRUCTURE

**Goal**: Establish the backbone for resource distribution

### Task 1.1: Smart Vascular Bed Multi-Port Hub
- [ ] **Create VascularBed class**
  - 2×2 block structure (4 ports)
  - Round-robin distribution algorithm
  - Acts as central hub for connections
  - Can distribute one input to multiple outputs
  - Building type for UI (hotkey 7?)

- [ ] **Implement port system**
  - Define N inputs, N outputs per building
  - Create connection visualization (lines between ports)

### Task 1.2: Fluid Viscosity Differentiation
- [ ] **Create VESSEL vs LYMPH_CHANNEL types**
  - **VESSEL**: Fast transport, good for Oxygen/Water
    - Transport speed: 1.0 (normal)
    - Pulses with cyan glow
  - **LYMPH_CHANNEL**: Slow transport, good for Lipids/Cells
    - Transport speed: 0.3 (slower)
    - Renders as pale/translucent
    - If Lipid enters VESSEL: 5%/sec chance of THROMBOSIS (blockage)

- [ ] **Implement thrombosis mechanic**
  - Blockage appears visually on affected vessel
  - Blocks resource flow through that segment
  - Can be cleared by deploying antibiotics or immune cells

### Task 1.3: Dynamic Grid Layers
- [ ] **Implement 3-layer grid system**
  - Layer 1: **Terrain** (Endothelium/Calcified/Capillary)
  - Layer 2: **Pathology** (Atheroma clusters, Inflammation zones)
  - Layer 3: **Buildings** (Extractors, vessels, etc.)

- [ ] **Pathology-Terrain Interaction**
  - When atheroma spreads → blocks terrain passage
  - When inflammation → reduces extraction rate
  - Dynamic updates to grid properties

---

## 🔄 PHASE 2: TIER 0 - THE ANAEROBIC LOOP

**Goal**: Create recycling mechanics for waste management

### Task 2.1: The Cori Cycle (Lactate Recycling)
- [ ] **Create Gluconeogenesis Vat building**
  - Input: 2 Lactate + 1 ATP
  - Output: 1 Glucose
  - Purpose: Recycles waste into usable resource
  - Prevents resource jams, enables "infinite" loops

- [ ] **Implement recycling UI**
  - Show in building catalog
  - Set cost/build time
  - Display recipe in detail panel

### Task 2.2: Bio-Polymers Production
- [ ] **Create Polymerizer building**
  - Input: Lactate + Amino Acids (future resource)
  - Output: BIO_MESH (Tier 1 construction material)
  - Usage: Used for cheap walls and conveyor belts

- [ ] **Create BIO_MESH resource**
  - New resource type
  - Used as building material (Tier 1)
  - Cheaper to produce than direct buildings

---

## 🌱 PHASE 3: TIER 1 & FARMING

**Goal**: Introduce biological farming for resource diversity

### Task 3.1: Microbiome Farming System
- [ ] **Create Cultivation Tiles**
  - Special placement type (only on specific biomes)
  - Acts as "farm" for biological growth
  
- [ ] **Implement Spore System**
  - Wild fungal spores exist in certain terrain zones
  - Player harvests spores → plants them on farms
  - Spores grow into productive colonies

### Task 3.2: Farm Types
- [ ] **PENICILLIUM_MOLD Farm**
  - Substrate: Moist Tissue only
  - Input: 1 Glucose per cycle
  - Output: 0.5 RAW_PENICILLIN
  - Build time: 20s
  - Cost: 15 Glucose

- [ ] **YEAST_COLONY Farm**
  - Substrate: Any terrain
  - Input: 1 Glucose per cycle
  - Output: 0.3 ETHANOL + 0.2 CO2
  - Build time: 15s
  - Cost: 12 Glucose

- [ ] **Resource Types: RAW_PENICILLIN, ETHANOL, CO2**
  - Add to inventory system
  - Display in UI
  - Set coloring/icons

### Task 3.3: Intermediate Processing
- [ ] **Create Fermenter building**
  - Input: RAW_PENICILLIN + ETHANOL
  - Output: PURE_ANTIBIOTIC (1:1 recipe)
  - Purpose: Converts raw products → effective drugs
  - Build time: 10s
  - Cost: 20 Glucose

---

## 💪 PHASE 4: TIER 2 - LIPIDS & STRUCTURAL INTEGRITY

**Goal**: Introduce advanced metabolic pathways

### Task 4.1: Calcium Signaling System
- [ ] **Implement CALCIUM_ION tracking**
  - New resource type
  - Source: Extract from calcified zones (at high cost)
  
- [ ] **Create CALCIUM_ION -> SIGNAL conversion**
  - New building: Synaptic Relay (Logic Gate)
  - Input: Constant Calcium stream
  - Output: SIGNAL (activation of downstream buildings)
  - Function: Requires 0.1 Calcium per second to transmit
  - Creates automation/logic without computers

### Task 4.2: The Cholesterol Dilemma
- [ ] **Create CHOLESTEROL resource**
  - Source: Lipid processing -> CHOLESTEROL
  - Limited by resource bottleneck
  
- [ ] **Cholesterol dual-use system**
  - Usage 1: Cell Membrane material (building upgrade)
  - Usage 2: Steroid Hormone production (temporary buffs)
  
- [ ] **Atheroma Formation**
  - Excess cholesterol (>50 in system) → slowly forms ATHEROMA plaques
  - Atheroma spreads on grid (pathology layer)
  - Atheroma blocks vessel passages
  - Can be cleared with specific treatments

---

## ⚔️ PHASE 5: PATHOLOGY & PHARMACOLOGY

**Goal**: Implement disease/combat system with strategic depth

### Task 5.1: Efficacy Matrix (Drug Effectiveness)
- [ ] **Implement Drug_Profile system**
  - Define effectiveness vs pathogen types
  - Example profiles:
    - **Penicillin**: 1.0 vs Bacteria, 0.0 vs Virus
    - **Ethanol**: 0.5 vs Bacteria (area), 0.1 vs Virus
    - **Interferon**: 0.8 vs Virus, 0.1 vs Bacteria
  - Formula: Damage = Base_Attack * Drug_Profile[drug_id][pathogen_id]

- [ ] **Create pathogen types**
  - Bacteria (countered by Penicillin, Ethanol)
  - Virus (countered by Interferon)
  - Prion (resistant to most drugs, requires containment)

### Task 5.2: Drug Delivery Systems
- [ ] **Spray Tower building**
  - Input: ETHANOL or SPRAY_ANTIBIOTIC
  - Effect: Area damage (5×5 radius)
  - Good for low-cost, broad-spectrum treatment
  - Build: 15 Glucose, 10s

- [ ] **Injection Drone building**
  - Input: PURE_ANTIBIOTIC or INTERFERON
  - Effect: Single-target high damage
  - Good for precise, expensive treatments
  - Build: 25 Glucose, 15s

- [ ] **Systemic Release building**
  - Input: Drug + Water supply
  - Effect: Weak global effect (all pathogens take 5% damage/sec)
  - Good for prevention, weak for combat
  - Build: 30 Glucose, 20s

---

## 🎯 PHASE 6: DISEASE MECHANICS & BIOMARKER INTEGRATION

**Goal**: Connect diseases to biomarkers, create health challenges

- [ ] **Implement pathogen entities**
  - Each pathogen has: type, position, health, spread_rate
  - Spread to adjacent cells over time
  - Cause damage to buildings they contact

- [ ] **Connect diseases to biomarkers**
  - Bacterial infection → ↑ WBC, ↓ pH
  - Viral infection → ↑ Temperature (new biomarker?), ↓ O₂
  - Inflammation → ↑ Lactate, ↓ ATP production
  
- [ ] **Create infection events**
  - Random pathogen spawn after 2 minutes
  - Increasing difficulty waves
  - Player must respond or lose

- [ ] **Implement game-over condition**
  - Critical biomarker threshold failure → loss condition
  - Give warning before critical

---

## 🎮 PHASE 7: GAMEPLAY & PROGRESSION

**Goal**: Add depth and replayability

- [ ] **Difficulty Levels**
  - Easy: Slower pathogen spread, more resources
  - Normal: Balanced (current)
  - Hard: Aggressive diseases, resource scarcity

- [ ] **Scenario Modes**
  - Tutorial scenario (guided)
  - Classic scenario (free play with waves)
  - Challenge scenarios (specific objectives)

- [ ] **Victory & Loss Conditions**
  - Win: Maintain biomarkers in healthy range for 10 minutes
  - Lose: Any biomarker goes critical
  - Special win: Cure a disease if infected

- [ ] **Stats & Progression**
  - Track production/consumption rates
  - Track buildings built
  - Track diseases defeated
  - Unlock achievements

---

## 🎨 PHASE 8: POLISH & OPTIMIZATION

- [ ] **Visual Enhancements**
  - Building construction animations
  - Resource flow animations (particles moving through vessels)
  - Disease visual markers (red glow at infection sites)
  - Biomarker alert animations

- [ ] **Audio System**
  - Background medical ambient music
  - Sound effects: building place, disease alert, critical warning
  - UI sounds: button clicks, panel opens

- [ ] **QoL Features**
  - Tutorial system
  - Settings menu (volume, difficulty, graphics)
  - Save/load game state
  - Keyboard shortcuts guide

- [ ] **Performance Monitoring**
  - FPS counter option
  - Draw call display
  - Memory usage monitor

---

## 📋 IMPLEMENTATION ORDER (Recommended)

1. **Week 1**: Fix all critical bugs + UI reorganization (Phases 0)
2. **Week 2**: Implement vascular system + fluid dynamics (Phase 1)
3. **Week 3**: Add anaerobic loop + recycling (Phase 2)
4. **Week 4**: Implement farming system (Phase 3)
5. **Week 5**: Add lipid & calcium systems (Phase 4)
6. **Week 6**: Implement pathology & drugs (Phase 5)
7. **Week 7**: Connect disease mechanics (Phase 6)
8. **Week 8**: Polish & optimization (Phases 7-8)

---

## 🎯 Quick Reference: Building Checklist

### Current Buildings
- [x] Extractor (1)
- [x] Vessel (2)
- [x] Mitochondria (3)
- [x] Cytosol (4)
- [x] Storage (5)
- [x] Immune Cell (6)

### Phase 2 Buildings (To Add)
- [ ] Vascular Hub (7)
- [ ] Gluconeogenesis Vat (8)
- [ ] Polymerizer (9)

### Phase 3 Buildings (To Add)
- [ ] Penicillium Farm (10)
- [ ] Yeast Farm (11)
- [ ] Fermenter (12)

### Phase 4 Buildings (To Add)
- [ ] Synaptic Relay (13)

### Phase 5 Buildings (To Add)
- [ ] Spray Tower (14)
- [ ] Injection Drone (15)
- [ ] Systemic Release (16)

---

## 📊 Resource Dependency Web

```
GLUCOSE (base) 
  ├─ ATP (via Mitochondria: Glucose + O₂ → ATP)
  ├─ LACTATE (via Cytosol: Glucose → Lactate)
  ├─ BIO_MESH (via Polymerizer: Lactate + AA → BIO_MESH)
  └─ FARM INPUTS (Mold, Yeast)

OXYGEN (from terrain)
  ├─ ATP production (with Glucose)
  └─ SIGNAL biomarker

LACTATE (waste)
  ├─ GLUCOSE (via Gluconeogenesis: 2 Lactate + ATP → Glucose)
  └─ BIO_MESH (via Polymerizer: Lactate + AA → BIO_MESH)

CHOLESTEROL (from Lipids)
  ├─ Cell Membrane (building upgrade)
  ├─ STEROID (buff)
  └─ Atheroma (excess → plaque formation)

CALCIUM (from Calcified terrain)
  └─ SIGNAL (via Synaptic Relay)

ETHANOL (from Yeast farm)
  ├─ PURE_ANTIBIOTIC (via Fermenter: Penicillin + Ethanol)
  ├─ SPRAY_ANTIBIOTIC (for Spray Tower)
  └─ DISINFECTANT (area damage)

RAW_PENICILLIN (from Mold farm)
  └─ PURE_ANTIBIOTIC (via Fermenter: Penicillin + Ethanol)

PURE_ANTIBIOTIC
  ├─ Drug delivery (Injection Drone)
  └─ Systemic treatment

INTERFERON (future)
  └─ Anti-viral drug delivery

BIO_MESH
  ├─ Wall construction (Tier 1)
  └─ Conveyor belts
```

---

## ❓ Questions for User

Before proceeding with implementation, please clarify:

1. **Building Costs**: Should we keep current costs or rebalance for farming economy?
2. **Game Length**: How long should one play session be? (10 min? 30 min? 1 hour?)
3. **Difficulty Curve**: How should disease intensity scale? Linear? Exponential?
4. **Art Style**: Should farms/pathogens have unique visual styles?
5. **Tutorial**: Do you want guided tutorial or let players figure it out?

---

**STATUS**: Ready for Phase 0 implementation (bug fixes + UI)  
**NEXT STEP**: Confirm critical bug list, then begin fixes
