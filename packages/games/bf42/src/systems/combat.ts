import { defineSystem, defineQuery } from 'bitecs';
import { Transform, InputState, SimWorld } from '@bf42lite/sim'; 
import { Health, CombatState, GameRules, Team, Ammo, Stats, Loadout } from '../components'; // [ADD Loadout]
import { getPoseAtTick } from './history';
import { WEAPONS } from '../index'; // [IMPORT WEAPONS]

const RELOAD_TIME = 2.0;

export const createCombatSystem = () => {
  const query = defineQuery([Transform, InputState, Health, CombatState, Ammo, Team, Loadout]);
  const targetQuery = defineQuery([Transform, Health, Team, InputState]); // [ADD InputState]
  const rulesQuery = defineQuery([GameRules]);

  return defineSystem((world: SimWorld) => {
    const rulesEnts = rulesQuery(world);
    if (rulesEnts.length === 0) return world;
    const rulesId = rulesEnts[0];

    if (GameRules.state[rulesId] === 1) return world; // Game is over

    const entities = query(world);
    const targets = targetQuery(world);

    for (const id of entities) {
      if (Health.isDead[id]) continue;

      const classId = Loadout.classId[id];
      const weapon = WEAPONS[classId as keyof typeof WEAPONS] || WEAPONS[0];

      const now = world.time;

      // --- 1. Handle Reloading ---
      if (CombatState.isReloading[id]) {
        if (now - CombatState.reloadStartTime[id] > RELOAD_TIME) {
          // Finish reload
          const needed = Ammo.magSize[id] - Ammo.current[id];
          const pulled = Math.min(Ammo.reserve[id], needed);
          Ammo.current[id] += pulled;
          Ammo.reserve[id] -= pulled;
          CombatState.isReloading[id] = 0;
        }
        continue; // Can't shoot while reloading
      }

      const isShooting = InputState.axes.shoot[id] === 1;
      const isReloading = InputState.axes.reload[id] === 1;

      // --- 2. Handle Firing ---
      if (isShooting && Ammo.current[id] > 0) {
        if (now - CombatState.lastFireTime[id] > weapon.rate) {
          CombatState.lastFireTime[id] = now;
          Ammo.current[id]--;

          // --- 3. Perform Raycast ---
          // [FIX] Call with 2 args: (id, tick)
          const pose = getPoseAtTick(id, InputState.lastTick[id]); 
          if (!pose) continue; // No history for this tick, skip

          // [FIX] Access pose.pos.x, pose.pos.y, etc.
          const originX = pose.pos.x;
          const originY = pose.pos.y + 1.6; // Eye height
          const originZ = pose.pos.z;
          // [FIX] Access pose.dir.x, pose.dir.y, etc.
          const dirX = pose.dir.x;
          const dirY = pose.dir.y;
          const dirZ = pose.dir.z;

          let bestDist = weapon.range * weapon.range;
          let hitId = -1;

          for (const tid of targets) {
            if (tid === id || Health.isDead[tid]) continue;
            if (Team.id[tid] === Team.id[id]) continue; // No friendly fire

            // [FIX] Change const to let
            let targetPos = getPoseAtTick(tid, InputState.lastTick[tid]);
            
            // [FIX] Check for null *before* reassigning
            if (!targetPos) {
              // Target hasn't sent an update, use latest transform
              targetPos = { 
                pos: { x: Transform.x[tid], y: Transform.y[tid], z: Transform.z[tid] }, 
                dir: { x: 0, y: 0, z: 0 } // Dir doesn't matter here
              };
            }

            // Simple sphere check
            // [FIX] Access targetPos.pos.x, etc.
            const tX = targetPos.pos.x;
            const tY = targetPos.pos.y + 0.9; // Center mass
            const tZ = targetPos.pos.z;

            const dx = tX - originX;
            const dy = tY - originY;
            const dz = tZ - originZ;
            
            const distSq = dx*dx + dy*dy + dz*dz;
            
            if (distSq < weapon.range * weapon.range) {
              const dist = Math.sqrt(distSq);
              const toTargetX = dx / dist;
              const toTargetY = dy / dist;
              const toTargetZ = dz / dist;

              // Check if ray is pointing at target
              const dot = (dirX * toTargetX) + (dirY * toTargetY) + (dirZ * toTargetZ);
              
              // 0.99 = ~8 degrees
              if (dot > 0.99 && dist < bestDist) {
                bestDist = dist;
                hitId = tid;
              }
            }
          }

          if (hitId !== -1) {
            const newHp = Math.max(0, Health.current[hitId] - weapon.damage);
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
      // --- 4. Handle Reload (if not shooting) ---
      else if (isReloading) {
          if (Ammo.current[id] < Ammo.magSize[id] && Ammo.reserve[id] > 0) {
              CombatState.isReloading[id] = 1;
              CombatState.reloadStartTime[id] = world.time;
          }
      }
    }

    return world;
  });
};