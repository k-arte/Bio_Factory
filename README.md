# Bio-Factory

A Three.js-based biological factory simulation game with advanced PBR wet flesh rendering and quality-optimized graphics.

## 🎮 Current Status (February 2026)

**Focus**: Advanced visual rendering and environment creation. The game features a procedurally generated wet flesh terrain with realistic material properties and performance-optimized rendering profiles.

---

## 🎨 Visual Features

### Wet Flesh Rendering System ✅
The ground renders as biological wet tissue with multiple visual layers:

- **Base Color**: Blood red (#8a0d0d) 
- **Large Grain Texture**: 32×32 pixel blocks with random variation
- **Directional Cracks**: 15 streak lines creating natural fissures
- **Glossy Wet Spots**: 50 bright spots simulating moisture/shine
- **Normal Maps**: Surface detail for microroughness
- **Emissive Glow**: Internal biological glow (#441111 at variable intensity)

**Implementation**: Procedural canvas-based texture generation in `src/world/Grid.js`

### Quality Profiles ✅
Three rendering tiers for performance optimization:

| Profile | Roughness | Emissive | Best For |
|---------|-----------|----------|----------|
| **HIGH** | 0.35 | 0.3 | Desktop/High-end devices |
| **MEDIUM** | 0.5 | 0.2 | Mobile/Balanced scenes |
| **LOW** | 0.7 | 0.0 | Low-end devices/Large scenes |

All profiles use **MeshStandardMaterial** for reliable rendering across platforms.

**Usage**:
```javascript
shaderProfileManager.setProfile('MEDIUM');
grid.updateGroundMaterial();
```

**Files**: `src/core/ShaderProfileManager.js`

### Lighting System ✅
Optimized three-light setup for biological realism:

- **Ambient Light**: 1.2 intensity (primary illumination)
- **Key Light**: Warm #ffe4cc at 0.8 intensity (form definition)
- **Rim Light**: White at 0.4 intensity (edge separation)

No hard shadows—soft natural lighting emphasizes wet flesh appearance.

**Files**: `src/core/Engine.js` setupScene()

### Grid System ✅
- **Size**: 50×50 cells
- **Cell Size**: 1.0 unit each
- **Merged Geometry**: Single optimized mesh for 2,500 cells
- **Terrain Types**: Endothelium (buildable), Calcified (blocked), Capillary (resource zones)
- **Procedural Generation**: 70% buildable, 15% resources, 15% blocked

**Files**: `src/world/Grid.js`

### RTS Camera ✅
- **Pan**: Middle mouse button drag for intuitive map navigation
- **Zoom**: Mouse wheel for level adjustment
- **View**: Isometric-like perspective optimized for strategy gameplay
- **Smooth Damping**: Camera movements use velocity-based smoothing

**Files**: `src/core/Engine.js` RTSCamera class

---

## 🛠️ Technology Stack

- **Three.js r182**: 3D rendering engine
- **Vite 7.3.1**: Fast build tool and dev server (hot reload)
- **ES6 Modules**: Modern JavaScript architecture
- **Canvas Textures**: Procedural texture generation
- **MeshStandardMaterial**: PBR-compatible rendering

---

## 📁 Project Structure

```
src/
├── core/
│   ├── Engine.js              # Main engine, lighting, camera
│   ├── InputManagerV2.js      # Input handling
│   ├── ShaderProfileManager.js # Quality profile management
│   └── AssetManager.js         # Asset loading
├── world/
│   ├── Grid.js                # Terrain, wet flesh texture generation
│   └── ResourceManager.js      # Resource system
├── entities/
│   ├── BaseBuilding.js         # Building base class (Nucleus)
│   ├── PlacementManager.js     # Building placement system
│   └── VesselSystemV2.js      # Vessel/pipe network
├── ui/
│   ├── HUD_NEW.js            # Main HUD interface
│   ├── Inventory.js          # Resource display
│   └── Hotbar.js             # Quick action bar
├── shaders/
│   └── BioShader.js          # Custom shader materials
├── data/
│   ├── Colors.js             # Centralized color constants
│   └── BioDatabase.js        # Biological data definitions
└── main.js                    # Entry point
```

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Server runs on http://localhost:5173/
```

Hot reload enabled—changes save instantly in browser.

---

## 🎯 Recent Changes (Feb 2026)

### Visual Polish Phase
- ✅ Centralized color management (`src/data/Colors.js`)
- ✅ Rounded corner geometry for nucleus buildings
- ✅ Large grain texture (32×32 blocks) for organic feel
- ✅ Directional crack system (15 streak lines)
- ✅ Wet spot gloss layer (50 bright spots)
- ✅ Normal map generation for surface detail
- ✅ Quality profile system (HIGH/MEDIUM/LOW)
- ✅ Proper lighting (ambient + key + rim)
- ✅ sRGB color space + ACES tone mapping

### Fixes Applied
- Ground visibility (DoubleSide rendering)
- Material complexity reduced to MeshStandardMaterial
- Emissive intensity adjusted for biological glow
- Normal scale optimized (0.4 for subtle detail)
- Light intensity balanced for visibility

---

## 🎮 Current Gameplay State

**Implemented**:
- ✅ 50×50 grid rendering
- ✅ RTS camera with pan/zoom
- ✅ Building placement system
- ✅ Nucleus building with rounded corners
- ✅ Color-coded terrain visualization
- ✅ Resource inventory display

**In Progress**:
- 🔄 Building functionality (extractors, processors)
- 🔄 Resource flow system
- 🔄 Vessel network connectivity
- 🔄 Biomarker monitoring

**Future**:
- 🔲 Pathfinding for resource transport
- 🔲 Disease/immune system simulation
- 🔲 Progressive building unlocks
- 🔲 Save/load system

---

## 📊 Performance

**Target**: 60 FPS on desktop, 30+ FPS on mobile

**Optimizations**:
- Single merged geometry (2,500 tiles = 1 draw call)
- MeshStandardMaterial (standard PBR)
- No real-time shadows on main lights
- Procedural texture generation (no external assets)
- Quality profile switching without reload

**Tested On**:
- Desktop (Chrome, Firefox)
- Mobile (responsive canvas)

---

## 🔧 Color System

All colors centralized in `src/data/Colors.js`:
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

## 🔧 Color System

All colors are centralized in [src/data/Colors.js](src/data/Colors.js):

```javascript
const COLORS = {
  GROUND_PRIMARY: 0xFF6666,      // Blood red flesh
  GROUND_EMIT: 0xFF5555,         // Dark red internal glow
  GRID_LINES: 0x00FFFF,          // Cyan guidelines
  GRID_LINES_ALT: 0x0099FF,      // Secondary grid color
  PLACEMENT_VALID: 0x00FF88,     // Green preview
  PLACEMENT_INVALID: 0xFF6666,   // Red invalid placement
  // ... additional palette colors
};
```

**Used in**: Grid rendering, material creation, UI feedback, visual asset generation.

---

## 📁 Core Project Structure

```
Bio-Factory/
├── public/
│   └── index.html              # Entry HTML
├── src/
│   ├── main.js                 # Entry point (initializes Engine + Grid)
│   ├── data/
│   │   └── Colors.js           # Centralized color constants
│   ├── core/
│   │   ├── Engine.js           # Main loop, scene, camera, 3-light setup
│   │   ├── ShaderProfileManager.js # Quality profiles (HIGH/MEDIUM/LOW)
│   │   └── InputManager.js     # Input handling
│   ├── world/
│   │   ├── Grid.js             # 50×50 terrain, wet flesh texture
│   │   └── ResourceManager.js  # Resource tracking
│   ├── entities/
│   │   ├── BaseBuilding.js
│   │   ├── PlacementManager.js
│   │   └── TransportSystem.js
│   ├── ui/
│   │   └── UIManager.js
│   └── shaders/
│       └── BioShader.js
├── vite.config.js
├── package.json
└── README.md
```

---

## 🔍 Key Implementation Details

### **Wet Flesh Texture Generation** (Grid.js)

The ground texture is procedurally generated in real-time:

1. **Base Color Map**: Canvas 512×512, filled with random grain blocks (32×32 pixels)
2. **Roughness Map**: Darker areas for natural variation
3. **Normal Map**: Derived from color variation, scaled to 0.4 for subtle detail
4. **Crack System**: 15 directional lines creating fissures
5. **Glossy Spots**: 50 bright wet spots for moisture appearance

```javascript
function createFleshTexture(size = 512) {
  // Creates biological wet tissue appearance
  // with procedural grain, cracks, and moisture
}
```

### **Material System** (ShaderProfileManager.js)

All three profiles use **MeshStandardMaterial** for reliable PBR rendering:

```javascript
HIGH: {
  color: COLORS.GROUND_PRIMARY,
  roughness: 0.35,
  metalness: 0.0,
  emissive: COLORS.GROUND_EMIT,
  emissiveIntensity: 0.3
}
// MEDIUM and LOW profiles with increased roughness
```

### **Lighting Setup** (Engine.js)

Three-light system optimized for wet biological appearance:

```javascript
// Ambient: Base illumination (1.2 intensity)
const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);

// Key Light: Warm, directional fill (0.8 intensity, #ffe4cc)
const keyLight = new THREE.DirectionalLight(0xffe4cc, 0.8);

// Rim Light: Edge definition (0.4 intensity, white)
const rimLight = new THREE.DirectionalLight(0xffffff, 0.4);
```

### **Tone Mapping Pipeline**

- **Color Space**: sRGB output
- **Algorithm**: ACESFilmicToneMapping
- **Exposure**: 1.2 (prevents red clipping, stabilizes highlights)

---

## ⚙️ Development

### Running Locally

```bash
npm install
npm run dev
```

Server runs on `http://localhost:5173/` with hot module reload.

### Switching Quality Profiles

```javascript
import { ShaderProfileManager } from './src/core/ShaderProfileManager.js';

shaderProfileManager.setProfile('MEDIUM');
grid.updateGroundMaterial();  // Apply to ground
```

### Building for Production

```bash
npm run build
```

Outputs optimized bundle to `dist/`.

---

## 🎯 Current Development Focus

**Phase**: Advanced visual rendering and material systems

**Completed**:
- ✅ Procedural wet flesh texture generation
- ✅ Quality profile system (HIGH/MEDIUM/LOW)
- ✅ Proper 3-light setup with warm/cool balance
- ✅ sRGB + ACES tone mapping pipeline
- ✅ Normal map integration (0.4 scale)
- ✅ Centralized color management
- ✅ Git repository with public access

**Next Steps**:
- Building placement and interaction systems
- Resource management framework
- Game loop integration
- Additional visual polish (particle effects, animations)

---

## 🔗 Repository

**GitHub**: https://github.com/k-arte/Bio_Factory

**Status**: Public repository with full commit history and development logs.

---

## 📜 License

Open source - educational project for learning game development with Three.js and advanced rendering techniques.

---

**Last Updated**: February 2026  
**Development Status**: Early Alpha - Rendering foundation complete, gameplay systems in progress
