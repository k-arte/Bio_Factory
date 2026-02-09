/**
 * Inventory: Pure data store for resources and buildings
 * Now reads from BioDatabase as Source of Truth for building costs/properties
 * No DOM manipulation - HUD_NEW.js handles all UI updates
 */
import BioDatabase from '../data/BioDatabase.js';

class Inventory {
    constructor(hud) {
        this.hud = hud;
        this.database = BioDatabase;
        this.onResourceChange = null; // Callback: function(resourceType, newAmount)
        this.onBuildingChange = null; // Callback: function(buildingKey, newState)
        
        // Resource inventory with starting amounts
        this.resources = {
            glucose: { name: 'Glucose', amount: 100, icon: '🍯', unit: 'mg/dL' },
            oxygen: { name: 'Oxygen', amount: 100, icon: '💨', unit: '%' },
            atp: { name: 'ATP', amount: 50, icon: '⚡', unit: 'μmol' },
            lactate: { name: 'Lactate', amount: 0, icon: '☒', unit: 'mmol' },
            lipid: { name: 'Lipid', amount: 0, icon: '◆', unit: 'mg/dL' }
        };

        // Building catalog (with data-driven defaults from BioDatabase)
        this.buildings = this._initializeBuildingsFromDatabase();
    }

    /**
     * Initialize building catalog from BioDatabase
     * Maps database entries to UI building keys and also adds BioDatabase IDs as keys
     */
    _initializeBuildingsFromDatabase() {
        const buildings = {};
        
        // Legacy mapping: UI key -> BioDatabase ID (for backward compatibility)
        const BUILDING_MAP = {
            'extractor': 'BLD_PERICYTE_EXTRACTOR',
            'vessel': 'BLD_VESSEL',
            'mitochondria': null, 
            'cytosol': null,
            'storage': 'BLD_STORAGE_MICRO',
            'defender': null
        };
        
        // Default costs for buildings if not specified in database
        const DEFAULT_COSTS = {
            'BLD_PERICYTE_EXTRACTOR': { glucose: 10 },
            'BLD_ANABOLIC_CELL': { glucose: 15 },
            'BLD_SPONGE_CELL': { glucose: 20 },
            'BLD_RESOURCE_DIFFUSER': { glucose: 25 },
            'BLD_STORAGE_MICRO': { glucose: 15 },
            'BLD_VESSEL': { glucose: 5 },
            'BLD_CARDIOCYTE_PUMP': { glucose: 30 }
        };
        
        // First pass: Add all BioDatabase buildings with their IDs as keys
        if (this.database.buildings && Array.isArray(this.database.buildings)) {
            this.database.buildings.forEach((dbBuilding) => {
                const buildingData = {
                    name: dbBuilding.name,
                    type: dbBuilding.id,
                    databaseId: dbBuilding.id,
                    description: dbBuilding.description || '',
                    category: dbBuilding.category || 'Building',
                    icon: dbBuilding.icon || '🏢',
                    hotkey: '0',
                    cost: dbBuilding.cost || DEFAULT_COSTS[dbBuilding.id] || { glucose: 10 },
                    buildTime: dbBuilding.buildTime || 10,
                    dbEntry: dbBuilding
                };
                
                // Add with BioDatabase ID as key
                buildings[dbBuilding.id] = buildingData;
                
                console.log(`[Inventory] Added BioDatabase building: ${dbBuilding.id} (${dbBuilding.name})`);
            });
        }
        
        // Second pass: Add backward compatibility keys (UI keys like 'extractor', 'storage')
        for (const [uiKey, dbId] of Object.entries(BUILDING_MAP)) {
            if (dbId && buildings[dbId]) {
                // Point the UI key to the same building data as the database ID
                // But only if not already defined
                if (!buildings[uiKey]) {
                    buildings[uiKey] = {
                        ...buildings[dbId],
                        type: uiKey // Override type to UI key for legacy compatibility
                    };
                }
            }
        }
        
        // Third pass: add defaults for UI buildings not yet in database
        const defaults = {
            extractor: {
                name: 'Extractor',
                type: 'extractor',
                description: 'Extracts resources from terrain',
                category: 'Extraction',
                icon: '⛏️',
                hotkey: '1',
                cost: { glucose: 10 },
                buildTime: 5
            },
            vessel: {
                name: 'Vessel (Pipe)',
                type: 'vessel',
                description: 'Transports resources. Auto-connects.',
                category: 'Logistics',
                icon: '━',
                hotkey: '2',
                cost: { glucose: 5 },
                buildTime: 2
            },
            mitochondria: {
                name: 'Mitochondria',
                type: 'mitochondria',
                description: 'Converts Glucose + O2 to ATP (Energy)',
                category: 'Processing',
                icon: '◆',
                hotkey: '3',
                cost: { glucose: 20 },
                buildTime: 10
            },
            cytosol: {
                name: 'Cytosol Vat',
                type: 'cytosol',
                description: 'Anaerobic processing. Creates Lactate.',
                category: 'Processing',
                icon: '⊞',
                hotkey: '4',
                cost: { glucose: 15 },
                buildTime: 8
            },
            storage: {
                name: 'Storage',
                type: 'storage',
                description: 'Stores resources safely',
                category: 'Extraction',
                icon: '█',
                hotkey: '5',
                cost: { glucose: 25 },
                buildTime: 12
            },
            defender: {
                name: 'Immune Cell',
                type: 'defender',
                description: 'Attacks pathogens',
                category: 'Defense',
                icon: '◇',
                hotkey: '6',
                cost: { atp: 10 },
                buildTime: 8
            }
        };
        
        // Fill in missing buildings from defaults
        for (const [key, defaultData] of Object.entries(defaults)) {
            if (!buildings[key]) {
                buildings[key] = defaultData;
            }
        }
        
        console.log('[Inventory] Initialized', Object.keys(buildings).length, 'buildings from BioDatabase');
        return buildings;
    }

    /**
     * Map building UI key to hotkey number
     */
    _mapHotkey(buildingKey) {
        const hotkeyMap = {
            'extractor': '1',
            'vessel': '2',
            'mitochondria': '3',
            'cytosol': '4',
            'storage': '5',
            'defender': '6'
        };
        return hotkeyMap[buildingKey] || '0';
    }

    /**
     * Update resource amount and trigger callback
     * @param {string} resourceType - Resource key (e.g., 'glucose')
     * @param {number} amount - New amount
     */
    updateResource(resourceType, amount) {
        if (this.resources[resourceType]) {
            this.resources[resourceType].amount = amount;
            // Trigger callback so HUD can update UI
            if (this.onResourceChange) {
                this.onResourceChange(resourceType, amount);
            }
        }
    }

    /**
     * Get all resources as a map
     */
    getResources() {
        const result = {};
        Object.entries(this.resources).forEach(([key, resource]) => {
            result[key] = resource.amount;
        });
        return result;
    }

    /**
     * Check if player can afford a building
     */
    canAfford(buildingKey) {
        const building = this.buildings[buildingKey];
        if (!building) return false;

        for (const [resourceType, cost] of Object.entries(building.cost)) {
            if (!this.resources[resourceType] || this.resources[resourceType].amount < cost) {
                return false;
            }
        }
        return true;
    }

    /**
     * Deduct resource cost for building
     */
    deductCost(buildingKey) {
        const building = this.buildings[buildingKey];
        if (!building) return false;

        // Check if affordable first
        if (!this.canAfford(buildingKey)) return false;

        // Deduct resources
        for (const [resourceType, cost] of Object.entries(building.cost)) {
            const newAmount = this.resources[resourceType].amount - cost;
            this.updateResource(resourceType, newAmount);
        }
        return true;
    }

    /**
     * Get building by hotkey
     */
    getBuildingByHotkey(hotkey) {
        for (const [buildingKey, building] of Object.entries(this.buildings)) {
            if (building.hotkey === hotkey) {
                return buildingKey;
            }
        }
        return null;
    }

    /**
     * Get building data by key
     */
    getBuilding(buildingKey) {
        return this.buildings[buildingKey] || null;
    }

    /**
     * Format cost string (e.g., "10 glucose + 5 atp")
     */
    getCostString(cost) {
        return Object.entries(cost)
            .map(([resourceType, amount]) => {
                const resource = this.resources[resourceType];
                const name = resource ? resource.name : resourceType;
                return `${amount} ${name}`;
            })
            .join(', ');
    }
}

export default Inventory;
