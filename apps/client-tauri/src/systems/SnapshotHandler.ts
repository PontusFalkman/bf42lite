// apps/client-tauri/src/systems/SnapshotHandler.ts
//
// Unified handler for processing server snapshots.
// This wraps handleSnapshot(...) and returns structured results
// so ClientGame remains thin and easy to maintain.

import type { Snapshot, FlagSnapshot } from '@bf42lite/protocol';

import { handleSnapshot } from './handleSnapshot';
import type { Renderer } from '../core/Renderer';
import type { NetworkManager } from '../managers/NetworkManager';
import type { UIManager } from '../managers/UIManager';

export interface SnapshotResult {
  flags: FlagSnapshot[];
  ticketsAxis: number;
  ticketsAllies: number;
  gameOver: boolean;
  winner?: string;
}

export class SnapshotHandler {
  private world: any;
  private renderer: Renderer;
  private net: NetworkManager;
  private ui: UIManager;

  constructor(
    world: any,
    renderer: Renderer,
    net: NetworkManager,
    ui: UIManager
  ) {
    this.world = world;
    this.renderer = renderer;
    this.net = net;
    this.ui = ui;
  }

  /**
   * Process the snapshot sent by the server.
   *
   * Returns a result object used by ClientGame.
   */
  public process(msg: Snapshot): SnapshotResult {
    // This function applies:
    // - Entity updates
    // - Health updates
    // - Team changes
    // - Flag capture state
    // - Killfeed / hit markers
    // - Ticket counts
    // - GameOver state
    handleSnapshot(msg, this.world, this.renderer, this.net, this.ui);

    const flags = (msg.flags ?? []) as FlagSnapshot[];

    return {
      flags,
      ticketsAxis: msg.tickets?.axis ?? 0,
      ticketsAllies: msg.tickets?.allies ?? 0,
      gameOver: msg.gameOver?.active ?? false,
      winner: msg.gameOver?.winner ?? undefined,
    };
  }
}
