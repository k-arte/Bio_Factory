/**
 * SimulationInitializer.js - Initializes and wires all v5.1.0 systems
 * 
 * Core startup sequence:
 * 1. Initialize EventBus
 * 2. Load BioDatabase
 * 3. Create core systems (Biomarker, Disease, Recipe, Building, etc)
 * 4. Wire systems together via events
 * 5. Start simulation loop
 * 6. Wire UI bridge
 * 7. Initialize save manager
 * 
 * Single entry point for complete system initialization.
 */

import BioDatabase from "../data/BioDatabase.js";
import { EventBus } from "../core/EventBus.js";
import { BiomarkerSystem } from "../simulation/BiomarkerSystem.js";
import { DiseaseSystem } from "../simulation/DiseaseSystem.js";
import { RecipeUnlockSystem } from "../simulation/RecipeUnlockSystem.js";
import { BuildingBehaviorSystem } from "../simulation/BuildingBehaviorSystem.js";
import { WasteInventorySystem } from "../simulation/WasteInventorySystem.js";
import { DiffusionCascadeSystem } from "../simulation/DiffusionCascadeSystem.js";
import { EffectsSystem } from "../simulation/EffectsSystem.js";
import { PressureSystem } from "../simulation/PressureSystem.js";
import { DrugProfileSystem } from "../simulation/DrugProfileSystem.js";
import { ModifierSystem } from "../simulation/ModifierSystem.js";
import { SaveManagerExtension } from "../systems/SaveManagerExtension.js";
import { UIUpdateBridge } from "../ui/UIUpdateBridge.js";

export class SimulationInitializer {
  constructor() {
    this.eventBus = null;
    this.systems = {};
    this.initialized = false;
  }

  /**
   * Initialize all systems
   */
  async initialize(options = {}) {
    console.log("[SimulationInitializer] Starting initialization...");

    try {
      // Step 1: Initialize EventBus
      this.eventBus = new EventBus();
      console.log("[SimulationInitializer] ✓ EventBus created");

      // Step 2: Load BioDatabase (already loaded at module level)
      const db = BioDatabase;
      if (!db || db.version !== "5.1.0") {
        console.warn("[SimulationInitializer] BioDatabase version mismatch");
      }
      console.log(
        `[SimulationInitializer] ✓ BioDatabase loaded v${db.version}`
      );

      // Step 3: Create core systems (ORDER MATTERS - dependencies)
      console.log("[SimulationInitializer] Initializing core systems...");

      // Biomarkers first (other systems depend on it)
      this.systems.biomarkers = new BiomarkerSystem(this.eventBus, db);
      console.log("[SimulationInitializer] ✓ BiomarkerSystem");

      // Diseases depend on biomarkers
      this.systems.diseases = new DiseaseSystem(
        this.eventBus,
        this.systems.biomarkers,
        db
      );
      console.log("[SimulationInitializer] ✓ DiseaseSystem");

      // Effects depend on biomarkers
      this.systems.effects = new EffectsSystem(
        this.eventBus,
        this.systems.biomarkers,
        db
      );
      console.log("[SimulationInitializer] ✓ EffectsSystem");

      // Waste system (independent)
      this.systems.waste = new WasteInventorySystem(this.eventBus);
      console.log("[SimulationInitializer] ✓ WasteInventorySystem");

      // Diffusion cascade (depends on waste, biomarkers)
      this.systems.diffusion = new DiffusionCascadeSystem(
        this.eventBus,
        db
      );
      console.log("[SimulationInitializer] ✓ DiffusionCascadeSystem");

      // Recipes/Research (independent)
      this.systems.recipes = new RecipeUnlockSystem(this.eventBus, db);
      console.log("[SimulationInitializer] ✓ RecipeUnlockSystem");

      // Buildings (depends on recipes)
      this.systems.buildings = new BuildingBehaviorSystem(
        this.eventBus,
        db,
        null // resourceManager can be null initially
      );
      console.log("[SimulationInitializer] ✓ BuildingBehaviorSystem");

      // Logistics (depends on buildings)
      this.systems.pressure = new PressureSystem(this.eventBus, db);
      console.log("[SimulationInitializer] ✓ PressureSystem");

      // Medications (depends on diseases, biomarkers)
      this.systems.drugs = new DrugProfileSystem(
        this.eventBus,
        db,
        this.systems.diseases,
        this.systems.biomarkers
      );
      console.log("[SimulationInitializer] ✓ DrugProfileSystem");

      // Modifiers (applies global effect multipliers)
      this.systems.modifiers = new ModifierSystem(this.eventBus);
      console.log("[SimulationInitializer] ✓ ModifierSystem");

      // Step 4: Verify system wiring
      this.verifyEventWiring();
      console.log("[SimulationInitializer] ✓ Event wiring verified");

      // Step 5: Initialize save manager
      this.saveManager = new SaveManagerExtension(null);
      console.log("[SimulationInitializer] ✓ SaveManager initialized");

      this.initialized = true;
      console.log("[SimulationInitializer] ✓ All systems initialized successfully");

      return true;
    } catch (error) {
      console.error("[SimulationInitializer] Initialization FAILED:", error);
      return false;
    }
  }

  /**
   * Wire UI to systems (called after UI is ready)
   */
  wireUI(uiManager, biomarkerMonitor, hudManager) {
    if (!this.initialized) {
      console.warn("[SimulationInitializer] Systems not initialized yet");
      return;
    }

    this.systems.uiBridge = new UIUpdateBridge(
      this.eventBus,
      uiManager,
      biomarkerMonitor,
      hudManager
    );

    console.log("[SimulationInitializer] ✓ UI bridge wired");
  }

  /**
   * Start simulation loop (should be called from Engine or main game loop)
   */
  startSimulationLoop(tickDurationMs = 1000) {
    if (!this.initialized) {
      console.error("[SimulationInitializer] Cannot start: systems not initialized");
      return null;
    }

    let tickNumber = 0;
    const intervalId = setInterval(() => {
      tickNumber++;

      // Emit SIMULATION_TICK event
      this.eventBus.emit("SIMULATION_TICK", {
        tick_number: tickNumber,
        timestamp: Date.now(),
        delta_time_ms: tickDurationMs
      });

      // Emit DIFFUSION_TICK (waste diffusion)
      this.eventBus.emit("DIFFUSION_TICK", {
        dbResources: BioDatabase.resources
      });
    }, tickDurationMs);

    console.log(`[SimulationInitializer] Simulation loop started (${tickDurationMs}ms ticks)`);

    return intervalId;
  }

  /**
   * Stop simulation loop
   */
  stopSimulationLoop(intervalId) {
    if (intervalId) {
      clearInterval(intervalId);
      console.log("[SimulationInitializer] Simulation loop stopped");
    }
  }

  /**
   * Verify event listeners are properly wired
   */
  verifyEventWiring() {
    const stats = this.eventBus.getStats?.();

    if (!stats || stats.listeners === 0) {
      console.warn(
        "[SimulationInitializer] Warning: No event listeners registered"
      );
    } else {
      console.log(
        `[SimulationInitializer] Verified: ${stats.listeners} event listeners`
      );
    }
  }

  /**
   * Load saved game state
   */
  async loadSave(file) {
    const state = await this.saveManager.loadGameState();

    if (!state) {
      console.log("[SimulationInitializer] No save file found");
      return null;
    }

    // Restore systems
    if (state.biomarkers) {
      this.saveManager.restoreBiomarkers(this.systems.biomarkers, state);
    }

    if (state.research) {
      this.saveManager.restoreResearch(this.systems.recipes, state);
    }

    console.log("[SimulationInitializer] Save loaded and systems restored");
    return state;
  }

  /**
   * Save game state
   */
  async save() {
    return this.saveManager.saveGameState(this.systems);
  }

  /**
   * Export save file
   */
  exportSave(filename) {
    this.saveManager.exportSave(this.systems, filename);
  }

  /**
   * Get system reference
   */
  getSystem(systemName) {
    return this.systems[systemName] || null;
  }

  /**
   * Get all systems
   */
  getSystems() {
    return { ...this.systems };
  }

  /**
   * Get EventBus
   */
  getEventBus() {
    return this.eventBus;
  }

  /**
   * Debug: Dump all system states
   */
  debugDump() {
    const dump = {
      initialized: this.initialized,
      systems: {}
    };

    Object.entries(this.systems).forEach(([name, system]) => {
      if (system && typeof system.dump === "function") {
        dump.systems[name] = system.dump();
      } else {
        dump.systems[name] = "no dump method";
      }
    });

    return dump;
  }

  /**
   * Reset all systems (for new game)
   */
  reset() {
    if (this.initialized) {
      this.eventBus.emit("GAME_RESET", { timestamp: Date.now() });

      // Reset each system
      Object.values(this.systems).forEach((system) => {
        if (typeof system.reset === "function") {
          system.reset();
        }
      });

      console.log("[SimulationInitializer] All systems reset");
    }
  }
}

// Export singleton instance
export const simulationInitializer = new SimulationInitializer();
