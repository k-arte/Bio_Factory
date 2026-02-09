/**
 * DiffusionCascadeSystem.js - Handles environment_effects cascades from spillage
 * 
 * When resources spill (via SPILLAGE_OCCURRED event), their environment_effects
 * are applied to all affected cells. Biomarker mods cascade globally.
 * 
 * MECHANICS:
 * - Listen to SPILLAGE_OCCURRED events from WasteInventorySystem
 * - For each spilled resource, look up BioDatabase.resources[].environment_effects
 * - Apply biomarker_mods globally (they affect all cells equally)
 * - Emit BIOMARKER_MOD_APPLIED events for engine to handle
 * - Support local effects (spread to neighbors) for future expansion
 */

export class DiffusionCascadeSystem {
  constructor(eventBus, bioDatabase) {
    this.eventBus = eventBus;
    this.bioDatabase = bioDatabase;

    // Track active cascades for debugging
    this.activeCascades = new Map();

    // Subscribe to spillage events
    this.eventBus.on("SPILLAGE_OCCURRED", (eventData) => {
      this.handleSpillage(eventData);
    });

    // Subscribe to waste accumulation for early warnings
    this.eventBus.on("WASTE_ACCUMULATED", (eventData) => {
      this.handleWasteAccumulation(eventData);
    });
  }

  /**
   * Handle spillage by applying environment_effects from spilled resources
   */
  handleSpillage(spillageEvent) {
    const { cell_x, cell_y, spilled_resources, affected_neighbors } = spillageEvent;

    // Create cascade record
    const cascadeId = `${cell_x},${cell_y},${Date.now()}`;
    this.activeCascades.set(cascadeId, spillageEvent);

    // For each spilled resource, apply environment_effects
    spilled_resources.forEach(({ id: resourceId, amount }) => {
      const resource = this.bioDatabase.resources.find(
        (r) => r.id === resourceId
      );

      if (!resource || !resource.environment_effects) {
        return; // No environment effects
      }

      // Apply biomarker mods globally (affects all cells)
      if (resource.environment_effects.biomarker_mods) {
        resource.environment_effects.biomarker_mods.forEach((mod) => {
          const cascadeAmount = amount * this.getModStrength(mod.mode);

          this.eventBus.emit("BIOMARKER_MOD_APPLIED", {
            cascade_id: cascadeId,
            source_resource: resourceId,
            source_cell: { x: cell_x, y: cell_y },
            biomarker_id: mod.marker_id,
            mode: mod.mode,
            base_value: mod.value,
            cascaded_value: cascadeAmount,
            affected_cells: affected_neighbors.map((n) => ({
              x: n.cell_x,
              y: n.cell_y
            })),
            global: true // Flag this as a global cascade
          });
        });
      }

      // Future: Local effects (spread to neighbors over time)
      // if (resource.environment_effects.local_effects) { ... }
    });

    // Emit cascade summary
    this.eventBus.emit("SPILLAGE_CASCADE_COMPLETE", {
      cascade_id: cascadeId,
      origin: { x: cell_x, y: cell_y },
      spilled_count: spilled_resources.length,
      affected_cell_count: affected_neighbors.length,
      total_excess: spillageEvent.excess_amount
    });
  }

  /**
   * Early warning: track waste accumulation approaching capacity
   */
  handleWasteAccumulation(eventData) {
    const {
      cell_x,
      cell_y,
      resource_id,
      total_in_cell,
      capacity
    } = eventData;

    const ratioFull = total_in_cell / capacity;

    if (ratioFull > 0.75 && ratioFull <= 0.85) {
      // Warning: 75-85% full
      this.eventBus.emit("WASTE_ACCUMULATION_WARNING", {
        cell_x,
        cell_y,
        resource_id,
        ratio_full: ratioFull,
        severity: "medium"
      });
    } else if (ratioFull > 0.85) {
      // Critical: >85% full
      this.eventBus.emit("WASTE_ACCUMULATION_WARNING", {
        cell_x,
        cell_y,
        resource_id,
        ratio_full: ratioFull,
        severity: "critical"
      });
    }
  }

  /**
   * Determine how strong a modifier is based on its mode
   * - "add": linear (1x modifier value per unit)
   * - "mul": exponential (2x -> 0.5x for debuffs)
   * - "sub": like add but negative
   */
  getModStrength(mode) {
    switch (mode) {
      case "add":
      case "sub":
        return 1.0; // Linear scaling
      case "mul":
        return 1.0; // Multiplicative already encoded in value
      default:
        return 1.0;
    }
  }

  /**
   * Apply immediate biomarker adjustments
   * Called by SimulationCore or BiomarkerSystem during update cycle
   */
  applyBiomarkerModifiers(biomarkerState, modEvent) {
    const { biomarker_id, mode, cascaded_value } = modEvent;

    if (!biomarkerState[biomarker_id]) {
      return; // Biomarker doesn't exist
    }

    const current = biomarkerState[biomarker_id];

    switch (mode) {
      case "add":
        biomarkerState[biomarker_id] = current + cascaded_value;
        break;
      case "sub":
        biomarkerState[biomarker_id] = current - cascaded_value;
        break;
      case "mul":
        biomarkerState[biomarker_id] = current * cascaded_value;
        break;
      default:
        break;
    }
  }

  /**
   * Get active cascades for a specific region or time window
   */
  getActiveCascadesInRegion(x, y, radius = 3, timeWindow = 60000) {
    const now = Date.now();
    const result = [];

    this.activeCascades.forEach((cascade, cascadeId) => {
      const age = now - cascade.timestamp;
      if (age > timeWindow) return; // Too old

      const distance = Math.hypot(
        x - cascade.cell_x,
        y - cascade.cell_y
      );
      if (distance <= radius) {
        result.push({ cascadeId, cascade, distance, age });
      }
    });

    return result.sort((a, b) => a.distance - b.distance);
  }

  /**
   * Cleanup cascades older than threshold
   */
  cleanup(maxAgeMs = 300000) {
    const now = Date.now();
    const toDelete = [];

    this.activeCascades.forEach((cascade, cascadeId) => {
      if (now - cascade.timestamp > maxAgeMs) {
        toDelete.push(cascadeId);
      }
    });

    toDelete.forEach((cascadeId) => {
      this.activeCascades.delete(cascadeId);
    });

    return toDelete.length;
  }

  /**
   * Debug: Get cascade summary
   */
  dump() {
    const result = {
      active_cascades: this.activeCascades.size,
      cascades: []
    };

    this.activeCascades.forEach((cascade, cascadeId) => {
      result.cascades.push({
        id: cascadeId,
        origin: { x: cascade.cell_x, y: cascade.cell_y },
        excess: cascade.excess_amount,
        affected_neighbors: cascade.affected_neighbors.length,
        timestamp: cascade.timestamp
      });
    });

    return result;
  }
}
