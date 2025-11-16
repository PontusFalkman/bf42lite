import { defineSystem, defineQuery, addComponent, removeComponent, hasComponent } from 'bitecs';
import { Transform, Velocity, SimWorld, InputState } from '@bf42lite/sim';
import { Health, RespawnTimer } from '../components'; // Ammo not needed here anymore

const RESPAWN_TIME = 3.0;

export const createRespawnSystem = () => {
  const query = defineQuery([Health, Transform, InputState]);
  const timerQuery = defineQuery([Health, Transform, RespawnTimer, InputState]);

  return defineSystem((world: SimWorld) => {
    const dt = world.dt;

    // 1. DETECT DEATH -> START TIMER
    const entities = query(world);
    for (let i = 0; i < entities.length; ++i) {
      const id = entities[i];
      
      if (Health.isDead[id] && !hasComponent(world, RespawnTimer, id)) {
         addComponent(world, RespawnTimer, id);
         RespawnTimer.timeLeft[id] = RESPAWN_TIME;
         
         // Move to Purgatory
         Transform.y[id] = -50; 
         
         // STOP PHYSICS (Remove Velocity)
         if (hasComponent(world, Velocity, id)) {
            removeComponent(world, Velocity, id);
         }
      }
    }

    // 2. PROCESS RESPAWN QUEUE
    const respawning = timerQuery(world);
    for (let i = 0; i < respawning.length; ++i) {
      const id = respawning[i];
      
      // CASE A: Player was spawned by the Game Loop (spawnPlayer)
      // We need to restore physics and remove the timer.
      if (!Health.isDead[id]) {
        // 1. RE-ENABLE PHYSICS (Add Velocity)
        if (!hasComponent(world, Velocity, id)) {
            addComponent(world, Velocity, id);
            Velocity.x[id] = 0;
            Velocity.y[id] = 0;
            Velocity.z[id] = 0;
        }
        
        // 2. Cleanup Timer
        removeComponent(world, RespawnTimer, id);
        console.log(`[RespawnSystem] Physics restored for Player ${id}`);
        continue; 
      }

      // CASE B: Still dead, count down
      if (RespawnTimer.timeLeft[id] > 0) {
        RespawnTimer.timeLeft[id] -= dt;
      }
      
      // NOTE: Actual spawning is now handled by 'processMessage' in index.ts
    }
    
    return world;
  });
};