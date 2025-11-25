// apps/client-tauri/src/systems/FlagSystem.ts
//
// ECS-side management of Conquest flags on the client.
// - Ensures each server flag has a corresponding ECS entity.
// - Writes Transform + CapturePoint data from Snapshot.flags.
//
// This is functionally equivalent to the earlier FlagSync helper,
// but lives under /systems to match the modular client architecture.

import {
  Transform,
  addComponent,
  addEntity,
} from '@bf42lite/engine-core';

import { CapturePoint } from '@bf42lite/games-bf42';

import type { Snapshot } from '@bf42lite/protocol';

export class FlagSystem {
  // Map from protocol flag id → ECS entity id
  private static flagMap = new Map<number, number>();

  /**
   * Ensure that a flag ECS entity exists for the given protocol flag id.
   * If it does not exist yet, create it and register components.
   */
  private static ensureFlag(world: any, id: number): number {
    const existing = FlagSystem.flagMap.get(id);
    if (existing !== undefined) {
      return existing;
    }

    const eid = addEntity(world);
    addComponent(world, CapturePoint, eid);
    addComponent(world, Transform, eid);
    FlagSystem.flagMap.set(id, eid);
    return eid;
  }

  /**
   * Apply all flags from a Snapshot into the ECS world.
   *
   * - Positions: Transform.(x,y,z)
   * - Radius: CapturePoint.radius
   * - Owner team: CapturePoint.owner (1 = TeamA, 2 = TeamB, 0 = none)
   * - Capture progress: CapturePoint.capture (server-side value)
   */
  public static applySnapshotFlags(snapshot: Snapshot, world: any): void {
    if (!snapshot.flags || snapshot.flags.length === 0) return;

    for (const f of snapshot.flags) {
      const eid = FlagSystem.ensureFlag(world, f.id);

      // Position
      Transform.x[eid] = f.x;
      Transform.y[eid] = f.y;
      Transform.z[eid] = f.z;

      // Radius (fallback to 8 if not provided)
      CapturePoint.radius[eid] = f.radius ?? 8;

      // Owner mapping: server string → numeric ECS id
      CapturePoint.owner[eid] =
        f.owner === 'TeamA' ? 1 :
        f.owner === 'TeamB' ? 2 : 0;

      // Raw capture value from server (-1 → 1 or similar)
      CapturePoint.capture[eid] = f.capture ?? 0;
    }
  }

  /**
   * Optional: clear all known flags (e.g. when changing maps).
   * This only clears the mapping; caller is responsible for
   * actually removing ECS entities if desired.
   */
  public static reset(): void {
    FlagSystem.flagMap.clear();
  }
}
