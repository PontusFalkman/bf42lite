import { defineSystem, defineQuery } from 'bitecs';
import { Transform, Velocity, InputState } from '../components';
// --- TUNING ---
const MOVE_SPEED = 10.0;
const AIR_SPEED_FACTOR = 0.6; // New: 60% control when airborne (adds weight)
const GRAVITY = -25.0; // New: Snappier gravity (was -20)
const JUMP_FORCE = 9.0; // New: Higher jump to match gravity
const GROUND_TOLERANCE = 0.05; // New: Forgiving check (was 0.001)
const BUTTON_JUMP = 1;
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
    return defineSystem((world) => {
        const dt = world.dt;
        const entities = query(world);
        for (let i = 0; i < entities.length; ++i) {
            const id = entities[i];
            // 1. GROUND CHECK
            // We use a larger tolerance so we don't miss jumps due to micro-floating
            // TODO: Later, replace this with a raycast for platforms/terrain
            const isGrounded = Transform.y[id] <= GROUND_TOLERANCE;
            // 2. APPLY ROTATION
            Transform.rotation[id] = InputState.viewX[id];
            // 3. CALCULATE MOVEMENT
            // Reduce speed if in the air for better "physics feel"
            const speed = isGrounded ? MOVE_SPEED : (MOVE_SPEED * AIR_SPEED_FACTOR);
            const forward = -InputState.moveY[id]; // W = +1 (forward), S = -1 (backward)
            const right = InputState.moveX[id]; // A/D
            const yaw = Transform.rotation[id];
            const sin = Math.sin(yaw);
            const cos = Math.cos(yaw);
            // Match server basis exactly:
            // forward: (sin, cos)
            // right:   (cos, -sin)
            const vecFwdX = sin;
            const vecFwdZ = cos;
            const vecRightX = cos;
            const vecRightZ = -sin;
            const dx = vecFwdX * forward + vecRightX * right;
            const dz = vecFwdZ * forward + vecRightZ * right;
            Velocity.x[id] = dx * speed;
            Velocity.z[id] = dz * speed;
            // 4. GRAVITY & JUMPING
            Velocity.y[id] += GRAVITY * dt;
            const wantsJump = (InputState.buttons[id] & BUTTON_JUMP) !== 0;
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
            // Hard constraint to keep us on the map
            if (Transform.y[id] < 0) {
                Transform.y[id] = 0;
                // If we were falling, stop. 
                // If we just jumped (Vel > 0), let it happen!
                if (Velocity.y[id] < 0) {
                    Velocity.y[id] = 0;
                }
            }
        }
        return world;
    });
};
