// src/systems/handleSnapshot.ts

import type { SimWorld } from '@bf42lite/engine-core';
import type { Renderer } from '../core/Renderer';
import type { NetworkManager } from '../managers/NetworkManager';
import type { UIManager } from '../managers/UIManager';

export interface SnapshotMessage {
  type: 'snapshot';
  tick?: number;
  flags?: any[];
  game_state?: {
    team_a_tickets?: number;
    team_b_tickets?: number;
    match_ended?: boolean;
    winner_team?: number | string | null;
  } | null;
}

/**
 * HUD-only snapshot handler.
 * All ECS + entity sync is done in NetworkManager → RemoteEntitySync.
 */
export function handleSnapshot(
  msg: SnapshotMessage,
  _world: SimWorld,
  _renderer: Renderer,
  _net: NetworkManager,
  ui: UIManager,
) {
  // Tickets
  const axis = msg.game_state?.team_a_tickets ?? 0;
  const allies = msg.game_state?.team_b_tickets ?? 0;
  ui.updateTickets(axis, allies);

  // Flag HUD
  ui.updateFlagsHUD(msg.flags);

  // Game over
  const st = msg.game_state;
  const ended = !!st?.match_ended;

  if (ended) {
    let title = 'DRAW';
    const winner = st?.winner_team;

    if (winner === 1 || winner === 'TeamA') title = 'AXIS VICTORY';
    else if (winner === 2 || winner === 'TeamB') title = 'ALLIES VICTORY';

    ui.setGameOver(true, title);
  } else {
    ui.setGameOver(false, '');
  }
}
