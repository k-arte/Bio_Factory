import * as THREE from 'three';

class Lighting {
    constructor(scene) {
        this.scene = scene;
        // Lighting is now handled in Engine.setupScene()
        // This class is kept for compatibility
    }

    setupLights() {
        // No-op: Lighting is configured in Engine.setupScene()
    }
}

export default Lighting;
