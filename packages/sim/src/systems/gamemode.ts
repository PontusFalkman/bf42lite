// packages/sim/src/systems/gamemode.ts
import { defineQuery, IWorld } from "bitecs";
import { GameState } from "../components";

const qGame = defineQuery([GameState]);

/**
 * Checks for game end state (e.g., tickets depleted).
 */
export function GameModeSystem(world: IWorld) {
  const [gameEid] = qGame(world);
  if (gameEid === undefined) return world; // Game not set up

  const phase = GameState.phase[gameEid];

  // Only check if the game is in progress
  if (phase === 1) {
    const t1Tickets = GameState.team1Tickets[gameEid];
    const t2Tickets = GameState.team2Tickets[gameEid];

    if (t1Tickets <= 0 || t2Tickets <= 0) {
      console.log("[GameModeSystem] Game over! Setting phase to 2 (PostMatch).");
      GameState.phase[gameEid] = 2; // Set to PostMatch
    }
  }
  return world;
}