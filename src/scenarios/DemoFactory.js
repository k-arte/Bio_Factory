/**
 * DemoFactory: Pre-configured factory scenario for testing and demonstration
 * 
 * Creates a complete working factory setup:
 * - Multiple extractor buildings (ATP generators)
 * - Vessel network connecting extractors to storage
 * - Storage buildings as resource sinks
 * - Demonstrates full resource flow pipeline
 * 
 * Architecture:
 * - Extractors at positions [10,10], [10,20], [20,10]
 * - Manual vessel tracing between extractors and storage
 * - Storage buildings at [10,30], [30,10]
 * - All buildings automatically registered with transport system
 */
class DemoFactory {
    constructor(engine) {
        this.engine = engine;
        this.placementManager = engine.placementManager;
        this.grid = engine.grid;
        this.inputManager = engine.inputManager;
        
        console.log('[DemoFactory] Initialized');
    }

    /**
     * Quick setup: Place extractors and storage (manual vessel placement)
     * Useful for rapid testing of transport pipeline
     */
    setupQuick() {
        console.log('[DemoFactory] Starting quick setup...');
        
        // Place extractors (ATP producers)
        console.log('[DemoFactory] Placing extractors...');
        const ext1 = this.placementManager.placeExtractor(10, 10);
        const ext2 = this.placementManager.placeExtractor(10, 20);
        const ext3 = this.placementManager.placeExtractor(20, 10);
        
        console.log('[DemoFactory] ✓ Placed 3 extractors');
        
        // Place storage buildings (resource sinks)
        console.log('[DemoFactory] Placing storage...');
        const stor1 = this.placementManager.placeStorage(10, 30);
        const stor2 = this.placementManager.placeStorage(30, 10);
        
        console.log('[DemoFactory] ✓ Placed 2 storage buildings');
        
        // Log setup for player guidance
        console.log('[DemoFactory] Quick setup complete!');
        console.log('  Next: Press V to enter vessel mode');
        console.log('  Click [10,10] → [10,30] to create vessel path');
        console.log('  Or manually connection extractors to storage');
        
        return { extractors: [ext1, ext2, ext3], storage: [stor1, stor2] };
    }

    /**
     * Full setup: Place extractors, vessels AND storage (fully connected)
     * Creates complete working factory with resource flow immediate
     */
    setupFull() {
        console.log('[DemoFactory] Starting FULL automated setup...');
        
        // Phase 1: Place extractors
        console.log('[DemoFactory] Phase 1: Placing extractors...');
        const extractors = [
            this.placementManager.placeExtractor(10, 10),
            this.placementManager.placeExtractor(10, 20),
            this.placementManager.placeExtractor(20, 10)
        ];
        console.log('[DemoFactory]   ✓ 3 extractors placed');
        
        // Phase 2: Place vessels (manual path tracing)
        console.log('[DemoFactory] Phase 2: Tracing vessel paths...');
        
        // Path 1: Extractor [10,10] → Storage [10,30]
        const path1 = this._traceVesselPath([10, 10], [10, 30]);
        console.log(`[DemoFactory]   ✓ Path 1: ${path1.length} vessels`);
        
        // Path 2: Extractor [10,20] → Storage [10,30] (joins path 1)
        const path2 = this._traceVesselPath([10, 20], [10, 30]);
        console.log(`[DemoFactory]   ✓ Path 2: ${path2.length} vessels`);
        
        // Path 3: Extractor [20,10] → Storage [30,10]
        const path3 = this._traceVesselPath([20, 10], [30, 10]);
        console.log(`[DemoFactory]   ✓ Path 3: ${path3.length} vessels`);
        
        // Phase 3: Place storage
        console.log('[DemoFactory] Phase 3: Placing storage buildings...');
        const storage = [
            this.placementManager.placeStorage(10, 30),
            this.placementManager.placeStorage(30, 10)
        ];
        console.log('[DemoFactory]   ✓ 2 storage buildings placed');
        
        // Phase 4: Status report
        console.log('[DemoFactory] ✅ FULL SETUP COMPLETE!');
        console.log('  Factory statistics:');
        console.log(`    - Extractors: ${extractors.length}`);
        console.log(`    - Vessel segments: ${path1.length + path2.length + path3.length}`);
        console.log(`    - Storage: ${storage.length}`);
        console.log('  Resource flow active! Check HUD for transport stats.');
        
        return { extractors, storage, vessels: [...path1, ...path2, ...path3] };
    }

    /**
     * Trace a Manhattan path between two points and place vessels along it
     * Private helper for setupFull()
     */
    _traceVesselPath(start, end) {
        const path = [];
        const [sx, sz] = start;
        const [ex, ez] = end;
        
        // Go along X first
        const xStep = Math.sign(ex - sx) || 0;
        for (let x = sx; x !== ex; x += xStep) {
            const v = this.placementManager.placeVessel(x, sz, 'right');
            if (v) path.push(v);
        }
        
        // Then go along Z
        const zStep = Math.sign(ez - sz) || 0;
        for (let z = sz; z !== ez; z += zStep) {
            const v = this.placementManager.placeVessel(ex, z, 'down');
            if (v) path.push(v);
        }
        
        return path;
    }

    /**
     * Minimal setup: 1 extractor → 1 storage with vessels
     * Fastest way to see resource flow
     */
    setupMinimal() {
        console.log('[DemoFactory] Starting minimal setup...');
        
        const ext = this.placementManager.placeExtractor(15, 15);
        
        // Create vessel path
        const path = [];
        for (let z = 15; z < 25; z++) {
            const v = this.placementManager.placeVessel(15, z, 'down');
            if (v) path.push(v);
        }
        
        const stor = this.placementManager.placeStorage(15, 25);
        
        console.log('[DemoFactory] ✓ Minimal setup ready');
        console.log('  Single extractor → storage with simple path');
        
        return { extractor: ext, storage: stor, vessels: path };
    }

    /**
     * Stress test: Many extractors producing simultaneously
     * Tests transport system performance under load
     */
    setupStressTest() {
        console.log('[DemoFactory] Starting STRESS TEST setup...');
        
        // Create 5x5 grid of extractors
        const extractors = [];
        for (let x = 5; x < 30; x += 5) {
            for (let z = 5; z < 30; z += 5) {
                const ext = this.placementManager.placeExtractor(x, z);
                if (ext) extractors.push(ext);
            }
        }
        
        console.log(`[DemoFactory] ✓ ${extractors.length} extractors placed`);
        
        // Create central hub storage
        const centerStor = this.placementManager.placeStorage(15, 15);
        
        console.log('[DemoFactory] ✓ Central storage at [15,15]');
        console.log('  25 extractors → central hub');
        console.log('  Tests multi-path routing and congestion handling');
        
        return { extractors, storage: centerStor };
    }

    /**
     * Print current factory statistics to console
     */
    printStats() {
        const stats = this.engine.resourceTransport?.getStats() || {};
        
        console.log('\n╔════════════════════════════════════════╗');
        console.log('║  FACTORY STATUS REPORT                 ║');
        console.log('╚════════════════════════════════════════╝');
        console.log(`Active packets: ${stats.activePackets || 0}`);
        console.log(`Trail particles: ${stats.activeTrails || 0}`);
        console.log(`\nNetwork:`);
        console.log(`  Extractors: ${stats.registeredExtractors || 0}`);
        console.log(`  Vessels: ${stats.registeredVessels || 0}`);
        console.log(`  Storage: ${stats.registeredStorages || 0}`);
        console.log(`\nDelivery metrics:`);
        console.log(`  Created: ${stats.totalPacketsCreated || 0} packets`);
        console.log(`  Delivered: ${stats.totalPacketsDelivered || 0} packets`);
        console.log(`  Success rate: ${stats.deliveryRate || 'N/A'}`);
        
        if (stats.totalResourceDelivered) {
            console.log(`\nResource totals:`);
            for (const [type, amount] of Object.entries(stats.totalResourceDelivered)) {
                if (amount > 0) {
                    console.log(`  ${type}: ${amount}`);
                }
            }
        }
        
        console.log('');
    }

    /**
     * Clear all demo buildings from the map
     */
    clear() {
        if (this.placementManager) {
            this.placementManager.clear();
            console.log('[DemoFactory] Cleared all buildings');
        }
    }
}

export default DemoFactory;
