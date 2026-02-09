import Engine from './core/Engine.js';
import Grid from './world/Grid.js';
import * as THREE from 'three';

// Initialize engine
try {
    console.log('[INIT] Creating Engine...');
    const engine = new Engine();
    console.log('[INIT] Engine created, scene has', engine.scene.children.length, 'children');

    // Create grid
    console.log('[INIT] Creating Grid...');
    const grid = new Grid(engine.scene);
    console.log('[INIT] Grid created, gridSize:', grid.gridSize, 'cellSize:', grid.cellSize, 'scene children:', engine.scene.children.length);

    // Initialize grid and camera systems
    console.log('[INIT] Initializing Grid and Camera...');
    engine.initializeGridAndCamera(grid);
    console.log('[INIT] Grid and Camera initialized, scene children:', engine.scene.children.length);

    // Create demo factory using engine's placement manager
    console.log('[INIT] Generating demo factory...');
    engine.placementManager.createDemoFactory();
    console.log('[INIT] Demo factory created');

    // Setup update loop with all systems
    engine.onUpdate = (deltaTime) => {
        engine.transportSystem.update(deltaTime);
        engine.placementManager.update(deltaTime);
    };

    // Log final initialization state
    console.log('[INIT] Scene children count:', engine.scene.children.length);
    if (grid.gridGroup) {
        console.log('[INIT] GridGroup merged tiles:', grid.gridGroup.children[0]?.name);
    }

    // Start animation loop
    console.log('[INIT] Starting animation loop...');
    engine.start();
    console.log('[INIT] All systems initialized successfully!');

} catch (error) {
    console.error('[INIT] CRITICAL INITIALIZATION ERROR:', error);
    console.error('[INIT] Stack:', error.stack);
}
