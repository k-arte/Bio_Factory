import * as THREE from 'three';

/**
 * InputManager: Centralized input handling with UI/terrain awareness
 * Features:
 * - Building placement with ghost preview
 * - Terrain inspection on hover
 * - Prevents camera conflicts when UI is open
 * - Raycasting for building detection and terrain analysis
 * - Vessel/pipe placement with auto-tiling
 */
class InputManager {
    constructor(camera, renderer, scene, grid, hud, vesselSystem = null) {
        this.camera = camera;
        this.renderer = renderer;
        this.scene = scene;
        this.grid = grid;
        this.hud = hud;
        this.vesselSystem = vesselSystem;
        
        // UI state
        this.isUIOpen = false;
        this.selectedBuilding = null;
        
        // Building placement state
        this.selectedBuildingType = null;
        this.ghostMesh = null;
        this.lastHoveredCell = { x: -1, z: -1 };
        
        // Raycasting
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        this.raycastPoint = new THREE.Vector3();
        
        // Event listeners
        this.listeners = {
            buildingClicked: null,
            groundClicked: null,
            uiStateChanged: null,
            buildingPlaced: null,
            vesselPlaced: null
        };
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Canvas click detection for building/ground interaction
        this.renderer.domElement.addEventListener('click', (e) => this.onCanvasClick(e));
        
        // Mouse move for terrain inspection and ghost preview
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));
        
        // ESC to close UI or deselect building
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.isUIOpen) {
                    this.setUIOpen(false);
                } else if (this.selectedBuildingType) {
                    this.selectedBuildingType = null;
                    this.hideGhost();
                }
            }
        });
    }

    onCanvasClick(event) {
        // If UI is open, ignore game interactions (only UI elements respond)
        if (this.isUIOpen) return;

        // Convert mouse position to normalized device coordinates
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // Handle building placement if a building type is selected
        if (this.selectedBuildingType && this.selectedBuildingType !== 'eraser') {
            this.placeBuildingAtMouse();
            return;
        }

        // Handle eraser (delete building)
        if (this.selectedBuildingType === 'eraser') {
            this.eraseBuildingAtMouse();
            return;
        }

        // Perform raycasting against all objects with building data
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Find all buildable objects in the scene
        const buildingObjects = [];
        this.scene.traverse((obj) => {
            if (obj.userData.building) {
                buildingObjects.push(obj);
            }
        });

        if (buildingObjects.length > 0) {
            const intersects = this.raycaster.intersectObjects(buildingObjects);

            if (intersects.length > 0) {
                const clickedObject = intersects[0].object;
                const building = clickedObject.userData.building;
                this.selectedBuilding = building;

                if (this.listeners.buildingClicked) {
                    this.listeners.buildingClicked(building);
                }
                return;
            }
        }

        // Ground click (no building hit)
        this.raycaster.setFromCamera(this.mouse, this.camera);
        this.raycaster.ray.intersectPlane(this.groundPlane, this.raycastPoint);

        if (this.listeners.groundClicked) {
            this.listeners.groundClicked(this.raycastPoint);
        }
    }

    /**
     * Handle mouse move for terrain inspection and ghost preview
     */
    onMouseMove(event) {
        // Update mouse position
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // Raycast to ground plane
        this.raycaster.setFromCamera(this.mouse, this.camera);
        this.raycaster.ray.intersectPlane(this.groundPlane, this.raycastPoint);

        // Get grid cell from raycast point
        const cell = this.grid.getGridCell(this.raycastPoint);

        // Update terrain info in HUD
        if (this.hud) {
            const terrainType = this.grid.getCellType(cell.x, cell.z);
            this.hud.updateCursorInfo(terrainType, cell.x, cell.z);
        }

        // Update ghost preview if building is selected
        if (this.selectedBuildingType) {
            this.updateGhostPreview(cell);
        }

        this.lastHoveredCell = cell;
    }

    /**
     * Create or update ghost building preview
     */
    updateGhostPreview(cell) {
        const isBuildable = this.grid.isBuildable(cell.x, cell.z);
        const worldPos = this.grid.getWorldPosition(cell.x, cell.z);

        // Create ghost if it doesn't exist
        if (!this.ghostMesh) {
            this.createGhost(this.selectedBuildingType, isBuildable);
        }

        // Update position
        if (this.ghostMesh) {
            this.ghostMesh.position.copy(worldPos);
            
            // Update color based on buildability
            this.updateGhostColor(isBuildable);
        }
    }

    /**
     * Create ghost building mesh
     */
    createGhost(buildingType, isBuildable) {
        this.hideGhost();

        let geometry;

        // Define geometry based on building type
        switch (buildingType) {
            case 'extractor':
                geometry = new THREE.ConeGeometry(0.4, 1.0, 8);
                break;
            case 'vessel':
                // Show a straight pipe for vessel preview
                geometry = new THREE.CylinderGeometry(0.15, 0.15, 1.0, 8);
                break;
            case 'storage':
                geometry = new THREE.BoxGeometry(0.8, 1.0, 0.8);
                break;
            default:
                geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        }

        const material = new THREE.MeshStandardMaterial({
            emissive: isBuildable ? 0x00ff00 : 0xff0000,
            transparent: true,
            opacity: 0.5,
            wireframe: false
        });

        this.ghostMesh = new THREE.Mesh(geometry, material);
        this.ghostMesh.userData.isGhost = true;
        this.ghostMesh.position.y = 0.1; // Slightly above ground
        this.scene.add(this.ghostMesh);
    }

    /**
     * Update ghost color based on terrain buildability
     */
    updateGhostColor(isBuildable) {
        if (!this.ghostMesh) return;

        const material = this.ghostMesh.material;
        if (isBuildable) {
            material.emissive.setHex(0x00ff00); // Green = buildable
        } else {
            material.emissive.setHex(0xff0000); // Red = blocked
        }
    }

    /**
     * Hide ghost building preview
     */
    hideGhost() {
        if (this.ghostMesh) {
            this.scene.remove(this.ghostMesh);
            this.ghostMesh.geometry.dispose();
            this.ghostMesh.material.dispose();
            this.ghostMesh = null;
        }
    }

    /**
     * Place building at current mouse position
     */
    placeBuildingAtMouse() {
        if (!this.selectedBuildingType || !this.grid.isBuildable(this.lastHoveredCell.x, this.lastHoveredCell.z)) {
            // Cannot build on non-buildable terrain
            console.warn('[InputManager] Cannot place building on non-buildable terrain');
            return;
        }

        // Handle vessel placement separately
        if (this.selectedBuildingType === 'vessel' && this.vesselSystem) {
            this.vesselSystem.placeVessel(this.lastHoveredCell.x, this.lastHoveredCell.z);
            
            // Emit vessel placed event
            if (this.listeners.vesselPlaced) {
                this.listeners.vesselPlaced({
                    type: 'vessel',
                    gridPos: this.lastHoveredCell
                });
            }
            
            console.log(`[InputManager] Vessel placed at [${this.lastHoveredCell.x}, ${this.lastHoveredCell.z}]`);
            return;
        }

        const worldPos = this.grid.getWorldPosition(this.lastHoveredCell.x, this.lastHoveredCell.z);

        // Create actual building
        let geometry;
        switch (this.selectedBuildingType) {
            case 'extractor':
                geometry = new THREE.ConeGeometry(0.4, 1.0, 8);
                break;
            case 'storage':
                geometry = new THREE.BoxGeometry(0.8, 1.0, 0.8);
                break;
            default:
                return;
        }

        const material = new THREE.MeshStandardMaterial({
            color: this.getBuildingColor(this.selectedBuildingType),
            metalness: 0.6,
            roughness: 0.4
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(worldPos);
        mesh.position.y = 0.5;
        mesh.userData.building = {
            type: this.selectedBuildingType,
            gridX: this.lastHoveredCell.x,
            gridZ: this.lastHoveredCell.z
        };

        this.scene.add(mesh);

        // Emit event
        if (this.listeners.buildingPlaced) {
            this.listeners.buildingPlaced({
                type: this.selectedBuildingType,
                position: worldPos,
                gridPos: this.lastHoveredCell
            });
        }

        console.log(`[InputManager] Building placed: ${this.selectedBuildingType} at [${this.lastHoveredCell.x}, ${this.lastHoveredCell.z}]`);
    }

    /**
     * Get building color by type
     */
    getBuildingColor(buildingType) {
        const colors = {
            'extractor': 0x2d5a2d,   // Dark green
            'vessel': 0x661a1a,      // Deep red
            'storage': 0x444444      // Gray
        };
        return colors[buildingType] || 0x888888;
    }

    /**
     * Erase building at current mouse position
     */
    eraseBuildingAtMouse() {
        this.raycaster.setFromCamera(this.mouse, this.camera);

        // Find all buildable objects in the scene
        const buildingObjects = [];
        this.scene.traverse((obj) => {
            if (obj.userData.building) {
                buildingObjects.push(obj);
            }
        });

        if (buildingObjects.length > 0) {
            const intersects = this.raycaster.intersectObjects(buildingObjects);

            if (intersects.length > 0) {
                const clickedObject = intersects[0].object;
                this.scene.remove(clickedObject);
                clickedObject.geometry.dispose();
                clickedObject.material.dispose();
                console.log('[InputManager] Building erased');
            }
        }
    }

    /**
     * Subscribe to input events
     */
    on(eventName, callback) {
        if (this.listeners.hasOwnProperty(eventName)) {
            this.listeners[eventName] = callback;
        }
    }

    /**
     * Set UI open state
     * When true, prevents camera zoom/pan input
     */
    setUIOpen(open) {
        this.isUIOpen = open;
        if (this.listeners.uiStateChanged) {
            this.listeners.uiStateChanged(open);
        }
    }

    /**
     * Get currently selected building
     */
    getSelectedBuilding() {
        return this.selectedBuilding;
    }

    /**
     * Clear building selection
     */
    clearSelection() {
        this.selectedBuilding = null;
    }

    /**
     * Update ghost mesh color and visibility
     */
    update() {
        // This can be called from the main engine loop if needed for animations
    }
}

export default InputManager;
