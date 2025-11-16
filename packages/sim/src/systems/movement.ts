import { defineSystem, defineQuery } from 'bitecs';
import { Transform, Velocity, InputState, SimWorld } from '../components';

// --- TUNING ---
const MOVE_SPEED = 10.0;
const AIR_SPEED_FACTOR = 0.6; // New: 60% control when airborne (adds weight)
const GRAVITY = -25.0;        // New: Snappier gravity (was -20)
const JUMP_FORCE = 9.0;       // New: Higher jump to match gravity
const GROUND_TOLERANCE = 0.05;// New: Forgiving check (was 0.001)

// [FIX] Button mask is no longer used, jump is a direct property
// const BUTTON_JUMP = 1; 

export const MOVEMENT_CONSTANTS = {
  MOVE_SPEED: 10.0,
  AIR_SPEED_FACTOR: 0.6,
  GRAVITY: -25.0,
  JUMP_FORCE: 9.0,
  // ...
};
export const MOVEMENT_VERSION = "movement-v1.0.0";
console.log("Client movement version:", MOVEMENT_VERSION);

export const createMovementSystem = () => {
  const query = defineQuery([Transform, Velocity, InputState]);

  return defineSystem((world: SimWorld) => {
    const dt = world.dt;
    const entities = query(world);

    for (let i = 0; i < entities.length; ++i) {
      const id = entities[i];

      // 1. GROUND CHECK
      // We use a larger tolerance so we don't miss jumps due to micro-floating
      // TODO: Later, replace this with a raycast
      const isGrounded = Transform.y[id] < GROUND_TOLERANCE;
      if (Transform.y[id] < 0) Transform.y[id] = 0; // Floor
      
      // 2. APPLY ROTATION
      Transform.rotation[id] = InputState.viewX[id];

      // 3. CALCULATE MOVEMENT
      // Reduce speed if in the air for better "physics feel"
      const speed = isGrounded ? MOVE_SPEED : (MOVE_SPEED * AIR_SPEED_FACTOR);

      // [FIX] Use new InputState.axes structure
      const forward = InputState.axes.forward[id];
      const right = InputState.axes.right[id];
      
      const angle = Transform.rotation[id];
      const sin = Math.sin(angle);
      const cos = Math.cos(angle);

      const dx = (right * cos) - (forward * sin);
      const dz = (right * sin) + (forward * cos);

      Velocity.x[id] = dx * speed;
      Velocity.z[id] = dz * speed;

      // 4. GRAVITY & JUMPING
      Velocity.y[id] += GRAVITY * dt;

      // [FIX] Use new InputState.axes structure
      const wantsJump = InputState.axes.jump[id] === 1;

      if (isGrounded && wantsJump) {
        // Only allow jump if not already shooting up (prevents double-force glitches)
        if (Velocity.y[id] <= 0.1) {
            Velocity.y[id] = JUMP_FORCE;
        }
      }

      // 5. INTEGRATE POSITION
      Transform.x[id] += Velocity.x[id] * dt;
      Transform.z[id] += Velocity.z[id] * dt;
      Transform.y[id] += Velocity.y[id] * dt;

      // 6. FLOOR COLLISION
      // Hard clamp for now. A real solution would "slide"
      if (Transform.y[id] < 0) {
        Transform.y[id] = 0;
        Velocity.y[id] = 0;
      }
    }

    return world;
  });
};