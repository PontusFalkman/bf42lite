import { z } from 'zod';

// --- 1. CLIENT -> SERVER ---

export const ClientInputSchema = z.object({
  type: z.literal('input'),
  tick: z.number(),
  axes: z.object({
    forward: z.number(),
    right: z.number(),
    jump: z.boolean(),
    shoot: z.boolean(),
    reload: z.boolean(), // <--- ADDED
    yaw: z.number(),
    pitch: z.number(),
  }),
});

export const ClientFireSchema = z.object({
  type: z.literal('fire'),
  tick: z.number(),
  origin: z.object({ x: z.number(), y: z.number(), z: z.number() }),
  direction: z.object({ x: z.number(), y: z.number(), z: z.number() }),
  weaponId: z.number(),
});

export const SpawnRequestSchema = z.object({
  type: z.literal('spawn_request'),
  classId: z.number(), // or z.enum([...]) if you have specific classes
});

export const ClientMessageSchema = z.union([
  ClientInputSchema,
  ClientFireSchema,
  SpawnRequestSchema,
]);

// --- 2. SERVER -> CLIENT BASE TYPES ---

export const EntityStateSchema = z
  .object({
    id: z.number(),
    pos: z.object({ x: z.number(), y: z.number(), z: z.number() }),
    vel: z
      .object({ x: z.number(), y: z.number(), z: z.number() })
      .optional(),
    rot: z.number(),
    health: z.number(),
    isDead: z.boolean(),

    loadout: z
      .object({
        classId: z.number(),
      })
      .optional(),

    ammo: z
      .object({
        current: z.number(),
        reserve: z.number(),
      })
      .optional(),
  })
  // still allow extra fields for future extensions
  .catchall(z.any());

// Simple “v1” game-info block used by the old Node host.
export const GameInfoSchema = z.object({
  ticketsAxis: z.number(),
  ticketsAllies: z.number(),
  state: z.number(), // 0 = running, 1 = game over
});

// --- 3. CONQUEST / GAMEMODE STATE (RUST HOST) ---

export const GameModeStateSchema = z.object({
  team_a_tickets: z.number(),
  team_b_tickets: z.number(),
  match_ended: z.boolean(),
  winner: z.any(), // keep loose (enum/string/number)
});

export const FlagSnapshotSchema = z.object({
  id: z.number(),
  x: z.number(),
  y: z.number(),
  z: z.number(),
  radius: z.number(),
  owner: z.any(),   // same: can be enum/string/number
  capture: z.number(),
});

// --- 4. SNAPSHOT (UNION OF OLD + NEW FIELDS) ---

export const SnapshotSchema = z.object({
  type: z.literal('snapshot'),
  tick: z.number(),

  entities: z.array(EntityStateSchema),

  // Old Node-host block – optional so Rust host does not have to send it
  game: GameInfoSchema.optional(),

  // New Rust-host game-mode state
  game_state: GameModeStateSchema.optional(),

  // New Rust-host conquest flags
  flags: z.array(FlagSnapshotSchema).optional().default([]),
});

// --- 5. OTHER SERVER → CLIENT MESSAGES ---

export const WelcomeSchema = z.object({
  type: z.literal('welcome'),
  yourId: z.number(),
});

export const HitConfirmedSchema = z.object({
  type: z.literal('hit-confirmed'),
  targetId: z.number(),
  damage: z.number(),
});

// --- 6. MESSAGE UNION + TS TYPES ---

export const ServerMessageSchema = z.union([
  SnapshotSchema,
  WelcomeSchema,
  HitConfirmedSchema,
]);

export type ClientInput = z.infer<typeof ClientInputSchema>;
export type ClientFire = z.infer<typeof ClientFireSchema>;
export type Snapshot = z.infer<typeof SnapshotSchema>;
export type EntityState = z.infer<typeof EntityStateSchema>;
export type ServerMessage = z.infer<typeof ServerMessageSchema>;
export type ClientMessage = z.infer<typeof ClientMessageSchema>;
export type SpawnRequest = z.infer<typeof SpawnRequestSchema>;
