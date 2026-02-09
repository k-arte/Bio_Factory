import * as THREE from 'three';
import BioShader from '../shaders/BioShader.js';

class ResourceItem {
    constructor(type, resourceManager) {
        this.type = type;
        this.resourceManager = resourceManager;
        this.grid_x = 0;
        this.grid_z = 0;
        this.mesh = this.createMesh(type);
        this.isActive = false;
        this.targetPosition = new THREE.Vector3();
    }

    createMesh(type) {
        let geometry, baseColor;
        const config = this.resourceManager.getResourceConfig(type);

        switch(type) {
            case 'ION':
                geometry = new THREE.SphereGeometry(0.3, 16, 16);
                baseColor = new THREE.Color(0x00ffff); // Cyan (energetic ionic particles)
                break;
            case 'PROTEIN':
                geometry = new THREE.TetrahedronGeometry(0.35);
                baseColor = new THREE.Color(0xffff00); // Yellow (bright protein structures)
                break;
            case 'GLUCOSE':
                geometry = new THREE.BoxGeometry(0.35, 0.35, 0.35);
                baseColor = new THREE.Color(0xffffff); // White (pure energy/sugar)
                break;
            default:
                geometry = new THREE.SphereGeometry(0.3, 16, 16);
                baseColor = new THREE.Color(0xffffff);
        }

        const material = new BioShader(false);
        material.uniforms.baseColor.value = baseColor;
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.resourceItem = this;
        
        return mesh;
    }

    setPosition(gridX, gridZ, worldPos) {
        this.grid_x = gridX;
        this.grid_z = gridZ;
        this.mesh.position.copy(worldPos);
        this.targetPosition.copy(worldPos);
    }

    updateShaderTime(time) {
        if (this.mesh.material.updateTime) {
            this.mesh.material.updateTime(time);
        }
    }

    reset() {
        this.isActive = false;
        this.grid_x = 0;
        this.grid_z = 0;
    }
}

class ResourceManager {
    constructor(scene) {
        this.scene = scene;
        this.resourcePool = {
            ION: [],
            PROTEIN: [],
            GLUCOSE: []
        };
        
        this.resourceConfig = {
            ION: { color: 0x0099ff, size: 0.3 },
            PROTEIN: { color: 0xffff00, size: 0.35 },
            GLUCOSE: { color: 0x00ff00, size: 0.35 }
        };

        this.poolSize = 100; // Max resources per type
        this.initializePools();
    }

    getResourceConfig(type) {
        return this.resourceConfig[type] || this.resourceConfig['ION'];
    }

    initializePools() {
        Object.keys(this.resourcePool).forEach(type => {
            for (let i = 0; i < this.poolSize; i++) {
                const item = new ResourceItem(type, this);
                item.mesh.visible = false;
                this.scene.add(item.mesh);
                this.resourcePool[type].push(item);
            }
        });
    }

    /**
     * Get or create a resource item from the pool
     */
    getResource(type, gridX, gridZ, worldPos) {
        const pool = this.resourcePool[type];
        let item = pool.find(r => !r.isActive);
        
        if (!item) {
            console.warn(`Resource pool exhausted for ${type}`);
            return null;
        }

        item.setPosition(gridX, gridZ, worldPos);
        item.isActive = true;
        item.mesh.visible = true;
        
        return item;
    }

    /**
     * Return resource to pool (disable it)
     */
    releaseResource(item) {
        if (item) {
            item.reset();
            item.mesh.visible = false;
        }
    }

    /**
     * Update all active resources (for shader animations)
     */
    updateAll(time) {
        Object.values(this.resourcePool).forEach(pool => {
            pool.forEach(item => {
                if (item.isActive) {
                    item.updateShaderTime(time);
                }
            });
        });
    }

    /**
     * Get count of active resources
     */
    getActiveCount(type) {
        return this.resourcePool[type].filter(r => r.isActive).length;
    }
}

export default ResourceManager;
export { ResourceItem };
