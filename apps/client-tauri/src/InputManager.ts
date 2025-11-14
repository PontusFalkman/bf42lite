import { ClientInput } from '@bf42lite/protocol';

// Helper: Convert degrees to radians
const toRad = (deg: number) => deg * (Math.PI / 180);

export class InputManager {
  private keys = new Set<string>();
  private buttons = new Set<number>();
  
  // === 1. Camera State Initialization ===
  private yaw = 0;
  private pitch = 0; 

  // === 2. Realistic Constraints ===
  private readonly MAX_PITCH = toRad(85);

  constructor() {
    // Keyboard
    window.addEventListener('keydown', (e) => this.keys.add(e.code));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    
    // Mouse Buttons
    window.addEventListener('mousedown', (e) => this.buttons.add(e.button));
    window.addEventListener('mouseup', (e) => this.buttons.delete(e.button));

    // Mouse Movement (Pointer Lock)
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement) {
        const sensitivity = 0.002;
        
        // Update Angles
        this.yaw -= e.movementX * sensitivity;
        this.pitch -= e.movementY * sensitivity;

        // === 3. Apply Clamp ===
        this.pitch = Math.max(-this.MAX_PITCH, Math.min(this.MAX_PITCH, this.pitch));
      }
    });

    // Click to Capture
    document.addEventListener('click', () => {
      // FIXED: Removed unused 'canvas' variable
      if (!document.pointerLockElement) {
        document.body.requestPointerLock(); 
      }
    });
  }

  getCommand(tick: number): ClientInput {
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
        yaw: this.yaw,
        pitch: this.pitch
      }
    };
  }
}