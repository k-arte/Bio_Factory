# Bio-Factory

**A medical-themed real-time strategy (RTS) game at microscopic scale**

An interactive game where you manage cellular resources, build medical infrastructure, and respond to biological threats in real-time. The game presents biology as an engineering challenge—treating cells, pathogens, and immune systems as systems to optimize.

---

## 🎮 Game Overview

### Setting
You manage operations inside a single biological cell or tissue matrix at microscopic scale. The organism starts healthy with stable biomarkers, but diseases (bacteria, viruses, inflammation) can disrupt normal functions. You must:

- **Extract resources** (glucose, oxygen, lipids)
- **Process energy** (ATP production)
- **Transport materials** through vessel networks
- **Respond to diseases** with immune defenses
- **Maintain organism health** by managing biomarkers

### Core Gameplay Loop
1. **Resource Gathering**: Extract glucose and oxygen from the environment
2. **Processing**: Convert resources using mitochondria or cytosol for ATP/energy
3. **Transport**: Build vessel networks to move resources efficiently
4. **Defense**: Deploy immune cells when pathogens appear
5. **Monitoring**: Watch biomarkers to detect health issues before they escalate

---

## 🎯 Implemented Mechanics

### 1. **Grid-Based World** ✅
- **50×50 cell grid** at 1.0m unit spacing (world: -25 to +25 on X/Z axes)
- **Three terrain types**:
  - 🟢 **Endothelium** (Green): Buildable terrain, normal tissue
  - 🔴 **Calcified** (Red): Blocked terrain, impassable bone
  - 🟡 **Capillary** (Yellow): Resource zones, extraction points
- **Procedural generation**: 70% buildable, 15% resources, 15% blocked
- **Optimized rendering**: Single merged 50×50 geometry (2,500+ cells = 1 draw call)

**Files**: `src/world/Grid.js`

---

### 2. **Resource System** ✅
Five biological resources players manage:

| Resource | Icon | Source | Use |
|----------|------|--------|-----|
| **Glucose** | ⬜ | Capillary zones | Mitochondria/Cytosol input |
| **Oxygen** | ○ | Capillary zones | ATP production prerequisite |
| **ATP (Energy)** | ⚡ | Mitochondria output | Powers operations |
| **Lipid** | ◆ | Processing | Membrane repair component |
| **Lactate** | ☒ | Cytosol (anaerobic) | Waste byproduct |

**Status**: Resources display in Inventory panel; no actual collection yet (framework ready)

**Files**: `src/ui/Inventory.js`, `src/world/ResourceManager.js`

---

### 3. **Building System** ✅
Six building types available (with hotkeys 1-6):

#### **1 - Extractor (⬜)**
- Category: Extraction
- Cost: 10 Glucose
- Build time: 5s
- Extracts resources from Capillary terrain
- *Status*: Placed on grid, not yet functional

#### **2 - Vessel/Pipe (━)**
- Category: Logistics
- Cost: 5 Glucose
- Build time: 2s
- Transports resources between buildings
- *Status*: Can be placed; auto-connection code written (not fully tested)

#### **3 - Mitochondria (◆)**
- Category: Processing
- Cost: 20 Glucose
- Build time: 10s
- Converts Glucose + O₂ → ATP (aerobic respiration)
- *Status*: Structurally ready; conversion logic not yet connected

#### **4 - Cytosol Vat (⊞)**
- Category: Processing
- Cost: 15 Glucose
- Build time: 8s
- Converts Glucose → Lactate (anaerobic pathway)
- *Status*: Structurally ready; conversion logic not yet connected

#### **5 - Storage (█)**
- Category: Extraction
- Cost: 25 Glucose
- Build time: 12s
- Stores resources safely; acts as depot
- *Status*: Framework created

#### **6 - Immune Cell (◇)**
- Category: Defense
- Cost: 30 Glucose
- Build time: 15s
- Attacks pathogens; deployable defensive unit
- *Status*: Framework only; AI not implemented

**Files**: `src/ui/Inventory.js`, `src/ui/Hotbar.js`, `src/entities/BaseBuilding.js`

---

### 4. **Building Placement & Input** ✅
- **Drag-to-place UI**: Mouse drag from hotbar → cell → preview with hologram
- **Two-click confirmation**: Drag preview → left-click to confirm
- **Resource affordability**: Buildings flash red if unaffordable
- **Grid cursor**: Cyan circle shows current mouse position on grid
- **Terrain inspection**: Hover text shows terrain type and coordinates

**Status**: Input system fully coded; visual feedback ready (hologram preview structure created)

**Files**: 
- `src/core/InputManagerV2.js` - Drag-to-place logic & raycasting
- `src/entities/VesselSystemV2.js` - Building placement handler
- `src/ui/Hotbar.js` - Hotkey bindings (1-6)

---

### 5. **User Interface (HUD)** ✅

#### **Medical Glass Theme**
- Cyan border accents (#00ffff)
- Dark medical blue background (#001a2e)
- Red alert highlights (#ff3333)
- 5px backdrop blur for glass effect
- Monospace fonts (Courier New) for authenticity

#### **Top Status Bar**
- Diagnostics button (not yet functional)
- Global alerts (red marquee text at top) - WARNING box now static

#### **Bottom-Right: Inventory Panel**
- **Resources tab**: Current glucose, oxygen, ATP, lipid, lactate amounts
- **Buildings tab**: Available structures with hotkeys, costs, descriptions
- Color-coded by category (Extraction, Processing, Defense, Logistics)

#### **Bottom-Left: Hotbar**
- 6 quick-access building buttons (left column)
- Hotkeys labeled: 1, 2, 3, 4, 5, 6
- Visual feedback when selected (cyan glow)
- Displays affordability (flashes red if too expensive)

#### **Right-Side: Vitals Monitor**
- Real-time health metric displays
- Four biomarkers with sparkline graphs

**Files**: `src/ui/HUD.js`, `src/ui/Hotbar.js`, `src/ui/Inventory.js`, `src/ui/BiomarkerMonitor.js`

---

### 6. **Biomarker Monitoring System** ✅
Real-time health tracking with visual graphs and thresholds:

| Biomarker | Normal | Warning | Critical |
|-----------|--------|---------|----------|
| **WBC** (White Blood Cells) | 7.5 K/μL | 9 K/μL | 12 K/μL |
| **pH** (Blood Acidity) | 7.4 | 7.2 | 6.8–7.8 |
| **Glucose** | 100 mg/dL | 140 mg/dL | 200 mg/dL |
| **O₂ Saturation** | 98% | 92% | 85% |

#### **Features**
- ✅ Real-time sparkline graphs (canvas-based) using sine-wave oscillations
- ✅ Color-coded health status (green/yellow/red indicators)
- ✅ Global alert system (marquee text at top shows critical warnings)
- ✅ **Stability**: Game starts with all vitals at **normal** (no fluctuation)
- ✅ **Disease system ready**: When `hasDisease = true`, vitals fluctuate based on disease severity

**Status**: Visualization complete; disease triggers not yet connected

**Files**: `src/ui/BiomarkerMonitor.js`

---

### 7. **Camera & Control System** ✅

#### **RTS-Style Camera**
- **Fixed isometric angle**: 45° tilt for tactical overview
- **Pan**: Right-click drag to move camera across grid
- **Zoom**: Mouse wheel to zoom in/out (10-60 unit range)
- **Smooth interpolation**: Damped transitions (0.15–0.2 damping)
- **Grid boundary clamping**: Camera restricted to -25 to +25 world coordinates

#### **Keyboard & Mouse Input**
- **1-6 keys**: Building selection (hardwired to hotbar)
- **Left-click**: Building placement confirmation
- **Right-click**: Camera pan
- **Mouse wheel**: Zoom

**Files**: `src/core/Engine.js` (RTSCamera class), `src/core/InputManagerV2.js`

---

### 8. **Visual Effects & Atmosphere** ✅

#### **Lighting**
- **Ambient light**: Bright (1.0 intensity) for overall visibility
- **Directional light**: Cyan-tinted (1.2 intensity) from 45° angle for shadow depth
- **Point light**: Magenta pulsing light at cell center (atmospheric)
- **Shadows**: PCF soft shadows with optimized 512×512 resolution

#### **Scene Elements**
- Central organic sphere (pulsing with subtle scale animation)
- Procedurally distributed particle system (100 particles, updated every 3 frames)
- Cyan grid lines overlaid on terrain tiles
- Subtle terrain coloring (emissive 0.08 intensity for subtlety)

#### **Performance Optimizations**
- Single merged BufferGeometry for 2,500 grid tiles (1 draw call vs. 2,500)
- Per-vertex coloring for terrain variety
- Reduced geometry detail (sphere: 16 segments, grid cursor: 16 segments)
- Particle count reduced 50% (100 vs. 200) with frame skipping (3x slowdown)
- Medium precision rendering + disabled object sorting

**Files**: `src/core/Engine.js`, `src/world/Grid.js`

---

### 9. **Disease/Damage System** (Framework Only)
- **Status**: `hasDisease` flag created in BiomarkerMonitor
- **Concept**: Diseases trigger biomarker fluctuation when active
- **Not yet implemented**: 
  - Pathogen entities
  - Disease progression
  - Immune response triggers

**Future**: Diseases will:
1. Appear randomly or via infection events
2. Damage specific biomarkers (e.g., infection → ↑ WBC)
3. Force player to deploy immune cells or process antibiotics

**Files**: `src/ui/BiomarkerMonitor.js` (foundational code)

---

### 10. **Asset System** ✅ (Framework)
Hot-swappable asset management for:
- Building geometry (3D models or procedural)
- Particle textures
- UI icons
- Sound effects (future)

**Status**: Framework created; not actively used (procedural fallbacks functional)

**Files**: `src/core/AssetManager.js`

---

## 📁 Directory Structure

```
Bio-Factory/
├── public/
│   ├── index.html          # Main HTML file
│   └── style.css           # Complete Medical Glass theme CSS
│
├── src/
│   ├── main.js             # Entry point; initializes Engine, Grid, systems
│   │
│   ├── core/               # Engine & infrastructure systems
│   │   ├── Engine.js       # Main game loop, scene setup, lighting, RTSCamera
│   │   ├── InputManagerV2.js # Mouse/keyboard input, drag-to-place, raycasting
│   │   ├── AssetManager.js # Hot-swappable asset loading (framework)
│   │   ├── Lighting.js     # Legacy lighting controller (now in Engine)
│   │   └── InputManager.js # Old input system (deprecated)
│   │
│   ├── world/              # Game world & terrain systems
│   │   ├── Grid.js         # 50×50 terrain grid with 3 terrain types
│   │   └── ResourceManager.js # Resource tracking & distribution (framework)
│   │
│   ├── ui/                 # User interface systems
│   │   ├── HUD.js          # Main HUD controller; integrates all UI panels
│   │   ├── Hotbar.js       # Building quick-select (hotkeys 1-6)
│   │   ├── Inventory.js    # Resources & building catalog display
│   │   ├── BiomarkerMonitor.js # Real-time health graphs & alerts
│   │   └── UIManager.js    # Building detail panels (framework)
│   │
│   ├── entities/           # Game entities & objects
│   │   ├── VesselSystemV2.js # Vessel placement & auto-tiling (in progress)
│   │   ├── BaseBuilding.js # Base class for all buildings
│   │   ├── PlacementManager.js # Building placement validation (framework)
│   │   ├── TransportSystem.js # Resource flow between buildings (framework)
│   │   └── VesselSystem.js # Old vessel system (deprecated)
│   │
│   └── shaders/            # GLSL shaders
│       └── BioShader.js    # Custom shader for biological effects (framework)
│
├── vite.config.js          # Vite dev server configuration
├── package.json            # Project dependencies (Three.js, Vite)
├── index.html              # Per-project HTML wrapper
└── README.md               # This file
```

---

## 🔧 Core File Breakdown

### **src/main.js**
- Initializes Three.js Engine
- Creates Grid world (50×50)
- Sets up Lighting
- Wires Engine ↔ Grid ↔ HUD systems
- Starts animation loop

### **src/core/Engine.js**
**The main game loop. Contains:**
- `setupScene()` - Creates lights, fog, background
- `setupCamera()` - Positions isometric view
- `setupRenderer()` - Initializes WebGL renderer with optimizations
- `initializeGridAndCamera()` - Wires all game systems together
- `RTSCamera` class - Implements pan/zoom camera controls
- `animate()` - Runs 60 FPS loop, updates particles, biomarkers, render

### **src/world/Grid.js**
**Terrain and spatial management:**
- `generateTerrainMap()` - Procedural 50×50 terrain (70% buildable, 15% resource, 15% blocked)
- `createSimpleTerrainTiles()` - Merged BufferGeometry with per-vertex colors
- `createGridLines()` - Cyan wireframe overlay
- `isBuildable(x, z)` - Check if cell can have buildings
- `getCellType(x, z)` - Get terrain type name
- `getWorldPosition(gridX, gridZ)` - Convert grid to world coordinates

### **src/ui/HUD.js**
**Central UI controller:**
- Creates Hotbar, Inventory, BiomarkerMonitor
- Manages cursor position display
- Integrates all three panels into `#biomarker-monitor` div

### **src/ui/Hotbar.js**
**Quick building access:**
- Creates 6 buttons (1-6 hotkeys)
- Listens for keypress (1-6)
- Highlights selected building
- Shows affordability (flashes red if expensive)
- Calls `InputManager.selectBuildingType(buildingType)`

### **src/ui/Inventory.js**
**Resource & building display:**
- Tracks 5 resources with current amounts
- Shows 6 building types with costs, hotkeys, descriptions
- `canAfford(buildingType)` - Checks if player has enough resources
- `deductCost(buildingType)` - Removes cost from inventory

### **src/ui/BiomarkerMonitor.js**
**Health monitoring:**
- `simulateBiomarkers()` - Updates values (stable when `hasDisease = false`)
- `updateBiomarker(key, value)` - Sets value & adds to history
- `drawAllGraphs()` - Renders sparkline canvas graphs
- `updateBiomarkerDisplay(key)` - Updates UI with colors
- Disease system ready: Set `hasDisease = true` to enable fluctuations

### **src/core/InputManagerV2.js**
**Player input and interaction:**
- `onMouseMove()` - Tracks mouse, updates grid cursor position
- `onMouseDown()` - Starts building drag
- `onMouseUp()` - Ends drag, validates placement
- `raycaster` - Casts rays to grid for intersection testing
- Grid position calculation via math: `gridX = floor(rayX / cellSize + width/2)`
- Hologram preview (skeleton code ready)
- Emits events: `buildingSelected`, `buildingPlaced`, `vesselPlaced`

### **src/entities/VesselSystemV2.js**
**Vessel placement and management:**
- `startDraggingVessel()` - Begin placement
- `createVesselMesh()` - Generate pipe geometry
- `autoConnectNeighbors()` - Connect to adjacent vessels
- `rotateToDirection()` - Orient based on neighbors
- *Status*: Structure ready, connection logic not fully tested

### **src/entities/PlacementManager.js** (Framework)
**Building validation:**
- `canPlaceBuilding(x, z, buildingType)` - Check terrain & resources
- `placeBuilding()` - Execute placement
- *Status*: Skeleton ready

### **src/world/ResourceManager.js** (Framework)
**Resource flow:**
- `extractResource(buildingX, buildingZ)` - Get resources from terrain
- `distributeResources()` - Send resources through vessels
- *Status*: Framework only

---

## 🎮 Current Gameplay Status

### ✅ Fully Implemented
1. **Grid rendering** - 50×50 terrain with 3 types, optimized to 1 draw call
2. **RTS camera** - Pan (right-click drag) + zoom (scroll wheel)
3. **Hotbar** - 1-6 hotkeys for building selection
4. **Inventory** - Resource and building display
5. **Biomarker system** - Real-time health monitoring with graphs
6. **Lighting & atmosphere** - Cyan + magenta aesthetic with shadows
7. **Building catalog** - 6 building types with costs and descriptions
8. **Input system** - Mouse raycasting, grid coordinate calculation
9. **UI theme** - Medical glass design with animations

### ⚠️ Partially Implemented
1. **Building placement** - UI ready, validation framework created (placement not executing)
2. **Vessel auto-connection** - Logic written (not tested/debugged)
3. **Disease system** - Disease flag created (triggers not connected)

### ❌ Not Yet Implemented
1. **Resource extraction** - Extractors don't pull from Capillary zones
2. **Energy production** - Mitochondria/Cytosol don't convert resources
3. **Resource transport** - Vessels don't move resources between buildings
4. **Storage system** - No inventory cap or storage mechanics
5. **Pathogen system** - No disease entities or infection
6. **Immune response** - Immune cells don't attack pathogens
7. **Audio** - No sound effects or music
8. **Animations** - No building construction animations (just instant)
9. **Save/Load** - No game state persistence
10. **Difficulty modes** - No scaling or difficulty settings

---

## 🚀 How to Run

### Development
```bash
cd Bio-Factory
npm install
npm run dev
```
Opens game at `http://localhost:5173` with hot reload

### Production Build
```bash
npm run build
```
Outputs optimized bundle to `dist/`

---

## 🎨 Medical Glass Theme

**Color Palette:**
- Primary Accent: `#00ffff` (Cyan) - Building previews, grid lines, selection
- Alert: `#ff3333` (Red) - Warnings, danger, critical biomarkers
- Success: `#00ff00` (Green) - Healthy status
- Warning: `#ffff00` (Yellow) - Caution, resource low
- Background: `#001a2e` (Dark blue) - Professional medical aesthetic
- Glass: `backdrop-filter: blur(5px)` - Frosted glass effect on panels

---

## 🔬 Technical Stack

- **Engine**: Three.js r170+ (3D graphics)
- **Build**: Vite (dev server + hot reload)
- **Language**: Vanilla JavaScript (no frameworks)
- **Rendering**: WebGL with PCF soft shadows
- **UI**: HTML5 Canvas (biomarker graphs) + CSS Grid/Flexbox
- **Physics**: None (grid-based, no simulation)

---

## 📊 Performance

**Optimization Overview:**
- **Grid**: Single merged BufferGeometry (2,500 cells → 1 draw call)
- **Shadows**: 512×512 resolution (reduced from 2048×2048)
- **Particles**: 100 count, updated every 3rd frame
- **Geometry**: Reduced segment counts (sphere 16, circle 16)
- **Rendering**: Medium precision, object sorting disabled

**Target**: 60+ FPS on moderate hardware

---

## 🛠️ Development Workflow

### Adding a New Building Type
1. Add to `Inventory.js` buildings catalog
2. Create building class extending `BaseBuilding.js`
3. Add hotkey check in `Hotbar.js`
4. Create placement logic in `PlacementManager.js`

### Adding a New Resource
1. Add to `Inventory.js` resources object
2. Create icon in `BiomarkerMonitor.js` (if health-related)
3. Update cost calculations in `Inventory.canAfford()`

### Implementing Disease Triggering
1. Create disease entity class
2. Set `this.hud.biomarkerMonitor.hasDisease = true`
3. Set `diseaseIntensity` (0-1 scale)
4. Biomarkers will auto-fluctuate based on severity

---

## 📝 Notes for Developers

### Code Style
- CamelCase for functions/variables
- PascalCase for classes
- SCREAMING_SNAKE_CASE for constants
- Extensive console logging with `[Module]` prefix

### Debugging
- Browser DevTools (F12) shows all console logs
- Scene structure logged at startup
- Frame diagnostics available in `Engine.animate()`

### Physics Assumptions
- All buildings occupy 1 cell
- No vertical structure (2D grid, visual 3D)
- Resources move instantaneously through vessels (no travel time)
- No pathfinding; vessels connect via adjacency

---

## 🐛 Known Issues

1. VesselSystemV2 auto-connection untested - may not rotate/connect correctly
2. Building placement validation exists but not fully integrated
3. No visual feedback when placing buildings (hologram code ready, not wired)
4. Biomarkers don't actually affect gameplay (yet)
5. No game-over or win condition

---

## 🎓 Learning Resources

- **Three.js Docs**: https://threejs.org/docs/
- **Vite Docs**: https://vitejs.dev/
- **RTS Game Design**: Similar mechanics to StarCraft, Warcraft III simplified to grid

---

## 📜 License

Open source - educational project for learning game development, biology simulation, and UI/UX design.

---

**Last Updated**: February 8, 2026
**Status**: Alpha (playable core systems, game loops not functional)
