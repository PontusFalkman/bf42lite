import { defineSystem, defineQuery } from 'bitecs';
// FIX: Path is now ../components
import { GameRules } from '../components';
import { SimWorld } from '@bf42lite/sim'; // Import SimWorld from engine

export const createGameLoopSystem = () => {
  const query = defineQuery([GameRules]);
  let resetTimer = 0;

  return defineSystem((world: SimWorld) => {
    const entities = query(world);
    if (!entities.length) return world;
    const id = entities[0];

    // 1. Check for Game Over
    if (GameRules.state[id] === 0) {
      if (GameRules.ticketsAxis[id] <= 0 || GameRules.ticketsAllies[id] <= 0) {
        console.log("GAME OVER - TICKETS DELETED");
        GameRules.state[id] = 1; // Switch to Game Over state
        resetTimer = world.time + 5; // Reset in 5 seconds
      }
    } 
    // 2. Handle Reset
    else if (GameRules.state[id] === 1) {
      if (world.time > resetTimer) {
        console.log("RESETTING MATCH...");
        GameRules.ticketsAxis[id] = 100;
        GameRules.ticketsAllies[id] = 100;
        GameRules.state[id] = 0;
      }
    }

    return world;
  });
};