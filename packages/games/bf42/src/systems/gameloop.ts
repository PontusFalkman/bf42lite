import { defineSystem, defineQuery } from 'bitecs';
// [ADD IMPORTS]
import { GameRules, CapturePoint, Team } from '../components'; 
import { SimWorld } from '@bf42lite/sim'; 

const BLEED_INTERVAL = 1.0; // Seconds between ticket removal
const BLEED_AMOUNT = 1;     // How many tickets to remove

export const createGameLoopSystem = () => {
  const rulesQuery = defineQuery([GameRules]);
  // [ADD QUERY] Find all flags
  const flagQuery = defineQuery([CapturePoint, Team]);

  let resetTimer = 0;
  let bleedTimer = 0;

  return defineSystem((world: SimWorld) => {
    const dt = world.dt;
    const now = world.time;
    
    const rulesEnts = rulesQuery(world);
    if (!rulesEnts.length) return world;
    const rulesId = rulesEnts[0];

    // 1. Check for Game Over
    if (GameRules.state[rulesId] === 0) {
      
      // --- NEW: CONQUEST LOGIC ---
      if (now >= bleedTimer) {
          bleedTimer = now + BLEED_INTERVAL;

          const flags = flagQuery(world);
          let axisFlags = 0;
          let alliesFlags = 0;

          for (const fid of flags) {
              const owner = CapturePoint.team[fid];
              if (owner === 1) axisFlags++;
              if (owner === 2) alliesFlags++;
          }

          // "The enemy is bleeding tickets!"
          // If Axis has more flags, Allies bleed.
          if (axisFlags > alliesFlags) {
              GameRules.ticketsAllies[rulesId] = Math.max(0, GameRules.ticketsAllies[rulesId] - BLEED_AMOUNT);
          }
          // If Allies has more flags, Axis bleed.
          else if (alliesFlags > axisFlags) {
              GameRules.ticketsAxis[rulesId] = Math.max(0, GameRules.ticketsAxis[rulesId] - BLEED_AMOUNT);
          }
      }
      // ---------------------------

      if (GameRules.ticketsAxis[rulesId] <= 0 || GameRules.ticketsAllies[rulesId] <= 0) {
        console.log("GAME OVER - TICKETS DEPLETED");
        GameRules.state[rulesId] = 1; 
        resetTimer = world.time + 10; // Longer wait before reset
      }
    } 
    // 2. Handle Reset
    else if (GameRules.state[rulesId] === 1) {
      if (world.time > resetTimer) {
        console.log("RESETTING MATCH...");
        // Reset Tickets
        GameRules.ticketsAxis[rulesId] = 100;
        GameRules.ticketsAllies[rulesId] = 100;
        
        // Reset Flags (Optional: Set them all to Neutral)
        const flags = flagQuery(world);
        for (const fid of flags) {
             CapturePoint.team[fid] = 0;
             CapturePoint.progress[fid] = 0;
        }

        GameRules.state[rulesId] = 0;
      }
    }

    return world;
  });
};