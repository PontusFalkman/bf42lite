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
    reload: z.boolean(),
    yaw: z.number(),
    pitch: z.number()
  }),
  rttTimestamp: z.number() // <-- ADD THIS LINE
});

// Fire Proposal
export const ClientFireSchema = z.object({
  type: z.literal('fire'),
  tick: z.number(),
  origin: z.object({ x: z.number(), y: z.number(), z: z.number() }),
  direction: z.object({ x: z.number(), y: z.number(), z: z.number() }),
  weaponId: z.number().default(1)
});

export const SpawnRequestSchema = z.object({
  type: z.literal('spawn_request'),
  classId: z.number()
});
export const JoinRequestSchema = z.object({
  type: z.literal('join'),
  name: z.string()
});

export const ClientMessageSchema = z.union([
  ClientInputSchema,
  ClientFireSchema,
  JoinRequestSchema,
  SpawnRequestSchema
]);

// --- 2. SERVER -> CLIENT ---

export const EntityStateSchema = z.object({
  id: z.number(),
  pos: z.object({ x: z.number(), y: z.number(), z: z.number() }),
  vel: z.object({ x: z.number(), y: z.number(), z: z.number() }),
  rot: z.number(),
  health: z.number(),
  isDead: z.boolean(),
  respawnTimer: z.number().optional(),
  ammo: z.number().optional(),
  ammoRes: z.number().optional(),
  kills: z.number().optional(),
  deaths: z.number().optional(),
  lastProcessedTick: z.number().optional(),
  aura_charge_progress: z.number().optional(), // <-- ADDED .optional()
  is_healing_aura_active: z.boolean().optional(), // <-- ADDED .optional()
});

// Hit Confirmation
export const HitConfirmedSchema = z.object({
  type: z.literal('hitConfirmed'),
  shooterId: z.number(),
  targetId: z.number(),
  damage: z.number()
});

export const SnapshotSchema = z.object({
  type: z.literal('snapshot'),
  tick: z.number(),
  game: z.object({
    ticketsAxis: z.number(),
    ticketsAllies: z.number(),
    state: z.number()
  }),
  entities: z.array(EntityStateSchema)
});

export const WelcomeSchema = z.object({
  type: z.literal('welcome'),
  playerId: z.number(),
  tick: z.number()
});

export const ServerMessageSchema = z.union([
  SnapshotSchema,
  WelcomeSchema,
  HitConfirmedSchema
]);

export type ClientInput = z.infer<typeof ClientInputSchema>;
export type ClientFire = z.infer<typeof ClientFireSchema>;
export type Snapshot = z.infer<typeof SnapshotSchema>;
export type EntityState = z.infer<typeof EntityStateSchema>;
export type ServerMessage = z.infer<typeof ServerMessageSchema>;
export type ClientMessage = z.infer<typeof ClientMessageSchema>;
export type SpawnRequest = z.infer<typeof SpawnRequestSchema>;