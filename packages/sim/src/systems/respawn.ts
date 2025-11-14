import { defineSystem, defineQuery, addComponent, removeComponent } from 'bitecs';
import { Transform, Velocity, Health, RespawnTimer, SimWorld } from '../components';

const RESPAWN_TIME = 3.0; // 3 Seconds delay

export const createRespawnSystem = () => {
  const query = defineQuery([Health, Transform]);
  // Query for dead players who already have a timer
  const timerQuery = defineQuery([Health, Transform, RespawnTimer]);

  return defineSystem((world: SimWorld) => {
    const dt = world.dt;

    // 1. Start Timer for newly dead people
    const entities = query(world);
    for (let i = 0; i < entities.length; ++i) {
      const id = entities[i];
      
      // If dead but NO timer yet, start the respawn process
      if (Health.isDead[id] && !world.hasComponent(RespawnTimer, id)) {
         addComponent(world, RespawnTimer, id);
         RespawnTimer.timeLeft[id] = RESPAWN_TIME;
         
         // Teleport to "Spectator Box" (underground) so they don't block shots
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
        // === RESURRECT ===
        Health.current[id] = Health.max[id];
        Health.isDead[id] = 0;
        
        // Random Spawn Position (Basic)
        Transform.x[id] = (Math.random() - 0.5) * 20;
        Transform.z[id] = (Math.random() - 0.5) * 20;
        Transform.y[id] = 0; // Back on floor

        removeComponent(world, RespawnTimer, id);
        console.log(`[Sim] Entity ${id} respawned!`);
      }
    }
    
    return world;
  });
};