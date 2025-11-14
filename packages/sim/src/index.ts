import { createWorld, addEntity, addComponent, pipe, defineQuery } from 'bitecs';
import { Transform, Velocity, PlayerInput, Player, SimWorld } from './components';
import { createMovementSystem } from './systems/movement';
import { createRespawnSystem } from './systems/respawn';
import { createCombatSystem } from './systems/combat';
import { createGameLoopSystem } from './systems/gameloop';

// --- FIX: Added 'defineQuery' to this list ---
export { addEntity, addComponent, createWorld, pipe, defineQuery };
// --------------------------------------------

export * from './components';
export * from './systems/respawn';
export * from './systems/gameloop';

export const createSimulation = () => {
  const world = createWorld() as SimWorld;
  world.time = 0;
  world.dt = 1 / 60;

  const pipeline = pipe(
    createMovementSystem(),
    createCombatSystem(),
    createRespawnSystem(),
    createGameLoopSystem()
  );

  const step = (dt: number) => {
    world.dt = dt;
    world.time += dt;
    pipeline(world);
  };

  return { world, step };
};

export const spawnPlayer = (world: SimWorld, x: number, z: number) => {
  const eid = addEntity(world);
  addComponent(world, Transform, eid);
  addComponent(world, Velocity, eid);
  addComponent(world, PlayerInput, eid);
  addComponent(world, Player, eid);

  Transform.x[eid] = x;
  Transform.y[eid] = 0;
  Transform.z[eid] = z;
  
  return eid;
};