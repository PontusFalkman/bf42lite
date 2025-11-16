import { defineSystem, defineQuery } from 'bitecs';
import { Transform, InputState, SimWorld } from '@bf42lite/sim'; 
import { Health, CombatState, GameRules, Team, Ammo, Stats } from '../components';
const FIRE_RATE = 0.15; // 600 RPM approx
const DAMAGE = 25;      // 4 shots to kill
const MAX_DIST = 100;   // Meters
const RELOAD_TIME = 2.0;

const BUTTON_FIRE = 2;
const BUTTON_RELOAD = 4;

export const createCombatSystem = () => {
  const query = defineQuery([Transform, InputState, Health, CombatState, Ammo, Team]);
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
          if (Ammo.current[id] < Ammo.magSize[id] && Ammo.reserve[id] > 0) {
              CombatState.isReloading[id] = 1;
              CombatState.reloadStartTime[id] = now;
          }
      }

      if (CombatState.isReloading[id]) {
          if (now - CombatState.reloadStartTime[id] >= RELOAD_TIME) {
              const needed = Ammo.magSize[id] - Ammo.current[id];
              const actual = Math.min(needed, Ammo.reserve[id]);
              
              Ammo.current[id] += actual;
              Ammo.reserve[id] -= actual;
              CombatState.isReloading[id] = 0;
          }
          continue; // Cannot fire while reloading
      }

      // --- 2. FIRING LOGIC ---
      if (isShooting && Ammo.current[id] > 0) {
        if (now - CombatState.lastFireTime[id] >= FIRE_RATE) {
          CombatState.lastFireTime[id] = now;
          Ammo.current[id]--;

          // --- 3D RAYCAST LOGIC ---
          let hitId = -1;
          let bestDist = MAX_DIST;

          // 1. Get Shooter 3D Position & Orientation
          const originX = Transform.x[id];
          const originY = Transform.y[id] + 1.6; // Eye height offset
          const originZ = Transform.z[id];

          const yaw = Transform.rotation[id];
          const pitch = InputState.viewY[id]; // Need Pitch for 3D aiming

          // Calculate 3D Forward Vector
          // (Assuming pitch 0 is forward, -PI/2 is up, +PI/2 is down)
          const cosPitch = Math.cos(pitch);
          const sinPitch = Math.sin(pitch);
          
          const dirX = -Math.sin(yaw) * cosPitch;
          const dirY = -sinPitch; 
          const dirZ = -Math.cos(yaw) * cosPitch;

          const myTeam = Team.id[id];

          for (const tid of targets) {
            if (tid === id || Health.isDead[tid] || Team.id[tid] === myTeam) continue;

            // Target Center Position (Assuming pivot is at feet)
            const tX = Transform.x[tid];
            const tY = Transform.y[tid] + 0.9; // Aim at center of mass (1.8m / 2)
            const tZ = Transform.z[tid];

            const dx = tX - originX;
            const dy = tY - originY;
            const dz = tZ - originZ;
            
            // 3D Distance
            const distSq = dx*dx + dy*dy + dz*dz;
            
            if (distSq < MAX_DIST * MAX_DIST) {
              const dist = Math.sqrt(distSq);
              
              // Normalize vector to target
              const toTargetX = dx / dist;
              const toTargetY = dy / dist;
              const toTargetZ = dz / dist;

              // Dot Product: How close is our aim to the target vector?
              const dot = (dirX * toTargetX) + (dirY * toTargetY) + (dirZ * toTargetZ);
              
              // 0.99 is roughly an 8-degree cone, reasonable for mid-range
              // For better hitboxes, we would do Ray vs Cylinder math here
              if (dot > 0.99 && dist < bestDist) {
                bestDist = dist;
                hitId = tid;
              }
            }
          }

          // --- 3. APPLY DAMAGE ---
          if (hitId !== -1) {
            const newHp = Math.max(0, Health.current[hitId] - DAMAGE);
            Health.current[hitId] = newHp;
            
            console.log(`[Combat] Hit! ${id} -> ${hitId} (${newHp} HP)`);

            if (newHp === 0 && !Health.isDead[hitId]) {
                Health.isDead[hitId] = 1;
                
                Stats.kills[id]++;      // Shooter gets a kill
                Stats.deaths[hitId]++;  // Victim gets a death
                console.log(`[Score] Player ${id} killed ${hitId}`);

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