// apps/client-tauri/src/core/constants.ts

// --- TEAMS ---

export const TEAM_IDS = {
  NONE: 0,
  AXIS: 1,
  ALLIES: 2,
} as const;

export type TeamIdNumeric = (typeof TEAM_IDS)[keyof typeof TEAM_IDS];

export const TEAM_COLORS = {
  NEUTRAL: 0xcccccc,
  AXIS: 0xff0000,
  ALLIES: 0x0000ff,
} as const;

// --- CLASSES / LOADOUTS ---

export const CLASS_IDS = {
  ASSAULT: 0,
  MEDIC: 1,
  SCOUT: 2,
} as const;

// (no weapon names/stats here anymore – those now come from JSON)
