/**
 * PROGRESSION_SYSTEM_EXAMPLE.js
 * 
 * Complete working example of the Event-Driven Progression System
 * Shows how to initialize, trigger events, and check unlocks
 */

// ============================================================
// EXAMPLE 1: BASIC INITIALIZATION
// ============================================================

async function initializeGame() {
  // Create managers
  const saveManager = new SaveManager();
  const progressionManager = new ProgressionManager();
  const guideUI = new GuideUI();
  
  // Initialize in correct order
  await saveManager.startAutoSave();
  await progressionManager.initialize(saveManager);
  
  // Setup GUI
  const guidePanel = document.querySelector('#guide-panel');
  guideUI.initialize(guidePanel);
  progressionManager.onUnlockCallback = (data) => guideUI.onEntryUnlocked(data);
  
  console.log("✅ Game initialized!");
  
  // Make globally available for testing
  window.gameManager = { saveManager, progressionManager, guideUI };
}

// ============================================================
// EXAMPLE 2: SIMULATING GAME EVENTS
// ============================================================

function simulateGameplay() {
  const pm = window.gameManager.progressionManager;
  
  console.log("\n=== SIMULATION: Player builds extractors ===");
  
  // Player builds 3 extractors, each produces 5 glucose/second
  for (let i = 0; i < 3; i++) {
    // Simulate 100 seconds of production
    for (let t = 0; t < 100; t++) {
      pm.onResourceProduced('RES_GLUCOSE', 15); // 3 × 5 glucose
    }
    console.log(`After extractor ${i+1}: ${pm.stats.total_energy_produced} energy produced`);
  }
  
  // Check if mitochondria is now unlocked
  if (pm.isUnlocked('BLD_MITOCHONDRIA')) {
    console.log("🎉 Mitochondria UNLOCKED!");
  } else {
    const hint = pm.getUnlockHint('BLD_MITOCHONDRIA');
    console.log(`Still locked: ${hint}`);
  }
}

// ============================================================
// EXAMPLE 3: TRACKING COMBAT STATS
// ============================================================

function simulateCombat() {
  const pm = window.gameManager.progressionManager;
  
  console.log("\n=== SIMULATION: Combat with bacteria ===");
  
  // Player kills bacteria one at a time
  for (let i = 0; i < 15; i++) {
    pm.onEnemyKilled('UNIT_BACTERIA_BASIC');
    console.log(`Killed bacteria #${i+1}`);
    
    // Check if macrophage unlocks
    if (pm.isUnlocked('UNIT_MACROPHAGE')) {
      console.log("🎉 Macrophage UNLOCKED!");
      break;
    }
  }
  
  // Check current combat stats
  console.log("Combat stats:", pm.stats.enemies_killed);
}

// ============================================================
// EXAMPLE 4: RESEARCH CHAIN
// ============================================================

async function simulateResearch() {
  const pm = window.gameManager.progressionManager;
  
  console.log("\n=== SIMULATION: Research progression ===");
  
  // First, produce lots of energy
  console.log("Producing energy...");
  for (let i = 0; i < 1500; i++) {
    pm.onResourceProduced('RES_GLUCOSE', 1);
  }
  
  // Now trigger research completion
  if (pm.isUnlocked('TECH_VASODILATION')) {
    console.log("🎉 Vasodilation research UNLOCKED!");
  } else {
    console.log("Still need more energy for vasodilation research");
  }
}

// ============================================================
// EXAMPLE 5: CHECKING WHAT'S AVAILABLE
// ============================================================

function checkAvailableContent() {
  const pm = window.gameManager.progressionManager;
  
  console.log("\n=== AVAILABLE CONTENT ===");
  
  // Get all unlocked buildings
  const buildings = pm.getUnlockedEntriesByType('buildings');
  console.log(`Unlocked buildings (${buildings.length}):`);
  buildings.forEach(b => console.log(`  - ${b.icon} ${b.name}`));
  
  // Get all locked units
  const lockedUnits = pm.getLockedEntriesByType('units');
  console.log(`\nLocked units (${lockedUnits.length}):`);
  lockedUnits.forEach(u => {
    const hint = pm.getUnlockHint(u.id);
    console.log(`  - ${u.name}: ${hint}`);
  });
}

// ============================================================
// EXAMPLE 6: SAVE/LOAD CYCLE
// ============================================================

async function testSaveLoad() {
  console.log("\n=== SAVE/LOAD TEST ===");
  
  const pm = window.gameManager.progressionManager;
  const sm = window.gameManager.saveManager;
  
  // Check current state
  console.log("Before save:", {
    unlockedCount: pm.unlockedIds.size,
    energyProduced: pm.stats.total_energy_produced,
    unlocked: Array.from(pm.unlockedIds).slice(0, 5)
  });
  
  // Save manually
  await sm.saveGameState({
    unlocked_entries: Array.from(pm.unlockedIds),
    tracked_stats: pm.stats
  });
  console.log("✅ Saved!");
  
  // Simulate loading (in real game, would be on new session)
  const loaded = await sm.loadGameState();
  console.log("After load:", {
    unlockedCount: loaded.unlocked_entries.length,
    energyProduced: loaded.tracked_stats.total_energy_produced
  });
  
  // Export save file
  sm.exportSave();
  console.log("✅ Exported to file!");
}

// ============================================================
// EXAMPLE 7: LISTENER DEBUGGING
// ============================================================

function debugListeners() {
  const pm = window.gameManager.progressionManager;
  
  console.log("\n=== LISTENER MAPS ===");
  
  pm.debugListeners();
  
  // Show specific listeners
  console.log("\nLooking for entries waiting on 'total_energy_produced':");
  const statListeners = pm.listeners_on_stat['total_energy_produced'] || [];
  statListeners.forEach(listener => {
    console.log(`  - ${listener.entryId}: unlock at ${listener.condition.value}`);
  });
  
  console.log("\nLooking for entries waiting on kill counts:");
  Object.entries(pm.listeners_on_kill).forEach(([unit, listeners]) => {
    console.log(`  - ${unit}:`);
    listeners.forEach(l => console.log(`    ${l.entryId}: unlock after ${l.condition.value} kills`));
  });
}

// ============================================================
// EXAMPLE 8: FULL INTEGRATION TEST
// ============================================================

async function fullIntegrationTest() {
  console.log("\n╔════════════════════════════════════════╗");
  console.log("║   FULL PROGRESSION SYSTEM TEST        ║");
  console.log("╚════════════════════════════════════════╝");
  
  // Initialize
  await initializeGame();
  
  // Test 1: Check initial state
  console.log("\n[TEST 1] Initial state");
  checkAvailableContent();
  
  // Test 2: Simulate production
  console.log("\n[TEST 2] Resource production unlocks");
  simulateGameplay();
  
  // Test 3: Simulate combat
  console.log("\n[TEST 3] Combat unlocks");
  simulateCombat();
  
  // Test 4: Check final state
  console.log("\n[TEST 4] Final unlocked content");
  checkAvailableContent();
  
  // Test 5: Debug listeners
  console.log("\n[TEST 5] Listener structure");
  debugListeners();
  
  // Test 6: Save/load
  console.log("\n[TEST 6] Save/load persistence");
  await testSaveLoad();
  
  console.log("\n✅ All tests complete!");
  console.log("\nTip: Type these in console:");
  console.log("  window.gameManager.progressionManager.stats");
  console.log("  window.gameManager.progressionManager.unlockedIds");
  console.log("  window.gameManager.progressionManager.getUnlockHint('BLD_MITOCHONDRIA')");
}

// ============================================================
// RUN EXAMPLE
// ============================================================

// To run this test, paste in browser console (after page loads):
// fullIntegrationTest();

// Individual commands to copy/paste:
/*
// 1. Initialize
initializeGame();

// 2. Produce lots of energy
for(let i=0; i<500; i++) { window.gameManager.progressionManager.onResourceProduced('RES_GLUCOSE', 5); }
window.gameManager.progressionManager.stats.total_energy_produced;

// 3. Check if mitochondria unlocked
window.gameManager.progressionManager.isUnlocked('BLD_MITOCHONDRIA');

// 4. See unlock hint
window.gameManager.progressionManager.getUnlockHint('BLD_MITOCHONDRIA');

// 5. Kill bacteria for macrophage
for(let i=0; i<10; i++) { window.gameManager.progressionManager.onEnemyKilled('UNIT_BACTERIA_BASIC'); }
window.gameManager.progressionManager.isUnlocked('UNIT_MACROPHAGE');

// 6. Check all unlocked buildings
window.gameManager.progressionManager.getUnlockedEntriesByType('buildings');

// 7. Save game
window.gameManager.saveManager.exportSave();

// 8. View save data
JSON.parse(localStorage.getItem('bio_factory_save_v1'));
*/

export { 
  initializeGame,
  simulateGameplay,
  simulateCombat,
  simulateResearch,
  checkAvailableContent,
  testSaveLoad,
  debugListeners,
  fullIntegrationTest
};
