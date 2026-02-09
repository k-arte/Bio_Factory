/**
 * SimulationCore.js - Data-Driven Biological Simulation Engine
 * 
 * Core responsibility: Execute recipes, update biomarkers/pH/diseases, emit events
 * 
 * Design principles:
 * - ALL rules come from BioDatabase (zero hardcoding)
 * - PURE DATA TRANSFORMATION (input state + delta → events)
 * - MULTIPLICATIVE MODIFIERS ONLY (never subtract)
 * - EVENT-DRIVEN (no polling or direct state mutations outside update)
 * 
 * Dependencies injected:
 * - BioDatabase (read-only copy of game rules)
 * - EventBus (for emitting all state changes)
 * - ModifierSystem (for applying multiplicative scaling)
 * - ResourceManager (read/write resource amounts)
 * 
 * Every state change → Event emission
 */

import BioDatabase from '../data/BioDatabase.js';

class SimulationCore {
  constructor(eventBus, modifierSystem = null) {
    this.database = BioDatabase;
    this.eventBus = eventBus;
    this.modifierSystem = modifierSystem;
    
    // Game state (values that change during simulation)
    this.state = {
      resources: {},           // { resourceId: amount }
      buildings: new Map(),    // resourceId → (buildings in that state)
      diseases: new Map(),     // diseaseId → { severity, onset_time }
      biomarkers: {},          // markerId → { current, lastUpdate }
      modifiers: [],           // Active modifier objects
      pH: {
        local: 7.4,            // Normal blood pH (varies by biome)
        systemic: 7.4
      }
    };
    
    // Recipe state per building
    this.buildingStates = new Map(); // buildingId → { recipeId, progress, inputs, outputs }
    
    // Initialize resource amounts from database
    this._initializeResources();
    
    // Track statistics for progression
    this.stats = {
      totalProduced: {},       // { resourceId: count }
      totalConsumed: {},
      recipesCompleted: 0,
      diseaseOnsets: 0,
      buildingsDestroyed: 0
    };
    
    console.log('[SimulationCore] Initialized with', Object.keys(this.state.resources).length, 'resource types');
  }

  /**
   * Initialize all resource amounts to 0 or starting values
   */
  _initializeResources() {
    if (!this.database.resources) return;
    
    this.database.resources.forEach(resource => {
      this.state.resources[resource.id] = 0;
      this.stats.totalProduced[resource.id] = 0;
      this.stats.totalConsumed[resource.id] = 0;
    });
  }

  /**
   * Initialize a building's production recipe
   */
  registerBuilding(buildingId, x, y) {
    const building = this.database.buildings?.find(b => b.id === buildingId);
    if (!building) {
      console.warn(`[SimulationCore] Building not found in database: ${buildingId}`);
      return;
    }

    const recipeId = `${buildingId}_active_recipe`;
    this.buildingStates.set(recipeId, {
      buildingId: buildingId,
      position: { x, y },
      active: true,
      recipeProgress: 0,
      inputs: building.consumption || {},
      outputs: building.production || {},
      craftTime: this._getCraftTimeForBuilding(building)
    });

    console.log(`[SimulationCore] Registered building ${buildingId}`);
    this.eventBus.emit('BUILDING_REGISTERED', { buildingId, x, y });
  }

  /**
   * Unregister a building (when destroyed)
   */
  unregisterBuilding(buildingId, x, y) {
    for (const [key, state] of this.buildingStates) {
      if (state.buildingId === buildingId) {
        this.buildingStates.delete(key);
        this.stats.buildingsDestroyed++;
        console.log(`[SimulationCore] Unregistered building ${buildingId}`);
        this.eventBus.emit('BUILDING_UNREGISTERED', { buildingId, x, y });
        return;
      }
    }
  }

  /**
   * Main update loop - called every frame
   * 
   * @param {number} deltaTime - Seconds elapsed since last frame
   */
  update(deltaTime) {
    // 1. Process active recipes
    this._updateRecipes(deltaTime);

    // 2. Update disease states
    this._updateDiseases(deltaTime);

    // 3. Update biomarkers from current resources
    this._updateBiomarkers();

    // 4. Check biomarker thresholds for disease triggers
    this._checkBiomarkerThresholds();

    // 5. Apply modifier calculations for next cycle
    this._recalculateModifiers();
  }

  /**
   * Process all active building recipes
   */
  _updateRecipes(deltaTime) {
    for (const [key, buildingState] of this.buildingStates) {
      if (!buildingState.active) continue;

      // Check if inputs are available
      if (!this._checkInputsAvailable(buildingState.inputs)) {
        continue; // Skip this recipe cycle
      }

      // Progress the recipe timer
      buildingState.recipeProgress += deltaTime;

      // Check if recipe completes
      if (buildingState.recipeProgress >= buildingState.craftTime) {
        // Consume inputs
        this._consumeResources(buildingState.inputs);
        this.eventBus.emit('RESOURCES_CONSUMED', {
          buildingId: buildingState.buildingId,
          resources: buildingState.inputs
        });

        // Produce outputs (with modifiers applied)
        const finalOutputs = this.modifierSystem
          ? this.modifierSystem.applyModifiers(buildingState.outputs)
          : buildingState.outputs;

        this._produceResources(finalOutputs);
        this.eventBus.emit('RESOURCES_PRODUCED', {
          buildingId: buildingState.buildingId,
          resources: finalOutputs
        });

        // Mark recipe completion
        this.eventBus.emit('RECIPE_COMPLETED', {
          buildingId: buildingState.buildingId,
          inputs: buildingState.inputs,
          outputs: finalOutputs
        });

        this.stats.recipesCompleted++;
        buildingState.recipeProgress = 0; // Reset for next cycle
      }
    }
  }

  /**
   * Check if all required inputs are available
   */
  _checkInputsAvailable(inputs) {
    for (const [resourceId, amount] of Object.entries(inputs)) {
      if (!this.state.resources[resourceId] || this.state.resources[resourceId] < amount) {
        return false;
      }
    }
    return true;
  }

  /**
   * Consume resources from game state
   */
  _consumeResources(inputs) {
    for (const [resourceId, amount] of Object.entries(inputs)) {
      this.state.resources[resourceId] -= amount;
      this.stats.totalConsumed[resourceId] = (this.stats.totalConsumed[resourceId] || 0) + amount;
    }
  }

  /**
   * Produce resources (add to game state)
   */
  _produceResources(outputs) {
    for (const [resourceId, amount] of Object.entries(outputs)) {
      if (amount <= 0) continue;
      this.state.resources[resourceId] = (this.state.resources[resourceId] || 0) + amount;
      this.stats.totalProduced[resourceId] = (this.stats.totalProduced[resourceId] || 0) + amount;
    }
  }

  /**
   * Update disease states based on biomarkers and triggers
   */
  _updateDiseases(deltaTime) {
    if (!this.database.diseases) return;

    for (const disease of this.database.diseases) {
      const diseaseState = this.state.diseases.get(disease.id) || {
        id: disease.id,
        severity: 0,
        onset_time: 0,
        active: false
      };

      // Check trigger condition
      if (!diseaseState.active && this._checkDiseaseTrigger(disease)) {
        diseaseState.active = true;
        diseaseState.onset_time = Date.now();
        diseaseState.severity = 1;
        this.state.diseases.set(disease.id, diseaseState);
        
        this.stats.diseaseOnsets++;
        this.eventBus.emit('DISEASE_ONSET', {
          disease: disease.id,
          severity: 1
        });
      }

      // Update severity based on persistence
      if (diseaseState.active) {
        const prevSeverity = diseaseState.severity;
        diseaseState.severity = this._calculateDiseaseSeverity(disease);
        
        if (diseaseState.severity > prevSeverity) {
          this.eventBus.emit('DISEASE_PROGRESSED', {
            disease: disease.id,
            oldSeverity: prevSeverity,
            newSeverity: diseaseState.severity
          });
        }
      }

      this.state.diseases.set(disease.id, diseaseState);
    }
  }

  /**
   * Check if disease trigger condition is met
   */
  _checkDiseaseTrigger(disease) {
    if (!disease.trigger) return false;

    switch (disease.trigger.type) {
      case 'RESOURCE_ACCUMULATION':
        const resourceAmount = this.state.resources[disease.trigger.resource] || 0;
        return resourceAmount >= disease.trigger.threshold;

      case 'RESOURCE_THRESHOLD':
        const currentAmount = this.state.resources[disease.trigger.resource] || 0;
        return currentAmount < disease.trigger.below;

      case 'EVENT':
        // Events are triggered by other game systems
        return false;

      default:
        return false;
    }
  }

  /**
   * Calculate disease severity (1-3) based on trigger intensity
   */
  _calculateDiseaseSeverity(disease) {
    if (!disease.trigger) return 1;

    switch (disease.trigger.type) {
      case 'RESOURCE_ACCUMULATION': {
        const resourceAmount = this.state.resources[disease.trigger.resource] || 0;
        const threshold = disease.trigger.threshold;
        const ratio = resourceAmount / threshold;
        return Math.min(3, Math.ceil(ratio)); // Tier 1-3
      }

      case 'RESOURCE_THRESHOLD': {
        const currentAmount = this.state.resources[disease.trigger.resource] || 0;
        const below = disease.trigger.below;
        const ratio = below / Math.max(1, currentAmount);
        return Math.min(3, Math.ceil(ratio));
      }

      default:
        return 1;
    }
  }

  /**
   * Update biomarker values from current resources
   */
  _updateBiomarkers() {
    if (!this.database.biomarkers) return;

    for (const biomarker of this.database.biomarkers) {
      const lastValue = this.state.biomarkers[biomarker.id]?.current || null;
      let currentValue;

      if (biomarker.source) {
        // Diagnostic biomarkers are sourced from resources
        currentValue = this.state.resources[biomarker.source] || 0;
      } else if (biomarker.systemic_only) {
        // pH is calculated, not sourced
        currentValue = this.state.pH.systemic;
      } else {
        continue;
      }

      // Only emit event if value changed
      if (lastValue !== currentValue) {
        this.eventBus.emit('BIOMARKER_UPDATED', {
          biomarkerId: biomarker.id,
          oldValue: lastValue,
          newValue: currentValue,
          unit: biomarker.unit,
          normalRange: biomarker.normal_range
        });
      }

      this.state.biomarkers[biomarker.id] = {
        current: currentValue,
        lastUpdate: Date.now()
      };
    }
  }

  /**
   * Check biomarker thresholds for critical conditions
   */
  _checkBiomarkerThresholds() {
    if (!this.database.biomarkers) return;

    for (const biomarker of this.database.biomarkers) {
      const current = this.state.biomarkers[biomarker.id]?.current || 0;

      // Check critical low
      if (biomarker.critical_low && current < biomarker.critical_low) {
        this.eventBus.emit('BIOMARKER_CRITICAL_LOW', {
          biomarkerId: biomarker.id,
          value: current,
          critical: biomarker.critical_low
        });

        // Trigger associated disease if configured
        if (biomarker.disease_correlation) {
          // Let disease system handle it
        }
      }

      // Check critical high
      if (biomarker.critical_high && current > biomarker.critical_high) {
        this.eventBus.emit('BIOMARKER_CRITICAL_HIGH', {
          biomarkerId: biomarker.id,
          value: current,
          critical: biomarker.critical_high
        });
      }
    }
  }

  /**
   * Recalculate modifiers based on current game state
   */
  _recalculateModifiers() {
    if (!this.modifierSystem) return;
    
    // Clear and rebuild modifier list based on active diseases/conditions
    this.state.modifiers = [];

    // Add disease modifiers
    for (const [diseaseId, diseaseState] of this.state.diseases) {
      if (diseaseState.active && diseaseState.severity > 0) {
        const disease = this.database.diseases?.find(d => d.id === diseaseId);
        if (disease && disease.severity_tiers) {
          const tier = disease.severity_tiers[diseaseState.severity - 1];
          if (tier?.systemic_modifier) {
            this.state.modifiers.push({
              source: `disease_${diseaseId}`,
              values: tier.systemic_modifier
            });
          }
        }
      }
    }

    // TODO: Add building destruction modifiers, inflammation modifiers, etc.
    
    this.modifierSystem.setModifiers(this.state.modifiers);
  }

  /**
   * Get craft time for a building (hardcoded base, could be in database)
   */
  _getCraftTimeForBuilding(building) {
    // TODO: Move this to BioDatabase as a field on buildings
    return 5; // seconds - default craft time
  }

  /**
   * Manually add/remove resources (for testing)
   */
  addResource(resourceId, amount) {
    this.state.resources[resourceId] = (this.state.resources[resourceId] || 0) + amount;
    this.eventBus.emit('RESOURCES_PRODUCED', {
      buildingId: null,
      resources: { [resourceId]: amount }
    });
  }

  removeResource(resourceId, amount) {
    this.state.resources[resourceId] = Math.max(0, (this.state.resources[resourceId] || 0) - amount);
    this.eventBus.emit('RESOURCES_CONSUMED', {
      buildingId: null,
      resources: { [resourceId]: amount }
    });
  }

  /**
   * Get game state snapshot (read-only for other systems)
   */
  getState() {
    return {
      resources: { ...this.state.resources },
      diseases: new Map(this.state.diseases),
      biomarkers: { ...this.state.biomarkers },
      pH: { ...this.state.pH }
    };
  }

  /**
   * Get simulation statistics
   */
  getStats() {
    return {
      totalProduced: { ...this.stats.totalProduced },
      totalConsumed: { ...this.stats.totalConsumed },
      recipesCompleted: this.stats.recipesCompleted,
      diseaseOnsets: this.stats.diseaseOnsets,
      buildingsDestroyed: this.stats.buildingsDestroyed,
      activeBuildings: this.buildingStates.size,
      activeDiseases: Array.from(this.state.diseases.values()).filter(d => d.active).length
    };
  }

  /**
   * Debug: Show current state
   */
  debugState() {
    console.group('[SimulationCore] State Snapshot');
    console.log('Resources:', this.state.resources);
    console.log('Active buildings:', this.buildingStates.size);
    console.log('Active diseases:', Array.from(this.state.diseases.entries())
      .filter(([_, d]) => d.active)
      .map(([id, d]) => `${id} (severity ${d.severity})`));
    console.log('pH:', this.state.pH);
    console.log('Biomarkers:', this.state.biomarkers);
    console.log('Stats:', this.stats);
    console.groupEnd();
  }
}

export default SimulationCore;
