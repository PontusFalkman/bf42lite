// apps/client-tauri/src/ui/HUDUpdater.ts
//
// Centralized helper for updating HUD elements.
// The goal is to gradually move direct UIManager calls here so that
// snapshot handlers, systems, and ClientGame do not talk to the DOM/UI
// directly, only to this façade.

import type { UIManager } from '../managers/UIManager';
import type { Snapshot } from '@bf42lite/protocol';

export class HUDUpdater {
  private ui: UIManager;

  constructor(ui: UIManager) {
    this.ui = ui;
  }

  /**
   * Update FPS + RTT stats in the HUD.
   */
  public updateStats(fps: number, rttMs: number): void {
    this.ui.updateStats(fps, rttMs);
  }

  /**
   * Update local player's health in the HUD.
   */
  public updateHealth(health: number): void {
    this.ui.updateHealth(health);
  }

  /**
   * Update respawn timer and death state in the HUD.
   */
  public updateRespawn(isDead: boolean, respawnTimerSec: number): void {
    this.ui.updateRespawn(isDead, respawnTimerSec);
  }

  /**
   * Update ammo + weapon name in the HUD.
   */
  public updateAmmo(current: number, reserve: number, weaponName: string): void {
    this.ui.updateAmmo(current, reserve, weaponName);
  }

  /**
   * Update hit marker feedback (damage done).
   */
  public showHitMarker(damage: number): void {
    this.ui.showHitMarker(damage);
  }

  /**
   * Apply HUD-related parts of a snapshot (tickets, game over, flag HUD, etc.).
   * This is a façade over the more detailed logic currently inside handleSnapshot.
   */
  public applySnapshotHUD(msg: Snapshot): void {
    // Tickets (if present)
    if (msg.game_state && msg.game_state.tickets) {
      const tickets = msg.game_state.tickets;
      this.ui.updateTickets(tickets.axis ?? 0, tickets.allies ?? 0);
    }

    // Game over state (if present)
    if (msg.game_state && msg.game_state.game_over) {
      const over = msg.game_state.game_over;
      this.ui.showGameOver(over.winnerTeamId ?? null, over.reason ?? '');
    }

    // Flag HUD (if you expose it in UIManager)
    if (msg.flags && msg.flags.length > 0 && this.ui.updateFlagHud) {
      // Minimal example: pass raw flags; UIManager remains responsible
      this.ui.updateFlagHud(msg.flags);
    }
  }
}
