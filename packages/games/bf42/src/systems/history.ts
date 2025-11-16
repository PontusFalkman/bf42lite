import { defineSystem, defineQuery } from 'bitecs';
import { Transform, InputState, SimWorld } from '@bf42lite/sim';

// Interface for what we're storing
interface IVec3 {
  x: number;
  y: number;
  z: number;
}
interface IHistoryState {
  pos: IVec3;
  dir: IVec3;
}

// Stores history for *each player*, keyed by EID
// Each player's history is a map keyed by TICK
const history = new Map<number, Map<number, IHistoryState>>();

// Helper to get direction vector
function getDirection(yaw: number, pitch: number): IVec3 {
  const x = -Math.sin(yaw) * Math.cos(pitch);
  const y = Math.sin(pitch);
  const z = -Math.cos(yaw) * Math.cos(pitch);
  return { x, y, z };
}

export const createHistorySystem = () => {
  const query = defineQuery([Transform, InputState]);

  return defineSystem((world: SimWorld) => {
    const entities = query(world);

    for (const id of entities) {
      if (!history.has(id)) {
        history.set(id, new Map());
      }
      const playerHistory = history.get(id)!;

      // 1. Get current state
      const state: IHistoryState = {
        pos: {
          x: Transform.x[id],
          y: Transform.y[id],
          z: Transform.z[id],
        },
        dir: getDirection(InputState.viewX[id], InputState.viewY[id])
      };
      
      // 2. Store state by the tick it *represents*
      const tick = InputState.lastTick[id];
      if (tick > 0) {
          playerHistory.set(tick, state);
      }

      // 3. Prune old history (e.g., keep last 5 seconds)
      if (playerHistory.size > 300) {
        const oldTick = world.time * 60 - 300;
        for (const [t] of playerHistory.entries()) {
          if (t < oldTick) {
            playerHistory.delete(t);
          }
        }
      }
    }
    return world;
  });
};

/**
 * Gets the interpolated pose for an entity at a specific tick.
 * This is crucial for server-side hit detection.
 */
export const getPoseAtTick = (
  eid: number,
  tick: number
): IHistoryState | undefined => {
  const playerHistory = history.get(eid);
  if (!playerHistory || playerHistory.size === 0) {
    return undefined; // No history for this player
  }

  // TODO: Interpolate between packets.
  // For now, just find the closest tick we have.
  // This is imperfect but better than nothing.
  
  // Find the closest tick <= requested tick
  let bestTick = 0;
  for (const [t] of playerHistory.entries()) {
    if (t <= tick && t > bestTick) {
      bestTick = t;
    }
  }
  
  if (bestTick === 0) {
      // No tick old enough, just grab the oldest we have
      bestTick = Math.min(...playerHistory.keys());
  }

  return playerHistory.get(bestTick);
};