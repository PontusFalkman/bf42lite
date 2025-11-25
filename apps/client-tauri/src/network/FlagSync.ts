// apps/client-tauri/src/network/FlagSync.ts

import {
  Transform,
  addComponent,
  addEntity,
} from '@bf42lite/engine-core';

import {
  CapturePoint,
} from '@bf42lite/games-bf42';

import type { Snapshot } from '@bf42lite/protocol';

export class FlagSync {
  private static flagMap = new Map<number, number>();

  private static ensureFlag(world: any, id: number): number {
    if (!FlagSync.flagMap.has(id)) {
      const eid = addEntity(world);
      addComponent(world, CapturePoint, eid);
      addComponent(world, Transform, eid);
      FlagSync.flagMap.set(id, eid);
      return eid;
    }

    // non-null assertion is safe here because we just checked
    return FlagSync.flagMap.get(id)!;
  }

  static apply(snapshot: Snapshot, world: any) {
    if (!snapshot.flags) return;

    for (const f of snapshot.flags) {
      const eid = this.ensureFlag(world, f.id);

      Transform.x[eid] = f.x;
      Transform.y[eid] = f.y;
      Transform.z[eid] = f.z;

      CapturePoint.radius[eid] = f.radius ?? 8;
      CapturePoint.owner[eid] =
        f.owner === 'TeamA' ? 1 :
        f.owner === 'TeamB' ? 2 : 0;
      CapturePoint.capture[eid] = f.capture ?? 0;
    }
  }
}
