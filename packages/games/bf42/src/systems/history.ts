import { defineSystem, defineQuery } from 'bitecs';
import { Transform, SimWorld } from '@bf42lite/sim';
import { Health, Team } from '../components';

// 1. The "Tape Recorder"
// Map<Tick, Map<EntityId, {x, y, z}>>
const historyBuffer = new Map<number, Map<number, {x: number, y: number, z: number}>>();
const MAX_HISTORY = 60; // Keep 1 second of history

// 2. The "Rewind" Function (Combat will use this)
export const getPoseAtTick = (tick: number, eid: number) => {
  const frame = historyBuffer.get(tick);
  if (!frame) return null; // History too old or didn't exist
  return frame.get(eid);
};

export const createHistorySystem = () => {
  // Track all living players
  const query = defineQuery([Transform, Health, Team]);

  return defineSystem((world: SimWorld) => {
    // Calculate current integer tick (rounding handles float precision errors)
    const tick = Math.round(world.time * 60);

    const frame = new Map<number, {x: number, y: number, z: number}>();
    const entities = query(world);

    // Snapshot everyone
    for (const id of entities) {
      frame.set(id, {
        x: Transform.x[id],
        y: Transform.y[id],
        z: Transform.z[id]
      });
    }

    // Save to buffer
    historyBuffer.set(tick, frame);

    // Delete old history (Memory Management)
    const oldTick = tick - MAX_HISTORY;
    if (historyBuffer.has(oldTick)) {
        historyBuffer.delete(oldTick);
    }

    return world;
  });
};