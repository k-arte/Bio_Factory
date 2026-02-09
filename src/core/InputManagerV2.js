import * as THREE from 'three';
import { COLORS } from '../data/Colors.js';

/**
 * InputManagerV2: Updated for drag-to-place, Hotbar/Inventory integration
 * Features:
 * - Building selection from Hotbar
 * - Drag-to-place with hologram preview
 * - Two-click confirmation (drag preview → left-click to confirm)
 * - Terrain inspection on hover
 * - Raycasting for building detection
 */
class InputManagerV2 {
    constructor(camera, renderer, scene, grid, hud, vesselSystemV2 = null) {
        this.camera = camera;
        this.renderer = renderer;
        this.scene = scene;
        this.grid = grid;
        this.hud = hud;
        this.vesselSystemV2 = vesselSystemV2;
        
        // UI state
        this.isUIOpen = false;
        this.selectedBuildingType = null;
        this.hotbar = null;
        this.inventory = null;
        
        // Building placement state
        this.ghostMesh = null;
        this.lastHoveredCell = { x: -1, z: -1 };
        this.isDraggingBuilding = false;
        this.dragStartPos = null;
        
        // Raycasting
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        this.raycastPoint = new THREE.Vector3();
        
        // Event listeners
        this.listeners = {
            buildingClicked: null,
            groundClicked: null,
            buildingPlaced: null
        };
        
        this.setupEventListeners();
    }

    /**
     * Set hotbar and inventory references
     */
    setHotbarAndInventory(hotbar, inventory) {
        this.hotbar = hotbar;
        this.inventory = inventory;
    }

    /**
     * Set placement manager reference
     */
    setPlacementManager(placementManager) {
        this.placementManager = placementManager;
        console.log('[InputManagerV2] PlacementManager wired');
    }

    /**
     * Select a building type from hotbar
     */
    selectBuildingType(buildingKey) {
        this.selectedBuildingType = buildingKey;
        
        if (!buildingKey) {
            this.hideGhost();
            return;
        }

        // Get building info from inventory
        const building = this.inventory.getBuilding(buildingKey);
        if (!building) return;

        console.log(`[InputManagerV2] Selected building: ${building.name}`);
    }

    setupEventListeners() {
        // Canvas click detection for building/ground interaction
        this.renderer.domElement.addEventListener('mousedown', (e) => this.onCanvasMouseDown(e));
        this.renderer.domElement.addEventListener('mouseup', (e) => this.onCanvasMouseUp(e));
        
        // Mouse move for terrain inspection and ghost preview
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));
        
        // ESC to deselect building
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.selectedBuildingType) {
                    this.selectBuildingType(null);
                    if (this.hotbar) {
                        this.hotbar.deselectBuilding();
                    }
                }
            }
        });
    }

    /**
     * Handle mouse down for drag-to-place start
     */
    onCanvasMouseDown(event) {
        if (this.isUIOpen || !this.selectedBuildingType) return;

        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // For vessels, start drag-to-place
        if (this.selectedBuildingType === 'vessel' && this.vesselSystemV2) {
            this.isDraggingBuilding = true;
            this.dragStartPos = { x: event.clientX, y: event.clientY };
            this.vesselSystemV2.startDraggingVessel(
                this.lastHoveredCell.x,
                this.lastHoveredCell.z,
                'vessel'
            );
        }
    }

    /**
     * Handle mouse up for drag-to-place end
     */
    onCanvasMouseUp(event) {
        if (this.isDraggingBuilding) {
            this.isDraggingBuilding = false;
            if (this.vesselSystemV2) {
                this.vesselSystemV2.stopDragging();
            }
        } else if (this.selectedBuildingType && this.selectedBuildingType !== 'vessel') {
            // For non-vessel buildings, place them on left-click
            this.placeBuilding();
        }
    }

    /**
     * Handle mouse move for ghost preview and terrain inspection
     */
    onMouseMove(event) {
        // Get mouse position
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // Raycast to find grid position
        this.raycaster.setFromCamera(this.mouse, this.camera);

        // Test intersection with ground plane
        const gridPos = this.getGridPositionFromMouse();
        
        if (gridPos.x >= 0 && gridPos.x < this.grid.width && 
            gridPos.z >= 0 && gridPos.z < this.grid.height) {
            
            this.lastHoveredCell = { x: gridPos.x, z: gridPos.z };

            // Update HUD cursor info
            const terrainType = this.grid.getCellType(gridPos.x, gridPos.z);
            const terrainName = this.getTerrainName(terrainType);
            if (this.hud) {
                this.hud.updateCursorInfo(terrainName, gridPos.x, gridPos.z);
            }

            // Update ghost preview if building selected
            if (this.selectedBuildingType && !this.isDraggingBuilding) {
                this.updateGhostPreview(gridPos.x, gridPos.z);
            }

            // For drag-to-place, update vessel hologram  
            if (this.isDraggingBuilding && this.vesselSystemV2) {
                // Handled by VesselSystemV2.dragListener
            }
        }

        // Update cursor tooltip position
        if (this.hud && this.hud.tooltip) {
            this.hud.updateTooltipPosition();
            this.hud.cursorPosition = { x: event.clientX, y: event.clientY };
        }
    }

    /**
     * Get grid position from mouse coordinates
     */
    getGridPositionFromMouse() {
        // Use groundPlane intersection
        this.raycaster.ray.intersectPlane(this.groundPlane, this.raycastPoint);
        
        // Convert world position to grid coordinates
        const gridX = Math.floor(
            this.raycastPoint.x / this.grid.cellSize + this.grid.width / 2
        );
        const gridZ = Math.floor(
            this.raycastPoint.z / this.grid.cellSize + this.grid.height / 2
        );

        return { x: gridX, z: gridZ };
    }

    /**
     * Get terrain name from type
     */
    getTerrainName(terrainType) {
        const names = {
            0: 'Endothelium',
            1: 'Calcified Tissue',
            2: 'Capillary Bed'
        };
        return names[terrainType] || 'Unknown';
    }

    /**
     * Update ghost preview for selected building
     */
    updateGhostPreview(gridX, gridZ) {
        const isBuildable = this.grid.isBuildable(gridX, gridZ);

        // Check if this specific building can be placed
        const building = this.inventory.getBuilding(this.selectedBuildingType);
        if (!building) return;

        if (!this.ghostMesh) {
            this.createGhost(this.selectedBuildingType, isBuildable);
        }

        // Update ghost position
        const worldPos = this.grid.getWorldPosition(gridX, gridZ);
        this.ghostMesh.position.set(worldPos.x, 0.1, worldPos.z);

        // Update color
        this.updateGhostColor(isBuildable && this.inventory.canAfford(this.selectedBuildingType));
    }

    /**
     * Create ghost mesh for preview
     */
    createGhost(buildingType, isBuildable = true) {
        let geometry;
        const building = this.inventory.getBuilding(buildingType);

        if (buildingType === 'vessel') {
            geometry = new THREE.CylinderGeometry(0.15, 0.15, 1.0, 8);
        } else if (buildingType === 'extractor') {
            geometry = new THREE.ConeGeometry(0.4, 1.0, 8);
        } else if (buildingType === 'mitochondria') {
            geometry = new THREE.BoxGeometry(0.6, 0.8, 0.6);
        } else if (buildingType === 'storage') {
            geometry = new THREE.BoxGeometry(0.8, 1.0, 0.8);
        } else {
            geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        }

        const material = new THREE.MeshStandardMaterial({
            emissive: isBuildable ? COLORS.PLACEMENT_VALID : COLORS.PLACEMENT_INVALID,
            transparent: true,
            opacity: 0.4,
            wireframe: false
        });

        this.ghostMesh = new THREE.Mesh(geometry, material);
        this.ghostMesh.userData.isGhost = true;
        this.ghostMesh.position.y = 0.1;
        this.scene.add(this.ghostMesh);
    }

    /**
     * Update ghost color based on affordability
     */
    updateGhostColor(canBuild) {
        if (!this.ghostMesh) return;

        const material = this.ghostMesh.material;
        if (canBuild) {
            material.emissive.setHex(COLORS.PLACEMENT_VALID); // Green = buildable and affordable
        } else {
            material.emissive.setHex(COLORS.PLACEMENT_INVALID); // Red = cannot build
        }
    }

    /**
     * Hide ghost preview
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
     * Place building at current mouse position (single-click for non-vessel)
     */
    placeBuilding() {
        if (!this.selectedBuildingType || !this.inventory.canAfford(this.selectedBuildingType)) {
            console.warn('[InputManagerV2] Cannot place building: not selected or cannot afford');
            return;
        }

        const gridX = this.lastHoveredCell.x;
        const gridZ = this.lastHoveredCell.z;

        // Check buildability
        if (!this.grid.isBuildable(gridX, gridZ)) {
            console.warn('[InputManagerV2] Cannot place on non-buildable terrain');
            return;
        }

        // Handle vessel separately (uses drag+confirm)
        if (this.selectedBuildingType === 'vessel') {
            console.log('[InputManagerV2] Use drag-to-place for vessels');
            return;
        }

        // For other buildings, deduct cost and place
        if (!this.inventory.deductCost(this.selectedBuildingType)) {
            console.warn('[InputManagerV2] Failed to deduct building cost');
            return;
        }

        const building = this.inventory.getBuilding(this.selectedBuildingType);
        console.log(`[InputManagerV2] Placing ${building.name} at [${gridX}, ${gridZ}]`);

        // ACTUALLY PLACE THE BUILDING via PlacementManager
        if (this.placementManager) {
            // Support both BioDatabase IDs (like 'BLD_EXTRACTOR') and UI types (like 'extractor')
            const isBioDatabaseId = this.selectedBuildingType.startsWith('BLD_');
            
            if (isBioDatabaseId) {
                // Place by BioDatabase ID
                this.placementManager.placeByDatabaseId(this.selectedBuildingType, gridX, gridZ);
                console.log(`[InputManagerV2] ✓ Building ${this.selectedBuildingType} placed at [${gridX}, ${gridZ}]`);
            } else if (this.selectedBuildingType === 'extractor') {
                // Legacy: UI type-based placement
                this.placementManager.placeExtractor(gridX, gridZ);
                console.log(`[InputManagerV2] ✓ Extractor placed at [${gridX}, ${gridZ}]`);
            } else if (this.selectedBuildingType === 'storage') {
                // Legacy: UI type-based placement
                this.placementManager.placeStorage(gridX, gridZ);
                console.log(`[InputManagerV2] ✓ Storage placed at [${gridX}, ${gridZ}]`);
            } else {
                console.warn(`[InputManagerV2] No handler for building type: ${this.selectedBuildingType}`);
            }
        } else {
            console.warn('[InputManagerV2] PlacementManager not available');
        }

        // Deselect after placing
        this.selectBuildingType(null);
        if (this.hotbar) {
            this.hotbar.deselectBuilding();
        }
    }

    /**
     * Get reference to raycaster (for VesselSystemV2 drag detection)
     */
    getRaycaster() {
        return this.raycaster;
    }

    /**
     * Get reference to mouse (for VesselSystemV2 drag detection)
     */
    getMouse() {
        return this.mouse;
    }
}

export default InputManagerV2;
