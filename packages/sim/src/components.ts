import { defineComponent, Types, IWorld } from 'bitecs';

// --- CORE ENGINE COMPONENTS ---

export const Vector3 = { x: Types.f32, y: Types.f32, z: Types.f32 };

export const Transform = defineComponent({
  ...Vector3,
  rotation: Types.f32 // Y-axis rotation (Yaw)
});

export const Velocity = defineComponent(Vector3);

// [FIX] Updated InputState to match new ClientGame.ts
export const InputState = defineComponent({
  axes: {
    forward: Types.f32,
    right: Types.f32,
    jump: Types.ui8,
    shoot: Types.ui8,
    reload: Types.ui8,
  },
  viewX: Types.f32,    // Mouse X
  viewY: Types.f32,    // Mouse Y
  lastTick: Types.ui32
});

// Tags
export const Me = defineComponent(); // Local player authority

// The Simulation World Contract
export interface SimWorld extends IWorld {
  time: number;
  dt: number;
  [key: string]: any; 
}