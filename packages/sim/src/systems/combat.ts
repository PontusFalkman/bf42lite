import { defineSystem, defineQuery } from 'bitecs';
import { Transform, PlayerInput, Health, CombatState, SimWorld, GameRules, Team } from '../components';

const FIRE_RATE = 0.15;
const DAMAGE = 25;
const MAX_DIST = 100;

export const createCombatSystem = () => {
  const query = defineQuery([Transform, PlayerInput, Health, CombatState]);
  const targetQuery = defineQuery([Transform, Health, Team]);
  
  // Find the global game rules entity
  const rulesQuery = defineQuery([GameRules]);

  return defineSystem((world: SimWorld) => {
    // 1. Check Game State (No fighting if Game Over)
    const rulesEnts = rulesQuery(world);
    if (rulesEnts.length === 0) return world;
    const rulesId = rulesEnts[0];

    if (GameRules.state[rulesId] === 1) return world;

    // 2. Run Combat
    const entities = query(world);
    const targets = targetQuery(world);

    for (let i = 0; i < entities.length; ++i) {
      const id = entities[i];

      if (PlayerInput.shoot[id] && !Health.isDead[id]) {
        const now = world.time;
        if (now - CombatState.lastFireTime[id] >= FIRE_RATE) {
          
          CombatState.lastFireTime[id] = now;
          
          // --- RAYCAST LOGIC (Simplified) ---
          let hitId = -1;
          let bestDist = MAX_DIST;
          const myYaw = Transform.rotation[id];

          for (let t = 0; t < targets.length; ++t) {
            const tid = targets[t];
            if (tid === id || Health.isDead[tid]) continue;

            const dx = Transform.x[tid] - Transform.x[id];
            const dz = Transform.z[tid] - Transform.z[id];
            const dy = (Transform.y[tid] + 1) - (Transform.y[id] + 1.6); 

            const dist = Math.sqrt(dx*dx + dz*dz + dy*dy);
            
            if (dist < MAX_DIST) {
              const lookX = -Math.sin(myYaw);
              const lookZ = -Math.cos(myYaw);
              const dirX = dx / dist;
              const dirZ = dz / dist;
              const dot = (lookX * dirX) + (lookZ * dirZ);
              
              if (dot > 0.95 && dist < bestDist) {
                bestDist = dist;
                hitId = tid;
              }
            }
          }

          // 3. Apply Damage & Ticket Bleed
          if (hitId !== -1) {
            // console.log(`Hit ${hitId}`);
            Health.current[hitId] -= DAMAGE;
            
            if (Health.current[hitId] <= 0) {
                Health.current[hitId] = 0;
                
                // Only kill if not already dead
                if (!Health.isDead[hitId]) {
                    Health.isDead[hitId] = 1;
                    console.log(`Player ${hitId} died. Removing Ticket.`);
                    
                    // DEDUCT TICKET
                    const team = Team.id[hitId];
                    if (team === 1) GameRules.ticketsAxis[rulesId]--;
                    if (team === 2) GameRules.ticketsAllies[rulesId]--;
                }
            }
          }
        }
      }
    }
    return world;
  });
};