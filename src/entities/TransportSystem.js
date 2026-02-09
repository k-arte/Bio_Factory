import * as THREE from 'three';

class BioVessel {
    constructor(gridX, gridZ, direction, grid, resourceManager) {
        this.gridX = gridX;
        this.gridZ = gridZ;
        this.direction = direction; // 'N', 'S', 'E', 'W'
        this.grid = grid;
        this.resourceManager = resourceManager;
        
        this.mesh = this.createMesh();
        this.connectedVessels = [];
        this.currentResource = null;
        
        // Position mesh at grid cell center
        const worldPos = grid.getWorldPosition(gridX, gridZ);
        this.mesh.position.copy(worldPos);
    }

    createMesh() {
        // Create a cylinder pointing in direction (biological vein)
        const geometry = new THREE.CylinderGeometry(0.15, 0.15, 0.8, 8);
        const material = new THREE.MeshStandardMaterial({
            color: 0xcc5544,      // Warm red/orange (vein color)
            emissive: 0xaa3322,   // Deep red emissive glow
            metalness: 0.2,
            roughness: 0.5,
            transparent: true,
            opacity: 0.9
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.z = Math.PI / 2;

        // Rotate based on direction
        switch(this.direction) {
            case 'N': mesh.rotation.x = 0; break;
            case 'S': mesh.rotation.x = Math.PI; break;
            case 'E': mesh.rotation.z = Math.PI / 2; break;
            case 'W': mesh.rotation.z = -Math.PI / 2; break;
        }

        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.vessel = this;

        return mesh;
    }

    /**
     * Get next grid cell in direction of this vessel
     */
    getNextCell() {
        const directions = {
            'N': { x: 0, z: -1 },
            'S': { x: 0, z: 1 },
            'E': { x: 1, z: 0 },
            'W': { x: -1, z: 0 }
        };

        const delta = directions[this.direction];
        return { x: this.gridX + delta.x, z: this.gridZ + delta.z };
    }

    /**
     * Check if this vessel connects to another adjacent vessel
     */
    linkWith(otherVessel) {
        const nextCell = this.getNextCell();
        
        // Check if other vessel is in the direction this one faces
        if (nextCell.x === otherVessel.gridX && nextCell.z === otherVessel.gridZ) {
            // Also check if other vessel faces back this way (optional: allow one-way)
            this.connectedVessels.push(otherVessel);
            return true;
        }
        return false;
    }

    /**
     * Transfer resource to next vessel
     */
    pushResource(resource, deltaTime) {
        if (!resource) return;

        // Move resource along vessel using standard vector math for compatibility
        const speed = 5.0; // units per second
        let worldPos = this.grid.getWorldPosition(this.gridX, this.gridZ);
        
        // Use standard vector math for frame-rate independent motion (compatible with Three.js < r168)
        const direction = new THREE.Vector3().subVectors(worldPos, resource.mesh.position).normalize();
        const distance = resource.mesh.position.distanceTo(worldPos);
        const moveDist = Math.min(distance, speed * deltaTime);
        resource.mesh.position.add(direction.multiplyScalar(moveDist));

        // Check if resource reached end of vessel
        const remainingDistance = resource.mesh.position.distanceTo(worldPos);
        if (remainingDistance < 0.05) {
            // Ready to transfer to next vessel
            return true;
        }
        return false;
    }

    reset() {
        if (this.currentResource) {
            this.resourceManager.releaseResource(this.currentResource);
            this.currentResource = null;
        }
    }
}

class TransportSystem {
    constructor(grid, resourceManager) {
        this.grid = grid;
        this.resourceManager = resourceManager;
        this.vessels = new Map(); // gridX_gridZ -> BioVessel
        this.activeResources = []; // Resources in transit
    }

    /**
     * Create and register a bio-vessel
     */
    placeVessel(gridX, gridZ, direction, scene) {
        const key = `${gridX}_${gridZ}`;
        
        if (this.vessels.has(key)) {
            console.warn(`Vessel already exists at ${key}`);
            return null;
        }

        const vessel = new BioVessel(gridX, gridZ, direction, this.grid, this.resourceManager);
        this.vessels.set(key, vessel);
        scene.add(vessel.mesh);

        // Auto-link with adjacent vessels
        this.linkVessels();

        return vessel;
    }

    /**
     * Link all adjacent vessels that face each other
     * Optimized: Only check 4 adjacent cells instead of O(n²)
     */
    linkVessels() {
        const vesselArray = Array.from(this.vessels.values());
        
        vesselArray.forEach(vessel => {
            vessel.connectedVessels = [];
            
            // Only check 4 adjacent cells (N, S, E, W)
            const directions = [
                { x: 0, z: -1 },   // North
                { x: 0, z: 1 },    // South
                { x: 1, z: 0 },    // East
                { x: -1, z: 0 }    // West
            ];
            
            directions.forEach(dir => {
                const adjacentX = vessel.gridX + dir.x;
                const adjacentZ = vessel.gridZ + dir.z;
                const key = `${adjacentX}_${adjacentZ}`;
                const adjacent = this.vessels.get(key);
                
                if (adjacent && vessel !== adjacent) {
                    vessel.linkWith(adjacent);
                }
            });
        });
    }

    /**
     * Add resource to vessel (starts transport)
     */
    pushResourceToVessel(gridX, gridZ, resource) {
        const key = `${gridX}_${gridZ}`;
        const vessel = this.vessels.get(key);

        if (!vessel) {
            console.warn(`No vessel at ${key}`);
            return false;
        }

        if (vessel.currentResource) {
            return false; // Vessel occupied
        }

        vessel.currentResource = resource;
        this.activeResources.push({
            resource,
            currentVessel: vessel,
            progress: 0
        });

        return true;
    }

    /**
     * Update all resources in transit
     */
    update(deltaTime) {
        const toRemove = [];

        this.activeResources.forEach((transport, index) => {
            const { resource, currentVessel } = transport;

            // Move resource through vessel
            const readyToTransfer = currentVessel.pushResource(resource, deltaTime);

            if (readyToTransfer && currentVessel.connectedVessels.length > 0) {
                // Transfer to next vessel
                const nextVessel = currentVessel.connectedVessels[0];
                nextVessel.currentResource = resource;
                transport.currentVessel = nextVessel;
            } else if (readyToTransfer && currentVessel.connectedVessels.length === 0) {
                // Dead end - remove resource
                toRemove.push(index);
                this.resourceManager.releaseResource(resource);
            }
        });

        // Remove completed transports (in reverse order)
        for (let i = toRemove.length - 1; i >= 0; i--) {
            this.activeResources.splice(toRemove[i], 1);
        }
    }

    getVesselCount() {
        return this.vessels.size;
    }

    getResourceCountInTransit() {
        return this.activeResources.length;
    }

    clear() {
        this.vessels.forEach(v => v.reset());
        this.vessels.clear();
        this.activeResources = [];
    }
}

export default TransportSystem;
export { BioVessel };
