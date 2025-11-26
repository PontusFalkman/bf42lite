// apps/client-tauri/src/systems/SnapshotHandler.ts
//
// Thin wrapper around Snapshot → HUD effects.
// Keeps ClientGame free from protocol / HUD wiring.

import type { Snapshot, FlagSnapshot } from '@bf42lite/protocol';
import type { HUDUpdater } from '../ui/HUDUpdater';

export interface SnapshotResult {
  flags: FlagSnapshot[];
  lastServerTick: number;
}

export class SnapshotHandler {
  private hud: HUDUpdater;

  constructor(hud: HUDUpdater) {
    this.hud = hud;
  }

  /**
   * Process the snapshot sent by the server and return
   * a small result object for ClientGame.
   */
  public process(msg: Snapshot): SnapshotResult {
    // HUD (tickets, flags list, game-over) is handled via HUDUpdater.
    this.hud.applySnapshotHUD(msg);

    const flags = (msg.flags ?? []) as FlagSnapshot[];
    const lastServerTick = msg.tick ?? 0;

    return {
      flags,
      lastServerTick,
    };
  }
}
