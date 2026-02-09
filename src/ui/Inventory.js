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
        
        // Resource inventory
        this.resources = {
            glucose: { name: 'Glucose', amount: 0, icon: '🍯', unit: 'mg/dL' },
            oxygen: { name: 'Oxygen', amount: 0, icon: '💨', unit: '%' },
            atp: { name: 'ATP', amount: 0, icon: '⚡', unit: 'μmol' },
            lactate: { name: 'Lactate', amount: 0, icon: '☒', unit: 'mmol' },
            lipid: { name: 'Lipid', amount: 0, icon: '◆', unit: 'mg/dL' }
        };

        // Building catalog (with data-driven defaults from BioDatabase)
        this.buildings = this._initializeBuildingsFromDatabase();
    }

    /**
     * Initialize building catalog from BioDatabase
     * Maps database entries to UI building keys
     */
    _initializeBuildingsFromDatabase() {
        const buildings = {};
        
        // Build mapping: key -> {name, cost, buildTime, ...}
        const BUILDING_MAP = {
            'extractor': 'BLD_EXTRACTOR',
            'vessel': null,  // Not in BioDatabase yet
            'mitochondria': 'BLD_MITOCHONDRIA', 
            'cytosol': null, // Not in BioDatabase
            'storage': null, // Not in BioDatabase
            'defender': null // Not in BioDatabase
        };
        
        // First pass: read from BioDatabase
        for (const [uiKey, dbId] of Object.entries(BUILDING_MAP)) {
            if (!dbId) continue;
            
            const dbEntry = this.database.buildings?.find(b => b.id === dbId);
            if (dbEntry) {
                buildings[uiKey] = {
                    name: dbEntry.name,
                    type: uiKey,
                    description: dbEntry.description,
                    category: dbEntry.category || 'Building',
                    icon: dbEntry.icon,
                    hotkey: this._mapHotkey(uiKey),
                    cost: dbEntry.cost || {},
                    buildTime: dbEntry.buildTime || 10,
                    dbEntry // Keep reference for future use
                };
            }
        }
        
        // Second pass: add defaults for buildings not yet in database
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
