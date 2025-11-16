import { defineComponent, Types } from 'bitecs';

// 1. Life & Death
export const Health = defineComponent({
  max: Types.ui8,
  current: Types.ui8,
  isDead: Types.ui8
});

export const RespawnTimer = defineComponent({
  timeLeft: Types.f32
});

// 2. Combat
export const Ammo = defineComponent({
  current: Types.ui16, 
  reserve: Types.ui16,
  magSize: Types.ui16  
});

export const CombatState = defineComponent({
  lastFireTime: Types.f32,
  isReloading: Types.ui8, 
  reloadStartTime: Types.f32
});
export const Stats = defineComponent({
  kills: Types.ui16,
  deaths: Types.ui16
});
// 3. Teams & Rules
export const Team = defineComponent({
  id: Types.ui8 // 0=Neutral, 1=Axis, 2=Allies
});

// 4. Game Mode State
export const GameRules = defineComponent({
  ticketsAxis: Types.i16,
  ticketsAllies: Types.i16,
  state: Types.ui8 // 0=Playing, 1=EndScreen
});

// 5. Conquest Mode
export const CapturePoint = defineComponent({
  id: Types.ui8,          // ID of the flag
  team: Types.ui8,        // 0=Neutral, 1=Axis, 2=Allies
  progress: Types.f32,     // 0-100 (Axis) or 0-100 (Allies)
  radius: Types.f32       // <-- ADDED
});

// 6. Loadout
export const Loadout = defineComponent({
  classId: Types.ui8 // 0=Grunt, 1=Heavy, 2=Scout
});

// 7. Player Tag [FIXED: Added missing Soldier component]
export const Soldier = defineComponent({});

// 8. Player Aura [NEW: Added Aura component]
export const Aura = defineComponent({
  progress: Types.f32, // 0.0 to 1.0
  active: Types.ui8    // 0 or 1 (boolean)
});