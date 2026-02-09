/**
 * RecipeUnlockSystem.js - Manages recipe unlock conditions and research gating
 * 
 * Recipes can be unlocked by:
 * - unlock_by_research: [TECH_ID, ...]  - Only available after research complete
 * - Default recipes have no unlock requirement (always available)
 * - Priority: Lower number = earlier execution (1 > 2 > 3)
 * 
 * MECHANICS:
 * - Track completed research technologies
 * - Evaluate unlock conditions, emit RECIPE_UNLOCKED when available
 * - BuildingBehaviorSystem queries available_recipes and sorts by priority
 * - Events: RECIPE_UNLOCKED, RECIPE_LOCKED, RESEARCH_COMPLETED, RESEARCH_STARTED
 */

export class RecipeUnlockSystem {
  constructor(eventBus, bioDatabase) {
    this.eventBus = eventBus;
    this.bioDatabase = bioDatabase;

    // completedResearch = Set<tech_id>
    this.completedResearch = new Set();

    // pendingResearch = Map<tech_id, { start_time, duration }>
    this.pendingResearch = new Map();

    // unlockedRecipes = Set<recipe_id>
    this.unlockedRecipes = new Set();

    // recipeState = Map<recipe_id, { unlocked, unlock_reason }>
    this.recipeState = new Map();

    // Initialize: mark recipes with no unlock requirement as unlocked
    this.initializeDefaultRecipes();

    // Subscribe to events
    this.eventBus.on("RESEARCH_START", (eventData) => {
      this.startResearch(eventData.tech_id);
    });

    this.eventBus.on("SIMULATION_TICK", (eventData) => {
      this.evaluateResearch();
      this.evaluateRecipeUnlocks();
    });
  }

  /**
   * Initialize: mark recipes with no unlock requirement as available
   */
  initializeDefaultRecipes() {
    this.bioDatabase.recipes.forEach((recipe) => {
      if (!recipe.unlock_by_research || recipe.unlock_by_research.length === 0) {
        this.unlockedRecipes.add(recipe.id);
        this.recipeState.set(recipe.id, {
          unlocked: true,
          unlock_reason: "default"
        });

        this.eventBus.emit("RECIPE_UNLOCKED", {
          recipe_id: recipe.id,
          recipe_name: recipe.name,
          reason: "default"
        });
      } else {
        this.recipeState.set(recipe.id, {
          unlocked: false,
          unlock_reason: null,
          required_research: recipe.unlock_by_research
        });
      }
    });
  }

  /**
   * Start research on a technology
   */
  startResearch(techId) {
    if (this.completedResearch.has(techId)) {
      return; // Already completed
    }

    if (this.pendingResearch.has(techId)) {
      return; // Already in progress
    }

    const tech = this.bioDatabase.research.find((t) => t.id === techId);
    if (!tech) {
      console.warn(`Unknown technology: ${techId}`);
      return;
    }

    // Assume fixed duration (could be configurable)
    const duration = 30000; // 30 seconds

    this.pendingResearch.set(techId, {
      start_time: Date.now(),
      duration,
      progress: 0
    });

    this.eventBus.emit("RESEARCH_STARTED", {
      tech_id: techId,
      tech_name: tech.name,
      estimated_duration_ms: duration
    });
  }

  /**
   * Evaluate all pending research, mark completed when time expires
   */
  evaluateResearch() {
    const now = Date.now();
    const toComplete = [];

    this.pendingResearch.forEach((research, techId) => {
      const elapsed = now - research.start_time;
      research.progress = elapsed / research.duration;

      if (elapsed >= research.duration) {
        toComplete.push(techId);
      }
    });

    // Mark completed
    toComplete.forEach((techId) => {
      this.completeResearch(techId);
    });
  }

  /**
   * Mark research as completed
   */
  completeResearch(techId) {
    const tech = this.bioDatabase.research.find((t) => t.id === techId);
    if (!tech) return;

    this.completedResearch.add(techId);
    this.pendingResearch.delete(techId);

    this.eventBus.emit("RESEARCH_COMPLETED", {
      tech_id: techId,
      tech_name: tech.name,
      unlocks: tech.unlocks || []
    });
  }

  /**
   * Evaluate all recipe unlock conditions
   */
  evaluateRecipeUnlocks() {
    this.bioDatabase.recipes.forEach((recipe) => {
      const state = this.recipeState.get(recipe.id);

      if (state && state.unlocked) {
        return; // Already unlocked
      }

      if (!recipe.unlock_by_research || recipe.unlock_by_research.length === 0) {
        return; // No unlock condition
      }

      // Check if all required research is complete
      const allResearchComplete = recipe.unlock_by_research.every((techId) =>
        this.completedResearch.has(techId)
      );

      if (allResearchComplete && !this.unlockedRecipes.has(recipe.id)) {
        // Unlock recipe!
        this.unlockRecipe(recipe.id, recipe.unlock_by_research);
      }
    });
  }

  /**
   * Unlock a recipe
   */
  unlockRecipe(recipeId, requiredResearch) {
    this.unlockedRecipes.add(recipeId);
    const recipe = this.bioDatabase.recipes.find((r) => r.id === recipeId);

    if (recipe) {
      const state = this.recipeState.get(recipeId);
      state.unlocked = true;
      state.unlock_reason = "research_complete";
      state.unlocked_by: requiredResearch;

      this.eventBus.emit("RECIPE_UNLOCKED", {
        recipe_id: recipeId,
        recipe_name: recipe.name,
        reason: "research_complete",
        required_research: requiredResearch
      });
    }
  }

  /**
   * Get available recipes (unlocked) with optional sorting by priority
   */
  getAvailableRecipes(sortByPriority = true) {
    const available = [];

    this.bioDatabase.recipes.forEach((recipe) => {
      if (this.isRecipeAvailable(recipe.id)) {
        available.push(recipe);
      }
    });

    if (sortByPriority) {
      available.sort((a, b) => (a.priority || 999) - (b.priority || 999));
    }

    return available;
  }

  /**
   * Check if recipe is available
   */
  isRecipeAvailable(recipeId) {
    return this.unlockedRecipes.has(recipeId);
  }

  /**
   * Get recipes available for specific building type
   */
  getRecipesForBuilding(buildingType) {
    const buildingDef = this.bioDatabase.buildings.find(
      (b) => b.id === buildingType
    );

    if (!buildingDef || !buildingDef.supported_recipes) {
      return [];
    }

    const recipes = buildingDef.supported_recipes
      .map((recipeId) => this.bioDatabase.recipes.find((r) => r.id === recipeId))
      .filter((r) => r && this.isRecipeAvailable(r.id));

    recipes.sort((a, b) => (a.priority || 999) - (b.priority || 999));

    return recipes;
  }

  /**
   * Get research progress
   */
  getResearchProgress(techId) {
    const research = this.pendingResearch.get(techId);
    if (!research) {
      return this.completedResearch.has(techId) ? 1.0 : 0;
    }
    return research.progress;
  }

  /**
   * Get active research tasks
   */
  getActiveResearch() {
    const result = [];

    this.pendingResearch.forEach((research, techId) => {
      const tech = this.bioDatabase.research.find((t) => t.id === techId);
      if (tech) {
        result.push({
          tech_id: techId,
          tech_name: tech.name,
          progress: research.progress,
          elapsed_ms: Date.now() - research.start_time,
          duration_ms: research.duration
        });
      }
    });

    return result;
  }

  /**
   * Get completed research
   */
  getCompletedResearch() {
    const result = [];

    this.completedResearch.forEach((techId) => {
      const tech = this.bioDatabase.research.find((t) => t.id === techId);
      if (tech) {
        result.push({
          tech_id: techId,
          tech_name: tech.name,
          unlocks: tech.unlocks || []
        });
      }
    });

    return result;
  }

  /**
   * Get locked recipes and their requirements
   */
  getLockedRecipes() {
    const result = [];

    this.bioDatabase.recipes.forEach((recipe) => {
      if (!this.isRecipeAvailable(recipe.id)) {
        const missingResearch = recipe.unlock_by_research
          ? recipe.unlock_by_research.filter(
              (techId) => !this.completedResearch.has(techId)
            )
          : [];

        result.push({
          recipe_id: recipe.id,
          recipe_name: recipe.name,
          requires_research: recipe.unlock_by_research || [],
          missing_research: missingResearch
        });
      }
    });

    return result;
  }

  /**
   * Debug: Dump system state
   */
  dump() {
    return {
      completed_research_count: this.completedResearch.size,
      active_research_count: this.pendingResearch.size,
      unlocked_recipes_count: this.unlockedRecipes.size,
      total_recipes: this.bioDatabase.recipes.length,
      active_research: this.getActiveResearch(),
      locked_recipes: this.getLockedRecipes()
    };
  }
}
