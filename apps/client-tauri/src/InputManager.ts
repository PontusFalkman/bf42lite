import { SimWorld, InputState } from '@bf42lite/sim';
import * as THREE from 'three'; // Import THREE

// Helper: Convert degrees to radians
const toRad = (deg: number) => deg * (Math.PI / 180);

export class InputManager {
  private keys = new Set<string>();
  private buttons = new Set<number>();
  
  private yaw = 0;
  private pitch = 0; 
  private readonly MAX_PITCH = toRad(85);

  private isInteractionEnabled = true; // Default to true
  public isAiming: boolean = false; // For zoom
  
  // New properties for axis values
  private forward = 0;
  private right = 0;
  private jump = 0;
  private shoot = 0;
  private reload = 0;

  // [FIX] Constructor now accepts the camera
  constructor(private camera: THREE.PerspectiveCamera) {
    window.addEventListener('keydown', (e) => this.keys.add(e.code));
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      // Reset single-press keys
      if (e.code === 'KeyR') this.reload = 0;
      if (e.code === 'Space') this.jump = 0;
    });

    // Use mousedown/up for continuous shooting
    window.addEventListener('mousedown', (e) => {
      this.buttons.add(e.button);
      if (e.button === 0) this.shoot = 1;
      if (e.button === 2) this.isAiming = true;
    });
    window.addEventListener('mouseup', (e) => {
      this.buttons.delete(e.button);
      if (e.button === 0) this.shoot = 0;
      if (e.button === 2) this.isAiming = false;
    });

    document.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement && this.isInteractionEnabled) {
        const sensitivity = 0.002;
        this.yaw -= e.movementX * sensitivity;
        this.pitch -= e.movementY * sensitivity;
        this.pitch = Math.max(-this.MAX_PITCH, Math.min(this.MAX_PITCH, this.pitch));
      }
    });

    document.addEventListener('click', () => {
      if (!this.isInteractionEnabled) return; 
      if (!document.pointerLockElement) {
        document.body.requestPointerLock(); 
      }
    });
  }

  public setInteraction(enabled: boolean) {
      this.isInteractionEnabled = enabled;
  }

  // [NEW] update() method for ClientGame
  public update(_camera: THREE.PerspectiveCamera) {
    if (!this.isInteractionEnabled || !document.pointerLockElement) {
      this.forward = 0;
      this.right = 0;
      this.jump = 0;
      this.shoot = 0;
      this.reload = 0;
      return;
    }

    // Movement
    this.forward = 0;
    this.right = 0;
    if (this.keys.has('KeyW')) this.forward += 1;
    if (this.keys.has('KeyS')) this.forward -= 1;
    if (this.keys.has('KeyD')) this.right += 1;
    if (this.keys.has('KeyA')) this.right -= 1;

    // Actions
    if (this.keys.has('Space')) this.jump = 1;
    if (this.keys.has('KeyR')) this.reload = 1;
  }

  // [NEW] applyTo() method for ClientGame
  public applyTo(eid: number, world: SimWorld) {
    if (!this.isInteractionEnabled) return;
    
    InputState.axes.forward[eid] = this.forward;
    InputState.axes.right[eid] = this.right;
    InputState.axes.jump[eid] = this.jump;
    InputState.axes.shoot[eid] = this.shoot;
    InputState.axes.reload[eid] = this.reload;

    InputState.viewX[eid] = this.yaw;
    InputState.viewY[eid] = this.pitch;

    // Reset single-frame presses
    this.jump = 0;
    this.reload = 0;
  }
}