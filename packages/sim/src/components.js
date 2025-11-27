import { defineComponent, Types } from 'bitecs';
// --- CORE ENGINE COMPONENTS ---
export const Vector3 = { x: Types.f32, y: Types.f32, z: Types.f32 };
export const Transform = defineComponent({
    ...Vector3,
    rotation: Types.f32 // Y-axis rotation (Yaw)
});
export const Velocity = defineComponent(Vector3);
// Generic Input: The Engine doesn't care what "Button 1" does.
// It just knows the button is pressed.
export const InputState = defineComponent({
    moveX: Types.f32, // WASD / Left Stick X
    moveY: Types.f32, // WASD / Left Stick Y
    viewX: Types.f32, // Mouse X / Right Stick X
    viewY: Types.f32, // Mouse Y / Right Stick Y
    buttons: Types.ui32, // Bitmask for actions (Jump, Fire, Reload, Enter Vehicle)
    lastTick: Types.ui32
});
// Tags
export const Me = defineComponent(); // Local player authority
