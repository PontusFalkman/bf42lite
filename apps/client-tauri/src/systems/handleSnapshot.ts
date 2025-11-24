// src/systems/handleSnapshot.ts

import type { SimWorld } from '@bf42lite/engine-core';
import type { Renderer } from '../core/Renderer';
import type { NetworkManager } from '../managers/NetworkManager';
import type { UIManager } from '../managers/UIManager';

// Shape that NetworkManager.onSnapshot() gives us
export interface SnapshotMessage {
  type: 'snapshot';
  tick?: number;
  entities?: any[];
  flags?: any[];
  game_state?: {
    team_a_tickets?: number;
    team_b_tickets?: number;
    match_ended?: boolean;
    winner_team?: number | string | null;
  } | null;
}

/**
 * Centralized snapshot handler.
 * - Feeds entity snapshots into NetworkManager (ECS + interpolation).
 * - Updates conquest UI (tickets, flags, game over).
 */
export function handleSnapshot(
  msg: SnapshotMessage,
  world: SimWorld,
  renderer: Renderer,
  net: NetworkManager,
  ui: UIManager,
) {
  // --- Entities / world sync (delegated to NetworkManager) ---
  net.processRemoteEntities(msg, world, renderer);

  // --- Tickets + basic game state ---
  const ticketsAxis = msg.game_state?.team_a_tickets ?? 0;
  const ticketsAllies = msg.game_state?.team_b_tickets ?? 0;
  ui.updateTickets(ticketsAxis, ticketsAllies);

  // --- Flags → HUD (strip + list) ---
  if (msg.flags && msg.flags.length > 0) {
    ui.updateFlagStrip(msg.flags as any);
    ui.updateFlagList(
      (msg.flags as any[]).map((f) => ({
        id: f.id,
        owner: f.owner,
        capture: typeof f.capture === 'number' ? f.capture : 0,
      })),
    );
  }

  // --- Game over handling ---
  const gameState = msg.game_state;
  const isMatchEnded = !!gameState?.match_ended;

  if (isMatchEnded) {
    // Prefer explicit winner if server sends it; otherwise infer from tickets.
    let winnerTitle = 'DRAW';

    if (gameState?.winner_team !== undefined && gameState?.winner_team !== null) {
      const w = gameState.winner_team;
      if (w === 1 || w === 'TeamA') winnerTitle = 'AXIS VICTORY';
      else if (w === 2 || w === 'TeamB') winnerTitle = 'ALLIES VICTORY';
    } else if (ticketsAxis > ticketsAllies) {
      winnerTitle = 'AXIS VICTORY';
    } else if (ticketsAllies > ticketsAxis) {
      winnerTitle = 'ALLIES VICTORY';
    }

    ui.setGameOver(true, winnerTitle);
  } else {
    ui.setGameOver(false, '');
  }
}
