/**
 * PressureSystem.js - Manages vessel efficiency and pump-based logistics
 * 
 * Resources flow through vessels (BLD_VESSEL) and pumps (BLD_CARDIOCYTE_PUMP):
 * - Without pumps: base_efficiency = 10% (leaky vessels)
 * - With pumps: efficiency = 1.0 * (1 - leak_per_tile * distance)
 * - Pumps create "pressure head" to overcome resistance
 * - Auto-connecting vessels when pipes are available
 * 
 * MECHANICS:
 * - Each vessel tracks connections (neighbors, pumps)
 * - Efficiency == delivery success rate for resources
 * - Calculate path efficiency: start at pump, accumulate distance penalties
 * - High pressure can damage buildings (future)
 * - Events: VESSEL_CONNECTED, PUMP_ACTIVATED, LEAK_OCCURRED
 */

export class PressureSystem {
  constructor(eventBus, bioDatabase) {
    this.eventBus = eventBus;
    this.bioDatabase = bioDatabase;
    this.pressureConfig = bioDatabase.pressure_system || {};

    // vesselNetwork[vessel_id] = {
    //   position: { x, y },
    //   connections: [{ vessel_id, distance }, ...],
    //   pumps_upstream: [pump_id, ...],
    //   efficiency: float 0-1
    // }
    this.vesselNetwork = new Map();

    // pumpNetwork[pump_id] = {
    //   position: { x, y },
    //   active: bool,
    //   head_gain: float (default 1.0),
    //   supported_vessels: [vessel_id, ...]
    // }
    this.pumpNetwork = new Map();

    // leakage[location_id] = { amount, from_vessel, timestamp }
    this.leakageHistory = [];

    // Subscribe to building placement
    this.eventBus.on("BUILDING_PLACED", (eventData) => {
      this.handleBuildingPlaced(eventData);
    });

    this.eventBus.on("BUILDING_DESTROYED", (eventData) => {
      this.handleBuildingDestroyed(eventData);
    });

    this.eventBus.on("RESOURCES_TRANSFER_ATTEMPT", (eventData) => {
      this.handleResourceTransfer(eventData);
    });
  }

  /**
   * Register vessel or pump when placed
   */
  handleBuildingPlaced(eventData) {
    const { building_id, building_type, position } = eventData;

    if (building_type === "BLD_VESSEL") {
      this.registerVessel(building_id, position);
      this.attemptVesselConnections(building_id);
    } else if (building_type === "BLD_CARDIOCYTE_PUMP") {
      this.registerPump(building_id, position);
      this.attemptPumpActivation(building_id);
    }
  }

  /**
   * Unregister vessel or pump when destroyed
   */
  handleBuildingDestroyed(eventData) {
    const { building_id, building_type } = eventData;

    if (building_type === "BLD_VESSEL") {
      this.vesselNetwork.delete(building_id);
    } else if (building_type === "BLD_CARDIOCYTE_PUMP") {
      this.pumpNetwork.delete(building_id);
    }

    // Recalculate efficiency for affected vessels
    this.recalculateNetworkEfficiency();
  }

  /**
   * Register a vessel in the network
   */
  registerVessel(vesselId, position) {
    this.vesselNetwork.set(vesselId, {
      position,
      connections: [],
      pumps_upstream: [],
      efficiency: this.pressureConfig.base_efficiency_without_pump || 0.1
    });

    this.eventBus.emit("VESSEL_REGISTERED", {
      vessel_id: vesselId,
      position,
      initial_efficiency: 0.1
    });
  }

  /**
   * Register a pump in the network
   */
  registerPump(pumpId, position) {
    this.pumpNetwork.set(pumpId, {
      position,
      active: true,
      head_gain: this.pressureConfig.pump_nodes?.default_head_gain || 1.0,
      supported_vessels: []
    });

    this.eventBus.emit("PUMP_REGISTERED", {
      pump_id: pumpId,
      position
    });
  }

  /**
   * Attempt to connect new vessel to nearby vessels/pumps
   */
  attemptVesselConnections(vesselId) {
    const vessel = this.vesselNetwork.get(vesselId);
    if (!vessel) return;

    const { x: vx, y: vy } = vessel.position;

    // Find nearby vessels
    this.vesselNetwork.forEach((otherVessel, otherVesselId) => {
      if (otherVesselId === vesselId) return;

      const { x: ox, y: oy } = otherVessel.position;
      const distance = Math.hypot(vx - ox, vy - oy);

      // Connect if within pipeline distance (3 tiles)
      if (distance <= 3) {
        vessel.connections.push({
          vessel_id: otherVesselId,
          distance
        });

        this.eventBus.emit("VESSEL_CONNECTED", {
          from_vessel: vesselId,
          to_vessel: otherVesselId,
          distance
        });
      }
    });

    // Find nearby pumps
    this.pumpNetwork.forEach((pump, pumpId) => {
      if (!pump.active) return;

      const { x: px, y: py } = pump.position;
      const distance = Math.hypot(vx - px, vy - py);

      if (distance <= 3) {
        vessel.pumps_upstream.push(pumpId);
        pump.supported_vessels.push(vesselId);

        this.eventBus.emit("PUMP_SUPPORTS_VESSEL", {
          pump_id: pumpId,
          vessel_id: vesselId,
          distance
        });
      }
    });

    this.recalculateVesselEfficiency(vesselId);
  }

  /**
   * Attempt to activate pump (connect to vessels)
   */
  attemptPumpActivation(pumpId) {
    const pump = this.pumpNetwork.get(pumpId);
    if (!pump) return;

    const { x: px, y: py } = pump.position;

    // Find nearby vessels
    this.vesselNetwork.forEach((vessel, vesselId) => {
      const { x: vx, y: vy } = vessel.position;
      const distance = Math.hypot(vx - px, vy - py);

      if (distance <= 3) {
        vessel.pumps_upstream.push(pumpId);
        pump.supported_vessels.push(vesselId);

        this.recalculateVesselEfficiency(vesselId);
      }
    });
  }

  /**
   * Calculate efficiency for a vessel based on pump support and distance
   */
  recalculateVesselEfficiency(vesselId) {
    const vessel = this.vesselNetwork.get(vesselId);
    if (!vessel) return;

    if (vessel.pumps_upstream.length === 0) {
      // No pump support: base efficiency
      vessel.efficiency = this.pressureConfig.base_efficiency_without_pump || 0.1;
    } else {
      // With pump support: calculate by closest pump
      const bestPump = vessel.pumps_upstream[0]; // Could optimize to find closest
      const pump = this.pumpNetwork.get(bestPump);

      if (pump) {
        const { x: vx, y: vy } = vessel.position;
        const { x: px, y: py } = pump.position;
        const distance = Math.hypot(vx - px, vy - py);

        // Efficiency = pump_head * (1 - leak_per_tile * distance)
        const leakPerTile = this.pressureConfig.pump_nodes?.leak_per_tile || 0.02;
        vessel.efficiency = pump.head_gain * (1 - leakPerTile * distance);
        vessel.efficiency = Math.max(0, Math.min(1, vessel.efficiency)); // Clamp 0-1
      }
    }
  }

  /**
   * Recalculate all vessel efficiencies after network change
   */
  recalculateNetworkEfficiency() {
    this.vesselNetwork.forEach((vessel, vesselId) => {
      this.recalculateVesselEfficiency(vesselId);
    });
  }

  /**
   * Handle resource transfer through vessel network
   */
  handleResourceTransfer(eventData) {
    const { from_vessel, to_vessel, resource_id, amount } = eventData;

    const sourceVessel = this.vesselNetwork.get(from_vessel);
    const destVessel = this.vesselNetwork.get(to_vessel);

    if (!sourceVessel || !destVessel) {
      this.eventBus.emit("VESSEL_TRANSFER_FAILED", {
        reason: "vessel_not_found"
      });
      return;
    }

    // Check if connected
    const isConnected = sourceVessel.connections.some(
      (c) => c.vessel_id === to_vessel
    );

    if (!isConnected) {
      this.eventBus.emit("VESSEL_TRANSFER_FAILED", {
        reason: "vessels_not_connected"
      });
      return;
    }

    // Calculate successful transfer based on efficiency
    const efficiency = destVessel.efficiency;
    const transferSuccessful = amount * efficiency;
    const leaked = amount * (1 - efficiency);

    // Record leakage
    if (leaked > 0) {
      this.leakageHistory.push({
        amount: leaked,
        from_vessel,
        resource_id,
        timestamp: Date.now()
      });

      this.eventBus.emit("LEAK_OCCURRED", {
        from_vessel,
        resource_id,
        amount: leaked,
        efficiency
      });
    }

    // Emit successful transfer
    this.eventBus.emit("VESSEL_TRANSFER_SUCCESS", {
      from_vessel,
      to_vessel,
      resource_id,
      amount_sent: amount,
      amount_delivered: transferSuccessful,
      amount_leaked: leaked,
      efficiency
    });
  }

  /**
   * Get network efficiency stats
   */
  getNetworkStats() {
    const stats = {
      total_vessels: this.vesselNetwork.size,
      total_pumps: this.pumpNetwork.size,
      average_efficiency: 0,
      by_pump_support: {
        no_pump: 0,
        with_pump: 0
      },
      total_leakage_24h: 0
    };

    // Average efficiency
    let efficiencySum = 0;
    this.vesselNetwork.forEach((vessel) => {
      efficiencySum += vessel.efficiency;

      if (vessel.pumps_upstream.length === 0) {
        stats.by_pump_support.no_pump++;
      } else {
        stats.by_pump_support.with_pump++;
      }
    });

    if (this.vesselNetwork.size > 0) {
      stats.average_efficiency = efficiencySum / this.vesselNetwork.size;
    }

    // Leakage in last 24 hours
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    this.leakageHistory.forEach((leak) => {
      if (now - leak.timestamp <= day) {
        stats.total_leakage_24h += leak.amount;
      }
    });

    return stats;
  }

  /**
   * Get vessel efficiency by ID
   */
  getVesselEfficiency(vesselId) {
    const vessel = this.vesselNetwork.get(vesselId);
    return vessel ? vessel.efficiency : null;
  }

  /**
   * Get pump status
   */
  getPumpStatus(pumpId) {
    const pump = this.pumpNetwork.get(pumpId);
    if (!pump) return null;

    return {
      pump_id: pumpId,
      active: pump.active,
      head_gain: pump.head_gain,
      supported_vessels: pump.supported_vessels.length,
      position: pump.position
    };
  }

  /**
   * Debug: Dump pressure system state
   */
  dump() {
    return {
      network_stats: this.getNetworkStats(),
      vessels: Array.from(this.vesselNetwork.entries()).map(
        ([id, vessel]) => ({
          id,
          efficiency: vessel.efficiency,
          connections: vessel.connections.length,
          pumps: vessel.pumps_upstream.length
        })
      ),
      pumps: Array.from(this.pumpNetwork.entries()).map(([id, pump]) => ({
        id,
        active: pump.active,
        supported_vessels: pump.supported_vessels.length
      })),
      recent_leaks: this.leakageHistory.slice(-10)
    };
  }
}
