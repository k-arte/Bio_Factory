/**
 * BiomarkerSystem.js - Tracks and updates all biomarkers with cascading effects
 * 
 * Biomarkers are system diagnostics:
 * - BM_PH_BLOOD: Arterial blood pH (affects all metabolic processes)
 * - BM_LACTATE: Serum lactate (indicator of anaerobic metabolism)
 * - BM_OXYGEN_SAT: SpO2 (blood oxygen saturation)
 * - BM_GLUC: Blood glucose (energy availability)
 * - BM_WBC: White blood cell count (immune activation)
 * 
 * MECHANICS:
 * - Subscribe to BIOMARKER_MOD_APPLIED events from DiffusionCascadeSystem
 * - Apply mods (add/sub/mul) to current values
 * - Track deviation from normal_range
 * - Emit BIOMARKER_CHANGED events when values cross thresholds
 * - Used by disease trigger system to detect conditions
 */

export class BiomarkerSystem {
  constructor(eventBus, bioDatabase) {
    this.eventBus = eventBus;
    this.bioDatabase = bioDatabase;

    // biomarkerState[biomarker_id] = current_value
    this.biomarkerState = {};
    this.biomarkerHistory = new Map(); // [biomarker_id] = [value, value, ...]

    // Initialize from bioDatabase
    this.initializeBiomarkers();

    // Subscribe to cascade mods
    this.eventBus.on("BIOMARKER_MOD_APPLIED", (modEvent) => {
      this.applyBiomarkerModifier(modEvent);
    });

    // Subscribe to resource consumption/production to update biomarkers
    this.eventBus.on("RESOURCES_CONSUMED", (eventData) => {
      this.handleResourcesConsumed(eventData);
    });

    this.eventBus.on("RESOURCES_PRODUCED", (eventData) => {
      this.handleResourcesProduced(eventData);
    });

    // Periodic update (e.g., natural decay/recovery)
    this.eventBus.on("SIMULATION_TICK", (eventData) => {
      this.handleSimulationTick(eventData);
    });
  }

  /**
   * Initialize all biomarker states to midpoint of normal range
   */
  initializeBiomarkers() {
    this.bioDatabase.biomarkers.forEach((bm) => {
      if (bm.normal_range && bm.normal_range.length === 2) {
        const [min, max] = bm.normal_range;
        this.biomarkerState[bm.id] = (min + max) / 2;
      } else {
        this.biomarkerState[bm.id] = 0;
      }

      this.biomarkerHistory.set(bm.id, [this.biomarkerState[bm.id]]);
    });
  }

  /**
   * Apply a biomarker modifier (from cascade or direct event)
   */
  applyBiomarkerModifier(modEvent) {
    const {
      biomarker_id,
      mode,
      cascaded_value,
      source_resource,
      source_cell
    } = modEvent;

    if (!this.biomarkerState.hasOwnProperty(biomarker_id)) {
      return; // Biomarker doesn't exist
    }

    const oldValue = this.biomarkerState[biomarker_id];
    let newValue = oldValue;

    switch (mode) {
      case "add":
        newValue = oldValue + cascaded_value;
        break;
      case "sub":
        newValue = oldValue - cascaded_value;
        break;
      case "mul":
        newValue = oldValue * cascaded_value;
        break;
      default:
        break;
    }

    this.biomarkerState[biomarker_id] = newValue;
    this.recordHistory(biomarker_id, newValue);

    // Check if value crossed critical threshold
    const biomarker = this.bioDatabase.biomarkers.find(
      (bm) => bm.id === biomarker_id
    );
    const crossedThreshold = this.checkThresholdCrossing(
      biomarker,
      oldValue,
      newValue
    );

    if (crossedThreshold) {
      this.eventBus.emit("BIOMARKER_THRESHOLD_CROSSED", {
        biomarker_id,
        old_value: oldValue,
        new_value: newValue,
        threshold_type: crossedThreshold,
        source: {
          resource: source_resource,
          cell: source_cell
        }
      });
    }

    // Emit change event always
    this.eventBus.emit("BIOMARKER_CHANGED", {
      biomarker_id,
      old_value: oldValue,
      new_value: newValue,
      change_amount: newValue - oldValue,
      mode
    });
  }

  /**
   * Handle resource consumption - affects biomarkers
   * (e.g., glucose consumption lowers BM_GLUC)
   */
  handleResourcesConsumed(eventData) {
    const { resources } = eventData; // [{ id, amount }, ...]

    resources.forEach(({ id: resourceId, amount }) => {
      const resource = this.bioDatabase.resources.find(
        (r) => r.id === resourceId
      );

      if (!resource || !resource.environment_effects) {
        return;
      }

      // Apply negative biomarker mods (depletion)
      if (resource.environment_effects.biomarker_mods) {
        resource.environment_effects.biomarker_mods.forEach((mod) => {
          // Invert: consumption reduces biomarkers
          const invertedMode =
            mod.mode === "add" ? "sub" : mod.mode === "sub" ? "add" : mod.mode;
          const invertedValue =
            mod.mode === "mul" ? 1 / mod.value : mod.value;

          this.applyBiomarkerModifier({
            biomarker_id: mod.marker_id,
            mode: invertedMode,
            cascaded_value: invertedValue * amount,
            source_resource: resourceId
          });
        });
      }
    });
  }

  /**
   * Handle resource production - affects biomarkers
   * (e.g., ATP production increases energy availability)
   */
  handleResourcesProduced(eventData) {
    const { resources } = eventData;

    resources.forEach(({ id: resourceId, amount }) => {
      const resource = this.bioDatabase.resources.find(
        (r) => r.id === resourceId
      );

      if (!resource || !resource.environment_effects) {
        return;
      }

      // Apply biomarker mods directly (production increases biomarkers)
      if (resource.environment_effects.biomarker_mods) {
        resource.environment_effects.biomarker_mods.forEach((mod) => {
          this.applyBiomarkerModifier({
            biomarker_id: mod.marker_id,
            mode: mod.mode,
            cascaded_value: mod.value * amount,
            source_resource: resourceId
          });
        });
      }
    });
  }

  /**
   * Each simulation tick, apply natural recovery/decay
   */
  handleSimulationTick(eventData) {
    // Natural decay towards normal range (homeostasis)
    this.bioDatabase.biomarkers.forEach((bm) => {
      if (!bm.normal_range) return;

      const [min, max] = bm.normal_range;
      const target = (min + max) / 2;
      const current = this.biomarkerState[bm.id];

      // Decay rate: move 5% towards target per tick
      const recoveryRate = 0.05;
      const newValue =
        current + (target - current) * recoveryRate;

      this.biomarkerState[bm.id] = newValue;
      this.recordHistory(bm.id, newValue);
    });
  }

  /**
   * Check if value crossed a critical threshold
   */
  checkThresholdCrossing(biomarker, oldValue, newValue) {
    if (!biomarker || !biomarker.normal_range) {
      return null;
    }

    const [min, max] = biomarker.normal_range;

    // Check critical low
    if (
      biomarker.critical_low &&
      oldValue >= biomarker.critical_low &&
      newValue < biomarker.critical_low
    ) {
      return "critical_low";
    }

    // Check critical high
    if (
      biomarker.critical_high &&
      oldValue <= biomarker.critical_high &&
      newValue > biomarker.critical_high
    ) {
      return "critical_high";
    }

    // Check left normal range (below min)
    if (oldValue >= min && newValue < min) {
      return "below_normal";
    }

    // Check above normal range (above max)
    if (oldValue <= max && newValue > max) {
      return "above_normal";
    }

    return null;
  }

  /**
   * Record history for trending
   */
  recordHistory(biomarkerId, value, maxHistoryLength = 1000) {
    const history = this.biomarkerHistory.get(biomarkerId);
    if (history) {
      history.push(value);
      if (history.length > maxHistoryLength) {
        history.shift();
      }
    }
  }

  /**
   * Get current biomarker value
   */
  getValue(biomarkerId) {
    return this.biomarkerState[biomarkerId] || null;
  }

  /**
   * Get all biomarker values
   */
  getAll() {
    return { ...this.biomarkerState };
  }

  /**
   * Get biomarker trend (average over last N samples)
   */
  getTrend(biomarkerId, sampleSize = 10) {
    const history = this.biomarkerHistory.get(biomarkerId);
    if (!history || history.length < 2) return 0;

    const samples = history.slice(-sampleSize);
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    const current = history[history.length - 1];

    return current - avg;
  }

  /**
   * Check if biomarker is in normal range
   */
  isNormal(biomarkerId) {
    const biomarker = this.bioDatabase.biomarkers.find(
      (bm) => bm.id === biomarkerId
    );
    if (!biomarker || !biomarker.normal_range) return null;

    const value = this.biomarkerState[biomarkerId];
    const [min, max] = biomarker.normal_range;

    return value >= min && value <= max;
  }

  /**
   * Debug: Dump all biomarker states
   */
  dump() {
    const result = {};
    this.bioDatabase.biomarkers.forEach((bm) => {
      const value = this.biomarkerState[bm.id];
      const normal = bm.normal_range
        ? bm.normal_range
        : null;
      const isNormal =
        normal && value >= normal[0] && value <= normal[1];
      result[bm.id] = {
        name: bm.name,
        value,
        unit: bm.metric,
        normal_range: normal,
        is_normal: isNormal,
        trend: this.getTrend(bm.id)
      };
    });
    return result;
  }
}
