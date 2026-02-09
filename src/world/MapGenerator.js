import BioDatabase from '../data/BioDatabase.js';
import ProgressionManager from '../systems/ProgressionManager.js';

/**
 * MapGenerator: Procedural structure placement system
 * 
 * Generates organ structures (functional units) on the map based on biomes and unlock conditions.
 * - Structures include Capillary Beds, Mitochondrial Factories, Lysosomes, etc.
 * - Each biome gets 5-20 structures placed procedurally
 * - Considers unlock conditions from BioDatabase
 */
class MapGenerator {
    constructor(grid, scene) {
        this.grid = grid;
        this.scene = scene;
        this.database = BioDatabase;
        this.progressionManager = null; // Will be set later
        
        // Track placed structures
        this.structures = new Map(); // gridX_gridZ -> structure data
        this.biomeMap = new Map(); // gridX_gridZ -> biome type
        
        // Biome definitions
        this.biomes = {
            ENDOTHELIUM: {
                terrainColor: 0x00bb44,
                structures: ['STR_CAPILLARY_BED'],
                count_min: 5,
                count_max: 15
            },
            CYTOPLASM: {
                terrainColor: 0x4a90e2,
                structures: ['STR_MITOCHONDRIAL_FACTORY', 'STR_LYSOSOME_ARRAY', 'STR_ENDOPLASMIC_FACTORY'],
                count_min: 8,
                count_max: 20
            }
        };
        
        console.log('[MapGenerator] Initialized');
    }

    /**
     * Set the progression manager for unlock checks
     */
    setProgressionManager(progressionManager) {
        this.progressionManager = progressionManager;
    }

    /**
     * Generate the entire map with structures
     */
    generateMap() {
        console.log('[MapGenerator] Generating map with structures...');
        
        // Get grid dimensions
        const gridSize = this.grid.gridSize || 50;
        
        // Divide map into biomes
        const biomeNodes = this._generateBiomeLayout(gridSize);
        
        // Place structures in each biome
        for (const biomeNode of biomeNodes) {
            this._populateBiome(biomeNode);
        }
        
        console.log(`[MapGenerator] ✓ Map generated with ${this.structures.size} structures`);
        return {
            structures: this.structures,
            biomeMap: this.biomeMap,
            stats: this.getStats()
        };
    }

    /**
     * Generate biome layout (procedural division of map)
     */
    _generateBiomeLayout(gridSize) {
        const biomeNodes = [];
        
        // Simple 2x2 biome grid for now
        const regions = [
            {
                name: 'ENDOTHELIUM',
                minX: 0,
                maxX: Math.floor(gridSize / 2),
                minZ: 0,
                maxZ: Math.floor(gridSize / 2)
            },
            {
                name: 'CYTOPLASM',
                minX: Math.floor(gridSize / 2),
                maxX: gridSize - 1,
                minZ: 0,
                maxZ: Math.floor(gridSize / 2)
            },
            {
                name: 'CYTOPLASM',
                minX: 0,
                maxX: Math.floor(gridSize / 2),
                minZ: Math.floor(gridSize / 2),
                maxZ: gridSize - 1
            },
            {
                name: 'ENDOTHELIUM',
                minX: Math.floor(gridSize / 2),
                maxX: gridSize - 1,
                minZ: Math.floor(gridSize / 2),
                maxZ: gridSize - 1
            }
        ];
        
        return regions;
    }

    /**
     * Populate a single biome with structures
     */
    _populateBiome(biomeNode) {
        const biomeName = biomeNode.name;
        const biomeConfig = this.biomes[biomeName];
        
        if (!biomeConfig) {
            console.warn(`[MapGenerator] Unknown biome: ${biomeName}`);
            return;
        }
        
        // Determine how many structures to place
        const count = Math.floor(
            Math.random() * (biomeConfig.count_max - biomeConfig.count_min + 1) + biomeConfig.count_min
        );
        
        console.log(`[MapGenerator] Populating ${biomeName} with ${count} structures`);
        
        let placed = 0;
        const attempts = count * 5; // Try multiple times
        
        for (let attempt = 0; attempt < attempts && placed < count; attempt++) {
            // Random cell in biome
            const gridX = Math.floor(
                Math.random() * (biomeNode.maxX - biomeNode.minX + 1) + biomeNode.minX
            );
            const gridZ = Math.floor(
                Math.random() * (biomeNode.maxZ - biomeNode.minZ + 1) + biomeNode.minZ
            );
            
            // Pick random structure for this biome
            const structureId = biomeConfig.structures[
                Math.floor(Math.random() * biomeConfig.structures.length)
            ];
            
            // Try to place it
            if (this._placeStructure(gridX, gridZ, structureId, biomeName)) {
                placed++;
            }
        }
        
        console.log(`[MapGenerator] Successfully placed ${placed} structures in ${biomeName}`);
    }

    /**
     * Place a single structure at grid position
     */
    _placeStructure(gridX, gridZ, structureId, biomeName) {
        // Check if already occupied
        const key = `${gridX}_${gridZ}`;
        if (this.structures.has(key)) {
            return false;
        }
        
        // Get structure definition
        const structureConfig = this.database.structures.find(s => s.id === structureId);
        if (!structureConfig) {
            console.warn(`[MapGenerator] Unknown structure: ${structureId}`);
            return false;
        }
        
        // Check unlock condition
        if (structureConfig.unlock_condition && this.progressionManager) {
            if (!this.progressionManager.isUnlocked(structureId)) {
                return false; // Structure is locked
            }
        }
        
        // Create structure instance
        const structure = {
            id: structureId,
            gridX,
            gridZ,
            biome: biomeName,
            name: structureConfig.name,
            icon: structureConfig.icon,
            
            // Health and state system
            maxHealth: structureConfig.health,
            currentHealth: structureConfig.health,
            state: 'HEALTHY',
            
            // Damage tracker
            damageTaken: 0,
            repaired: false,
            
            // Config reference
            config: structureConfig,
            
            // Creation timestamp
            createdAt: Date.now()
        };
        
        // Store in map
        this.structures.set(key, structure);
        this.biomeMap.set(key, biomeName);
        
        console.log(`[MapGenerator] ✓ Placed ${structureConfig.name} at [${gridX}, ${gridZ}]`);
        return true;
    }

    /**
     * Get a structure at grid coordinates
     */
    getStructureAt(gridX, gridZ) {
        const key = `${gridX}_${gridZ}`;
        return this.structures.get(key);
    }

    /**
     * Apply damage to a structure and check for broken state
     */
    damageStructure(gridX, gridZ, damage) {
        const structure = this.getStructureAt(gridX, gridZ);
        if (!structure) return null;
        
        structure.damageTaken += damage;
        structure.currentHealth -= damage;
        
        // Check if should break
        if (structure.currentHealth <= 0 && structure.state === 'HEALTHY') {
            this._breakStructure(structure);
        }
        
        return structure;
    }

    /**
     * Transition structure to BROKEN state and apply systemic modifiers
     */
    _breakStructure(structure) {
        structure.state = 'BROKEN';
        structure.currentHealth = 0;
        
        const brokenConfig = structure.config.states.BROKEN;
        
        console.log(`[MapGenerator] ⚠️ STRUCTURE BROKEN: ${structure.name} at [${structure.gridX}, ${structure.gridZ}]`);
        console.log(`    Applying systemic modifiers:`, brokenConfig.effects);
        
        // Apply systemic effects (would be connected to game systems)
        // Format: [{ type: "SYSTEM_MOD", stat: "SYS_TOXICITY", modifier: 0.5 }, ...]
        return {
            structure,
            effects: brokenConfig.effects,
            repairCost: brokenConfig.repair_cost,
            repairTime: brokenConfig.repair_time
        };
    }

    /**
     * Repair a broken structure
     */
    repairStructure(gridX, gridZ, resources = {}) {
        const structure = this.getStructureAt(gridX, gridZ);
        if (!structure || structure.state !== 'BROKEN') {
            return null;
        }
        
        const brokenConfig = structure.config.states.BROKEN;
        const repairCost = brokenConfig.repair_cost;
        
        // Check if we have resources
        let canRepair = true;
        for (const [resourceId, amount] of Object.entries(repairCost)) {
            if (!resources[resourceId] || resources[resourceId] < amount) {
                canRepair = false;
                break;
            }
        }
        
        if (!canRepair) {
            console.warn(`[MapGenerator] Insufficient resources to repair structure`);
            return null;
        }
        
        // Perform repair
        structure.state = 'HEALTHY';
        structure.currentHealth = structure.maxHealth;
        structure.damageTaken = 0;
        structure.repaired = true;
        
        console.log(`[MapGenerator] ✓ STRUCTURE REPAIRED: ${structure.name}`);
        
        return {
            structure,
            resourcesUsed: repairCost
        };
    }

    /**
     * Get all structures in a biome
     */
    getStructuresByBiome(biomeName) {
        const biomeStructures = [];
        
        for (const [key, structure] of this.structures) {
            if (structure.biome === biomeName) {
                biomeStructures.push(structure);
            }
        }
        
        return biomeStructures;
    }

    /**
     * Get all broken structures
     */
    getBrokenStructures() {
        const brokenStructures = [];
        
        for (const [key, structure] of this.structures) {
            if (structure.state === 'BROKEN') {
                brokenStructures.push(structure);
            }
        }
        
        return brokenStructures;
    }

    /**
     * Get all structures (for debugging)
     */
    getAllStructures() {
        return Array.from(this.structures.values());
    }

    /**
     * Get map statistics
     */
    getStats() {
        const stats = {
            totalStructures: this.structures.size,
            byBiome: {},
            byType: {},
            broken: 0,
            healthy: 0
        };
        
        for (const [key, structure] of this.structures) {
            // By biome
            if (!stats.byBiome[structure.biome]) {
                stats.byBiome[structure.biome] = 0;
            }
            stats.byBiome[structure.biome]++;
            
            // By type
            if (!stats.byType[structure.name]) {
                stats.byType[structure.name] = 0;
            }
            stats.byType[structure.name]++;
            
            // State counts
            if (structure.state === 'BROKEN') {
                stats.broken++;
            } else {
                stats.healthy++;
            }
        }
        
        return stats;
    }

    /**
     * Debug: Print all structures
     */
    debugPrintStructures() {
        console.group('[MapGenerator] Structure List');
        
        for (const [key, structure] of this.structures) {
            console.log(
                `[${key}] ${structure.icon} ${structure.name} @ ${structure.biome} | ` +
                `Health: ${structure.currentHealth}/${structure.maxHealth} | ` +
                `State: ${structure.state}`
            );
        }
        
        console.groupEnd();
    }
}

export default MapGenerator;
