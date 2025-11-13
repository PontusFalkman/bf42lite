// packages/sim/src/systems/stats.ts
import { defineQuery, IWorld } from "bitecs";
import { Health, PlayerStats, Team, GameState } from "../components";

const qPlayers = defineQuery([Health, PlayerStats, Team]);

/**
 * Handles death events, stats, and ticket reduction.
 * Note: This is a conceptual system. The host's loop currently
 * handles this, but this is where the logic *should* live.
 * For now, the host will update components directly.
 */
export function PlayerStatSystem(world: IWorld) {
  // This would handle the logic currently in the host's "Handle Firing"
  // e.g., on death:
  //   PlayerStats.deaths[deadEid]++;
  //   PlayerStats.kills[killerEid]++;
  //   if (Team.id[deadEid] === 0) GameState.team1Tickets[gameEid]--;
  //   else GameState.team2Tickets[gameEid]--;
  return world;
}