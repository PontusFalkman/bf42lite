import { ClientInput } from '@bf42lite/protocol';

// Helper: Convert degrees to radians
const toRad = (deg: number) => deg * (Math.PI / 180);

export class InputManager {
  private keys = new Set<string>();
  private buttons = new Set<number>();
  
  private yaw = 0;
  private pitch = 0; 
  private readonly MAX_PITCH = toRad(85);

  // === 1. ADD STATE FLAGG ===
  private isInteractionEnabled = false; 

  constructor() {
    window.addEventListener('keydown', (e) => this.keys.add(e.code));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('mousedown', (e) => this.buttons.add(e.button));
    window.addEventListener('mouseup', (e) => this.buttons.delete(e.button));

    document.addEventListener('mousemove', (e) => {
      // Only rotate if locked AND enabled
      if (document.pointerLockElement && this.isInteractionEnabled) {
        const sensitivity = 0.002;
        this.yaw -= e.movementX * sensitivity;
        this.pitch -= e.movementY * sensitivity;
        this.pitch = Math.max(-this.MAX_PITCH, Math.min(this.MAX_PITCH, this.pitch));
      }
    });

    document.addEventListener('click', (e) => {
      // === 2. CHECK STATE BEFORE LOCKING ===
      if (!this.isInteractionEnabled) return; 

      // Prevent locking if we clicked a button/UI (extra safety)
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('.spawn-point')) return;

      if (!document.pointerLockElement) {
        document.body.requestPointerLock(); 
      }
    });
  }

  // === 3. EXPOSE CONTROL METHOD ===
  public setInteraction(enabled: boolean) {
      this.isInteractionEnabled = enabled;
  }

  getCommand(tick: number): ClientInput {
    // If in menu, return empty input
    if (!this.isInteractionEnabled) {
        return {
            type: 'input',
            tick,
            axes: { forward:0, right:0, jump:false, shoot:false, reload:false, yaw: this.yaw, pitch: this.pitch }
        };
    }

    let forward = 0;
    let right = 0;
    
    if (this.keys.has('KeyW')) forward += 1;
    if (this.keys.has('KeyS')) forward -= 1;
    if (this.keys.has('KeyD')) right += 1;
    if (this.keys.has('KeyA')) right -= 1;

    return {
      type: 'input',
      tick,
      axes: {
        forward,
        right,
        jump: this.keys.has('Space'),
        shoot: this.buttons.has(0),
        reload: this.keys.has('KeyR'),
        yaw: this.yaw,
        pitch: this.pitch
      }
    };
  }
}