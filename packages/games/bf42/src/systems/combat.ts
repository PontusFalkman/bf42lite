import { defineSystem, defineQuery } from 'bitecs';
import { Transform, InputState, SimWorld } from '@bf42lite/sim'; 
import { Health, CombatState, GameRules, Team, Ammo, Stats } from '../components';
import { getPoseAtTick } from './history'; // <--- Import this

const FIRE_RATE = 0.15;
const DAMAGE = 25;
const MAX_DIST = 100;
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

    if (GameRules.state[rulesId] === 1) return world; 

    const entities = query(world);
    const targets = targetQuery(world);

    for (const id of entities) {
      if (Health.isDead[id]) continue;

      const now = world.time;
      const isShooting = (InputState.buttons[id] & BUTTON_FIRE) !== 0;
      const isReloading = (InputState.buttons[id] & BUTTON_RELOAD) !== 0;

      // --- RELOAD LOGIC ---
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
          continue; 
      }

      // --- FIRING LOGIC ---
      if (isShooting && Ammo.current[id] > 0) {
        if (now - CombatState.lastFireTime[id] >= FIRE_RATE) {
          CombatState.lastFireTime[id] = now;
          Ammo.current[id]--;

          // 1. Get Shooter Info (Use CURRENT position for shooter)
          const originX = Transform.x[id];
          const originY = Transform.y[id] + 1.6; 
          const originZ = Transform.z[id];
          const yaw = Transform.rotation[id];
          const pitch = InputState.viewY[id]; 

          // The tick the client claimed they were at when they fired
          const clientTick = InputState.lastTick[id];

          const cosPitch = Math.cos(pitch);
          const sinPitch = Math.sin(pitch);
          const dirX = -Math.sin(yaw) * cosPitch;
          const dirY = -sinPitch; 
          const dirZ = -Math.cos(yaw) * cosPitch;

          let hitId = -1;
          let bestDist = MAX_DIST;
          const myTeam = Team.id[id];

          // 2. Check Targets using HISTORY
          for (const tid of targets) {
            if (tid === id || Health.isDead[tid] || Team.id[tid] === myTeam) continue;

            // --- THE TIME TRAVEL MAGIC ---
            // Try to get where the target was at 'clientTick'
            let targetPos = getPoseAtTick(clientTick, tid);

            // Fallback: If history is missing (too old or brand new), use current
            if (!targetPos) {
                targetPos = { x: Transform.x[tid], y: Transform.y[tid], z: Transform.z[tid] };
            }
            // -----------------------------

            const tX = targetPos.x;
            const tY = targetPos.y + 0.9; 
            const tZ = targetPos.z;

            const dx = tX - originX;
            const dy = tY - originY;
            const dz = tZ - originZ;
            
            const distSq = dx*dx + dy*dy + dz*dz;
            
            if (distSq < MAX_DIST * MAX_DIST) {
              const dist = Math.sqrt(distSq);
              const toTargetX = dx / dist;
              const toTargetY = dy / dist;
              const toTargetZ = dz / dist;

              const dot = (dirX * toTargetX) + (dirY * toTargetY) + (dirZ * toTargetZ);
              
              if (dot > 0.99 && dist < bestDist) {
                bestDist = dist;
                hitId = tid;
              }
            }
          }

          if (hitId !== -1) {
            const newHp = Math.max(0, Health.current[hitId] - DAMAGE);
            Health.current[hitId] = newHp;
            
            if (newHp === 0 && !Health.isDead[hitId]) {
                Health.isDead[hitId] = 1;
                Stats.kills[id]++;
                Stats.deaths[hitId]++;
                
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