/**
 * ModifierSystem.js - Multiplicative Modifier Application
 * 
 * Core philosophy:
 * - NEVER subtract raw values
 * - ALL penalties and bonuses are multiplicative: final = base × (1 + mod1) × (1 + mod2)...
 * 
 * This prevents edge cases where stacked penalties zero-out values.
 * Example: base 100 with mods [×0.9, ×0.8, ×0.7] = 100 × 0.504 = 50.4 (always > 0)
 * 
 * Instead of:   100 - 10 - 20 - 30 = 40 (but what if we stack more negs?)
 * We do:        100 × 0.9 × 0.8 × 0.7 = 50.4 (always approaches zero, never zero)
 */

class ModifierSystem {
  constructor() {
    // Array of active modifiers
    // Each modifier: { source: "disease_lactic_acidosis", values: { resource_gain: 0.9, build_cost: 1.1 } }
    this.modifiers = [];
  }

  /**
   * Set the active modifier list (replace all)
   */
  setModifiers(modifierList) {
    this.modifiers = modifierList || [];
  }

  /**
   * Add a single modifier (doesn't replace)
   */
  addModifier(source, values) {
    this.modifiers.push({
      source: source,
      values: values
    });
  }

  /**
   * Remove modifiers from a specific source
   */
  removeModifier(source) {
    this.modifiers = this.modifiers.filter(m => m.source !== source);
  }

  /**
   * Clear all modifiers
   */
  clear() {
    this.modifiers = [];
  }

  /**
   * Apply all active modifiers to a set of values
   * 
   * Input: { resource_gain: 100, build_cost: 50, unit_speed: 10 }
   * Expected output (with mods): { resource_gain: 90, build_cost: 55, unit_speed: 9.5 }
   * 
   * @param {object} baseValues - Original values to modify
   * @returns {object} Modified values (multiplicative)
   */
  applyModifiers(baseValues) {
    if (!baseValues || Object.keys(baseValues).length === 0) {
      return baseValues;
    }

    const result = { ...baseValues };

    // For each stat in baseValues, apply all modifiers to it
    for (const [statKey, baseValue] of Object.entries(baseValues)) {
      let multiplier = 1.0;

      // Accumulate all modifiers for this stat
      for (const modifier of this.modifiers) {
        if (modifier.values[statKey] !== undefined) {
          const modValue = modifier.values[statKey];
          
          // Values < 1.0 are reductions (×0.9), values > 1.0 are increases (×1.1)
          multiplier *= modValue;
        }
      }

      // Apply final multiplier
      result[statKey] = baseValue * multiplier;
    }

    return result;
  }

  /**
   * Apply modifiers to a single numeric value
   * Useful for non-object values (health, speed, etc.)
   * 
   * @param {number} baseValue - Original value
   * @param {string} statKey - Name of the stat (e.g., 'unit_speed')
   * @returns {number} Modified value
   */
  applySingleModifier(baseValue, statKey) {
    if (baseValue === undefined || baseValue === null) {
      return baseValue;
    }

    let multiplier = 1.0;

    for (const modifier of this.modifiers) {
      if (modifier.values[statKey] !== undefined) {
        multiplier *= modifier.values[statKey];
      }
    }

    return baseValue * multiplier;
  }

  /**
   * Get the effective multiplier for a stat
   * Useful for understanding modifier stacking
   * 
   * @param {string} statKey - Name of the stat
   * @returns {number} Multiplicative multiplier (e.g., 0.72 for stacked 0.9 × 0.8)
   */
  getEffectiveMultiplier(statKey) {
    let multiplier = 1.0;

    for (const modifier of this.modifiers) {
      if (modifier.values[statKey] !== undefined) {
        multiplier *= modifier.values[statKey];
      }
    }

    return multiplier;
  }

  /**
   * Get all modifiers affecting a specific stat
   * Useful for debugging
   * 
   * @param {string} statKey - Name of the stat
   * @returns {array} Array of { source, value }
   */
  getModifiersFor(statKey) {
    return this.modifiers
      .filter(m => m.values[statKey] !== undefined)
      .map(m => ({
        source: m.source,
        value: m.values[statKey]
      }));
  }

  /**
   * Debug output
   */
  debugModifiers() {
    console.group('[ModifierSystem] Active Modifiers');
    
    if (this.modifiers.length === 0) {
      console.log('(no active modifiers)');
    } else {
      for (const modifier of this.modifiers) {
        console.log(`${modifier.source}:`, modifier.values);
      }
    }

    // Show effective multipliers for common stats
    const commonStats = [
      'resource_gain', 'build_cost', 'unit_speed', 'atp_production',
      'enzyme_efficiency', 'immune_attraction', 'unit_damage_taken'
    ];

    console.group('Effective Multipliers');
    for (const stat of commonStats) {
      const multiplier = this.getEffectiveMultiplier(stat);
      if (multiplier !== 1.0) {
        console.log(`${stat}: ×${multiplier.toFixed(3)}`);
      }
    }
    console.groupEnd();
    
    console.groupEnd();
  }

  /**
   * Export modifier state (for saving)
   */
  serialize() {
    return this.modifiers.map(m => ({
      ...m
    }));
  }

  /**
   * Import modifier state (for loading)
   */
  deserialize(data) {
    this.modifiers = data || [];
  }
}

export default ModifierSystem;
