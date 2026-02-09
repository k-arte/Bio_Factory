/**
 * EffectsSystem.js - Manages active effects on terrain/units with spread mechanics
 * 
 * Effects are status conditions that modify biomarkers and behavior:
 * - EFFECT_INFLAMMATION: Increases WBC, spreads to neighbors (speed: 0.5)
 * - EFFECT_ATHEROMA_INFECTION: Lipid accumulation
 * - EFFECT_AUTOIMMUNE_CONFUSION: Affects units negatively
 * 
 * MECHANICS:
 * - Effects can be placed on terrain cells or units
 * - Each effect has spread speed and radius
 * - Spread happens passively each tick (speed determines % spread per tick)
 * - Apply biomarker_mods to all affected entities
 * - Events: EFFECT_APPLIED, EFFECT_SPREAD, EFFECT_CLEARED
 */

export class EffectsSystem {
  constructor(eventBus, biomarkerSystem, bioDatabase) {
    this.eventBus = eventBus;
    this.biomarkerSystem = biomarkerSystem;
    this.bioDatabase = bioDatabase;

    // terrainEffects[x][y] = [{ effect_id, intensity, applied_time }, ...]
    this.terrainEffects = new Map();

    // unitEffects[unit_id] = [{ effect_id, intensity, applied_time }, ...]
    this.unitEffects = new Map();

    // effectSpreading[x][y][effect_id] = {
    //   source: { x, y },
    //   intensity: float,
    //   spread_progress: float 0-1,
    //   speed: float from effect definition
    // }
    this.effectSpreading = new Map();

    // Subscribe to events
    this.eventBus.on("DISEASE_VISUAL_EFFECTS", (eventData) => {
      this.handleDiseaseEffects(eventData);
    });

    this.eventBus.on("SIMULATION_TICK", (eventData) => {
      this.handleSpreadTick(eventData);
    });

    this.eventBus.on("EFFECT_APPLY_TERRAIN", (eventData) => {
      this.applyTerrainEffect(
        eventData.x,
        eventData.y,
        eventData.effect_id,
        eventData.intensity
      );
    });
  }

  /**
   * Apply effect to terrain cell
   */
  applyTerrainEffect(x, y, effectId, intensity = 1.0) {
    const cellId = `${x},${y}`;

    if (!this.terrainEffects.has(cellId)) {
      this.terrainEffects.set(cellId, []);
    }

    // Check if effect already exists
    const effects = this.terrainEffects.get(cellId);
    const existingIndex = effects.findIndex((e) => e.effect_id === effectId);

    if (existingIndex >= 0) {
      // Stack: increase intensity
      effects[existingIndex].intensity += intensity;
    } else {
      // New effect
      effects.push({
        effect_id: effectId,
        intensity,
        applied_time: Date.now()
      });
    }

    this.eventBus.emit("EFFECT_APPLIED_TERRAIN", {
      cell_x: x,
      cell_y: y,
      effect_id: effectId,
      intensity,
      total_effects_on_cell: effects.length
    });

    // Start spreading if effect has spread mechanics
    const effectDef = this.bioDatabase.effects.find((e) => e.id === effectId);
    if (effectDef && effectDef.spread) {
      this.initializeSpread(x, y, effectId, effectDef.spread, intensity);
    }

    // Apply biomarker mods immediately
    this.applyEffectBiomarkerMods(effectDef, intensity);
  }

  /**
   * Apply effect to unit
   */
  applyUnitEffect(unitId, effectId, intensity = 1.0) {
    if (!this.unitEffects.has(unitId)) {
      this.unitEffects.set(unitId, []);
    }

    const effects = this.unitEffects.get(unitId);
    const existingIndex = effects.findIndex((e) => e.effect_id === effectId);

    if (existingIndex >= 0) {
      effects[existingIndex].intensity += intensity;
    } else {
      effects.push({
        effect_id: effectId,
        intensity,
        applied_time: Date.now()
      });
    }

    this.eventBus.emit("EFFECT_APPLIED_UNIT", {
      unit_id: unitId,
      effect_id: effectId,
      intensity
    });
  }

  /**
   * Handle disease visual effects by applying associated effects to terrain
   */
  handleDiseaseEffects(eventData) {
    const { disease_id, effect_ids, severity_tier } = eventData;

    // If effect_ids are provided, apply them (future enhancement)
    // For now, just track for UI
  }

  /**
   * Initialize spreading for an effect (called when effect is applied)
   */
  initializeSpread(centerX, centerY, effectId, spreadConfig, intensity) {
    const { speed, radius } = spreadConfig;

    // Queue initial spread neighbors
    const neighbors = this.getNeighborsInRadius(centerX, centerY, radius);

    neighbors.forEach(({ nx, ny }) => {
      const neighborId = `${nx},${ny}`;
      if (!this.effectSpreading.has(neighborId)) {
        this.effectSpreading.set(neighborId, {});
      }

      const spreading = this.effectSpreading.get(neighborId);
      if (!spreading[effectId]) {
        spreading[effectId] = {
          source: { x: centerX, y: centerY },
          intensity: intensity * 0.5, // Attenuate
          spread_progress: 0,
          speed
        };
      }
    });
  }

  /**
   * Spread tick: progress effects spreading
   */
  handleSpreadTick(eventData) {
    const spreadingMap = new Map(this.effectSpreading);

    spreadingMap.forEach((effectsAtCell, cellId) => {
      const [x, y] = cellId.split(",").map(Number);

      Object.entries(effectsAtCell).forEach(([effectId, spreadData]) => {
        const { speed, spread_progress } = spreadData;

        // Increment spread progress by speed (0.5 means 50% chance to spread per tick)
        const newProgress = spread_progress + speed;

        if (newProgress >= 1.0) {
          // Spread to this cell!
          this.applyTerrainEffect(
            x,
            y,
            effectId,
            spreadData.intensity
          );

          // Remove from spreading map
          delete effectsAtCell[effectId];
        } else {
          // Update progress
          spreadData.spread_progress = newProgress;
        }
      });

      // Clean up empty cell entries
      if (Object.keys(effectsAtCell).length === 0) {
        this.effectSpreading.delete(cellId);
      }
    });
  }

  /**
   * Apply biomarker mods from an effect
   */
  applyEffectBiomarkerMods(effect, intensity) {
    if (!effect || !effect.biomarker_mods) {
      return;
    }

    effect.biomarker_mods.forEach((mod) => {
      // Scale modifier by intensity
      const scaledValue = mod.value * intensity;

      this.biomarkerSystem.applyBiomarkerModifier({
        biomarker_id: mod.marker_id,
        mode: mod.mode,
        cascaded_value: scaledValue,
        source: `effect_${effect.id}`
      });
    });
  }

  /**
   * Clear effect from terrain cell
   */
  clearTerrainEffect(x, y, effectId = null) {
    const cellId = `${x},${y}`;
    const effects = this.terrainEffects.get(cellId);

    if (!effects) return 0;

    if (effectId) {
      const index = effects.findIndex((e) => e.effect_id === effectId);
      if (index >= 0) {
        const removed = effects.splice(index, 1);
        this.eventBus.emit("EFFECT_CLEARED", {
          cell_x: x,
          cell_y: y,
          effect_id: effectId
        });
        return 1;
      }
    } else {
      const count = effects.length;
      effects.length = 0;
      this.eventBus.emit("EFFECT_CLEARED", {
        cell_x: x,
        cell_y: y,
        effects_cleared: count
      });
      return count;
    }

    return 0;
  }

  /**
   * Get neighbors within radius (spiral expansion)
   */
  getNeighborsInRadius(x, y, radius) {
    const neighbors = [];

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (dx === 0 && dy === 0) continue;
        neighbors.push({ nx: x + dx, ny: y + dy });
      }
    }

    return neighbors;
  }

  /**
   * Get all effects on a terrain cell
   */
  getTerrainEffects(x, y) {
    const cellId = `${x},${y}`;
    return this.terrainEffects.get(cellId) || [];
  }

  /**
   * Get all effects on a unit
   */
  getUnitEffects(unitId) {
    return this.unitEffects.get(unitId) || [];
  }

  /**
   * Check if cell has a specific effect
   */
  hasTerrainEffect(x, y, effectId) {
    return this.getTerrainEffects(x, y).some((e) => e.effect_id === effectId);
  }

  /**
   * Get total intensity of an effect type on terrain
   */
  getTerrainEffectIntensity(x, y, effectId) {
    return (
      this.getTerrainEffects(x, y)
        .filter((e) => e.effect_id === effectId)
        .reduce((sum, e) => sum + e.intensity, 0) || 0
    );
  }

  /**
   * Get visual filter for a terrain cell (for rendering)
   */
  getTerrainVisualFilter(x, y) {
    const effects = this.getTerrainEffects(x, y);
    if (effects.length === 0) return null;

    // Return first effect's visual filter (could blend multiple)
    const effect = this.bioDatabase.effects.find(
      (e) => e.id === effects[0].effect_id
    );
    return effect ? effect.visual_filter : null;
  }

  /**
   * Debug: Dump effects state
   */
  dump() {
    const terrain = {};
    this.terrainEffects.forEach((effects, cellId) => {
      terrain[cellId] = effects.map((e) => ({
        effect_id: e.effect_id,
        intensity: e.intensity
      }));
    });

    const units = {};
    this.unitEffects.forEach((effects, unitId) => {
      units[unitId] = effects.map((e) => ({
        effect_id: e.effect_id,
        intensity: e.intensity
      }));
    });

    return { terrain, units, spreading: this.effectSpreading.size };
  }
}
