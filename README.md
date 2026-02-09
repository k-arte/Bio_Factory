# Bio-Factory: Pathophysiological Systems Simulation

An educational interactive simulation demonstrating cellular metabolism, resource transport, and biological system dynamics through the lens of a factory/RTS game mechanic.

**Not a game.** A teaching tool disguised as one.

---

## 🎯 Core Vision

### What This Is
Bio-Factory models a biological organ's internal *chemical factory* using three parallel systems:
1. **Physical 3D visualization** (Three.js) showing spatial layout and material flow
2. **Procedural biome generation** creating realistic tissue structures  
3. **Data-driven rule system** encoding metabolic/biological principles in JSON

### Educational Purpose
Students and AI systems learn:
- How data-driven architecture decouples rules from engine
- Metabolic pathways as resource conversion chains
- Cellular structures as functional entities with health/state
- Event-driven progression systems for unlock mechanics
- Separation of concerns: rendering vs. simulation vs. data

### Design Principles
1. **Biological Accuracy Over Game Balance**
   - Glucose → ATP conversion reflects real efficiency ratios
   - Oxygen requirements match aerobic respiration pathways
   - Tissue damage cascades model pathophysiological response
   
2. **Data Precedes Code**
   - `src/data/BioDatabase.js` is the single source of truth
   - Game engine knows nothing about "Glucose" or "Mitochondria"
   - All rules are JSON; no hardcoding of mechanics

3. **Generic, Introspective Engine**
   - Three.js renderer is resource-agnostic
   - Progression system is condition-agnostic
   - UI reads from JSON; doesn't embed logic

---

## 🏗️ Architectural Philosophy

### The Contract
```
BioDatabase (JSON) 
  ↓ (source of all game mechanics)
Engine (generic, data-agnostic)
  ↓ (applies rules without knowing domain)
Visual Feedback + Player Interaction
  ↓ (back to data)
Events → Progression → Persist
```

### Why This Matters
- **Changeability**: Rebalance the entire game by editing one JSON file
- **Testability**: Rules are data, not hidden in code logic
- **Reusability**: The engine could simulate any domain with different JSON
- **Maintainability**: No duplicate code describing the same rule twice
- **Extensibility**: New features extend the schema, not the engine

### Core Files Architecture

| Folder | Responsibility | Knows About |
|--------|-----------------|-----------|
| `src/core/` | Rendering loop, camera, input, events | Canvas, mouse/keyboard, 3D objects |
| `src/systems/` | Resource pooling, progression, persistence | Events, conditions, statistics |
| `src/entities/` | Building placement, vessel networking, transport | Grid coordinates, connectivity |
| `src/ui/` | Display layers, HUD panels, inventory state | DOM, colors, formatting only |
| `src/data/` | **JSON game rules** (singular source) | What glucose IS, how ATP works |
| `src/world/` | Terrain, structures, procedural generation | Biome layouts, tissue distribution |

---

## 📊 What Exists (Status & Completeness)

### ✅ FULLY IMPLEMENTED

**Rendering Pipeline**
- Three.js scene with wet flesh material (red, emissive, normal-mapped)
- Quality profile system (HIGH/MEDIUM/LOW) for performance scaling
- Proper tone mapping (sRGB + ACES Filmic)
- Grid overlay with cyan lines and cell highlighting
- RTS camera with smooth pan/zoom

**Input System (InputManagerV2)**
- Mouse raycasting to grid cells
- Building selection via hotbar (1-6 keys)
- Ghost mesh preview for placement
- Terrain inspection on hover

**Building Placement (PlacementManager)**
- Place extractors (1×1), storage (1×1), nucleus (5×5) buildings
- Event emission on placement → triggers progression checks
- Collision detection and occupied cell tracking

**Resource System (ResourceManager)**
- Mesh pooling for performance (~15 per resource type, 50 limit)
- Event emitters for production/consumption
- Data-driven shape/color from BioDatabase physics
- Sprites: sphere, cube, tetrahedron, octahedron, icosahedron

**Progression Framework (ProgressionManager)**
- Event-driven unlock system (no polling, O(1) per event)
- Listener maps for efficient condition checking
- Stat tracking: `total_energy_produced`, `buildings_built`, `playtime_seconds`
- Persistence to localStorage via SaveManager (auto-save every 30s)

**Map Generation (MapGenerator)**
- Procedural biome layout (2×2 grid: ENDOTHELIUM / CYTOPLASM)
- Structure placement respecting unlock conditions
- Terrain type assignment (buildable, blocked, resource zones)

**UI Subsystem (HUD_NEW)**
- Top bar: Grid coordinates, terrain info, building hover details
- Hotbar: 6 buildings (1-6 hotkeys) with affordability tracking
- Inventory: Resource display, building catalog
- Biomarker monitor: Real-time health sparklines (WBC, pH, Glucose, O₂)
- Guide panel: Searchable database of entries with unlock hints
- Settings, diagnostics, draft sections

**Data Integrity**
- Single `BioDatabase.js` (542 lines) as source of truth
- Schema includes: resources, buildings, structures, unlock_conditions, alt_recipes (framework), aoe_emitters (framework), systemic_modifiers (framework)
- All costs/properties queried from JSON, not hardcoded

---

### 🟡 PARTIALLY IMPLEMENTED (Prototype)

**Alternative Recipes (Alternate Crafting Paths)**
- JSON schema ready: `resources[].alt_recipes[]` with `unlock_condition`
- Mechanism: Check condition in ProgressionManager
- **Missing**: UI to display recipes, crafting queue, resource conversion flow

**AoE Emitters (Area Effects)**
- JSON schema ready: `buildings[].aoe_emitters[]` with radius, effect type
- Mechanism: Framework for applying effects to cells in range
- **Missing**: Effect propagation, damage calculation, visual feedback

**Systemic Modifiers (Organ-Wide Status Effects)**
- JSON schema ready: `structures[].systemic_modifiers[]` (affect biomarker thresholds)
- Concept: Broken structure → organism-wide penalty (e.g., SYS_TOXICITY +1)
- **Missing**: Implementation, biomarker integration, visual indicators

**Vessel/Transport System (Pipe Networks)**
- JSON schema: vessels as entities connecting buildings
- Classes: `VesselSystemV2` (placement UI), `TransportSystem` (flow simulation)
- **Implemented**: Placement drag-to-place, auto-connection logic
- **Missing**: Resource flow simulation, pathfinding, pressure balancing

---

### ❌ NOT IMPLEMENTED (Planned Architecture)

**Real Gameplay Loop**
- Buildings don't produce resources yet (extraction, processing pipelines)
- Resources don't flow through vessels
- No energy economy (ATP cost for building operations)
- No damage/healing mechanics for structures
- No disease/pathogen simulation

**Balancing System**
- No difficulty levels or dynamic scaling
- No achievement/milestone tracking (framework exists)
- No tutorial or guided progression

**Persistence**
- Save/load exists in SaveManager, not wired to UI
- No auto-save on critical milestones
- No undo/redo system

**Audio/Feedback**
- No sound effects or music
- No particle effects for production/consumption
- No haptic feedback

---

## 🎮 How to Run

### Prerequisites
```bash
npm install
```

### Development Server
```bash
npm run dev
```
Opens `http://localhost:5173` with hot module reload.

### Build for Production
```bash
npm run build
```
Outputs optimized bundle to `dist/`.

### Browser DevTools
```javascript
// In console, access game state:
engine.resourceManager        // Inspect active resources
engine.progressionManager     // Check unlocked entries
engine.mapGenerator           // View biome/structure data
engine.placementManager       // List placed buildings
```

---

## 📐 Data-Driven Development: Rules for AI Contributors

### The Golden Rule
**If a game mechanic exists, it must be defined in `src/data/BioDatabase.js`.**

### Specific Rules

#### 1. No Hardcoded Game Values
**❌ WRONG:**
```javascript
if (buildingType === 'extractor' && resourceType === 'glucose') {
  amount = 5;  // Hardcoded production
}
```

**✅ RIGHT:**
```javascript
const dbEntry = BioDatabase.buildings.find(b => b.id === buildingId);
const production = dbEntry.production[resourceType]; // Read from JSON
```

#### 2. No Duplicate System Definitions
**❌ WRONG:**
```javascript
// In Inventory.js
this.buildings = {
  extractor: { cost: { glucose: 10 } }
};

// Also in PlacementManager.js
const COST = { EXTRACTOR: { glucose: 10 } };  // Duplicate!
```

**✅ RIGHT:**
```javascript
// Single source, queried everywhere:
const dbEntry = BioDatabase.buildings.find(b => b.id === 'BLD_EXTRACTOR');
const cost = dbEntry.cost;  // Same reference, everywhere
```

#### 3. Extend Schema, Don't Patch Logic
**❌ WRONG:**
```javascript
// Want to add fire resistance? Hardcode check:
if (building.fireResistance > 0) { ... }
```

**✅ RIGHT:**
```javascript
// Add to BioDatabase:
{
  id: "BLD_EXTRACTOR",
  name: "Extractor",
  resistances: {
    fire: 0.8,
    cold: 0.3
  }
}
// Then query it everywhere:
const resistance = dbEntry.resistances[damageType] || 0;
```

#### 4. Events Must Flow Through Progression
**❌ WRONG:**
```javascript
// Direct unlock:
if (resourceProduced > 500) {
  unlockedBuildings.push('BLD_MITOCHONDRIA');
}
```

**✅ RIGHT:**
```javascript
// Fire event:
resourceManager.onProduced('RES_ATP', 1);

// Progression handles:
onResourceProduced(resourceType, amount) {
  this.stats.total_energy_produced += amount;
  this._checkStatThreshold('total_energy_produced');  // Reads unlock_condition from JSON
}
```

#### 5. No Side Effects in Getters
**❌ WRONG:**
```javascript
getBuilding(id) {
  const building = this.buildings[id];
  building.timesAccessed++;  // Side effect!
  return building;
}
```

**✅ RIGHT:**
```javascript
getBuilding(id) {
  return this.buildings[id];  // Pure function
}

// Tracking done in dedicated method:
trackBuildingView(id) {
  this.stats.buildingViewCount[id]++;
}
```

#### 6. Data First, Then Implementation
**When adding a feature:**
1. Define it in BioDatabase (schema + values)
2. Wire it to systems (events, checks, effects)
3. Add UI to display it
4. Test end-to-end flow

**Never:**
1. "Quick hardcode" thinking you'll add JSON later
2. Implement without finalizing the data shape

---

## 🔴 Current Technical Debt & Risks

### CRITICAL (Breaking)

**Risk 1: VesselSystem Ambiguity**
- Two vessel classes exist: `VesselSystem` (auto-tiling) and `VesselSystemV2` (drag-to-place)
- **Status**: Only VesselSystemV2 imported; VesselSystem is dead code (should be deleted)
- **Impact**: Maintenance confusion, unclear which interface to use
- **Mitigation**: Decide definitively; delete or consolidate
- **Timeline**: Must resolve before vessel transport is implemented

**Risk 2: Building Type Mapping**
- Inventory.js maps UI keys (extractor, mitochondria) to DB IDs (BLD_EXTRACTOR, BLD_MITOCHONDRIA)
- Partial mapping: Some buildings not yet in BioDatabase (vessel, cytosol, defender)
- **Status**: Falls back to hardcoded defaults
- **Impact**: If you edit Inventory costs, they diverge from JSON
- **Mitigation**: Prioritize adding all buildings to BioDatabase
- **Timeline**: Add 100% of buildings to schema before gameplay loop launch

**Risk 3: SaveManager Integration Incomplete**
- Auto-save fires every 30s but `saveGameState()` never actually called
- No hook to trigger save on meaningful events (building placed, research completed)
- **Status**: Call exists but no event connection
- **Impact**: Player progress may not persist properly
- **Mitigation**: Wire building placement and progression events to `saveGameState()`
- **Timeline**: Test before any public release

### HIGH (Architectural)

**Risk 4: HUD_NEW God Class**
- Single file: 1369 lines handling inventory, biomarkers, hotbar, guide, settings, progression, diagnostics
- **Status**: Works but unmaintainable
- **Impact**: Hard to test, extend, debug individual panels
- **Mitigation**: Refactor into separate panel classes (HUDController + InventoryPanel, BiomarkerPanel, etc.)
- **Timeline**: After core gameplay loop stabilizes

**Risk 5: MapGenerator Called But Results Unused**
- `mapGenerator.generateMap()` runs and creates structures
- No visual representation or interaction yet (structures are in data, not scene)
- **Status**: Generates data; doesn't affect player experience
- **Impact**: Code-to-visualization gap; structures exist in logic but invisible
- **Mitigation**: Implement structure meshes and add to scene
- **Timeline**: Coordinate with building placement for visual consistency

**Risk 6: No Resource Production Pipeline**
- Buildings can be placed but don't produce/consume resources
- ResourceManager exists but `resourceManager.getResource()` never called
- **Status**: Framework complete, gameplay missing
- **Impact**: Game is unplayable; factories don't work
- **Mitigation**: Implement extractor production, transport flow, ATP consumption loop
- **Timeline**: Core gameplay loop is next major milestone

---

### MEDIUM (Design)

**Risk 7: BioDatabase Schema Still Incomplete**
- alt_recipes, aoe_emitters, systemic_modifiers defined but not implemented
- Default values for buildings not in DB (fallback hardcodes)
- **Status**: Growing toward full schema, currently ~70% coverage
- **Impact**: Feature parity between code and data design incomplete
- **Mitigation**: Evaluate cost of each feature; implement or remove from schema
- **Timeline**: Stabilize schema before v1.0

**Risk 8: No Performance Profiling**
- No FPS monitoring or bottleneck identification
- Three.js may hit limits with many resources/buildings
- **Status**: Assumed working (quality profile system in place)
- **Impact**: May discover performance wall unexpectedly
- **Mitigation**: Add perf stats display; test with 500+ active resources
- **Timeline**: Profile before mobile support

**Risk 9: Event System Not Exhaustive**
- Only ResourceManager and PlacementManager fire events
- Missing: VesselPlace, StructureBreak, UnlockTriggered, ResearchStart
- **Status**: Core events exist; supplementary events incomplete
- **Impact**: Some progression conditions can't trigger without more events
- **Mitigation**: Define event contract; ensure every game action fires relevant event
- **Timeline**: Document and expand as features add

---

### LOW (Polish)

**Risk 10: Guide Panel Incomplete**
- Guide displays entries but doesn't differentiate locked vs unlocked visually
- No tutorials or guided progression
- **Status**: Searchable database works; narrative/onboarding missing
- **Impact**: Players/students unclear on how to use system
- **Mitigation**: Add tutorial missions and achievement milestones

**Risk 11: Internationalization Not Planned**
- All text hardcoded in English/Russian mixed
- No i18n framework
- **Status**: Not a priority for educational tool
- **Impact**: Non-English speakers have reduced access
- **Mitigation**: Document as English-only; revisit if global audience needed

---

## 🧬 Development Workflow

### Adding a New Feature

#### Example: "Introduce Calcium Resource"

1. **Define in BioDatabase**
   ```javascript
   {
     id: "RES_CALCIUM",
     name: "Calcium",
     icon: "🟫",
     description: "Mineral compound for cell signaling",
     physics: { viscosity: 1.0, diffusionRate: 0.4 },
     ui_data: { shape: "CUBE", color: "#E0E0E0" }
   }
   ```

2. **Inventory Auto-reads It**
   ```javascript
   // Inventory._initializeBuildingsFromDatabase() sees new resource
   // ResourceManager._buildConfigFromDatabase() creates pool
   // No code changes needed!
   ```

3. **Add to Building Costs (if needed)**
   ```javascript
   {
     id: "BLD_CALCIUM_PUMP",
     name: "Calcium Pump",
     cost: { glucose: 50, calcium: 10 }  // Consumes calcium
   }
   ```

4. **Wire Production Event**
   ```javascript
   // In extractor or transport system:
   resourceManager.onProduced('RES_CALCIUM', 5);
   // ProgressionManager automatically checks for calcium-based unlocks
   ```

5. **Test in Browser**
   ```javascript
   // Console:
   engine.resourceManager.getResource('RES_CALCIUM', { x: 5, y: 0, z: 5 });
   // Should create a cube-shaped resource at that position
   ```

---

## 🔗 Architecture Diagrams

### Event Flow
```
Player clicks "Place Extractor" at grid[10,15]
  ↓
InputManager detects click, validates placement
  ↓
PlacementManager.placeExtractor(10, 15)
  ↓
Creates Extractor mesh in scene
  ↓
Fires: placeExtractor.onPlaced("BLD_EXTRACTOR", "EXTRACTOR", 10, 15)
  ↓
ProgressionManager.onBuildingBuilt("BLD_EXTRACTOR")
  ↓
Increments stats.buildings_built
  ↓
Checks BioDatabase for unlocks with condition {
  type: "STAT_THRESHOLD",
  stat: "buildings_built",
  value: 5
}
  ↓
If buildings_built >= 5, trigger category-specific unlocks
  ↓
SaveManager.saveGameState() (auto-save loop)
  ↓
localStorage updated with unlocked_ids, stats
```

### Data Flow at Startup
```
main.js→Engine constructor
  ├─ setupScene() + setupCamera()
  ├─ initializeGridAndCamera(grid)
  │   ├─ Create HUD (includes ProgressionManager, SaveManager)
  │   ├─ Create InputManager
  │   ├─ Create RTSCamera
  │   └─ setupMouseTracking()
  └─ initializeFactorySystems()
      ├─ ResourceManager(scene)
      │   └─ _buildConfigFromDatabase() reads shapes/colors from BioDatabase
      ├─ Wire events: ResourceManager.onProduced() → ProgressionManager.onResourceProduced()
      ├─ TransportSystem(grid, resourceManager)
      ├─ PlacementManager(...)
      ├─ Wire events: PlacementManager.onPlaced() → ProgressionManager.onBuildingBuilt()
      └─ MapGenerator(grid, scene)
          ├─ setProgressionManager() for unlock checks
          └─ generateMap() returns structures, biomes, stats

Result: All systems wired; JSON is source of truth; events flow to progression
```

---

## 🔍 Testing the Architecture

### Verify Data-Driven Design
```javascript
// In browser console:

// 1. Check resource shapes are from JSON
const cfg = engine.resourceManager.resourceConfigs['RES_ATP'];
console.log(cfg.shape); // Should be 'icosahedron' if from DB

// 2. Verify no hardcoded game logic
// Search codebase: grep -r "glucose.*=.*5" src/
// Should find only defaults, not gameplay logic

// 3. Test event flow
engine.resourceManager.onProduced('RES_GLUCOSE', 10);
console.log(engine.progressionManager.stats.total_energy_produced); // Should be 10+

// 4. Check persistence
engine.saveManager.saveGameState({ unlocked_entries: ['BLD_MITOCHONDRIA'] });
const saved = localStorage.getItem('bio_factory_save_v1');
console.log(JSON.parse(saved).unlocked_entries); // ['BLD_MITOCHONDRIA']
```

---

## 📚 References

**World:**
- Three.js Documentation: https://threejs.org/docs
- Vite Bundler: https://vitejs.dev
- Game Engine Architecture (Gregory): Resource pooling, event systems

**Biology:**
- Cellular respiration pathways (Lehninger biochemistry)
- Tissue organization and homeostasis
- Pathophysiology of organ dysfunction

**Educational Design:**
- Learning by simulation (Schank, Rieber)
- Game-based learning mechanics (Koster, Lazzaro)

---

## 📝 License

Educational, open-source. No restrictions on modification or redistribution for learning purposes.

**Contributors**: Hiro (architecture, systems), Gemini-assisted development (frameworks, initial schemas)

---

## ✅ Checklist for Contributors

Before submitting a pull request:

- [ ] Feature added to BioDatabase first (JSON)
- [ ] No hardcoded game values in code
- [ ] Events wired to ProgressionManager if applicable
- [ ] No duplicate system definitions
- [ ] Inventory/UI reads from JSON, not local state
- [ ] SaveManager can persist changes
- [ ] Syntax checked: `node -c src/yourfile.js`
- [ ] No console errors or warnings
- [ ] Architectural philosophy maintained

---

**Last Updated**: February 9, 2026  
**Status**: Early Alpha — Core architecture complete, gameplay loop in progress  
**Node**: v18+ required, Three.js r182, Vite 7.3.1
