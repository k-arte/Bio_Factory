import BiomarkerMonitor from './BiomarkerMonitor.js';
import Inventory from './Inventory.js';
import Hotbar from './Hotbar.js';

/**
 * HUD.js: Medical Glass themed HUD system
 * Features:
 * - Biomarker monitor with real-time health graphs
 * - Top bar with Diagnostics button and Resource Counters
 * - Hotbar with building selection (1-6 hotkeys)
 * - Inventory panel showing resources and available buildings
 * - Cursor tooltip showing terrain type and coordinates
 * - Drag-to-place building system with hologram preview
 */
class HUD {
    constructor(inputManager) {
        this.inputManager = inputManager;
        
        // UI state
        this.selectedBuilding = null;
        this.cursorPosition = { x: 0, y: 0 };
        this.terrainType = 'Unknown';
        this.gridCoordinates = { x: 0, z: 0 };

        // Initialize biomarker monitor
        this.biomarkerMonitor = new BiomarkerMonitor();
        
        // Initialize inventory and hotbar
        this.inventory = new Inventory(this);
        this.hotbar = new Hotbar(this.inventory, inputManager, this);

        // Create HUD elements
        this.createTopBar();
        this.createCursorTooltip();

        // Setup interactivity
        this.setupEventListeners();
    }

    /**
     * Create top bar with diagnostics and resource counters
     */
    createTopBar() {
        const topBar = document.createElement('div');
        topBar.id = 'hud-top-bar';
        topBar.className = 'hud-bar hud-top-bar';
        
        topBar.innerHTML = `
            <div class="hud-section">
                <button id="btn-diagnostics" class="hud-btn hud-btn-diagnostic">
                    ▶ DIAGNOSTICS
                </button>
            </div>
            <div class="hud-section hud-resources">
                <div class="resource-item">
                    <span class="resource-label">ION</span>
                    <span id="counter-ion" class="resource-value">0</span>
                </div>
                <div class="resource-item">
                    <span class="resource-label">PROTEIN</span>
                    <span id="counter-protein" class="resource-value">0</span>
                </div>
                <div class="resource-item">
                    <span class="resource-label">GLUCOSE</span>
                    <span id="counter-glucose" class="resource-value">0</span>
                </div>
                <div class="resource-item">
                    <span class="resource-label">FLOW</span>
                    <span id="counter-flow" class="resource-value">0</span>
                </div>
            </div>
        `;

        document.body.appendChild(topBar);
        
        // Store references
        this.diagnosticsBtn = topBar.querySelector('#btn-diagnostics');
        this.resourceCounters = {
            ion: topBar.querySelector('#counter-ion'),
            protein: topBar.querySelector('#counter-protein'),
            glucose: topBar.querySelector('#counter-glucose'),
            flow: topBar.querySelector('#counter-flow')
        };
    }

    /**
     * Create cursor tooltip that follows the mouse
     */
    createCursorTooltip() {
        const tooltip = document.createElement('div');
        tooltip.id = 'hud-cursor-tooltip';
        tooltip.className = 'hud-cursor-tooltip';

        tooltip.innerHTML = `
            <div class="tooltip-row">
                <span class="tooltip-label">TERRAIN:</span>
                <span id="tooltip-terrain" class="tooltip-value">Endothelium</span>
            </div>
            <div class="tooltip-row">
                <span class="tooltip-label">COORDS:</span>
                <span id="tooltip-coords" class="tooltip-value">[0, 0]</span>
            </div>
        `;

        document.body.appendChild(tooltip);
        this.tooltip = tooltip;
        this.tooltipTerrainSpan = tooltip.querySelector('#tooltip-terrain');
        this.tooltipCoordsSpan = tooltip.querySelector('#tooltip-coords');

        // Update tooltip position on mouse move
        document.addEventListener('mousemove', (e) => {
            this.cursorPosition.x = e.clientX;
            this.cursorPosition.y = e.clientY;
            this.updateTooltipPosition();
        });
    }

    /**
     * Update tooltip position to follow cursor
     */
    updateTooltipPosition() {
        const offset = 15;
        this.tooltip.style.left = (this.cursorPosition.x + offset) + 'px';
        this.tooltip.style.top = (this.cursorPosition.y + offset) + 'px';
    }

    /**
     * Select a building type (if available)
     */
    selectBuilding(buildingType) {
        if (!this.inventory.canAfford(buildingType)) {
            console.warn(`Cannot afford ${buildingType}`);
            return;
        }

        this.selectedBuilding = buildingType;
        console.log(`[HUD] Building selected: ${buildingType}`);
    }

    /**
     * Deselect current building
     */
    deselectBuilding() {
        this.selectedBuilding = null;
        console.log('[HUD] Building deselected');
    }

    /**
     * Update cursor info (terrain type and coordinates)
     * Called from InputManager on hover
     */
    updateCursorInfo(terrainType, gridX, gridZ) {
        this.terrainType = terrainType;
        this.gridCoordinates = { x: gridX, z: gridZ };

        this.tooltipTerrainSpan.textContent = terrainType || 'Unknown';
        this.tooltipCoordsSpan.textContent = `[${gridX}, ${gridZ}]`;

        // Color code terrain type
        const terrainColors = {
            'Endothelium': '#00ff00',       // Green (buildable)
            'Calcified Tissue': '#ff4444',  // Red (blocked)
            'Capillary Bed': '#ffff00'      // Yellow (resource)
        };

        this.tooltipTerrainSpan.style.color = terrainColors[terrainType] || '#00ffff';
    }

    /**
     * Update resource counters
     */
    updateResources(ion, protein, glucose, flowRate) {
        this.resources.ion = ion;
        this.resources.protein = protein;
        this.resources.glucose = glucose;
        this.resources.flowRate = flowRate;

        if (this.resourceCounters.ion) this.resourceCounters.ion.textContent = ion;
        if (this.resourceCounters.protein) this.resourceCounters.protein.textContent = protein;
        if (this.resourceCounters.glucose) this.resourceCounters.glucose.textContent = glucose;
        if (this.resourceCounters.flow) this.resourceCounters.flow.textContent = flowRate;
    }

    /**
     * Update biomarker values (WBC, pH, Glucose, Oxygen)
     */
    updateBiomarkers(data) {
        if (this.biomarkerMonitor) {
            this.biomarkerMonitor.updateBiomarkers(data);
        }
    }

    /**
     * Simulate biomarker fluctuation (for testing/demo)
     */
    simulateBiomarkers() {
        if (this.biomarkerMonitor) {
            this.biomarkerMonitor.simulateBiomarkers();
        }
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Diagnostics button
        if (this.diagnosticsBtn) {
            this.diagnosticsBtn.addEventListener('click', () => {
                console.log('[HUD] Diagnostics button clicked');
                // Would trigger diagnostics panel here
            });
        }

        // ESC key to deselect building
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.selectedBuilding) {
                this.deselectBuilding();
            }
        });
    }

    /**
     * Show/hide entire HUD
     */
    setVisible(visible) {
        const topBar = document.querySelector('#hud-top-bar');
        const bottomBar = document.querySelector('#hud-bottom-bar');
        const monitor = document.querySelector('#biomarker-monitor');
        
        if (topBar) topBar.style.display = visible ? 'flex' : 'none';
        if (bottomBar) bottomBar.style.display = visible ? 'flex' : 'none';
        if (monitor) monitor.style.display = visible ? 'block' : 'none';
        if (this.tooltip) this.tooltip.style.display = visible ? 'block' : 'none';
    }

    /**
     * Clean up HUD resources
     */
    destroy() {
        const topBar = document.querySelector('#hud-top-bar');
        const bottomBar = document.querySelector('#hud-bottom-bar');
        
        if (topBar) topBar.remove();
        if (bottomBar) bottomBar.remove();
        if (this.tooltip) this.tooltip.remove();
    }
}

export default HUD;
