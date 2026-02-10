/**
 * VesselGeometryFactory.js - Creates vessel geometries for all fitting types
 * 
 * All vessels are 50% immersed (погружены на 50%) in the grid floor (y=0)
 * Manhattan-only (no diagonals): straight_x, straight_z, elbow, tee, cross, endcap
 * Plus: empty_connector (no inputs/outputs)
 * 
 * Vessel type detection based on neighboring connections:
 * - 0 neighbors → endcap
 * - 1 neighbor → straight
 * - 2 neighbors (opposite) → straight  
 * - 2 neighbors (90°) → elbow
 * - 3 neighbors → tee
 * - 4 neighbors → cross
 */

import * as THREE from 'three';

class VesselGeometryFactory {
  constructor() {
    this.radius = 0.15;        // Vessel tube radius
    this.immersion = 0.5;      // 50% submerged
    this.cellHeight = 1.0;     // Grid cell height
  }

  /**
   * Create geometry for a vessel segment
   * @param {string} type - Vessel type (straight_x, straight_z, elbow, tee, cross, endcap, empty_connector)
   * @param {number} gridX - Grid X position
   * @param {number} gridZ - Grid Z position
   * @returns {THREE.BufferGeometry}
   */
  createVesselGeometry(type, gridX, gridZ) {
    switch (type) {
      case 'straight_x':
        return this._createStraightX();
      case 'straight_z':
        return this._createStraightZ();
      case 'elbow':
        return this._createElbow();
      case 'tee':
        return this._createTee();
      case 'cross':
        return this._createCross();
      case 'endcap':
        return this._createEndcap();
      case 'empty_connector':
        return this._createEmptyConnector();
      default:
        return this._createStraightX();
    }
  }

  /**
   * Create straight vessel along X axis
   * 50% above ground (y=0), 50% below
   */
  _createStraightX() {
    const geom = new THREE.CylinderGeometry(
      this.radius,           // radius top
      this.radius,           // radius bottom
      this.cellHeight,       // height (full cell, half submerged)
      8,                     // segments
      1,                     // height segments
      false                  // open ended
    );
    
    // Rotate to align with X axis (from 90° = Y-axis to 0° = X-axis)
    geom.rotateZ(Math.PI / 2);
    
    // Shift down so bottom is at y=0 (50% immersion)
    geom.translate(0, -this.cellHeight / 4, 0);
    
    return geom;
  }

  /**
   * Create straight vessel along Z axis
   */
  _createStraightZ() {
    const geom = new THREE.CylinderGeometry(
      this.radius,
      this.radius,
      this.cellHeight,
      8,
      1,
      false
    );
    
    // Rotate to align with Z axis (90° around X)
    geom.rotateX(Math.PI / 2);
    
    // Shift down for 50% immersion
    geom.translate(0, -this.cellHeight / 4, 0);
    
    return geom;
  }

  /**
   * Create elbow (90° corner)
   * Two perpendicular cylinders meeting at origin
   */
  _createElbow() {
    const group = new THREE.Group();
    
    // Horizontal segment (X)
    const horz = new THREE.CylinderGeometry(this.radius, this.radius, this.cellHeight / 2, 8, 1, false);
    horz.rotateZ(Math.PI / 2);
    horz.translate(-this.cellHeight / 4, -this.cellHeight / 4, 0);
    
    // Vertical segment (Z)
    const vert = new THREE.CylinderGeometry(this.radius, this.radius, this.cellHeight / 2, 8, 1, false);
    vert.rotateX(Math.PI / 2);
    vert.translate(0, -this.cellHeight / 4, -this.cellHeight / 4);
    
    // Merge geometries
    const merged = THREE.BufferGeometry.prototype.merge.call(
      horz,
      vert
    ) || this._mergeGeometries([horz, vert]);
    
    return merged;
  }

  /**
   * Create tee (3 connections: one direction, two perpendicular)
   */
  _createTee() {
    // Main line along X
    const mainLine = new THREE.CylinderGeometry(this.radius, this.radius, this.cellHeight / 2, 8, 1, false);
    mainLine.rotateZ(Math.PI / 2);
    mainLine.translate(-this.cellHeight / 4, -this.cellHeight / 4, 0);
    
    // Branch along Z (upward from center)
    const branch = new THREE.CylinderGeometry(this.radius, this.radius, this.cellHeight / 2, 8, 1, false);
    branch.rotateX(Math.PI / 2);
    branch.translate(0, -this.cellHeight / 4, this.cellHeight / 4);
    
    return this._mergeGeometries([mainLine, branch]);
  }

  /**
   * Create cross (4 connections)
   */
  _createCross() {
    // +X direction
    const segX1 = new THREE.CylinderGeometry(this.radius, this.radius, this.cellHeight / 2, 8, 1, false);
    segX1.rotateZ(Math.PI / 2);
    segX1.translate(this.cellHeight / 4, -this.cellHeight / 4, 0);
    
    // -X direction
    const segX2 = new THREE.CylinderGeometry(this.radius, this.radius, this.cellHeight / 2, 8, 1, false);
    segX2.rotateZ(Math.PI / 2);
    segX2.translate(-this.cellHeight / 4, -this.cellHeight / 4, 0);
    
    // +Z direction
    const segZ1 = new THREE.CylinderGeometry(this.radius, this.radius, this.cellHeight / 2, 8, 1, false);
    segZ1.rotateX(Math.PI / 2);
    segZ1.translate(0, -this.cellHeight / 4, this.cellHeight / 4);
    
    // -Z direction
    const segZ2 = new THREE.CylinderGeometry(this.radius, this.radius, this.cellHeight / 2, 8, 1, false);
    segZ2.rotateX(Math.PI / 2);
    segZ2.translate(0, -this.cellHeight / 4, -this.cellHeight / 4);
    
    // Merge all segments
    return this._mergeGeometries([segX1, segX2, segZ1, segZ2]);
  }

  /**
   * Create endcap (1 connection, dead end)
   */
  _createEndcap() {
    // Simple sphere at the end
    const geom = new THREE.SphereGeometry(this.radius * 2, 8, 8);
    geom.translate(0, -this.cellHeight / 4, 0);
    
    return geom;
  }

  /**
   * Create empty connector (junction with no I/O, for routing only)
   */
  _createEmptyConnector() {
    // Hollow junction sphere
    const inner = new THREE.SphereGeometry(this.radius * 1.5, 8, 8);
    inner.translate(0, -this.cellHeight / 4, 0);
    
    // Could add visual distinction (lighter color or outlined)
    return inner;
  }

  /**
   * Merge multiple geometries into one
   */
  _mergeGeometries(geometries) {
    if (geometries.length === 0) return new THREE.BufferGeometry();
    
    // Use BufferGeometry merge utility
    let merged = geometries[0].clone();
    
    for (let i = 1; i < geometries.length; i++) {
      const geom = geometries[i].clone();
      
      // Merge using Three.js utility or manual method
      const positions = [];
      const posArray1 = merged.attributes.position.array;
      const posArray2 = geom.attributes.position.array;
      
      positions.push(...posArray1);
      positions.push(...posArray2);
      
      const newGeom = new THREE.BufferGeometry();
      newGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
      newGeom.computeVertexNormals();
      
      merged = newGeom;
    }
    
    return merged;
  }

  /**
   * Determine vessel type from connectivity (neighbors)
   * @param {number[]} neighbors - Array of neighbor directions (up, down, left, right)
   *                               where index 0=+X, 1=-X, 2=+Z, 3=-Z
   * @returns {string} Vessel type
   */
  static determineVesselType(neighbors) {
    const count = neighbors.filter(n => n).length;
    
    if (count === 0) return 'endcap';
    if (count === 1) return neighbors[0] || neighbors[1] ? 'straight_x' : 'straight_z';
    if (count === 2) {
      if ((neighbors[0] && neighbors[1]) || (neighbors[2] && neighbors[3])) {
        return neighbors[0] || neighbors[1] ? 'straight_x' : 'straight_z';
      } else {
        return 'elbow';
      }
    }
    if (count === 3) return 'tee';
    if (count === 4) return 'cross';
    
    return 'endcap';
  }
}

export default VesselGeometryFactory;
