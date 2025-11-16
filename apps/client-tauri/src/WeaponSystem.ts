import * as THREE from 'three';
import { Renderer } from './Renderer';
import { NetworkManager } from './managers/NetworkManager';
import { InputState, SimWorld, Transform } from '@bf42lite/sim'; // [FIX] Added SimWorld/Transform
import { ClientFire } from '@bf42lite/protocol'; // [NEW] Import type

// Mirror of Server Config
const WEAPONS = {
  0: { rate: 0.12 }, // Assault
  1: { rate: 0.15 }, // Medic
  2: { rate: 1.50 }, // Scout (Slow!?)
};

export class WeaponSystem {
  private lastFireTime = 0;
  private readonly RANGE = 100;     

  private raycaster = new THREE.Raycaster();
  
  public currentClassId = 0;

  // [FIX] Constructor now only takes Renderer
  constructor(
      private renderer: Renderer,
  ) {}

  public setClass(classId: number) {
      this.currentClassId = classId;
  }

  // [FIX] Update signature matches new ClientGame
  public update(_dt: number, myEntityId: number, currentTick: number) {
    // This file is now only responsible for client-side effects (e.g., tracers)
    // The "fire" decision is made in ClientGame
  }

  // [NEW] createFireMessage method
  public createFireMessage(eid: number, tick: number, world: SimWorld): ClientFire | null {
    if (eid < 0) return null;

    const stats = WEAPONS[this.currentClassId as keyof typeof WEAPONS] || WEAPONS[0];
    const now = performance.now() / 1000; 

    if (now - this.lastFireTime > stats.rate) {
        this.lastFireTime = now;

        const camera = this.renderer.getCamera();
        this.raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
        const start = camera.position.clone();
        const direction = this.raycaster.ray.direction.clone();
        const end = start.clone().add(direction.clone().multiplyScalar(this.RANGE));

        // [NEW] Draw tracer locally
        this.renderer.drawTracer(start, end);

        // [NEW] Return the message for ClientGame to send
        return {
            type: 'fire',
            tick: tick,
            origin: { x: start.x, y: start.y, z: start.z },
            direction: { x: direction.x, y: direction.y, z: direction.z },
            weaponId: 1 // TODO: send classId/weaponId
        };
    }
    return null;
  }
}