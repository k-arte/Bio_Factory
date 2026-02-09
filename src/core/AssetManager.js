import * as THREE from 'three';

/**
 * AssetManager: Centralized asset loading with hot-swappable support
 * Features:
 * - Manifest-based path mapping (logical names to file paths)
 * - Soft fallback system (returns defaults if assets fail to load)
 * - Prevents game crashes from missing assets
 */
class AssetManager {
    constructor() {
        this.textureLoader = new THREE.TextureLoader();
        this.gltfLoader = null; // Lazy-loaded if needed
        
        // Asset cache
        this.textures = {};
        this.models = {};
        this.loadingPromises = {};
        
        // Define asset manifest (logical name -> file path)
        this.manifest = {
            textures: {
                'floor_tissue': '/assets/textures/tissue.png',
                'vessel_tissue': '/assets/textures/vessel.png',
                'storage_metal': '/assets/textures/metal.png',
                'extractor_bio': '/assets/textures/bio_extract.png',
            },
            models: {
                'building_extractor': '/assets/models/extractor.gltf',
                'building_vessel': '/assets/models/vessel.gltf',
                'building_storage': '/assets/models/storage.gltf',
            }
        };

        // Default colors (soft fallback)
        this.defaultColors = {
            'floor_tissue': new THREE.Color(0x1a4d4d),      // Teal
            'vessel_tissue': new THREE.Color(0x661a1a),     // Deep red
            'storage_metal': new THREE.Color(0x444444),     // Gray
            'extractor_bio': new THREE.Color(0x2d5a2d),     // Dark green
        };

        // Default geometry for models (soft fallback)
        this.defaultGeometries = {
            'building_extractor': () => new THREE.ConeGeometry(0.4, 1.0, 8),
            'building_vessel': () => new THREE.CylinderGeometry(0.3, 0.3, 1.2, 6),
            'building_storage': () => new THREE.BoxGeometry(0.8, 1.0, 0.8),
        };
    }

    /**
     * Get texture by logical name
     * Returns cached texture, loads if not cached, or returns default color
     * @param {string} name - Logical texture name
     * @returns {THREE.Texture|THREE.Color|null} Texture, color, or null
     */
    async getTexture(name) {
        // Return cached texture if available
        if (this.textures[name]) {
            return this.textures[name];
        }

        // Return default color immediately if texture not yet loaded
        if (this.defaultColors[name]) {
            return this.defaultColors[name];
        }

        // Get path from manifest
        const path = this.manifest.textures[name];
        if (!path) {
            console.warn(`[AssetManager] Texture "${name}" not found in manifest`);
            return null;
        }

        // Create loading promise if not already loading
        if (!this.loadingPromises[name]) {
            this.loadingPromises[name] = this.loadTextureWithFallback(path, name);
        }

        try {
            await this.loadingPromises[name];
            return this.textures[name] || this.defaultColors[name];
        } catch (error) {
            console.error(`[AssetManager] Failed to load texture "${name}":`, error);
            return this.defaultColors[name] || null;
        }
    }

    /**
     * Internal texture loading with soft fallback
     * @private
     */
    loadTextureWithFallback(path, name) {
        return new Promise((resolve) => {
            this.textureLoader.load(
                path,
                (texture) => {
                    this.textures[name] = texture;
                    console.log(`[AssetManager] Loaded texture: ${name}`);
                    resolve(texture);
                },
                undefined,
                (error) => {
                    console.warn(`[AssetManager] Texture load failed (${path}), using fallback:`);
                    // Soft fallback: use default color instead of crashing
                    resolve(this.defaultColors[name]);
                }
            );
        });
    }

    /**
     * Get model by logical name (synchronous, returns default if not loaded)
     * @param {string} name - Logical model name
     * @returns {THREE.Geometry} Default or cached geometry
     */
    getModel(name) {
        // Return cached model if available
        if (this.models[name]) {
            return this.models[name].geometry;
        }

        // Return default geometry (soft fallback)
        const defaultFn = this.defaultGeometries[name];
        if (defaultFn) {
            console.log(`[AssetManager] Using default geometry for model: ${name}`);
            return defaultFn();
        }

        console.warn(`[AssetManager] Model "${name}" not found, returning default cube`);
        return new THREE.BoxGeometry(1, 1, 1);
    }

    /**
     * Preload specific textures (useful for UI hints or background loading)
     * @param {string[]} textureNames - Array of texture names to preload
     */
    async preloadTextures(textureNames) {
        const promises = textureNames.map(name => this.getTexture(name));
        await Promise.all(promises);
        console.log(`[AssetManager] Preloaded ${textureNames.length} textures`);
    }

    /**
     * Update manifest at runtime (hot-swap support)
     * Allows game to swap asset paths without reload
     * @param {object} updates - New manifest entries { textures: {...}, models: {...} }
     */
    updateManifest(updates) {
        if (updates.textures) {
            this.manifest.textures = { ...this.manifest.textures, ...updates.textures };
        }
        if (updates.models) {
            this.manifest.models = { ...this.manifest.models, ...updates.models };
        }
        console.log('[AssetManager] Manifest updated (hot-swap)');
    }

    /**
     * Clear texture cache (useful for memory management or testing)
     */
    clearCache() {
        Object.values(this.textures).forEach(texture => {
            if (texture instanceof THREE.Texture) {
                texture.dispose();
            }
        });
        this.textures = {};
        this.loadingPromises = {};
        console.log('[AssetManager] Cache cleared');
    }
}

export default AssetManager;
