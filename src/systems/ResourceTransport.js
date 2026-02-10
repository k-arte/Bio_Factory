import * as THREE from 'three';

/**
 * ResourceTransport: Manages resource packets moving through vessel networks
 * 
 * Features:
 * - Resource packet creation from extractor buildings
 * - Manhattan pathfinding through vessel networks
 * - Packet movement along paths with configurable speed
 * - Resource deposit into storage buildings
 * - Visual trail showing resource movement (particle effect)
 * 
 * Architecture:
 * - Packets stored in activePackets array
 * - Each packet tracks: resource type, amount, current position, path, progress
 * - Update() called each frame to move packets and handle transfers
 */
class ResourceTransport {
    constructor(scene, grid, resourceManager) {
        this.scene = scene;
        this.grid = grid;
        this.resourceManager = resourceManager;
        
        // Active resource packets moving through the system
        this.activePackets = [];
        this.packetIdCounter = 0;
        
        // Building registry for source/sink identification
        this.extractors = new Map();      // gridKey -> building
        this.storages = new Map();        // gridKey -> building
        this.vessels = new Map();         // gridKey -> building (for pathfinding)
        
        // Transport configuration
        this.packetsPerSecond = 2;        // How many packets per second from each extractor
        this.packetSpeed = 0.5;           // Grid cells per second
        this.packetSize = 0.08;           // Visual size of resource packet
        
        // Trail effect configuration
        this.trailParticles = [];         // Array of trail particles
        this.trailUpdateCounter = 0;      // Update trails every N frames
        this.trailInterval = 5;           // Create trail particle every N frames
        
        // Timers for packet generation
        this.extractorTimers = new Map(); // gridKey -> accumulatedTime
        
        // Statistics for efficiency monitoring
        this.stats = {
            totalPacketsCreated: 0,
            totalPacketsDelivered: 0,
            totalResourceDelivered: {},   // resourceType -> amount
            lastMinutePackets: 0,
            lastMinuteResources: {}
        };
        this.statsUpdateTimer = 0;
        
        console.log('[ResourceTransport] Initialized');
    }

    /**
     * Register an extractor building (resource source)
     */
    registerExtractor(gridX, gridZ, building) {
        const key = `${gridX},${gridZ}`;
        this.extractors.set(key, {
            x: gridX,
            z: gridZ,
            building: building,
            resourceType: building.resourceType || 'RES_ATP',
            outputPerSecond: building.atp_production_per_minute / 60
        });
        this.extractorTimers.set(key, 0);
        console.log(`[ResourceTransport] Registered extractor at [${gridX},${gridZ}]`);
    }

    /**
     * Register a storage building (resource sink)
     */
    registerStorage(gridX, gridZ, building) {
        const key = `${gridX},${gridZ}`;
        this.storages.set(key, {
            x: gridX,
            z: gridZ,
            building: building,
            capacity: building.capacity || { 'RES_ATP': 100 }
        });
        console.log(`[ResourceTransport] Registered storage at [${gridX},${gridZ}]`);
    }

    /**
     * Register a vessel for pathfinding
     */
    registerVessel(gridX, gridZ, building) {
        const key = `${gridX},${gridZ}`;
        this.vessels.set(key, {
            x: gridX,
            z: gridZ,
            building: building
        });
    }

    /**
     * Unregister a building when removed
     */
    unregisterBuilding(gridX, gridZ) {
        const key = `${gridX},${gridZ}`;
        this.extractors.delete(key);
        this.storages.delete(key);
        this.vessels.delete(key);
    }

    /**
     * Update transport system each frame
     */
    update(deltaTime) {
        // Generate packets from extractors
        this._generatePackets(deltaTime);
        
        // Move existing packets along their paths
        this._updatePackets(deltaTime);
        
        // Check for packet-storage collisions and transfer
        this._checkDeposits();
    }

    /**
     * Generate resource packets from extractors
     */
    _generatePackets(deltaTime) {
        for (const [key, extractor] of this.extractors) {
            const timer = this.extractorTimers.get(key) || 0;
            const timeBetweenPackets = 1.0 / this.packetsPerSecond;
            
            this.extractorTimers.set(key, timer + deltaTime);
            
            // Generate packets at configured rate
            while (this.extractorTimers.get(key) >= timeBetweenPackets) {
                this.extractorTimers.set(key, this.extractorTimers.get(key) - timeBetweenPackets);
                
                // Create packet and find path to nearest storage
                const startPos = { x: extractor.x, z: extractor.z };
                const packet = {
                    id: this.packetIdCounter++,
                    resourceType: extractor.resourceType,
                    amount: 1,
                    current: { ...startPos },
                    path: [],
                    progress: 0,
                    mesh: null
                };
                
                // Find path to storage
                packet.path = this._findPathToStorage(startPos);
                
                if (packet.path.length > 0) {
                    // Create visual representation
                    packet.mesh = this._createPacketMesh(packet.resourceType);
                    this.scene.add(packet.mesh);
                    
                    this.activePackets.push(packet);
                    
                    // Update statistics
                    this.stats.totalPacketsCreated++;
                    
                    console.log(`[ResourceTransport] Created packet #${packet.id} (${packet.resourceType})`);
                }
            }
        }
    }

    /**
     * Find path from source to nearest storage using BFS
     */
    _findPathToStorage(start) {
        // BFS to find reachable storage
        const visited = new Set();
        const queue = [{ pos: { ...start }, path: [] }];
        visited.add(`${start.x},${start.z}`);
        
        while (queue.length > 0) {
            const current = queue.shift();
            
            // Check if we reached a storage
            const storageKey = `${current.pos.x},${current.pos.z}`;
            if (this.storages.has(storageKey)) {
                return [...current.path, current.pos];
            }
            
            // Expand to adjacent vessels/storages
            const neighbors = [
                { x: current.pos.x + 1, z: current.pos.z },
                { x: current.pos.x - 1, z: current.pos.z },
                { x: current.pos.x, z: current.pos.z + 1 },
                { x: current.pos.x, z: current.pos.z - 1 }
            ];
            
            for (const neighbor of neighbors) {
                if (neighbor.x < 0 || neighbor.x >= this.grid.width ||
                    neighbor.z < 0 || neighbor.z >= this.grid.height) continue;
                
                const nKey = `${neighbor.x},${neighbor.z}`;
                if (visited.has(nKey)) continue;
                
                // Can traverse vessels or reach storage
                if (this.vessels.has(nKey) || this.storages.has(nKey)) {
                    visited.add(nKey);
                    queue.push({
                        pos: neighbor,
                        path: [...current.path, current.pos]
                    });
                }
            }
        }
        
        // No path found
        return [];
    }

    /**
     * Update positions of all active packets
     */
    _updatePackets(deltaTime) {
        this.trailUpdateCounter++;
        
        for (let i = this.activePackets.length - 1; i >= 0; i--) {
            const packet = this.activePackets[i];
            
            if (packet.path.length === 0) {
                // No path, remove packet
                this._removePacket(packet);
                continue;
            }
            
            // Move packet along path
            packet.progress += (this.packetSpeed * deltaTime) / packet.path.length;
            
            if (packet.progress >= 1.0) {
                // Reached end of path
                packet.progress = 0;
                packet.path.shift(); // Remove current waypoint
            }
            
            // Interpolate position
            if (packet.path.length > 0) {
                const from = packet.path[0];
                const to = packet.path[1] || packet.path[0];
                
                packet.current = {
                    x: from.x + (to.x - from.x) * packet.progress,
                    z: from.z + (to.z - from.z) * packet.progress
                };
                
                // Update mesh position
                if (packet.mesh) {
                    const worldPos = this.grid.getWorldPosition(packet.current.x, packet.current.z);
                    packet.mesh.position.set(worldPos.x, worldPos.y + 0.15, worldPos.z);
                    
                    // Create trail particles periodically
                    if (this.trailUpdateCounter % this.trailInterval === 0) {
                        this._createTrailParticle(packet);
                    }
                }
            }
        }
        
        // Update trail particles (fade and remove)
        this._updateTrailParticles(deltaTime);
    }

    /**
     * Create a trail particle behind a moving packet
     */
    _createTrailParticle(packet) {
        const colorMap = {
            'RES_ATP': 0xFFD54F,
            'RES_GLUCOSE': 0x4CAF50,
            'RES_OXYGEN': 0x64B5F6,
            'RES_LACTATE': 0xFF7043,
            'RES_AMINO_ACIDS': 0xFF69B4
        };
        
        const color = colorMap[packet.resourceType] || 0xFFFFFF;
        
        // Create small sphere as trail particle (smaller than packet)
        const geometry = new THREE.SphereGeometry(this.packetSize * 0.5, 6, 6);
        const material = new THREE.MeshBasicMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.3,
            transparent: true,
            opacity: 0.6
        });
        
        const trail = new THREE.Mesh(geometry, material);
        trail.position.copy(packet.mesh.position);
        trail.userData.lifetime = 1.0; // Fade over 1 second
        trail.userData.maxLifetime = 1.0;
        
        this.scene.add(trail);
        this.trailParticles.push(trail);
    }

    /**
     * Update trail particles (fade and remove)
     */
    _updateTrailParticles(deltaTime) {
        for (let i = this.trailParticles.length - 1; i >= 0; i--) {
            const trail = this.trailParticles[i];
            trail.userData.lifetime -= deltaTime;
            
            if (trail.userData.lifetime <= 0) {
                // Remove expired trail
                this.scene.remove(trail);
                trail.geometry.dispose();
                trail.material.dispose();
                this.trailParticles.splice(i, 1);
            } else {
                // Fade out as lifetime decreases
                trail.material.opacity = 0.6 * (trail.userData.lifetime / trail.userData.maxLifetime);
                
                // Slightly scale down as it fades
                const scale = trail.userData.lifetime / trail.userData.maxLifetime;
                trail.scale.set(scale, scale, scale);
            }
        }
    }

    /**
     * Check if any packets have reached storage and transfer
     */
    _checkDeposits() {
        for (let i = this.activePackets.length - 1; i >= 0; i--) {
            const packet = this.activePackets[i];
            
            // Check if at storage location
            const cellKey = `${Math.round(packet.current.x)},${Math.round(packet.current.z)}`;
            const storage = this.storages.get(cellKey);
            
            if (storage && packet.path.length === 0) {
                // Transfer resource to storage building
                if (storage.building && storage.building.receiveResource) {
                    storage.building.receiveResource(packet.resourceType, packet.amount);
                    
                    // Update statistics
                    this.stats.totalPacketsDelivered++;
                    this.stats.lastMinutePackets++;
                    
                    if (!this.stats.totalResourceDelivered[packet.resourceType]) {
                        this.stats.totalResourceDelivered[packet.resourceType] = 0;
                    }
                    this.stats.totalResourceDelivered[packet.resourceType] += packet.amount;
                    
                    if (!this.stats.lastMinuteResources[packet.resourceType]) {
                        this.stats.lastMinuteResources[packet.resourceType] = 0;
                    }
                    this.stats.lastMinuteResources[packet.resourceType] += packet.amount;
                    
                    console.log(`[ResourceTransport] ✓ Deposited ${packet.amount} × ${packet.resourceType} at storage`);
                }
                
                // Mark for removal
                this._removePacket(packet);
            }
        }
    }

    /**
     * Create visual mesh for resource packet
     */
    _createPacketMesh(resourceType) {
        // Color by resource type
        const colorMap = {
            'RES_ATP': 0xFFD54F,
            'RES_GLUCOSE': 0x4CAF50,
            'RES_OXYGEN': 0x64B5F6,
            'RES_LACTATE': 0xFF7043,
            'RES_AMINO_ACIDS': 0xFF69B4
        };
        
        const color = colorMap[resourceType] || 0xFFFFFF;
        
        // Create small sphere as packet
        const geometry = new THREE.SphereGeometry(this.packetSize, 8, 8);
        const material = new THREE.MeshBasicMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.5
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        return mesh;
    }

    /**
     * Remove a packet from the system
     */
    _removePacket(packet) {
        if (packet.mesh) {
            this.scene.remove(packet.mesh);
            packet.mesh.geometry.dispose();
            packet.mesh.material.dispose();
        }
        
        const index = this.activePackets.indexOf(packet);
        if (index > -1) {
            this.activePackets.splice(index, 1);
        }
    }

    /**
     * Clear all packets (cleanup)
     */
    /**
     * Clear all packets and trails (cleanup)
     */
    clear() {
        for (const packet of this.activePackets) {
            this._removePacket(packet);
        }
        this.activePackets = [];
        
        // Clean up trail particles
        for (const trail of this.trailParticles) {
            this.scene.remove(trail);
            trail.geometry.dispose();
            trail.material.dispose();
        }
        this.trailParticles = [];
        
        this.extractors.clear();
        this.storages.clear();
        this.vessels.clear();
        this.extractorTimers.clear();
    }

    /**
     * Reset per-minute statistics (call every 60 seconds)
     */
    resetMinuteStats() {
        this.stats.lastMinutePackets = 0;
        this.stats.lastMinuteResources = {};
    }

    /**
     * Get statistics about active transport
     */
    /**
     * Get statistics about active transport
     */
    getStats() {
        return {
            // Current state
            activePackets: this.activePackets.length,
            activeTrails: this.trailParticles.length,
            registeredExtractors: this.extractors.size,
            registeredStorages: this.storages.size,
            registeredVessels: this.vessels.size,
            
            // Lifetime statistics
            totalPacketsCreated: this.stats.totalPacketsCreated,
            totalPacketsDelivered: this.stats.totalPacketsDelivered,
            deliveryRate: this.stats.totalPacketsCreated > 0 
                ? (this.stats.totalPacketsDelivered / this.stats.totalPacketsCreated * 100).toFixed(1) + '%'
                : 'N/A',
            
            // Resource tracking
            totalResourceDelivered: this.stats.totalResourceDelivered,
            lastMinutePackets: this.stats.lastMinutePackets,
            lastMinuteResources: this.stats.lastMinuteResources
        };
    }
}

export default ResourceTransport;
