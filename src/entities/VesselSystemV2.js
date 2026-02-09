import * as THREE from 'three';
import { COLORS } from '../data/Colors.js';

/**
 * VesselSystemV2: Full remake with drag-to-place, hologram preview, and directional flow
 * Features:
 * - Drag-to-place with hologram preview
 * - Two-click confirmation (drag preview → left-click to confirm)
 * - Auto-connection with adjacent vessels
 * - Directional flow metadata (N, S, E, W)
 * - Animated flow visualization showing direction
 */
class VesselSystemV2 {
    constructor(scene, grid, inputManager) {
        this.scene = scene;
        this.grid = grid;
        this.inputManager = inputManager;
        
        // Track placed vessels by grid coordinates
        this.vessels = new Map(); // Key: "x,z" | Value: { mesh, type, connections, direction, flowMaterial }
        
        // Vessel type constants
        this.VESSEL_TYPES = {
            STRAIGHT_H: 'straight_h',
            STRAIGHT_V: 'straight_v',
            CORNER_NE: 'corner_ne',
            CORNER_NW: 'corner_nw',
            CORNER_SE: 'corner_se',
            CORNER_SW: 'corner_sw',
            T_NORTH: 't_north',
            T_SOUTH: 't_south',
            T_EAST: 't_east',
            T_WEST: 't_west',
            CROSS: 'cross'
        };

        // Direction vectors: N, S, E, W
        this.DIRECTIONS = {
            N: { x: 0, z: -1 },
            S: { x: 0, z: 1 },
            E: { x: 1, z: 0 },
            W: { x: -1, z: 0 }
        };

        // Hologram state
        this.hologramMesh = null;
        this.hologramPreviewActive = false;
        this.previewGridX = null;
        this.previewGridZ = null;
        this.dragStartGridX = null;
        this.dragStartGridZ = null;

        // Flow animation
        this.flowTime = 0;
        this.flowSpeed = 1.0;

        // Vessel group
        this.vesselGroup = new THREE.Group();
        this.vesselGroup.name = 'VesselGroupV2';
        this.scene.add(this.vesselGroup);

        // Flow animation particles group
        this.flowParticlesGroup = new THREE.Group();
        this.flowParticlesGroup.name = 'FlowParticles';
        this.scene.add(this.flowParticlesGroup);

        // Setup input listeners for drag-to-place
        this.setupDragListeners();
    }

    /**
     * Setup drag-to-place event listeners
     */
    setupDragListeners() {
        document.addEventListener('mousemove', (e) => {
            if (this.draggingVessel && this.inputManager) {
                const raycaster = this.inputManager.raycaster;
                const mouse = this.inputManager.mouse;
                
                // Get grid position from mouse
                const gridPos = this.getGridPositionFromMouse(raycaster, mouse);
                if (gridPos) {
                    this.updateHologramPreview(gridPos.x, gridPos.z);
                }
            }
        });

        document.addEventListener('mouseup', (e) => {
            if (this.draggingVessel) {
                this.stopDragging();
            }
        });

        // Listen for left-click to confirm placement
        document.addEventListener('click', (e) => {
            // Check if hologram is active - if so, confirm placement
            if (this.hologramPreviewActive && !this.draggingVessel) {
                this.confirmVesselPlacement();
                e.preventDefault();
                e.stopPropagation();
            }
        });
    }

    /**
     * Start dragging a vessel (called by InputManager)
     */
    startDraggingVessel(gridX, gridZ, vesselType) {
        this.draggingVessel = true;
        this.dragStartGridX = gridX;
        this.dragStartGridZ = gridZ;
        this.currentVesselType = vesselType;
        this.updateHologramPreview(gridX, gridZ);
    }

    /**
     * Update hologram preview as user drags
     */
    updateHologramPreview(gridX, gridZ) {
        // Bounds checking
        if (gridX < 0 || gridX >= this.grid.width || gridZ < 0 || gridZ >= this.grid.height) {
            this.hideHologram();
            return;
        }

        this.previewGridX = gridX;
        this.previewGridZ = gridZ;

        // Check if placeable
        if (!this.canPlaceVessel(gridX, gridZ)) {
            this.showHologram(gridX, gridZ, COLORS.PLACEMENT_INVALID); // Red = not placeable
            return;
        }

        // Determine vessel type based on neighbors
        const connections = this.getConnectionDirections(gridX, gridZ);
        const vesselType = this.determineVesselType(connections);
        
        // Show green hologram = placeable
        this.showHologram(gridX, gridZ, 0x00ff88, vesselType);
        this.hologramPreviewActive = true;
    }

    /**
     * Show hologram preview
     */
    showHologram(gridX, gridZ, color = 0x00ff88, vesselType = 'straight_h') {
        // Remove old hologram
        if (this.hologramMesh) {
            this.vesselGroup.remove(this.hologramMesh);
            this.hologramMesh.geometry.dispose();
            this.hologramMesh.material.dispose();
        }

        // Create hologram geometry
        const geometry = this.createVesselGeometry(vesselType);
        const material = new THREE.MeshStandardMaterial({
            color: color,
            transparent: true,
            opacity: 0.4,
            emissive: color,
            emissiveIntensity: 0.5,
            metalness: 0.5,
            roughness: 0.2
        });

        this.hologramMesh = new THREE.Mesh(geometry, material);
        this.hologramMesh.position.copy(this.grid.getWorldPosition(gridX, gridZ));
        this.hologramMesh.position.y = 0.1;
        
        this.vesselGroup.add(this.hologramMesh);
    }

    /**
     * Hide hologram preview
     */
    hideHologram() {
        if (this.hologramMesh) {
            this.vesselGroup.remove(this.hologramMesh);
            this.hologramMesh.geometry.dispose();
            this.hologramMesh.material.dispose();
            this.hologramMesh = null;
        }
        this.hologramPreviewActive = false;
    }

    /**
     * Stop dragging
     */
    stopDragging() {
        this.draggingVessel = false;
        // Keep preview visible until user clicks to confirm
    }

    /**
     * Confirm vessel placement (on second left-click)
     */
    confirmVesselPlacement() {
        if (!this.hologramPreviewActive || this.previewGridX === null) {
            return;
        }

        const gridX = this.previewGridX;
        const gridZ = this.previewGridZ;

        if (!this.canPlaceVessel(gridX, gridZ)) {
            return;
        }

        // Place the actual vessel
        this.placeVessel(gridX, gridZ);
        
        // Hide hologram
        this.hideHologram();

        console.log(`[VesselSystemV2] Vessel confirmed at [${gridX}, ${gridZ}]`);
    }

    /**
     * Place a vessel at grid coordinates  
     */
    placeVessel(gridX, gridZ) {
        const key = this.getKey(gridX, gridZ);
        
        // Remove if already exists
        if (this.vessels.has(key)) {
            this.removeVessel(gridX, gridZ);
        }

        // Get connections and determine type
        const connections = this.getConnectionDirections(gridX, gridZ);
        const vesselType = this.determineVesselType(connections);
        const direction = this.determineFlowDirection(connections);

        // Create mesh
        const geometry = this.createVesselGeometry(vesselType);
        const material = new THREE.MeshStandardMaterial({
            color: 0x8B0000,
            metalness: 0.3,
            roughness: 0.7,
            emissive: 0x330000
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(this.grid.getWorldPosition(gridX, gridZ));
        mesh.position.y = 0.1;
        
        this.vesselGroup.add(mesh);

        // Create flow material for animated flow
        const flowMaterial = this.createFlowMaterial();

        // Store vessel
        this.vessels.set(key, {
            mesh,
            type: vesselType,
            connections,
            direction,
            gridX,
            gridZ,
            flowMaterial,
            flowParticles: []
        });

        // Create flow particles (optional visual enhancement)
        this.createFlowParticles(gridX, gridZ, direction);

        // Update neighbors
        this.updateNeighbors(gridX, gridZ);

        console.log(`[VesselSystemV2] Placed vessel at [${gridX}, ${gridZ}]: ${vesselType}, flow: ${direction}`);
        
        return mesh;
    }

    /**
     * Create flow particles to visualize direction
     */
    createFlowParticles(gridX, gridZ, direction) {
        // Create animated particles showing flow direction
        const vesselData = this.vessels.get(this.getKey(gridX, gridZ));
        if (!vesselData) return;

        const worldPos = this.grid.getWorldPosition(gridX, gridZ);
        
        // Create 3-4 particles per vessel for smooth flow animation
        for (let i = 0; i < 3; i++) {
            const particle = {
                position: new THREE.Vector3(worldPos.x, worldPos.y + 0.15, worldPos.z),
                direction: direction,
                speed: 0.5,
                progress: i / 3 // Stagger them
            };
            vesselData.flowParticles.push(particle);
        }
    }

    /**
     * Create flow material for animated flow effect
     */
    createFlowMaterial() {
        return new THREE.MeshStandardMaterial({
            color: 0xFF3333,
            emissive: 0xFF3333,
            emissiveIntensity: 0.8,
            transparent: true,
            opacity: 0.7
        });
    }

    /**
     * Determine flow direction based on connections
     * Returns primary flow direction (N, S, E, or W)
     */
    determineFlowDirection(connections) {
        // If only one connection, flow in that direction
        if (connections.length === 1) {
            return connections[0];
        }
        // Default: prefer north or east
        if (connections.includes('N')) return 'N';
        if (connections.includes('E')) return 'E';
        if (connections.includes('S')) return 'S';
        return 'W';
    }

    /**
     * Check if can place vessel at location
     */
    canPlaceVessel(gridX, gridZ) {
        // Check grid bounds
        if (gridX < 0 || gridX >= this.grid.width || gridZ < 0 || gridZ >= this.grid.height) {
            return false;
        }

        // Check if terrain is buildable
        const cellType = this.grid.getCellType(gridX, gridZ);
        if (cellType === this.grid.TERRAIN_TYPES.CALCIFIED) {
            return false;
        }

        // Already occupied
        if (this.vessels.has(this.getKey(gridX, gridZ))) {
            return false;
        }

        return true;
    }

    /**
     * Update neighbor vessels (retiling)
     */
    updateNeighbors(gridX, gridZ) {
        const neighborOffsets = [
            { x: 0, z: -1 },  // N
            { x: 0, z: 1 },   // S
            { x: 1, z: 0 },   // E
            { x: -1, z: 0 }   // W
        ];

        for (const offset of neighborOffsets) {
            const nX = gridX + offset.x;
            const nZ = gridZ + offset.z;
            const nKey = this.getKey(nX, nZ);

            if (this.vessels.has(nKey)) {
                const neighborData = this.vessels.get(nKey);
                
                // Recalculate neighbors for this vessel
                const newConnections = this.getConnectionDirections(nX, nZ);
                const newType = this.determineVesselType(newConnections);
                const newDirection = this.determineFlowDirection(newConnections);

                // Update if geometry changed
                if (newType !== neighborData.type) {
                    const newGeometry = this.createVesselGeometry(newType);
                    neighborData.mesh.geometry.dispose();
                    neighborData.mesh.geometry = newGeometry;
                    neighborData.type = newType;
                    neighborData.direction = newDirection;
                }
            }
        }
    }

    /**
     * Remove a vessel
     */
    removeVessel(gridX, gridZ) {
        const key = this.getKey(gridX, gridZ);
        const vesselData = this.vessels.get(key);
        
        if (vesselData) {
            this.vesselGroup.remove(vesselData.mesh);
            vesselData.mesh.geometry.dispose();
            vesselData.mesh.material.dispose();
            
            this.vessels.delete(key);
            this.updateNeighbors(gridX, gridZ);
            
            console.log(`[VesselSystemV2] Removed vessel at [${gridX}, ${gridZ}]`);
        }
    }

    /**
     * Get grid position from mouse (raycasting)
     */
    getGridPositionFromMouse(raycaster, mouse) {
        if (!this.grid.gridMesh) return null;

        raycaster.setFromCamera(mouse, this.inputManager.camera);
        const intersects = raycaster.intersectObject(this.grid.gridMesh);

        if (intersects.length > 0) {
            const point = intersects[0].point;
            const gridX = Math.floor(point.x / this.grid.cellSize + this.grid.width / 2);
            const gridZ = Math.floor(point.z / this.grid.cellSize + this.grid.height / 2);
            return { x: gridX, z: gridZ };
        }

        return null;
    }

    /**
     * Get neighboring connections
     */
    getConnectionDirections(gridX, gridZ) {
        const connections = [];
        const checkPositions = [
            { dir: 'N', offset: { x: 0, z: -1 } },
            { dir: 'S', offset: { x: 0, z: 1 } },
            { dir: 'E', offset: { x: 1, z: 0 } },
            { dir: 'W', offset: { x: -1, z: 0 } }
        ];

        for (const check of checkPositions) {
            const nX = gridX + check.offset.x;
            const nZ = gridZ + check.offset.z;
            
            if (nX >= 0 && nX < this.grid.width && nZ >= 0 && nZ < this.grid.height) {
                if (this.vessels.has(this.getKey(nX, nZ))) {
                    connections.push(check.dir);
                }
            }
        }

        return connections;
    }

    /**
     * Determine vessel type from connections
     */
    determineVesselType(connections) {
        if (connections.length === 0) {
            return this.VESSEL_TYPES.STRAIGHT_H;
        }

        if (connections.length === 1) {
            // Dead-end (treat as straight)
            return this.VESSEL_TYPES.STRAIGHT_H;
        }

        if (connections.length === 2) {
            const conn = connections.sort().join('');
            
            if (conn === 'EW') return this.VESSEL_TYPES.STRAIGHT_H;
            if (conn === 'NS') return this.VESSEL_TYPES.STRAIGHT_V;
            if (conn === 'EN') return this.VESSEL_TYPES.CORNER_NE;
            if (conn === 'ES') return this.VESSEL_TYPES.CORNER_SE;
            if (conn === 'NW') return this.VESSEL_TYPES.CORNER_NW;
            if (conn === 'SW') return this.VESSEL_TYPES.CORNER_SW;
        }

        if (connections.length === 3) {
            if (!connections.includes('N')) return this.VESSEL_TYPES.T_SOUTH;
            if (!connections.includes('S')) return this.VESSEL_TYPES.T_NORTH;
            if (!connections.includes('E')) return this.VESSEL_TYPES.T_WEST;
            if (!connections.includes('W')) return this.VESSEL_TYPES.T_EAST;
        }

        if (connections.length === 4) {
            return this.VESSEL_TYPES.CROSS;
        }

        return this.VESSEL_TYPES.STRAIGHT_H;
    }

    /**
     * Create vessel geometry based on type
     */
    createVesselGeometry(vesselType) {
        const geometry = new THREE.BufferGeometry();
        const radius = 0.15;

        // Simple box-like tubes for now (can be optimized to organic tubes)
        switch (vesselType) {
            case this.VESSEL_TYPES.STRAIGHT_H:
            case this.VESSEL_TYPES.STRAIGHT_V:
                return new THREE.CylinderGeometry(radius, radius, 1.0, 8);
            
            case this.VESSEL_TYPES.CORNER_NE:
            case this.VESSEL_TYPES.CORNER_NW:
            case this.VESSEL_TYPES.CORNER_SE:
            case this.VESSEL_TYPES.CORNER_SW:
                return new THREE.CylinderGeometry(radius, radius, 0.7, 8);
            
            case this.VESSEL_TYPES.T_NORTH:
            case this.VESSEL_TYPES.T_SOUTH:
            case this.VESSEL_TYPES.T_EAST:
            case this.VESSEL_TYPES.T_WEST:
                return new THREE.CylinderGeometry(radius * 0.8, radius * 0.8, 0.6, 8);
            
            case this.VESSEL_TYPES.CROSS:
                return new THREE.CylinderGeometry(radius * 0.6, radius * 0.6, 0.5, 8);
            
            default:
                return new THREE.CylinderGeometry(radius, radius, 1.0, 8);
        }
    }

    /**
     * Animate flow visualization
     */
    updateFlowAnimation(deltaTime) {
        this.flowTime += deltaTime * this.flowSpeed;

        // Update particles for each vessel
        for (const [key, vesselData] of this.vessels) {
            if (!vesselData.flowParticles) continue;

            for (const particle of vesselData.flowParticles) {
                // Move particle along flow direction
                const dir = this.DIRECTIONS[particle.direction];
                particle.progress += deltaTime * 0.3;

                // Loop animation
                if (particle.progress > 1.0) {
                    particle.progress -= 1.0;
                }

                // Could visualize this with rendered particles (omitted for now)
            }
        }
    }

    /**
     * Get string key for coordinates
     */
    getKey(x, z) {
        return `${x},${z}`;
    }

    /**
     * Get stats
     */
    getStats() {
        return {
            vesselCount: this.vessels.size
        };
    }
}

export default VesselSystemV2;
