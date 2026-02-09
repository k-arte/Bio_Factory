/**
 * UIUpdateBridge.js - Connects EventBus signals to UI component updates
 * 
 * The new systems (BiomarkerSystem, DiseaseSystem, etc) emit events
 * that need to update the UI. This bridge listens to those events
 * and calls appropriate UI update methods.
 * 
 * WIRING:
 * - BiomarkerSystem -> BIOMARKER_CHANGED -> update BiomarkerMonitor
 * - DiseaseSystem -> DISEASE_TRIGGERED -> show disease alert
 * - RecipeUnlockSystem -> RECIPE_UNLOCKED -> update recipe UI
 * - BuildingBehaviorSystem -> RECIPE_STARTED -> show progress
 * - WasteInventorySystem -> SPILLAGE_OCCURRED -> show warning
 */

export class UIUpdateBridge {
  constructor(eventBus, uiManager, biomarkerMonitor, hudManager) {
    this.eventBus = eventBus;
    this.uiManager = uiManager;
    this.biomarkerMonitor = biomarkerMonitor;
    this.hudManager = hudManager;

    // Setup event listeners
    this.setupBiomarkerListeners();
    this.setupDiseaseListeners();
    this.setupRecipeListeners();
    this.setupBuildingListeners();
    this.setupWasteListeners();
  }

  /**
   * Listen to biomarker events and update monitor
   */
  setupBiomarkerListeners() {
    this.eventBus.on("BIOMARKER_CHANGED", (eventData) => {
      const { biomarker_id, new_value } = eventData;
      this.updateBiomarkerDisplay(biomarker_id, new_value);
    });

    this.eventBus.on("BIOMARKER_THRESHOLD_CROSSED", (eventData) => {
      const { biomarker_id, threshold_type } = eventData;
      this.showBiomarkerWarning(biomarker_id, threshold_type);
    });
  }

  /**
   * Listen to disease events
   */
  setupDiseaseListeners() {
    this.eventBus.on("DISEASE_TRIGGERED", (eventData) => {
      const { disease_id, disease_name } = eventData;
      this.showDiseaseAlert(disease_name, "triggered");
    });

    this.eventBus.on("DISEASE_PROGRESSED", (eventData) => {
      const { disease_name, new_severity_tier } = eventData;
      this.showDiseaseAlert(
        `${disease_name} - Severity Tier ${new_severity_tier}`,
        "progressed"
      );
    });

    this.eventBus.on("DISEASE_REMITTED", (eventData) => {
      const { disease_name } = eventData;
      this.showDiseaseAlert(`${disease_name} REMITTED`, "remitted");
    });

    this.eventBus.on("TREATMENT_OPTIONS_AVAILABLE", (eventData) => {
      this.showTreatmentOptions(eventData);
    });
  }

  /**
   * Listen to recipe events
   */
  setupRecipeListeners() {
    this.eventBus.on("RECIPE_UNLOCKED", (eventData) => {
      const { recipe_name, reason } = eventData;
      this.showRecipeUnlock(recipe_name, reason);
    });

    this.eventBus.on("RECIPE_STARTED", (eventData) => {
      this.updateRecipeProgress(eventData.building_id, 0);
    });

    this.eventBus.on("RECIPE_COMPLETED", (eventData) => {
      this.showRecipeCompletion(eventData);
    });
  }

  /**
   * Listen to building events
   */
  setupBuildingListeners() {
    this.eventBus.on("BUILDING_PLACED", (eventData) => {
      this.updateBuildingCountDisplay();
    });

    this.eventBus.on("BUILDING_DESTROYED", (eventData) => {
      this.updateBuildingCountDisplay();
    });

    this.eventBus.on("STORAGE_NEAR_CAPACITY", (eventData) => {
      this.showStorageWarning(eventData);
    });
  }

  /**
   * Listen to waste events
   */
  setupWasteListeners() {
    this.eventBus.on("SPILLAGE_OCCURRED", (eventData) => {
      const { excess_amount, affected_neighbors } = eventData;
      this.showSpillageWarning(excess_amount, affected_neighbors.length);
    });

    this.eventBus.on("WASTE_ACCUMULATION_WARNING", (eventData) => {
      const { resource_id, ratio_full, severity } = eventData;
      this.showWasteWarning(resource_id, ratio_full, severity);
    });
  }

  /**
   * Update biomarker display in monitor
   */
  updateBiomarkerDisplay(biomarkerId, newValue) {
    if (!this.biomarkerMonitor) return;

    // Map system biomarker IDs to UI display names
    const displayMap = {
      BM_PH_BLOOD: "ph",
      BM_LACTATE: "lactate", // Might need custom display
      BM_OXYGEN_SAT: "oxygen",
      BM_GLUC: "glucose",
      BM_WBC: "wbc"
    };

    const displayKey = displayMap[biomarkerId];
    if (displayKey && this.biomarkerMonitor.biomarkers[displayKey]) {
      const biomarker = this.biomarkerMonitor.biomarkers[displayKey];
      biomarker.current = newValue;

      // Update history
      if (biomarker.history.length > this.biomarkerMonitor.historyLength) {
        biomarker.history.shift();
      }
      biomarker.history.push(newValue);

      // Trigger redraw if monitor has render method
      if (typeof this.biomarkerMonitor.render === "function") {
        this.biomarkerMonitor.render();
      }
    }
  }

  /**
   * Show biomarker threshold warning
   */
  showBiomarkerWarning(biomarkerId, thresholdType) {
    const alertLevel =
      thresholdType === "critical_low" || thresholdType === "critical_high"
        ? "critical"
        : "warning";

    this.showAlert(
      `Biomarker Alert: ${biomarkerId} ${thresholdType}`,
      alertLevel
    );
  }

  /**
   * Show disease alert
   */
  showDiseaseAlert(diseaseName, eventType) {
    const alertLevel = eventType === "progressed" ? "warning" : "info";
    this.showAlert(`Disease: ${diseaseName}`, alertLevel);
  }

  /**
   * Show treatment options
   */
  showTreatmentOptions(eventData) {
    const { disease_name, effective_drugs } = eventData;
    const drugList = effective_drugs
      .map((d) => d.drug_tag)
      .join(", ");
    this.showAlert(
      `Treatment available for ${disease_name}: ${drugList}`,
      "info"
    );
  }

  /**
   * Show recipe unlock notification
   */
  showRecipeUnlock(recipeName, reason) {
    const reasonText = reason === "research_complete" ? "Research Complete" : "Available";
    this.showAlert(`Recipe Unlocked: ${recipeName} (${reasonText})`, "info");
  }

  /**
   * Update recipe progress bar
   */
  updateRecipeProgress(buildingId, progress) {
    // Would need to find building UI element and update progress
    // This is building-specific UI
    if (this.hudManager) {
      this.hudManager.updateBuildingProgress?.(buildingId, progress);
    }
  }

  /**
   * Show recipe completion
   */
  showRecipeCompletion(eventData) {
    const outputs = eventData.outputs
      ?.map((o) => `${o.id}: ${o.amount}`)
      .join(", ");
    this.showAlert(`Recipe Complete: ${outputs}`, "success");
  }

  /**
   * Update building count display
   */
  updateBuildingCountDisplay() {
    // Would update a building count widget if it exists
    if (this.hudManager) {
      this.hudManager.updateBuildingCount?.();
    }
  }

  /**
   * Show storage warning
   */
  showStorageWarning(eventData) {
    const { building_id, ratio_full } = eventData;
    const percentage = Math.round(ratio_full * 100);
    this.showAlert(`Storage ${percentage}% full at ${building_id}`, "warning");
  }

  /**
   * Show spillage warning
   */
  showSpillageWarning(excessAmount, affectedCells) {
    this.showAlert(
      `Spillage: ${excessAmount.toFixed(2)} units affecting ${affectedCells} cells`,
      "warning"
    );
  }

  /**
   * Show waste accumulation warning
   */
  showWasteWarning(resourceId, ratioFull, severity) {
    const percentage = Math.round(ratioFull * 100);
    const icon = severity === "critical" ? "⚠️" : "⚡";
    this.showAlert(
      `${icon} ${resourceId}: ${percentage}% accumulated`,
      severity === "critical" ? "critical" : "warning"
    );
  }

  /**
   * Generic alert display
   */
  showAlert(message, level = "info") {
    // Route to appropriate UI handler
    if (this.hudManager && typeof this.hudManager.showAlert === "function") {
      this.hudManager.showAlert(message, level);
    } else {
      // Fallback: console or simple notification
      console.log(`[${level.toUpperCase()}] ${message}`);
    }
  }

  /**
   * Debug: Check all event subscriptions
   */
  getSubscriptions() {
    return this.eventBus.getStats?.();
  }
}
