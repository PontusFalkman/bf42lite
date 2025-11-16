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

// 3. Teams & Rules
export const Team = defineComponent({
  id: Types.ui8 // 0=Neutral, 1=Axis, 2=Allies
});

// 4. Game Mode State (Renamed to match systems)
export const GameRules = defineComponent({
  ticketsAxis: Types.i16,
  ticketsAllies: Types.i16,
  state: Types.ui8 // 0=Playing, 1=EndScreen
});

export const Soldier = defineComponent(); 

export const Stats = defineComponent({
  kills: Types.ui16,
  deaths: Types.ui16
});
// FUTURE: Vehicles
// export const Vehicle = defineComponent({ type: Types.ui8, seatCount: Types.ui8 });