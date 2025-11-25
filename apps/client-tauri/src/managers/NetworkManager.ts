// apps/client-tauri/src/managers/NetworkManager.ts

import { WebSocketAdapter, type NetworkAdapter } from '@bf42lite/net';
import type {
  ClientInput,
  ClientFire,
  ClientMessage,
  Snapshot,
} from '@bf42lite/protocol';
import type { SimWorld } from '@bf42lite/engine-core';
import { log } from '../utils/log';

import type { Renderer } from '../core/Renderer';
import type { Reconciler } from '../systems/Reconciler';

import { decodeServerMessage } from '../network/SnapshotDecoder';
import { RemoteEntitySync } from '../network/RemoteEntitySync';
import { FlagSync } from '../network/FlagSync';
import { interpolateRemotePlayers as interpRemote } from '../network/interpolation';

// Local wire type for spawn request – must match Rust/zod schema
type SpawnRequestWire = {
  type: 'spawn_request';
  classId: number;
};

export class NetworkManager {
  // --- Callbacks exposed to ClientGame / UI ---

  onConnected: () => void = () => {};
  onDisconnected: () => void = () => {};
  onWelcome: (serverId: number) => void = () => {};
  onSnapshot: (snap: Snapshot) => void = () => {};
  onHitConfirmed: (damage: number) => void = () => {};

  // --- Internal state ---

  private net: NetworkAdapter;
  private world: SimWorld;
  private renderer: Renderer;
  private reconciler: Reconciler;

  private myServerId = -1;
  private serverToLocal = new Map<number, number>();

  // Monotonic counter used by decodeServerMessage (for timestamps/ticks)
  private nextTick = 0;

  constructor(world: SimWorld, renderer: Renderer, reconciler: Reconciler) {
    this.world = world;
    this.renderer = renderer;
    this.reconciler = reconciler;

    this.net = new WebSocketAdapter();

    this.net.onConnect(() => {
      log.info('NET', 'Connected');
      this.onConnected();
    });

    this.net.onDisconnect(() => {
      log.warn('NET', 'Disconnected');
      this.onDisconnected();
    });

    this.net.onMessage((raw) => this.handleMessage(raw));
  }

  // --- Connection ---

  connect(url: string): void {
    this.net.connect(url);
  }

  // --- Incoming messages ---

  private handleMessage(raw: unknown): void {
    const decoded = decodeServerMessage(raw, this.nextTick++);
    const nowTs = performance.now();

    switch (decoded.type) {
      case 'welcome': {
        this.myServerId = decoded.yourId;
        log.info('NET', 'Welcome', { serverId: this.myServerId });
        this.onWelcome(this.myServerId);
        return;
      }

      case 'hit-confirmed': {
        log.debug('NET', 'Hit confirmed', { dmg: decoded.damage });
        this.onHitConfirmed(decoded.damage);
        return;
      }

      case 'snapshot': {
        const snapshot = decoded.snapshot;

        // Remote entities (ECS + interpolation buffers)
        RemoteEntitySync.apply(
          snapshot,
          this.world,
          this.renderer,
          this,
          this.reconciler,
          nowTs,
        );

        // Conquest / flags ECS state
        FlagSync.apply(snapshot, this.world);

        // Forward to ClientGame (sync local player, UI, etc.)
        this.onSnapshot(snapshot);

        return;
      }

      case 'unknown':
      default: {
        // Keep in console for debugging – raw is preserved
        console.warn('[NET] Unhandled server message:', decoded.raw);
        return;
      }
    }
  }

  // --- Entity registry (server ↔ local ECS ids) ---

  registerEntity(serverId: number, localId: number): void {
    this.serverToLocal.set(serverId, localId);
  }

  getLocalId(serverId: number): number | undefined {
    return this.serverToLocal.get(serverId);
  }

  // --- Outgoing: input / fire / spawn ---

  /** Alias kept for existing code: client uses `net.send(cmd)` */
  send(cmd: ClientInput): void {
    this.sendInput(cmd);
  }

  sendInput(cmd: ClientInput): void {
    this.net.send(cmd);
  }

  sendFire(
    origin: { x: number; y: number; z: number },
    direction: { x: number; y: number; z: number },
    tick: number,
  ): void {
    const msg: ClientFire = {
      type: 'fire',
      tick,
      origin,
      direction,
      // Mirror of current WeaponSystem config – adjust when you add more weapons
      weaponId: 1,
    };
    this.net.send(msg);
  }

  sendSpawnRequest(classId: number): void {
    const msg: SpawnRequestWire = {
      type: 'spawn_request',
      classId,
    };
    this.net.send(msg as ClientMessage);
  }

  // --- Interpolation hook used by ClientGame / InterpolationSystem ---

  interpolateRemotePlayers(renderTimeMs: number): void {
    interpRemote(this.world, this.reconciler.remoteBuffers, renderTimeMs);
  }
}
