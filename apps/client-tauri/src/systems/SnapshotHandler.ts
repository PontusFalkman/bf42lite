// apps/client-tauri/src/systems/SnapshotHandler.ts
//
// Unified handler for processing server snapshots.
// This now delegates HUD updates to HUDUpdater so that
// ClientGame and snapshot flow do not touch UIManager directly.

import type { Snapshot, FlagSnapshot } from '@bf42lite/protocol';
import type { HUDUpdater } from '../ui/HUDUpdater';

export interface SnapshotResult {
  flags: FlagSnapshot[];
  lastServerTick: number;
}

/**
 * SnapshotHandler centralizes “global” snapshot effects:
 * - Tickets / flags / game-over HUD via HUDUpdater.applySnapshotHUD(...)
 * - Flag list for HUD / debug
 *
 * Entity ECS sync is still handled by NetworkManager → RemoteEntitySync.
 */
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
