/**
 * Hotbar: Quick building selection with keyboard support
 * Features:
 * - 6 building hotkeys (1-6)
 * - Visual feedback for selected building
 * - Integrated with Inventory system
 */
class Hotbar {
    constructor(inventory, inputManager, hud) {
        this.inventory = inventory;
        this.inputManager = inputManager;
        this.hud = hud;
        this.selectedBuilding = null;
        this.selectedBuildingType = null;  // Track selected for toggle behavior

        this.createHotbarUI();
        this.setupKeyboardBindings();
    }

    /**
     * Create hotbar HTML UI
     */
    createHotbarUI() {
        const hotbar = document.createElement('div');
        hotbar.id = 'hotbar-panel';
        hotbar.className = 'hotbar-panel';
        
        hotbar.innerHTML = `
            <div class="hotbar-label">HOTBAR</div>
            <div class="hotbar-items" id="hotbar-items"></div>
        `;

        const itemsContainer = hotbar.querySelector('#hotbar-items');

        // Create 6 empty hotbar slots for customization
        for (let i = 1; i <= 6; i++) {
            const item = document.createElement('div');
            item.className = 'hotbar-item';
            item.id = `hotbar-slot-${i}`;
            item.dataset.building = '';
            item.dataset.slotIndex = i - 1;
            
            item.innerHTML = `
                <div class="hotbar-item-icon">+</div>
                <div class="hotbar-item-key">${i}</div>
                <div class="hotbar-item-name">Empty</div>
            `;

            item.addEventListener('click', () => {
                // Can be populated by HUD's hotbar assignment
            });

            itemsContainer.appendChild(item);
        }

        document.body.appendChild(hotbar);
        this.panel = hotbar;
    }

    /**
     * Setup keyboard bindings for hotkeys
     */
    setupKeyboardBindings() {
        document.addEventListener('keydown', (e) => {
            // Keys 1-6 for building selection with TOGGLE behavior
            if (e.key >= '1' && e.key <= '6') {
                const buildingKey = this.inventory.getBuildingByHotkey(e.key);
                if (buildingKey) {
                    // TOGGLE: If same building selected, deselect it
                    if (this.selectedBuildingType === buildingKey) {
                        this.deselectBuilding();
                    } else {
                        this.selectBuilding(buildingKey);
                    }
                }
            }

            // Esc to cancel building
            if (e.key === 'Escape') {
                this.deselectBuilding();
            }
        });
    }

    /**
     * Select a building from hotbar
     */
    selectBuilding(buildingKey) {
        const building = this.inventory.getBuilding(buildingKey);
        if (!building) return;

        this.selectedBuilding = buildingKey;
        this.selectedBuildingType = buildingKey;  // Track for toggle functionality

        // Update visual feedback
        document.querySelectorAll('.hotbar-item').forEach(item => {
            item.classList.remove('active');
        });

        const selected = document.querySelector(`#hotbar-${buildingKey}`);
        if (selected) {
            selected.classList.add('active');
        }

        // Request InputManager to prepare for building
        if (this.inputManager) {
            this.inputManager.selectBuildingType(buildingKey);
        }

        // Update HUD
        if (this.hud) {
            const cost = building.cost 
                ? Object.entries(building.cost).map(([type, amt]) => `${amt} ${type}`).join(' + ')
                : 'Free';
            
            // Could add tooltip here
            console.log(`Selected: ${building.name} (Cost: ${cost})`);
        }
    }

    /**
     * Deselect current building
     */
    deselectBuilding() {
        this.selectedBuilding = null;
        this.selectedBuildingType = null;  // Clear toggle tracking
        document.querySelectorAll('.hotbar-item').forEach(item => {
            item.classList.remove('active');
        });

        if (this.inputManager) {
            this.inputManager.selectBuildingType(null);
        }
    }

    /**
     * Show warning when can't afford building
     */
    showAffordanceWarning(buildingKey) {
        const building = this.inventory.getBuilding(buildingKey);
        const item = document.querySelector(`#hotbar-${buildingKey}`);
        
        if (item) {
            item.classList.add('unaffordable');
            // Flash for 1 second
            setTimeout(() => {
                item.classList.remove('unaffordable');
            }, 1000);
        }

        // Could also show a tooltip
        console.warn(`Insufficient resources for ${building.name}`);
    }

    /**
     * Get currently selected building
     */
    getSelectedBuilding() {
        return this.selectedBuilding;
    }

    /**
     * Toggle visibility
     */
    setVisible(visible) {
        if (this.panel) {
            this.panel.style.display = visible ? 'flex' : 'none';
        }
    }
}

export default Hotbar;
