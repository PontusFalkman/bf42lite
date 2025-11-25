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

// --- WEAPONS (NAMES + BASIC STATS) ---

export const WEAPON_NAMES: Record<number, string> = {
  [CLASS_IDS.ASSAULT]: 'THOMPSON',
  [CLASS_IDS.MEDIC]: 'MP40',
  [CLASS_IDS.SCOUT]: 'KAR98K',
};

export const WEAPON_STATS = {
  [CLASS_IDS.ASSAULT]: { rate: 0.12 }, // Assault
  [CLASS_IDS.MEDIC]: { rate: 0.15 },   // Medic
  [CLASS_IDS.SCOUT]: { rate: 1.5 },    // Scout (slow bolt-action)
} as const;
