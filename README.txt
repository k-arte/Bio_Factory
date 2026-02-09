================================================================================
                         BIO-FACTORY PROJECT
                   Complete Codebase Documentation
================================================================================

This document contains the complete source code of the Bio-Factory project,
a Three.js-based biological simulation with factory logistics systems.

The project includes:
- RTS camera system with smooth controls
- 50x50 grid with shader-based visualization
- Particle atmosphere system
- Factory logistics: Resource Management, Transport System, Buildings
- Object pooling for memory efficiency
- Frame-rate independent updates using deltaTime

================================================================================
PROJECT STRUCTURE
================================================================================

Bio-Factory/
├── index.html                    (HTML entry point)
├── package.json                  (Dependencies)
├── vite.config.js               (Vite configuration)
├── src/
│   ├── main.js                  (Application entry)
│   ├── core/
│   │   ├── Engine.js            (Rendering engine & RTS camera)
│   │   └── Lighting.js          (Scene lighting)
│   ├── shaders/
│   │   └── BioShader.js         (Custom Three.js shader)
│   ├── world/
│   │   ├── Grid.js              (50x50 grid system)
│   │   └── ResourceManager.js   (Resource pooling & management)
│   └── entities/
│       ├── TransportSystem.js   (Bio-vessels & resource transit)
│       ├── BaseBuilding.js      (Buildings: Extractor & Storage)
│       └── PlacementManager.js  (Building placement & demo factory)

================================================================================
FILE CONTENTS
================================================================================

────────────────────────────────────────────────────────────────────────────
FILE: index.html
────────────────────────────────────────────────────────────────────────────

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BIO FACTORY</title>
    <style>
        body { margin: 0; }
        canvas { display: block; }
    </style>
</head>
<body>
    <script type="module" src="./src/main.js"></script>
</body>
</html>


────────────────────────────────────────────────────────────────────────────
FILE: package.json
────────────────────────────────────────────────────────────────────────────

{
  "name": "bio-factory",
  "version": "1.0.0",
  "description": "",
  "main": "main.js",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "dependencies": {
    "three": "^0.182.0"
  },
  "devDependencies": {
    "vite": "^7.3.1"
  }
}


────────────────────────────────────────────────────────────────────────────
FILE: vite.config.js
────────────────────────────────────────────────────────────────────────────

import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5173,
    strictPort: false,
    open: true,
    fs: {
      strict: false
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  ssr: {
    noExternal: ['three']
  }
})


────────────────────────────────────────────────────────────────────────────
FILE: src/main.js
────────────────────────────────────────────────────────────────────────────

import Engine from './core/Engine.js';
import Lighting from './core/Lighting.js';
import Grid from './world/Grid.js';

// Initialize engine
const engine = new Engine();

// Add lighting
new Lighting(engine.scene);

// Create grid and initialize camera controls
const grid = new Grid(engine.scene);
engine.initializeGridAndCamera(grid);

// Start animation loop
engine.start();


────────────────────────────────────────────────────────────────────────────
FILE: src/core/Engine.js
────────────────────────────────────────────────────────────────────────────

import * as THREE from 'three';
import BioShader from '../shaders/BioShader.js';
import ResourceManager from '../world/ResourceManager.js';
import TransportSystem from '../entities/TransportSystem.js';
import PlacementManager from '../entities/PlacementManager.js';

class RTSCamera {
    constructor(camera, domElement, gridBoundaries) {
        this.camera = camera;
        this.domElement = domElement;
        this.gridBoundaries = gridBoundaries;
        
        // Camera parameters
        this.zoomDistance = 20;
        this.minDistance = 2;  // Close zoom in
        this.maxDistance = 30; // Limit max zoom out
        this.height = 30; // Fixed height for top-down view
        
        // Pan target for camera focus
        this.panTarget = new THREE.Vector3(0, 0, 0);
        this.panDragVelocity = new THREE.Vector3(0, 0, 0); // Velocity from dragging
        
        // Input states
        this.keys = {};
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        
        // Damping for animations
        this.damping = 0.15; // WASD movement damping
        this.dragDamping = 0.15; // Drag movement damping (smooth easing)
        this.zoomDamping = 0.12; // Zoom smoothing
        this.targetZoomDistance = this.zoomDistance;
        this.velocity = new THREE.Vector3(0, 0, 0);
        
        this.setupControls();
    }

    setupControls() {
        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });
        
        // Mouse controls for panning with left-click drag
        this.domElement.addEventListener('mousedown', (e) => {
            if (e.button === 0) { // Left-click
                this.isDragging = true;
                this.dragStart.x = e.clientX;
                this.dragStart.y = e.clientY;
            }
        });
        
        this.domElement.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                const deltaX = e.clientX - this.dragStart.x;
                const deltaY = e.clientY - this.dragStart.y;
                
                // Accumulate drag velocity for smooth damping
                // Drag right (positive) = world moves right = camera sees left (negative)
                // Drag down (positive) = world moves down = camera sees up (negative)
                const panSensitivity = 0.25; // High sensitivity for responsive feel
                this.panDragVelocity.x = -deltaX * panSensitivity;
                this.panDragVelocity.z = -deltaY * panSensitivity;
                
                this.dragStart.x = e.clientX;
                this.dragStart.y = e.clientY;
            }
        });
        
        this.domElement.addEventListener('mouseup', (e) => {
            if (e.button === 0) {
                this.isDragging = false;
            }
        });
        
        // Zoom with mouse wheel (scroll up to zoom in, scroll down to zoom out) with smooth damping
        this.domElement.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.targetZoomDistance -= e.deltaY * 0.03; // Slower, more precise zoom
            this.targetZoomDistance = Math.max(this.minDistance, Math.min(this.maxDistance, this.targetZoomDistance));
        });

    }

    update() {
        // Store desired pan target (before constraints)
        let targetX = this.panTarget.x;
        let targetZ = this.panTarget.z;
        
        // === WASD/ARROW Movement with Smoothing ===
        const keyboardPanSpeed = 0.8;
        
        if (this.keys['w'] || this.keys['arrowup']) {
            this.velocity.z -= keyboardPanSpeed;
        }
        if (this.keys['s'] || this.keys['arrowdown']) {
            this.velocity.z += keyboardPanSpeed;
        }
        if (this.keys['a'] || this.keys['arrowleft']) {
            this.velocity.x -= keyboardPanSpeed;
        }
        if (this.keys['d'] || this.keys['arrowright']) {
            this.velocity.x += keyboardPanSpeed;
        }
        
        // Apply keyboard movement with damping for smooth feel
        targetX += this.velocity.x;
        targetZ += this.velocity.z;
        this.velocity.multiplyScalar(1 - this.damping);
        
        // === Mouse Drag Movement (Direct & Responsive) ===
        if (!this.isDragging) {
            // When not dragging, slowly damp drag velocity
            this.panDragVelocity.multiplyScalar(0.95);
        }
        
        targetX += this.panDragVelocity.x;
        targetZ += this.panDragVelocity.z;
        
        // === Boundary Constraints with Smooth Easing ===
        const buffer = this.zoomDistance * 0.8;
        const minX = this.gridBoundaries.minX + buffer;
        const maxX = this.gridBoundaries.maxX - buffer;
        const minZ = this.gridBoundaries.minZ + buffer;
        const maxZ = this.gridBoundaries.maxZ - buffer;
        
        // Soft constraint: slow down when approaching boundaries
        const edgeBuffer = 5;
        if (targetX < minX + edgeBuffer) {
            targetX = minX + (targetX - minX) * 0.3;
        }
        if (targetX > maxX - edgeBuffer) {
            targetX = maxX - (maxX - targetX) * 0.3;
        }
        if (targetZ < minZ + edgeBuffer) {
            targetZ = minZ + (targetZ - minZ) * 0.3;
        }
        if (targetZ > maxZ - edgeBuffer) {
            targetZ = maxZ - (maxZ - targetZ) * 0.3;
        }
        
        // Hard constraint: clamp to boundaries
        this.panTarget.x = Math.max(minX, Math.min(maxX, targetX));
        this.panTarget.z = Math.max(minZ, Math.min(maxZ, targetZ));
        
        // === Zoom with Smooth Damping ===
        this.zoomDistance += (this.targetZoomDistance - this.zoomDistance) * this.zoomDamping;
        
        // === Update Camera Position ===
        const viewAngle = 35 * Math.PI / 180;
        const cameraHeight = this.zoomDistance / Math.tan(viewAngle);
        
        this.camera.position.x = this.panTarget.x;
        this.camera.position.y = cameraHeight;
        this.camera.position.z = this.panTarget.z + this.zoomDistance;
        
        this.camera.lookAt(this.panTarget.x, 0, this.panTarget.z);
    }
}

class Engine {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        
        this.setupRenderer();
        this.setupScene();
        this.setupCamera();
        
        this.grid = null;
        this.rtsCamera = null;
        this.particles = null;
        this.gridCursor = null;
        this.bioShaderMaterial = null;
        
        // Factory systems
        this.resourceManager = null;
        this.transportSystem = null;
        this.placementManager = null;
        
        // Delta time tracking
        this.lastFrameTime = Date.now();
        this.deltaTime = 0;
        
        window.addEventListener('resize', this.onWindowResize.bind(this), false);
    }

    setupScene() {
        // Dark background for bio-factory aesthetic
        this.scene.background = new THREE.Color('#0a0a0a');
        this.scene.fog = new THREE.Fog('#0a0a0a', 80, 100);
        
        // Add central pulsing sphere (main cell)
        const geometry = new THREE.SphereGeometry(2, 32, 32);
        this.bioShaderMaterial = new BioShader(false);
        const sphere = new THREE.Mesh(geometry, this.bioShaderMaterial);
        sphere.position.set(0, 1, 0);
        this.scene.add(sphere);
        
        this.pulseSphere = sphere;
    }

    setupCamera() {
        this.camera.position.set(0, 30, 20);
        this.camera.lookAt(0, 0, 0);
    }

    setupRenderer() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        document.body.appendChild(this.renderer.domElement);
    }

    initializeGridAndCamera(grid) {
        this.grid = grid;
        const boundaries = grid.getBoundaries();
        this.rtsCamera = new RTSCamera(this.camera, this.renderer.domElement, boundaries);
        
        // Create particle system for atmosphere
        this.createParticleSystem();
        
        // Create grid cursor
        this.createGridCursor();
        
        // Enable mouse tracking for grid cursor
        this.setupMouseTracking();
        
        // Initialize factory systems
        this.initializeFactorySystems();
    }

    initializeFactorySystems() {
        // Create resource manager
        this.resourceManager = new ResourceManager(this.scene);

        // Create transport system
        this.transportSystem = new TransportSystem(this.grid, this.resourceManager);

        // Create placement manager
        this.placementManager = new PlacementManager(
            this.grid,
            this.scene,
            this.resourceManager,
            this.transportSystem
        );

        // Create demo factory layout
        this.placementManager.createDemoFactory();

        console.log('✓ Factory systems initialized');
        console.log(this.placementManager.getStats());
    }

    createParticleSystem() {
        const particleCount = 200;
        const positionArray = new Float32Array(particleCount * 3);
        
        for (let i = 0; i < particleCount * 3; i += 3) {
            positionArray[i] = (Math.random() - 0.5) * 50; // x
            positionArray[i + 1] = Math.random() * 20; // y
            positionArray[i + 2] = (Math.random() - 0.5) * 50; // z
        }
        
        const particleGeometry = new THREE.BufferGeometry();
        particleGeometry.setAttribute('position', new THREE.BufferAttribute(positionArray, 3));
        
        const particleMaterial = new THREE.PointsMaterial({
            color: 0x00ff88,
            size: 0.3,
            sizeAttenuation: true,
            transparent: true,
            opacity: 0.5
        });
        
        this.particles = new THREE.Points(particleGeometry, particleMaterial);
        this.scene.add(this.particles);
        this.particleVelocities = new Float32Array(particleCount * 3);
        
        // Random velocities
        for (let i = 0; i < particleCount * 3; i += 3) {
            this.particleVelocities[i] = (Math.random() - 0.5) * 0.1; // vx
            this.particleVelocities[i + 1] = (Math.random() - 0.5) * 0.05; // vy
            this.particleVelocities[i + 2] = (Math.random() - 0.5) * 0.1; // vz
        }
    }

    createGridCursor() {
        // Grid cursor - a highlighted square that snaps to grid cells
        const cursorGeometry = new THREE.BufferGeometry();
        // Grid cell size is 1.0, cursor from -0.5 to 0.5 for perfect alignment
        const cursorSize = 0.5;
        
        const vertices = new Float32Array([
            -cursorSize, 0.02, -cursorSize,
            cursorSize, 0.02, -cursorSize,
            cursorSize, 0.02, cursorSize,
            -cursorSize, 0.02, cursorSize,
            -cursorSize, 0.02, -cursorSize
        ]);
        
        cursorGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        
        const cursorMaterial = new THREE.LineBasicMaterial({
            color: 0x00ff88,
            linewidth: 3,
            transparent: true,
            opacity: 0.9
        });
        
        this.gridCursor = new THREE.Line(cursorGeometry, cursorMaterial);
        this.gridCursor.name = 'GridCursor';
        this.scene.add(this.gridCursor);
    }

    setupMouseTracking() {
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        let lockedGridCell = null; // Lock cursor to grid cell during drag
        
        const onMouseMove = (event) => {
            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
            
            raycaster.setFromCamera(mouse, this.camera);
            
            // Create a plane at y=0 to intersect with
            const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            const intersection = new THREE.Vector3();
            raycaster.ray.intersectPlane(plane, intersection);
            
            if (this.grid && this.gridCursor) {
                // If dragging, use locked cell; otherwise update from mouse position
                let gridCell;
                if (this.isDragging && lockedGridCell) {
                    gridCell = lockedGridCell;
                } else {
                    gridCell = this.grid.getGridCell(intersection);
                }
                
                const cursorPos = this.grid.getWorldPosition(gridCell.x, gridCell.z);
                this.gridCursor.position.copy(cursorPos);
                
                // Store current cursor position for click detection
                this.lastCursorPos = { x: gridCell.x, z: gridCell.z };
            }
        };
        
        const onMouseDown = (event) => {
            if (event.button === 0) { // Left-click
                // Lock cursor to current grid cell when dragging starts
                if (this.lastCursorPos) {
                    lockedGridCell = { x: this.lastCursorPos.x, z: this.lastCursorPos.z };
                }
            }
        };
        
        const onMouseUp = (event) => {
            if (event.button === 0) {
                // Unlock cursor after drag ends
                lockedGridCell = null;
            }
        };
        
        const onClick = () => {
            if (this.lastCursorPos) {
                console.log(`Grid Cell Selected: [${this.lastCursorPos.x}, ${this.lastCursorPos.z}]`);
            }
        };
        
        this.renderer.domElement.addEventListener('mousemove', onMouseMove);
        this.renderer.domElement.addEventListener('mousedown', onMouseDown);
        this.renderer.domElement.addEventListener('mouseup', onMouseUp);
        this.renderer.domElement.addEventListener('click', onClick);
    }

    updateParticles() {
        if (!this.particles) return;
        
        const positions = this.particles.geometry.attributes.position.array;
        
        for (let i = 0; i < positions.length; i += 3) {
            positions[i] += this.particleVelocities[i];
            positions[i + 1] += this.particleVelocities[i + 1];
            positions[i + 2] += this.particleVelocities[i + 2];
            
            // Wrap around boundaries
            if (positions[i] > 30) positions[i] = -30;
            if (positions[i] < -30) positions[i] = 30;
            if (positions[i + 1] > 25) {
                positions[i + 1] = 0;
                this.particleVelocities[i + 1] = (Math.random() - 0.5) * 0.05;
            }
            if (positions[i + 1] < 0) {
                positions[i + 1] = 25;
                this.particleVelocities[i + 1] = (Math.random() - 0.5) * 0.05;
            }
            if (positions[i + 2] > 30) positions[i + 2] = -30;
            if (positions[i + 2] < -30) positions[i + 2] = 30;
        }
        
        this.particles.geometry.attributes.position.needsUpdate = true;
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    start() {
        this.animate();
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        
        const time = Date.now() * 0.001;
        
        // Calculate deltaTime for frame-rate independent updates
        const currentTime = Date.now();
        this.deltaTime = this.lastFrameTime ? (currentTime - this.lastFrameTime) / 1000 : 0;
        this.lastFrameTime = currentTime;
        
        // Update RTS camera
        if (this.rtsCamera) {
            this.rtsCamera.update();
        }
        
        // Update BioShader time
        if (this.bioShaderMaterial) {
            this.bioShaderMaterial.updateTime(time);
        }
        
        // Update grid shader
        if (this.grid) {
            this.grid.updateShaderTime(time);
        }
        
        // Update particles
        this.updateParticles();
        
        // Update factory systems
        if (this.transportSystem) {
            this.transportSystem.update(this.deltaTime);
        }
        if (this.placementManager) {
            this.placementManager.update(this.deltaTime);
        }
        if (this.resourceManager) {
            this.resourceManager.updateAll(time);
        }
        
        // Pulsing effect for central sphere (legacy, kept for reference)
        if (this.pulseSphere) {
            this.pulseSphere.scale.x = 1 + Math.sin(time) * 0.1;
            this.pulseSphere.scale.y = 1 + Math.sin(time) * 0.1;
            this.pulseSphere.scale.z = 1 + Math.sin(time) * 0.1;
        }
        
        // Render the scene
        this.renderer.render(this.scene, this.camera);
    }
}

export default Engine;


────────────────────────────────────────────────────────────────────────────
FILE: src/core/Lighting.js
────────────────────────────────────────────────────────────────────────────

import * as THREE from 'three';

class Lighting {
    constructor(scene) {
        this.scene = scene;
        this.setupLights();
    }

    setupLights() {
        // Add ambient light
        const ambientLight = new THREE.AmbientLight(0x404040, 2);
        this.scene.add(ambientLight);

        // Add directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(5, 10, 7.5);
        this.scene.add(directionalLight);
    }
}

export default Lighting;


────────────────────────────────────────────────────────────────────────────
FILE: src/shaders/BioShader.js
────────────────────────────────────────────────────────────────────────────

import * as THREE from 'three';

const vertexShader = `
varying vec3 vNormal;
varying vec3 vPosition;
uniform float uTime;

void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    
    // Breathing effect with time
    vec3 breathedPosition = position * (0.95 + 0.05 * sin(uTime * 2.0));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(breathedPosition, 1.0);
}
`;

const fragmentShader = `
uniform vec3 baseColor;
uniform float uTime;
varying vec3 vNormal;
varying vec3 vPosition;

vec3 toonShading(vec3 color, float intensity) {
    if (intensity > 0.95) return color;
    else if (intensity > 0.7) return color * 0.8;
    else if (intensity > 0.4) return color * 0.6;
    else return color * 0.3;
}

void main() {
    vec3 normal = normalize(vNormal);
    float intensity = dot(normal, vec3(0.0, 1.0, 0.0));
    vec3 toonColor = toonShading(baseColor, intensity);

    // Rim lighting with pulse
    float rim = 1.0 - max(dot(normal, vec3(0.0, 0.0, -1.0)), 0.0);
    rim = smoothstep(0.5, 1.0, rim);
    float pulseIntensity = 0.3 + 0.2 * sin(uTime * 3.0);
    toonColor += rim * pulseIntensity;

    // Glow effect synchronized with time
    float glow = 0.1 * sin(uTime * 2.5 + length(vPosition));
    toonColor += vec3(glow * 0.2, glow * 0.3, glow * 0.4);

    gl_FragColor = vec4(toonColor, 1.0);
}
`;

class BioShader extends THREE.ShaderMaterial {
    constructor(isGrid = false) {
        super({
            uniforms: {
                baseColor: { value: isGrid ? new THREE.Color(0x00ff88) : new THREE.Color(0x2a0505) },
                uTime: { value: 0 }
            },
            vertexShader,
            fragmentShader,
            transparent: isGrid,
            opacity: isGrid ? 0.6 : 1.0
        });
    }

    updateTime(time) {
        this.uniforms.uTime.value = time;
    }
}

export default BioShader;


────────────────────────────────────────────────────────────────────────────
FILE: src/world/Grid.js
────────────────────────────────────────────────────────────────────────────

import * as THREE from 'three';
import BioShader from '../shaders/BioShader.js';

class Grid {
    constructor(scene) {
        this.scene = scene;
        this.gridSize = 50; // 50x50 grid
        this.cellSize = 1;
        this.gridGroup = new THREE.Group();
        this.createSquareGrid();
        this.scene.add(this.gridGroup);
    }

    createSquareGrid() {
        const totalSize = this.gridSize * this.cellSize;
        const halfSize = totalSize / 2;
        
        // Create grid lines using LineSegments
        const points = [];
        
        // Vertical lines
        for (let i = 0; i <= this.gridSize; i++) {
            const x = -halfSize + (i * this.cellSize);
            points.push(new THREE.Vector3(x, 0, -halfSize));
            points.push(new THREE.Vector3(x, 0, halfSize));
        }
        
        // Horizontal lines
        for (let i = 0; i <= this.gridSize; i++) {
            const z = -halfSize + (i * this.cellSize);
            points.push(new THREE.Vector3(-halfSize, 0, z));
            points.push(new THREE.Vector3(halfSize, 0, z));
        }
        
        // Create geometry and line segments
        const geometry = new THREE.BufferGeometry();
        geometry.setFromPoints(points);
        
        // Apply BioShader to grid lines
        const material = new BioShader(true); // true indicates this is for grid
        const gridLines = new THREE.LineSegments(geometry, material);
        gridLines.name = 'gridLines';
        
        this.gridGroup.add(gridLines);
        this.gridMaterial = material;
        this.gridLines = gridLines;
    }

    updateShaderTime(time) {
        if (this.gridMaterial) {
            this.gridMaterial.updateTime(time);
        }
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
}

export default Grid;


────────────────────────────────────────────────────────────────────────────
FILE: src/world/ResourceManager.js
────────────────────────────────────────────────────────────────────────────

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
                baseColor = new THREE.Color(0x0099ff); // Blue
                break;
            case 'PROTEIN':
                geometry = new THREE.TetrahedronGeometry(0.35);
                baseColor = new THREE.Color(0xffff00); // Yellow
                break;
            case 'GLUCOSE':
                geometry = new THREE.BoxGeometry(0.35, 0.35, 0.35);
                baseColor = new THREE.Color(0x00ff00); // Green
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


────────────────────────────────────────────────────────────────────────────
FILE: src/entities/TransportSystem.js
────────────────────────────────────────────────────────────────────────────

import * as THREE from 'three';

class BioVessel {
    constructor(gridX, gridZ, direction, grid, resourceManager) {
        this.gridX = gridX;
        this.gridZ = gridZ;
        this.direction = direction; // 'N', 'S', 'E', 'W'
        this.grid = grid;
        this.resourceManager = resourceManager;
        
        this.mesh = this.createMesh();
        this.connectedVessels = [];
        this.currentResource = null;
        
        // Position mesh at grid cell center
        const worldPos = grid.getWorldPosition(gridX, gridZ);
        this.mesh.position.copy(worldPos);
    }

    createMesh() {
        // Create a cylinder pointing in direction
        const geometry = new THREE.CylinderGeometry(0.15, 0.15, 0.8, 8);
        const material = new THREE.MeshStandardMaterial({
            color: 0x00aa00,
            emissive: 0x00ff00,
            metalness: 0.3,
            roughness: 0.4
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.z = Math.PI / 2;

        // Rotate based on direction
        switch(this.direction) {
            case 'N': mesh.rotation.x = 0; break;
            case 'S': mesh.rotation.x = Math.PI; break;
            case 'E': mesh.rotation.z = Math.PI / 2; break;
            case 'W': mesh.rotation.z = -Math.PI / 2; break;
        }

        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.vessel = this;

        return mesh;
    }

    /**
     * Get next grid cell in direction of this vessel
     */
    getNextCell() {
        const directions = {
            'N': { x: 0, z: -1 },
            'S': { x: 0, z: 1 },
            'E': { x: 1, z: 0 },
            'W': { x: -1, z: 0 }
        };

        const delta = directions[this.direction];
        return { x: this.gridX + delta.x, z: this.gridZ + delta.z };
    }

    /**
     * Check if this vessel connects to another adjacent vessel
     */
    linkWith(otherVessel) {
        const nextCell = this.getNextCell();
        
        // Check if other vessel is in the direction this one faces
        if (nextCell.x === otherVessel.gridX && nextCell.z === otherVessel.gridZ) {
            // Also check if other vessel faces back this way (optional: allow one-way)
            this.connectedVessels.push(otherVessel);
            return true;
        }
        return false;
    }

    /**
     * Transfer resource to next vessel
     */
    pushResource(resource, deltaTime) {
        if (!resource) return;

        // Move resource along vessel
        const speed = 10; // units per second
        const movement = speed * deltaTime;
        
        let worldPos = this.grid.getWorldPosition(this.gridX, this.gridZ);
        resource.mesh.position.lerp(worldPos, Math.min(1, movement * 0.1));

        // Check if resource reached end of vessel
        const distance = resource.mesh.position.distanceTo(worldPos);
        if (distance < 0.2) {
            // Ready to transfer to next vessel
            return true;
        }
        return false;
    }

    reset() {
        if (this.currentResource) {
            this.resourceManager.releaseResource(this.currentResource);
            this.currentResource = null;
        }
    }
}

class TransportSystem {
    constructor(grid, resourceManager) {
        this.grid = grid;
        this.resourceManager = resourceManager;
        this.vessels = new Map(); // gridX_gridZ -> BioVessel
        this.activeResources = []; // Resources in transit
    }

    /**
     * Create and register a bio-vessel
     */
    placeVessel(gridX, gridZ, direction, scene) {
        const key = `${gridX}_${gridZ}`;
        
        if (this.vessels.has(key)) {
            console.warn(`Vessel already exists at ${key}`);
            return null;
        }

        const vessel = new BioVessel(gridX, gridZ, direction, this.grid, this.resourceManager);
        this.vessels.set(key, vessel);
        scene.add(vessel.mesh);

        // Auto-link with adjacent vessels
        this.linkVessels();

        return vessel;
    }

    /**
     * Link all adjacent vessels that face each other
     */
    linkVessels() {
        const vesselArray = Array.from(this.vessels.values());
        
        vesselArray.forEach(vessel => {
            vessel.connectedVessels = [];
            
            vesselArray.forEach(other => {
                if (vessel !== other) {
                    vessel.linkWith(other);
                }
            });
        });
    }

    /**
     * Add resource to vessel (starts transport)
     */
    pushResourceToVessel(gridX, gridZ, resource) {
        const key = `${gridX}_${gridZ}`;
        const vessel = this.vessels.get(key);

        if (!vessel) {
            console.warn(`No vessel at ${key}`);
            return false;
        }

        if (vessel.currentResource) {
            return false; // Vessel occupied
        }

        vessel.currentResource = resource;
        this.activeResources.push({
            resource,
            currentVessel: vessel,
            progress: 0
        });

        return true;
    }

    /**
     * Update all resources in transit
     */
    update(deltaTime) {
        const toRemove = [];

        this.activeResources.forEach((transport, index) => {
            const { resource, currentVessel } = transport;

            // Move resource through vessel
            const readyToTransfer = currentVessel.pushResource(resource, deltaTime);

            if (readyToTransfer && currentVessel.connectedVessels.length > 0) {
                // Transfer to next vessel
                const nextVessel = currentVessel.connectedVessels[0];
                nextVessel.currentResource = resource;
                transport.currentVessel = nextVessel;
            } else if (readyToTransfer && currentVessel.connectedVessels.length === 0) {
                // Dead end - remove resource
                toRemove.push(index);
                this.resourceManager.releaseResource(resource);
            }
        });

        // Remove completed transports (in reverse order)
        for (let i = toRemove.length - 1; i >= 0; i--) {
            this.activeResources.splice(toRemove[i], 1);
        }
    }

    getVesselCount() {
        return this.vessels.size;
    }

    getResourceCountInTransit() {
        return this.activeResources.length;
    }

    clear() {
        this.vessels.forEach(v => v.reset());
        this.vessels.clear();
        this.activeResources = [];
    }
}

export default TransportSystem;
export { BioVessel };


────────────────────────────────────────────────────────────────────────────
FILE: src/entities/BaseBuilding.js
────────────────────────────────────────────────────────────────────────────

import * as THREE from 'three';

class BaseBuilding {
    constructor(gridX, gridZ, grid, scene) {
        this.gridX = gridX;
        this.gridZ = gridZ;
        this.grid = grid;
        this.scene = scene;
        this.mesh = null;
        this.isActive = true;

        const worldPos = grid.getWorldPosition(gridX, gridZ);
        this.position = worldPos.clone();
    }

    createMesh(geometry, color) {
        const material = new THREE.MeshStandardMaterial({
            color,
            emissive: color,
            emissiveIntensity: 0.3,
            metalness: 0.5,
            roughness: 0.3
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(this.position);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.building = this;

        return mesh;
    }

    update(deltaTime) {
        // Override in subclasses
    }

    destroy() {
        if (this.mesh && this.scene) {
            this.scene.remove(this.mesh);
        }
        this.isActive = false;
    }
}

class Extractor extends BaseBuilding {
    constructor(gridX, gridZ, grid, scene, resourceManager, transportSystem, resourceType = 'ION') {
        super(gridX, gridZ, grid, scene);
        
        this.resourceManager = resourceManager;
        this.transportSystem = transportSystem;
        this.resourceType = resourceType;
        
        // Generate resource every 2 seconds
        this.generationRate = 2.0;
        this.timeSinceLastGeneration = 0;
        this.generatedCount = 0;

        // Create mesh (pyramid)
        const geometry = new THREE.ConeGeometry(0.4, 0.8, 4);
        this.mesh = this.createMesh(geometry, 0xff0000);
        this.scene.add(this.mesh);
    }

    /**
     * Generate and push resource to adjacent vessel
     */
    generateResource() {
        const worldPos = this.grid.getWorldPosition(this.gridX, this.gridZ);
        const resource = this.resourceManager.getResource(
            this.resourceType,
            this.gridX,
            this.gridZ,
            worldPos.clone()
        );

        if (resource) {
            // Try to push to adjacent vessel
            const success = this.transportSystem.pushResourceToVessel(this.gridX, this.gridZ, resource);
            if (success) {
                this.generatedCount++;
            } else {
                this.resourceManager.releaseResource(resource);
            }
        }
    }

    update(deltaTime) {
        this.timeSinceLastGeneration += deltaTime;

        if (this.timeSinceLastGeneration >= this.generationRate) {
            this.generateResource();
            this.timeSinceLastGeneration = 0;
        }
    }
}

class Storage extends BaseBuilding {
    constructor(gridX, gridZ, grid, scene, resourceManager) {
        super(gridX, gridZ, grid, scene);
        
        this.resourceManager = resourceManager;
        this.inventory = {
            ION: 0,
            PROTEIN: 0,
            GLUCOSE: 0
        };
        this.totalStored = 0;

        // Create mesh (cube)
        const geometry = new THREE.BoxGeometry(0.6, 0.6, 0.6);
        this.mesh = this.createMesh(geometry, 0x0000ff);
        this.scene.add(this.mesh);
    }

    /**
     * Store a resource item
     */
    storeResource(resource) {
        if (!resource || !this.inventory.hasOwnProperty(resource.type)) {
            return false;
        }

        this.inventory[resource.type]++;
        this.totalStored++;
        this.resourceManager.releaseResource(resource);

        return true;
    }

    /**
     * Get inventory count for a resource type
     */
    getCount(type) {
        return this.inventory[type] || 0;
    }

    /**
     * Get total stored
     */
    getTotalCount() {
        return this.totalStored;
    }

    update(deltaTime) {
        // Pulse based on stored items
        const scale = 1 + (this.totalStored * 0.05);
        this.mesh.scale.set(scale, scale, scale);
    }
}

export default BaseBuilding;
export { Extractor, Storage };


────────────────────────────────────────────────────────────────────────────
FILE: src/entities/PlacementManager.js
────────────────────────────────────────────────────────────────────────────

import { Extractor, Storage } from './BaseBuilding.js';

class PlacementManager {
    constructor(grid, scene, resourceManager, transportSystem) {
        this.grid = grid;
        this.scene = scene;
        this.resourceManager = resourceManager;
        this.transportSystem = transportSystem;
        
        this.buildings = new Map();
        this.buildingTypes = {
            EXTRACTOR: 'EXTRACTOR',
            STORAGE: 'STORAGE',
            VESSEL: 'VESSEL'
        };
    }

    /**
     * Place an Extractor building
     */
    placeExtractor(gridX, gridZ, resourceType = 'ION') {
        const key = `${gridX}_${gridZ}`;
        
        if (this.buildings.has(key)) {
            console.warn(`Building already exists at ${key}`);
            return null;
        }

        const extractor = new Extractor(
            gridX, gridZ,
            this.grid,
            this.scene,
            this.resourceManager,
            this.transportSystem,
            resourceType
        );

        this.buildings.set(key, {
            type: this.buildingTypes.EXTRACTOR,
            building: extractor
        });

        return extractor;
    }

    /**
     * Place a Storage building
     */
    placeStorage(gridX, gridZ) {
        const key = `${gridX}_${gridZ}`;
        
        if (this.buildings.has(key)) {
            console.warn(`Building already exists at ${key}`);
            return null;
        }

        const storage = new Storage(gridX, gridZ, this.grid, this.scene, this.resourceManager);

        this.buildings.set(key, {
            type: this.buildingTypes.STORAGE,
            building: storage
        });

        return storage;
    }

    /**
     * Place a Bio-Vessel (conveyor belt)
     */
    placeVessel(gridX, gridZ, direction) {
        const vessel = this.transportSystem.placeVessel(gridX, gridZ, direction, this.scene);
        
        if (vessel) {
            const key = `${gridX}_${gridZ}`;
            this.buildings.set(key, {
                type: this.buildingTypes.VESSEL,
                building: vessel
            });
        }

        return vessel;
    }

    /**
     * Create a demo factory: Extractor → Vessels → Storage
     */
    createDemoFactory() {
        // Extractor at [0, 0]
        const extractor = this.placeExtractor(0, 0, 'ION');

        // L-shaped vessel path: East then South
        // [1, 0] -> [1, 1]
        this.placeVessel(1, 0, 'E');  // Face East
        this.placeVessel(2, 0, 'E');  // Face East
        this.placeVessel(3, 0, 'S');  // Face South
        this.placeVessel(3, 1, 'S');  // Face South

        // Storage at end
        const storage = this.placeStorage(3, 2);

        console.log('✓ Demo factory created:');
        console.log('  Extractor at [0,0] → Vessels → Storage at [3,2]');
        console.log(`  Total buildings: ${this.buildings.size}`);
    }

    /**
     * Get building at grid position
     */
    getBuildingAt(gridX, gridZ) {
        const key = `${gridX}_${gridZ}`;
        return this.buildings.get(key)?.building || null;
    }

    /**
     * Remove building at grid position
     */
    removeBuilding(gridX, gridZ) {
        const key = `${gridX}_${gridZ}`;
        const entry = this.buildings.get(key);

        if (entry) {
            entry.building.destroy();
            this.buildings.delete(key);
            return true;
        }

        return false;
    }

    /**
     * Get stats
     */
    getStats() {
        let extractors = 0, storages = 0, vessels = 0;
        
        this.buildings.forEach(({ type }) => {
            if (type === this.buildingTypes.EXTRACTOR) extractors++;
            if (type === this.buildingTypes.STORAGE) storages++;
            if (type === this.buildingTypes.VESSEL) vessels++;
        });

        return { extractors, storages, vessels, total: this.buildings.size };
    }

    /**
     * Update all buildings
     */
    update(deltaTime) {
        this.buildings.forEach(({ building }) => {
            if (building.update) {
                building.update(deltaTime);
            }
        });
    }

    clear() {
        this.buildings.forEach(({ building }) => building.destroy());
        this.buildings.clear();
    }
}

export default PlacementManager;


================================================================================
BUILDING & RUNNING
================================================================================

1. Install dependencies:
   npm install

2. Start development server:
   npm run dev

3. Build for production:
   npm run build

The dev server runs on http://localhost:5173 by default.


================================================================================
FEATURES
================================================================================

RTS CAMERA:
- Fixed top-down 35° angle
- WASD / Arrow Keys: Pan the view
- Mouse Drag: Drag to pan with inertia
- Mouse Wheel: Zoom in/out with smooth damping
- Grid boundaries: Camera constrained with soft easing

FACTORY SYSTEM:
- ResourceManager: Object pooling for 3 resource types (ION, PROTEIN, GLUCOSE)
- Extractors: Red pyramids that generate resources every 2 seconds
- Bio-Vessels: Green cylinders that transport resources
- Storage: Blue cubes that collect and store resources
- Demo Factory: Auto-generated with extractor → vessels → storage path

SHADER EFFECTS:
- Time-based breathing animations
- Rim lighting with pulsing glow
- Position-based color variations
- Toon shading on all objects


================================================================================
CODE ARCHITECTURE
================================================================================

CLASS HIERARCHY:

RTSCamera
├── Handles camera position and rotation
├── Processes input (WASD, mouse drag, scroll)
└── Applies boundary constraints with easing

Engine
├── Manages Three.js scene, camera, renderer
├── Controls particle system and grid cursor
├── Coordinates factory systems in animate loop
└── Inherits RTSCamera behavior

Grid
├── Creates 50x50 vertex-aligned grid
├── Converts between world and grid coordinates
└── Updates shader time for visual effects

ResourceManager
├── Maintains object pools for resources
├── Creates resource meshes (spheres, pyramids, cubes)
└── Tracks active resources for memory efficiency

BioVessel
├── Represents directional conveyor tile (N/S/E/W)
├── Links with adjacent vessels
└── Moves resources through its tile

TransportSystem
├── Manages bio-vessels and vessel linking
├── Handles resource transit logic
└── Updates resource positions each frame

BaseBuilding (Abstract)
├── Extractor (Red Cone)
│   ├── Generates resources every 2 seconds
│   └── Pushes to adjacent vessel
│
└── Storage (Blue Cube)
    ├── Collects resources
    ├── Tracks inventory by type
    └── Pulses based on stored count

PlacementManager
├── High-level building placement API
├── Creates demo factory layout
├── Updates all buildings each frame
└── Provides building statistics


================================================================================
PERFORMANCE NOTES
================================================================================

- Object Pooling: Resources reuse meshes instead of allocating new ones
- Frame-rate Independence: All movement uses deltaTime
- Grid Optimization: Uses LineSegments for efficient rendering
- Resource Limits: Max 100 resources per type (poolSize)
- Boundary Constraints: Soft easing prevents jarring stops


================================================================================
