import { defineSystem, defineQuery, addComponent, removeComponent, hasComponent } from 'bitecs';
import { Transform, Velocity, SimWorld, InputState } from '@bf42lite/sim';
import { Health, RespawnTimer } from '../components';

const RESPAWN_TIME = 3.0; // 3 Seconds wait time
const BUTTON_JUMP = 1;    // "Deploy" button (Spacebar)

export const createRespawnSystem = () => {
  const query = defineQuery([Health, Transform, InputState]); // Added InputState
  const timerQuery = defineQuery([Health, Transform, RespawnTimer, InputState]);

  return defineSystem((world: SimWorld) => {
    const dt = world.dt;

    // 1. DETECT DEATH & START TIMER
    const entities = query(world);
    for (let i = 0; i < entities.length; ++i) {
      const id = entities[i];
      
      if (Health.isDead[id] && !hasComponent(world, RespawnTimer, id)) {
         addComponent(world, RespawnTimer, id);
         RespawnTimer.timeLeft[id] = RESPAWN_TIME;
         
         // Move to Purgatory (hide them)
         Transform.y[id] = -50; 
         Velocity.x[id] = 0;
         Velocity.y[id] = 0;
         Velocity.z[id] = 0;
      }
    }

    // 2. PROCESS RESPAWN QUEUE
    const respawning = timerQuery(world);
    for (let i = 0; i < respawning.length; ++i) {
      const id = respawning[i];
      
      // Decrement timer, but clamp at 0
      if (RespawnTimer.timeLeft[id] > 0) {
        RespawnTimer.timeLeft[id] -= dt;
      }

      // 3. CHECK FOR DEPLOY INPUT
      // Only respawn if timer is done AND player presses Jump (Space)
      const isReady = RespawnTimer.timeLeft[id] <= 0;
      const wantsDeploy = (InputState.buttons[id] & BUTTON_JUMP) !== 0;

      if (isReady && wantsDeploy) {
        // --- RESET PLAYER ---
        Health.current[id] = Health.max[id];
        Health.isDead[id] = 0;
        
        // Random Spawn Point (MVP style)
        Transform.x[id] = (Math.random() - 0.5) * 20;
        Transform.z[id] = (Math.random() - 0.5) * 20;
        Transform.y[id] = 5; // Drop them in from slightly above

        removeComponent(world, RespawnTimer, id);
        console.log(`[Sim] Player ${id} deployed!`);
      }
    }
    
    return world;
  });
};