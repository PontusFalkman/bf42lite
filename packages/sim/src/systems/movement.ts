import { defineSystem, defineQuery } from 'bitecs';
// FIX: Import InputState instead of PlayerInput
import { Transform, Velocity, InputState, SimWorld } from '../components';

const MOVE_SPEED = 10.0;
const JUMP_FORCE = 8.0;
const GRAVITY = -20.0;

// FIX: Define Jump Bit (matches what we will set in input manager later)
const BUTTON_JUMP = 1; 

export const createMovementSystem = () => {
  // FIX: Query InputState
  const query = defineQuery([Transform, Velocity, InputState]);

  return defineSystem((world: SimWorld) => {
    const dt = world.dt;
    const entities = query(world);

    for (let i = 0; i < entities.length; ++i) {
      const id = entities[i];

      // 1. APPLY ROTATION
      // New mapping: viewX is Yaw
      Transform.rotation[id] = InputState.viewX[id];

      // 2. CALCULATE MOVEMENT
      // New mapping: moveY is Forward, moveX is Right
      const forward = InputState.moveY[id];
      const right = InputState.moveX[id];
      
      const angle = Transform.rotation[id];
      const sin = Math.sin(angle);
      const cos = Math.cos(angle);

      const dx = (right * cos) - (forward * sin);
      const dz = (right * sin) + (forward * cos);

      Velocity.x[id] = dx * MOVE_SPEED;
      Velocity.z[id] = dz * MOVE_SPEED;

      // 3. GRAVITY & JUMPING
      Velocity.y[id] += GRAVITY * dt;

      // FIX: Check Jump Button Bitmask
      const isJumpPressed = (InputState.buttons[id] & BUTTON_JUMP) !== 0;

      if (Transform.y[id] <= 0.001 && isJumpPressed) {
        Velocity.y[id] = JUMP_FORCE;
      }

      // 4. INTEGRATE POSITION
      Transform.x[id] += Velocity.x[id] * dt;
      Transform.z[id] += Velocity.z[id] * dt;
      Transform.y[id] += Velocity.y[id] * dt;

      // 5. FLOOR COLLISION
      if (Transform.y[id] < 0) {
        Transform.y[id] = 0;
        Velocity.y[id] = 0;
      }
    }
    return world;
  });
};