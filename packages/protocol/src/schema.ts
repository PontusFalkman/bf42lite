import { z } from "zod";

// Protocol version for compatibility
export const PROTOCOL_VERSION = "1.2";

/**
 * Client -> Host
 * Player input per tick.
 */
export const InputMsgSchema = z.object({
  type: z.literal("input"),
  tick: z.number(),
  axes: z.object({
    forward: z.number(),
    right: z.number(),
    jump: z.boolean(),
  }),
});
export type InputMsg = z.infer<typeof InputMsgSchema>;

/**
 * Host -> Client
 * A snapshot of a single entity's state.
 */
export const EntitySnapshotSchema = z.object({
  id: z.number(), // Entity ID
  x: z.number(),  // Transform.x
  y: z.number(),  // Transform.y
  z: z.number(),  // Transform.z
});
export type EntitySnapshot = z.infer<typeof EntitySnapshotSchema>;

/**
 * Host -> Client
 * World snapshot delta.
 */
export const StateMsgSchema = z.object({
  type: z.literal("state"),
  tick: z.number(),
  entities: z.array(EntitySnapshotSchema),
});
export type StateMsg = z.infer<typeof StateMsgSchema>;

/**
 * Host -> Client
 * Discrete events (death, respawn, etc).
 */
export const EventMsgSchema = z.object({
  type: z.literal("event"),
  tick: z.number(),
  eventType: z.string(),
  payload: z.unknown(), // `zod` handles `unknown`
});
export type EventMsg = z.infer<typeof EventMsgSchema>;