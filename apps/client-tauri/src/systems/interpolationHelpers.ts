// apps/client-tauri/src/systems/interpolationHelpers.ts

import {
  Transform,
  type SimWorld,
} from '@bf42lite/engine-core';

import type {
  InterpolationBuffer,
  InterpolationSnapshot,
} from '../net/types';

/**
 * Push a new interpolation snapshot into the buffer for a given entity.
 * Keeps history capped to `maxSnapshots`.
 */
export function pushInterpolationSnapshot(
  buffers: Map<number, InterpolationBuffer>,
  localId: number,
  tick: number,
  pos: { x: number; y: number; z: number },
  rot: number,
  timestamp: number,
  maxSnapshots = 20,
): void {
  let buffer = buffers.get(localId);
  if (!buffer) {
    buffer = { snapshots: [] };
    buffers.set(localId, buffer);
  }

  const snap: InterpolationSnapshot = {
    tick,
    pos: { x: pos.x, y: pos.y, z: pos.z },
    rot,
    timestamp,
  };

  buffer.snapshots.push(snap);
  if (buffer.snapshots.length > maxSnapshots) {
    buffer.snapshots.shift();
  }
}

/**
 * Simple time-based interpolation for remote player positions.
 *
 * `renderTimeMs` should be something like `performance.now() - INTERPOLATION_DELAY_MS`
 * to introduce a small delay and ensure you almost always have at least
 * two snapshots to interpolate between.
 */
export function interpolateRemotePlayers(
  world: SimWorld,
  buffers: Map<number, InterpolationBuffer>,
  renderTimeMs: number,
): void {
  for (const [eid, buffer] of buffers.entries()) {
    const snaps = buffer.snapshots;
    if (snaps.length < 2) continue;

    // Find the two snapshots that bracket renderTimeMs
    let prev: InterpolationSnapshot | undefined;
    let next: InterpolationSnapshot | undefined;

    for (let i = snaps.length - 1; i >= 0; i--) {
      const s = snaps[i];
      if (s.timestamp <= renderTimeMs) {
        prev = s;
        next = snaps[i + 1];
        break;
      }
    }

    // Fallback to last two if we didn't find a proper bracket
    if (!prev || !next) {
      prev = snaps[snaps.length - 2];
      next = snaps[snaps.length - 1];
    }

    if (!prev || !next) continue;

    const span = next.timestamp - prev.timestamp;
    const tRaw = span > 0 ? (renderTimeMs - prev.timestamp) / span : 0;
    const t = Math.max(0, Math.min(1, tRaw));

    const lerp = (a: number, b: number) => a + (b - a) * t;

    Transform.x[eid] = lerp(prev.pos.x, next.pos.x);
    Transform.y[eid] = lerp(prev.pos.y, next.pos.y);
    Transform.z[eid] = lerp(prev.pos.z, next.pos.z);
    Transform.rotation[eid] = lerp(prev.rot, next.rot);
  }

  // Currently no need to touch `world` fields; transform changes are enough.
}
