/**
 * PathologySystem.js - Disease & pH Management
 * 
 * Converts disease data from BioDatabase into actual gameplay modifiers and effects.
 * Creates the bridge between simulation state and game mechanics.
 * 
 * Responsibilities:
 * - Listen to disease progression events
 * - Apply severity-based modifiers via ModifierSystem
 * - Update pH based on lactate/metabolic acid accumulation
 * - Handle medication application and pharmacokinetics
 * - Spread inflammation through terrain and units
 * - Apply biomarker-driven penalties
 * 
 * This system has NO direct game logic - all rules come from BioDatabase
 */

import BioDatabase from '../data/BioDatabase.js';

class PathologySystem {
  constructor(eventBus, simulationCore, modifierSystem) {
    this.database = BioDatabase;
    this.eventBus = eventBus;
    this.simulationCore = simulationCore;
    this.modifierSystem = modifierSystem;
    
    // Medication tracking (for pharmacokinetics)
    this.medications = new Map(); // { drugId: [{ amount, timestamp }, ...] }
    
    // Disease state cache
    this.diseaseModifiers = new Map(); // { diseaseId: modifier object }
    
    // Listen to relevant events
    this._setupListeners();
    
    console.log('[PathologySystem] Initialized');
  }

  /**
   * Register event listeners for disease/toxicity/pH events
   */
  _setupListeners() {
    // Disease progression triggers modifier application
    this.eventBus.on('DISEASE_PROGRESSED', (data) => {
      this._onDiseaseProgressed(data);
    });

    // Disease onset initiates effects
    this.eventBus.on('DISEASE_ONSET', (data) => {
      this._onDiseaseOnset(data);
    });

    // Biomarker thresholds may trigger diseases
    this.eventBus.on('BIOMARKER_CRITICAL_HIGH', (data) => {
      this._onBiomarkerCritical(data, 'high');
    });

    this.eventBus.on('BIOMARKER_CRITICAL_LOW', (data) => {
      this._onBiomarkerCritical(data, 'low');
    });

    // Resources produced may trigger diseases
    this.eventBus.on('RESOURCES_PRODUCED', (data) => {
      this._onResourcesProduced(data);
    });

    // Building destruction affects system health
    this.eventBus.on('BUILDING_UNREGISTERED', (data) => {
      this._onBuildingDestroyed(data);
    });
  }

  /**
   * Handle disease progression
   */
  _onDiseaseProgressed(data) {
    const { disease, newSeverity } = data;
    
    const diseaseData = this.database.diseases?.find(d => d.id === disease);
    if (!diseaseData) return;

    const severityTier = diseaseData.severity_tiers[newSeverity - 1];
    if (!severityTier) return;

    // Apply systemic modifiers
    if (severityTier.systemic_modifier) {
      // Create modifier from disease data
      const modifier = {
        source: `disease_${disease}_severity_${newSeverity}`,
        values: severityTier.systemic_modifier
      };

      // Remove old modifier for this disease if exists
      this.modifierSystem.removeModifier(`disease_${disease}`);
      
      // Add new modifier
      this.modifierSystem.addModifier(modifier.source, modifier.values);
      this.diseaseModifiers.set(disease, modifier);

      console.log(`[PathologySystem] Applied ${disease} modifier (severity ${newSeverity})`);
    }

    // Emit pH changes if applicable
    if (severityTier.local_ph_decrease) {
      this.eventBus.emit('pH_CHANGED', {
        delta: -severityTier.local_ph_decrease,
        source: `disease_${disease}`,
        severity: newSeverity
      });
    }

    // Block construction if specified
    if (severityTier.block_construction) {
      this.eventBus.emit('CONSTRUCTION_BLOCKED', {
        reason: `disease_${disease}`,
        severity: newSeverity
      });
    }
  }

  /**
   * Handle disease onset
   */
  _onDiseaseOnset(data) {
    const { disease } = data;
    
    const diseaseData = this.database.diseases?.find(d => d.id === disease);
    if (!diseaseData) return;

    console.log(`[PathologySystem] Disease onset: ${disease}`);

    // Trigger biomarker updates if correlated
    const biomarker = this.database.biomarkers?.find(b => b.disease_correlation === disease);
    if (biomarker) {
      this.eventBus.emit('DISEASE_CAUSED_BIOMARKER_CHANGE', {
        disease: disease,
        biomarker: biomarker.id
      });
    }
  }

  /**
   * Handle critical biomarker events
   */
  _onBiomarkerCritical(data, direction) {
    const { biomarkerId, value } = data;
    
    const biomarkerData = this.database.biomarkers?.find(b => b.id === biomarkerId);
    if (!biomarkerData) return;

    // Check for associated threshold effects
    if (biomarkerData.threshold_effects) {
      const effectKey = direction === 'high' ? 'above_critical_high' : 'below_critical_low';
      const effect = biomarkerData.threshold_effects[effectKey];
      
      if (effect?.modifier) {
        this.modifierSystem.addModifier(
          `biomarker_${biomarkerId}_critical_${direction}`,
          effect.modifier
        );
        
        console.log(`[PathologySystem] Applied ${biomarkerId} critical ${direction} modifier`);
      }
    }

    // Check if this correlates to a disease
    if (biomarkerData.disease_correlation) {
      this.eventBus.emit('DISEASE_TRIGGERED_BY_BIOMARKER', {
        biomarker: biomarkerId,
        disease: biomarkerData.disease_correlation,
        value: value,
        critical: direction
      });
    }
  }

  /**
   * Handle resource production for disease triggers
   * (e.g., lactate accumulation triggering acidosis)
   */
  _onResourcesProduced(data) {
    const { resources } = data;
    
    // Check diseases that are triggered by resource thresholds
    this.database.diseases?.forEach(disease => {
      if (disease.trigger?.type === 'RESOURCE_ACCUMULATION') {
        const resourceId = disease.trigger.resource;
        if (resources[resourceId]) {
          // Disease will be checked by SimulationCore's trigger logic
          // We just log here for debugging
          console.log(`[PathologySystem] Resource ${resourceId} changed, disease ${disease.id} trigger may activate`);
        }
      }
    });
  }

  /**
   * Handle building destruction (system collapse)
   */
  _onBuildingDestroyed(data) {
    const { buildingId } = data;
    
    // Check if this was a system structure
    const buildingData = this.database.buildings?.find(b => b.id === buildingId);
    if (buildingData?.tags?.includes('system_structure')) {
      // Apply system destruction modifiers
      const modifier = buildingData.destruction_modifiers || {};
      
      this.modifierSystem.addModifier(
        `destroyed_system_${buildingId}`,
        modifier
      );

      console.log(`[PathologySystem] System structure destroyed: ${buildingId}, applying collapse modifiers`);
      
      // Trigger inflammation cascade
      this.eventBus.emit('SYSTEM_STRUCTURE_DESTROYED', {
        building: buildingId,
        modifiers: modifier
      });
    }
  }

  /**
   * Administer medication
   * Adds to medication pool with pharmacokinetics
   */
  administertMedication(drugId, amount) {
    if (!this._medicationExists(drugId)) {
      console.warn(`[PathologySystem] Medication not found: ${drugId}`);
      return false;
    }

    // Add dose to tracking
    if (!this.medications.has(drugId)) {
      this.medications.set(drugId, []);
    }

    this.medications.get(drugId).push({
      amount: amount,
      administeredAt: Date.now()
    });

    console.log(`[PathologySystem] Administered ${drugId} x${amount}`);
    this.eventBus.emit('MEDICATION_ADMINISTERED', {
      medication: drugId,
      amount: amount
    });

    return true;
  }

  /**
   * Update medication pharmacokinetics (clearance, half-life)
   */
  updateMedicationState(deltaTime) {
    for (const [drugId, doses] of this.medications) {
      const drugData = this.database.pharmacology?.find(p => p.id === drugId);
      if (!drugData) continue;

      // Remove expired doses (older than 10 half-lives = 99.9% cleared)
      const maxAge = (drugData.half_life || 300) * 10;
      const now = Date.now();

      this.medications.set(drugId, 
        doses.filter(dose => (now - dose.administeredAt) / 1000 < maxAge)
      );

      // Calculate current effective dose
      const effectiveDose = this._calculateEffectiveDose(drugId, doses);

      // Check toxicity threshold
      if (drugData.toxicity_threshold && effectiveDose > drugData.toxicity_threshold) {
        console.warn(`[PathologySystem] ${drugId} exceeds toxicity threshold (${effectiveDose} > ${drugData.toxicity_threshold})`);
        
        // Apply side effects
        if (drugData.side_effects) {
          for (const sideEffect of drugData.side_effects) {
            if (effectiveDose > sideEffect.threshold_exceeded && sideEffect.modifier) {
              this.modifierSystem.addModifier(
                `medication_side_effect_${drugId}`,
                sideEffect.modifier
              );
              
              this.eventBus.emit('MEDICATION_SIDE_EFFECT_TRIGGERED', {
                medication: drugId,
                effect: sideEffect.effect,
                dose: effectiveDose
              });
            }
          }
        }
      }
    }
  }

  /**
   * Calculate effective dose (with half-life decay)
   */
  _calculateEffectiveDose(drugId, doses) {
    const drugData = this.database.pharmacology?.find(p => p.id === drugId);
    if (!drugData) return 0;

    const halfLife = drugData.half_life || 300;
    const now = Date.now();
    let totalEffective = 0;

    for (const dose of doses) {
      const ageSeconds = (now - dose.administeredAt) / 1000;
      const halfLives = ageSeconds / halfLife;
      const effectiveAmount = dose.amount * Math.pow(0.5, halfLives);
      totalEffective += effectiveAmount;
    }

    return totalEffective;
  }

  /**
   * Check if medication exists in database
   */
  _medicationExists(drugId) {
    return this.database.pharmacology?.some(p => p.id === drugId) || false;
  }

  /**
   * Get current disease state summary
   */
  getDiseaseState() {
    const state = this.simulationCore.getState();
    const summary = {};

    for (const [diseaseId, diseaseState] of state.diseases) {
      if (diseaseState.active) {
        summary[diseaseId] = {
          severity: diseaseState.severity,
          onsetTime: diseaseState.onset_time,
          duration: Date.now() - diseaseState.onset_time
        };
      }
    }

    return summary;
  }

  /**
   * Get active modifiers by source
   */
  getActiveModifiers() {
    return this.modifierSystem.serialize();
  }

  /**
   * Debug output
   */
  debugState() {
    console.group('[PathologySystem] State');
    console.log('Active disease modifiers:', Array.from(this.diseaseModifiers.entries()));
    console.log('Active medications:', Array.from(this.medications.entries()));
    console.log('Disease state:', this.getDiseaseState());
    console.log('Modifiers:', this.getActiveModifiers());
    console.groupEnd();
  }
}

export default PathologySystem;
