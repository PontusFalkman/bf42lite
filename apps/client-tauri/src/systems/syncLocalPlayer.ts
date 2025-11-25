// apps/client-tauri/src/systems/syncLocalPlayer.ts

import {
    Transform,
  } from '@bf42lite/engine-core';
  import {
    Health,
    Team,
    Loadout,
  } from '@bf42lite/games-bf42';
  
  import type { Snapshot } from '@bf42lite/protocol';
  import type { NetworkManager } from '../managers/NetworkManager';
  import type { UIManager } from '../managers/UIManager';
  import type { Reconciler } from './Reconciler';
  
  import { TEAM_IDS, WEAPON_NAMES } from '../core/constants';
  
  /**
   * Synchronize the local player ECS state + UI from a server Snapshot.
   *
   * Returns the updated last RTT (or the previous one if unchanged).
   */
  export function syncLocalPlayerFromSnapshot(
    msg: Snapshot,
    simWorld: any,
    localEntityId: number,
    net: NetworkManager,
    ui: UIManager,
    reconciler: Reconciler,
    movementSystem: any,
    lastRtt: number,
  ): number {
    // Find the server entity that corresponds to our local ECS entity
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
    ui.updateRespawn(isNowDead, myServerEntity.respawnTimer || 0);
  
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
      ui.updateAmmo(
        myServerEntity.ammo.current,
        myServerEntity.ammo.reserve,
        weaponName,
      );
    }
  
    // Reconciliation (movement correction)
    let newLastRtt = lastRtt;
    if (myServerEntity.lastProcessedTick !== undefined) {
      const rtt = reconciler.reconcile(
        myServerEntity.lastProcessedTick,
        myServerEntity,
        localEntityId,
        simWorld,
        movementSystem,
      );
      if (rtt > 0) newLastRtt = rtt;
    }
  
    return newLastRtt;
  }
  