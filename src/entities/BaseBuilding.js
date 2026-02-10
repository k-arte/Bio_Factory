import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import shaderProfileManager from '../core/ShaderProfileManager.js';
import BioShader from '../shaders/BioShader.js';
import { applyAnimationProfile } from '../shaders/AnimationProfile.js';
import { COLORS } from '../data/Colors.js';
import BioDatabase from '../data/BioDatabase.js';

/**
 * Structure: Represents a functional unit within an organ
 * Can be damaged and broken, applies systemic effects when broken
 */
class Structure {
    constructor(structureData, grid, scene) {
        this.structureData = structureData; // From MapGenerator
        this.grid = grid;
        this.scene = scene;
        
        // Health and state
        this.maxHealth = structureData.maxHealth;
        this.currentHealth = structureData.currentHealth;
        this.state = structureData.state; // HEALTHY or BROKEN
        this.damageTaken = structureData.damageTaken;
        
        // Position
        const worldPos = grid.getWorldPosition(structureData.gridX, structureData.gridZ);
        this.position = worldPos.clone();
        this.gridX = structureData.gridX;
        this.gridZ = structureData.gridZ;
        
        // Visual representation
        this.mesh = null;
        this.isActive = true;
        
        // Create visual mesh
        this._createVisualization();
    }

    /**
     * Create 3D representation of structure
     */
    _createVisualization() {
        // Base geometry (simple sphere for now)
        const size = 0.3;
        const geometry = new THREE.SphereGeometry(size, 16, 16);
        
        // Color based on state
        const color = this.state === 'BROKEN' ? COLORS.STRUCTURE_BROKEN : COLORS.STRUCTURE_HEALTHY;
        
        const material = new THREE.MeshStandardMaterial({
            color,
            emissive: color,
            emissiveIntensity: this.state === 'BROKEN' ? 0.5 : 0.1,
            metalness: 0.3,
            roughness: 0.4
        });
        
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.userData.structure = this;
        
        this.scene.add(this.mesh);
    }

    /**
     * Apply damage to structure
     */
    takeDamage(amount) {
        this.currentHealth = Math.max(0, this.currentHealth - amount);
        this.damageTaken += amount;
        
        // Check for broken state transition
        if (this.currentHealth <= 0 && this.state === 'HEALTHY') {
            this.break();
        }
        
        return this;
    }

    /**
     * Transition to broken state
     */
    break() {
        this.state = 'BROKEN';
        this.currentHealth = 0;
        
        // Update visual
        if (this.mesh) {
            this.mesh.material.emissive.setHex(COLORS.STRUCTURE_BROKEN);
            this.mesh.material.emissiveIntensity = 0.5;
        }
        
        console.log(`[Structure] ⚠️ ${this.structureData.name} BROKEN at [${this.gridX}, ${this.gridZ}]`);
        
        return this.getBrokenEffects();
    }

    /**
     * Get effects that apply when this structure is broken
     */
    getBrokenEffects() {
        if (this.state !== 'BROKEN') return null;
        
        const brokenConfig = this.structureData.config.states.BROKEN;
        return {
            structure: this,
            effects: brokenConfig.effects,
            repairCost: brokenConfig.repair_cost,
            repairTime: brokenConfig.repair_time
        };
    }

    /**
     * Repair this broken structure
     */
    repair(resources = {}) {
        if (this.state !== 'BROKEN') {
            return null;
        }
        
        const brokenConfig = this.structureData.config.states.BROKEN;
        const repairCost = brokenConfig.repair_cost;
        
        // Check resources
        for (const [resourceId, amount] of Object.entries(repairCost)) {
            if (!resources[resourceId] || resources[resourceId] < amount) {
                console.warn(`[Structure] Insufficient ${resourceId} to repair`);
                return null;
            }
        }
        
        // Perform repair
        this.state = 'HEALTHY';
        this.currentHealth = this.maxHealth;
        this.damageTaken = 0;
        
        // Update visual
        if (this.mesh) {
            this.mesh.material.emissive.setHex(COLORS.STRUCTURE_HEALTHY);
            this.mesh.material.emissiveIntensity = 0.1;
        }
        
        console.log(`[Structure] ✓ ${this.structureData.name} REPAIRED`);
        
        return {
            structure: this,
            resourcesUsed: repairCost
        };
    }

    /**
     * Get health percentage
     */
    getHealthPercent() {
        return Math.round((this.currentHealth / this.maxHealth) * 100);
    }

    /**
     * Destroy structure and clean up
     */
    destroy() {
        if (this.mesh && this.scene) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
        }
        this.isActive = false;
    }

    /**
     * Get status display text
     */
    getStatusText() {
        const health = this.getHealthPercent();
        const healthColor = health > 50 ? '#00ff00' : health > 25 ? '#ffff00' : '#ff0000';
        
        return `
            ${this.structureData.icon} ${this.structureData.name}<br>
            State: <span style="color: ${this.state === 'BROKEN' ? '#ff0000' : '#00ff00'};">${this.state}</span><br>
            Health: <span style="color: ${healthColor};">${this.currentHealth}/${this.maxHealth}</span>
        `;
    }
}

class BaseBuilding {
    constructor(gridX, gridZ, grid, scene) {
        this.gridX = gridX;
        this.gridZ = gridZ;
        this.grid = grid;
        this.scene = scene;
        this.mesh = null;
        this.cellIndicator = null;
        this.isActive = true;

        const worldPos = grid.getWorldPosition(gridX, gridZ);
        this.position = worldPos.clone();
        
        // ATP System (Energy lifecycle)
        this.currentATP = 0;          // Current ATP stored
        this.maxATP = 100;            // Capacity (overridden by BioDatabase)
        this.atpConsumption = 0;      // ATP/min cost
        this.atpProduction = 0;       // ATP/min output (only for generator buildings)
        this.isStalled = false;       // True when ATP > capacity
        this.stallOutline = null;     // Visual indicator for stall (yellow-orange)
        
        // Create a visual indicator showing the grid cell this building occupies
        this._createCellIndicator();
    }
    
    /**
     * Update ATP state (call every frame or on resource update)
     * Returns true if ATP changed from non-stalled to stalled (needs visual update)
     */
    updateATP(deltaTime = 1/60) {
        const timeFactor = deltaTime; // seconds to minutes conversion
        
        // Apply consumption and production
        const netChange = (this.atpProduction - this.atpConsumption) * timeFactor;
        this.currentATP = Math.max(0, this.currentATP + netChange);
        
        // Check for overflow (stall condition)
        const wasStalled = this.isStalled;
        this.isStalled = this.currentATP > this.maxATP;
        
        // Update visual indicator if stall state changed
        this.updateStallOutlineVisibility();
        
        // Return true if stall state changed
        return wasStalled !== this.isStalled;
    }

    /**
     * Get ATP normalized (0-1) for UI display
     */
    getATPRatio() {
        return Math.max(0, Math.min(1, this.currentATP / this.maxATP));
    }

    /**
     * Consume ATP (e.g., for building operations)
     * Returns actual amount consumed
     */
    consumeATP(amount) {
        const actually = Math.min(amount, this.currentATP);
        this.currentATP -= actually;
        return actually;
    }

    /**
     * Produce ATP (from recipes or ambient)
     */
    produceATP(amount) {
        this.currentATP += amount;
        // Note: stall check happens in updateATP()
    }

    /**
     * Set ATP capacity and load from BioDatabase config
     */
    loadFromBioDatabaseConfig(dbEntry) {
        if (!dbEntry) return;
        
        this.maxATP = dbEntry.atp_capacity || 100;
        this.atpConsumption = dbEntry.atp_consumption_per_minute || 0;
        this.atpProduction = dbEntry.atp_production_per_minute || 0;
    }
    
    /**
     * Create a visual indicator plane on the ground showing this building's grid cell
     */
    _createCellIndicator() {
        const geometry = new THREE.PlaneGeometry(0.9, 0.9);
        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.2,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        
        this.cellIndicator = new THREE.Mesh(geometry, material);
        this.cellIndicator.position.copy(this.position);
        this.cellIndicator.position.y = 0.005; // Just above ground
        this.cellIndicator.rotation.x = -Math.PI / 2;
        this.cellIndicator.name = `BuildingCell_[${this.gridX},${this.gridZ}]`;
        
        this.scene.add(this.cellIndicator);
    }

    createMesh(geometry, color) {
        // Use BioShader for all buildings (not just Nucleus)
        const material = new BioShader(false, new THREE.Vector3(1, 2, 1).normalize());
        material.uniforms.baseColor.value.setHex(color);
        
        // Apply building animation profile (moderate pulse + some stiffness)
        applyAnimationProfile(material, 'building');

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(this.position);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.building = this;

        return mesh;
    }

    /**
     * Create black outline for any mesh (toon effect)
     * @param {THREE.Geometry|THREE.BufferGeometry} geometry - The geometry to create outline from
     * @param {number} scale - Scale factor for outline (default 1.02 = 2% larger)
     */
    createOutlineForMesh(geometry, scale = 1.02) {
        if (!this.mesh) return;

        const outlineGeometry = geometry.clone();
        const outlineMaterial = new THREE.MeshBasicMaterial({
            color: COLORS.OUTLINE_BLACK,
            side: THREE.BackSide,
            wireframe: false
        });

        this.outlineMesh = new THREE.Mesh(outlineGeometry, outlineMaterial);
        this.outlineMesh.position.copy(this.mesh.position);
        this.outlineMesh.scale.set(scale, scale, scale);
        this.outlineMesh.name = `Outline_${this.mesh.name || 'building'}`;

        this.scene.add(this.outlineMesh);
    }

    /**
     * Create yellow-orange stall indicator outline
     * Shown when ATP > capacity (building is stalled)
     */
    createStallOutline(geometry) {
        if (!this.mesh) return;

        const stallGeometry = geometry.clone();
        const stallMaterial = new THREE.MeshBasicMaterial({
            color: 0xFFA500,  // Orange-yellow
            side: THREE.BackSide,
            wireframe: false,
            transparent: true,
            opacity: 0.6
        });

        this.stallOutline = new THREE.Mesh(stallGeometry, stallMaterial);
        this.stallOutline.position.copy(this.mesh.position);
        this.stallOutline.scale.set(1.06, 1.06, 1.06);  // Slightly larger than black outline
        this.stallOutline.name = `StallOutline_${this.mesh.name || 'building'}`;
        this.stallOutline.visible = false;  // Hidden by default

        this.scene.add(this.stallOutline);
    }

    /**
     * Update stall outline visibility based on isStalled state
     */
    updateStallOutlineVisibility() {
        if (this.stallOutline) {
            this.stallOutline.visible = this.isStalled;
        }
    }

    update(deltaTime) {
        // Override in subclasses
    }

    destroy() {
        if (this.mesh && this.scene) {
            this.scene.remove(this.mesh);
        }
        if (this.outlineMesh && this.scene) {
            this.scene.remove(this.outlineMesh);
        }
        if (this.cellIndicator && this.scene) {
            this.scene.remove(this.cellIndicator);
        }
        this.isActive = false;
    }

    /**
     * Return status text for UI display
     */
    getStatusText() {
        return 'Status: Active';
    }
}

class Extractor extends BaseBuilding {
    constructor(gridX, gridZ, grid, scene, resourceManager, transportSystem, resourceType = 'ION') {
        super(gridX, gridZ, grid, scene);
        
        this.resourceManager = resourceManager;
        this.transportSystem = transportSystem;
        this.resourceType = resourceType;
        
        // Link to BioDatabase entry
        this.bioId = 'BLD_PERICYTE_EXTRACTOR';
        this.name = 'Pericyte Extractor';
        this.icon = '⚙️';
        
        // Load ATP config from BioDatabase
        const dbEntry = BioDatabase.buildings.find(b => b.id === this.bioId);
        if (dbEntry) this.loadFromBioDatabaseConfig(dbEntry);
        else {
            // Fallback
            this.maxATP = 100;
            this.atpConsumption = 5;
            this.atpProduction = 12;
        }
        
        // Generate resource every 2 seconds
        this.generationRate = 2.0;
        this.timeSinceLastGeneration = 0;
        this.generatedCount = 0;

        // Create mesh (pyramid - biological extraction node)
        const geometry = new THREE.ConeGeometry(0.4, 0.8, 4);
        this.mesh = this.createMesh(geometry, COLORS.EXTRACTOR_COLOR); // Flesh red
        this.scene.add(this.mesh);
        
        // Create black outline for toon effect
        this.createOutlineForMesh(geometry, 1.05);
        this.createStallOutline(geometry);  // Yellow-orange for ATP stall
    }

    /**
     * Generate and push resource to adjacent vessel
     */
    generateResource() {
        const worldPos = this.grid.getWorldPosition(this.gridX, this.gridZ);
        const resource = this.resourceManager.getResource(
            this.resourceType,
            this.gridX,
            this.gridZ,
            worldPos.clone()
        );

        if (resource) {
            // Try to push to adjacent vessel
            const success = this.transportSystem.pushResourceToVessel(this.gridX, this.gridZ, resource);
            if (success) {
                this.generatedCount++;
            } else {
                this.resourceManager.releaseResource(resource);
            }
        }
    }

    update(deltaTime) {
        this.timeSinceLastGeneration += deltaTime;

        if (this.timeSinceLastGeneration >= this.generationRate) {
            this.generateResource();
            this.timeSinceLastGeneration = 0;
        }
    }

    /**
     * Get status for UI display
     */
    getStatusText() {
        const rate = (1 / this.generationRate).toFixed(1);
        return `
            Status: <span style="color: #ccffcc;">ACTIVE</span><br>
            Type: ${this.resourceType}<br>
            Output: <span style="color: #ffff88;">${rate}/sec</span><br>
            Generated: ${this.generatedCount}
        `;
    }
}

class Storage extends BaseBuilding {
    constructor(gridX, gridZ, grid, scene, resourceManager) {
        super(gridX, gridZ, grid, scene);
        
        this.resourceManager = resourceManager;
        
        // Link to BioDatabase entry
        this.bioId = 'BLD_STORAGE_MICRO';
        this.name = 'Resource Storage';
        this.icon = '📦';
        
        // Load ATP config from BioDatabase
        const dbEntry = BioDatabase.buildings.find(b => b.id === this.bioId);
        if (dbEntry) this.loadFromBioDatabaseConfig(dbEntry);
        else {
            // Fallback
            this.maxATP = 60;
            this.atpConsumption = 2;
            this.atpProduction = 0;
        }
        
        this.inventory = {
            ION: 0,
            PROTEIN: 0,
            GLUCOSE: 0
        };
        this.totalStored = 0;

        // Create mesh (cube - organelle style storage)
        const geometry = new THREE.BoxGeometry(0.6, 0.6, 0.6);
        this.mesh = this.createMesh(geometry, 0x442288); // Deep purple/blue organelle
        this.scene.add(this.mesh);
        
        // Create black outline for toon effect
        this.createOutlineForMesh(geometry, 1.04);
        this.createStallOutline(geometry);  // Yellow-orange for ATP stall
    }

    /**
     * Store a resource item
     */
    storeResource(resource) {
        if (!resource || !this.inventory.hasOwnProperty(resource.type)) {
            return false;
        }

        this.inventory[resource.type]++;
        this.totalStored++;
        this.resourceManager.releaseResource(resource);

        return true;
    }

    /**
     * Get inventory count for a resource type
     */
    getCount(type) {
        return this.inventory[type] || 0;
    }

    /**
     * Get total stored
     */
    getTotalCount() {
        return this.totalStored;
    }

    update(deltaTime) {
        // Pulse based on stored items
        const scale = 1 + (this.totalStored * 0.05);
        this.mesh.scale.set(scale, scale, scale);
    }

    /**
     * Get status for UI display
     */
    getStatusText() {
        const ion = this.inventory.ION || 0;
        const protein = this.inventory.PROTEIN || 0;
        const glucose = this.inventory.GLUCOSE || 0;
        return `
            Status: <span style="color: #ccffcc;">STORING</span><br>
            Capacity: ${this.totalStored}/100<br>
            <span style="color: #00ffff;">Ion:</span> ${ion}<br>
            <span style="color: #ffff00;">Protein:</span> ${protein}<br>
            <span style="color: #ffffff;">Glucose:</span> ${glucose}
        `;
    }
}

/**
 * CatabolismCell: Worker cell that consumes glucose for energy (catabolic processes)
 * Created via StemCell mitosis - represents cellular respiration
 */
class CatabolismCell extends BaseBuilding {
    constructor(gridX, gridZ, grid, scene, resourceManager) {
        super(gridX, gridZ, grid, scene);
        
        this.resourceManager = resourceManager;
        this.isWorkerCell = true;
        this.specialization = 'CATABOLIC';
        
        // Link to BioDatabase entry (may not exist yet, use fallback)
        this.bioId = 'BLD_CATABOLISM_CELL';
        const dbEntry = BioDatabase.buildings.find(b => b.id === this.bioId);
        if (dbEntry) {
            this.loadFromBioDatabaseConfig(dbEntry);
        } else {
            // Default for catabolic worker
            this.maxATP = 100;
            this.atpConsumption = 5;
            this.atpProduction = 20;
        }
        
        // Production stats
        this.glucoseConsumption = 8;
        this.cycleTime = 3.0; // seconds per cycle
        this.timeSinceCycle = 0;
        this.cyclesCompleted = 0;
        
        // Visual: Orange/red energetic sphere
        const geometry = new THREE.SphereGeometry(0.35, 16, 16);
        this.mesh = this.createMesh(geometry, 0xFF9100);
        this.mesh.userData.cellType = 'CATABOLIC';
        this.scene.add(this.mesh);
        
        // Create black outline for toon effect
        this.createOutlineForMesh(geometry, 1.03);
        this.createStallOutline(geometry);  // Yellow-orange for ATP stall
        
        console.log(`[CatabolismCell] Created at [${gridX}, ${gridZ}]`);
    }

    /**
     * Execute catabolism cycle: glucose → ATP
     */
    catabolizeCycle() {
        this.cyclesCompleted++;
        
        // Would integrate with inventory/resource system
        // For now, just log the production
        console.log(`[CatabolismCell] Completed cycle #${this.cyclesCompleted}: ${this.glucoseConsumption} glucose → ${this.atpProduction} ATP`);
        
        return {
            glucoseConsumed: this.glucoseConsumption,
            atpProduced: this.atpProduction,
            cycleNumber: this.cyclesCompleted
        };
    }

    update(deltaTime) {
        this.timeSinceCycle += deltaTime;
        
        // Execute catabolic cycle periodically
        if (this.timeSinceCycle >= this.cycleTime) {
            this.catabolizeCycle();
            this.timeSinceCycle = 0;
            
            // Visual pulse on production
            this.mesh.scale.set(1.1, 1.1, 1.1);
            setTimeout(() => {
                if (this.mesh) this.mesh.scale.set(1, 1, 1);
            }, 100);
        }
    }

    /**
     * Get status for UI display
     */
    getStatusText() {
        const atpPerSec = (this.atpProduction / this.cycleTime).toFixed(2);
        return `
            Status: <span style="color: #ffcc00;">CATABOLIC</span><br>
            ATP/sec: <span style="color: #ffff00;">${atpPerSec}</span><br>
            Glucose/cycle: ${this.glucoseConsumption}<br>
            Cycles done: ${this.cyclesCompleted}
        `;
    }
}

/**
 * AnabolismCell: Worker cell that synthesizes proteins and structures (anabolic processes)
 * Created via StemCell mitosis - represents protein synthesis and growth
 */
class AnabolismCell extends BaseBuilding {
    constructor(gridX, gridZ, grid, scene, resourceManager) {
        super(gridX, gridZ, grid, scene);
        
        this.resourceManager = resourceManager;
        this.isWorkerCell = true;
        this.specialization = 'ANABOLIC';
        
        // Link to BioDatabase entry
        this.bioId = 'BLD_ANABOLIC_CELL';
        const dbEntry = BioDatabase.buildings.find(b => b.id === this.bioId);
        if (dbEntry) this.loadFromBioDatabaseConfig(dbEntry);
        else {
            // Fallback
            this.maxATP = 100;
            this.atpConsumption = 8;
            this.atpProduction = 15;
        }
        
        // Production stats
        this.proteinProduction = 15; // Proteins per cycle
        this.aminoAcidConsumption = 12;
        this.cycleTime = 4.0; // seconds per cycle
        this.timeSinceCycle = 0;
        this.cyclesCompleted = 0;
        
        // Visual: Cyan/teal growth-oriented sphere
        const geometry = new THREE.SphereGeometry(0.35, 16, 16);
        this.mesh = this.createMesh(geometry, 0x00BCD4);
        this.mesh.userData.cellType = 'ANABOLIC';
        this.scene.add(this.mesh);
        
        // Create black outline for toon effect
        this.createOutlineForMesh(geometry, 1.03);
        this.createStallOutline(geometry);  // Yellow-orange for ATP stall
        
        console.log(`[AnabolismCell] Created at [${gridX}, ${gridZ}]`);
    }

    /**
     * Execute anabolism cycle: amino acids → proteins
     */
    anabolizeCycle() {
        this.cyclesCompleted++;
        
        // Would integrate with inventory/resource system
        console.log(`[AnabolismCell] Completed cycle #${this.cyclesCompleted}: ${this.aminoAcidConsumption} amino acids → ${this.proteinProduction} proteins`);
        
        return {
            aminoAcidsConsumed: this.aminoAcidConsumption,
            proteinsProduced: this.proteinProduction,
            atpConsumed: this.atpConsumption,
            cycleNumber: this.cyclesCompleted
        };
    }

    /**
     * Trigger mitosis to produce a daughter cell
     */
    mitosis(gridTarget) {
        // Would create another AnabolismCell at gridTarget
        console.log(`[AnabolismCell] Performing mitosis to create daughter cell at [${gridTarget.x}, ${gridTarget.z}]`);
        
        return {
            parent: this,
            daughter: {
                gridX: gridTarget.x,
                gridZ: gridTarget.z,
                type: 'AnabolismCell'
            }
        };
    }

    update(deltaTime) {
        this.timeSinceCycle += deltaTime;
        
        // Execute anabolic cycle periodically
        if (this.timeSinceCycle >= this.cycleTime) {
            this.anabolizeCycle();
            this.timeSinceCycle = 0;
            
            // Visual growth pulse
            this.mesh.scale.set(1.15, 1.15, 1.15);
            setTimeout(() => {
                if (this.mesh) this.mesh.scale.set(1, 1, 1);
            }, 150);
        }
    }

    /**
     * Get status for UI display
     */
    getStatusText() {
        const proteinPerSec = (this.proteinProduction / this.cycleTime).toFixed(2);
        return `
            Status: <span style="color: #00ffff;">ANABOLIC</span><br>
            Proteins/sec: <span style="color: #00e5ff;">${proteinPerSec}</span><br>
            AminoAcids/cycle: ${this.aminoAcidConsumption}<br>
            ATP/cycle: ${this.atpConsumption}<br>
            Cycles done: ${this.cyclesCompleted}
        `;
    }
}

class Nucleus extends BaseBuilding {
    constructor(gridX, gridZ, grid, scene, resourceManager) {
        super(gridX, gridZ, grid, scene);
        
        this.resourceManager = resourceManager;
        
        // Link to BioDatabase entry
        this.bioId = 'BLD_NUCLEUS_MAIN';
        this.name = 'Pluripotent Nucleus';
        this.icon = '🔴';
        
        // Load ATP config from BioDatabase
        const dbEntry = BioDatabase.buildings.find(b => b.id === 'BLD_NUCLEUS_MAIN');
        if (dbEntry) this.loadFromBioDatabaseConfig(dbEntry);
        else {
            // Fallback defaults for existing Nucleus (not in new BioDatabase yet)
            this.maxATP = 100;
            this.atpConsumption = 0;
            this.atpProduction = 0;
        }
        
        // Nucleus properties - spans 5x5 cells (decreased by 1 cell in radius)
        this.isMainBuilding = true;
        this.mitosisRate = 0.5; // Stem cells produced per second
        this.stemCellsProduced = 0;
        this.size = 5; // 5x5 cells (was 6)
        this.baseGridX = gridX;
        this.baseGridZ = gridZ;
        this.damageLevel = 0; // 0-1, for visual feedback
        this.lodLevel = 0; // 0 = high detail, 1 = low detail
        this.meshes = {}; // Store LOD meshes
        this.outlineMesh = null; // For toon outline
        
        // Visual: White pulsing cube (5x5 cells, low profile)
        const cellSize = 1;
        const width = this.size * cellSize;   // 5 units
        const height = 1 * cellSize;          // 1 unit tall (low nucleus)
        const depth = this.size * cellSize;   // 5 units
        
        // Create textures (normal map and roughness map)
        this.normalTexture = this.createNormalMapTexture(512);
        this.roughnessTexture = this.createRoughnessMapTexture(512);
        
        // Create perfect rounded box geometry (ideal form, no manual deformation)
        this.geometryLOD0 = new RoundedBoxGeometry(width, height, depth, 16, 0.4);
        this.geometryLOD1 = new RoundedBoxGeometry(width, height, depth, 8, 0.3);
        
        // Use BioShader for animated pulsing nucleus with Squash-and-Stretch profile
        const material = new BioShader(false, new THREE.Vector3(1, 2, 1).normalize());
        material.uniforms.baseColor.value.setHex(0xffffff);  // White nucleus
        
        // Apply 'cell' animation profile (soft, full-body respiration)
        applyAnimationProfile(material, 'cell');
        
        // Store material for damage feedback
        this.baseMaterial = material;
        this.materialLOD0 = material;
        this.materialLOD1 = material.clone();
        
        this.mesh = new THREE.Mesh(this.geometryLOD0, this.materialLOD0);
        
        // Position cube at center of 5x5 grid [22,22] to [26,26]
        const centerX = grid.getWorldPosition(gridX + 2.0, gridZ + 2.0);
        this.mesh.position.copy(centerX);
        this.mesh.position.y = height / 2;
        
        this.mesh.userData.cellType = 'NUCLEUS_MAIN';
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.scene.add(this.mesh);
        
        // Create outline mesh for toon effect
        this.createOutlineMesh(this.geometryLOD0, width, height, depth);
        
        // Create stall outline (yellow-orange for ATP overflow)
        this.createStallOutline(this.geometryLOD0);
        
        // Add angeled light for shadows (top-left, casting to bottom-right)
        const light = new THREE.PointLight(0xFFFFFF, 0.8, 20);
        light.position.set(gridX - 5, 15, gridZ - 5); // Top-left angle
        light.castShadow = true;
        light.shadow.mapSize.width = 2048;
        light.shadow.mapSize.height = 2048;
        this.lightHelper = light;
        this.scene.add(light);
        
        console.log(`[Nucleus] Created 5x5 MAIN nucleus at [${gridX}, ${gridZ}] to [${gridX+4}, ${gridZ+4}]`);
        console.log(`[Nucleus] Visual enhancements: Normal maps, Roughness maps, Beveled edges, Toon outline, LOD, Shadow angle`);
    }

    /**
     * Create procedural normal map via canvas
     */
    createNormalMapTexture(size) {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        // Create Perlin-like noise pattern for normal map
        ctx.fillStyle = '#8080FF'; // Neutral blue (middle normal)
        ctx.fillRect(0, 0, size, size);
        
        // Add noise for surface detail
        const imageData = ctx.getImageData(0, 0, size, size);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            const noise = Math.random() * 60;
            data[i] = Math.max(0, 128 + noise - 30);     // R: X normal
            data[i + 1] = Math.max(0, 128 + noise - 30); // G: Y normal
            data[i + 2] = 255;                            // B: Z normal (up)
            data[i + 3] = 255;                            // Alpha
        }
        
        // Smooth the noise
        ctx.putImageData(imageData, 0, 0);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(4, 4);
        return texture;
    }

    /**
     * Create procedural roughness map
     */
    createRoughnessMapTexture(size) {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        // Create roughness variation
        const imageData = ctx.createImageData(size, size);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            // Vary roughness across surface (0.3 to 0.7)
            const value = Math.floor(76 + Math.random() * 100); // 76-176 range → 0.3-0.7 normalized
            data[i] = data[i + 1] = data[i + 2] = value;
            data[i + 3] = 255;
        }
        
        ctx.putImageData(imageData, 0, 0);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(4, 4);
        return texture;
    }

    /**
     * Create outline mesh for toon effect
     */
    createOutlineMesh(geometry, width, height, depth) {
        const outlineGeometry = geometry.clone();
        
        // Create outline material (dark, unlit)
        const outlineMaterial = new THREE.MeshBasicMaterial({
            color: COLORS.OUTLINE_BLACK,
            side: THREE.BackSide,
            wireframe: false
        });
        
        this.outlineMesh = new THREE.Mesh(outlineGeometry, outlineMaterial);
        this.outlineMesh.position.copy(this.mesh.position);
        this.outlineMesh.scale.set(1.02, 1.02, 1.02); // Slightly larger for outline effect
        
        this.scene.add(this.outlineMesh);
    }

    /**
     * Update visual state based on damage
     */
    applyDamageVisuals() {
        if (!this.mesh || !this.mesh.material) return;
        
        // Damage level: 0 = healthy, 1 = fully broken
        if (this.damageLevel > 0) {
            // Dim the color
            const healthPercent = 1 - this.damageLevel;
            this.mesh.material.color.multiplyScalar(healthPercent);
            
            // Add red tint for damage
            this.mesh.material.color.addScaledVector(new THREE.Color(0xFF0000), this.damageLevel * 0.3);
            
            // Reduce emissive for damaged state
            this.mesh.material.emissiveIntensity = Math.max(0.1, this.mesh.material.emissiveIntensity - this.damageLevel * 0.2);
        }
    }

    /**
     * Update LOD based on camera distance
     */
    updateLOD(cameraDistance) {
        let newLodLevel = cameraDistance > 40 ? 1 : 0;
        
        if (newLodLevel !== this.lodLevel) {
            this.lodLevel = newLodLevel;
            
            if (this.lodLevel === 0) {
                // High detail
                this.mesh.geometry = this.geometryLOD0;
                this.mesh.material = this.materialLOD0;
            } else {
                // Low detail
                this.mesh.geometry = this.geometryLOD1;
                this.mesh.material = this.materialLOD1;
            }
        }
    }

    /**
     * Check if a grid cell is part of this nucleus (5x5 area)
     */
    containsCell(gridX, gridZ) {
        return gridX >= this.baseGridX && gridX < this.baseGridX + this.size &&
               gridZ >= this.baseGridZ && gridZ < this.baseGridZ + this.size;
    }

    /**
     * Take damage and update visuals
     */
    takeDamage(amount) {
        this.damageLevel = Math.min(1, this.damageLevel + amount / 100); // Normalize
        this.applyDamageVisuals();
    }

    /**
     * Heal and restore visuals
     */
    heal(amount) {
        this.damageLevel = Math.max(0, this.damageLevel - amount / 100);
        this.applyDamageVisuals();
    }

    /**
     * Update material based on current shader profile
     */
    updateShaderProfile() {
        if (this.mesh) {
            if (this.mesh.material) {
                this.mesh.material.dispose();
            }
            const newMaterial = new BioShader(false, new THREE.Vector3(1, 2, 1).normalize());
            newMaterial.uniforms.baseColor.value.setHex(0xffffff);
            applyAnimationProfile(newMaterial, 'cell');
            this.mesh.material = newMaterial;
            console.log(`[Nucleus] Updated material with BioShader + cell animation profile`);
        }
    }

    update(deltaTime) {
        // Constant pulsing animation for main nucleus - NEGATIVE PULSE (shrinking)
        if (this.mesh) {
            const time = Date.now() * 0.001; // Time in seconds
            const pulse = 1 - Math.sin(time * 1.5) * 0.03;
            this.mesh.scale.set(pulse, pulse, pulse);
            
            // Update outline scale to match
            if (this.outlineMesh) {
                this.outlineMesh.scale.set(pulse * 1.02, pulse * 1.02, pulse * 1.02);
            }
            
            // Subtler glow pulsing
            this.mesh.material.emissiveIntensity = 0.35 + Math.sin(time * 2) * 0.15;
            
            // Light pulsing
            if (this.lightHelper) {
                this.lightHelper.intensity = 0.4 + Math.sin(time * 1.5) * 0.2;
                this.lightHelper.position.copy(this.mesh.position);
            }
            
            // Update LOD based on camera distance (simplified - use scene camera)
            if (this.scene.userData.camera) {
                const distance = this.mesh.position.distanceTo(this.scene.userData.camera.position);
                this.updateLOD(distance);
            }
        }
    }

    /**
     * Get status for UI display
     */
    getStatusText() {
        return `
            Status: <span style="color: #ffff00;">MAIN NUCLEUS</span><br>
            Size: 5x5 cells (enhanced)<br>
            Damage: <span style="color: #ff6666;">${(this.damageLevel * 100).toFixed(0)}%</span><br>
            Mitosis rate: <span style="color: #99ff99;">${this.mitosisRate}/sec</span><br>
            Stem cells produced: ${this.stemCellsProduced}<br>
            Health: <span style="color: #00ff00;">${(100 - this.damageLevel * 100).toFixed(0)}%</span>
        `;
    }
}

export default BaseBuilding;
export { Extractor, Storage, Structure, CatabolismCell, AnabolismCell, Nucleus };
