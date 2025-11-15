import { defineSystem, defineQuery, addComponent, removeComponent, hasComponent } from 'bitecs';
// FIX: Import engine components from @bf42lite/sim
import { Transform, Velocity, SimWorld } from '@bf42lite/sim';
// FIX: Import game components from ../components
import { Health, RespawnTimer } from '../components';

const RESPAWN_TIME = 3.0; // 3 Seconds delay

export const createRespawnSystem = () => {
  const query = defineQuery([Health, Transform]);
  const timerQuery = defineQuery([Health, Transform, RespawnTimer]);

  return defineSystem((world: SimWorld) => {
    const dt = world.dt;

    // 1. Start Timer
    const entities = query(world);
    for (let i = 0; i < entities.length; ++i) {
      const id = entities[i];
      
      if (Health.isDead[id] && !hasComponent(world, RespawnTimer, id)) {
         addComponent(world, RespawnTimer, id);
         RespawnTimer.timeLeft[id] = RESPAWN_TIME;
         
         Transform.y[id] = -50; 
         Velocity.x[id] = 0;
         Velocity.y[id] = 0;
         Velocity.z[id] = 0;
      }
    }

    // 2. Process Timers
    const respawning = timerQuery(world);
    for (let i = 0; i < respawning.length; ++i) {
      const id = respawning[i];
      
      RespawnTimer.timeLeft[id] -= dt;

      if (RespawnTimer.timeLeft[id] <= 0) {
        Health.current[id] = Health.max[id];
        Health.isDead[id] = 0;
        
        Transform.x[id] = (Math.random() - 0.5) * 20;
        Transform.z[id] = (Math.random() - 0.5) * 20;
        Transform.y[id] = 0;

        removeComponent(world, RespawnTimer, id);
        console.log(`[Sim] Entity ${id} respawned!`);
      }
    }
    
    return world;
  });
};