import * as THREE from 'three';

/**
 * UIManager: Manages all HTML-based UI including HUD, status panels, and diagnostics
 * Handles floating information panels that follow buildings
 * Manages full-screen diagnostics overlay
 */
class UIManager {
    constructor(camera, renderer, inputManager) {
        this.camera = camera;
        this.renderer = renderer;
        this.inputManager = inputManager;
        this.container = document.body;

        // UI elements
        this.hudContainer = null;
        this.currentBuildingPanel = null;
        this.diagnosticsPanel = null;

        // Setup
        this.setupStyles();
        this.setupMainHUD();
        this.setupEventListeners();

        // Animation loop for panel updates
        this.animationFrame = null;
    }

    setupStyles() {
        // Create global style element
        const style = document.createElement('style');
        style.textContent = `
            * {
                font-family: 'Roboto Mono', 'Consolas', 'Monaco', monospace;
            }
            
            #main-hud button:hover {
                background: rgba(0, 255, 255, 0.2) !important;
                box-shadow: 0 0 8px rgba(0, 255, 255, 0.3);
                transition: all 0.2s ease;
            }
            
            #main-hud button:active {
                background: rgba(0, 255, 255, 0.3) !important;
            }
        `;
        document.head.appendChild(style);
    }

    setupMainHUD() {
        // Create main HUD container
        this.hudContainer = document.createElement('div');
        this.hudContainer.id = 'main-hud';
        this.hudContainer.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            width: 320px;
            background: rgba(10, 20, 30, 0.85);
            border: 1px solid #00ffff;
            border-radius: 4px;
            color: #00ffff;
            font-family: 'Roboto Mono', monospace;
            font-size: 11px;
            padding: 15px;
            z-index: 100;
            backdrop-filter: blur(4px);
        `;

        this.hudContainer.innerHTML = `
            <div style="margin-bottom: 12px; border-bottom: 1px solid rgba(0, 255, 255, 0.3); padding-bottom: 8px;">
                <strong style="color: #00ffff;">/// CELL FACTORY v0.1</strong>
            </div>
            
            <div id="factory-stats" style="font-size: 10px; margin-bottom: 12px; line-height: 1.8; color: #ccffff;">
                <div>▸ Extractors: <span id="extractor-count" style="color: #ffaaaa;">0</span></div>
                <div>▸ Vessels: <span id="vessel-count" style="color: #ffaa88;">0</span></div>
                <div>▸ Storage: <span id="storage-count" style="color: #aa88ff;">0</span></div>
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(0, 255, 255, 0.2);">
                    ▸ Resources: <span id="resource-flow" style="color: #ffff88;">0</span>
                </div>
            </div>
            
            <button id="diagnostics-btn" style="
                width: 100%;
                padding: 10px;
                background: rgba(0, 255, 255, 0.1);
                border: 1px solid #00ffff;
                color: #00ffff;
                font-family: 'Roboto Mono', monospace;
                font-size: 11px;
                font-weight: bold;
                cursor: pointer;
                border-radius: 3px;
                transition: all 0.3s ease;
            ">► OPEN DIAGNOSTICS</button>
        `;

        this.container.appendChild(this.hudContainer);

        // Button listener
        document.getElementById('diagnostics-btn').addEventListener('click', () => {
            this.toggleDiagnosticsPanel();
        });
    }

    setupEventListeners() {
        // Listen for building selection from InputManager
        this.inputManager.on('buildingClicked', (building) => {
            this.showBuildingPanel(building);
        });

        // Listen for UI state changes
        this.inputManager.on('uiStateChanged', (isOpen) => {
            if (!isOpen && this.currentBuildingPanel) {
                this.hideBuildingPanel();
            }
        });
    }

    /**
     * Update factory statistics display
     */
    updateFactoryStats(stats) {
        if (!this.hudContainer) return;
        
        document.getElementById('extractor-count').textContent = stats.extractors || 0;
        document.getElementById('vessel-count').textContent = stats.vessels || 0;
        document.getElementById('storage-count').textContent = stats.storages || 0;
        document.getElementById('resource-flow').textContent = stats.resourcesInTransit || 0;
    }

    /**
     * Show floating status panel for a building
     */
    showBuildingPanel(building) {
        this.hideBuildingPanel();

        const panelDiv = document.createElement('div');
        panelDiv.style.cssText = `
            position: fixed;
            background: rgba(20, 30, 50, 0.92);
            border: 1px solid #ff4444;
            border-radius: 3px;
            color: #ffcccc;
            font-family: 'Roboto Mono', monospace;
            font-size: 10px;
            padding: 12px;
            min-width: 200px;
            max-width: 280px;
            z-index: 200;
            backdrop-filter: blur(4px);
            box-shadow: 0 4px 12px rgba(255, 68, 68, 0.2);
        `;

        const statusText = building.getStatusText ? building.getStatusText() : 'No data available';
        const buildingType = building.constructor.name;

        panelDiv.innerHTML = `
            <div style="
                color: #ff4444;
                font-weight: bold;
                margin-bottom: 10px;
                border-bottom: 1px solid rgba(255, 68, 68, 0.3);
                padding-bottom: 8px;
            ">
                ◆ ${buildingType}
            </div>
            <div style="font-size: 9px; line-height: 1.6; color: #ffdddd;">
                ${statusText}
            </div>
        `;

        this.container.appendChild(panelDiv);
        this.currentBuildingPanel = { element: panelDiv, building: building };

        // Start animation loop to follow building
        this.updateBuildingPanelPosition();
    }

    /**
     * Hide floating status panel
     */
    hideBuildingPanel() {
        if (this.currentBuildingPanel) {
            this.currentBuildingPanel.element.remove();
            this.currentBuildingPanel = null;
        }
    }

    /**
     * Update building panel position (called every frame)
     */
    updateBuildingPanelPosition() {
        if (!this.currentBuildingPanel) return;

        const building = this.currentBuildingPanel.building;
        const panelDiv = this.currentBuildingPanel.element;

        if (!building.position) return;

        // Convert world position to screen position
        const worldPos = new THREE.Vector3(
            building.position.x,
            building.position.y + 1,
            building.position.z
        );
        
        const screenPos = worldPos.project(this.camera);
        const canvas = this.renderer.domElement;

        const x = (screenPos.x * 0.5 + 0.5) * canvas.clientWidth;
        const y = (-screenPos.y * 0.5 + 0.5) * canvas.clientHeight;

        panelDiv.style.left = (x + 15) + 'px';
        panelDiv.style.top = (y - 60) + 'px';
    }

    /**
     * Toggle diagnostics panel visibility
     */
    toggleDiagnosticsPanel() {
        if (this.diagnosticsPanel) {
            this.diagnosticsPanel.remove();
            this.diagnosticsPanel = null;
            this.inputManager.setUIOpen(false);
        } else {
            this.createDiagnosticsPanel();
            this.inputManager.setUIOpen(true);
        }
    }

    /**
     * Create full-screen diagnostics panel
     */
    createDiagnosticsPanel() {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(10, 20, 30, 0.96);
            z-index: 500;
            overflow-y: auto;
            backdrop-filter: blur(2px);
        `;

        overlay.innerHTML = `
            <div style="
                max-width: 1000px;
                margin: 0 auto;
                padding: 40px 20px;
                color: #00ffff;
                font-family: 'Roboto Mono', monospace;
            ">
                <div style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 30px;
                    border-bottom: 2px solid #00ffff;
                    padding-bottom: 15px;
                ">
                    <h1 style="margin: 0; font-size: 26px; color: #00ffff;">
                        ◆ PATIENT DIAGNOSTIC SYSTEM
                    </h1>
                    <button id="close-diagnostics" style="
                        background: rgba(255, 68, 68, 0.1);
                        border: 1px solid #ff4444;
                        color: #ff4444;
                        padding: 8px 16px;
                        cursor: pointer;
                        font-family: 'Roboto Mono', monospace;
                        font-size: 10px;
                        border-radius: 3px;
                        transition: all 0.2s;
                    ">◄ CLOSE [ESC]</button>
                </div>

                <div style="
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 30px;
                    margin-bottom: 30px;
                ">
                    <!-- Biomarkers Panel -->
                    <div style="
                        border: 1px solid #00ffff;
                        padding: 20px;
                        border-radius: 4px;
                        background: rgba(0, 255, 255, 0.05);
                    ">
                        <h3 style="
                            color: #00ffff;
                            margin-top: 0;
                            margin-bottom: 15px;
                            border-bottom: 1px solid #00ffff;
                            padding-bottom: 10px;
                        ">PATIENT BIOMARKERS</h3>
                        <div style="font-size: 12px; line-height: 2.2; color: #ccffff;">
                            <div>
                                <span>WBC (Leukocytes)</span>
                                <span style="color: #ff8888; float: right;">78 K/μL</span>
                            </div>
                            <div>
                                <span>Lymphocytes</span>
                                <span style="color: #ffaa88; float: right;">22 %</span>
                            </div>
                            <div>
                                <span>Eosinophils</span>
                                <span style="color: #ffff88; float: right;">3 %</span>
                            </div>
                            <div>
                                <span>CRP (Inflammation)</span>
                                <span style="color: #ff4444; float: right;">45 mg/L</span>
                            </div>
                        </div>
                    </div>

                    <!-- Injectable Selection Panel -->
                    <div style="
                        border: 1px solid #00ffff;
                        padding: 20px;
                        border-radius: 4px;
                        background: rgba(0, 255, 255, 0.05);
                    ">
                        <h3 style="
                            color: #00ffff;
                            margin-top: 0;
                            margin-bottom: 15px;
                            border-bottom: 1px solid #00ffff;
                            padding-bottom: 10px;
                        ">THERAPEUTIC OPTIONS</h3>
                        <div style="font-size: 11px; line-height: 2.4; color: #ccffff;">
                            <label style="display: block; cursor: pointer; user-select: none;">
                                <input type="radio" name="injectable" value="macrophage" checked>
                                ► Macrophage Activation
                            </label>
                            <label style="display: block; cursor: pointer; user-select: none;">
                                <input type="radio" name="injectable" value="antibiotics">
                                ► Antibiotic Therapy
                            </label>
                            <label style="display: block; cursor: pointer; user-select: none;">
                                <input type="radio" name="injectable" value="tcells">
                                ► T-Cell Proliferation
                            </label>
                        </div>
                    </div>
                </div>

                <!-- Clinical Notes -->
                <div style="
                    border: 1px solid #ff4444;
                    padding: 15px;
                    background: rgba(255, 68, 68, 0.08);
                    border-radius: 4px;
                    color: #ff8888;
                    font-size: 10px;
                    line-height: 1.6;
                ">
                    <span style="color: #ff4444;">⚠</span> CLINICAL ASSESSMENT:<br>
                    High WBC and elevated CRP indicate active bacterial infection.
                    Recommend macrophage activation or antibiotic therapy based on tissue analysis.
                </div>

                <div style="
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid rgba(0, 255, 255, 0.2);
                    color: #666;
                    font-size: 9px;
                    text-align: center;
                ">
                    CELLULAR DIAGNOSTICS SYSTEM v1.0 | Status: Operational
                </div>
            </div>
        `;

        this.container.appendChild(overlay);
        this.diagnosticsPanel = overlay;

        // Close button
        document.getElementById('close-diagnostics').addEventListener('click', () => {
            this.toggleDiagnosticsPanel();
        });

        // ESC to close (handled by InputManager)
    }

    /**
     * Update loop - called each frame to animate UI
     */
    update() {
        this.updateBuildingPanelPosition();
    }
}

export default UIManager;
