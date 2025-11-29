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
   * Toggle deploy screen vs in-game HUD.
   */
  public showDeployScreen(message?: string): void {
    this.ui.setDeployMode(true);
    if (message) {
      this.updateCenterStatus(message);
    }
  }

  public showLiveHUD(): void {
    this.ui.setDeployMode(false);
    // Clear center message when fully alive
    this.updateCenterStatus('');
  }

  /**
   * Update the center status text (e.g., spawn/death messages).
   */
  public updateCenterStatus(text: string): void {
    this.ui.setCenterStatus(text);
  }

  /**
   * Switch between deploy screen and in-game HUD.
   */
  public setDeployMode(isDeploy: boolean): void {
    this.ui.setDeployMode(isDeploy);
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
    // crosshair spread
    public updateCrosshair(spread: number): void {
      this.ui.setCrosshairSpread(spread);
    }

  /**
   * Snapshot-driven HUD hook (tickets / flags / game-over).
   *
   * Called once per server snapshot from SnapshotHandler.
   * This keeps snapshot → HUD wiring in a single place.
   */
  public applySnapshotHUD(msg: Snapshot): void {
    // --- Tickets ---
    const axis = msg.game_state?.team_a_tickets ?? 0;
    const allies = msg.game_state?.team_b_tickets ?? 0;
    this.ui.updateTickets(axis, allies);

    // --- Flags HUD (mini strip + list) ---
    this.ui.updateFlagsHUD(msg.flags);

    // --- Game over state ---
    const st: any = msg.game_state;
    const ended = !!st?.match_ended;

    if (ended) {
      let title = 'DRAW';
      const winner = st?.winner_team as number | string | null | undefined;

      if (winner === 1 || winner === 'TeamA') title = 'AXIS VICTORY';
      else if (winner === 2 || winner === 'TeamB') title = 'ALLIES VICTORY';

      this.ui.setGameOver(true, title);
    } else {
      this.ui.setGameOver(false, '');
    }
  }
}
