// src/systems/handleSnapshot.ts

import type { SimWorld } from '@bf42lite/engine-core';
import type { Renderer } from '../core/Renderer';
import type { NetworkManager } from '../managers/NetworkManager';
import type { UIManager } from '../managers/UIManager';

// Shape that NetworkManager.onSnapshot() gives us
interface SnapshotMessage {
  type: 'snapshot';
  tick?: number;
  entities?: any[];
  flags?: any[];
  game_state?: {
    team_a_tickets?: number;
    team_b_tickets?: number;
    match_ended?: boolean;
  };
}

export function handleSnapshot(
  msg: SnapshotMessage,
  simWorld: SimWorld,
  renderer: Renderer,
  net: NetworkManager,
  ui: UIManager
): void {
  // Critical debug: do we see ANY flags at all?
  console.log('[SNAPSHOT] Flags in snapshot:', msg.flags);

  //
  // 1. FLAGS → ECS
  //
  net.processFlags(msg, simWorld);

  //
  // 2. REMOTE ENTITIES → ECS + Renderer
  //
  net.processRemoteEntities(msg, simWorld, renderer);

  //
  // 3. TICKETS → UI
  //
  const ticketsAxis = msg.game_state?.team_a_tickets ?? 0;
  const ticketsAllies = msg.game_state?.team_b_tickets ?? 0;
  ui.updateTickets(ticketsAxis, ticketsAllies);

  //
  // 4. GAME OVER → UI
  //
  const isGameOver = msg.game_state?.match_ended === true;
  if (isGameOver) {
    let winner = 'DRAW';

    if (ticketsAxis <= 0 && ticketsAllies > 0) winner = 'ALLIES VICTORY';
    else if (ticketsAllies <= 0 && ticketsAxis > 0) winner = 'AXIS VICTORY';

    ui.setGameOver(true, winner);
  } else {
    ui.setGameOver(false, '');
  }
}
