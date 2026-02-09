/**
 * SaveManagerExtension.js - Extended save/load for all new v5.1.0 systems
 * 
 * Saves state for:
 * - BiomarkerSystem: Current values + recent history
 * - DiseaseSystem: Active diseases + progression state
 * - RecipeUnlockSystem: Completed research + unlocked recipes
 * - BuildingBehaviorSystem: Building states (storage, recipes)
 * - WasteInventorySystem: Waste accumulation
 * - EffectsSystem: Active terrain/unit effects
 * - DrugProfileSystem: Active medications
 * - PressureSystem: Vessel network + pump state
 * 
 * FORMAT: JSON with version 5.1.0
 */

export class SaveManagerExtension {
  constructor(saveManager) {
    this.saveManager = saveManager;
    this.storageKey = "bio_factory_save_v5_1_0";
  }

  /**
   * Serialize all system states into a save object
   */
  serializeGameState(systems) {
    const {
      biomarkerSystem,
      diseaseSystem,
      recipeUnlockSystem,
      buildingBehaviorSystem,
      wasteInventorySystem,
      effectsSystem,
      drugProfileSystem,
      pressureSystem
    } = systems;

    return {
      meta: {
        save_version: "5.1.0",
        timestamp: Date.now(),
        timezone: new Date().getTimezoneOffset()
      },

      biomarkers: biomarkerSystem ? this.serializeBiomarkers(biomarkerSystem) : {},

      diseases: diseaseSystem ? this.serializeDiseases(diseaseSystem) : {},

      research: recipeUnlockSystem
        ? this.serializeResearch(recipeUnlockSystem)
        : {},

      buildings: buildingBehaviorSystem
        ? this.serializeBuildings(buildingBehaviorSystem)
        : {},

      waste: wasteInventorySystem ? this.serializeWaste(wasteInventorySystem) : {},

      effects: effectsSystem ? this.serializeEffects(effectsSystem) : {},

      medications: drugProfileSystem ? this.serializeMedications(drugProfileSystem) : {},

      pressure: pressureSystem ? this.serializePressure(pressureSystem) : {}
    };
  }

  /**
   * Serialize biomarker state
   */
  serializeBiomarkers(biomarkerSystem) {
    return {
      current_values: biomarkerSystem.getAll(),
      history: Array.from(biomarkerSystem.biomarkerHistory.entries()).map(
        ([id, history]) => ({
          biomarker_id: id,
          history: history.slice(-100) // Last 100 values
        })
      )
    };
  }

  /**
   * Serialize disease state
   */
  serializeDiseases(diseaseSystem) {
    return {
      active_diseases: diseaseSystem.getActiveDiseases(),
      history: Array.from(diseaseSystem.diseaseHistory.entries()).map(
        ([id, events]) => ({
          disease_id: id,
          events: events.slice(-20) // Last 20 events
        })
      )
    };
  }

  /**
   * Serialize research progress
   */
  serializeResearch(recipeUnlockSystem) {
    return {
      completed_research: Array.from(recipeUnlockSystem.completedResearch),
      unlocked_recipes: Array.from(recipeUnlockSystem.unlockedRecipes),
      active_research: recipeUnlockSystem.getActiveResearch()
    };
  }

  /**
   * Serialize building states
   */
  serializeBuildings(buildingBehaviorSystem) {
    const buildings = [];

    buildingBehaviorSystem.buildingState.forEach((state, buildingId) => {
      buildings.push({
        building_id: buildingId,
        type: state.type,
        position: state.position,
        storage: state.storage,
        current_recipe: state.current_recipe,
        recipe_progress: state.recipe_progress
      });
    });

    return { buildings };
  }

  /**
   * Serialize waste inventory
   */
  serializeWaste(wasteInventorySystem) {
    const cells = [];

    wasteInventorySystem.waste.forEach((wasteMap, cellId) => {
      const [x, y] = cellId.split(",").map(Number);
      cells.push({
        cell_x: x,
        cell_y: y,
        waste: wasteMap,
        capacity: wasteInventorySystem.capacities.get(cellId)
      });
    });

    return {
      cells,
      spillage_count: wasteInventorySystem.spillage_history.length
    };
  }

  /**
   * Serialize active effects
   */
  serializeEffects(effectsSystem) {
    const terrainEffects = [];
    effectsSystem.terrainEffects.forEach((effects, cellId) => {
      const [x, y] = cellId.split(",").map(Number);
      terrainEffects.push({
        cell_x: x,
        cell_y: y,
        effects: effects.map((e) => ({
          effect_id: e.effect_id,
          intensity: e.intensity
        }))
      });
    });

    const unitEffects = [];
    effectsSystem.unitEffects.forEach((effects, unitId) => {
      unitEffects.push({
        unit_id: unitId,
        effects: effects.map((e) => ({
          effect_id: e.effect_id,
          intensity: e.intensity
        }))
      });
    });

    return { terrain_effects: terrainEffects, unit_effects: unitEffects };
  }

  /**
   * Serialize active medications
   */
  serializeMedications(drugProfileSystem) {
    const medications = [];

    drugProfileSystem.activeMedications.forEach((meds, locationId) => {
      meds.forEach((med) => {
        medications.push({
          location_id: locationId,
          drug_id: med.drug_id,
          drug_tag: med.drug_tag,
          concentration: med.concentration,
          time_remaining_ms: med.duration_ms - (Date.now() - med.onset_time)
        });
      });
    });

    return { active_medications: medications };
  }

  /**
   * Serialize pressure system state
   */
  serializePressure(pressureSystem) {
    const vessels = [];
    pressureSystem.vesselNetwork.forEach((vessel, vesselId) => {
      vessels.push({
        vessel_id: vesselId,
        position: vessel.position,
        efficiency: vessel.efficiency,
        connections_count: vessel.connections.length,
        pumps_upstream_count: vessel.pumps_upstream.length
      });
    });

    const pumps = [];
    pressureSystem.pumpNetwork.forEach((pump, pumpId) => {
      pumps.push({
        pump_id: pumpId,
        position: pump.position,
        active: pump.active,
        supported_vessels_count: pump.supported_vessels.length
      });
    });

    return {
      vessels,
      pumps,
      network_efficiency: pressureSystem.getNetworkStats().average_efficiency
    };
  }

  /**
   * Save to localStorage
   */
  async saveGameState(systems) {
    const serialized = this.serializeGameState(systems);

    try {
      const json = JSON.stringify(serialized);
      localStorage.setItem(this.storageKey, json);

      console.log(
        `[SaveManager] Saved game state v${serialized.meta.save_version}`
      );
      return true;
    } catch (error) {
      console.error("[SaveManager] Save failed:", error);
      return false;
    }
  }

  /**
   * Load from localStorage
   */
  async loadGameState() {
    try {
      const json = localStorage.getItem(this.storageKey);
      if (!json) {
        console.log("[SaveManager] No save found");
        return null;
      }

      const data = JSON.parse(json);

      // Verify version
      if (data.meta.save_version !== "5.1.0") {
        console.warn(
          `[SaveManager] Save version mismatch: ${data.meta.save_version}`
        );
      }

      console.log(`[SaveManager] Loaded save from ${new Date(data.meta.timestamp)}`);

      return data;
    } catch (error) {
      console.error("[SaveManager] Load failed:", error);
      return null;
    }
  }

  /**
   * Restore biomarker state
   */
  restoreBiomarkers(biomarkerSystem, data) {
    if (!data || !data.biomarkers) return;

    const { current_values, history } = data.biomarkers;

    // Restore current values
    Object.entries(current_values).forEach(([id, value]) => {
      biomarkerSystem.biomarkerState[id] = value;
    });

    // Restore history
    history.forEach(({ biomarker_id, history: hist }) => {
      if (biomarkerSystem.biomarkerHistory.has(biomarker_id)) {
        biomarkerSystem.biomarkerHistory.set(biomarker_id, hist);
      }
    });

    console.log("[SaveManager] Restored biomarker state");
  }

  /**
   * Restore research/recipe state
   */
  restoreResearch(recipeUnlockSystem, data) {
    if (!data || !data.research) return;

    const { completed_research, unlocked_recipes } = data.research;

    // Restore completed research
    completed_research.forEach((techId) => {
      recipeUnlockSystem.completedResearch.add(techId);
    });

    // Restore unlocked recipes
    unlocked_recipes.forEach((recipeId) => {
      recipeUnlockSystem.unlockedRecipes.add(recipeId);
    });

    console.log(
      `[SaveManager] Restored ${completed_research.length} completed research`
    );
  }

  /**
   * Clear save data
   */
  clearSave() {
    localStorage.removeItem(this.storageKey);
    console.log("[SaveManager] Save data cleared");
  }

  /**
   * Export save as JSON file
   */
  exportSave(systems, filename = "biofactory_save.json") {
    const data = this.serializeGameState(systems);
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
    console.log("[SaveManager] Save file exported");
  }

  /**
   * Import save from JSON file
   */
  async importSave(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          localStorage.setItem(this.storageKey, JSON.stringify(data));
          console.log("[SaveManager] Save file imported");
          resolve(data);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }
}
