// apps/client-tauri/src/systems/RemoteEntitiesSystem.ts
//
// System for synchronizing *remote* entities from server Snapshots into ECS.
//
// Responsibilities:
// - Ensure a local ECS entity exists for each remote server entity id.
// - Update Transform / components from snapshot data.
// - Push interpolation samples for remote smoothing.
// - Does NOT touch HUD; local-player HUD is handled elsewhere.

import {
  Transform,
  Velocity,
  addComponent,
  addEntity,
  type SimWorld,
} from '@bf42lite/engine-core';

import {
  Health,
  Ammo,
  Soldier,
  Team,
  Loadout,
} from '@bf42lite/games-bf42';

import type { Snapshot } from '@bf42lite/protocol';
import type { NetworkManager } from '../managers/NetworkManager';
import type { Renderer } from '../core/Renderer';
import type { Reconciler } from './Reconciler';

// We will migrate this later; for now we still reuse the old helper.
import { pushInterpolationSnapshot } from './interpolationHelpers';

export class RemoteEntitiesSystem {
  private static ensureEntity(
    world: SimWorld,
    net: NetworkManager,
    renderer: Renderer,
    serverId: number,
  ): number {
    const existing = net.getLocalId(serverId);
    if (existing !== undefined) return existing;

    const eid = addEntity(world);

    addComponent(world, Transform, eid);
    addComponent(world, Velocity, eid);
    addComponent(world, Soldier, eid);
    addComponent(world, Health, eid);
    addComponent(world, Ammo, eid);
    addComponent(world, Team, eid);
    addComponent(world, Loadout, eid);

    net.registerEntity(serverId, eid);
    if (renderer.onEntityCreated) {
      renderer.onEntityCreated(eid);
    }

    return eid;
  }

  public static apply(
    snapshot: Snapshot,
    world: SimWorld,
    renderer: Renderer,
    net: NetworkManager,
    reconciler: Reconciler,
    nowTs: number,
  ): void {
    if (!snapshot.entities) return;

    for (const ent of snapshot.entities) {
      const serverId = ent.id;
      if (serverId == null) continue;

      const eid = this.ensureEntity(world, net, renderer, serverId);

      // Transform / rotation
      if (ent.pos) {
        const { x, y, z } = ent.pos;
        Transform.x[eid] = x;
        Transform.y[eid] = y;
        Transform.z[eid] = z;

        if (typeof ent.rot === 'number') {
          Transform.rotation[eid] = ent.rot;
        }

        // Interpolation history
        pushInterpolationSnapshot(
          reconciler.remoteBuffers,
          eid,
          snapshot.tick,
          { x, y, z },
          ent.rot ?? 0,
          nowTs,
        );
      }

      // Health / death
      if (ent.health != null) {
        Health.current[eid] = ent.health;
        Health.isDead[eid] = ent.isDead ? 1 : 0;
      }

      // Team
      if (ent.team) {
        Team.id[eid] = ent.team.id === 'TeamA' ? 1 : 2;
      }

      // Loadout / class
      if (ent.loadout) {
        Loadout.classId[eid] = ent.loadout.classId ?? 0;
      }

      // Ammo
      if (ent.ammo) {
        Ammo.current[eid] = ent.ammo.current ?? 0;
        Ammo.reserve[eid] = ent.ammo.reserve ?? 0;
      }

      if (renderer.onEntityUpdated) {
        renderer.onEntityUpdated(eid);
      }
    }
  }
}
