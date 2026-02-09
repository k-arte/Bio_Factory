import * as THREE from 'three';
import { COLORS } from '../data/Colors.js';
import shaderProfileManager from '../core/ShaderProfileManager.js';

class Grid {
    constructor(scene) {
        this.scene = scene;
        this.gridSize = 50;
        this.cellSize = 1;
        this.width = this.gridSize;
        this.height = this.gridSize;
        this.gridGroup = new THREE.Group();
        this.gridGroup.name = 'GridGroup';
        
        console.log('[Grid] Initializing grid...');
        
        // Terrain types
        this.TERRAIN_TYPES = {
            ENDOTHELIUM: 0,
            CALCIFIED: 1,
            CAPILLARY: 2
        };

        // Generate terrain map
        console.log('[Grid] Generating terrain map...');
        this.terrainMap = this.generateTerrainMap();
        
        // Create grid
        console.log('[Grid] Creating square grid...');
        this.createSquareGrid();
        
        // Add to scene
        this.scene.add(this.gridGroup);
        console.log('[Grid] Grid added to scene. Total children in gridGroup:', this.gridGroup.children.length);
    }

    /**
     * Generate procedural terrain map
     * Creates a 2D array of terrain types with some structure
     */
    generateTerrainMap() {
        const map = [];
        for (let x = 0; x < this.gridSize; x++) {
            map[x] = [];
            for (let z = 0; z < this.gridSize; z++) {
                // Procedural terrain generation
                // 70% Endothelium, 15% Capillary (resource zones), 15% Calcified (bone)
                const random = Math.random();
                
                // Create some clusters
                const cellX = x / this.gridSize;
                const cellZ = z / this.gridSize;
                const noise = Math.sin(cellX * 5) * Math.cos(cellZ * 5) + Math.sin(cellX * 2) * Math.cos(cellZ * 3);
                const noiseVal = (noise + 2) / 4; // Normalize to 0-1
                
                let terrain;
                if (random + noiseVal * 0.3 < 0.15) {
                    terrain = this.TERRAIN_TYPES.CALCIFIED;
                } else if (random + noiseVal * 0.2 < 0.30) {
                    terrain = this.TERRAIN_TYPES.CAPILLARY;
                } else {
                    terrain = this.TERRAIN_TYPES.ENDOTHELIUM;
                }
                
                map[x][z] = terrain;
            }
        }
        return map;
    }

    createSquareGrid() {
        const totalSize = this.gridSize * this.cellSize;
        const halfSize = totalSize / 2;
        
        // Create simple colored grid tiles - proven approach
        this.createSimpleTerrainTiles(halfSize);
        
        // Create visible grid lines
        this.createGridLines(halfSize);
    }

    /**
     * Create normal map from the flesh texture for microroughness
     * Generates 3D height illusion from grain/cracks
     */
    createNormalMapFromFlesh(size = 512) {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        // Start with medium gray (0.5, 0.5, 1.0 = flat normal pointing up)
        ctx.fillStyle = '#8080FF';
        ctx.fillRect(0, 0, size, size);
        
        const imageData = ctx.getImageData(0, 0, size, size);
        const data = imageData.data;
        
        // Create grain-based normal details - large blocks for surface irregularities
        const grainSize = 32;
        for (let y = 0; y < size; y += grainSize) {
            for (let x = 0; x < size; x += grainSize) {
                const blockValue = Math.random();
                const normalStrength = (blockValue - 0.5) * 0.6;  // Varied surface angle
                
                for (let yi = y; yi < Math.min(y + grainSize, size); yi++) {
                    for (let xi = x; xi < Math.min(x + grainSize, size); xi++) {
                        const idx = (yi * size + xi) * 4;
                        
                        // XY channels for surface slope
                        data[idx] = Math.max(50, Math.min(205, 128 + normalStrength * 100));      // X (width)
                        data[idx + 1] = Math.max(50, Math.min(205, 128 + normalStrength * 100));  // Y (height)
                        data[idx + 2] = 200;  // Z (depth) - mostly pointing up
                        data[idx + 3] = 255;
                    }
                }
            }
        }
        
        // Add directional cracks to normal map - creates ravines
        for (let i = 0; i < 15; i++) {
            const startX = Math.random() * size;
            const startY = Math.random() * size;
            const angle = Math.random() * Math.PI * 2;
            const length = size * (0.3 + Math.random() * 0.5);
            const width = Math.random() * 15 + 10;
            
            for (let step = 0; step < length; step += 2) {
                const x = startX + Math.cos(angle) * step;
                const y = startY + Math.sin(angle) * step;
                
                // Perpendicular to crack direction for proper normal
                const normX = -Math.sin(angle);
                const normY = Math.cos(angle);
                
                for (let wy = -width; wy < width; wy++) {
                    for (let wx = -width; wx < width; wx++) {
                        const px = Math.floor(x + wx);
                        const py = Math.floor(y + wy);
                        
                        if (px >= 0 && px < size && py >= 0 && py < size) {
                            const idx = (py * size + px) * 4;
                            const dist = Math.sqrt(wx * wx + wy * wy);
                            if (dist < width) {
                                const falloff = 1 - (dist / width);
                                
                                // Deep cracks - sharp normal transition
                                data[idx] = Math.max(50, Math.min(205, 128 + normX * falloff * 80));
                                data[idx + 1] = Math.max(50, Math.min(205, 128 + normY * falloff * 80));
                                data[idx + 2] = Math.max(100, 200 - falloff * 100);  // Lower Z in cracks
                                data[idx + 3] = 255;
                            }
                        }
                    }
                }
            }
        }
        
        ctx.putImageData(imageData, 0, 0);
        
        // Create texture
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2, 2);
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearMipMapLinearFilter;
        
        return texture;
    }

    /**
     * Create procedural wet flesh texture (red with organic roughness)
     */
    createFleshTexture(size = 512) {
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        // Fill with base RED (more red, less pink)
        ctx.fillStyle = '#EE5544';  // More red, less pink
        ctx.fillRect(0, 0, size, size);
        
        // Create VERY ROUGH flesh appearance with LARGE DIRECTIONAL GRAIN
        const imageData = ctx.getImageData(0, 0, size, size);
        const data = imageData.data;
        
        // First pass: Create large grain blocks (low-frequency noise)
        const grainSize = 32;  // Large grain blocks
        for (let y = 0; y < size; y += grainSize) {
            for (let x = 0; x < size; x += grainSize) {
                // Random value for this grain block
                const blockValue = Math.random();
                
                // Fill this block with grain
                for (let yi = y; yi < Math.min(y + grainSize, size); yi++) {
                    for (let xi = x; xi < Math.min(x + grainSize, size); xi++) {
                        const idx = (yi * size + xi) * 4;
                        
                        // Red base with large variation
                        const variation = (blockValue - 0.5) * 80;  // Large grain variation
                        const rValue = Math.max(140, Math.min(255, 238 + variation));
                        const gValue = Math.max(20, Math.min(150, 68 + variation * 0.3));
                        const bValue = Math.max(60, Math.min(180, 68 + variation * 0.5));
                        
                        data[idx] = rValue;
                        data[idx + 1] = gValue;
                        data[idx + 2] = bValue;
                        data[idx + 3] = 255;
                    }
                }
            }
        }
        
        // Second pass: Add larger directional streaks/cracks for roughness
        for (let i = 0; i < 15; i++) {
            // Random starting point and direction
            const startX = Math.random() * size;
            const startY = Math.random() * size;
            const angle = Math.random() * Math.PI * 2;
            const length = size * (0.3 + Math.random() * 0.5);
            const width = Math.random() * 20 + 15;  // Wide cracks
            
            // Draw streak
            for (let step = 0; step < length; step += 2) {
                const x = startX + Math.cos(angle) * step;
                const y = startY + Math.sin(angle) * step;
                
                // Draw wider line
                for (let wy = -width; wy < width; wy++) {
                    for (let wx = -width; wx < width; wx++) {
                        const px = Math.floor(x + wx);
                        const py = Math.floor(y + wy);
                        
                        if (px >= 0 && px < size && py >= 0 && py < size) {
                            const idx = (py * size + px) * 4;
                            const dist = Math.sqrt(wx * wx + wy * wy);
                            if (dist < width) {
                                // Darken this area for crack effect
                                const falloff = 1 - (dist / width);
                                const darkening = falloff * 100;
                                
                                data[idx] = Math.max(80, data[idx] - darkening);
                                data[idx + 1] = Math.max(10, data[idx + 1] - darkening * 0.7);
                                data[idx + 2] = Math.max(40, data[idx + 2] - darkening * 0.5);
                            }
                        }
                    }
                }
            }
        }
        
        // Third pass: Add very dark veins sparsely for extra texture
        for (let i = 0; i < data.length; i += 4) {
            const rand = Math.random();
            if (rand > 0.98) {  // Very sparse (2% probability)
                // Make this pixel much darker - aggressive cracks
                data[i] = Math.max(60, data[i] - 140);
                data[i + 1] = Math.max(5, data[i + 1] - 100);
                data[i + 2] = Math.max(40, data[i + 2] - 100);
            }
        }
        
        // Fourth pass: Add MANY glossy/wet spots on top for WETNESS appearance
        // This is the key to making it look wet, not plastic!
        for (let j = 0; j < 50; j++) {  // Many more spots (was 25, now 50)
            const x = Math.floor(Math.random() * size);
            const y = Math.floor(Math.random() * size);
            const radius = Math.random() * 40 + 20;  // Larger wet spots
            
            for (let yi = Math.max(0, y - radius); yi < Math.min(size, y + radius); yi++) {
                for (let xi = Math.max(0, x - radius); xi < Math.min(size, x + radius); xi++) {
                    const dist = Math.sqrt((xi - x) ** 2 + (yi - y) ** 2);
                    if (dist < radius) {
                        const idx = (yi * size + xi) * 4;
                        const intensity = 1 - (dist / radius);
                        
                        // BRIGHT glossy highlights - simulate wet sheen/moisture
                        data[idx] = Math.min(255, data[idx] + intensity * 100);      // Very bright red
                        data[idx + 1] = Math.min(255, data[idx + 1] + intensity * 80);
                        data[idx + 2] = Math.min(255, data[idx + 2] + intensity * 90);
                    }
                }
            }
        }
        
        ctx.putImageData(imageData, 0, 0);
        
        // Create texture
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2, 2); // Large visible grain
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearMipMapLinearFilter;
        
        return texture;
    }
    
    /**
     * Simple image smoothing for wet effect
     */
    smoothImageData(data, size, iterations = 1) {
        for (let iter = 0; iter < iterations; iter++) {
            const temp = new Uint8ClampedArray(data);
            
            for (let y = 1; y < size - 1; y++) {
                for (let x = 1; x < size - 1; x++) {
                    const idx = (y * size + x) * 4;
                    
                    // Average with neighbors (simple box blur)
                    let r = 0, g = 0, b = 0, count = 0;
                    
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            const nidx = ((y + dy) * size + (x + dx)) * 4;
                            r += temp[nidx];
                            g += temp[nidx + 1];
                            b += temp[nidx + 2];
                            count++;
                        }
                    }
                    
                    data[idx] = r / count;
                    data[idx + 1] = g / count;
                    data[idx + 2] = b / count;
                }
            }
        }
    }

    /**
     * Create colored terrain tiles (OPTIMIZED - single merged geometry)
     */
    createSimpleTerrainTiles(halfSize) {
        console.log('[Grid.Tiles] Starting tile creation with wet flesh texture...');
        
        // Create wet flesh textures
        const fleshTexture = this.createFleshTexture(512);
        const roughnessTexture = this.createFleshTexture(512); // Reuse as roughness variation
        const normalMap = this.createNormalMapFromFlesh(512);   // NEW: Normal map for microroughness

        // Create single merged geometry
        const mergedGeometry = new THREE.BufferGeometry();
        const positions = [];
        const indices = [];
        const uvs = [];
        let vertexIndex = 0;
        
        // Dimensions of a single tile
        const tileWidth = 0.98;
        const tileHeight = 0.98;
        
        // Create vertices for all tiles
        for (let x = 0; x < this.gridSize; x++) {
            for (let z = 0; z < this.gridSize; z++) {
                // Position on grid
                const posX = -halfSize + (x * this.cellSize) + (this.cellSize / 2);
                const posZ = -halfSize + (z * this.cellSize) + (this.cellSize / 2);
                const posY = 0.01;

                // Four corners of tile (CCW from top-left)
                const corners = [
                    [-tileWidth / 2, posY, -tileHeight / 2],
                    [tileWidth / 2, posY, -tileHeight / 2],
                    [tileWidth / 2, posY, tileHeight / 2],
                    [-tileWidth / 2, posY, tileHeight / 2]
                ];
                
                // UV coordinates for texture
                const uvCoords = [
                    [0, 0],
                    [1, 0],
                    [1, 1],
                    [0, 1]
                ];

                // Add vertices offset to world position
                corners.forEach((corner, idx) => {
                    positions.push(
                        posX + corner[0],
                        corner[1],
                        posZ + corner[2]
                    );
                    
                    // Add UV coordinates for texture mapping
                    uvs.push(uvCoords[idx][0], uvCoords[idx][1]);
                });

                // Add indices (two triangles per tile)
                const v0 = vertexIndex;
                const v1 = vertexIndex + 1;
                const v2 = vertexIndex + 2;
                const v3 = vertexIndex + 3;
                
                indices.push(v0, v1, v2);  // First triangle
                indices.push(v0, v2, v3);  // Second triangle
                
                vertexIndex += 4;
            }
        }

        // Build the merged geometry
        mergedGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
        mergedGeometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
        mergedGeometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));
        
        // Compute normals for lighting
        mergedGeometry.computeVertexNormals();
        mergedGeometry.computeBoundingBox();

        // Material for wet flesh ground - SIMPLIFIED for visibility
        // Use MeshStandardMaterial directly for reliable rendering
        const fleshMaterial = new THREE.MeshStandardMaterial({
            map: fleshTexture,
            roughnessMap: roughnessTexture,
            normalMap: normalMap,
            color: COLORS.GROUND_PRIMARY,
            emissive: COLORS.GROUND_EMIT,
            emissiveMap: roughnessTexture,
            emissiveIntensity: 0.5,
            
            roughness: 0.6,          // Wet appearance
            metalness: 0.0,          // Not metallic
            normalScale: new THREE.Vector2(0.4, 0.4),
            
            side: THREE.DoubleSide,
            flatShading: false
        });

        // Create single mesh from merged geometry
        const mergedMesh = new THREE.Mesh(mergedGeometry, fleshMaterial);
        mergedMesh.name = 'fleshGround';
        mergedMesh.receiveShadow = true;
        mergedMesh.castShadow = false;
        
        this.gridGroup.add(mergedMesh);
        
        console.log(`[Grid.Tiles] Created wet flesh ground with ${Math.round(positions.length / 3)} vertices`);
    }

    /**
     * Create visible grid lines
     */
    createGridLines(halfSize) {
        const points = [];
        const gridColor = COLORS.GRID_LINES; // Bright cyan grid
        
        // Vertical lines
        for (let i = 0; i <= this.gridSize; i++) {
            const x = -halfSize + (i * this.cellSize);
            points.push(new THREE.Vector3(x, 0.002, -halfSize));
            points.push(new THREE.Vector3(x, 0.002, halfSize));
        }
        
        // Horizontal lines
        for (let i = 0; i <= this.gridSize; i++) {
            const z = -halfSize + (i * this.cellSize);
            points.push(new THREE.Vector3(-halfSize, 0.002, z));
            points.push(new THREE.Vector3(halfSize, 0.002, z));
        }
        
        const geometry = new THREE.BufferGeometry();
        geometry.setFromPoints(points);
        
        // Use basic line material for visibility
        const material = new THREE.LineBasicMaterial({
            color: gridColor,
            transparent: true,
            opacity: 0.7
        });
        
        const gridLines = new THREE.LineSegments(geometry, material);
        gridLines.name = 'gridLines';
        gridLines.position.y = 0.002; // Slightly above tiles
        
        this.gridGroup.add(gridLines);
        this.gridMaterial = material;
        this.gridLines = gridLines;
    }

    updateShaderTime(time) {
        // Grid lines use LineBasicMaterial, no shader time needed
    }

    /**
     * Get grid cell from world position
     * @param {Vector3} worldPos - World position
     * @returns {Vector2} Grid coordinates [x, y]
     */
    getGridCell(worldPos) {
        const totalSize = this.gridSize * this.cellSize;
        const halfSize = totalSize / 2;
        
        const gridX = Math.floor((worldPos.x + halfSize) / this.cellSize);
        const gridZ = Math.floor((worldPos.z + halfSize) / this.cellSize);
        
        // Clamp to grid boundaries
        const clampedX = Math.max(0, Math.min(gridX, this.gridSize - 1));
        const clampedZ = Math.max(0, Math.min(gridZ, this.gridSize - 1));
        
        return { x: clampedX, z: clampedZ };
    }

    /**
     * Get world position from grid coordinates
     * @param {number} gridX - Grid X coordinate
     * @param {number} gridZ - Grid Z coordinate
     * @returns {Vector3} World position at cell center
     */
    getWorldPosition(gridX, gridZ) {
        const totalSize = this.gridSize * this.cellSize;
        const halfSize = totalSize / 2;
        
        const x = -halfSize + (gridX * this.cellSize) + (this.cellSize / 2);
        const z = -halfSize + (gridZ * this.cellSize) + (this.cellSize / 2);
        
        return new THREE.Vector3(x, 0, z);
    }

    /**
     * Get grid boundaries
     * @returns {Object} Boundaries with min and max
     */
    getBoundaries() {
        const totalSize = this.gridSize * this.cellSize;
        const halfSize = totalSize / 2;
        
        return {
            minX: -halfSize,
            maxX: halfSize,
            minZ: -halfSize,
            maxZ: halfSize
        };
    }

    /**
     * Get terrain type at grid coordinates
     * @param {number} gridX - Grid X coordinate
     * @param {number} gridZ - Grid Z coordinate
     * @returns {string} Human-readable terrain type name
     */
    getCellType(gridX, gridZ) {
        // Bounds check
        if (gridX < 0 || gridX >= this.gridSize || gridZ < 0 || gridZ >= this.gridSize) {
            return 'Out of Bounds';
        }

        const terrainId = this.terrainMap[gridX][gridZ];
        
        const terrainNames = {
            [this.TERRAIN_TYPES.ENDOTHELIUM]: 'Endothelium',
            [this.TERRAIN_TYPES.CALCIFIED]: 'Calcified Tissue',
            [this.TERRAIN_TYPES.CAPILLARY]: 'Capillary Bed'
        };

        return terrainNames[terrainId] || 'Unknown';
    }

    /**
     * Check if a cell is buildable
     * @param {number} gridX - Grid X coordinate
     * @param {number} gridZ - Grid Z coordinate
     * @returns {boolean} True if terrain allows building
     */
    isBuildable(gridX, gridZ) {
        const terrainId = this.terrainMap[gridX][gridZ];
        // Only Endothelium is buildable
        return terrainId === this.TERRAIN_TYPES.ENDOTHELIUM;
    }

    /**
     * Get raw terrain type ID
     * @param {number} gridX - Grid X coordinate
     * @param {number} gridZ - Grid Z coordinate
     * @returns {number} Terrain type ID
     */
    getCellTypeId(gridX, gridZ) {
        if (gridX < 0 || gridX >= this.gridSize || gridZ < 0 || gridZ >= this.gridSize) {
            return -1;
        }
        return this.terrainMap[gridX][gridZ];
    }

    /**
     * Update ground material based on current quality profile
     * Call this when switching between High/Medium/Low quality settings
     */
    updateGroundMaterial() {
        const groundMesh = this.gridGroup.children.find(child => child.name === 'fleshGround');
        if (groundMesh && groundMesh.material) {
            // Create new material from current profile
            const newMaterial = shaderProfileManager.createMaterial();
            
            // Preserve textures from old material
            if (groundMesh.material.map) {
                newMaterial.map = groundMesh.material.map;
            }
            if (groundMesh.material.roughnessMap) {
                newMaterial.roughnessMap = groundMesh.material.roughnessMap;
            }
            if (groundMesh.material.emissiveMap) {
                newMaterial.emissiveMap = groundMesh.material.emissiveMap;
            }
            
            // Apply ground-specific properties
            newMaterial.color.set(COLORS.GROUND_PRIMARY);
            newMaterial.emissive.set(COLORS.GROUND_EMIT);
            newMaterial.side = THREE.DoubleSide;
            
            // Swap materials
            groundMesh.material.dispose();
            groundMesh.material = newMaterial;
            
            console.log(`[Grid] Ground material updated to profile: ${shaderProfileManager.getCurrentProfileId()}`);
        }
    }
}

export default Grid;
