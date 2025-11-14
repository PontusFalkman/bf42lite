import * as THREE from 'three';
import { Renderer } from './Renderer';
import { PlayerInput } from '@bf42lite/sim';

export class WeaponSystem {
  private lastFireTime = 0;
  private fireRate = 0.15; // Fire every 150ms (approx 600 RPM)
  private range = 100;     // Max shot distance

  // Reusable Raycaster to save memory
  private raycaster = new THREE.Raycaster();

  constructor(private renderer: Renderer) {}

  update(dt: number, myEntityId: number) {
    // 1. Check Input (Is holding click?)
    // Note: We check the Component state (PlayerInput), not the raw key
    const isShooting = PlayerInput.shoot[myEntityId] === 1;

    if (isShooting) {
      const now = performance.now() / 1000; // Current time in seconds
      
      if (now - this.lastFireTime > this.fireRate) {
        this.fire();
        this.lastFireTime = now;
      }
    }
  }

  private fire() {
    const camera = this.renderer.getCamera();

    // 1. Setup Raycast from Camera Center
    // (0,0) in normalized device coordinates is the center of the screen
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

    // 2. Calculate Start & End points
    const start = camera.position.clone();
    
    // Calculate the "ideal" end point (max range)
    // ray.direction is a normalized vector pointing forward
    const direction = this.raycaster.ray.direction.clone();
    const end = start.clone().add(direction.multiplyScalar(this.range));

    // 3. TODO: Check for hits (Intersection with Enemy Meshes)
    // For now, we just shoot straight through everything visually.
    
    // 4. Draw the Tracer
    // Move start point slightly down/right to simulate coming from a gun barrel, not eyes
    const visualStart = start.clone().add(new THREE.Vector3(0.2, -0.2, 0.5).applyQuaternion(camera.quaternion));
    
    this.renderer.drawTracer(visualStart, end);
  }
}