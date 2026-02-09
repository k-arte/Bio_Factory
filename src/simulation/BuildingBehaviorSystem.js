/**
 * BuildingBehaviorSystem.js - Defines behavior for each building type
 * 
 * Building types from BioDatabase.tags.building:
 * - GENERATOR: Executes recipes, produces resources
 * - STORAGE: Holds resources up to capacity
 * - BALANCER: Regulates flow (throughput in/out)
 * - VESSEL: Conduits for transfer (handled by PressureSystem)
 * - PUMP: Active pressure nodes (handled by PressureSystem)
 * - DIFFUSER: Spreads resources/effects to neighbors
 * - SYSTEM_STRUCTURE: Critical infrastructure with special destruction penalty
 * 
 * MECHANICS:
 * - Each building type has its own tick handler
 * - Buildings subscribe to SIMULATION_TICK and execute their behavior
 * - Buildings emit BUILDING_OUTPUT, BUILDING_STORAGE_CHANGE, etc events
 */

export class BuildingBehaviorSystem {
  constructor(eventBus, bioDatabase, resourceManager) {
    this.eventBus = eventBus;
    this.bioDatabase = bioDatabase;
    this.resourceManager = resourceManager;

    // buildingState[building_id] = {
    //   type: "GENERATOR" | "STORAGE" | "BALANCER" | "VESSEL" | "PUMP" | "DIFFUSER" | ...
    //   position: { x, y },
    //   tags: ["GENERATOR", "SYSTEM_STRUCTURE", ...],
    //   storage: {}, // { resource_id: amount }
    //   storage_capacity: number,
    //   recipes_executing: [recipe_id, ...]
    // }
    this.buildingState = new Map();

    // Subscribe to building placement
    this.eventBus.on("BUILDING_PLACED", (eventData) => {
      this.registerBuilding(eventData);
    });

    this.eventBus.on("SIMULATION_TICK", (eventData) => {
      this.handleSimulationTick(eventData);
    });

    this.eventBus.on("BUILDING_STORAGE_ADD", (eventData) => {
      this.handleStorageAdd(eventData);
    });

    this.eventBus.on("BUILDING_STORAGE_REMOVE", (eventData) => {
      this.handleStorageRemove(eventData);
    });
  }

  /**
   * Register a building and initialize its state
   */
  registerBuilding(eventData) {
    const { building_id, building_type, position, tags } = eventData;

    const buildingDef = this.bioDatabase.buildings.find(
      (b) => b.id === building_type
    );

    if (!buildingDef) {
      console.warn(`Unknown building type: ${building_type}`);
      return;
    }

    const state = {
      type: building_type,
      position,
      tags: tags || buildingDef.tags || [],
      storage: {},
      storage_capacity: buildingDef.storage_capacity || 0,
      current_recipe: null,
      recipe_progress: 0
    };

    this.buildingState.set(building_id, state);

    this.eventBus.emit("BUILDING_INITIALIZED", {
      building_id,
      building_type,
      building_name: buildingDef.name
    });
  }

  /**
   * Main tick handler: dispatch to building-type-specific handlers
   */
  handleSimulationTick(eventData) {
    this.buildingState.forEach((state, buildingId) => {
      const handlerName = `handle_${state.tags[0]}`; // Use first tag as primary type

      switch (state.tags[0]) {
        case "GENERATOR":
          this.handleGeneratorTick(buildingId, state, eventData);
          break;
        case "STORAGE":
          this.handleStorageTick(buildingId, state, eventData);
          break;
        case "BALANCER":
          this.handleBalancerTick(buildingId, state, eventData);
          break;
        case "DIFFUSER":
          this.handleDiffuserTick(buildingId, state, eventData);
          break;
        case "VESSEL":
          // Handled by PressureSystem
          break;
        case "PUMP":
          // Handled by PressureSystem
          break;
        default:
          break;
      }
    });
  }

  /**
   * GENERATOR: Execute recipes
   * Look for available recipe, consume inputs, emit outputs after time_seconds
   */
  handleGeneratorTick(buildingId, state, eventData) {
    const buildingDef = this.bioDatabase.buildings.find(
      (b) => b.id === state.type
    );

    if (!buildingDef || !buildingDef.supported_recipes) {
      return;
    }

    // No recipe executing: try to start one
    if (!state.current_recipe) {
      // Select recipe based on priority
      const availableRecipes = buildingDef.supported_recipes
        .map((recipeId) =>
          this.bioDatabase.recipes.find((r) => r.id === recipeId)
        )
        .filter((r) => r && this.canExecuteRecipe(buildingId, state, r))
        .sort((a, b) => (a.priority || 999) - (b.priority || 999));

      if (availableRecipes.length > 0) {
        state.current_recipe = availableRecipes[0].id;
        state.recipe_progress = 0;

        this.eventBus.emit("RECIPE_STARTED", {
          building_id: buildingId,
          recipe_id: state.current_recipe
        });
      }
      return;
    }

    // Recipe executing: increment progress
    const recipe = this.bioDatabase.recipes.find(
      (r) => r.id === state.current_recipe
    );
    if (!recipe) {
      state.current_recipe = null;
      return;
    }

    const deltaTime = 1; // 1 second per tick
    state.recipe_progress += deltaTime;

    if (state.recipe_progress >= recipe.time_seconds) {
      // Recipe complete!
      this.completeRecipe(buildingId, state, recipe);
      state.current_recipe = null;
      state.recipe_progress = 0;
    }
  }

  /**
   * Check if recipe can execute (inputs available, not already full)
   */
  canExecuteRecipe(buildingId, state, recipe) {
    // Check inputs
    for (const input of recipe.inputs) {
      const stored = state.storage[input.id] || 0;
      if (stored < input.amount) {
        return false; // Insufficient input
      }
    }

    // Check output space
    for (const output of recipe.outputs) {
      const stored = state.storage[output.id] || 0;
      const future = stored + output.amount;
      if (future > state.storage_capacity) {
        return false; // Would overflow
      }
    }

    return true;
  }

  /**
   * Complete a recipe: consume inputs, produce outputs, emit waste
   */
  completeRecipe(buildingId, state, recipe) {
    const { position } = state;

    // Consume inputs
    const consumedResources = [];
    recipe.inputs.forEach(({ id, amount }) => {
      state.storage[id] = (state.storage[id] || 0) - amount;
      consumedResources.push({ id, amount });
    });

    // Produce outputs
    const producedResources = [];
    recipe.outputs.forEach(({ id, amount }) => {
      state.storage[id] = (state.storage[id] || 0) + amount;
      producedResources.push({ id, amount });
    });

    // Emit waste
    const wasteOutputs = recipe.waste_outputs || [];

    // Emit events in sequence (mimics SimulationCore)
    this.eventBus.emit("RESOURCES_CONSUMED", {
      building_id: buildingId,
      resources: consumedResources,
      position
    });

    this.eventBus.emit("RESOURCES_PRODUCED", {
      building_id: buildingId,
      resources: producedResources,
      position
    });

    if (wasteOutputs.length > 0) {
      this.eventBus.emit("RECIPE_COMPLETED", {
        recipe_id: recipe.id,
        building_id: buildingId,
        cell_x: position.x,
        cell_y: position.y,
        inputs: recipe.inputs,
        outputs: recipe.outputs,
        waste_outputs: wasteOutputs
      });
    }

    this.eventBus.emit("RECIPE_COMPLETED", {
      recipe_id: recipe.id,
      building_id: buildingId,
      position,
      inputs: recipe.inputs,
      outputs: recipe.outputs
    });
  }

  /**
   * STORAGE: Hold resources, emit warnings when full
   */
  handleStorageTick(buildingId, state, eventData) {
    const totalStored = Object.values(state.storage).reduce(
      (sum, amt) => sum + amt,
      0
    );
    const ratioFull = totalStored / state.storage_capacity;

    if (ratioFull > 0.9) {
      this.eventBus.emit("STORAGE_NEAR_CAPACITY", {
        building_id: buildingId,
        ratio_full: ratioFull
      });
    }
  }

  /**
   * BALANCER: Regulate throughput
   * Limit input/output flow based on effects
   */
  handleBalancerTick(buildingId, state, eventData) {
    const buildingDef = this.bioDatabase.buildings.find(
      (b) => b.id === state.type
    );

    if (!buildingDef || !buildingDef.effects || !buildingDef.effects.throughput) {
      return;
    }

    const { in: maxIn, out: maxOut } = buildingDef.effects.throughput;

    // Track flows for next cycle
    this.eventBus.emit("BALANCER_UPDATE", {
      building_id: buildingId,
      max_input: maxIn,
      max_output: maxOut
    });
  }

  /**
   * DIFFUSER: Spread resources to neighbors
   */
  handleDiffuserTick(buildingId, state, eventData) {
    const buildingDef = this.bioDatabase.buildings.find(
      (b) => b.id === state.type
    );

    if (!buildingDef || buildingDef.tags.indexOf("DIFFUSER") === -1) {
      return;
    }

    const { position, storage } = state;
    const radius = buildingDef.radius_ft || 20;

    // Find neighbors and spread
    const neighbors = this.getNeighborCells(position, radius);

    Object.entries(storage).forEach(([resourceId, amount]) => {
      if (amount <= 0) return;

      const spreadAmount = amount * 0.1; // 10% diffuses per tick

      neighbors.forEach(({ nx, ny }) => {
        this.eventBus.emit("DIFFUSER_SPREAD", {
          from_building: buildingId,
          from_position: position,
          to_position: { x: nx, y: ny },
          resource_id: resourceId,
          amount: spreadAmount / neighbors.length
        });
      });

      // Reduce local storage
      storage[resourceId] -= spreadAmount;
    });
  }

  /**
   * Handle storage additions (from external sources)
   */
  handleStorageAdd(eventData) {
    const { building_id, resource_id, amount } = eventData;
    const state = this.buildingState.get(building_id);

    if (!state) return;

    const stored = state.storage[resource_id] || 0;
    const capacity = state.storage_capacity;

    if (stored + amount > capacity) {
      // Overflow
      const overflow = stored + amount - capacity;
      state.storage[resource_id] = capacity;

      this.eventBus.emit("STORAGE_OVERFLOW", {
        building_id,
        resource_id,
        overflow_amount: overflow
      });
    } else {
      state.storage[resource_id] = stored + amount;

      this.eventBus.emit("STORAGE_CHANGED", {
        building_id,
        resource_id,
        new_amount: state.storage[resource_id]
      });
    }
  }

  /**
   * Handle storage removals
   */
  handleStorageRemove(eventData) {
    const { building_id, resource_id, amount } = eventData;
    const state = this.buildingState.get(building_id);

    if (!state) return;

    const stored = state.storage[resource_id] || 0;
    state.storage[resource_id] = Math.max(0, stored - amount);

    this.eventBus.emit("STORAGE_CHANGED", {
      building_id,
      resource_id,
      new_amount: state.storage[resource_id]
    });
  }

  /**
   * Get neighbor cells within radius
   */
  getNeighborCells(position, radius) {
    const neighbors = [];
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (dx === 0 && dy === 0) continue;
        neighbors.push({
          nx: position.x + dx,
          ny: position.y + dy
        });
      }
    }
    return neighbors;
  }

  /**
   * Get building state
   */
  getBuilding(buildingId) {
    return this.buildingState.get(buildingId);
  }

  /**
   * Get all buildings of type
   */
  getBuildingsByType(type) {
    const result = [];
    this.buildingState.forEach((state, buildingId) => {
      if (state.type === type) {
        result.push({ buildingId, ...state });
      }
    });
    return result;
  }

  /**
   * Debug: Dump building states
   */
  dump() {
    const result = {};
    this.buildingState.forEach((state, buildingId) => {
      result[buildingId] = {
        type: state.type,
        position: state.position,
        current_recipe: state.current_recipe,
        recipe_progress: state.recipe_progress,
        storage: state.storage,
        tags: state.tags
      };
    });
    return result;
  }
}
