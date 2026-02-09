import { Extractor, Storage, Nucleus } from './BaseBuilding.js';

class PlacementManager {
    constructor(grid, scene, resourceManager, transportSystem, engine = null) {
        this.grid = grid;
        this.scene = scene;
        this.resourceManager = resourceManager;
        this.transportSystem = transportSystem;
        this.engine = engine;  // For registering animated materials
        
        // Event listener for building placement (fired after successful placement)
        this.onBuildingPlaced = null; // (buildingId, buildingType, gridX, gridZ) -> void
        
        this.buildings = new Map();
        this.buildingTypes = {
            EXTRACTOR: 'EXTRACTOR',
            STORAGE: 'STORAGE',
            VESSEL: 'VESSEL'
        };
    }

    /**
     * Register a callback for building placement events
     */
    onPlaced(callback) {
        this.onBuildingPlaced = callback;
        console.log('[PlacementManager] Registered onBuildingPlaced listener');
    }

    /**
     * Place an Extractor building
     * FIRES: onBuildingPlaced event
     */
    placeExtractor(gridX, gridZ, resourceType = 'ION') {
        const key = `${gridX}_${gridZ}`;
        
        if (this.buildings.has(key)) {
            console.warn(`Building already exists at ${key}`);
            return null;
        }

        const extractor = new Extractor(
            gridX, gridZ,
            this.grid,
            this.scene,
            this.resourceManager,
            this.transportSystem,
            resourceType
        );

        // Store construction cost for deconstruction refund
        extractor._buildingCost = { RES_GLUCOSE: 10 };

        // Register animated material with engine for time updates
        if (this.engine && extractor.mesh && extractor.mesh.material) {
            this.engine.registerAnimatedMaterial(extractor.mesh.material);
        }

        this.buildings.set(key, {
            type: this.buildingTypes.EXTRACTOR,
            building: extractor
        });

        // Fire building placement event
        if (this.onBuildingPlaced) {
            this.onBuildingPlaced('BLD_EXTRACTOR', this.buildingTypes.EXTRACTOR, gridX, gridZ);
        }

        console.log(`[PlacementManager] Placed EXTRACTOR at (${gridX}, ${gridZ})`);
        return extractor;
    }

    /**
     * Place a Storage building
     * FIRES: onBuildingPlaced event
     */
    placeStorage(gridX, gridZ) {
        const key = `${gridX}_${gridZ}`;
        
        if (this.buildings.has(key)) {
            console.warn(`Building already exists at ${key}`);
            return null;
        }

        const storage = new Storage(gridX, gridZ, this.grid, this.scene, this.resourceManager);

        // Store construction cost for deconstruction refund
        storage._buildingCost = { RES_GLUCOSE: 15 };

        // Register animated material with engine for time updates
        if (this.engine && storage.mesh && storage.mesh.material) {
            this.engine.registerAnimatedMaterial(storage.mesh.material);
        }

        this.buildings.set(key, {
            type: this.buildingTypes.STORAGE,
            building: storage
        });

        // Fire building placement event
        if (this.onBuildingPlaced) {
            this.onBuildingPlaced('BLD_STORAGE', this.buildingTypes.STORAGE, gridX, gridZ);
        }

        console.log(`[PlacementManager] Placed STORAGE at (${gridX}, ${gridZ})`);
        return storage;
    }

    /**
     * Place a Nucleus (main command building) - spans 5x5 cells
     * FIRES: onBuildingPlaced event
     */
    placeNucleus(gridX, gridZ) {
        const nucleusSize = 5;
        
        // Check if any cell in 5x5 area is occupied
        for (let x = gridX; x < gridX + nucleusSize; x++) {
            for (let z = gridZ; z < gridZ + nucleusSize; z++) {
                const key = `${x}_${z}`;
                if (this.buildings.has(key)) {
                    console.warn(`Building already exists in nucleus area at ${key}`);
                    return null;
                }
            }
        }

        const nucleus = new Nucleus(gridX, gridZ, this.grid, this.scene, this.resourceManager);

        // Register animated material with engine (for continuous time updates)
        if (this.engine && nucleus.mesh && nucleus.mesh.material) {
            this.engine.registerAnimatedMaterial(nucleus.mesh.material);
        }

        // Register all 5x5 cells as part of the nucleus
        for (let x = gridX; x < gridX + nucleusSize; x++) {
            for (let z = gridZ; z < gridZ + nucleusSize; z++) {
                const key = `${x}_${z}`;
                this.buildings.set(key, {
                    type: 'NUCLEUS',
                    building: nucleus
                });
            }
        }

        // Fire building placement event
        if (this.onBuildingPlaced) {
            this.onBuildingPlaced('BLD_NUCLEUS', 'NUCLEUS', gridX, gridZ);
        }

        console.log(`[PlacementManager] Placed NUCLEUS at (${gridX}, ${gridZ})`);
        return nucleus;
    }

    /**
     * Place a Bio-Vessel (conveyor belt)
     */
    placeVessel(gridX, gridZ, direction) {
        const vessel = this.transportSystem.placeVessel(gridX, gridZ, direction, this.scene);
        
        if (vessel) {
            const key = `${gridX}_${gridZ}`;
            this.buildings.set(key, {
                type: this.buildingTypes.VESSEL,
                building: vessel
            });
        }

        return vessel;
    }

    /**
     * Create a demo factory: 6x6 Pluripotent Nucleus at [25, 25]
     */
    createDemoFactory() {
        // Main Nucleus at [22, 22] - spans 5x5 cells [22,22] to [26,26]
        const nucleus = this.placeNucleus(22, 22);

        console.log('✓ Demo factory created:');
        console.log('  Pluripotent Nucleus (5x5) at [22,22] → [26,26]');
        console.log(`  Total building registrations: ${this.buildings.size}`);
    }

    /**
     * Update all active buildings
     */
    update(deltaTime) {
        this.buildings.forEach(({ building }) => {
            if (building && building.isActive) {
                building.update(deltaTime);
            }
        });
    }

    /**
     * Get building at grid position
     */
    getBuildingAt(gridX, gridZ) {
        const key = `${gridX}_${gridZ}`;
        const entry = this.buildings.get(key);
        return entry ? entry.building : null;
    }

    /**
     * Update shader profile for all buildings
     */
    updateAllBuildingsShaderProfile() {
        let updatedCount = 0;
        
        this.buildings.forEach(({ building }) => {
            // Update Nucleus buildings
            if (building instanceof Nucleus && building.updateShaderProfile) {
                building.updateShaderProfile();
                updatedCount++;
            }
            // Add updates for other building types here as needed
        });
        
        console.log(`[PlacementManager] Updated shader profile for ${updatedCount} buildings`);
        return updatedCount;
    }

    /**
     * Setup event listener for shader profile changes
     */
    setupShaderProfileListener() {
        window.addEventListener('shaderProfileChanged', (event) => {
            console.log(`[PlacementManager] Shader profile changed event received`);
            this.updateAllBuildingsShaderProfile();
        });
        
        console.log('[PlacementManager] Shader profile listener setup complete');
    }

    /**
     * Get statistics about placed buildings
     */
    getStats() {
        const stats = {
            totalBuildings: this.buildings.size,
            extractors: 0,
            storage: 0,
            vessels: 0
        };

        this.buildings.forEach(({ type }) => {
            if (type === this.buildingTypes.EXTRACTOR) stats.extractors++;
            if (type === this.buildingTypes.STORAGE) stats.storage++;
            if (type === this.buildingTypes.VESSEL) stats.vessels++;
        });

        return stats;
    }

    /**
     * Deconstruct all selected buildings (Cell Death)
     * Returns resources and removes buildings
     * NOTE: Pluripotent Nucleus (main nucleus) cannot be deconstructed
     */
    deconstuctSelectedBuildings() {
        let deconstructCount = 0;
        const keysToRemove = [];
        const resourcesReturned = {};

        // Find all selected buildings (excluding Nucleus)
        this.buildings.forEach(({ building }, key) => {
            if (building && building._isSelected) {
                // Check if building is a Pluripotent Nucleus - cannot deconstruct
                if (building.isMainBuilding || building.bioId === 'BLD_NUCLEUS_MAIN') {
                    console.warn(`[PlacementManager] Cannot deconstruct Pluripotent Nucleus - it is indestructible`);
                    return; // Skip this building
                }
                keysToRemove.push(key);
            }
        });

        // Remove them from scene and map, return their resources
        keysToRemove.forEach(key => {
            const { building } = this.buildings.get(key);
            if (building) {
                // Return construction cost resources
                const cost = building._buildingCost || { RES_GLUCOSE: 5 }; // Default cost
                for (const [resourceType, amount] of Object.entries(cost)) {
                    if (!resourcesReturned[resourceType]) {
                        resourcesReturned[resourceType] = 0;
                    }
                    resourcesReturned[resourceType] += amount;
                }

                // Remove from scene
                if (building.mesh && this.scene) {
                    this.scene.remove(building.mesh);
                }
                if (building.cellIndicator && this.scene) {
                    this.scene.remove(building.cellIndicator);
                }

                // Call destroy if available
                if (building.destroy) {
                    building.destroy();
                }

                this.buildings.delete(key);
                deconstructCount++;
                console.log(`[PlacementManager] Deconstructed building at ${key}, returned: ${JSON.stringify(cost)}`);
            }
        });

        // Log total resources returned
        if (deconstructCount > 0) {
            console.log(`[PlacementManager] ✓ Deconstructed ${deconstructCount} buildings, returned: ${JSON.stringify(resourcesReturned)}`);
        }

        return deconstructCount;
    }

    clear() {
        this.buildings.forEach(({ building }) => building.destroy());
        this.buildings.clear();
    }
}

export default PlacementManager;
