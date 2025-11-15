import { defineComponent, Types, IWorld } from 'bitecs';

export const RespawnTimer = defineComponent({
  timeLeft: Types.f32
});

export const Health = defineComponent({
  max: Types.ui8,
  current: Types.ui8,
  isDead: Types.ui8
});

// === NEW: Ammo Component ===
export const Ammo = defineComponent({
  current: Types.ui8,   // Rounds in magazine
  reserve: Types.ui16,  // Total extra rounds
  magSize: Types.ui8    // Capacity of one magazine
});

export const CombatState = defineComponent({
  lastFireTime: Types.f32,
  // === NEW: Reload State ===
  isReloading: Types.ui8,    // 0 = False, 1 = True
  reloadStartTime: Types.f32
});

// --- Game State ---
export const GameRules = defineComponent({
  ticketsAxis: Types.i16,
  ticketsAllies: Types.i16,
  state: Types.ui8 // 0 = Playing, 1 = Game Over
});

export const Team = defineComponent({
  id: Types.ui8 // 1 = Axis, 2 = Allies
});

export interface SimWorld extends IWorld {
  time: number;
  dt: number;
  [key: string]: any;
}

export const Vector3 = { x: Types.f32, y: Types.f32, z: Types.f32 };

export const Transform = defineComponent({
  ...Vector3,
  rotation: Types.f32
});

export const Velocity = defineComponent(Vector3);

export const PlayerInput = defineComponent({
  forward: Types.f32,
  right: Types.f32,
  jump: Types.ui8,
  shoot: Types.ui8,
  yaw: Types.f32,
  pitch: Types.f32,
  lastTick: Types.ui32,
  reload: Types.ui8 // Added for input mapping convenience (optional but good practice)
});

export const Player = defineComponent();
export const Me = defineComponent();