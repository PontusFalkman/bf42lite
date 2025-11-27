// apps/client-tauri/src/systems/Reconciler.ts

import { Transform, Velocity, SimWorld } from '@bf42lite/engine-core';
import { ClientInput, EntityState } from '@bf42lite/protocol';
import type { InterpolationBuffer } from '../net/types';
import { log } from '../utils/log';

export interface InputHistory {
  tick: number;
  input: ClientInput;
  pos: { x: number; y: number; z: number };
  timestamp: number;
}

/**
 * Client-side reconciler for predicted movement.
 * Stores a small history of client inputs and positions and compares them
 * to authoritative server snapshots to correct drift.
 */
export class Reconciler {
  private history: InputHistory[] = [];

  // Interpolation buffers for remote entities (used by interpolation.ts)
  public remoteBuffers: Map<number, InterpolationBuffer> = new Map();

  // Normal correction threshold (≈1m).
  private readonly ERROR_THRESHOLD_SQ = 1.0;

  // Teleport/spawn threshold (≈10m).
  private readonly TELEPORT_THRESHOLD_SQ = 100.0;

  /**
   * Record the current predicted state.
   *
   * Call this once per local simulation step, after applying inputs.
   */
  public pushHistory(
    tick: number,
    input: ClientInput,
    x: number,
    y: number,
    z: number,
  ) {
    this.history.push({
      tick,
      input,
      pos: { x, y, z },
      timestamp: performance.now(),
    });
  }

  public clearHistory() {
    this.history.length = 0;
  }

  /**
   * Compare a server snapshot to the local history and correct if needed.
   *
   * Returns an RTT estimate in milliseconds based on the stored timestamp,
   * or 0 if no matching history was found.
   */
  public reconcile(
    serverTick: number,
    serverState: EntityState,
    eid: number,
    world: SimWorld,
    movementSystem: (w: SimWorld) => void,
  ): number {
    if (!serverState.pos || this.history.length === 0) {
      return 0;
    }

    // 1. Prefer exact history match for this tick.
    let historyIndex = this.history.findIndex(
      (h) => h.tick === serverTick,
    );

    // 2. If no exact match, fall back to closest tick we have.
    if (historyIndex === -1) {
      log.warn('RECON', 'No history for server tick', {
        serverTick,
        historySize: this.history.length,
      });

      let closestIndex = -1;
      let closestDiff = Number.POSITIVE_INFINITY;

      for (let i = 0; i < this.history.length; i++) {
        const diff = Math.abs(this.history[i].tick - serverTick);
        if (diff < closestDiff) {
          closestDiff = diff;
          closestIndex = i;
        }
      }

      if (closestIndex === -1) {
        return 0;
      }

      historyIndex = closestIndex;

      const picked = this.history[historyIndex];
      log.debug('RECON', 'Using closest history tick', {
        serverTick,
        pickedTick: picked.tick,
        delta: closestDiff,
      });
    }

    const historyState = this.history[historyIndex];

    // RTT is time since we originally simulated that tick.
    const rtt = Math.round(
      performance.now() - historyState.timestamp,
    );

    // 3. Compute spatial error between predicted and authoritative positions.
    const dx = historyState.pos.x - serverState.pos.x;
    const dy = historyState.pos.y - serverState.pos.y;
    const dz = historyState.pos.z - serverState.pos.z;
    const distSq = dx * dx + dy * dy + dz * dz;

    // 4. Teleport: error is massive, probably a respawn or big correction.
    if (distSq > this.TELEPORT_THRESHOLD_SQ) {
      log.warn('RECON', 'Teleport correction', {
        serverTick,
        eid,
        distSq: Number(distSq.toFixed(2)),
      });

      Transform.x[eid] = serverState.pos.x;
      Transform.y[eid] = serverState.pos.y;
      Transform.z[eid] = serverState.pos.z;

      if (serverState.vel) {
        Velocity.x[eid] = serverState.vel.x;
        Velocity.y[eid] = serverState.vel.y;
        Velocity.z[eid] = serverState.vel.z;
      }

      this.clearHistory();
      return rtt;
    }

    // 5. Normal correction: small but noticeable mismatch.
    if (distSq > this.ERROR_THRESHOLD_SQ) {
      log.warn('RECON', 'Soft correction', {
        serverTick,
        eid,
        distSq: Number(distSq.toFixed(2)),
        clientPos: {
          x: Number(historyState.pos.x.toFixed(2)),
          y: Number(historyState.pos.y.toFixed(2)),
          z: Number(historyState.pos.z.toFixed(2)),
        },
        serverPos: {
          x: Number(serverState.pos.x.toFixed(2)),
          y: Number(serverState.pos.y.toFixed(2)),
          z: Number(serverState.pos.z.toFixed(2)),
        },
      });

      // For now we fully trust the server.
      Transform.x[eid] = serverState.pos.x;
      Transform.y[eid] = serverState.pos.y;
      Transform.z[eid] = serverState.pos.z;

      if (serverState.vel) {
        Velocity.x[eid] = serverState.vel.x;
        Velocity.y[eid] = serverState.vel.y;
        Velocity.z[eid] = serverState.vel.z;
      }

      // Drop history up to and including the corrected tick.
      this.history.splice(0, historyIndex + 1);
      return rtt;
    }

    // 6. No correction needed: server and client agree closely enough.
    this.history.splice(0, historyIndex + 1);

    log.trace('RECON', 'No correction needed', {
      serverTick,
      eid,
      distSq: Number(distSq.toFixed(3)),
    });

    return rtt;
  }
}
