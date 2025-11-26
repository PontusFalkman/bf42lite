// apps/client-tauri/src/systems/syncLocalPlayer.ts

import { Transform, type SimWorld } from '@bf42lite/engine-core';
import {
  Health,
  Team,
  Loadout,
} from '@bf42lite/games-bf42';

import type { Snapshot } from '@bf42lite/protocol';
import type { NetworkManager } from '../managers/NetworkManager';
import type { HUDUpdater } from '../ui/HUDUpdater';
import type { Reconciler } from './Reconciler';

import { TEAM_IDS, WEAPON_NAMES } from '../core/constants';

/**
 * Synchronize the local player ECS state + UI from a server Snapshot.
 *
 * Returns the updated last RTT (or the previous one if unchanged).
 */
export function syncLocalPlayerFromSnapshot(
  msg: Snapshot,
  world: SimWorld,
  localEntityId: number,
  net: NetworkManager,
  hud: HUDUpdater,
  reconciler: Reconciler,
  movementSystem: (world: SimWorld) => void,
  lastRtt: number,
): number {
  if (localEntityId < 0) {
    return lastRtt;
  }

  const myServerEntity = msg.entities?.find(
    (e: any) => net.getLocalId(e.id) === localEntityId,
  );

  if (!myServerEntity) {
    return lastRtt;
  }

  const wasDead = Health.isDead[localEntityId] === 1;
  const isNowDead = !!myServerEntity.isDead;

  // Teleport on respawn to avoid smoothing artifacts
  if (wasDead && !isNowDead && myServerEntity.pos) {
    reconciler.clearHistory();
    Transform.x[localEntityId] = myServerEntity.pos.x;
    Transform.y[localEntityId] = myServerEntity.pos.y;
    Transform.z[localEntityId] = myServerEntity.pos.z;
  }

  // Health + death state (protocol sends health as a number)
  const hp =
    typeof myServerEntity.health === 'number'
      ? myServerEntity.health
      : 100;

  Health.current[localEntityId] = hp;
  Health.isDead[localEntityId] = isNowDead ? 1 : 0;

  // HUD: respawn timer
  hud.updateRespawn(isNowDead, myServerEntity.respawnTimer || 0);

  // Team mapping (Rust TeamId → numeric ECS team)
  if (myServerEntity.team) {
    const protoId = myServerEntity.team.id;
    if (protoId === 'TeamA') {
      Team.id[localEntityId] = TEAM_IDS.AXIS;
    } else if (protoId === 'TeamB') {
      Team.id[localEntityId] = TEAM_IDS.ALLIES;
    } else {
      Team.id[localEntityId] = TEAM_IDS.NONE;
    }
  }

  // Loadout / class
  if (myServerEntity.loadout) {
    Loadout.classId[localEntityId] =
      myServerEntity.loadout.classId ?? 0;
  }

  // Ammo + weapon UI
  const myClassId = Loadout.classId[localEntityId] || 0;
  const weaponName = WEAPON_NAMES[myClassId] ?? 'THOMPSON';

  if (myServerEntity.ammo) {
    hud.updateAmmo(
      myServerEntity.ammo.current,
      myServerEntity.ammo.reserve,
      weaponName,
    );
  }

  // RTT (if provided by snapshot/game_state)
  const gs: any = msg.game_state;
  if (typeof gs?.rtt_ms === 'number') {
    lastRtt = gs.rtt_ms;
  }

  return lastRtt;
}
