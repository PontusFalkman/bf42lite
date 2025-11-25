// apps/client-tauri/src/network/SnapshotDecoder.ts

import type {
    Snapshot,
    FlagSnapshot,
    GameModeState,
  } from '@bf42lite/protocol';
  import type {
    DecodedServerMessage,
  } from './types';
  
  /**
   * Normalize flag snapshots coming from Rust/host into uniform object form.
   * Supports both:
   *   - Array layout: [id, x, y, z, radius, ownerStr, capture]
   *   - Object layout: { id, pos: {x,y,z}, radius, owner, capture }
   */
  export function normalizeFlags(raw: any[] | undefined | null): FlagSnapshot[] {
    const src = raw ?? [];
  
    return src.map((f: any): FlagSnapshot => {
      if (Array.isArray(f)) {
        const id = f[0];
        const x = f[1];
        const y = f[2];
        const z = f[3];
        const radius = f[4] ?? 0;
        const owner = f[5] ?? null;
        const capture = typeof f[6] === 'number' ? f[6] : 0;
  
        return {
          id: id ?? 0,
          x: x ?? 0,
          y: y ?? 0,
          z: z ?? 0,
          radius,
          owner,
          capture,
        };
      }
  
      const pos = f.pos ?? {};
      const x = f.x ?? pos.x ?? 0;
      const y = f.y ?? pos.y ?? 0;
      const z = f.z ?? pos.z ?? 0;
      const radius = f.radius ?? f.r ?? 0;
      const owner = f.owner ?? null;
      const capture = typeof f.capture === 'number' ? f.capture : 0;
  
      return {
        id: f.id ?? 0,
        x,
        y,
        z,
        radius,
        owner,
        capture,
      };
    });
  }
  
  /**
   * Centralized decoder for all server → client messages.
   *
   * `nextTick` should be provided by the caller (NetworkManager) and is used
   * to assign a monotonically increasing tick to snapshots that do not
   * already have a tick number (array / Rust envelopes).
   */
  export function decodeServerMessage(
    raw: any,
    nextTick: number,
  ): DecodedServerMessage {
    // 1) Array-based messages (older/alternate host): [kindId, payload]
    if (Array.isArray(raw)) {
      const arr = raw as any[];
  
      if (arr.length === 2) {
        const [kindId, payload] = arr;
  
        // kindId === 1 => snapshot
        if (kindId === 1 && Array.isArray(payload)) {
          const [entitiesRaw, flagsRaw, gameStateRaw] = payload as [
            any[],
            any[],
            any,
          ];
  
          const flags = normalizeFlags(flagsRaw);
  
          const game_state: GameModeState | undefined = Array.isArray(
            gameStateRaw,
          )
            ? {
                team_a_tickets: gameStateRaw[0] ?? 0,
                team_b_tickets: gameStateRaw[1] ?? 0,
                match_ended: !!gameStateRaw[2],
                winner: null,
              }
            : gameStateRaw;
  
          const snapshot: Snapshot = {
            type: 'snapshot',
            tick: nextTick,
            entities: entitiesRaw ?? [],
            flags,
            game_state,
          };
  
          return { type: 'snapshot', snapshot };
        }
      }
  
      return { type: 'unknown', raw };
    }
  
    // 2) Object-style messages (current Rust host + legacy JSON)
    const msg = raw as any;
  
    // Explicit "welcome" style: { type: 'welcome', yourId }
    if (msg.type === 'welcome' && typeof msg.yourId === 'number') {
      return {
        type: 'welcome',
        yourId: msg.yourId,
      };
    }
  
    // Legacy JSON snapshot already matching the Snapshot interface
    if (msg.type === 'snapshot') {
      return {
        type: 'snapshot',
        snapshot: msg as Snapshot,
      };
    }
  
    // Hit confirm notification
    if (msg.type === 'hit-confirmed') {
      return {
        type: 'hit-confirmed',
        damage: msg.damage ?? 0,
      };
    }
  
    // Rust/Tauri envelope: { your_id, snapshot: { ... } }
    if (msg.snapshot) {
      const rawFlags =
        msg.snapshot.flags || msg.snapshot.flag_snapshots || [];
  
      const flags = normalizeFlags(rawFlags);
  
      const snapshot: Snapshot = {
        type: 'snapshot',
        tick: nextTick,
        entities: msg.snapshot.entities ?? [],
        flags,
        game_state: msg.snapshot.game_state,
        game: msg.snapshot.game, // keep for backward compatibility, if present
      };
  
      const decoded: any = {
        type: 'snapshot' as const,
        snapshot,
      };
  
      if (typeof msg.your_id === 'number') {
        decoded.yourId = msg.your_id;
      }
  
      return decoded;
    }
  
    // Fallback: unknown/unhandled message
    return {
      type: 'unknown',
      raw,
    };
  }
  