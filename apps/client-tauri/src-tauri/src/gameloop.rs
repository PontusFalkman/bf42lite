import { defineSystem, defineQuery, removeComponent, hasComponent } from 'bitecs';
import { GameRules, Health, Ammo, Stats, RespawnTimer, Team } from '../components';
import { SimWorld, Transform, Velocity } from '@bf42lite/sim';

export const createGameLoopSystem = () => {
  // We need to query the Rules AND the Players
  const rulesQuery = defineQuery([GameRules]);
  const playerQuery = defineQuery([Health, Transform, Stats, Ammo, Team]); 
  
  let resetTimer = 0;

  return defineSystem((world: SimWorld) => {
    const rulesEnts = rulesQuery(world);
    if (!rulesEnts.length) return world;
    const rid = rulesEnts[0];

    // 1. Check for Game Over
    if (GameRules.state[rid] === 0) {
      if (GameRules.ticketsAxis[rid] <= 0 || GameRules.ticketsAllies[rid] <= 0) {
        console.log("GAME OVER - WAITING FOR RESET");
        GameRules.state[rid] = 1; 
        resetTimer = world.time + 5; // 5 Second intermission
      }
    } 
    
    // 2. Handle Reset
    else if (GameRules.state[rid] === 1) {
      if (world.time > resetTimer) {
        console.log("--- RESETTING MATCH ---");
        
        // A. Reset Rules
        GameRules.ticketsAxis[rid] = 100;
        GameRules.ticketsAllies[rid] = 100;
        GameRules.state[rid] = 0;

        // B. Reset All Players
        const players = playerQuery(world);
        for (const pid of players) {
          // 1. Reset Stats
          Stats.kills[pid] = 0;
          Stats.deaths[pid] = 0;

          // 2. Reset Health & Life
          Health.current[pid] = Health.max[pid];
          Health.isDead[pid] = 0; // Alive immediately
          
          // 3. Remove active respawn timers if any
          if (hasComponent(world, RespawnTimer, pid)) {
            removeComponent(world, RespawnTimer, pid);
          }

          // 4. Refill Ammo
          Ammo.current[pid] = Ammo.magSize[pid];
          Ammo.reserve[pid] = 120;

          // 5. Teleport to Random Spawn
          Transform.x[pid] = (Math.random() - 0.5) * 40;
          Transform.z[pid] = (Math.random() - 0.5) * 40;
          Transform.y[pid] = 5; // Drop from sky
          
          // 6. Stop Momentum
          Velocity.x[pid] = 0;
          Velocity.y[pid] = 0;
          Velocity.z[pid] = 0;
        }
      }
    }

    return world;
  });
};