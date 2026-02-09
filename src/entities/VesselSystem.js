import * as THREE from 'three';

/**
 * VesselSystem: Manages organic vessel/pipe placement with auto-tiling
 * Features:
 * - Automatic geometry selection (Straight, Corner, T-Junction, Cross)
 * - Organic vein/artery visuals
 * - Flow visualization
 * - Connection detection logic
 */
class VesselSystem {
    constructor(scene, grid) {
        this.scene = scene;
        this.grid = grid;
        
        // Track placed vessels by grid coordinates
        this.vessels = new Map(); // Key: "x,z" | Value: { mesh, type, connections }
        
        // Vessel type constants
        this.VESSEL_TYPES = {
            STRAIGHT_H: 'straight_h',    // Horizontal straight
            STRAIGHT_V: 'straight_v',    // Vertical straight
            CORNER_NE: 'corner_ne',      // North-East
            CORNER_NW: 'corner_nw',      // North-West
            CORNER_SE: 'corner_se',      // South-East
            CORNER_SW: 'corner_sw',      // South-West
            T_NORTH: 't_north',          // T pointing up
            T_SOUTH: 't_south',          // T pointing down
            T_EAST: 't_east',            // T pointing right
            T_WEST: 't_west',            // T pointing left
            CROSS: 'cross'               // 4-way junction
        };

        // Direction vectors: N, S, E, W
        this.DIRECTIONS = {
            N: { x: 0, z: -1 },
            S: { x: 0, z: 1 },
            E: { x: 1, z: 0 },
            W: { x: -1, z: 0 }
        };

        // Vessel group for organization
        this.vesselGroup = new THREE.Group();
        this.vesselGroup.name = 'VesselGroup';
        this.scene.add(this.vesselGroup);
    }

    /**
     * Place a vessel at grid coordinates
     * Automatically determines and updates geometry based on neighbors
     */
    placeVessel(gridX, gridZ) {
        const key = this.getKey(gridX, gridZ);
        
        // If vessel already exists, remove it
        if (this.vessels.has(key)) {
            this.removeVessel(gridX, gridZ);
        }

        // Check neighbor connections
        const connections = this.getConnectionDirections(gridX, gridZ);
        
        // Determine vessel type based on connections
        const vesselType = this.determineVesselType(connections);
        
        // Create vessel mesh
        const mesh = this.createVesselMesh(vesselType);
        mesh.position.copy(this.grid.getWorldPosition(gridX, gridZ));
        mesh.position.y = 0.1; // Slightly above ground
        
        this.vesselGroup.add(mesh);
        
        // Store vessel data
        this.vessels.set(key, {
            mesh,
            type: vesselType,
            connections,
            gridX,
            gridZ
        });

        // Update neighbor vessels (they may need to retile)
        this.updateNeighbors(gridX, gridZ);

        console.log(`[VesselSystem] Placed vessel at [${gridX}, ${gridZ}]: ${vesselType}`);
        
        return mesh;
    }

    /**
     * Remove a vessel at grid coordinates
     */
    removeVessel(gridX, gridZ) {
        const key = this.getKey(gridX, gridZ);
        const vesselData = this.vessels.get(key);
        
        if (vesselData) {
            this.vesselGroup.remove(vesselData.mesh);
            vesselData.mesh.geometry.dispose();
            vesselData.mesh.material.dispose();
            this.vessels.delete(key);
            
            // Update neighbors
            this.updateNeighbors(gridX, gridZ);
        }
    }

    /**
     * Check which neighbors have vessels
     * Returns object with directions that have connections
     */
    getConnectionDirections(gridX, gridZ) {
        const connections = {};
        
        Object.entries(this.DIRECTIONS).forEach(([dir, offset]) => {
            const neighborX = gridX + offset.x;
            const neighborZ = gridZ + offset.z;
            const neighborKey = this.getKey(neighborX, neighborZ);
            connections[dir] = this.vessels.has(neighborKey);
        });
        
        return connections;
    }

    /**
     * Determine vessel type based on connection pattern
     */
    determineVesselType(connections) {
        const { N, S, E, W } = connections;
        
        // Count connections
        const connectionCount = [N, S, E, W].filter(Boolean).length;
        
        // 4-way junction
        if (N && S && E && W) return this.VESSEL_TYPES.CROSS;
        
        // 3-way T-junctions
        if (N && S && E) return this.VESSEL_TYPES.T_WEST;
        if (N && S && W) return this.VESSEL_TYPES.T_EAST;
        if (N && E && W) return this.VESSEL_TYPES.T_SOUTH;
        if (S && E && W) return this.VESSEL_TYPES.T_NORTH;
        
        // 2-way connections (straights and corners)
        if (N && S) return this.VESSEL_TYPES.STRAIGHT_V;
        if (E && W) return this.VESSEL_TYPES.STRAIGHT_H;
        if (N && E) return this.VESSEL_TYPES.CORNER_SE;
        if (N && W) return this.VESSEL_TYPES.CORNER_SW;
        if (S && E) return this.VESSEL_TYPES.CORNER_NE;
        if (S && W) return this.VESSEL_TYPES.CORNER_NW;
        
        // Single or no connections - default to straight horizontal
        return this.VESSEL_TYPES.STRAIGHT_H;
    }

    /**
     * Create vessel mesh with appropriate geometry
     */
    createVesselMesh(vesselType) {
        let geometry;
        
        switch (vesselType) {
            case this.VESSEL_TYPES.STRAIGHT_H:
                geometry = this.createStraightGeometry(1, 0); // Along X
                break;
            case this.VESSEL_TYPES.STRAIGHT_V:
                geometry = this.createStraightGeometry(0, 1); // Along Z
                break;
            case this.VESSEL_TYPES.CORNER_NE:
                geometry = this.createCornerGeometry(0);
                break;
            case this.VESSEL_TYPES.CORNER_NW:
                geometry = this.createCornerGeometry(Math.PI / 2);
                break;
            case this.VESSEL_TYPES.CORNER_SW:
                geometry = this.createCornerGeometry(Math.PI);
                break;
            case this.VESSEL_TYPES.CORNER_SE:
                geometry = this.createCornerGeometry(Math.PI * 1.5);
                break;
            case this.VESSEL_TYPES.T_NORTH:
                geometry = this.createTJunctionGeometry(0);
                break;
            case this.VESSEL_TYPES.T_SOUTH:
                geometry = this.createTJunctionGeometry(Math.PI);
                break;
            case this.VESSEL_TYPES.T_EAST:
                geometry = this.createTJunctionGeometry(Math.PI / 2);
                break;
            case this.VESSEL_TYPES.T_WEST:
                geometry = this.createTJunctionGeometry(Math.PI * 1.5);
                break;
            case this.VESSEL_TYPES.CROSS:
                geometry = this.createCrossGeometry();
                break;
            default:
                geometry = this.createStraightGeometry(1, 0);
        }
        
        // Create material with organic vein appearance
        const material = new THREE.MeshStandardMaterial({
            color: 0x8B0000,           // Dark red (blood vessel)
            metalness: 0.3,
            roughness: 0.7,
            emissive: 0x330000         // Subtle red glow
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        return mesh;
    }

    /**
     * Create straight vessel geometry
     * dirX/dirZ indicates direction (1 for along that axis)
     */
    createStraightGeometry(dirX, dirZ) {
        const geometry = new THREE.BufferGeometry();
        
        // Organic tube - slightly twisted for vein look
        const segments = 8;
        const radius = 0.15;
        const length = 1.0;
        
        const positions = [];
        const indices = [];
        
        // Create tube along the appropriate axis
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const t = i / segments;
            
            for (let j = 0; j <= 1; j++) {
                const x = dirX * (j - 0.5) * length;
                const z = dirZ * (j - 0.5) * length;
                const y = Math.cos(angle) * radius;
                const offset = Math.sin(angle) * radius;
                
                // Add slight twist
                const twist = t * Math.PI * 0.3;
                
                const px = x + (1 - dirX) * Math.cos(angle + twist) * radius;
                const pz = z + (1 - dirZ) * Math.cos(angle + twist) * radius;
                const py = y + Math.sin(angle + twist) * radius * 0.5;
                
                positions.push(px, py, pz);
            }
        }
        
        // Create index faces
        for (let i = 0; i < segments; i++) {
            const a = i * 2;
            const b = a + 1;
            const c = (i + 1) * 2;
            const d = c + 1;
            
            indices.push(a, c, b);
            indices.push(b, c, d);
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
        geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));
        geometry.computeVertexNormals();
        
        return geometry;
    }

    /**
     * Create corner/elbow vessel geometry
     */
    createCornerGeometry(rotation) {
        const geometry = new THREE.BufferGeometry();
        
        const radius = 0.15;
        const segments = 8;
        const positions = [];
        const indices = [];
        
        // Create quarter-circle arc tube
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * (Math.PI / 2);
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            
            for (let j = 0; j <= segments / 2; j++) {
                const circleAngle = (j / (segments / 2)) * Math.PI * 2;
                const x = cos * 0.5 + Math.cos(circleAngle) * radius * (1 - cos);
                const z = sin * 0.5 + Math.sin(circleAngle) * radius * (1 - sin);
                const y = Math.sin(circleAngle) * radius * 0.5;
                
                positions.push(x, y, z);
            }
        }
        
        // Build indices for smooth corner
        const width = Math.floor(segments / 2) + 1;
        for (let i = 0; i < segments; i++) {
            for (let j = 0; j < width - 1; j++) {
                const a = i * width + j;
                const b = a + 1;
                const c = (i + 1) * width + j;
                const d = c + 1;
                
                indices.push(a, c, b);
                indices.push(b, c, d);
            }
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
        geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));
        geometry.computeVertexNormals();
        geometry.rotateY(rotation);
        
        return geometry;
    }

    /**
     * Create T-junction vessel geometry
     */
    createTJunctionGeometry(rotation) {
        // Create a merged geometry with main stem and branch
        const mainGeom = this.createStraightGeometry(1, 0);
        const branchGeom = this.createStraightGeometry(0, 1);
        
        // For simplicity, just use the main straight geometry
        // A full implementation would merge these geometries
        return mainGeom;
    }

    /**
     * Create cross/4-way junction geometry
     */
    createCrossGeometry() {
        // Create a merged geometry with 4 branches
        // For simplicity, use a cylinder with increased radius at center
        
        const geometry = new THREE.CylinderGeometry(0.2, 0.2, 1.0, 8);
        // A full implementation would properly merge 4 branch geometries
        return geometry;
    }

    /**
     * Update neighbor vessels when one is placed/removed
     */
    updateNeighbors(gridX, gridZ) {
        Object.values(this.DIRECTIONS).forEach(dir => {
            const nX = gridX + dir.x;
            const nZ = gridZ + dir.z;
            const nKey = this.getKey(nX, nZ);
            
            if (this.vessels.has(nKey)) {
                const neighbor = this.vessels.get(nKey);
                
                // Get new connections and type
                const newConnections = this.getConnectionDirections(nX, nZ);
                const newType = this.determineVesselType(newConnections);
                
                // If type changed, update the mesh
                if (newType !== neighbor.type) {
                    this.vesselGroup.remove(neighbor.mesh);
                    neighbor.mesh.geometry.dispose();
                    neighbor.mesh.material.dispose();
                    
                    const newMesh = this.createVesselMesh(newType);
                    newMesh.position.copy(this.grid.getWorldPosition(nX, nZ));
                    newMesh.position.y = 0.1;
                    this.vesselGroup.add(newMesh);
                    
                    neighbor.mesh = newMesh;
                    neighbor.type = newType;
                    neighbor.connections = newConnections;
                }
            }
        });
    }

    /**
     * Get vessel at grid coordinates
     */
    getVessel(gridX, gridZ) {
        return this.vessels.get(this.getKey(gridX, gridZ));
    }

    /**
     * Check if vessel exists at coordinates
     */
    hasVessel(gridX, gridZ) {
        return this.vessels.has(this.getKey(gridX, gridZ));
    }

    /**
     * Helper: Create grid key
     */
    getKey(x, z) {
        return `${x},${z}`;
    }

    /**
     * Get all vessels
     */
    getAllVessels() {
        return Array.from(this.vessels.values());
    }

    /**
     * Clear all vessels
     */
    clear() {
        this.vessels.forEach(vesselData => {
            this.vesselGroup.remove(vesselData.mesh);
            vesselData.mesh.geometry.dispose();
            vesselData.mesh.material.dispose();
        });
        this.vessels.clear();
    }
}

export default VesselSystem;
