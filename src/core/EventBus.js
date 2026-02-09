/**
 * EventBus.js - Central Event Dispatcher
 * 
 * Single responsibility: Broadcast events from SimulationCore to all listening systems.
 * 
 * Architecture: Observer pattern with namespaced events
 * - Simulation systems emit events (RESOURCE_PRODUCED, DISEASE_ONSET, etc.)
 * - All other systems (Progression, UI, Pathology) listen passively
 * - NO circular dependencies, NO direct system calls
 * 
 * Usage:
 *   const bus = new EventBus();
 *   bus.on('RESOURCE_PRODUCED', (data) => { ... });
 *   bus.emit('RESOURCE_PRODUCED', { id: 'RES_GLUCOSE', amount: 10 });
 *   bus.off('RESOURCE_PRODUCED', callback);
 */

class EventBus {
  constructor() {
    // Event type → [ callback, callback, ... ]
    this.listeners = {};
    
    // Statistics for debugging
    this.totalEvents = 0;
    this.eventCounts = {}; // { eventType: count }
  }

  /**
   * Register a listener for an event type.
   * Multiple listeners can register for the same event.
   * 
   * @param {string} eventType - Event identifier (e.g., 'RESOURCE_PRODUCED')
   * @param {function} callback - Function(data) to call when event fires
   * @returns {function} Unsubscribe function
   */
  on(eventType, callback) {
    if (typeof callback !== 'function') {
      console.error(`[EventBus] Callback for '${eventType}' must be a function, got ${typeof callback}`);
      return () => {};
    }

    if (!this.listeners[eventType]) {
      this.listeners[eventType] = [];
    }

    this.listeners[eventType].push(callback);

    // Return unsubscribe function for convenience
    return () => this.off(eventType, callback);
  }

  /**
   * Emit (broadcast) an event to all listeners.
   * 
   * @param {string} eventType - Event identifier
   * @param {object} data - Event payload (can be any data)
   */
  emit(eventType, data = {}) {
    // Track statistics
    this.totalEvents++;
    this.eventCounts[eventType] = (this.eventCounts[eventType] || 0) + 1;

    // Early exit if no listeners
    if (!this.listeners[eventType] || this.listeners[eventType].length === 0) {
      return;
    }

    // Call all listeners for this event type
    const listeners = this.listeners[eventType];
    for (let i = 0; i < listeners.length; i++) {
      try {
        listeners[i](data);
      } catch (err) {
        console.error(
          `[EventBus] Error in '${eventType}' listener [${i}]:`,
          err.message
        );
        console.error('[EventBus] Stack:', err.stack);
      }
    }
  }

  /**
   * Unregister a specific listener.
   * 
   * @param {string} eventType - Event identifier
   * @param {function} callback - The exact callback function to remove
   */
  off(eventType, callback) {
    if (!this.listeners[eventType]) {
      return;
    }

    const index = this.listeners[eventType].indexOf(callback);
    if (index >= 0) {
      this.listeners[eventType].splice(index, 1);
    }

    // Clean up empty listener arrays
    if (this.listeners[eventType].length === 0) {
      delete this.listeners[eventType];
    }
  }

  /**
   * Remove ALL listeners for an event type.
   * 
   * @param {string} eventType - Event identifier (pass null to clear all events)
   */
  clear(eventType = null) {
    if (eventType === null) {
      this.listeners = {};
    } else {
      delete this.listeners[eventType];
    }
  }

  /**
   * Get the number of listeners for an event type.
   * Useful for debugging.
   * 
   * @param {string} eventType - Event identifier
   * @returns {number} Number of registered listeners
   */
  listenerCount(eventType) {
    return this.listeners[eventType] ? this.listeners[eventType].length : 0;
  }

  /**
   * Get statistics about event emissions.
   * 
   * @returns {object} { totalEvents, eventCounts, listenersByType }
   */
  getStats() {
    const listenersByType = {};
    for (const [type, listeners] of Object.entries(this.listeners)) {
      listenersByType[type] = listeners.length;
    }

    return {
      totalEvents: this.totalEvents,
      eventCounts: { ...this.eventCounts },
      listenersByType: listenersByType,
      activeEventTypes: Object.keys(this.listeners).length
    };
  }

  /**
   * Reset all statistics (but keep listeners).
   */
  resetStats() {
    this.totalEvents = 0;
    this.eventCounts = {};
  }

  /**
   * Debug output: Show all registered listeners.
   */
  debugListeners() {
    console.group('[EventBus] Registered Listeners');
    for (const [eventType, callbacks] of Object.entries(this.listeners)) {
      console.log(`${eventType}: ${callbacks.length} listener(s)`);
      callbacks.forEach((cb, idx) => {
        console.log(`  [${idx}] ${cb.name || 'anonymous'}`);
      });
    }
    console.groupEnd();
  }
}

export default EventBus;
