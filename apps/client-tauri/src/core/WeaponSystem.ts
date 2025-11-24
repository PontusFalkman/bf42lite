import * as THREE from 'three';
import { Renderer } from './Renderer';
import { NetworkManager } from '../managers/NetworkManager';
import { InputState } from '@bf42lite/engine-core';

// Mirror of Server Config
const WEAPONS = {
  0: { rate: 0.12 }, // Assault
  1: { rate: 0.15 }, // Medic
  2: { rate: 1.50 }, // Scout (Slow!)
};

export class WeaponSystem {
  private lastFireTime = 0;
  // Remove fixed constant: private readonly FIRE_RATE = 0.15; 
  private readonly RANGE = 100;     

  private raycaster = new THREE.Raycaster();
  
  // [ADD THIS] To track what we are holding
  public currentClassId = 0;

  constructor(
      private renderer: Renderer,
      private net: NetworkManager
  ) {}

  public setClass(classId: number) {
      this.currentClassId = classId;
  }

  public update(_dt: number, myEntityId: number, currentTick: number) {
    if (myEntityId < 0) return;

    // Get Fire Rate for current class
    const stats = WEAPONS[this.currentClassId as keyof typeof WEAPONS] || WEAPONS[0];

    const isShooting = (InputState.buttons[myEntityId] & 2) !== 0;

    if (isShooting) {
      const now = performance.now() / 1000; 
      
      // [UPDATED] Use stats.rate
      if (now - this.lastFireTime > stats.rate) {
        this.fire(currentTick);
        this.lastFireTime = now;
      }
    }
  }

  // ... rest of fire() is fine ...
  private fire(tick: number) {
    const camera = this.renderer.getCamera();
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const start = camera.position.clone();
    const direction = this.raycaster.ray.direction.clone();
    const end = start.clone().add(direction.clone().multiplyScalar(this.RANGE));

    this.net.sendFire(
        { x: start.x, y: start.y, z: start.z },
        { x: direction.x, y: direction.y, z: direction.z },
        tick
    );

    const visualOffset = new THREE.Vector3(0.2, -0.2, 0.5);
    visualOffset.applyQuaternion(camera.quaternion);
    const visualStart = start.clone().add(visualOffset);

    this.renderer.drawTracer(visualStart, end);
  }
}
