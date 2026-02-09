import * as THREE from 'three';
import BioDatabase from '../data/BioDatabase.js';

/**
 * ResourceManager: Object pool pattern for creating, recycling, and managing 3D resource meshes
 * Now fully data-driven (reads from BioDatabase) and event-driven (emits production/consumption events)
 * 
 * Architecture:
 * - getResource() = production event
 * - releaseResource() = consumption event
 * - Events wired to ProgressionManager for stat tracking
 */
class ResourceManager {
    constructor(scene) {
        this.scene = scene;
        this.database = BioDatabase;
        
        // Event listeners (callbacks)
        this.onResourceProduced = null;  // (resourceType, amount) -> void
        this.onResourceConsumed = null;  // (resourceType, amount) -> void
        
        // Build resource config from database
        this.resourceConfigs = this._buildConfigFromDatabase();
        
        // Resource pool for recycling
        this.resourcePool = {};
        this.activeResources = new Map(); // Track all active resources by ID
        this.resourceIdCounter = 0;
        
        // Statistics tracking (for progression)
        this.stats = {
            totalProduced: {}, // resourceType -> count
            totalConsumed: {}   // resourceType -> count
        };
        
        // Initialize pools for all resources
        this._initializePools();
    }

    /**
     * Register a callback for resource production events
     */
    onProduced(callback) {
        this.onResourceProduced = callback;
        console.log('[ResourceManager] Registered onResourceProduced listener');
    }

    /**
     * Register a callback for resource consumption events
     */
    onConsumed(callback) {
        this.onResourceConsumed = callback;
        console.log('[ResourceManager] Registered onResourceConsumed listener');
    }

    /**
     * Build resource configurations from BioDatabase
     */
    _buildConfigFromDatabase() {
        const configs = {};
        
        // Add all resources from database
        if (this.database.resources) {
            this.database.resources.forEach(resource => {
                configs[resource.id] = {
                    name: resource.name,
                    icon: resource.icon,
                    // Visual properties (with defaults if not in DB)
                    color: this._parseHexFromIcon(resource.icon) || 0x4CAF50,
                    size: 0.1,
                    glow: 0x00ff00,
                    shape: resource.shape || 'icosahedron', // Default shape
                    // Store original DB entry
                    dbEntry: resource
                };
            });
        }
        
        // Fallback entries if database is sparse
        const defaults = {
            glucose: { color: 0x4CAF50, size: 0.1, glow: 0x2E7D32, shape: 'sphere' },
            oxygen: { color: 0x64B5F6, size: 0.08, glow: 0x1976D2, shape: 'cube' },
            atp: { color: 0xFFD54F, size: 0.12, glow: 0xF57F17, shape: 'icosahedron' },
            lactate: { color: 0xFF7043, size: 0.1, glow: 0xE64A19, shape: 'sphere' },
            lipid: { color: 0xFF9800, size: 0.11, glow: 0xF57C00, shape: 'tetrahedron' },
            // New resources from DB
            RES_GLUCOSE: { color: 0x4CAF50, size: 0.1, glow: 0x2E7D32, shape: 'sphere' },
            RES_OXYGEN: { color: 0x64B5F6, size: 0.08, glow: 0x1976D2, shape: 'cube' },
            RES_ATP: { color: 0xFFD54F, size: 0.12, glow: 0xF57F17, shape: 'icosahedron' },
            RES_AMINO_ACIDS: { color: 0xFF69B4, size: 0.09, glow: 0xC71585, shape: 'octahedron' }
        };
        
        // Merge with defaults
        for (const [key, config] of Object.entries(defaults)) {
            if (!configs[key]) {
                configs[key] = config;
            }
        }
        
        return configs;
    }

    /**
     * Extract color from icon emoji (simple approximation)
     */
    _parseHexFromIcon(icon) {
        const iconColorMap = {
            '🍯': 0xC4A747,  // Glucose - golden
            '💨': 0x64B5F6,  // Oxygen - light blue
            '⚡': 0xFFD54F,  // ATP - yellow
            '🔴': 0xFF5252,  // Red
            '🧬': 0xAD1457,  // DNA - magenta
            '🫀': 0xFF1744,  // Heart - red
            '💥': 0xFF9100,  // Explosion - orange
            '🧱': 0x00897B   // Brick - teal
        };
        return iconColorMap[icon] || null;
    }

    /**
     * Initialize resource pools for all database resources
     */
    _initializePools() {
        for (const resourceId in this.resourceConfigs) {
            this.resourcePool[resourceId] = [];
            this.preWarmPool(resourceId, 15); // Pre-create 15 of each
        }
    }

    /**
     * Pre-create resource meshes to reduce runtime allocation
     */
    preWarmPool(resourceType, count) {
        for (let i = 0; i < count; i++) {
            const mesh = this.createResourceMesh(resourceType);
            if (mesh) {
                mesh.visible = false;
                this.resourcePool[resourceType].push(mesh);
            }
        }
    }

    /**
     * Create a new resource mesh with properties from BioDatabase
     */
    createResourceMesh(resourceType) {
        const config = this.resourceConfigs[resourceType];
        if (!config) {
            console.warn('[ResourceManager] Unknown resource type:', resourceType);
            return null;
        }

        const geometry = this._createGeometryFromShape(config.shape, config.size);
        const material = new THREE.MeshStandardMaterial({
            color: config.color,
            emissive: config.glow,
            emissiveIntensity: 0.2,
            metalness: 0.3,
            roughness: 0.4,
            transparent: true,
            opacity: 0.95
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.resourceType = resourceType;
        mesh.userData.resourceId = null;

        return mesh;
    }

    /**
     * Create geometry based on shape name
     */
    _createGeometryFromShape(shape, size) {
        switch (shape) {
            case 'sphere':
                return new THREE.SphereGeometry(size, 16, 16);
            case 'cube':
                return new THREE.BoxGeometry(size, size, size);
            case 'tetrahedron':
                return new THREE.TetrahedronGeometry(size, 0);
            case 'octahedron':
                return new THREE.OctahedronGeometry(size, 0);
            case 'icosahedron':
            default:
                return new THREE.IcosahedronGeometry(size, 2);
        }
    }

    /**
     * Get or create a resource mesh from the pool
     * FIRES: onResourceProduced event
     */
    getResource(resourceType, position = { x: 0, y: 0, z: 0 }) {
        let mesh = null;

        // Try to reuse from pool
        if (this.resourcePool[resourceType].length > 0) {
            mesh = this.resourcePool[resourceType].pop();
        } else {
            // Create new if pool exhausted
            mesh = this.createResourceMesh(resourceType);
        }

        if (!mesh) return null;

        // Reset state and assign unique ID
        const resourceId = this.resourceIdCounter++;
        mesh.userData.resourceId = resourceId;
        mesh.position.set(position.x, position.y, position.z);
        mesh.visible = true;
        mesh.scale.set(1, 1, 1);

        // Add to scene and tracking
        this.scene.add(mesh);
        this.activeResources.set(resourceId, {
            mesh,
            type: resourceType,
            created: Date.now()
        });

        // Track statistics
        if (!this.stats.totalProduced[resourceType]) {
            this.stats.totalProduced[resourceType] = 0;
        }
        this.stats.totalProduced[resourceType]++;

        // Fire production event
        if (this.onResourceProduced) {
            this.onResourceProduced(resourceType, 1);
        }

        console.log(`[ResourceManager] Produced ${resourceType} #${resourceId}`);
        return {
            id: resourceId,
            type: resourceType,
            mesh,
            position: mesh.position
        };
    }

    /**
     * Return a resource to the pool
     * FIRES: onResourceConsumed event
     */
    releaseResource(resource) {
        if (!resource || !resource.id) return;

        const tracked = this.activeResources.get(resource.id);
        if (!tracked) {
            console.warn('[ResourceManager] Attempted to release unknown resource:', resource.id);
            return;
        }

        const mesh = tracked.mesh;
        const resourceType = tracked.type;

        // Track statistics
        if (!this.stats.totalConsumed[resourceType]) {
            this.stats.totalConsumed[resourceType] = 0;
        }
        this.stats.totalConsumed[resourceType]++;

        // Fire consumption event
        if (this.onResourceConsumed) {
            this.onResourceConsumed(resourceType, 1);
        }

        // Reset and hide
        mesh.visible = false;
        mesh.position.set(0, -100, 0); // Move far away
        mesh.userData.resourceId = null;

        // Remove from scene and active tracking
        this.scene.remove(mesh);
        this.activeResources.delete(resource.id);

        // Return to pool
        if (this.resourcePool[resourceType].length < 50) { // Limit pool size
            this.resourcePool[resourceType].push(mesh);
            console.log(`[ResourceManager] Consumed ${resourceType} #${resource.id}`);
        } else {
            // Dispose if pool is full
            mesh.geometry.dispose();
            mesh.material.dispose();
            console.log(`[ResourceManager] Disposed ${resourceType} #${resource.id} (pool full)`);
        }
    }

    /**
     * Update all active resources (called each frame)
     * Handles animation and lifecycle updates
     */
    updateAll(deltaTime) {
        // Iterate through all active resources
        for (const [resourceId, tracked] of this.activeResources) {
            if (!tracked || !tracked.mesh) continue;

            // Simple rotation animation
            tracked.mesh.rotation.x += 0.01;
            tracked.mesh.rotation.z += 0.02;

            // Could add more logic here:
            // - Lifetime management
            // - Particle effects
            // - Physics updates
            // - Despawning logic
        }
    }

    /**
     * Get pool statistics for debugging
     */
    getStats() {
        const stats = {
            active: this.activeResources.size,
            pooled: {}
        };

        for (const [type, pool] of Object.entries(this.resourcePool)) {
            stats.pooled[type] = pool.length;
        }

        return stats;
    }

    /**
     * Clear all resources
     */
    dispose() {
        // Release all active resources
        for (const resourceId of Array.from(this.activeResources.keys())) {
            const tracked = this.activeResources.get(resourceId);
            tracked.mesh.geometry.dispose();
            tracked.mesh.material.dispose();
            this.scene.remove(tracked.mesh);
            this.activeResources.delete(resourceId);
        }

        // Dispose pooled resources
        for (const [type, pool] of Object.entries(this.resourcePool)) {
            for (const mesh of pool) {
                mesh.geometry.dispose();
                mesh.material.dispose();
            }
            this.resourcePool[type] = [];
        }

        console.log('[ResourceManager] All resources disposed');
    }
}

export default ResourceManager;
