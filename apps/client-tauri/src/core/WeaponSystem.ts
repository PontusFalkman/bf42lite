// apps/client-tauri/src/core/WeaponSystem.ts

import * as THREE from 'three';
import { Renderer } from './Renderer';
import { NetworkManager } from '../managers/NetworkManager';
import { InputState } from '@bf42lite/engine-core';
import { WEAPON_STATS, CLASS_IDS } from './constants';

export class WeaponSystem {
  private lastFireTime = 0;
  private readonly RANGE = 100;

  private raycaster = new THREE.Raycaster();

  // Track current class
  public currentClassId = CLASS_IDS.ASSAULT;

  constructor(
    private renderer: Renderer,
    private net: NetworkManager,
  ) {}

  public setClass(classId: number) {
    // Clamp to known classes; fallback to Assault
    if (Object.prototype.hasOwnProperty.call(WEAPON_STATS, classId)) {
      this.currentClassId = classId;
    } else {
      this.currentClassId = CLASS_IDS.ASSAULT;
    }
  }

  public update(_dt: number, myEntityId: number, currentTick: number) {
    if (myEntityId < 0) return;

    const stats =
      WEAPON_STATS[
        this.currentClassId as keyof typeof WEAPON_STATS
      ] ?? WEAPON_STATS[CLASS_IDS.ASSAULT];

    const isShooting = (InputState.buttons[myEntityId] & 2) !== 0;

    if (isShooting) {
      const now = performance.now() / 1000;

      if (now - this.lastFireTime > stats.rate) {
        this.fire(currentTick);
        this.lastFireTime = now;
      }
    }
  }

  private fire(tick: number) {
    const camera = this.renderer.getCamera();
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const start = camera.position.clone();
    const direction = this.raycaster.ray.direction.clone();
    const end = start.clone().add(direction.clone().multiplyScalar(this.RANGE));

    this.net.sendFire(
      { x: start.x, y: start.y, z: start.z },
      { x: direction.x, y: direction.y, z: direction.z },
      tick,
    );

    const visualOffset = new THREE.Vector3(0.2, -0.2, 0.5);
    visualOffset.applyQuaternion(camera.quaternion);
    const visualStart = start.clone().add(visualOffset);

    this.renderer.drawTracer(visualStart, end);
  }
}
