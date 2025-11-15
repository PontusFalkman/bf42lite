import * as THREE from 'three';
import { Renderer } from './Renderer';
import { NetworkManager } from './managers/NetworkManager';
import { InputState } from '@bf42lite/sim';

export class WeaponSystem {
  private lastFireTime = 0;
  private fireRate = 0.15; 
  private range = 100;     

  private raycaster = new THREE.Raycaster();

  constructor(
      private renderer: Renderer,
      private net: NetworkManager
  ) {}

  update(_dt: number, myEntityId: number, currentTick: number) {
    if (myEntityId < 0) return;

    // CHECK BUTTON BITMASK (Bit 2 = Fire)
    const isShooting = (InputState.buttons[myEntityId] & 2) !== 0;

    if (isShooting) {
      const now = performance.now() / 1000; 
      
      if (now - this.lastFireTime > this.fireRate) {
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
    const end = start.clone().add(direction.clone().multiplyScalar(this.range));

    this.net.sendFire(
        { x: start.x, y: start.y, z: start.z },
        { x: direction.x, y: direction.y, z: direction.z },
        tick
    );

    const visualStart = start.clone().add(new THREE.Vector3(0.2, -0.2, 0.5).applyQuaternion(camera.quaternion));
    this.renderer.drawTracer(visualStart, end);
  }
}