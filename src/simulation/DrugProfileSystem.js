/**
 * DrugProfileSystem.js - Manages medication effectiveness and disease treatment
 * 
 * Each disease_type has a drug_profile:
 * {
 *   "ANTI_INFLAMMATORY": { weight: 0.3, min_power_threshold: 0.2 },
 *   "IMMUNO_SUPPRESSANT": { weight: 0.0, min_power_threshold: 0.5 }
 * }
 * 
 * Diseases can override profiles:
 * DIS_LACTIC_ACIDOSIS has default from DT_METABOLIC_ACIDOSIS, plus overrides
 * 
 * MECHANICS:
 * - Track active medications (concentration, onset time, duration)
 * - Calculate total drug effect by summing weighted contributions
 * - Apply effect to disease progression (reduce severity tier gain)
 * - Events: DRUG_ADMINISTERED, DRUG_ACTIVE, DISEASE_TREATED
 */

export class DrugProfileSystem {
  constructor(eventBus, bioDatabase, diseaseSystem, biomarkerSystem) {
    this.eventBus = eventBus;
    this.bioDatabase = bioDatabase;
    this.diseaseSystem = diseaseSystem;
    this.biomarkerSystem = biomarkerSystem;

    // activeMedications[cell_location_id] = [
    //   { drug_id, drug_tag, concentration, onset_time, duration_ms }
    // ]
    this.activeMedications = new Map();

    // medicationHistory[medicine_id] = [
    //   { administered_time, dosage, location, duration }
    // ]
    this.medicationHistory = new Map();

    // Subscribe to events
    this.eventBus.on("DRUG_ADMINISTERED", (eventData) => {
      this.handleDrugAdministered(eventData);
    });

    this.eventBus.on("SIMULATION_TICK", (eventData) => {
      this.updateMedicationConcentrations();
      this.applyMedicationEffects();
    });

    this.eventBus.on("DISEASE_TRIGGERED", (eventData) => {
      this.evaluateTreatmentOptions(eventData.disease_id);
    });
  }

  /**
   * Handle drug administration
   */
  handleDrugAdministered(eventData) {
    const { drug_id, dosage, location_id, concentration } = eventData;

    if (!this.activeMedications.has(location_id)) {
      this.activeMedications.set(location_id, []);
    }

    const medications = this.activeMedications.get(location_id);

    // Find or create medication entry
    const existingIndex = medications.findIndex(
      (m) => m.drug_id === drug_id
    );

    if (existingIndex >= 0) {
      // Stack: add to existing concentration
      medications[existingIndex].concentration += concentration;
    } else {
      // New medication
      medications.push({
        drug_id,
        drug_tag: this.getDrugTag(drug_id),
        concentration: concentration || 1.0,
        onset_time: Date.now(),
        duration_ms: 300000 // 5 minutes default
      });
    }

    // Record to history
    if (!this.medicationHistory.has(drug_id)) {
      this.medicationHistory.set(drug_id, []);
    }

    this.medicationHistory.get(drug_id).push({
      administered_time: Date.now(),
      dosage,
      location_id,
      duration_ms: 300000
    });

    this.eventBus.emit("DRUG_ACTIVE", {
      drug_id,
      drug_tag: this.getDrugTag(drug_id),
      location_id,
      concentration
    });
  }

  /**
   * Update medication concentrations (pharmacokinetics)
   * Assume linear decay over duration
   */
  updateMedicationConcentrations() {
    const now = Date.now();

    this.activeMedications.forEach((medications, locationId) => {
      const toRemove = [];

      medications.forEach((med, index) => {
        const elapsed = now - med.onset_time;
        const ratioRemaining = 1 - (elapsed / med.duration_ms);

        if (ratioRemaining <= 0) {
          toRemove.push(index);
        } else {
          med.concentration *= ratioRemaining;
        }
      });

      // Remove expired medications
      toRemove.reverse().forEach((index) => {
        medications.splice(index, 1);
      });

      if (medications.length === 0) {
        this.activeMedications.delete(locationId);
      }
    });
  }

  /**
   * Apply medication effects to active diseases
   */
  applyMedicationEffects() {
    // Get all active diseases
    const activeDiseases = this.diseaseSystem.getActiveDiseases();

    activeDiseases.forEach((diseaseInfo) => {
      const { disease_id, severity_tier } = diseaseInfo;
      const disease = this.bioDatabase.diseases.find(
        (d) => d.id === disease_id
      );

      if (!disease) return;

      // Get disease treatment profile
      const diseaseType = this.bioDatabase.disease_types.find(
        (dt) => dt.id === disease.type
      );

      let drugProfile = diseaseType?.default_drug_profile || {};

      // Apply overrides from disease
      if (disease.drug_profile_overrides) {
        drugProfile = { ...drugProfile, ...disease.drug_profile_overrides };
      }

      // Calculate total drug effect for this disease
      const drugEffect = this.calculateDrugEffect(drugProfile);

      if (drugEffect > 0) {
        // Apply treatment: reduce progression rate
        this.eventBus.emit("DISEASE_TREATED", {
          disease_id,
          disease_name: disease.name,
          severity_tier,
          drug_effect: drugEffect,
          effect_description:
            drugEffect > 0.7 ? "strong" : "moderate" : "weak"
        });

        // Slow down disease progression (increase time to next tier)
        // This is handled by DiseaseSystem slowing progression
        this.eventBus.emit("DISEASE_PROGRESSION_MODIFIED", {
          disease_id,
          slow_factor: 1 + drugEffect * 2 // Up to 3x slower progression
        });
      }
    });
  }

  /**
   * Calculate total drug effect based on active medications and disease profile
   * Returns 0-1 where 1 = complete suppression
   */
  calculateDrugEffect(drugProfile) {
    let totalEffect = 0;

    Object.entries(drugProfile).forEach(([drugTag, profileData]) => {
      // Find all active medications with this tag
      let tagConcentration = 0;

      this.activeMedications.forEach((medications) => {
        medications.forEach((med) => {
          if (med.drug_tag === drugTag) {
            tagConcentration += med.concentration;
          }
        });
      });

      if (tagConcentration >= profileData.min_power_threshold) {
        // Medication is active enough
        const contribution = Math.min(
          1,
          tagConcentration * profileData.weight
        );
        totalEffect += contribution;
      }
    });

    return Math.min(1, totalEffect);
  }

  /**
   * Get drug tag from drug ID or BioDatabase lookup
   */
  getDrugTag(drugId) {
    // Look in drug_tags
    const drugTag = this.bioDatabase.drug_tags.find((dt) =>
      this.bioDatabase.pharmacology.find(
        (p) => p.id === drugId && p.tags?.includes(dt.id)
      )
    );

    return drugTag?.id || "UNKNOWN";
  }

  /**
   * Evaluate treatment options for newly triggered disease
   */
  evaluateTreatmentOptions(diseaseId) {
    const disease = this.bioDatabase.diseases.find((d) => d.id === diseaseId);
    if (!disease) return;

    const diseaseType = this.bioDatabase.disease_types.find(
      (dt) => dt.id === disease.type
    );

    if (!diseaseType) return;

    const profile = diseaseType.default_drug_profile;
    const effectiveDrugs = [];

    Object.entries(profile).forEach(([drugTag, profileData]) => {
      const drugs = this.bioDatabase.pharmacology.filter(
        (p) => p.tags?.includes(drugTag)
      );

      effectiveDrugs.push({
        drug_tag: drugTag,
        available_drugs: drugs.map((d) => d.id),
        min_power: profileData.min_power_threshold
      });
    });

    this.eventBus.emit("TREATMENT_OPTIONS_AVAILABLE", {
      disease_id: diseaseId,
      disease_name: disease.name,
      effective_drugs: effectiveDrugs
    });
  }

  /**
   * Get active medications at a location
   */
  getMedicationsAt(locationId) {
    return this.activeMedications.get(locationId) || [];
  }

  /**
   * Get medication concentration for a specific drug
   */
  getMedicationConcentration(locationId, drugTag) {
    const medications = this.getMedicationsAt(locationId);
    return medications
      .filter((m) => m.drug_tag === drugTag)
      .reduce((sum, m) => sum + m.concentration, 0);
  }

  /**
   * Get all active medications (global)
   */
  getAllActiveMedications() {
    const result = [];

    this.activeMedications.forEach((medications, locationId) => {
      medications.forEach((med) => {
        result.push({
          ...med,
          location_id: locationId,
          time_remaining_ms:
            med.duration_ms - (Date.now() - med.onset_time)
        });
      });
    });

    return result;
  }

  /**
   * Get medication absorption history
   */
  getMedicationHistory(drugId, timeWindow = 300000) {
    const history = this.medicationHistory.get(drugId) || [];
    const now = Date.now();

    return history.filter(
      (entry) => now - entry.administered_time <= timeWindow
    );
  }

  /**
   * Debug: Dump system state
   */
  dump() {
    return {
      active_medications: this.getAllActiveMedications(),
      locations_with_meds: this.activeMedications.size,
      total_drug_applications:
        Array.from(this.medicationHistory.values()).reduce(
          (sum, arr) => sum + arr.length,
          0
        )
    };
  }
}
