import { defineComponent, Types, IWorld } from 'bitecs';

export const RespawnTimer = defineComponent({
  timeLeft: Types.f32 // How many seconds until respawn?
});
export const Health = defineComponent({
  max: Types.ui8,
  current: Types.ui8,
  isDead: Types.ui8 // Boolean flag
});

// Track firing cooldowns server-side
export const CombatState = defineComponent({
  lastFireTime: Types.f32
});
// 1. Define the Custom World Interface
export interface SimWorld extends IWorld {
  time: number;
  dt: number;
  [key: string]: any; // Allow extension
}

export const Vector3 = { x: Types.f32, y: Types.f32, z: Types.f32 };

// World Position & Rotation
export const Transform = defineComponent({
  ...Vector3,
  rotation: Types.f32 // Yaw (y-axis rotation)
});

// Physics Velocity
export const Velocity = defineComponent(Vector3);

// Input State (The interface between Human/Network and Sim)
export const PlayerInput = defineComponent({
  forward: Types.f32, // -1.0 to 1.0
  right: Types.f32,   // -1.0 to 1.0
  jump: Types.ui8,    // 0 or 1 (boolean)
  shoot: Types.ui8,    // 0 or 1 (boolean)
  yaw: Types.f32,    // <--- ADD THIS
  pitch: Types.f32   // <--- ADD THI
});

// Gameplay Tags
export const Player = defineComponent(); // Tag for player entities
export const Me = defineComponent();     // Tag for the local player (client-only)