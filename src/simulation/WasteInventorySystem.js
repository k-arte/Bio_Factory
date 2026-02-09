/**
 * WasteInventorySystem.js - Tracks waste outputs and spillage mechanics
 * 
 * Waste from recipes accumulates locally. When storage exceeds capacity,
 * spillage occurs on neighboring cells and triggers environment_effects.
 * 
 * MECHANICS:
 * - Each cell has waste inventory per resource (RES_LACTATE, RES_CELL_DEBRIS, etc)
 * - Recipes emit waste_outputs into cell's local waste inventory
 * - Diffusion system spreads waste to neighbors (transferable=true)
 * - Spillage triggers biomarker_mods from environment_effects
 * - Events: WASTE_ACCUMULATED, SPILLAGE_OCCURRED, WASTE_CLEARED
 */

export class WasteInventorySystem {
  constructor(eventBus, cellWidth = 64, cellHeight = 64) {
    this.eventBus = eventBus;
    this.cellWidth = cellWidth;
    this.cellHeight = cellHeight;

    // waste[x][y][resourceId] = amount
    this.waste = new Map();

    // capacity[x][y] = total waste limit per cell
    // If exceeded, spillage cascades (emit events, apply biomarker_mods)
    this.capacities = new Map();

    // spillage_history[time] = { cellId, resourceId, amount, affected_cells }
    this.spillage_history = [];

    // Subscribe to recipe completion events
    this.eventBus.on("RECIPE_COMPLETED", (eventData) => {
      this.handleRecipeCompleted(eventData);
    });

    this.eventBus.on("DIFFUSION_TICK", (eventData) => {
      this.handleDiffusion(eventData);
    });
  }

  /**
   * Initialize waste tracking for a cell
   */
  initializeCell(x, y, capacityLimit = 100) {
    const cellId = `${x},${y}`;
    if (!this.waste.has(cellId)) {
      this.waste.set(cellId, {});
    }
    if (!this.capacities.has(cellId)) {
      this.capacities.set(cellId, capacityLimit);
    }
  }

  /**
   * Get cell's total waste accumulation
   */
  getTotalWaste(x, y) {
    const cellId = `${x},${y}`;
    const wasteMap = this.waste.get(cellId);
    if (!wasteMap) return 0;
    return Object.values(wasteMap).reduce((sum, amt) => sum + amt, 0);
  }

  /**
   * Get specific waste amount in cell
   */
  getWasteAmount(x, y, resourceId) {
    const cellId = `${x},${y}`;
    const wasteMap = this.waste.get(cellId);
    if (!wasteMap) return 0;
    return wasteMap[resourceId] || 0;
  }

  /**
   * recipes emit RECIPE_COMPLETED with waste_outputs
   * Handle accumulation and spillage
   */
  handleRecipeCompleted(eventData) {
    const { recipe, cell_x, cell_y, waste_outputs } = eventData;

    if (!waste_outputs || waste_outputs.length === 0) {
      return; // No waste
    }

    this.initializeCell(cell_x, cell_y);

    // Accumulate waste
    waste_outputs.forEach(({ id, amount }) => {
      const cellId = `${cell_x},${cell_y}`;
      const wasteMap = this.waste.get(cellId);
      wasteMap[id] = (wasteMap[id] || 0) + amount;

      // Emit accumulation event
      this.eventBus.emit("WASTE_ACCUMULATED", {
        cell_x,
        cell_y,
        resource_id: id,
        amount,
        total_in_cell: this.getTotalWaste(cell_x, cell_y),
        capacity: this.capacities.get(cellId)
      });
    });

    // Check for spillage
    const totalWaste = this.getTotalWaste(cell_x, cell_y);
    const capacity = this.capacities.get(`${cell_x},${cell_y}`);

    if (totalWaste > capacity) {
      this.triggerSpillage(cell_x, cell_y, waste_outputs);
    }
  }

  /**
   * When waste exceeds capacity, it spills to neighbors
   * Triggering biomarker_mods from environment_effects
   */
  triggerSpillage(x, y, waste_outputs) {
    const cellId = `${x},${y}`;
    const capacity = this.capacities.get(cellId);
    const totalWaste = this.getTotalWaste(x, y);
    const excess = totalWaste - capacity;

    // Emit spillage event
    const spillageEvent = {
      cell_x: x,
      cell_y: y,
      excess_amount: excess,
      spilled_resources: waste_outputs,
      affected_neighbors: [],
      timestamp: Date.now()
    };

    // Spread to neighbors (up to 8 adjacent cells)
    const neighbors = this.getNeighbors(x, y);
    neighbors.forEach(({ nx, ny }) => {
      this.initializeCell(nx, ny);

      // Each waste_output that is transferable spills to neighbor
      waste_outputs.forEach(({ id, amount }) => {
        // amount spilled = portion of excess
        const spillAmount = (amount / totalWaste) * excess * 0.5; // 50% diffuses

        const neighborId = `${nx},${ny}`;
        const neighborWaste = this.waste.get(neighborId);
        neighborWaste[id] = (neighborWaste[id] || 0) + spillAmount;

        spillageEvent.affected_neighbors.push({
          cell_x: nx,
          cell_y: ny,
          resource_id: id,
          amount: spillAmount
        });
      });
    });

    this.spillage_history.push(spillageEvent);

    // Emit spillage event for listeners to handle biomarker cascades
    this.eventBus.emit("SPILLAGE_OCCURRED", spillageEvent);
  }

  /**
   * Diffusion tick - spread transferable waste to neighbors
   * Non-transferable waste stays local (e.g., RES_ATP)
   */
  handleDiffusion(eventData) {
    const { dbResources } = eventData;

    // Create resource lookup for transferable flag
    const resourceTransferable = {};
    dbResources.forEach((res) => {
      resourceTransferable[res.id] = res.transferable !== false;
    });

    // For each cell, diffuse transferable waste
    this.waste.forEach((wasteMap, cellId) => {
      const [x, y] = cellId.split(",").map(Number);
      const neighbors = this.getNeighbors(x, y);

      Object.entries(wasteMap).forEach(([resourceId, amount]) => {
        if (!resourceTransferable[resourceId]) {
          return; // Don't diffuse non-transferable
        }

        // Diffusion rate from meta.defaults
        const diffusionRate = 0.05; // to_local_system_per_tick
        const diffuseAmount = amount * diffusionRate;

        if (diffuseAmount <= 0) return;

        // Reduce local waste
        wasteMap[resourceId] -= diffuseAmount;

        // Distribute to neighbors
        neighbors.forEach(({ nx, ny }) => {
          const neighborId = `${nx},${ny}`;
          const neighborWaste = this.waste.get(neighborId);
          if (neighborWaste) {
            const perNeighbor = diffuseAmount / neighbors.length;
            neighborWaste[resourceId] = (neighborWaste[resourceId] || 0) + perNeighbor;
          }
        });

        // Emit diffusion event
        this.eventBus.emit("WASTE_DIFFUSION", {
          cell_x: x,
          cell_y: y,
          resource_id: resourceId,
          diffused_amount: diffuseAmount,
          remaining_in_cell: wasteMap[resourceId]
        });
      });
    });
  }

  /**
   * Get all neighbors (8-directional)
   */
  getNeighbors(x, y) {
    const neighbors = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue; // Skip self
        neighbors.push({ nx: x + dx, ny: y + dy });
      }
    }
    return neighbors;
  }

  /**
   * Clear waste from cell (cleanup, immune action, etc)
   */
  clearWaste(x, y, resourceId = null) {
    const cellId = `${x},${y}`;
    const wasteMap = this.waste.get(cellId);
    if (!wasteMap) return;

    if (resourceId) {
      const cleared = wasteMap[resourceId] || 0;
      delete wasteMap[resourceId];
      this.eventBus.emit("WASTE_CLEARED", {
        cell_x: x,
        cell_y: y,
        resource_id: resourceId,
        amount: cleared
      });
    } else {
      const total = this.getTotalWaste(x, y);
      Object.keys(wasteMap).forEach((rid) => {
        delete wasteMap[rid];
      });
      this.eventBus.emit("WASTE_CLEARED", {
        cell_x: x,
        cell_y: y,
        total_cleared: total
      });
    }
  }

  /**
   * Get spillage history for a time window (debugging, stats)
   */
  getSpillageHistory(timeWindow = 60000) {
    const now = Date.now();
    return this.spillage_history.filter(
      (s) => now - s.timestamp <= timeWindow
    );
  }

  /**
   * Debug: Dump all waste state
   */
  dump() {
    const result = {};
    this.waste.forEach((wasteMap, cellId) => {
      result[cellId] = {
        waste: wasteMap,
        total: this.getTotalWaste(...cellId.split(",").map(Number)),
        capacity: this.capacities.get(cellId)
      };
    });
    return result;
  }
}
