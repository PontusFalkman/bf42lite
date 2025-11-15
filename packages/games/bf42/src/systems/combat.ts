import { defineSystem, defineQuery } from 'bitecs';
// FIX: Import ENGINE components
import { Transform, InputState, SimWorld } from '@bf42lite/sim'; 
// FIX: Import GAME components
import { Health, CombatState, GameRules, Team, Ammo } from '../components';

const FIRE_RATE = 0.15;
const DAMAGE = 25;
const MAX_DIST = 100;
const RELOAD_TIME = 2.0;

// Input buttons (must match host-node)
const BUTTON_FIRE = 2;
const BUTTON_RELOAD = 4;

export const createCombatSystem = () => {
  // Query for entities that can fight
  const query = defineQuery([Transform, InputState, Health, CombatState, Ammo, Team]);
  // Query for entities that can be hit
  const targetQuery = defineQuery([Transform, Health, Team]);
  const rulesQuery = defineQuery([GameRules]);

  return defineSystem((world: SimWorld) => {
    const rulesEnts = rulesQuery(world);
    if (rulesEnts.length === 0) return world;
    const rulesId = rulesEnts[0];

    if (GameRules.state[rulesId] === 1) return world; // Game Over

    const entities = query(world);
    const targets = targetQuery(world);

    for (const id of entities) {
      if (Health.isDead[id]) continue;

      const now = world.time;
      const isShooting = (InputState.buttons[id] & BUTTON_FIRE) !== 0;
      const isReloading = (InputState.buttons[id] & BUTTON_RELOAD) !== 0;

      // --- 1. RELOAD LOGIC ---
      if (isReloading && !CombatState.isReloading[id]) {
          // Start reload if not full and has reserve
          if (Ammo.current[id] < Ammo.magSize[id] && Ammo.reserve[id] > 0) {
              CombatState.isReloading[id] = 1;
              CombatState.reloadStartTime[id] = now;
          }
      }

      if (CombatState.isReloading[id]) {
          if (now - CombatState.reloadStartTime[id] >= RELOAD_TIME) {
              // Finish Reload
              const magSize = Ammo.magSize[id];
              const current = Ammo.current[id];
              const reserve = Ammo.reserve[id];
              
              const needed = magSize - current;
              const actual = Math.min(needed, reserve);
              
              Ammo.current[id] += actual;
              Ammo.reserve[id] -= actual;
              CombatState.isReloading[id] = 0;
          }
          continue; // Can't shoot while reloading
      }

      // --- 2. FIRING LOGIC ---
      if (isShooting && Ammo.current[id] > 0) {
        if (now - CombatState.lastFireTime[id] >= FIRE_RATE) {
          CombatState.lastFireTime[id] = now;
          Ammo.current[id]--;
          
          // --- RAYCAST LOGIC ---
          let hitId = -1;
          let bestDist = MAX_DIST;
          const myYaw = Transform.rotation[id];
          const myTeam = Team.id[id];

          for (const tid of targets) {
            if (tid === id || Health.isDead[tid] || Team.id[tid] === myTeam) continue;

            const dx = Transform.x[tid] - Transform.x[id];
            const dz = Transform.z[tid] - Transform.z[id];
            const dist = Math.sqrt(dx*dx + dz*dz);
            
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

          // --- 3. APPLY DAMAGE ---
          if (hitId !== -1) {
            const newHp = Math.max(0, Health.current[hitId] - DAMAGE);
            Health.current[hitId] = newHp;
            
            if (newHp === 0 && !Health.isDead[hitId]) {
                Health.isDead[hitId] = 1;
                
                // DEDUCT TICKET
                const team = Team.id[hitId];
                if (team === 1) GameRules.ticketsAxis[rulesId]--;
                if (team === 2) GameRules.ticketsAllies[rulesId]--;
            }
          }
        }
      }
    }
    return world;
  });
};