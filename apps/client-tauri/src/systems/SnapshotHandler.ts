// apps/client-tauri/src/systems/SnapshotHandler.ts
//
// Unified handler for processing server snapshots.
// This wraps handleSnapshot(...) and returns structured results
// so ClientGame remains thin and easy to maintain.

import type { SimWorld } from '@bf42lite/engine-core';
import type { Snapshot, FlagSnapshot } from '@bf42lite/protocol';

import { handleSnapshot } from './handleSnapshot';
import type { Renderer } from '../core/Renderer';
import type { NetworkManager } from '../managers/NetworkManager';
import type { UIManager } from '../managers/UIManager';

export interface SnapshotResult {
  flags: FlagSnapshot[];
  lastServerTick: number;
}

/**
 * SnapshotHandler centralizes “global” snapshot effects:
 * - Tickets / game-over HUD via handleSnapshot(...)
 * - Flag list for HUD / debug
 *
 * Entity ECS sync is still handled by NetworkManager → RemoteEntitySync.
 */
export class SnapshotHandler {
  private world: SimWorld;
  private renderer: Renderer;
  private net: NetworkManager;
  private ui: UIManager;

  constructor(
    world: SimWorld,
    renderer: Renderer,
    net: NetworkManager,
    ui: UIManager,
  ) {
    this.world = world;
    this.renderer = renderer;
    this.net = net;
    this.ui = ui;
  }

  /**
   * Process the snapshot sent by the server and return
   * a small result object for ClientGame.
   */
  public process(msg: Snapshot): SnapshotResult {
    // HUD (tickets, flags list, game-over) is handled here.
    handleSnapshot(msg, this.world, this.renderer, this.net, this.ui);

    const flags = (msg.flags ?? []) as FlagSnapshot[];
    const lastServerTick = msg.tick ?? 0;

    return {
      flags,
      lastServerTick,
    };
  }
}
