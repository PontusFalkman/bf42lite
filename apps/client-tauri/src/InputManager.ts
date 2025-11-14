import { ClientInput } from '@bf42lite/protocol';

export class InputManager {
  private keys = new Set<string>();
  private buttons = new Set<number>();
  
  // Camera State
  private yaw = 0;
  private pitch = 0;

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
        this.yaw -= e.movementX * sensitivity;
        this.pitch -= e.movementY * sensitivity;

        // Clamp Pitch (Don't break your neck)
        this.pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.pitch));
      }
    });

    // Click to Capture
    document.addEventListener('click', () => {
      const canvas = document.getElementById('game');
      if (canvas && !document.pointerLockElement) {
        canvas.requestPointerLock();
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
        yaw: this.yaw,     // <--- Send Look
        pitch: this.pitch  // <--- Send Look
      }
    };
  }
}