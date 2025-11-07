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
    fire: z.boolean(), // --- G2: ADD THIS ---
    // --- C2: Add rotation ---
    yaw: z.number(),
    pitch: z.number(),
  }),
});
export type InputMsg = z.infer<typeof InputMsgSchema>;

// --- G3: ADD RESPAWN MESSAGE ---
/**
 * Client -> Host
 * Player requests to spawn/respawn.
 */
export const RespawnMsgSchema = z.object({
  type: z.literal("respawn"),
});
export type RespawnMsg = z.infer<typeof RespawnMsgSchema>;
// --- END G3 ---

/**
 * Host -> Client
 * A snapshot of a single entity's state.
 */
export const EntitySnapshotSchema = z.object({
  id: z.number(), // Entity ID
  x: z.number(),  // Transform.x
  y: z.number(),  // Transform.y
  z: z.number(),  // Transform.z
  hp: z.number(),
  // --- C2: Add rotation ---
  yaw: z.number(),
  pitch: z.number(),
});
export type EntitySnapshot = z.infer<typeof EntitySnapshotSchema>;

/**
 * Host -> Client
 * Sent once on join, tells the client its entity ID and starting state.
 */
export const JoinMsgSchema = z.object({
  type: z.literal("join"),
  tick: z.number(), // The server tick when the player joined
  eid: z.number(),  // The client's player entity ID
  x: z.number(),
  y: z.number(),
  z: z.number(),
  hp: z.number(),
  // --- C2: Add rotation ---
  yaw: z.number(),
  pitch: z.number(),
});
export type JoinMsg = z.infer<typeof JoinMsgSchema>;

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