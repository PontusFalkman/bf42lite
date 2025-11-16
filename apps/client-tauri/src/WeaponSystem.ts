import * as THREE from 'three';
import { Renderer } from './Renderer';
import { NetworkManager } from './managers/NetworkManager';
import { InputState } from '@bf42lite/sim';

export class WeaponSystem {
  private lastFireTime = 0;
  private readonly FIRE_RATE = 0.15; 
  private readonly RANGE = 100;     

  private raycaster = new THREE.Raycaster();

  constructor(
      private renderer: Renderer,
      private net: NetworkManager
  ) {}

  public update(_dt: number, myEntityId: number, currentTick: number) {
    if (myEntityId < 0) return;

    // CHECK BUTTON BITMASK (Bit 2 = Fire)
    // We check the InputState directly, which ClientGame updates from user input
    const isShooting = (InputState.buttons[myEntityId] & 2) !== 0;

    if (isShooting) {
      const now = performance.now() / 1000; 
      
      if (now - this.lastFireTime > this.FIRE_RATE) {
        this.fire(currentTick);
        this.lastFireTime = now;
      }
    }
  }

  private fire(tick: number) {
    const camera = this.renderer.getCamera();
    
    // 1. Math: Raycast from center of screen
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const start = camera.position.clone();
    const direction = this.raycaster.ray.direction.clone();
    const end = start.clone().add(direction.clone().multiplyScalar(this.RANGE));

    // 2. Network: Send the "Math" vectors
    this.net.sendFire(
        { x: start.x, y: start.y, z: start.z },
        { x: direction.x, y: direction.y, z: direction.z },
        tick
    );

    // 3. Visuals: Offset the start point so it looks like it comes from the hand/gun
    // Right (0.2), Down (-0.2), Forward (0.5) relative to camera
    const visualOffset = new THREE.Vector3(0.2, -0.2, 0.5);
    visualOffset.applyQuaternion(camera.quaternion);
    const visualStart = start.clone().add(visualOffset);

    this.renderer.drawTracer(visualStart, end);
  }
}