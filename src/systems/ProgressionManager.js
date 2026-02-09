/**
 * ProgressionManager.js - Event-Driven Unlock System
 * 
 * OPTIMIZATION: This system does NOT check conditions in update loops.
 * Instead, it registers listeners at startup and only evaluates when relevant events occur.
 * 
 * HOW IT WORKS:
 * 1. At startup: Reads BioDatabase, builds listener maps for each stat/condition
 * 2. At runtime: Only when an event fires (e.g., onResourceProduced, onEnemyKilled) 
 *    do we check the small list of entries waiting for that specific event
 * 3. If unlocked: Add to SaveState.unlocked_ids, notify UI, save game
 * 
 * COMPLEXITY: O(1) per event, not O(n) per frame
 */

import BioDatabase from '../data/BioDatabase.js';

class ProgressionManager {
  constructor() {
    this.saveManager = null; // Will be set by GameManager
    
    // The database of all entries with their unlock conditions
    this.database = BioDatabase || {};
    
    // Current save state
    this.unlockedIds = new Set();
    this.stats = {
      total_energy_produced: 0,
      total_resources_crafted: 0,
      enemies_killed: {},
      buildings_built: 0,
      playtime_seconds: 0
    };
    
    // ============================================================
    // LISTENER MAPS (optimized event-driven dispatch)
    // Maps: stat_name -> [entryID] (entries waiting for that stat to change)
    // ============================================================
    
    // For STAT_THRESHOLD conditions
    this.listeners_on_stat = {};
    
    // For ITEM_COLLECTED conditions
    this.listeners_on_item = {};
    
    // For KILL_COUNT conditions
    this.listeners_on_kill = {};
    
    // For RESEARCH_COMPLETE conditions
    this.listeners_on_research = {};
    
    // UI Callback for notifications
    this.onUnlockCallback = null;
    
    this.initialized = false;
  }
  
  /**
   * Initialize the progression system:
   * 1. Load saved state
   * 2. Build listener maps
   * 3. Mark entries that were already unlocked
   */
  async initialize(saveManager) {
    this.saveManager = saveManager;
    
    // Load existing save state
    const savedState = await saveManager.loadGameState();
    if (savedState) {
      this.unlockedIds = new Set(savedState.unlocked_entries || []);
      this.stats = { ...this.stats, ...savedState.tracked_stats };
    }
    
    // Build listener maps from database
    this._buildListenerMaps();
    
    this.initialized = true;
    console.log("[ProgressionManager] Initialized. Unlocked entries:", Array.from(this.unlockedIds));
  }
  
  /**
   * Parse the database and build listener maps
   * This happens ONCE at startup, not per frame
   */
  _buildListenerMaps() {
    const db = this.database;
    
    // Go through all entry types
    const entryTypes = ['resources', 'buildings', 'units', 'terrain', 'technologies'];
    
    entryTypes.forEach(type => {
      const entries = db[type] || [];
      
      entries.forEach(entry => {
        // Already unlocked? Skip
        if (this.unlockedIds.has(entry.id)) {
          return;
        }
        
        // No unlock condition? Skip
        if (!entry.unlock_condition) {
          // Auto-unlock entries with no condition
          this.unlockedIds.add(entry.id);
          return;
        }
        
        const condition = entry.unlock_condition;
        
        // Register listener based on condition type
        switch (condition.type) {
          case 'STAT_THRESHOLD':
            // Entry waits for a specific stat to reach a value
            if (!this.listeners_on_stat[condition.stat]) {
              this.listeners_on_stat[condition.stat] = [];
            }
            this.listeners_on_stat[condition.stat].push({
              entryId: entry.id,
              entryType: type,
              condition: condition
            });
            break;
            
          case 'ITEM_COLLECTED':
            // Entry waits for player to collect/have an item
            if (!this.listeners_on_item[condition.item_id]) {
              this.listeners_on_item[condition.item_id] = [];
            }
            this.listeners_on_item[condition.item_id].push({
              entryId: entry.id,
              entryType: type,
              condition: condition
            });
            break;
            
          case 'KILL_COUNT':
            // Entry waits for player to kill X of a unit type
            if (!this.listeners_on_kill[condition.unit_id]) {
              this.listeners_on_kill[condition.unit_id] = [];
            }
            this.listeners_on_kill[condition.unit_id].push({
              entryId: entry.id,
              entryType: type,
              condition: condition
            });
            break;
            
          case 'RESEARCH_COMPLETE':
            // Entry waits for a research to complete
            if (!this.listeners_on_research[condition.tech_id]) {
              this.listeners_on_research[condition.tech_id] = [];
            }
            this.listeners_on_research[condition.tech_id].push({
              entryId: entry.id,
              entryType: type,
              condition: condition
            });
            break;
        }
      });
    });
  }
  
  // ============================================================
  // EVENT HANDLERS (Called from game systems)
  // ============================================================
  
  /**
   * Called when a resource is produced/consumed
   * Checks if any STAT_THRESHOLD conditions can now be unlocked
   */
  onResourceProduced(resourceId, amount) {
    this.stats.total_energy_produced += amount;
    
    // Check all entries waiting for "total_energy_produced"
    this._checkStatThreshold('total_energy_produced');
    
    // Check entries waiting for specific resource collection
    this._checkItemCollected(resourceId, amount);
  }
  
  /**
   * Called when an enemy is killed
   */
  onEnemyKilled(unitId, killCount = 1) {
    // Track kills by unit type
    if (!this.stats.enemies_killed[unitId]) {
      this.stats.enemies_killed[unitId] = 0;
    }
    this.stats.enemies_killed[unitId] += killCount;
    
    // Check entries waiting for this specific unit to be killed
    this._checkKillCount(unitId);
  }
  
  /**
   * Called when a building is built
   */
  onBuildingBuilt(buildingId) {
    this.stats.buildings_built++;
  }
  
  /**
   * Called when a research completes
   */
  onResearchComplete(techId) {
    // Check all entries waiting for this research
    const waitingEntries = this.listeners_on_research[techId] || [];
    
    for (const listener of waitingEntries) {
      this._tryUnlock(listener.entryId, listener.entryType, listener.condition);
    }
    
    // Remove from listeners
    delete this.listeners_on_research[techId];
  }
  
  /**
   * Called when an item reaches a count
   */
  onItemCountReached(itemId, count) {
    this._checkItemCollected(itemId, count);
  }
  
  // ============================================================
  // INTERNAL HELPER METHODS
  // ============================================================
  
  /**
   * Check all entries waiting for a stat to reach a threshold
   */
  _checkStatThreshold(statName) {
    const waitingEntries = this.listeners_on_stat[statName] || [];
    const statValue = this._getStatValue(statName);
    
    for (const listener of waitingEntries) {
      if (statValue >= listener.condition.value) {
        this._tryUnlock(listener.entryId, listener.entryType, listener.condition);
      }
    }
  }
  
  /**
   * Check all entries waiting for an item to be collected
   */
  _checkItemCollected(itemId, amount) {
    const waitingEntries = this.listeners_on_item[itemId] || [];
    
    for (const listener of waitingEntries) {
      if (amount >= listener.condition.amount) {
        this._tryUnlock(listener.entryId, listener.entryType, listener.condition);
      }
    }
  }
  
  /**
   * Check all entries waiting for a kill count
   */
  _checkKillCount(unitId) {
    const waitingEntries = this.listeners_on_kill[unitId] || [];
    const killCount = this.stats.enemies_killed[unitId] || 0;
    
    for (const listener of waitingEntries) {
      if (killCount >= listener.condition.value) {
        this._tryUnlock(listener.entryId, listener.entryType, listener.condition);
      }
    }
  }
  
  /**
   * Attempt to unlock an entry
   */
  async _tryUnlock(entryId, entryType, condition) {
    if (this.unlockedIds.has(entryId)) {
      return; // Already unlocked
    }
    
    // Unlock it
    this.unlockedIds.add(entryId);
    
    // Notify UI
    if (this.onUnlockCallback) {
      const entry = this._getEntryById(entryId);
      this.onUnlockCallback({
        entryId,
        entryType,
        entry,
        condition
      });
    }
    
    // Save immediately
    await this._saveState();
    
    console.log(`[ProgressionManager] UNLOCKED: ${entryId}`);
  }
  
  /**
   * Save current state to SaveManager
   */
  async _saveState() {
    if (!this.saveManager) return;
    
    const gameState = {
      unlocked_entries: Array.from(this.unlockedIds),
      tracked_stats: this.stats
    };
    
    await this.saveManager.saveGameState(gameState);
  }
  
  /**
   * Get a stat value (supports nested stats like enemies_killed.UNIT_X)
   */
  _getStatValue(statPath) {
    const parts = statPath.split('.');
    let value = this.stats[parts[0]];
    
    for (let i = 1; i < parts.length; i++) {
      value = value?.[parts[i]];
    }
    
    return value || 0;
  }
  
  /**
   * Get an entry by ID from database
   */
  _getEntryById(id) {
    const types = ['resources', 'buildings', 'units', 'terrain', 'technologies'];
    
    for (const type of types) {
      const entries = this.database[type] || [];
      const entry = entries.find(e => e.id === id);
      if (entry) return entry;
    }
    
    return null;
  }
  
  // ============================================================
  // PUBLIC QUERY METHODS
  // ============================================================
  
  /**
   * Check if an entry is unlocked
   */
  isUnlocked(id) {
    return this.unlockedIds.has(id);
  }
  
  /**
   * Get all unlocked entries of a type
   */
  getUnlockedEntriesByType(type) {
    const entries = this.database[type] || [];
    return entries.filter(e => this.isUnlocked(e.id));
  }
  
  /**
   * Get all locked entries of a type (for showing "???" in UI)
   */
  getLockedEntriesByType(type) {
    const entries = this.database[type] || [];
    return entries.filter(e => !this.isUnlocked(e.id) && e.unlock_condition);
  }
  
  /**
   * Get hint for why an entry is locked
   */
  getUnlockHint(id) {
    const entry = this._getEntryById(id);
    if (!entry || !entry.unlock_condition) return null;
    
    const cond = entry.unlock_condition;
    
    switch (cond.type) {
      case 'STAT_THRESHOLD':
        const statVal = this._getStatValue(cond.stat);
        return `Requires: ${cond.stat} > ${cond.value} (Current: ${statVal})`;
        
      case 'ITEM_COLLECTED':
        return `Requires: Collect ${cond.amount} of ${cond.item_id}`;
        
      case 'KILL_COUNT':
        const kills = this.stats.enemies_killed[cond.unit_id] || 0;
        return `Requires: Kill ${cond.value} of ${cond.unit_id} (Current: ${kills})`;
        
      case 'RESEARCH_COMPLETE':
        return `Requires: Research ${cond.tech_id}`;
        
      default:
        return "Unknown requirement";
    }
  }
  
  /**
   * Debug: Log all listener maps
   */
  debugListeners() {
    console.log("=== LISTENER MAPS ===");
    console.log("Stat Threshold Listeners:", this.listeners_on_stat);
    console.log("Item Collection Listeners:", this.listeners_on_item);
    console.log("Kill Count Listeners:", this.listeners_on_kill);
    console.log("Research Listeners:", this.listeners_on_research);
  }
}

// Export as ES6 module
export default ProgressionManager;
