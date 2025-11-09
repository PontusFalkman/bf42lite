// packages/sim/src/components.ts
import { Types, defineComponent } from 'bitecs'

export const Transform = defineComponent({
  x: Types.f32,
  y: Types.f32,
  z: Types.f32,
  // --- C2: Add rotation ---
  yaw: Types.f32,
  pitch: Types.f32,
})

export const Velocity = defineComponent({ x: Types.f32, y: Types.f32, z: Types.f32 })
export const Health = defineComponent({ current: Types.f32, max: Types.f32 })

// --- G4: ADD SCORING COMPONENTS ---
export const Team = defineComponent({
  // 0 = Team 1, 1 = Team 2
  id: Types.ui8,
})

export const PlayerStats = defineComponent({
  kills: Types.ui16,
  deaths: Types.ui16,
})

// This component will be added to a single "game" entity
export const GameState = defineComponent({
  // 0: Waiting, 1: InProgress, 2: PostMatch
  phase: Types.ui8,
  team1Tickets: Types.i16,
  team2Tickets: Types.i16,
})
// --- END G4 ---

// --- ADDING MISSING BITECS COMPONENTS ---

// Player is a "tag" component.
// The host will map client.id (string) to the entity ID (eid)
export const Player = defineComponent({})

// Player input state
export const Input = defineComponent({
  moveFwd: Types.ui8,
  moveBack: Types.ui8,
  moveLeft: Types.ui8,
  moveRight: Types.ui8,
  yaw: Types.f32,
  pitch: Types.f32,
})

// --- X1: ADD STAMINA COMPONENT ---
export const Stamina = defineComponent({ current: Types.f32, max: Types.f32 });

// --- X2: ADD AMMO & GADGET COMPONENTS ---
export const Ammo = defineComponent({
  current: Types.ui16, // Ammo in clip
  reserve: Types.f32, // <-- BUGFIX 2: CHANGED TO f32
  maxReserve: Types.ui16,
});

export const Gadget = defineComponent({
  cooldown: Types.f32, // Time remaining (for Ammo Box)
  maxCooldown: Types.f32,
});

// "Tag" component for ammo box entities
export const AmmoBox = defineComponent({});
// --- END X2 ---

// --- ADD MED BOX COMPONENTS ---
export const MedGadget = defineComponent({
  cooldown: Types.f32, // Time remaining (for Med Box)
  maxCooldown: Types.f32,
});

// "Tag" component for med box entities
export const MedBox = defineComponent({});
// --- END MED BOX ---

// --- ADD REPAIR TOOL COMPONENT ---
export const RepairTool = defineComponent({
  current: Types.f32, // Current heat level (0.0 to 100.0)
  max: Types.f32,     // Max heat (e.g., 100.0)
});
// --- END REPAIR TOOL COMPONENT ---

// --- X3: ADD GRENADE COMPONENTS ---
export const GrenadeGadget = defineComponent({
  cooldown: Types.f32, // Time remaining
  maxCooldown: Types.f32,
});

// "Tag" component for grenade entities
export const Grenade = defineComponent({});

export const GrenadeTimer = defineComponent({
  remaining: Types.f32, // Time until explosion
});

// "Tag" component for entities affected by gravity
export const Gravity = defineComponent({});
// --- END X3 ---