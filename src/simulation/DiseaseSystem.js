/**
 * DiseaseSystem.js - Evaluates and manages diseases triggered by biomarker conditions
 * 
 * Diseases now trigger via biomarker operators:
 * - E.g., "DIS_LACTIC_ACIDOSIS" triggers when BM_LACTATE >= 4.0 AND BM_PH_BLOOD <= 7.35
 * - Operators: >=, <=, ==, !=, >, <
 * 
 * MECHANICS:
 * - Track active diseases (onset time, severity tier)
 * - Evaluate triggers each SIMULATION_TICK
 * - Emit DISEASE_TRIGGERED, DISEASE_PROGRESSED, DISEASE_REMISSION events
 * - Apply disease effects (biomarker_mods, visual effects)
 * - Diseases modulate system behavior through ModifierSystem
 */

export class DiseaseSystem {
  constructor(eventBus, biomarkerSystem, bioDatabase) {
    this.eventBus = eventBus;
    this.biomarkerSystem = biomarkerSystem;
    this.bioDatabase = bioDatabase;

    // activeDiseases[disease_id] = { onset_time, severity_tier, effect_ids }
    this.activeDiseases = new Map();

    // diseaseHistory[disease_id] = [{ timestamp, event }, ...]
    this.diseaseHistory = new Map();

    // Subscribe to simulation ticks
    this.eventBus.on("SIMULATION_TICK", (eventData) => {
      this.evaluateDiseaseTriggers();
    });

    // Subscribe to biomarker changes for reactive triggers
    this.eventBus.on("BIOMARKER_THRESHOLD_CROSSED", (eventData) => {
      this.handleBiomarkerThresholdCrossed(eventData);
    });
  }

  /**
   * Evaluate all diseases each tick to detect onset/progression/remission
   */
  evaluateDiseaseTriggers() {
    const biomarkersNow = this.biomarkerSystem.getAll();

    // Check each disease for trigger conditions
    this.bioDatabase.diseases.forEach((disease) => {
      if (!disease.triggers || disease.triggers.length === 0) {
        return; // No triggers defined
      }

      // Evaluate ALL trigger conditions (AND logic)
      const allTriggersTrue = disease.triggers.every((trigger) =>
        this.evaluateTrigger(trigger, biomarkersNow)
      );

      const isActive = this.activeDiseases.has(disease.id);

      if (allTriggersTrue && !isActive) {
        // Disease onset
        this.onsetDisease(disease);
      } else if (!allTriggersTrue && isActive) {
        // Disease remission
        this.remitDisease(disease.id);
      } else if (allTriggersTrue && isActive) {
        // Disease progression check
        this.checkProgression(disease);
      }
    });
  }

  /**
   * Evaluate a single trigger condition
   * trigger = { marker_id, op, value }
   */
  evaluateTrigger(trigger, biomarkerValues) {
    const { marker_id, op, value } = trigger;
    const currentValue = biomarkerValues[marker_id];

    if (currentValue === undefined || currentValue === null) {
      return false; // Biomarker doesn't exist
    }

    switch (op) {
      case ">=":
        return currentValue >= value;
      case "<=":
        return currentValue <= value;
      case ">":
        return currentValue > value;
      case "<":
        return currentValue < value;
      case "==":
        return Math.abs(currentValue - value) < 0.001; // Float equality
      case "!=":
        return Math.abs(currentValue - value) >= 0.001;
      default:
        return false;
    }
  }

  /**
   * Onset: Disease triggers and enters tier 1
   */
  onsetDisease(disease) {
    const diseaseId = disease.id;
    const onsetTime = Date.now();

    this.activeDiseases.set(diseaseId, {
      onset_time: onsetTime,
      current_tier: 1,
      last_progression: onsetTime,
      active_effects: disease.effects || []
    });

    this.recordToHistory(diseaseId, "onset");

    // Emit onset event
    this.eventBus.emit("DISEASE_TRIGGERED", {
      disease_id: diseaseId,
      disease_name: disease.name,
      onset_time: onsetTime,
      initial_severity_tier: 1
    });

    // Apply tier 1 effects
    this.applyDiseaseEffects(disease, 1);
  }

  /**
   * Remission: Disease triggers remit
   */
  remitDisease(diseaseId) {
    const disease = this.bioDatabase.diseases.find((d) => d.id === diseaseId);
    if (!disease) return;

    const remissionTime = Date.now();
    this.activeDiseases.delete(diseaseId);
    this.recordToHistory(diseaseId, "remission");

    this.eventBus.emit("DISEASE_REMITTED", {
      disease_id: diseaseId,
      disease_name: disease.name,
      remission_time: remissionTime
    });

    // Remove effects
    this.removeDiseaseEffects(disease);
  }

  /**
   * Progression: Disease advances to next severity tier
   * Triggers after 30 seconds at current tier
   */
  checkProgression(disease) {
    const active = this.activeDiseases.get(disease.id);
    if (!active) return;

    const timeSinceLastProgression = Date.now() - active.last_progression;
    const progressionInterval = 30000; // 30 seconds per tier

    if (timeSinceLastProgression > progressionInterval) {
      const nextTier = active.current_tier + 1;
      const maxTier = disease.severity_tiers
        ? disease.severity_tiers.length
        : 1;

      if (nextTier <= maxTier) {
        active.current_tier = nextTier;
        active.last_progression = Date.now();

        this.recordToHistory(disease.id, `progression_tier_${nextTier}`);

        this.eventBus.emit("DISEASE_PROGRESSED", {
          disease_id: disease.id,
          disease_name: disease.name,
          new_severity_tier: nextTier,
          progression_time: active.last_progression
        });

        // Apply tier effects
        this.applyDiseaseEffects(disease, nextTier);
      }
    }
  }

  /**
   * React to biomarker threshold crossings
   */
  handleBiomarkerThresholdCrossed(eventData) {
    const { biomarker_id, threshold_type, new_value } = eventData;

    // Scan diseases for any that reference this biomarker
    this.bioDatabase.diseases.forEach((disease) => {
      if (!disease.triggers) return;

      const relevantTrigger = disease.triggers.find(
        (t) => t.marker_id === biomarker_id
      );
      if (!relevantTrigger) return;

      // Immediate re-evaluation of this disease
      const biomarkersNow = this.biomarkerSystem.getAll();
      const triggersTrue = disease.triggers.every((t) =>
        this.evaluateTrigger(t, biomarkersNow)
      );

      if (triggersTrue) {
        // Fast track: disease should be active
        if (!this.activeDiseases.has(disease.id)) {
          this.onsetDisease(disease);
        }
      }
    });
  }

  /**
   * Apply disease effects (visual, biomarker mods, modifiers)
   */
  applyDiseaseEffects(disease, tierNumber) {
    // Apply visual effects (if any)
    if (disease.effects && disease.effects.length > 0) {
      this.eventBus.emit("DISEASE_VISUAL_EFFECTS", {
        disease_id: disease.id,
        effect_ids: disease.effects,
        severity_tier: tierNumber
      });
    }

    // Emit modifier application event
    // (ModifierSystem will listen and apply disease modifiers)
    this.eventBus.emit("DISEASE_MODIFIER_APPLY", {
      disease_id: disease.id,
      disease_name: disease.name,
      severity_tier: tierNumber
    });
  }

  /**
   * Remove disease effects
   */
  removeDiseaseEffects(disease) {
    this.eventBus.emit("DISEASE_MODIFIER_REMOVE", {
      disease_id: disease.id
    });
  }

  /**
   * Get active disease info
   */
  getActiveDiseases() {
    const result = [];

    this.activeDiseases.forEach((data, diseaseId) => {
      const disease = this.bioDatabase.diseases.find((d) => d.id === diseaseId);
      if (disease) {
        result.push({
          disease_id: diseaseId,
          disease_name: disease.name,
          severity_tier: data.current_tier,
          onset_time: data.onset_time,
          duration_ms: Date.now() - data.onset_time
        });
      }
    });

    return result;
  }

  /**
   * Check if specific disease is active
   */
  isActive(diseaseId) {
    return this.activeDiseases.has(diseaseId);
  }

  /**
   * Get disease progression history
   */
  getHistory(diseaseId, timeWindow = 300000) {
    if (!this.diseaseHistory.has(diseaseId)) {
      return [];
    }

    const now = Date.now();
    const history = this.diseaseHistory.get(diseaseId);

    return history.filter((entry) => now - entry.timestamp <= timeWindow);
  }

  /**
   * Record event to disease history
   */
  recordToHistory(diseaseId, event) {
    if (!this.diseaseHistory.has(diseaseId)) {
      this.diseaseHistory.set(diseaseId, []);
    }

    this.diseaseHistory.get(diseaseId).push({
      event,
      timestamp: Date.now()
    });
  }

  /**
   * Debug: Dump disease state
   */
  dump() {
    return {
      active_diseases: this.getActiveDiseases(),
      total_tracked: this.diseaseHistory.size
    };
  }
}
