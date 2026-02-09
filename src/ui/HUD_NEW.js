import BiomarkerMonitor from './BiomarkerMonitor.js';
import Inventory from './Inventory.js';
import Hotbar from './Hotbar.js';
import BioDatabase from '../data/BioDatabase.js';
import ProgressionManager from '../systems/ProgressionManager.js';
import SaveManager from '../systems/SaveManager.js';
import shaderProfileManager from '../core/ShaderProfileManager.js';

/**
 * HUD.js (RESTRUCTURED): Medical Glass themed HUD system
 * Layout:
 * - TOP: Grid coordinates + terrain info + building hover details
 * - TOP-LEFT: Settings + Guide buttons
 * - TOP-RIGHT: Resource toggle (All vs Loaded Only)
 * - BOTTOM-LEFT: Hotbar (1-6 building selection)
 * - BOTTOM-RIGHT: Resources + Buildings toggle buttons + expandable panels
 */
class HUD {
    constructor(inputManager) {
        this.inputManager = inputManager;
        
        // UI state
        this.selectedBuilding = null;
        this.selectedBuildingForHotbar = null;  // Track building for hotbar assignment
        this.cursorPosition = { x: 0, y: 0 };
        this.terrainType = 'Unknown';
        this.gridCoordinates = { x: 0, z: 0 };
        this.showAllResources = true;  // Toggle state
        this.resourcesVisible = false;  // Resources panel toggle
        this.buildingsVisible = false;  // Buildings panel toggle
        this.guideVisible = false;      // Guide panel toggle
        this.settingsVisible = false;   // Settings panel toggle
        this.draftVisible = false;      // Draft panel toggle
        this.inventoryVisible = false;  // Inventory toggle

        // Initialize progression systems
        try {
            this.saveManager = new SaveManager();
            this.progressionManager = new ProgressionManager();
            this.progressionManager.initialize(this.saveManager).then(() => {
                console.log('[HUD] ProgressionManager initialized, refreshing guide');
                this.populateGuide(); // Refresh guide after progression system is ready
            }).catch(err => {
                console.error('[HUD] Error initializing ProgressionManager:', err);
            });
        } catch (err) {
            console.error('[HUD] Error creating progression systems:', err);
            this.progressionManager = null;
            this.saveManager = null;
        }

        // Initialize UI systems
        this.biomarkerMonitor = new BiomarkerMonitor();
        this.inventory = new Inventory(this);
        this.hotbar = new Hotbar(this.inventory, inputManager, this);

        // Create HUD structure
        this.createTopPanel();           // Grid coordinates + info
        this.createTopLeftMenu();        // Settings + Guide + Diagnostics
        this.createBottomRightToggle();  // Resources + Buildings + Draft toggles
        this.createInventoryToggle();    // Inventory button (bottom-right)
        this.createResourcesPanel();     // Resources panel (hidden by default)
        this.createBuildingsPanel();     // Buildings panel (hidden by default)
        this.createGuidePanel();         // Guide panel (hidden by default)
        this.createSettingsPanel();      // Settings panel (hidden by default)
        this.createDraftPanel();         // Draft panel (hidden by default)

        // Wire inventory callback for resource updates
        this.inventory.onResourceChange = (type, amount) => this.updateResourcesUI();

        // Setup interactivity
        this.setupEventListeners();
    }

    /**
     * TOP PANEL: Grid coordinates and terrain/building info
     */
    createTopPanel() {
        const panel = document.createElement('div');
        panel.id = 'hud-top-info-panel';
        panel.className = 'hud-top-info-panel';
        
        panel.innerHTML = `
            <div class="info-section">
                <div class="info-label">POSITION</div>
                <div class="info-value"><span id="info-coords">-- , --</span></div>
            </div>
            <div class="info-section">
                <div class="info-label">TERRAIN</div>
                <div class="info-value"><span id="info-terrain">Unknown</span></div>
            </div>
            <div class="info-section building-info">
                <div class="info-label">BUILDING</div>
                <div class="info-value"><span id="info-building-name">None</span></div>
                <div class="building-cost"><span id="info-building-cost"></span></div>
            </div>
            <div class="info-section selection-info">
                <div class="info-label">SELECTION</div>
                <div class="info-value"><span id="hud-selected-cell">None</span></div>
            </div>
        `;

        document.body.appendChild(panel);
        
        this.infoPanel = {
            coords: panel.querySelector('#info-coords'),
            terrain: panel.querySelector('#info-terrain'),
            buildingName: panel.querySelector('#info-building-name'),
            buildingCost: panel.querySelector('#info-building-cost')
        };
    }

    /**
     * TOP-LEFT: Settings + Guide buttons
     */
    createTopLeftMenu() {
        const menu = document.createElement('div');
        menu.id = 'hud-top-left-menu';
        menu.className = 'hud-top-left-menu';
        
        menu.innerHTML = `
            <button id="btn-settings" class="hud-btn hud-btn-menu" title="Settings">
                ⚙ SETTINGS
            </button>
            <button id="btn-guide" class="hud-btn hud-btn-guide" title="Game Guide">
                📖 GUIDE
            </button>
        `;

        document.body.appendChild(menu);
        
        this.settingsBtn = menu.querySelector('#btn-settings');
        this.guideBtn = menu.querySelector('#btn-guide');
    }

    /**
     * LEFT-SIDE: Separate RESOURCES, BUILDINGS, and DRAFT buttons
     */
    createBottomRightToggle() {
        const toggle = document.createElement('div');
        toggle.id = 'hud-bottom-right-toggle';
        toggle.className = 'hud-left-side-toggle';
        
        toggle.innerHTML = `
            <button id="btn-resources" class="hud-btn hud-btn-toggle" title="Toggle resources panel [R]">
                📊 RESOURCES
            </button>
            <button id="btn-buildings" class="hud-btn hud-btn-toggle" title="Toggle buildings panel [B]">
                🏗 BUILDINGS
            </button>
            <button id="btn-draft" class="hud-btn hud-btn-toggle" title="Toggle draft panel [D]">
                📝 DRAFT
            </button>
        `;

        document.body.appendChild(toggle);
        
        this.resourcesBtn = toggle.querySelector('#btn-resources');
        this.buildingsBtn = toggle.querySelector('#btn-buildings');
        this.draftBtn = toggle.querySelector('#btn-draft');
    }

    /**
     * BOTTOM-RIGHT: Inventory toggle button
     */
    createInventoryToggle() {
        const toggle = document.createElement('button');
        toggle.id = 'btn-inventory';
        toggle.className = 'hud-btn hud-btn-inventory';
        toggle.title = 'Toggle inventory panel [I]';
        toggle.innerHTML = '🎒 INVENTORY';
        
        document.body.appendChild(toggle);
        
        this.inventoryBtn = toggle;
    }

    /**
     * RESOURCES PANEL: Show available resources with filter toggle
     */
    createResourcesPanel() {
        const panel = document.createElement('div');
        panel.id = 'resources-panel';
        panel.className = 'resources-panel hidden';
        
        panel.innerHTML = `
            <div class="resources-header-with-toggle">
                <span class="resources-title">📊 RESOURCES</span>
                <button id="btn-resource-toggle-in-panel" class="toggle-filter-btn" title="Toggle resource display mode">
                    ALL
                </button>
                <button class="panel-close" id="close-resources">✕</button>
            </div>
            <div id="resources-container" class="resources-container"></div>
        `;
        
        document.body.appendChild(panel);
        this.resourcesPanel = panel;
        this.updateResourcesUI(); // Populate resources on creation
    }

    /**
     * DRAFT PANEL: Show draft buildings/items for planning
     */
    createDraftPanel() {
        const panel = document.createElement('div');
        panel.id = 'draft-panel';
        panel.className = 'draft-panel hidden';
        
        panel.innerHTML = `
            <div class="draft-header">
                <span class="draft-title">📝 DRAFT</span>
                <button class="panel-close" id="close-draft">✕</button>
            </div>
            <div id="draft-container" class="draft-container">
                <div class="draft-empty">No drafts yet. Plan your construction here!</div>
            </div>
        `;
        
        document.body.appendChild(panel);
        this.draftPanel = panel;
    }

    /**
     * BUILDINGS PANEL: Show available buildings for selection or hotbar assignment
     */
    createBuildingsPanel() {
        const panel = document.createElement('div');
        panel.id = 'buildings-panel';
        panel.className = 'buildings-panel hidden';
        
        panel.innerHTML = `
            <div class="buildings-header">
                <span class="buildings-title">🏗 BUILDINGS</span>
                <button class="panel-close" id="close-buildings">✕</button>
            </div>
            <div id="buildings-container" class="buildings-container"></div>
        `;
        
        document.body.appendChild(panel);
        this.buildingsPanel = panel;
        this.populateBuildingsList();
    }

    /**
     * GUIDE PANEL: Show expandable guide with searchable entries
     */
    createGuidePanel() {
        const panel = document.createElement('div');
        panel.id = 'guide-panel';
        panel.className = 'guide-panel hidden';
        
        panel.innerHTML = `
            <div class="guide-header">
                <span class="guide-title">📖 GUIDE</span>
                <button class="panel-close" id="close-guide">✕</button>
            </div>
            <div class="guide-search-container">
                <input type="text" id="guide-search-input" placeholder="Search guide..." />
            </div>
            <div id="guide-container" class="guide-container"></div>
        `;
        
        document.body.appendChild(panel);
        this.guidePanel = panel;
        // Note: populateGuide() will be called after progressionManager initializes
    }

    /**
     * SETTINGS PANEL: Game settings (volume, save, etc.)
     */
    createSettingsPanel() {
        const panel = document.createElement('div');
        panel.id = 'settings-panel';
        panel.className = 'settings-panel hidden';
        
        // Build shader profile options
        const profiles = shaderProfileManager.getProfileList();
        const profileOptions = profiles.map(p => 
            `<option value="${p.id}" ${p.id === shaderProfileManager.getCurrentProfileId() ? 'selected' : ''}>${p.name}</option>`
        ).join('');
        
        panel.innerHTML = `
            <div class="settings-header">
                <span class="settings-title">⚙ SETTINGS</span>
                <button class="panel-close" id="close-settings">✕</button>
            </div>
            <div class="settings-content">
                <div class="settings-group">
                    <label class="settings-label">🎨 Shader Profile</label>
                    <select id="settings-shader-profile" class="settings-select">
                        ${profileOptions}
                    </select>
                    <span id="settings-shader-description" class="settings-description">Select building visual style</span>
                </div>
                <div class="settings-group">
                    <label class="settings-label">🔊 Volume</label>
                    <input type="range" id="settings-volume" class="settings-slider" min="0" max="100" value="50" />
                    <span id="settings-volume-value">50%</span>
                </div>
                <div class="settings-group">
                    <button id="btn-save-game" class="settings-btn" title="Save your progress">
                        💾 SAVE GAME
                    </button>
                </div>
                <div class="settings-group">
                    <button id="btn-load-game" class="settings-btn" title="Load saved game">
                        ⬆️ LOAD GAME
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(panel);
        this.settingsPanel = panel;
        
        // Setup shader profile selector
        const profileSelect = panel.querySelector('#settings-shader-profile');
        const profileDesc = panel.querySelector('#settings-shader-description');
        
        if (profileSelect && profileDesc) {
            profileSelect.addEventListener('change', (e) => {
                const profileId = e.target.value;
                shaderProfileManager.setProfile(profileId);
                
                // Update description
                const profile = shaderProfileManager.getProfile(profileId);
                profileDesc.textContent = profile.description;
                
                // Notify any listeners (buildings need to update)
                window.dispatchEvent(new CustomEvent('shaderProfileChanged', { 
                    detail: { profileId } 
                }));
                
                console.log(`[HUD] Shader profile changed to: ${profileId}`);
            });
            
            // Set initial description
            const currentProfile = shaderProfileManager.getProfile();
            profileDesc.textContent = currentProfile.description;
        }
        
        // Setup settings interactions
        const volumeSlider = panel.querySelector('#settings-volume');
        const volumeValue = panel.querySelector('#settings-volume-value');
        if (volumeSlider && volumeValue) {
            volumeSlider.addEventListener('input', (e) => {
                volumeValue.textContent = e.target.value + '%';
            });
        }
    }

    /**
     * Populate buildings list in buildings panel
     */
    populateBuildingsList() {
        const grid = this.buildingsPanel.querySelector('#buildings-container');
        if (!grid) {
            console.warn('[HUD] Buildings container not found');
            return;
        }
        
        grid.innerHTML = ''; // Clear existing
        
        BioDatabase.buildings.forEach((building) => {
            const card = document.createElement('div');
            card.className = 'building-card-in-panel';
            card.id = `building-${building.id}`;
            
            // Format cost nicely
            let costStr = 'Free';
            if (building.cost && Object.keys(building.cost).length > 0) {
                costStr = Object.entries(building.cost)
                    .map(([res, amt]) => `${amt} ${res}`)
                    .join('\n');
            }
            
            card.innerHTML = `
                <div class="building-card-icon">${building.icon}</div>
                <div class="building-card-info">
                    <div class="building-card-name">${building.name}</div>
                    <div class="building-card-cost">${costStr}</div>
                </div>
            `;
            
            card.dataset.buildingKey = building.id;
            
            grid.appendChild(card);
        });
    }

    /**
     * Populate guide content from BioDatabase with unlock state
     */
    populateGuide() {
        const content = this.guidePanel.querySelector('#guide-container');
        if (!content) {
            console.warn('[HUD] guide-container not found!');
            return;
        }
        content.innerHTML = ''; // Clear existing
        
        console.log('[HUD] populateGuide started, BioDatabase:', BioDatabase);
        
        // Map BioDatabase keys to display names
        const typeMap = {
            resources: 'RESOURCES',
            buildings: 'BUILDINGS',
            units: 'UNITS',
            terrain: 'TERRAIN',
            technologies: 'TECHNOLOGIES'
        };
        
        let totalEntries = 0;
        
        Object.entries(typeMap).forEach(([dbKey, displayName]) => {
            const entries = BioDatabase[dbKey] || [];
            console.log(`[HUD] ${displayName}: ${entries.length} entries`);
            if (entries.length === 0) return;
            
            const section = document.createElement('div');
            section.className = 'guide-section';
            
            const header = document.createElement('div');
            header.className = 'guide-section-title';
            header.innerHTML = `
                ${displayName}
                <span class="guide-section-arrow">▼</span>
            `;
            
            // Add click handler for expand/collapse
            header.addEventListener('click', () => {
                section.classList.toggle('collapsed');
            });
            
            section.appendChild(header);
            
            const entriesList = document.createElement('div');
            entriesList.className = 'guide-entries';
            
            entries.forEach(entry => {
                const isUnlocked = this.progressionManager ? this.progressionManager.isUnlocked(entry.id) : false;
                const entryDiv = document.createElement('div');
                entryDiv.className = `guide-entry ${isUnlocked ? 'unlocked' : 'locked'}`;
                totalEntries++;
                
                if (isUnlocked) {
                    // Show full details
                    entryDiv.innerHTML = `
                        <div class="guide-entry-header">
                            ${entry.icon} ${entry.name}
                        </div>
                        <div class="guide-entry-content">
                            <p>${entry.description || ''}</p>
                            ${entry.tips ? `<p class="guide-entry-tip">💡 ${entry.tips}</p>` : ''}
                        </div>
                    `;
                } else {
                    // Show locked with hint
                    const hint = this.progressionManager ? this.progressionManager.getUnlockHint(entry.id) : null;
                    entryDiv.innerHTML = `
                        <div class="guide-entry-header">
                            ${entry.icon} ???
                        </div>
                        <div class="guide-entry-content">
                            <p class="guide-entry-locked">🔒 LOCKED</p>
                            ${hint ? `<p class="guide-entry-hint">📋 ${hint}</p>` : ''}
                        </div>
                    `;
                }
                entriesList.appendChild(entryDiv);
            });
            
            section.appendChild(entriesList);
            content.appendChild(section);
        });
        
        console.log('[HUD] populateGuide completed. Total entries added:', totalEntries);
        console.log('[HUD] guide-content HTML length:', content.innerHTML.length);
    }

    /**
     * Update resources panel from inventory data
     */
    updateResourcesUI() {
        const container = this.resourcesPanel.querySelector('#resources-container');
        if (!container) {
            console.warn('[HUD] resources-container not found!');
            return;
        }

        try {
            container.innerHTML = ''; // Clear existing
            
            const resources = this.inventory.getResources();
            const resourceEntries = Object.entries(resources);
            
            if (resourceEntries.length === 0) {
                container.innerHTML = '<div class="resources-empty">No resources yet</div>';
                return;
            }
            
            resourceEntries.forEach(([key, resource]) => {
                const card = document.createElement('div');
                card.className = 'resource-card';
                
                // Determine if we should show based on filter
                const amount = resource.amount || 0;
                if (!this.showAllResources && amount === 0) {
                    return; // Skip empty resources when "Loaded Only" mode is active
                }
                
                card.innerHTML = `
                    <div class="resource-card-icon">${resource.icon}</div>
                    <div class="resource-card-info">
                        <div class="resource-card-name">${resource.name}</div>
                        <div class="resource-card-amount">${amount} ${resource.unit}</div>
                    </div>
                `;
                
                container.appendChild(card);
            });
            
            console.log('[HUD] Updated resources UI with', resourceEntries.length, 'resources');
        } catch (err) {
            console.error('[HUD] Error updating resources UI:', err);
        }
    }

    /**
     * Update coordinate display
     */
    updateCoordinates(x, z) {
        this.gridCoordinates = { x, z };
        if (this.infoPanel.coords) {
            this.infoPanel.coords.textContent = `${x}, ${z}`;
        }
    }

    /**
     * Update terrain display
     */
    updateTerrainInfo(terrainType) {
        this.terrainType = terrainType;
        if (this.infoPanel.terrain) {
            this.infoPanel.terrain.textContent = terrainType || 'Unknown';
        }
    }

    /**
     * Update building hover info from a Building object
     */
    updateBuildingHoverInfo(building) {
        if (!building) {
            if (this.infoPanel && this.infoPanel.buildingName) {
                this.infoPanel.buildingName.textContent = 'None';
                this.infoPanel.buildingCost.textContent = '';
            }
            return;
        }
        
        // Display building name and icon from the building object
        if (this.infoPanel && this.infoPanel.buildingName) {
            const displayName = building.icon ? `${building.icon} ${building.name}` : (building.name || 'Unknown');
            this.infoPanel.buildingName.textContent = displayName;
            this.infoPanel.buildingCost.textContent = '';
        }
    }

    /**
     * Set the selected cell (visual feedback)
     */
    setSelectedCell(cell) {
        this.selectedCell = cell;
        console.log(`[HUD] Cell selected: [${cell.x}, ${cell.z}]`);
        
        // Update display with visual feedback
        const selectedInfoDiv = document.getElementById('hud-selected-cell');
        if (selectedInfoDiv) {
            selectedInfoDiv.style.display = 'block';
            selectedInfoDiv.textContent = `✓ SELECTED: [${cell.x}, ${cell.z}]`;
            selectedInfoDiv.style.animation = 'none';
            setTimeout(() => {
                selectedInfoDiv.style.animation = 'selectionPulse 0.5s ease-out';
            }, 10);
        }
    }

    /**
     * Start region selection (drag from point A to point B)
     */
    startSelection(start) {
        this.selectionStart = start;
        this.selectedRegion = null;
        console.log(`[HUD] Selection started at [${start.x}, ${start.z}]`);
    }

    /**
     * Update selection box visualization while dragging
     */
    updateSelectionBox(start, current) {
        const minX = Math.min(start.x, current.x);
        const maxX = Math.max(start.x, current.x);
        const minZ = Math.min(start.z, current.z);
        const maxZ = Math.max(start.z, current.z);
        
        const width = maxX - minX + 1;
        const height = maxZ - minZ + 1;
        const cellCount = width * height;
        
        console.log(`[HUD.updateSelectionBox] Start: [${start.x},${start.z}], Current: [${current.x},${current.z}] → Bounds: [${minX},${minZ}] to [${maxX},${maxZ}] = ${width}×${height}=${cellCount}`);
        
        const selectedInfoDiv = document.getElementById('hud-selected-cell');
        if (selectedInfoDiv) {
            selectedInfoDiv.style.display = 'block';
            selectedInfoDiv.innerHTML = `📦 SELECTING: [${minX},${minZ}] → [${maxX},${maxZ}] (${width}×${height}=${cellCount} cells)<br><small style="color: #888;">Start: [${start.x},${start.z}] | Current: [${current.x},${current.z}]</small>`;
        }
    }

    /**
     * Finalize region selection and highlight cells
     */
    finalizeSelection(start, end) {
        const minX = Math.min(start.x, end.x);
        const maxX = Math.max(start.x, end.x);
        const minZ = Math.min(start.z, end.z);
        const maxZ = Math.max(start.z, end.z);
        
        this.selectedRegion = { minX, maxX, minZ, maxZ };
        const count = (maxX - minX + 1) * (maxZ - minZ + 1);
        
        console.log(`[HUD] Selection finalized: ${count} cells selected`);
        
        // Note: Visualization and building highlighting is handled in Engine.js
        // This method just updates HUD display
        
        const selectedInfoDiv = document.getElementById('hud-selected-cell');
        if (selectedInfoDiv) {
            selectedInfoDiv.style.display = 'block';
            selectedInfoDiv.textContent = `✅ BUILDINGS HIGHLIGHTED: ${count} cells [${minX},${minZ}]→[${maxX},${maxZ}]`;
            selectedInfoDiv.style.animation = 'none';
            setTimeout(() => {
                selectedInfoDiv.style.animation = 'selectionPulse 0.5s ease-out';
            }, 10);
        }
    }

    /**
     * Get currently selected region
     */
    getSelectedRegion() {
        return this.selectedRegion;
    }

    /**
     * Clear all selections
     */
    clearSelection() {
        this.selectedRegion = null;
        this.selectionStart = null;
        this.selectedCell = null;
        
        // Clear visualization in 3D world and dehighlight buildings
        if (this.engine) {
            this.engine.clearSelectionOverlay();
            this.engine.clearAllBuildingHighlights(); // Remove highlight from all buildings
        }
        
        const selectedInfoDiv = document.getElementById('hud-selected-cell');
        if (selectedInfoDiv) {
            selectedInfoDiv.style.display = 'block';
            selectedInfoDiv.textContent = 'None';
        }
    }

    /**
     * Show properties window for a cell (draggable)
     */
    showPropertiesWindow(cellData, mouseX, mouseY) {
        // Check if window already exists and remove it
        const existingWindow = document.getElementById('properties-window');
        if (existingWindow) {
            existingWindow.remove();
        }

        // Create properties window
        const windowDiv = document.createElement('div');
        windowDiv.id = 'properties-window';
        windowDiv.className = 'properties-window';
        
        // Create header with title and close button
        const header = document.createElement('div');
        header.className = 'properties-header';
        header.innerHTML = `
            <span class="properties-title">Cell [${cellData.x}, ${cellData.z}] Properties</span>
            <button class="properties-close">&times;</button>
        `;
        
        // Create content
        const content = document.createElement('div');
        content.className = 'properties-content';
        
        let contentHTML = `
            <div class="property-item">
                <span class="property-label">Position:</span>
                <span class="property-value">[${cellData.x}, ${cellData.z}]</span>
            </div>
            <div class="property-item">
                <span class="property-label">Terrain:</span>
                <span class="property-value">${cellData.terrain || 'Unknown'}</span>
            </div>
        `;
        
        if (cellData.building) {
            contentHTML += `
                <div class="property-item">
                    <span class="property-label">Building:</span>
                    <span class="property-value">${cellData.building.name || 'Unknown'}</span>
                </div>
                <div class="property-item">
                    <span class="property-label">Health:</span>
                    <span class="property-value">${cellData.building.health || 'N/A'}</span>
                </div>
            `;
        } else {
            contentHTML += `
                <div class="property-item">
                    <span class="property-label">Building:</span>
                    <span class="property-value">None</span>
                </div>
            `;
        }
        
        content.innerHTML = contentHTML;
        
        windowDiv.appendChild(header);
        windowDiv.appendChild(content);
        document.body.appendChild(windowDiv);
        
        // Position window near mouse
        let x = mouseX;
        let y = mouseY;
        const windowRect = windowDiv.getBoundingClientRect();
        
        // Keep window within viewport
        if (x + 250 > window.innerWidth) {
            x = window.innerWidth - 260;
        }
        if (y + 200 > window.innerHeight) {
            y = window.innerHeight - 210;
        }
        
        windowDiv.style.left = x + 'px';
        windowDiv.style.top = y + 'px';
        
        // Make window draggable
        this.makeWindowDraggable(windowDiv, header);
        
        // Close button handler
        const closeBtn = header.querySelector('.properties-close');
        closeBtn.addEventListener('click', () => {
            windowDiv.remove();
        });
    }

    /**
     * Make a window draggable by its header
     */
    makeWindowDraggable(windowDiv, headerDiv) {
        let isDragging = false;
        let offsetX = 0;
        let offsetY = 0;

        headerDiv.addEventListener('mousedown', (e) => {
            isDragging = true;
            offsetX = e.clientX - windowDiv.getBoundingClientRect().left;
            offsetY = e.clientY - windowDiv.getBoundingClientRect().top;
            headerDiv.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            windowDiv.style.left = (e.clientX - offsetX) + 'px';
            windowDiv.style.top = (e.clientY - offsetY) + 'px';
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            headerDiv.style.cursor = 'grab';
        });
    }

    /**
     * Toggle vitals panel visibility
     */
    /**
     * Toggle resources panel visibility
     */
    toggleResources() {
        this.resourcesVisible = !this.resourcesVisible;
        if (this.resourcesPanel) {
            if (this.resourcesVisible) {
                this.resourcesPanel.classList.remove('hidden');
                this.resourcesBtn.classList.add('active');
            } else {
                this.resourcesPanel.classList.add('hidden');
                this.resourcesBtn.classList.remove('active');
            }
        }
    }

    /**
     * Toggle buildings panel visibility
     */
    toggleBuildings() {
        this.buildingsVisible = !this.buildingsVisible;
        if (this.buildingsPanel) {
            if (this.buildingsVisible) {
                this.buildingsPanel.classList.remove('hidden');
                this.buildingsBtn.classList.add('active');
            } else {
                this.buildingsPanel.classList.add('hidden');
                this.buildingsBtn.classList.remove('active');
            }
        }
    }

    /**
     * Toggle guide panel visibility
     */
    toggleGuide() {
        console.log('[HUD] toggleGuide called, current state:', this.guideVisible);
        console.log('[HUD] guidePanel exists:', !!this.guidePanel);
        console.log('[HUD] guideBtn exists:', !!this.guideBtn);
        
        this.guideVisible = !this.guideVisible;
        if (this.guidePanel) {
            if (this.guideVisible) {
                console.log('[HUD] Showing guide panel');
                this.guidePanel.classList.remove('hidden');
                this.guideBtn.classList.add('active');
            } else {
                console.log('[HUD] Hiding guide panel');
                this.guidePanel.classList.add('hidden');
                this.guideBtn.classList.remove('active');
            }
        } else {
            console.warn('[HUD] guidePanel is null!');
        }
    }

    /**
     * Toggle settings panel visibility
     */
    toggleSettings() {
        console.log('[HUD] toggleSettings called, current state:', this.settingsVisible);
        
        this.settingsVisible = !this.settingsVisible;
        if (this.settingsPanel) {
            if (this.settingsVisible) {
                console.log('[HUD] Showing settings panel');
                this.settingsPanel.classList.remove('hidden');
                this.settingsBtn.classList.add('active');
            } else {
                console.log('[HUD] Hiding settings panel');
                this.settingsPanel.classList.add('hidden');
                this.settingsBtn.classList.remove('active');
            }
        } else {
            console.warn('[HUD] settingsPanel is null!');
        }
    }

    /**
     * Toggle draft panel visibility
     */
    toggleDraft() {
        this.draftVisible = !this.draftVisible;
        if (this.draftPanel) {
            if (this.draftVisible) {
                this.draftPanel.classList.remove('hidden');
                this.draftBtn.classList.add('active');
            } else {
                this.draftPanel.classList.add('hidden');
                this.draftBtn.classList.remove('active');
            }
        }
    }

    /**
     * Toggle inventory panel visibility
     */
    toggleInventory() {
        console.log('[HUD] toggleInventory called, current state:', this.inventoryVisible);
        
        this.inventoryVisible = !this.inventoryVisible;
        
        // Inventory UI is handled by Inventory class - just update visibility
        const inventoryPanel = document.querySelector('#inventory-panel') || document.querySelector('.inventory-panel');
        
        if (inventoryPanel) {
            if (this.inventoryVisible) {
                console.log('[HUD] Showing inventory panel');
                inventoryPanel.style.display = 'block';
                if (this.inventoryBtn) this.inventoryBtn.classList.add('active');
            } else {
                console.log('[HUD] Hiding inventory panel');
                inventoryPanel.style.display = 'none';
                if (this.inventoryBtn) this.inventoryBtn.classList.remove('active');
            }
        }
    }

    /**
     * Toggle resource display mode
     */
    toggleResourceDisplay() {
        this.showAllResources = !this.showAllResources;
        
        // Update button text
        const btn = document.querySelector('#btn-resource-toggle-in-panel');
        if (btn) {
            btn.textContent = this.showAllResources 
                ? '📊 ALL' 
                : '📊 LOADED';
        }
    }

    /**
     * Filter guide entries by search term
     */
    filterGuide(searchTerm) {
        const entries = document.querySelectorAll('.guide-entry');
        entries.forEach(entry => {
            const text = entry.textContent.toLowerCase();
            if (text.includes(searchTerm.toLowerCase())) {
                entry.style.display = 'block';
            } else {
                entry.style.display = 'none';
            }
        });
    }

    /**
     * Assign building to hotbar slot (ALT+number key binding)
     */
    assignBuildingToHotbarSlot(buildingKey, slotIndex) {
        // Find the building in BioDatabase
        let building = null;
        for (const type of ['buildings', 'resources', 'units', 'terrain', 'technologies']) {
            building = BioDatabase[type]?.find(b => b.id === buildingKey);
            if (building) break;
        }
        
        if (!building) {
            console.warn(`[HUD] Building not found: ${buildingKey}`);
            return;
        }
        
        // Get hotbar slot element
        const hotbarItems = document.querySelectorAll('.hotbar-item');
        if (slotIndex < 0 || slotIndex >= hotbarItems.length) {
            console.warn(`[HUD] Invalid hotbar slot: ${slotIndex}`);
            return;
        }
        
        const slot = hotbarItems[slotIndex];
        
        // Update slot with building info
        slot.dataset.building = buildingKey;
        slot.innerHTML = `
            <div class="hotbar-item-icon">${building.icon}</div>
            <div class="hotbar-item-key">${slotIndex + 1}</div>
            <div class="hotbar-item-name">${building.name?.substring(0, 10)}</div>
        `;
        
        console.log(`[HUD] Assigned ${building.name} to hotbar slot ${slotIndex + 1}`);
    }

    /**
     * Assign building to next available hotbar slot (ALT+click)
     */
    assignBuildingToHotbar(buildingKey) {
        const hotbarItems = document.querySelectorAll('.hotbar-item');
        for (let i = 0; i < hotbarItems.length; i++) {
            const slot = hotbarItems[i];
            // Find first empty slot or create new one
            if (!slot.dataset.building || slot.dataset.building === '') {
                this.assignBuildingToHotbarSlot(buildingKey, i);
                return;
            }
        }
        
        console.warn('[HUD] All hotbar slots are full');
    }

    /**
     * Clear a hotbar slot (ALT+click on slot)
     */
    clearHotbarSlot(buildingKey) {
        const hotbarItem = document.querySelector(`[data-building="${buildingKey}"]`);
        if (!hotbarItem) return;
        
        hotbarItem.dataset.building = '';
        hotbarItem.innerHTML = `
            <div class="hotbar-item-icon">+</div>
            <div class="hotbar-item-key" style="display:none;"></div>
            <div class="hotbar-item-name">Empty</div>
        `;
        
        console.log(`[HUD] Cleared hotbar slot: ${buildingKey}`);
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        console.log('[HUD] Setting up event listeners...');
        
        // RESOURCES BUTTON
        if (this.resourcesBtn) {
            this.resourcesBtn.addEventListener('click', () => {
                console.log('[HUD] Resources button clicked');
                this.toggleResources();
            });
            console.log('[HUD] Resources button wired');
        }
        
        // BUILDINGS BUTTON
        if (this.buildingsBtn) {
            this.buildingsBtn.addEventListener('click', () => {
                console.log('[HUD] Buildings button clicked');
                this.toggleBuildings();
            });
            console.log('[HUD] Buildings button wired');
        }
        
        // GUIDE BUTTON
        if (this.guideBtn) {
            this.guideBtn.addEventListener('click', () => {
                console.log('[HUD] Guide button clicked');
                this.toggleGuide();
            });
            console.log('[HUD] Guide button wired');
        } else {
            console.warn('[HUD] Guide button not found! guideBtn:', this.guideBtn);
        }

        // SETTINGS BUTTON
        if (this.settingsBtn) {
            this.settingsBtn.addEventListener('click', () => {
                console.log('[HUD] Settings button clicked');
                this.toggleSettings();
            });
            console.log('[HUD] Settings button wired');
        } else {
            console.warn('[HUD] Settings button not found! settingsBtn:', this.settingsBtn);
        }

        // DRAFT BUTTON
        if (this.draftBtn) {
            this.draftBtn.addEventListener('click', () => {
                console.log('[HUD] Draft button clicked');
                this.toggleDraft();
            });
            console.log('[HUD] Draft button wired');
        }
        
        // INVENTORY BUTTON
        if (this.inventoryBtn) {
            this.inventoryBtn.addEventListener('click', () => {
                console.log('[HUD] Inventory button clicked');
                this.toggleInventory();
            });
            console.log('[HUD] Inventory button wired');
        }
        
        // Close buttons for all panels
        const closeResourcesBtn = document.querySelector('#close-resources');
        if (closeResourcesBtn) {
            closeResourcesBtn.addEventListener('click', () => {
                this.toggleResources();
            });
        }
        
        const closeBuildingsBtn = document.querySelector('#close-buildings');
        if (closeBuildingsBtn) {
            closeBuildingsBtn.addEventListener('click', () => {
                this.toggleBuildings();
            });
        }
        
        const closeGuideBtn = document.querySelector('#close-guide');
        if (closeGuideBtn) {
            closeGuideBtn.addEventListener('click', () => {
                this.toggleGuide();
            });
        }

        const closeSettingsBtn = document.querySelector('#close-settings');
        if (closeSettingsBtn) {
            closeSettingsBtn.addEventListener('click', () => {
                this.toggleSettings();
            });
        }

        const closeDraftBtn = document.querySelector('#close-draft');
        if (closeDraftBtn) {
            closeDraftBtn.addEventListener('click', () => {
                this.toggleDraft();
            });
        }
        
        // RESOURCE TOGGLE (inside resources panel header)
        setTimeout(() => {
            const resourceToggleBtn = document.querySelector('#btn-resource-toggle-in-panel');
            if (resourceToggleBtn) {
                resourceToggleBtn.addEventListener('click', () => {
                    console.log('[HUD] Resource toggle clicked');
                    this.toggleResourceDisplay();
                });
                console.log('[HUD] Resource toggle button wired');
            }
        }, 200);
        
        // GUIDE SEARCH INPUT
        setTimeout(() => {
            const guideSearchInput = document.querySelector('#guide-search-input');
            if (guideSearchInput) {
                guideSearchInput.addEventListener('input', (e) => {
                    this.filterGuide(e.target.value);
                });
                console.log('[HUD] Guide search input wired');
            }
        }, 200);
        
        // BUILDING CARD INTERACTIONS
        setTimeout(() => {
            const buildingCards = document.querySelectorAll('.building-card-in-panel');
            buildingCards.forEach((card, index) => {
                // Track selected building for ALT+number assignment
                card.addEventListener('click', () => {
                    // Clear previous selection
                    document.querySelectorAll('.building-card-in-panel').forEach(c => {
                        c.classList.remove('selected');
                    });
                    // Mark this one as selected
                    card.classList.add('selected');
                    this.selectedBuildingForHotbar = card.dataset.buildingKey;
                    console.log(`[HUD] Selected building for hotbar: ${this.selectedBuildingForHotbar}`);
                });
                
                // ALT+Click to assign to hotbar (find next available slot)
                card.addEventListener('click', (e) => {
                    if (e.altKey) {
                        e.preventDefault();
                        this.assignBuildingToHotbar(card.dataset.buildingKey);
                    }
                });
            });
            console.log('[HUD] Building cards wired for hotbar assignment');
        }, 200);
        
        // HOTBAR ITEM INTERACTIONS
        setTimeout(() => {
            const hotbarItems = document.querySelectorAll('.hotbar-item');
            hotbarItems.forEach(item => {
                // ALT+Click to clear hotbar slot
                item.addEventListener('click', (e) => {
                    if (e.altKey) {
                        e.preventDefault();
                        this.clearHotbarSlot(item.dataset.building);
                    }
                });
            });
            console.log('[HUD] Hotbar items wired for clearing');
        }, 200);
        
        // KEYBOARD SHORTCUTS
        document.addEventListener('keydown', (e) => {
            // Regular shortcuts
            if (e.key.toLowerCase() === 'r') {
                console.log('[HUD] R key pressed - toggling resources');
                this.toggleResources();
            }
            if (e.key.toLowerCase() === 'b') {
                console.log('[HUD] B key pressed - toggling buildings');
                this.toggleBuildings();
            }
            if (e.key.toLowerCase() === 'g') {
                console.log('[HUD] G key pressed - toggling guide');
                this.toggleGuide();
            }
            // Delete key - clear selection or delete selected cells
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (this.selectedRegion) {
                    console.log('[HUD] Delete key pressed - clearing selection');
                    this.clearSelection();
                } else if (this.selectedCell) {
                    console.log('[HUD] Delete key pressed - clearing cell selection');
                    this.selectedCell = null;
                    const selectedInfoDiv = document.getElementById('hud-selected-cell');
                    if (selectedInfoDiv) {
                        selectedInfoDiv.textContent = 'None';
                    }
                }
            }
            // Escape key - clear all selections
            if (e.key === 'Escape') {
                console.log('[HUD] Escape key pressed - clearing all selections');
                this.clearSelection();
            }
            // ALT+number for hotbar assignment
            if (e.altKey && e.key >= '1' && e.key <= '6') {
                e.preventDefault();
                const slotIndex = parseInt(e.key) - 1;
                if (this.selectedBuildingForHotbar) {
                    this.assignBuildingToHotbarSlot(this.selectedBuildingForHotbar, slotIndex);
                }
            }
        });
        
        console.log('[HUD] Event listeners setup complete');
        
        // Make all panels draggable
        this.makeDraggable(this.resourcesPanel, 'resources-panel');
        this.makeDraggable(this.buildingsPanel, 'buildings-panel');
        this.makeDraggable(this.guidePanel, 'guide-panel');
        
        // Make hotbar draggable
        const hotbar = document.querySelector('#hotbar-panel');
        if (hotbar) {
            this.makeDraggable(hotbar, 'hotbar-panel');
        }
    }

    /**
     * Make an element draggable and save its position to localStorage
     * Also updates z-index to bring recently moved panels to front
     */
    makeDraggable(element, storageKey) {
        if (!element) return;
        
        // Initialize z-index stack if it doesn't exist
        if (!this.zIndexStack) {
            this.zIndexStack = [];
        }
        
        // Load saved position from localStorage
        const savedPos = localStorage.getItem(`hud-pos-${storageKey}`);
        if (savedPos) {
            const pos = JSON.parse(savedPos);
            element.style.position = 'fixed';
            element.style.left = pos.x + 'px';
            element.style.top = pos.y + 'px';
            element.style.right = 'auto';
            element.style.bottom = 'auto';
        }
        
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        
        // Use the header/title element as the drag handle
        let dragHandle = element.querySelector('.panel-header') || 
                        element.querySelector('.resources-header-with-toggle') ||
                        element.querySelector('.buildings-header') ||
                        element.querySelector('.guide-header') ||
                        element.querySelector('.hotbar-label') ||
                        element;
        
        dragHandle.addEventListener('mousedown', (e) => {
            isDragging = true;
            initialX = e.clientX - element.offsetLeft;
            initialY = e.clientY - element.offsetTop;
            dragHandle.style.cursor = 'grabbing';
            
            // Update z-index stack: move this element to the front
            const elementId = element.id || storageKey;
            this.zIndexStack = this.zIndexStack.filter(id => id !== elementId);
            this.zIndexStack.push(elementId);
            this.updatePanelZIndices();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;
            
            // Keep element within viewport bounds
            const minX = 0;
            const minY = 0;
            const maxX = window.innerWidth - element.offsetWidth;
            const maxY = window.innerHeight - element.offsetHeight;
            
            currentX = Math.max(minX, Math.min(currentX, maxX));
            currentY = Math.max(minY, Math.min(currentY, maxY));
            
            element.style.position = 'fixed';
            element.style.left = currentX + 'px';
            element.style.top = currentY + 'px';
            element.style.right = 'auto';
            element.style.bottom = 'auto';
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                dragHandle.style.cursor = 'grab';
                
                // Save position to localStorage
                const pos = {
                    x: currentX !== undefined ? currentX : element.offsetLeft,
                    y: currentY !== undefined ? currentY : element.offsetTop
                };
                localStorage.setItem(`hud-pos-${storageKey}`, JSON.stringify(pos));
                console.log(`[HUD] Saved ${storageKey} position:`, pos);
            }
        });
        
        // Add grab cursor on hover
        dragHandle.style.cursor = 'grab';
        dragHandle.style.userSelect = 'none';
    }

    /**
     * Update z-index values based on drag order
     * Draggable panels get z-index 20-30 based on their position in the stack
     */
    updatePanelZIndices() {
        const baseZIndex = 20;
        this.zIndexStack.forEach((elementId, index) => {
            const element = document.getElementById(elementId);
            if (element) {
                element.style.zIndex = baseZIndex + index;
            }
        });
    }

    /**
     * Called periodically from engine to update biomarkers
     */
    simulateBiomarkers() {
        if (this.biomarkerMonitor) {
            this.biomarkerMonitor.simulateBiomarkers();
        }
    }

    /**
     * Get reference to inventory for external use
     */
    getInventory() {
        return this.inventory;
    }

    /**
     * Get reference to biomarker monitor
     */
    getBiomarkerMonitor() {
        return this.biomarkerMonitor;
    }
}

export default HUD;
