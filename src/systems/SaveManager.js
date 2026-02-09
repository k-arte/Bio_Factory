/**
 * SaveManager.js - Handles game state persistence
 * 
 * Saves ONLY essential data:
 * - unlocked_entries: Array of entry IDs the player has discovered
 * - tracked_stats: Player's lifetime statistics
 * 
 * Does NOT save the entire BioDatabase (that's static)
 */

class SaveManager {
  constructor() {
    this.storageKey = "bio_factory_save_v1";
    this.autoSaveInterval = 30000; // Auto-save every 30 seconds
    this.autoSaveTimerId = null;
  }
  
  /**
   * Initialize auto-save
   */
  startAutoSave() {
    this.autoSaveTimerId = setInterval(() => {
      this.saveGameState();
    }, this.autoSaveInterval);
    
    console.log("[SaveManager] Auto-save enabled (every 30s)");
  }
  
  /**
   * Stop auto-save
   */
  stopAutoSave() {
    if (this.autoSaveTimerId) {
      clearInterval(this.autoSaveTimerId);
      this.autoSaveTimerId = null;
    }
  }
  
  /**
   * Save game state to localStorage
   * 
   * Expected format:
   * {
   *   meta: { save_version: 1.0, timestamp: number },
   *   unlocked_entries: string[],
   *   tracked_stats: {
   *     total_energy_produced: number,
   *     total_resources_crafted: number,
   *     enemies_killed: { unitId: number },
   *     buildings_built: number,
   *     playtime_seconds: number
   *   }
   * }
   */
  async saveGameState(gameState) {
    if (!gameState) {
      console.warn("[SaveManager] No game state provided");
      return false;
    }
    
    try {
      // Add metadata
      const saveData = {
        meta: {
          save_version: 1.0,
          timestamp: Date.now()
        },
        ...gameState
      };
      
      // Save to localStorage
      const jsonString = JSON.stringify(saveData, null, 2);
      localStorage.setItem(this.storageKey, jsonString);
      
      console.log("[SaveManager] Game saved successfully", saveData);
      return true;
    } catch (error) {
      console.error("[SaveManager] Failed to save game:", error);
      return false;
    }
  }
  
  /**
   * Load game state from localStorage
   */
  async loadGameState() {
    try {
      const jsonString = localStorage.getItem(this.storageKey);
      
      if (!jsonString) {
        console.log("[SaveManager] No save file found. Starting new game.");
        return null;
      }
      
      const saveData = JSON.parse(jsonString);
      console.log("[SaveManager] Game loaded successfully", saveData);
      return saveData;
    } catch (error) {
      console.error("[SaveManager] Failed to load game:", error);
      return null;
    }
  }
  
  /**
   * Delete save game
   */
  async deleteSaveGame() {
    try {
      localStorage.removeItem(this.storageKey);
      console.log("[SaveManager] Save deleted");
      return true;
    } catch (error) {
      console.error("[SaveManager] Failed to delete save:", error);
      return false;
    }
  }
  
  /**
   * Export save as JSON file
   */
  exportSave() {
    try {
      const jsonString = localStorage.getItem(this.storageKey);
      if (!jsonString) {
        console.warn("[SaveManager] No save to export");
        return false;
      }
      
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `bio_factory_save_${Date.now()}.json`;
      link.click();
      
      console.log("[SaveManager] Save exported");
      return true;
    } catch (error) {
      console.error("[SaveManager] Failed to export save:", error);
      return false;
    }
  }
  
  /**
   * Import save from JSON file
   */
  importSave(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const saveData = JSON.parse(e.target.result);
          
          // Validate basic structure
          if (!saveData.unlocked_entries || !saveData.tracked_stats) {
            reject("Invalid save file format");
            return;
          }
          
          // Save it
          this.saveGameState(saveData);
          resolve(saveData);
        } catch (error) {
          reject("Failed to parse save file: " + error.message);
        }
      };
      
      reader.onerror = () => reject("Failed to read file");
      reader.readAsText(file);
    });
  }
  
  /**
   * Get save metadata without loading entire state
   */
  async getSaveMetadata() {
    try {
      const jsonString = localStorage.getItem(this.storageKey);
      if (!jsonString) return null;
      
      const saveData = JSON.parse(jsonString);
      return saveData.meta || null;
    } catch (error) {
      console.error("[SaveManager] Failed to get metadata:", error);
      return null;
    }
  }
  
  /**
   * Create a new game (clear save)
   */
  async newGame() {
    await this.deleteSaveGame();
    console.log("[SaveManager] New game started");
  }
}

// Export as ES6 module
export default SaveManager;
