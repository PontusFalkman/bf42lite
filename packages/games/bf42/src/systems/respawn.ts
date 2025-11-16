import { defineSystem, defineQuery, addComponent, removeComponent, hasComponent } from 'bitecs';
import { Transform, Velocity, SimWorld, InputState } from '@bf42lite/sim';
import { Health, RespawnTimer, Ammo } from '../components';

const RESPAWN_TIME = 3.0;
const BUTTON_JUMP = 1; // Spacebar

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
      
      if (RespawnTimer.timeLeft[id] > 0) {
        RespawnTimer.timeLeft[id] -= dt;
      }

      // 3. WAIT FOR INPUT (Deploy Button)
      const isReady = RespawnTimer.timeLeft[id] <= 0;
      const wantsDeploy = (InputState.buttons[id] & BUTTON_JUMP) !== 0;

      if (isReady && wantsDeploy) {
        // --- RESPAWN ---
        Health.current[id] = Health.max[id];
        Health.isDead[id] = 0;
        
        // 1. Reset Position
        Transform.x[id] = (Math.random() - 0.5) * 20;
        Transform.z[id] = (Math.random() - 0.5) * 20;
        Transform.y[id] = 5; // Drop from air

        // 2. RE-ENABLE PHYSICS (Add Velocity)
        addComponent(world, Velocity, id);
        Velocity.x[id] = 0;
        Velocity.y[id] = 0;
        Velocity.z[id] = 0;

        // 3. Refill Ammo
        Ammo.current[id] = Ammo.magSize[id];
        Ammo.reserve[id] = 120;

        removeComponent(world, RespawnTimer, id);
        console.log(`[Sim] Player ${id} DEPLOYED!`);
      }
    }
    
    return world;
  });
};