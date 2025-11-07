import { defineQuery, IWorld } from "bitecs";
import { Transform, Velocity, GameState, Health, PlayerStats, Team } from "./components"; // --- G4: Import new components ---

const qMove = defineQuery([Transform, Velocity]);
export function MovementSystem(world: IWorld & { dt: number }) {
  const dt = world.dt;
  for (const eid of qMove(world)) {
    Transform.x[eid] += Velocity.x[eid] * dt;
    Transform.y[eid] += Velocity.y[eid] * dt;
    Transform.z[eid] += Velocity.z[eid] * dt;
  }
  return world;
}

// --- G4: ADD NEW SYSTEMS ---

const qGame = defineQuery([GameState]);
const qPlayers = defineQuery([Health, PlayerStats, Team]);

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
// --- END G4 ---