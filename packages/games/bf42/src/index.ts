import { SimWorld, createMovementSystem, SystemFactory } from '@bf42lite/sim';
import { createCombatSystem } from './systems/combat';
import { createRespawnSystem } from './systems/respawn'; // This path now works
import { createGameLoopSystem } from './systems/gameloop'; // This path now works

// 1. Export all components
export * from './components';

// 2. Define the Systems
export const getSystems = (): SystemFactory[] => [
  createMovementSystem, // Generic Physics
  createCombatSystem,   // BF42 Combat
  createRespawnSystem,  // BF42 Spawning
  createGameLoopSystem  // BF42 Ticket/Win State
];

// 3. Define Event Handlers
// When the server gets a message, it asks the Game: "What do I do?"
export const handleGameEvent = (world: SimWorld, type: string, payload: any, playerId: number) => {
    // We will move the "Fire" logic here in a moment
    if (type === 'fire') {
        // Call a helper function to handle shooting
    }
};