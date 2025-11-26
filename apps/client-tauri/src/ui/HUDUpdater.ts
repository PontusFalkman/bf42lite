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
   * Snapshot-driven HUD hook (tickets / game over / flags).
   * NOTE: Currently not wired; keep as a place to consolidate
   * handleSnapshot logic once the protocol shape is stable.
   */
  public applySnapshotHUD(_msg: Snapshot): void {
    // Intentionally left as a placeholder for the future.
    // For now, handleSnapshot.ts still drives tickets/flags/game-over HUD.
  }
}
