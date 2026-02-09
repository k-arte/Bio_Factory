# Bio-Factory Context Reference

## System Architecture

### Event-Driven Progression (Zero-Lag)
**Problem**: Frame-by-frame checking 100+ unlock conditions = 6000 ops/sec lag
**Solution**: Event-driven with listener maps = 10-50 ops/event

```
Game Event → ProgressionManager → Listener Lookup (O(1)) → Unlock Check (1-3 entries) → Save + UI
```

**Listener Maps** (indexed by condition type):
- `listeners_on_stat['total_energy_produced']`
- `listeners_on_kill['UNIT_BACTERIA']`
- `listeners_on_item['RES_ATP']`
- `listeners_on_research['TECH_VASODILATION']`

### Core Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `src/data/BioDatabase.js` | 385 | Master game content database (resources, buildings, units, terrain, technologies) |
| `src/systems/ProgressionManager.js` | 430 | Event-driven unlock logic + statistics tracking |
| `src/systems/SaveManager.js` | 215 | LocalStorage persistence (auto-save every 30s) |
| `src/ui/GuideUI.js` | 280 | Encyclopedia panel with locked/unlocked entries |
| `src/ui/HUD_NEW.css` | +200 | Guide entry styling + unlock notifications |

---

## ProgressionManager API

```javascript
// Initialize
const pm = new ProgressionManager();
await pm.initialize(saveManager);

// Fire events
pm.onResourceProduced('RES_ENERGY', 100);
pm.onEnemyKilled('UNIT_BACTERIA');
pm.onBuildingBuilt('BUILDING_NUCLEUS');
pm.onResearchComplete('TECH_MITOSIS');

// Query
pm.isUnlocked('BUILDING_MITOCHONDRIA');          // → boolean
pm.getUnlockedEntriesByType('buildings');         // → [...]
pm.getUnlockHint('BUILDING_NUCLEUS');             // → "Produce 500 ATP"
```

---

## SaveManager API

```javascript
const save = new SaveManager();

// Auto-save with interval
await save.startAutoSave(30000); // 30s interval

// Manual save/load
await save.saveGameState(unlockedIds, trackedStats);
const state = await save.loadGameState();

// Export/Import
await save.exportSave();
await save.importSave(file);
```

---

## GuideUI API

```javascript
const guide = new GuideUI(hudElement, progressionManager);
await guide.initialize(guidePanel);

// Callbacks fired automatically on unlock
guide.onEntryUnlocked(entryId);
guide.showUnlockNotification(entryId, "Unlock tip");
```

---

## Design System (CSS Variables)

### Colors
```css
--color-primary: #00d4ff;      /* Main cyan */
--color-success: #00e676;      /* Green */
--color-warning: #ff1744;      /* Red */
--text-primary: #e0e0e0;       /* Main text */
--text-secondary: #a0a0a0;     /* Secondary */
```

### Backgrounds (depth system)
```css
--bg-primary: rgba(10, 14, 39, 0.95);     /* Darkest */
--bg-secondary: rgba(20, 30, 60, 0.9);
--bg-tertiary: rgba(0, 50, 100, 0.5);
--bg-light: rgba(0, 30, 60, 0.9);
--bg-hover: rgba(0, 100, 150, 0.7);
--bg-active: rgba(0, 212, 255, 0.3);      /* Most transparent */
```

### Borders
```css
--border-primary: #00d4ff;
--border-light: rgba(0, 212, 255, 0.3);
--border-bright: rgba(0, 212, 255, 0.6);
```

### Shadows & Glows
```css
--shadow-glow: 0 0 15px rgba(0, 212, 255, 0.5);
--shadow-glow-bright: 0 0 20px rgba(0, 212, 255, 0.8);
--shadow-inner: inset 0 0 10px rgba(0, 212, 255, 0.1);
```

### Spacing Scale
```css
--spacing-xs: 4px;    --spacing-sm: 8px;    --spacing-md: 12px;
--spacing-lg: 15px;   --spacing-xl: 20px;
```

### Typography
```css
--font-size-xs: 9px;      /* Keys/tiny labels */
--font-size-sm: 10px;     /* Secondary text */
--font-size-base: 11px;   /* Standard text */
--font-size-lg: 12px;     /* Titles */
--font-weight-normal: 400;
--font-weight-bold: 700;
```

### Z-Index Layers
```css
--z-canvas: 1;           /* 3D rendering */
--z-hotbar: 12;          /* Hotbar */
--z-fixed-buttons: 13;   /* Fixed buttons */
--z-panels: 20-30;       /* Draggable panels */
--z-tooltips: 100;       /* Top layer */
```

### Transitions
```css
--transition-fast: 0.2s ease-in-out;
--transition-normal: 0.3s ease-in-out;
```

---

## Integration Checklist

- [ ] Import 4 system files in GameManager
- [ ] Create SaveManager instance
- [ ] Initialize ProgressionManager with SaveManager
- [ ] Wire GuideUI to show encyclopedia panel
- [ ] Add event triggers in game systems:
  - ResourceManager: `onResourceProduced(id, amount)`
  - CombatSystem: `onEnemyKilled(unitId)`
  - BuildingManager: `onBuildingBuilt(buildingId)`
  - ResearchSystem: `onResearchComplete(techId)`

---

## Unlock Condition Types

**STAT_THRESHOLD**: `{ type: 'STAT_THRESHOLD', stat: 'total_energy_produced', threshold: 500 }`
**KILL_COUNT**: `{ type: 'KILL_COUNT', target_unit: 'UNIT_BACTERIA', count: 10 }`
**ITEM_COLLECTED**: `{ type: 'ITEM_COLLECTED', item: 'RES_ATP', amount: 100 }`
**RESEARCH_COMPLETE**: `{ type: 'RESEARCH_COMPLETE', tech: 'TECH_MITOSIS' }`

---

## Project Structure

```
src/
├── data/
│   └── BioDatabase.js           ← Master database
├── systems/
│   ├── ProgressionManager.js    ← Event logic
│   └── SaveManager.js           ← Persistence
├── ui/
│   ├── GuideUI.js               ← Encyclopedia
│   └── HUD_NEW.css              ← + guide styles
└── ...existing files
```

---

## Status

✅ All 4 core systems complete  
✅ CSS variables unified (63 tokens)  
✅ No syntax errors  
✅ **Waiting for: Event trigger integration in game systems**

**Last Updated**: Feb 8, 2026
