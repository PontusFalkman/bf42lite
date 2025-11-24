// apps/client-tauri/src/managers/NetworkManager.ts

import { WebSocketAdapter, NetworkAdapter } from '@bf42lite/net';
import { ClientInput, ClientFire } from '@bf42lite/protocol';
import {
  SimWorld,
  addEntity,
  addComponent,
  removeEntity,
  Transform,
} from '@bf42lite/engine-core';
import {
  Health,
  Soldier,
  CapturePoint,
  Team,
  Loadout,
} from '@bf42lite/games-bf42';
import { Renderer } from '../core/Renderer';

interface InterpolationSnapshot {
  tick: number;
  pos: { x: number; y: number; z: number };
  rot: number;
  timestamp: number;
}

interface InterpolationBuffer {
  snapshots: InterpolationSnapshot[];
}

/**
 * Normalize flag snapshots coming from Rust/host into a uniform object form.
 * Supports both:
 *   - Array layout: [id, x, y, z, radius, ownerStr, capture]
 *   - Object layout: { id, pos: {x,y,z}, radius, owner, capture }
 */
function normalizeFlags(raw: any[] | undefined | null): any[] {
  const src = raw ?? [];
  return src.map((f: any) => {
    if (Array.isArray(f)) {
      const id = f[0];
      const x = f[1];
      const y = f[2];
      const z = f[3];
      const radius = f[4] ?? 0;
      const owner = f[5] ?? null;
      const capture = typeof f[6] === 'number' ? f[6] : 0;
      return { id, x, y, z, radius, owner, capture };
    } else {
      const pos = f.pos ?? {};
      const x = f.x ?? pos.x ?? 0;
      const y = f.y ?? pos.y ?? 0;
      const z = f.z ?? pos.z ?? 0;
      const radius = f.radius ?? f.r ?? 0;
      const owner = f.owner ?? null;
      const capture = typeof f.capture === 'number' ? f.capture : 0;
      return { id: f.id, x, y, z, radius, owner, capture };
    }
  });
}

export class NetworkManager {
  private net: NetworkAdapter;

  private myServerId = -1;
  private serverToLocal = new Map<number, number>();
  private flagEntityById = new Map<number, number>();

  private remoteBuffers = new Map<number, InterpolationBuffer>();
  private snapshotTick = 0;
  private hasLoggedSnapshot = false;

  public onConnected?: () => void;
  public onDisconnected?: () => void;
  public onWelcome?: (serverId: number) => void;
  public onSnapshot?: (msg: any) => void;
  public onHitConfirmed?: (damage: number) => void;

  constructor() {
    this.net = new WebSocketAdapter();

    this.net.onConnect(() => {
      console.log('[Net] WebSocket Connected');
      this.onConnected?.();
    });

    this.net.onDisconnect(() => {
      console.log('[Net] WebSocket Disconnected');
      this.onDisconnected?.();
    });

    this.net.onMessage((raw: any) => {
      console.log('[NET] Incoming message:', raw);

      // 1) Array-based messages (current Rust host)
      if (Array.isArray(raw)) {
        const arr = raw as any[];

        if (arr.length !== 2) {
          console.log('[NET] Unhandled array message (len != 2):', arr);
          return;
        }

        const [kindId, payload] = arr;
        console.log(
          '[NET] Decoding array message. kindId =',
          kindId,
          'payload =',
          payload,
        );

        // kindId === 1 => snapshot
        if (kindId === 1 && Array.isArray(payload)) {
          const [entitiesRaw, flagsRaw, gameStateRaw] = payload as [
            any[],
            any[],
            any,
          ];

          const flags = normalizeFlags(flagsRaw);

          const snap = {
            type: 'snapshot' as const,
            tick: ++this.snapshotTick,
            entities: entitiesRaw ?? [],
            flags,
            game_state: Array.isArray(gameStateRaw)
              ? {
                  team_a_tickets: gameStateRaw[0] ?? 0,
                  team_b_tickets: gameStateRaw[1] ?? 0,
                  match_ended: !!gameStateRaw[2],
                }
              : gameStateRaw,
          };

          console.log('[NET] Snapshot from array envelope:', snap);
          this.onSnapshot?.(snap);
          return;
        }

        console.log('[NET] Unhandled array message (unknown kindId):', arr);
        return;
      }

      // 2) Object-based messages (older / JSON style)
      const msg = raw as any;

      if (msg.type === 'welcome') {
        console.log(`[Net] Joined match. Server ID: ${msg.yourId}`);
        this.myServerId = msg.yourId;
        this.onWelcome?.(msg.yourId);
        return;
      }

      if (msg.type === 'snapshot') {
        this.onSnapshot?.(msg);
        return;
      }

      if (msg.type === 'hit-confirmed') {
        this.onHitConfirmed?.(msg.damage);
        return;
      }

      // Tauri Rust envelope: { your_id, snapshot: { ... } }
      if (msg.snapshot) {
        if (this.myServerId === -1 && typeof msg.your_id === 'number') {
          this.myServerId = msg.your_id;
          console.log(
            `[Net] Joined match. Server ID: ${this.myServerId}`,
          );
          this.onWelcome?.(this.myServerId);
        }

        this.snapshotTick++;

        if (!this.hasLoggedSnapshot) {
          console.log(
            '[NET] FULL SNAPSHOT (object envelope):',
            JSON.stringify(msg.snapshot),
          );
          console.log(
            '[NET] Snapshot keys:',
            Object.keys(msg.snapshot),
          );
          this.hasLoggedSnapshot = true;
        }

        const rawFlags = msg.snapshot.flags || msg.snapshot.flag_snapshots || [];
        const flags = normalizeFlags(rawFlags);

        const snap = {
          type: 'snapshot' as const,
          tick: this.snapshotTick,
          entities: msg.snapshot.entities ?? [],
          flags,
          game_state: msg.snapshot.game_state,
        };

        this.onSnapshot?.(snap);
        return;
      }

      console.log('[NET] Unhandled message from server (object):', msg);
    });
  }

  // Public API

  public connect(url: string) {
    this.net.connect(url);
  }

  public sendSpawnRequest(classId: number) {
    this.net.send({ type: 'spawn_request', classId });
  }

  public send(cmd: ClientInput) {
    this.net.send(cmd);
  }

  public sendFire(
    origin: { x: number; y: number; z: number },
    direction: { x: number; y: number; z: number },
    tick: number,
  ) {
    const msg: ClientFire = {
      type: 'fire',
      tick,
      origin,
      direction,
      weaponId: 1,
    };
    this.net.send(msg);
  }

  public registerLocalPlayer(serverId: number, localId: number) {
    this.serverToLocal.set(serverId, localId);
  }

  public getLocalId(serverId: number): number | undefined {
    return this.serverToLocal.get(serverId);
  }

  // Flags (Conquest)

  public processFlags(msg: any, world: SimWorld) {
    const flags = msg.flags ?? msg.flag_snapshots ?? [];
    if (!flags.length) return;

    for (const f of flags) {
      let id: number;
      let x: number;
      let y: number;
      let z: number;
      let ownerStr: string | null = null;
      let capture = 0;

      if (Array.isArray(f)) {
        // Server layout: [id, x, y, z, radius, ownerStr, capture]
        id = f[0];
        x = f[1];
        y = f[2];
        z = f[3];
        ownerStr = (f[5] as string) ?? null;
        capture = typeof f[6] === 'number' ? f[6] : 0;
      } else {
        // Object layout (either raw or normalized)
        id = f.id;
        if (f.pos) {
          x = f.pos.x ?? 0;
          y = f.pos.y ?? 0;
          z = f.pos.z ?? 0;
        } else {
          x = f.x ?? 0;
          y = f.y ?? 0;
          z = f.z ?? 0;
        }
        ownerStr = (f.owner as string) ?? null;
        capture = typeof f.capture === 'number' ? f.capture : 0;
      }

      if (typeof id !== 'number') {
        console.warn('[NET] Flag snapshot without valid id:', f);
        continue;
      }

      let eid = this.flagEntityById.get(id);
      if (eid === undefined) {
        eid = addEntity(world);
        addComponent(world, Transform, eid);
        addComponent(world, CapturePoint, eid);
        addComponent(world, Team, eid);

        this.flagEntityById.set(id, eid);
        console.log('[NET] Spawning Flag ID:', id, 'at', x, y, z);
      }

      Transform.x[eid] = x;
      Transform.y[eid] = y;
      Transform.z[eid] = z;

      CapturePoint.progress[eid] = capture;

      let teamId = 0;
      switch (ownerStr) {
        case 'Axis':
        case 'TeamA':
        case 'Team A':
          teamId = 1;
          break;
        case 'Allies':
        case 'TeamB':
        case 'Team B':
          teamId = 2;
          break;
        default:
          teamId = 0; // neutral / none
          break;
      }
      Team.id[eid] = teamId;
    }
  }

  // Remote entities / players

  public processRemoteEntities(msg: any, world: SimWorld, renderer: Renderer) {
    const activeServerIds = new Set<number>();
    const now = performance.now();
    const entities = msg.entities || [];

    entities.forEach((serverEnt: any) => {
      const sId = serverEnt.id;
      if (typeof sId !== 'number') return;

      activeServerIds.add(sId);

      let localId = this.serverToLocal.get(sId);
      if (localId === undefined) {
        localId = addEntity(world);
        addComponent(world, Transform, localId);
        addComponent(world, Soldier, localId);
        addComponent(world, Health, localId);
        addComponent(world, Team, localId);
        addComponent(world, Loadout, localId);

        this.serverToLocal.set(sId, localId);
        this.remoteBuffers.set(localId, { snapshots: [] });

        console.log('[NET] Created local entity for server id', sId);
      }

      const pos = serverEnt.pos ?? serverEnt.position ?? {
        x: 0,
        y: 0,
        z: 0,
      };
      const rot = serverEnt.rot ?? serverEnt.rotation ?? 0;

      const buffer = this.remoteBuffers.get(localId)!;
      buffer.snapshots.push({
        tick: msg.tick ?? 0,
        pos: { x: pos.x, y: pos.y, z: pos.z },
        rot,
        timestamp: now,
      });
      if (buffer.snapshots.length > 20) buffer.snapshots.shift();

      if (serverEnt.health) {
        Health.current[localId] = serverEnt.health.current ?? 0;
        Health.isDead[localId] = serverEnt.is_dead ? 1 : 0;
      }

      if (serverEnt.team) {
        let t = 0;
        if (serverEnt.team.id === 'TeamA') t = 1;
        if (serverEnt.team.id === 'TeamB') t = 2;
        Team.id[localId] = t;
      }

      // Sync loadout (single classId field)
      if (serverEnt.loadout) {
        const classId = serverEnt.loadout.classId ?? 0;
        Loadout.classId[localId] = classId;
      }
    });

    // Despawn entities that disappeared from the snapshot
    for (const [sId, lId] of this.serverToLocal.entries()) {
      if (!activeServerIds.has(sId)) {
        console.log('[NET] Despawning entity for server id', sId);
        removeEntity(world, lId);
        this.serverToLocal.delete(sId);
        this.remoteBuffers.delete(lId);
        renderer.removeEntity(lId);
      }
    }
  }

  public interpolateRemotePlayers(renderTime: number) {
    for (const [lid, buffer] of this.remoteBuffers) {
      if (buffer.snapshots.length < 2) continue;

      let t0 = buffer.snapshots[0];
      let t1 = buffer.snapshots[buffer.snapshots.length - 1];

      for (let i = 0; i < buffer.snapshots.length - 1; i++) {
        const a = buffer.snapshots[i];
        const b = buffer.snapshots[i + 1];
        if (a.timestamp <= renderTime && b.timestamp >= renderTime) {
          t0 = a;
          t1 = b;
          break;
        }
      }

      const total = t1.timestamp - t0.timestamp;
      const alpha = total > 0 ? (renderTime - t0.timestamp) / total : 0;
      const clamped = Math.max(0, Math.min(1, alpha));

      Transform.x[lid] = t0.pos.x + (t1.pos.x - t0.pos.x) * clamped;
      Transform.y[lid] = t0.pos.y + (t1.pos.y - t0.pos.y) * clamped;
      Transform.z[lid] = t0.pos.z + (t1.pos.z - t0.pos.z) * clamped;
      Transform.rotation[lid] =
        t0.rot + (t1.rot - t0.rot) * clamped;
    }
  }
}
