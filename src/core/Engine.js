import * as THREE from 'three';
import BioShader from '../shaders/BioShader.js';
import ResourceManager from '../systems/ResourceManager.js';
import ResourceTransport from '../systems/ResourceTransport.js';
import TransportSystem from '../entities/TransportSystem.js';
import PlacementManager from '../entities/PlacementManager.js';
import VesselSystemV2 from '../entities/VesselSystemV2.js';
import InputManagerV2 from './InputManagerV2.js';
import HUD from '../ui/HUD_NEW.js';
import AssetManager from './AssetManager.js';
import MapGenerator from '../world/MapGenerator.js';
import DemoFactory from '../scenarios/DemoFactory.js';
import { COLORS } from '../data/Colors.js';
import '../ui/HUD_NEW.css';

class RTSCamera {
    constructor(camera, domElement, gridBoundaries, inputManager) {
        this.camera = camera;
        this.domElement = domElement;
        this.gridBoundaries = gridBoundaries;
        this.inputManager = inputManager;

        // Zoom settings
        this.minZoom = 5;
        this.maxZoom = 60;
        this.zoomSpeed = 0.05;
        this.currentZoom = 30;
        this.targetZoom = 30;

        // Camera position (X, Z)
        this.targetPan = new THREE.Vector3(0, 0, 0);
        this.currentPan = new THREE.Vector3(0, 0, 0);

        // Smoothing
        this.damping = 0.15;

        // Drag state
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;

        // FIXED RIGID ANGLE
        this.camera.rotation.order = 'YXZ';
        this.camera.rotation.x = -Math.PI / 2;
        this.camera.rotation.y = 0;
        this.camera.rotation.z = 0;

        this.setupControls();
    }

    setupControls() {
        // DRAG (Map panning) - Middle mouse button ONLY
        this.domElement.addEventListener('mousedown', (e) => {
            if (e.button === 1) { // Middle mouse only
                this.isDragging = true;
                this.lastMouseX = e.clientX;
                this.lastMouseY = e.clientY;
                this.domElement.style.cursor = 'grabbing';
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;

            const deltaX = e.clientX - this.lastMouseX;
            const deltaY = e.clientY - this.lastMouseY;

            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;

            const panFactor = this.currentZoom * 0.0025;
            this.targetPan.x -= deltaX * panFactor;
            this.targetPan.z -= deltaY * panFactor;

            this.clampTarget();
        });

        window.addEventListener('mouseup', () => {
            this.isDragging = false;
            this.domElement.style.cursor = 'default';
        });

        // ZOOM (Mouse wheel)
        this.domElement.addEventListener('wheel', (e) => {
            // Don't process zoom if UI is open
            if (this.inputManager && this.inputManager.isUIOpen) return;
            
            e.preventDefault();
            this.targetZoom += e.deltaY * 0.02;
            this.targetZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.targetZoom));
        }, { passive: false });

        // Allow right-click for context menu (don't block it)
        // Right-click will be handled by setupMouseTracking for properties window
    }

    clampTarget() {
        const buffer = 0;
        this.targetPan.x = Math.max(this.gridBoundaries.minX, Math.min(this.gridBoundaries.maxX, this.targetPan.x));
        this.targetPan.z = Math.max(this.gridBoundaries.minZ, Math.min(this.gridBoundaries.maxZ, this.targetPan.z));
    }

    update() {
        // Don't process keyboard input if UI is open
        if (this.inputManager && !this.inputManager.isUIOpen) {
            // Would add keyboard controls here if needed
        }

        // Smooth interpolation for pan (X/Z)
        this.currentPan.x += (this.targetPan.x - this.currentPan.x) * 0.2;
        this.currentPan.z += (this.targetPan.z - this.currentPan.z) * 0.2;
        
        // Smooth interpolation for zoom (Y)
        this.currentZoom += (this.targetZoom - this.currentZoom) * 0.1;

        // Apply coordinates
        this.camera.position.set(this.currentPan.x, this.currentZoom, this.currentPan.z);
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
        this.selectionOverlayGroup = null; // Selection visualization group
        this.bioShaderMaterial = null;
        this.edgeFogRing = null;  // Radial edge fog ring (A2)
        this.animatedMaterials = [];  // Track all BioShader materials for time updates
        
        // Asset management system
        this.assetManager = new AssetManager();
        
        // Input & UI systems
        this.hud = null; // Initialized after grid setup
        this.inputManager = null; // Initialized after grid and HUD setup
        this.uiManager = null; // Initialized after grid setup
        
        // Factory systems
        this.resourceManager = null;
        this.resourceTransport = null;  // Resource packet transport system
        this.transportSystem = null;
        this.placementManager = null;
        this.vesselSystem = null; // Vessel/pipe management
        this.demoFactory = null; // Demo scenario builder (initialized after placement manager setup)
        
        // Delta time tracking
        this.lastFrameTime = Date.now();
        this.deltaTime = 0;
        
        // Biomarker update counter (update every 500ms)
        this.biomarkerUpdateCounter = 0;
        
        window.addEventListener('resize', this.onWindowResize.bind(this), false);
    }

    setupScene() {
        console.log('[Engine] Setting up scene...');
        
        // Background color - slightly warmer for better mood
        this.scene.background = new THREE.Color(0x0a1722);
        this.scene.fog = new THREE.FogExp2(0x0a1722, 0.015);  // Exponential fog for depth (A1)
        
        // 1) Soft ambient fill with hemisphere light (warm top, dark red bottom reflection)
        const hemi = new THREE.HemisphereLight(0xffead6, 0x1a0b0b, 0.55);
        this.scene.add(hemi);
        console.log('[Engine] Hemisphere light added (warm fill, 0.55 intensity)');
        
        // 2) Main key light - warm directional light that defines form
        const keyLight = new THREE.DirectionalLight(0xffe0c0, 0.75);
        keyLight.position.set(1, 2, 1).normalize().multiplyScalar(60);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.set(1024, 1024);
        keyLight.shadow.radius = 2.5;  // Soft PCF shadows
        keyLight.shadow.bias = -0.0003;
        this.scene.add(keyLight);
        console.log('[Engine] Key light added (warm, soft shadows, 0.75 intensity)');
        
        // 3) Rim light - cool backlight to define edges and contours
        const rimLight = new THREE.DirectionalLight(0xcfe6ff, 0.22);
        rimLight.position.set(-1, 1.2, -1).normalize().multiplyScalar(50);
        rimLight.castShadow = false;
        this.scene.add(rimLight);
        console.log('[Engine] Rim light added (cool, 0.22 intensity)');
        
        console.log('[Engine] Scene setup complete (optimized 3-light setup)');
    }


    setupCamera() {
        this.camera.position.set(0, 30, 20);
        this.camera.lookAt(0, 0, 0);
    }

    setupRenderer() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;  // Soft shadow edges
        this.renderer.shadowMap.autoUpdate = true;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.05;  // Reduced from 1.2 - less highlight clipping
        this.renderer.physicallyCorrectLights = true;  // Consistent light intensity
        this.renderer.dithering = true;  // Smooth banding on toon steps
        
        // Performance optimizations
        this.renderer.sortObjects = false;
        this.renderer.precision = 'mediump';
        
        document.body.appendChild(this.renderer.domElement);
        console.log('[Engine] Renderer setup complete (PCFSoft shadows, ACES 1.05, dithering enabled)');
    }

    initializeGridAndCamera(grid) {
        try {
            console.log('[Engine] Grid initialization starting...');
            this.grid = grid;
            const boundaries = grid.getBoundaries();
            
            console.log('[Engine] Grid boundaries:', boundaries);
            console.log('[Engine] Scene children before grid:', this.scene.children.length);
            
            // Create HUD first (includes Inventory and Hotbar)
            try {
                this.hud = new HUD(null);
                this.hud.setEngine(this);  // Wire engine to HUD for selection actions
                console.log('[Engine] HUD created and wired to engine');
            } catch (e) {
                console.error('[Engine] ERROR creating HUD:', e);
            }
            
            // Initialize vessel system
            try {
                this.vesselSystem = new VesselSystemV2(this.scene, this.grid, null);
                console.log('[Engine] VesselSystem created');
            } catch (e) {
                console.error('[Engine] ERROR creating VesselSystem:', e);
            }
            
            // Initialize InputManager with grid, HUD, VesselSystem, and inventory
            try {
                this.inputManager = new InputManagerV2(this.camera, this.renderer, this.scene, this.grid, this.hud, this.vesselSystem);
                this.hud.inputManager = this.inputManager;
                
                // Wire Hotbar and Inventory to InputManager
                this.inputManager.setHotbarAndInventory(this.hud.hotbar, this.hud.inventory);
                
                // Wire InputManager to VesselSystem for drag detection
                this.vesselSystem.inputManager = this.inputManager;
                console.log('[Engine] InputManager setup complete');
            } catch (e) {
                console.error('[Engine] ERROR creating InputManager:', e);
            }
            
            // Initialize RTS camera with input manager awareness
            try {
                this.rtsCamera = new RTSCamera(this.camera, this.renderer.domElement, boundaries, this.inputManager);
                console.log('[Engine] RTSCamera created');
            } catch (e) {
                console.error('[Engine] ERROR creating RTSCamera:', e);
            }
            
            // Initialize UI manager after camera is ready
            // NOTE: UIManager is deprecated - HUD_NEW now handles all UI
            // try {
            //     this.uiManager = new UIManager(this.camera, this.renderer, this.inputManager);
            //     console.log('[Engine] UIManager created');
            //     
            //     // Wire building click events to UI display
            //     this.inputManager.on('buildingClicked', (building) => {
            //         this.uiManager.showBuildingPanel(building);
            //     });
            //
            //     // Wire building placement events
            //     this.inputManager.on('buildingPlaced', (buildingData) => {
            //         console.log('[Engine] Building placed:', buildingData);
            //     });
            //
            //     // Wire vessel placement events
            //     this.inputManager.on('vesselPlaced', (vesselData) => {
            //         console.log('[Engine] Vessel placed:', vesselData);
            //     });
            // } catch (e) {
            //     console.error('[Engine] ERROR creating UIManager:', e);
            // }

            // Create edge fog ring (radial falloff at horizon)
            try {
                this.createEdgeFogRing();
                console.log('[Engine] Edge fog ring created');
            } catch (e) {
                console.error('[Engine] ERROR creating edge fog ring:', e);
            }
            
            // Create particle system for atmosphere
            try {
                this.createParticleSystem();
                console.log('[Engine] Particle system created');
            } catch (e) {
                console.error('[Engine] ERROR creating particle system:', e);
            }
            
            // Create grid cursor
            try {
                this.createGridCursor();
                console.log('[Engine] Grid cursor created');
            } catch (e) {
                console.error('[Engine] ERROR creating grid cursor:', e);
            }
            
            // Initialize factory systems
            try {
                console.log('[Engine] Factory systems initializing...');
                this.initializeFactorySystems();
                console.log('[Engine] Factory systems initialized');
            } catch (e) {
                console.error('[Engine] ERROR initializing factory systems:', e);
            }
            
            console.log('[Engine] Scene children after initialization:', this.scene.children.length);
            this.scene.children.forEach((child, i) => {
                console.log(`  [${i}] ${child.name || child.type}`, 'pos:', `(${child.position.x.toFixed(2)}, ${child.position.y.toFixed(2)}, ${child.position.z.toFixed(2)})`, 'children:', child.children?.length || 0);
            });
            
            // Setup mouse tracking for HUD coordinate/terrain updates
            try {
                this.setupMouseTracking();
                console.log('[Engine] Mouse tracking setup complete');
            } catch (e) {
                console.error('[Engine] ERROR setting up mouse tracking:', e);
            }
        } catch (e) {
            console.error('[Engine] CRITICAL ERROR in initializeGridAndCamera:', e);
        }
    }

    initializeFactorySystems() {
        // Create resource manager
        this.resourceManager = new ResourceManager(this.scene);

        // Create resource transport system (manages packet movement through vessels)
        this.resourceTransport = new ResourceTransport(this.scene, this.grid, this.resourceManager);

        // WIRE ResourceManager production events to ProgressionManager
        if (this.hud && this.hud.progressionManager) {
            this.resourceManager.onProduced((resourceType, amount) => {
                this.hud.progressionManager.onResourceProduced(resourceType, amount);
            });
            
            this.resourceManager.onConsumed((resourceType, amount) => {
                this.hud.progressionManager.onResourceConsumed(resourceType, amount);
            });
            
            console.log('[Engine] ResourceManager wired to ProgressionManager for event streaming');
        } else {
            console.warn('[Engine] WARNING: Could not wire ResourceManager to ProgressionManager (missing references)');
        }

        // Create transport system
        this.transportSystem = new TransportSystem(this.grid, this.resourceManager);

        // VesselSystem already initialized in initializeGridAndCamera

        // Create placement manager
        this.placementManager = new PlacementManager(
            this.grid,
            this.scene,
            this.resourceManager,
            this.transportSystem,
            this  // Pass engine for material registration
        );
        
        // WIRE PlacementManager building placement events to ProgressionManager
        if (this.hud && this.hud.progressionManager) {
            this.placementManager.onPlaced((buildingId, buildingType, gridX, gridZ) => {
                this.hud.progressionManager.onBuildingBuilt(buildingId);
            });
            
            console.log('[Engine] PlacementManager wired to ProgressionManager for building events');
        } else {
            console.warn('[Engine] WARNING: Could not wire PlacementManager to ProgressionManager');
        }
        
        // Initialize MapGenerator for procedural structure placement
        try {
            this.mapGenerator = new MapGenerator(this.grid, this.scene);
            
            // Wire progression manager to MapGenerator for unlock checks
            if (this.hud && this.hud.progressionManager) {
                this.mapGenerator.setProgressionManager(this.hud.progressionManager);
            }
            
            // Generate the map with structures
            const mapData = this.mapGenerator.generateMap();
            console.log('[Engine] MapGenerator complete:', mapData.stats.totalStructures, 'structures placed');
        } catch (e) {
            console.error('[Engine] ERROR initializing MapGenerator:', e);
        }
        
        // Store camera reference for LOD calculations in buildings
        this.scene.userData.camera = this.camera;

        // Setup shader profile listener for dynamic material updates
        this.placementManager.setupShaderProfileListener();

        // WIRE PlacementManager to InputManager for building placement
        if (this.inputManager) {
            this.inputManager.setPlacementManager(this.placementManager);
        }

        // Initialize demo factory scenario builder
        this.demoFactory = new DemoFactory(this);
        console.log('[Engine] DemoFactory available via window.engine.demoFactory');
        console.log('[Engine]   - demoFactory.setupQuick() : Quick setup (user places vessels)');
        console.log('[Engine]   - demoFactory.setupFull() : Auto-setup with all vessels');
        console.log('[Engine]   - demoFactory.setupMinimal() : Minimal single-path demo');
        console.log('[Engine]   - demoFactory.setupStressTest() : 25-extractor stress test');
        console.log('[Engine]   - demoFactory.printStats() : Status report');

        console.log('✓ Factory systems initialized');
        console.log(this.placementManager.getStats());
    }

    createParticleSystem() {
        // OPTIMIZED: Reduced particle count for performance
        const particleCount = 100;  // Reduced from 200
        const positionArray = new Float32Array(particleCount * 3);
        
        for (let i = 0; i < particleCount * 3; i += 3) {
            positionArray[i] = (Math.random() - 0.5) * 50; // x
            positionArray[i + 1] = Math.random() * 20; // y
            positionArray[i + 2] = (Math.random() - 0.5) * 50; // z
        }
        
        const particleGeometry = new THREE.BufferGeometry();
        particleGeometry.setAttribute('position', new THREE.BufferAttribute(positionArray, 3));
        
        const particleMaterial = new THREE.PointsMaterial({
            color: COLORS.GROUND_PRIMARY,
            size: 0.3,
            sizeAttenuation: true,
            transparent: true,
            opacity: 0.4,
            fog: true  // Particles fade with fog for performance
        });
        
        this.particles = new THREE.Points(particleGeometry, particleMaterial);
        this.particles.frustumCulled = true;  // Cull particles outside view
        this.scene.add(this.particles);
        console.log('[Engine] Particle system created (optimized)');
        this.particleVelocities = new Float32Array(particleCount * 3);
        
        // Random velocities
        for (let i = 0; i < particleCount * 3; i += 3) {
            this.particleVelocities[i] = (Math.random() - 0.5) * 0.1; // vx
            this.particleVelocities[i + 1] = (Math.random() - 0.5) * 0.05; // vy
            this.particleVelocities[i + 2] = (Math.random() - 0.5) * 0.1; // vz
        }
    }

    createEdgeFogRing() {
        // Radial fog falloff at horizon (A2: edge fog ring)
        const size = 180;
        const geo = new THREE.CircleGeometry(size, 64);
        const fogColor = new THREE.Color(0x0a1722);
        
        const mat = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            uniforms: {
                uColor: { value: fogColor },
                uInner: { value: 0.55 },
                uOuter: { value: 0.95 },
                uStrength: { value: 0.85 }
            },
            vertexShader: `
                varying vec2 vUv;
                void main(){
                    vUv = uv;
                    vec4 wPos = modelMatrix * vec4(position,1.0);
                    gl_Position = projectionMatrix * viewMatrix * wPos;
                }
            `,
            fragmentShader: `
                varying vec2 vUv;
                uniform vec3 uColor;
                uniform float uInner, uOuter, uStrength;
                void main(){
                    vec2 p = (vUv - 0.5) * 2.0;
                    float r = length(p);
                    float a = smoothstep(uInner, uOuter, r) * uStrength;
                    if(a <= 0.001) discard;
                    gl_FragColor = vec4(uColor, a);
                }
            `
        });
        
        this.edgeFogRing = new THREE.Mesh(geo, mat);
        this.edgeFogRing.rotation.x = -Math.PI / 2;
        this.edgeFogRing.renderOrder = 1;
        this.edgeFogRing.frustumCulled = false;
        this.scene.add(this.edgeFogRing);
    }

    /**
     * Register a BioShader material for periodic time updates
     */
    registerAnimatedMaterial(material) {
        if (material && material.uniforms && material.uniforms.uTime) {
            if (!this.animatedMaterials.includes(material)) {
                this.animatedMaterials.push(material);
            }
        }
    }

    createGridCursor() {
        console.log('[Engine] Creating grid cursor (square)...');
        
        const cursorSize = 0.48;
        // Create square instead of circle
        const cursorGeometry = new THREE.PlaneGeometry(cursorSize * 1.4, cursorSize * 1.4);
        
        // Simplified material for cursor
        const cursorMaterial = new THREE.MeshBasicMaterial({  // Changed from MeshStandardMaterial
            color: 0x00ffff,
            transparent: true,
            opacity: 0.4,  // Decreased opacity
            side: THREE.DoubleSide,
            depthWrite: false,
            fog: false
        });
        
        this.gridCursor = new THREE.Mesh(cursorGeometry, cursorMaterial);
        this.gridCursor.name = 'GridCursor';
        this.gridCursor.position.y = 0.02;
        this.gridCursor.rotation.x = -Math.PI / 2;
        this.gridCursor.renderOrder = 10;
        this.gridCursor.frustumCulled = false;
        this.gridCursor.matrixAutoUpdate = true;
        
        this.scene.add(this.gridCursor);
        console.log('[Engine] Grid cursor added (optimized)');
        
        // Create selection overlay group
        this.selectionOverlayGroup = new THREE.Group();
        this.selectionOverlayGroup.name = 'SelectionOverlays';
        this.scene.add(this.selectionOverlayGroup);
        console.log('[Engine] Selection overlay group created');
        
        // Create REUSABLE selection visualization assets (FIX for Issue B)
        this.selectionMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,  // Yellow highlight
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide,
            depthWrite: false,
            fog: false
        });
        this.selectionGeometry = new THREE.PlaneGeometry(0.49, 0.49);
        console.log('[Engine] Reusable selection material & geometry created');
    }

    /**
     * Visualize selected region with overlay meshes
     */
    visualizeSelection(selectionRegion) {
        // Clear previous overlays
        while (this.selectionOverlayGroup.children.length > 0) {
            this.selectionOverlayGroup.remove(this.selectionOverlayGroup.children[0]);
        }
        
        if (!selectionRegion || !this.grid) {
            console.log('[Engine] Selection cleared');
            return;
        }
        
        // FIX for Issue B: Force integer coordinates to prevent float precision issues
        const minX = Math.round(selectionRegion.minX);
        const maxX = Math.round(selectionRegion.maxX);
        const minZ = Math.round(selectionRegion.minZ);
        const maxZ = Math.round(selectionRegion.maxZ);
        
        const widthCount = maxX - minX + 1;
        const heightCount = maxZ - minZ + 1;
        const expectedCells = widthCount * heightCount;
        
        console.log(`[visualizeSelection] Loop: X[${minX} to ${maxX}]=${widthCount} steps, Z[${minZ} to ${maxZ}]=${heightCount} steps, Total: ${expectedCells}`);
        
        // REUSE overlayMaterial and overlayGeometry instead of creating every frame (FIX for Issue B)
        let meshCount = 0;
        let firstPos = null;
        let lastPos = null;
        
        for (let x = minX; x <= maxX; x++) {
            for (let z = minZ; z <= maxZ; z++) {
                // Create mesh with REUSABLE geometry and material
                const overlay = new THREE.Mesh(this.selectionGeometry, this.selectionMaterial);
                
                const worldPos = this.grid.getWorldPosition(x, z);
                overlay.position.copy(worldPos);
                overlay.position.y = 0.03; // Slightly above grid
                overlay.rotation.x = -Math.PI / 2;
                overlay.renderOrder = 9;
                
                this.selectionOverlayGroup.add(overlay);
                
                if (meshCount === 0) firstPos = { x: worldPos.x, z: worldPos.z };
                lastPos = { x: worldPos.x, z: worldPos.z };
                meshCount++;
            }
        }
        
        console.log(`[visualizeSelection] ✓ ${meshCount} meshes | First: [${firstPos.x.toFixed(1)}, ${firstPos.z.toFixed(1)}], Last: [${lastPos.x.toFixed(1)}, ${lastPos.z.toFixed(1)}]`);
        
        // Update HUD with mesh count
        const debugDiv = document.getElementById('hud-selected-cell');
        if (debugDiv) {
            const existing = debugDiv.innerHTML;
            debugDiv.innerHTML = existing + `<br><span style="color: #0f0; font-size: 9px;">✓ ${meshCount} meshes</span>`;
        }
    }

    /**
     * Clear all selection overlays
     */
    clearSelectionOverlay() {
        while (this.selectionOverlayGroup.children.length > 0) {
            this.selectionOverlayGroup.remove(this.selectionOverlayGroup.children[0]);
        }
        console.log('[Engine] Selection overlays cleared');
    }

    setupMouseTracking() {
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        let isSelecting = false; // Track if we're in selection mode
        let selectionStart = null; // Where selection started
        let currentDragSelection = null; // Track current drag selection to avoid unnecessary updates
        let visualizeCallCount = 0; // Debug counter
        
        const onMouseMove = (event) => {
            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
            
            raycaster.setFromCamera(mouse, this.camera);
            
            // Create a plane at y=0 to intersect with
            const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            const intersection = new THREE.Vector3();
            raycaster.ray.intersectPlane(plane, intersection);
            
            if (this.grid && this.gridCursor) {
                const gridCell = this.grid.getGridCell(intersection);
                
                const cursorPos = this.grid.getWorldPosition(gridCell.x, gridCell.z);
                this.gridCursor.position.copy(cursorPos);
                this.gridCursor.position.y = 0.01; // Keep cursor flat on ground
                
                // Store current cursor position for click detection
                this.lastCursorPos = { x: gridCell.x, z: gridCell.z };
                
                // If we're selecting, visualize selection in real-time (only if changed)
                if (isSelecting && selectionStart && this.hud) {
                    const newSelection = { 
                        minX: Math.min(selectionStart.x, gridCell.x),
                        maxX: Math.max(selectionStart.x, gridCell.x),
                        minZ: Math.min(selectionStart.z, gridCell.z),
                        maxZ: Math.max(selectionStart.z, gridCell.z)
                    };
                    
                    console.log(`[MouseMove] Start: [${selectionStart.x}, ${selectionStart.z}], Current: [${gridCell.x}, ${gridCell.z}], Selection bounds: [${newSelection.minX},${newSelection.minZ}] to [${newSelection.maxX},${newSelection.maxZ}]`);
                    
                    // Only update if selection region changed
                    if (!currentDragSelection || 
                        currentDragSelection.minX !== newSelection.minX ||
                        currentDragSelection.maxX !== newSelection.maxX ||
                        currentDragSelection.minZ !== newSelection.minZ ||
                        currentDragSelection.maxZ !== newSelection.maxZ) {
                        
                        currentDragSelection = newSelection;
                        visualizeCallCount++;
                        this.hud.updateSelectionBox(selectionStart, gridCell);
                        console.log(`[MouseMove] #${visualizeCallCount}: Updated visualization with region: [${newSelection.minX},${newSelection.minZ}] to [${newSelection.maxX},${newSelection.maxZ}]`);
                        this.visualizeSelection(newSelection);
                    }
                }
                
                // Update HUD with current coordinates and terrain info
                if (this.hud) {
                    this.hud.updateCoordinates(gridCell.x, gridCell.z);
                    const terrainType = this.grid.getCellType(gridCell.x, gridCell.z);
                    this.hud.updateTerrainInfo(terrainType);
                    
                    // Update building hover info if there's a building at this cell
                    if (this.placementManager) {
                        const building = this.placementManager.getBuildingAt(gridCell.x, gridCell.z);
                        this.hud.updateBuildingHoverInfo(building);
                    }
                }
            }
        };
        
        const onMouseDown = (event) => {
            console.log(`[Engine] Mouse button ${event.button} pressed at (${event.clientX}, ${event.clientY})`);
            
            // Only proceed if we have grid
            if (!this.grid) {
                console.warn('[Engine] Grid not available');
                return;
            }
            
            // Calculate grid cell at click position
            const clickMouse = new THREE.Vector2();
            clickMouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            clickMouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
            
            raycaster.setFromCamera(clickMouse, this.camera);
            const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            const clickIntersection = new THREE.Vector3();
            raycaster.ray.intersectPlane(plane, clickIntersection);
            
            // Get grid cell at click position
            const clickGridCell = this.grid.getGridCell(clickIntersection);
            if (!clickGridCell || clickGridCell.x === undefined || clickGridCell.z === undefined) {
                console.warn('[Engine] Invalid grid cell:', clickGridCell);
                return;
            }
            
            console.log(`[Engine] Click grid cell: [${clickGridCell.x}, ${clickGridCell.z}]`);
            
            if (event.button === 0) { // Left-click/hold - START DRAG SELECTION
                console.log(`[Engine] Left-click/drag started at:`, clickGridCell);
                isSelecting = true;
                selectionStart = { x: clickGridCell.x, z: clickGridCell.z };
                currentDragSelection = null; // Reset drag selection
                if (this.hud) {
                    this.hud.startSelection(selectionStart);
                }
            } else if (event.button === 2) { // Right-click - show properties
                console.log(`[Engine] Right-click detected, showing properties`);
                if (this.hud) {
                    const cellX = clickGridCell.x;
                    const cellZ = clickGridCell.z;
                    const terrainType = this.grid.getCellType(cellX, cellZ);
                    
                    // Get building at this cell if any
                    const building = this.placementManager ? this.placementManager.getBuildingAt(cellX, cellZ) : null;
                    
                    const cellData = {
                        x: cellX,
                        z: cellZ,
                        terrain: terrainType,
                        building: building
                    };
                    
                    this.hud.showPropertiesWindow(cellData, event.clientX, event.clientY);
                }
            }
        };
        
        const onMouseUp = (event) => {
            if (event.button === 0) {
                console.log(`[Engine] Left-click released`);
                if (isSelecting && selectionStart && this.lastCursorPos && this.hud) {
                    // Calculate final selection region
                    const minX = Math.min(selectionStart.x, this.lastCursorPos.x);
                    const maxX = Math.max(selectionStart.x, this.lastCursorPos.x);
                    const minZ = Math.min(selectionStart.z, this.lastCursorPos.z);
                    const maxZ = Math.max(selectionStart.z, this.lastCursorPos.z);
                    
                    const selectionRegion = { minX, maxX, minZ, maxZ };
                    console.log(`[Engine] Selection complete: [${minX}, ${minZ}] to [${maxX}, ${maxZ}]`);
                    
                    // Highlight buildings in selection and clear overlays
                    this.highlightBuildingsInSelection(selectionRegion);
                    this.clearSelectionOverlay(); // Clear visual overlays but keep building highlights
                    
                    this.hud.finalizeSelection(selectionStart, this.lastCursorPos);
                }
                isSelecting = false;
                selectionStart = null;
                currentDragSelection = null; // Reset for next drag
                console.log(`[MouseUp] Selection drag complete - visualizeSelection was called ${visualizeCallCount} times`);
                visualizeCallCount = 0; // Reset counter
            }
        };
        
        // FIX for Issue A: Move all selection tracking to window level
        this.renderer.domElement.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mousemove', onMouseMove);  // <-- FIX: Window, not canvas
        window.addEventListener('mouseup', onMouseUp);      // <-- CRITICAL: Window, not canvas
        this.renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Prevent accidental text selection during drag
        this.renderer.domElement.addEventListener('selectstart', (e) => e.preventDefault());
        
        // Escape key to deselect everything
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                console.log('[Engine] Escape pressed - clearing selection');
                this.clearSelectionOverlay();
                this.clearAllBuildingHighlights();
            }
        });
        
        console.log('[Engine] Mouse tracking setup complete - drag selection enabled');
    }

    /**
     * Highlight and elevate buildings in selected region
     */
    highlightBuildingsInSelection(selectionRegion) {
        const { minX, maxX, minZ, maxZ } = selectionRegion;
        console.log(`[Engine] Highlighting buildings in region [${minX},${minZ}] to [${maxX},${maxZ}]`);
        
        const elevationAmount = 0.3; // Lift buildings up
        const highlightColor = new THREE.Color(0xffaa00); // Orange/yellow filter
        let buildingCount = 0;
        
        // Search for buildings in each selected cell
        for (let x = minX; x <= maxX; x++) {
            for (let z = minZ; z <= maxZ; z++) {
                const building = this.placementManager ? this.placementManager.getBuildingAt(x, z) : null;
                
                if (building && building.mesh) {
                    // Store original position if not already stored
                    if (building._originalY === undefined) {
                        building._originalY = building.mesh.position.y;
                    }
                    
                    // Elevate building
                    building.mesh.position.y = building._originalY + elevationAmount;
                    
                    // Apply color filter to building material
                    if (building.mesh.material) {
                        const material = building.mesh.material;
                        
                        // Store original properties if not already stored
                        if (!building._originalEmissive) {
                            building._originalEmissive = material.emissive ? material.emissive.clone() : new THREE.Color(0x000000);
                            building._originalEmissiveIntensity = material.emissiveIntensity || 0;
                        }
                        
                        // Apply highlight color
                        if (material.emissive) {
                            material.emissive.copy(highlightColor);
                        }
                        if (material.emissiveIntensity !== undefined) {
                            material.emissiveIntensity = 0.6;
                        }
                        material.needsUpdate = true;
                    }
                    
                    // Mark as selected
                    building._isSelected = true;
                    buildingCount++;
                    console.log(`[Engine] Highlighted building at [${x}, ${z}]`);
                }
            }
        }
        
        // Show selection action panel only if at least one building was selected
        if (buildingCount > 0 && this.hud && this.hud.showSelectionActionPanel) {
            this.hud.showSelectionActionPanel();
            console.log(`[Engine] Selection action panel shown - ${buildingCount} buildings selected`);
        }
    }

    /**
     * Clear highlight from buildings (deselect)
     */
    clearBuildingHighlight(building) {
        if (building && building.mesh) {
            // Lower building back to original position
            if (building._originalY !== undefined) {
                building.mesh.position.y = building._originalY;
            } else {
                building.mesh.position.y -= 0.3; // Default if not stored
            }
            
            // Restore original material
            if (building.mesh.material && building._originalEmissive) {
                building.mesh.material.emissive.copy(building._originalEmissive);
                building.mesh.material.emissiveIntensity = building._originalEmissiveIntensity || 0;
                building.mesh.material.needsUpdate = true;
            }
            
            building._isSelected = false;
        }
    }

    /**
     * Clear all building highlights
     */
    clearAllBuildingHighlights() {
        if (!this.placementManager) return;
        
        console.log('[Engine] Clearing all building highlights');
        
        // Iterate through all buildings and clear their highlights
        this.placementManager.buildings.forEach(({ building }) => {
            this.clearBuildingHighlight(building);
        });
        
        // Hide selection action panel
        if (this.hud && this.hud.hideSelectionActionPanel) {
            this.hud.hideSelectionActionPanel();
        }
    }

    updateParticles() {
        if (!this.particles) return;
        
        // Update particles only every 3 frames for performance
        this.particleUpdateCounter = (this.particleUpdateCounter || 0) + 1;
        if (this.particleUpdateCounter % 3 !== 0) return;
        
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
        console.log('[Engine] Start called, beginning animation loop...');
        console.log('[Engine] Scene children at start:', this.scene.children.length);
        this.animate();
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        
        const time = Date.now() * 0.001;
        
        // Log first frame diagnostics
        if (!this.firstFrameLogged) {
            this.firstFrameLogged = true;
            console.log('[Engine.Animate] First frame! Scene children:', this.scene.children.length);
            console.log('[Engine.Animate] Renderer size:', this.renderer.getSize(new THREE.Vector2()));
            console.log('[Engine.Animate] Camera near/far:', this.camera.near, '/', this.camera.far);
        }
        
        // Calculate deltaTime for frame-rate independent updates
        const currentTime = Date.now();
        this.deltaTime = this.lastFrameTime ? (currentTime - this.lastFrameTime) / 1000 : 0;
        this.lastFrameTime = currentTime;
        
        // Update RTS camera
        if (this.rtsCamera) {
            this.rtsCamera.update();
        }
        
        // Adapt fog density to zoom (closer = slightly denser)
        if (this.scene.fog && this.scene.fog.isFogExp2 && this.rtsCamera) {
            const base = 0.013;
            const zoomK = THREE.MathUtils.clamp(this.rtsCamera.currentZoom / 30, 0.7, 1.4);
            this.scene.fog.density = base * zoomK;
        }
        
        // Update edge fog ring position and params
        if (this.edgeFogRing && this.rtsCamera) {
            this.edgeFogRing.position.set(this.rtsCamera.currentPan.x, 0.008, this.rtsCamera.currentPan.z);
            const mat = this.edgeFogRing.material;
            mat.uniforms.uInner.value = THREE.MathUtils.lerp(0.58, 0.52, (this.rtsCamera.currentZoom - 10) / 50);
            mat.uniforms.uStrength.value = THREE.MathUtils.lerp(0.78, 0.9, (this.rtsCamera.currentZoom - 10) / 50);
        }
        
        // Update BioShader time (grid shader)
        if (this.bioShaderMaterial) {
            this.bioShaderMaterial.updateTime(time);
        }
        
        // Update all registered animated materials (nucleus, buildings, pipes, etc.)
        for (const material of this.animatedMaterials) {
            if (material.uniforms && material.uniforms.uTime) {
                material.uniforms.uTime.value = time;
            }
        }
        // Pulse the point light with the sphere
        if (this.pointLight) {
            const pulseIntensity = 0.3 + 0.4 * Math.sin(time * 2.5);
            this.pointLight.intensity = pulseIntensity;
        }
        
        // Update grid shader
        if (this.grid) {
            this.grid.updateShaderTime(time);
        }

        // Update grid cursor (only if it uses shader material)
        if (this.gridCursorMaterial && this.gridCursorMaterial.uniforms) {
            this.gridCursorMaterial.uniforms.uTime.value = time;
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
        
        // Update resource transport packets moving through vessels
        if (this.resourceTransport) {
            this.resourceTransport.update(this.deltaTime);
        }
        
        // Update vessel flow animations
        if (this.vesselSystem && this.vesselSystem.updateFlowAnimation) {
            this.vesselSystem.updateFlowAnimation(this.deltaTime);
        }
        
        // Update UI systems
        if (this.uiManager) {
            this.uiManager.update();
            // Update real-time factory statistics on HUD
            if (this.placementManager) {
                this.uiManager.updateFactoryStats(this.placementManager.getStats());
            }
        }

        // Update biomarkers (simulate health fluctuations)
        this.biomarkerUpdateCounter += this.deltaTime * 1000;
        if (this.biomarkerUpdateCounter > 500 && this.hud) { // Update every 500ms
            this.hud.simulateBiomarkers();
            this.biomarkerUpdateCounter = 0;
        }
        
        // Render the scene
        this.renderer.render(this.scene, this.camera);
    }
}

export default Engine;
