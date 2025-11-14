import { defineSystem, defineQuery } from 'bitecs';
import { Transform, Velocity, PlayerInput, SimWorld } from '../components';

const MOVE_SPEED = 10.0;

export const createMovementSystem = () => {
  const query = defineQuery([Transform, Velocity, PlayerInput]);

  return defineSystem((world: SimWorld) => {
    const dt = world.dt;
    const entities = query(world);

    for (let i = 0; i < entities.length; ++i) {
      const id = entities[i];

      // 1. APPLY ROTATION (Look Direction)
      Transform.rotation[id] = PlayerInput.yaw[id];

      // 2. CALCULATE MOVEMENT (Relative to Look)
      const forward = PlayerInput.forward[id];
      const right = PlayerInput.right[id];
      
      const angle = Transform.rotation[id];
      const sin = Math.sin(angle);
      const cos = Math.cos(angle);

      // Standard FPS WASD Math
      const dx = (right * cos) - (forward * sin);
      const dz = (right * sin) + (forward * cos);

      Velocity.x[id] = dx * MOVE_SPEED;
      Velocity.z[id] = dz * MOVE_SPEED;

      // 3. INTEGRATE POSITION
      Transform.x[id] += Velocity.x[id] * dt;
      Transform.z[id] += Velocity.z[id] * dt;

      // Floor Constraint
      if (Transform.y[id] < 0) Transform.y[id] = 0;
    }
    return world;
  });
};