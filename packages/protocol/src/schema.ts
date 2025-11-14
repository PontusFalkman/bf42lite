import { z } from 'zod';

// 1. CLIENT -> SERVER
export const ClientInputSchema = z.object({
  type: z.literal('input'),
  tick: z.number(),
  axes: z.object({
    forward: z.number(),
    right: z.number(),
    jump: z.boolean(),
    shoot: z.boolean(),
    yaw: z.number(),
    pitch: z.number()
  })
});

export const JoinRequestSchema = z.object({
  type: z.literal('join'),
  name: z.string()
});

export const ClientMessageSchema = z.union([
  ClientInputSchema,
  JoinRequestSchema
]);

// 2. SERVER -> CLIENT
export const EntityStateSchema = z.object({
  id: z.number(),
  pos: z.object({ x: z.number(), y: z.number(), z: z.number() }),
  rot: z.number(),
  health: z.number(),
  isDead: z.boolean()
});

// --- UPDATED SNAPSHOT ---
export const SnapshotSchema = z.object({
  type: z.literal('snapshot'),
  tick: z.number(),
  // New Game State Block
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
  WelcomeSchema
]);

export type ClientInput = z.infer<typeof ClientInputSchema>;
export type Snapshot = z.infer<typeof SnapshotSchema>;
export type EntityState = z.infer<typeof EntityStateSchema>;
export type ServerMessage = z.infer<typeof ServerMessageSchema>;
export type ClientMessage = z.infer<typeof ClientMessageSchema>;