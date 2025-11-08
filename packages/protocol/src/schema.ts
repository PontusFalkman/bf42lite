// packages/protocol/src/schema.ts
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
    sprint: z.boolean(), // <-- ADD THIS
    useGadget: z.boolean(), // <-- ADD THIS
    useMedBox: z.boolean(), // <-- ADD THIS (FOR MED BOX)
    useRepairTool: z.boolean(), // <-- ADD THIS (FOR REPAIR TOOL)
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
  // --- G4: ADD SCORING ---
  teamId: z.number().optional(),
  kills: z.number().optional(),
  deaths: z.number().optional(),
  // --- END G4 ---
  stamina: z.number().optional(), // <-- ADD THIS
  // --- X2: ADD GADGET/AMMO STATE ---
  ammoCurrent: z.number().optional(),
  ammoReserve: z.number().optional(),
  gadgetCooldown: z.number().optional(),
  isAmmoBox: z.boolean().optional(),
  // --- END X2 ---
  // --- ADD MED BOX STATE ---
  medGadgetCooldown: z.number().optional(),
  isMedBox: z.boolean().optional(),
  // --- END MED BOX STATE ---
  // --- ADD REPAIR TOOL STATE ---
  repairToolHeat: z.number().optional(),
  // --- END REPAIR TOOL STATE ---
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
  // --- G4: ADD TEAM & STATS ON JOIN ---
  teamId: z.number(),
  kills: z.number(),
  deaths: z.number(),
  // --- END G4 ---
  stamina: z.number(), // <-- ADD THIS
  // --- X2: ADD GADGET/AMMO ON JOIN ---
  ammoCurrent: z.number(),
  ammoReserve: z.number(),
  gadgetCooldown: z.number(),
  // --- END X2 ---
  // --- ADD MED BOX ON JOIN ---
  medGadgetCooldown: z.number(),
  // --- END MED BOX ON JOIN ---
  // --- ADD REPAIR TOOL ON JOIN ---
  repairToolHeat: z.number(),
  // --- END REPAIR TOOL ON JOIN ---
});
export type JoinMsg = z.infer<typeof JoinMsgSchema>;

// --- G4: ADD GAME STATE SCHEMA ---
export const GameStateSchema = z.object({
  phase: z.number(),
  team1Tickets: z.number(),
  team2Tickets: z.number(),
});
export type GameState = z.infer<typeof GameStateSchema>;
// --- END G4 ---

/**
 * Host -> Client
 * World snapshot delta.
 */
export const StateMsgSchema = z.object({
  type: z.literal("state"),
  tick: z.number(),
  entities: z.array(EntitySnapshotSchema),
  // --- G4: ADD GAME STATE ---
  gameState: GameStateSchema.optional(),
  // --- END G4 ---
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

// Discriminated union for all C->H messages
export const ClientMsgSchema = z.union([InputMsgSchema, RespawnMsgSchema]);
export type ClientMsg = z.infer<typeof ClientMsgSchema>;

// Discriminated union for all H->C messages
export const ServerMsgSchema = z.union([
  JoinMsgSchema,
  StateMsgSchema,
  EventMsgSchema,
]);
export type ServerMsg = z.infer<typeof ServerMsgSchema>;