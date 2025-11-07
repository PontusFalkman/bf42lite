import { Types, defineComponent } from "bitecs";

export const Transform = defineComponent({ 
  x: Types.f32, 
  y: Types.f32, 
  z: Types.f32,
  // --- C2: Add rotation ---
  yaw: Types.f32,
  pitch: Types.f32,
});

export const Velocity = defineComponent({ x: Types.f32, y: Types.f32, z: Types.f32 });
export const Health = defineComponent({ current: Types.f32, max: Types.f32 });