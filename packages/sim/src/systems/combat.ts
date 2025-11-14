import { defineSystem, defineQuery } from 'bitecs';
import { Transform, PlayerInput, Health, CombatState, SimWorld } from '../components';

const FIRE_RATE = 0.15;
const DAMAGE = 25;
const MAX_DIST = 100;

export const createCombatSystem = () => {
  // Query players who can shoot
  const query = defineQuery([Transform, PlayerInput, Health, CombatState]);
  // Query potential targets
  const targetQuery = defineQuery([Transform, Health]);

  return defineSystem((world: SimWorld) => {
    const entities = query(world);
    const targets = targetQuery(world);

    for (let i = 0; i < entities.length; ++i) {
      const id = entities[i];

      // 1. Check Firing Input & Cooldown
      if (PlayerInput.shoot[id] && !Health.isDead[id]) {
        const now = world.time;
        if (now - CombatState.lastFireTime[id] >= FIRE_RATE) {
          
          // FIRE!
          CombatState.lastFireTime[id] = now;
          
          // 2. Perform "Math Raycast"
          // We don't have Three.js here, so we do a simple check:
          // Is any enemy close enough AND within a narrow angle of our view?
          
          let hitId = -1;
          let bestDist = MAX_DIST;

          for (let t = 0; t < targets.length; ++t) {
            const tid = targets[t];
            if (tid === id || Health.isDead[tid]) continue; // Don't shoot self or dead people

            // Vector to Target
            const dx = Transform.x[tid] - Transform.x[id];
            const dz = Transform.z[tid] - Transform.z[id];
            const dy = (Transform.y[tid] + 1) - (Transform.y[id] + 1.6); // Head to Body center approx

            const dist = Math.sqrt(dx*dx + dz*dz + dy*dy);
            
            if (dist < MAX_DIST) {
              // Check Angle (Dot Product)
              // Our Look Vector
              const yaw = Transform.rotation[id]; // Wait, we need to map PlayerInput.yaw to Transform.rotation in movement system first!
              // Assuming movement system ran first, Transform.rotation is accurate for body. 
              // But for shooting we need precise Pitch too.
              
              // Simplified "Cone" Hit Detection for MVP:
              // If you are close to the center of my screen...
              const lookX = -Math.sin(yaw);
              const lookZ = -Math.cos(yaw);
              
              // Normalize direction to target
              const dirX = dx / dist;
              const dirZ = dz / dist;

              // Dot product tells us how "aligned" they are
              const dot = (lookX * dirX) + (lookZ * dirZ);
              
              // If dot > 0.95, it's roughly a hit in front of us (approx 18 degree cone)
              // This is "Arcade" shooting. For precision, we'd need full 3D math.
              if (dot > 0.95 && dist < bestDist) {
                bestDist = dist;
                hitId = tid;
              }
            }
          }

          // 3. Apply Hit
          if (hitId !== -1) {
            console.log(`Player ${id} hit Player ${hitId} for ${DAMAGE} dmg!`);
            Health.current[hitId] -= DAMAGE;
            if (Health.current[hitId] <= 0) {
                Health.current[hitId] = 0;
                Health.isDead[hitId] = 1;
                console.log(`Player ${hitId} died!`);
                // TODO: Handle Respawn
            }
          }
        }
      }
    }
    return world;
  });
};