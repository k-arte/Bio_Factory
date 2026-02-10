/**
 * ParticleSpawner.js - Visual deposits (Calcium, Amyloid)
 * 
 * Spawns procedural calcium nodes and amyloid deposits across terrain
 * using InstancedMesh for high performance.
 * 
 * Calcium: 1x1 (default), 2x2 (~1/5), 3x3 (~1/25) sizes
 * Amyloid: Flat plates (wide or tall) + spiral decoration
 * 
 * All spawn data read from BioDatabase.particles config
 */

import * as THREE from 'three';
import BioDatabase from '../data/BioDatabase.js';
import { COLORS } from '../data/Colors.js';

class ParticleSpawner {
  constructor(scene, grid) {
    this.scene = scene;
    this.grid = grid;
    this.particleGroup = new THREE.Group();
    this.particleGroup.name = 'ParticleGroup';
    
    // Lists to track instanced meshes
    this.instancedMeshes = [];
    
    console.log('[ParticleSpawner] Initializing...');
  }

  /**
   * Spawn all particles across grid based on terrain
   */
  spawnAllParticles() {
    console.log('[ParticleSpawner] Spawning calcium and amyloid deposits...');
    
    // Get config from BioDatabase
    const particleConfigs = BioDatabase.particles || {};
    
    // Spawn calcium
    if (particleConfigs.calcium) {
      this._spawnCalcium(particleConfigs.calcium);
    }
    
    // Spawn amyloid
    if (particleConfigs.amyloid) {
      this._spawnAmyloid(particleConfigs.amyloid);
    }
    
    // Add to scene
    this.scene.add(this.particleGroup);
    console.log(`[ParticleSpawner] Spawned ${this.instancedMeshes.length} particle instanced meshes`);
  }

  /**
   * Spawn calcium deposits (1x1, 2x2, 3x3 size variants)
   * Cluster logic: 5 * random(1-4) particles per spawn zone
   */
  _spawnCalcium(config) {
    const gridSize = config.gridSize || this.grid.gridSize;
    const clusterFrequency = config.clusterFrequency || 0.15; // 15% of cells spawn clusters
    const baseSize = config.baseSize || 0.3; // 30cm per particle unit
    
    // Create instanced mesh for efficiency
    const geom = new THREE.BoxGeometry(baseSize, baseSize, baseSize);
    const mat = new THREE.MeshStandardMaterial({
      color: config.color || 0xD0D0D0, // Light gray
      roughness: 0.7,
      metalness: 0.0,
      emissive: config.emissive || 0x333333,
      emissiveIntensity: 0.1
    });
    
    // Calculate max instances (conservative)
    const maxInstances = Math.ceil(gridSize * gridSize * clusterFrequency * 20);
    const calciumMesh = new THREE.InstancedMesh(geom, mat, maxInstances);
    calciumMesh.name = 'CalciumDeposits';
    calciumMesh.castShadow = true;
    calciumMesh.receiveShadow = true;
    
    let instanceIndex = 0;
    const dummy = new THREE.Object3D();
    
    // Grid spawn logic
    for (let x = 0; x < gridSize; x++) {
      for (let z = 0; z < gridSize; z++) {
        // Random chance to spawn cluster
        if (Math.random() > clusterFrequency) continue;
        
        // Determine cluster size: 5 * random(1-4)
        const multiplier = Math.floor(Math.random() * 4) + 1; // 1-4
        const clusterCount = 5 * multiplier; // 5, 10, 15, or 20
        
        // Spawn particles in cluster
        for (let i = 0; i < clusterCount; i++) {
          if (instanceIndex >= maxInstances) break;
          
          // Determine particle size variant
          let sizeScale = 1.0; // 1x1 (default)
          const sizeRoll = Math.random();
          if (sizeRoll < 1/5) {
            sizeScale = 2.0; // 2x2 (~1/5 chance)
          } else if (sizeRoll < 1/5 + 1/25) {
            sizeScale = 3.0; // 3x3 (~1/25 chance)
          }
          
          // Random offset within cluster
          const offsetX = (Math.random() - 0.5) * 0.8;
          const offsetZ = (Math.random() - 0.5) * 0.8;
          const offsetY = baseSize/2 * sizeScale; // Sit on ground
          
          // World position
          const worldPos = this.grid.getWorldPosition(x, z);
          
          // Set dummy transform
          dummy.position.set(
            worldPos.x + offsetX,
            offsetY,
            worldPos.z + offsetZ
          );
          dummy.scale.setScalar(sizeScale);
          dummy.updateMatrix();
          
          // Copy to instanced buffer
          calciumMesh.setMatrixAt(instanceIndex, dummy.matrix);
          instanceIndex++;
        }
      }
    }
    
    // Update instance count to actual spawned
    calciumMesh.count = instanceIndex;
    this.particleGroup.add(calciumMesh);
    this.instancedMeshes.push(calciumMesh);
    
    console.log(`[ParticleSpawner] Calcium: spawned ${instanceIndex} instances`);
  }

  /**
   * Spawn amyloid deposits
   * Plates (wide+flat OR tall+narrow) + spiral decoration
   */
  _spawnAmyloid(config) {
    const gridSize = config.gridSize || this.grid.gridSize;
    const spawnFrequency = config.spawnFrequency || 0.08; // 8% of cells
    const plateWidth = config.plateWidth || 0.5;
    const plateThickness = config.plateThickness || 0.05;
    
    // Create plate geometry (thin box)
    const plateSizeWide = new THREE.BoxGeometry(plateWidth, plateThickness, plateWidth * 0.5);
    const plateSizeTall = new THREE.BoxGeometry(plateWidth * 0.3, plateThickness * 2, plateWidth);
    
    const plateMat = new THREE.MeshStandardMaterial({
      color: config.colorPlate || 0xA08080, // Brownish
      roughness: 0.6,
      metalness: 0.1,
      emissive: config.emissivePlate || 0x1a1410,
      emissiveIntensity: 0.05
    });
    
    // Create plate instanced meshes (wide variant)
    const maxPlatesTouchInstances = Math.ceil(gridSize * gridSize * spawnFrequency * 5);
    const plateWideeMesh = new THREE.InstancedMesh(plateSizeWide, plateMat, maxPlatesTouchInstances);
    plateWideeMesh.name = 'AmyloidPlatesWide';
    plateWideeMesh.castShadow = true;
    plateWideeMesh.receiveShadow = true;
    
    const plateTallMesh = new THREE.InstancedMesh(plateSizeTall, plateMat, maxPlatesTouchInstances);
    plateTallMesh.name = 'AmyloidPlatesTall';
    plateTallMesh.castShadow = true;
    plateTallMesh.receiveShadow = true;
    
    // Create spiral geometry (TubeGeometry wound around plate)
    const spiralGeom = this._createSpiralGeometry(config.spiralRadius || 0.3, config.spiralTurns || 2);
    const spiralMat = new THREE.MeshStandardMaterial({
      color: config.colorSpiral || 0x8B7355, // Darker brown
      roughness: 0.8,
      metalness: 0.0,
      emissive: 0x2a2a1f,
      emissiveIntensity: 0.08
    });
    
    const maxSpiralInstances = Math.ceil(gridSize * gridSize * spawnFrequency * 5);
    const spiralMesh = new THREE.InstancedMesh(spiralGeom, spiralMat, maxSpiralInstances);
    spiralMesh.name = 'AmyloidSpirals';
    spiralMesh.castShadow = true;
    spiralMesh.receiveShadow = true;
    
    let wideIndex = 0, tallIndex = 0, spiralIndex = 0;
    const dummy = new THREE.Object3D();
    
    // Spawn across grid
    for (let x = 0; x < gridSize; x++) {
      for (let z = 0; z < gridSize; z++) {
        // Random spawn chance
        if (Math.random() > spawnFrequency) continue;
        
        const worldPos = this.grid.getWorldPosition(x, z);
        
        // 50/50 chance for wide or tall variant
        const isWide = Math.random() > 0.5;
        
        // Random rotation (plate edge orientation)
        const rotationY = Math.random() * Math.PI * 2;
        const rotationX = (Math.random() - 0.5) * 0.3; // Tilt
        const rotationZ = (Math.random() - 0.5) * 0.2;
        
        // Position plate
        dummy.position.copy(worldPos);
        dummy.position.y = 0.1; // Sit on ground
        
        dummy.rotation.set(rotationX, rotationY, rotationZ);
        dummy.scale.setScalar(1.0);
        dummy.updateMatrix();
        
        // Add plate variant
        if (isWide && wideIndex < maxPlatesTouchInstances) {
          plateWideeMesh.setMatrixAt(wideIndex, dummy.matrix);
          wideIndex++;
          
          // Add spiral decoration next to wide plate
          if (spiralIndex < maxSpiralInstances) {
            dummy.position.x += 0.4;
            dummy.rotation.set(rotationX + 0.2, rotationY, 0);
            dummy.scale.setScalar(0.8);
            dummy.updateMatrix();
            spiralMesh.setMatrixAt(spiralIndex, dummy.matrix);
            spiralIndex++;
          }
        } else if (!isWide && tallIndex < maxPlatesTouchInstances) {
          plateTallMesh.setMatrixAt(tallIndex, dummy.matrix);
          tallIndex++;
          
          // Add spiral for tall variant
          if (spiralIndex < maxSpiralInstances) {
            dummy.position.z += 0.4;
            dummy.rotation.set(rotationX, rotationY + 0.3, rotationZ);
            dummy.scale.setScalar(0.8);
            dummy.updateMatrix();
            spiralMesh.setMatrixAt(spiralIndex, dummy.matrix);
            spiralIndex++;
          }
        }
      }
    }
    
    // Update counts
    plateWideeMesh.count = wideIndex;
    plateTallMesh.count = tallIndex;
    spiralMesh.count = spiralIndex;
    
    this.particleGroup.add(plateWideeMesh);
    this.particleGroup.add(plateTallMesh);
    this.particleGroup.add(spiralMesh);
    
    this.instancedMeshes.push(plateWideeMesh, plateTallMesh, spiralMesh);
    
    console.log(`[ParticleSpawner] Amyloid: ${wideIndex} wide plates, ${tallIndex} tall plates, ${spiralIndex} spirals`);
  }

  /**
   * Create spiral geometry (TubeGeometry wound helically)
   * Used as decoration for amyloid deposits
   */
  _createSpiralGeometry(radius = 0.3, turns = 2) {
    const points = [];
    const segments = Math.ceil(turns * 24); // 24 points per turn
    
    for (let i = 0; i <= segments; i++) {
      const t = i / (segments / turns);
      const angle = t * Math.PI * 2;
      const height = (t - turns / 2) * 0.3; // Vertical travel
      
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = height;
      
      points.push(new THREE.Vector3(x, y, z));
    }
    
    const curve = new THREE.CatmullRomCurve3(points);
    const tubeGeom = new THREE.TubeGeometry(curve, 8, 0.04, 4, false);
    
    return tubeGeom;
  }

  /**
   * Dispose all particle meshes
   */
  dispose() {
    this.instancedMeshes.forEach(mesh => {
      mesh.geometry.dispose();
      mesh.material.dispose();
    });
    this.particleGroup.children.length = 0;
  }
}

export default ParticleSpawner;
