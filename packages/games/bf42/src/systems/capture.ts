import { defineSystem, defineQuery } from 'bitecs';
import { Transform, SimWorld } from '@bf42lite/engine-core';
import { CapturePoint, Team, Health } from '../components';

const CAPTURE_RATE = 20; // Points per second
const MAX_PROGRESS = 100;

export const createCaptureSystem = () => {
  const flagQuery = defineQuery([CapturePoint, Transform]);
  const soldierQuery = defineQuery([Team, Transform, Health]);

  return defineSystem((world: SimWorld) => {
    const dt = world.dt;
    const flags = flagQuery(world);
    const soldiers = soldierQuery(world);

    for (const fid of flags) {
      const fx = Transform.x[fid];
      const fz = Transform.z[fid];
      const radius = CapturePoint.radius[fid];

      let axisCount = 0;
      let alliesCount = 0;

      // 1. Count Players in Zone
      for (const sid of soldiers) {
        if (Health.isDead[sid]) continue;

        const dx = Transform.x[sid] - fx;
        const dz = Transform.z[sid] - fz;
        
        // Simple distance check
        if (dx*dx + dz*dz <= radius * radius) {
           const team = Team.id[sid];
           if (team === 1) axisCount++;
           if (team === 2) alliesCount++;
        }
      }

      // 2. Calculate Influence
      let influence = 0;
      if (axisCount > alliesCount) influence = -1;      // Pull towards Axis (Negative)
      else if (alliesCount > axisCount) influence = 1;  // Pull towards Allies (Positive)

      // 3. Update Progress
      if (influence !== 0) {
        const change = influence * CAPTURE_RATE * dt;
        CapturePoint.progress[fid] += change;
        
        // Clamp
        if (CapturePoint.progress[fid] > MAX_PROGRESS) CapturePoint.progress[fid] = MAX_PROGRESS;
        if (CapturePoint.progress[fid] < -MAX_PROGRESS) CapturePoint.progress[fid] = -MAX_PROGRESS;
      }

      // 4. Determine Owner
      const current = CapturePoint.progress[fid];
      if (current <= -MAX_PROGRESS) CapturePoint.team[fid] = 1; // Axis Owned
      else if (current >= MAX_PROGRESS) CapturePoint.team[fid] = 2; // Allies Owned
      else if (Math.abs(current) < 10) CapturePoint.team[fid] = 0; // Neutral
    }

    return world;
  });
};
