// apps/client-tauri/src/network/types.ts
import type { Snapshot, FlagSnapshot } from '@bf42lite/protocol';

// Normalized flag is already identical to the protocol FlagSnapshot.
// This alias is mainly for readability on the client side.
export type NormalizedFlag = FlagSnapshot;

// Interpolation types for remote entities
export interface InterpolationSnapshot {
  tick: number;
  pos: { x: number; y: number; z: number };
  rot: number;
  timestamp: number;
}

export interface InterpolationBuffer {
  snapshots: InterpolationSnapshot[];
}

// Decoded server messages after passing through the network decoder
export interface DecodedSnapshotMessage {
  type: 'snapshot';
  snapshot: Snapshot;
  yourId?: number;        // Present when coming from Rust envelope { your_id, snapshot }
}

export interface DecodedWelcomeMessage {
  type: 'welcome';
  yourId: number;
}

export interface DecodedHitMessage {
  type: 'hit-confirmed';
  damage: number;
}

export interface DecodedUnknownMessage {
  type: 'unknown';
  raw: any;
}

export type DecodedServerMessage =
  | DecodedSnapshotMessage
  | DecodedWelcomeMessage
  | DecodedHitMessage
  | DecodedUnknownMessage;
