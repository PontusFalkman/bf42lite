// apps/client-tauri/src/systems/InterpolationSystem.ts

import {
  Transform,
  Velocity,
} from '@bf42lite/engine-core';

import type { NetworkManager } from '../managers/NetworkManager';

/**
 * InterpolationSystem pulls historical remote-player snapshots stored
 * in NetworkManager and smooths them into predicted ECS Transform data.
 *
 * This isolates interpolation behavior from NetworkManager.
 */
export class InterpolationSystem {
  private readonly net: NetworkManager;

  constructor(net: NetworkManager) {
    this.net = net;
  }

  /**
   * Apply interpolation to all remote entities based on interpolationTimeMs.
   *
   * @param world                ECS world
   * @param interpolationTimeMs  Target timestamp to sample state from
   */
  public update(world: any, interpolationTimeMs: number): void {
    const remoteStates = this.net.getRemoteHistory(interpolationTimeMs);
    // Expected format: array of { eid, pos:{x,y,z}, rot, vx, vy, vz }

    for (const state of remoteStates) {
      const eid = state.eid;

      // Set position directly (remote players only)
      Transform.x[eid] = state.pos.x;
      Transform.y[eid] = state.pos.y;
      Transform.z[eid] = state.pos.z;

      // Rotation smoothing
      Transform.rotation[eid] = state.rot;

      // Optional velocity smoothing
      if (Velocity.x && Velocity.y && Velocity.z) {
        Velocity.x[eid] = state.vx ?? 0;
        Velocity.y[eid] = state.vy ?? 0;
        Velocity.z[eid] = state.vz ?? 0;
      }
    }
  }
}
