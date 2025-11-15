import { createWorld, addEntity, removeEntity, addComponent, pipe, defineQuery, IWorld } from 'bitecs';
import { SimWorld } from './components';
import { createMovementSystem } from './systems/movement';

export { addEntity, removeEntity, addComponent, createWorld, pipe, defineQuery };
export * from './components';
export * from './systems/movement';

// FIX: Define the System type manually since bitecs might not export ISystem
export type System = (world: SimWorld) => SimWorld;
export type SystemFactory = () => System;

export const createSimulation = (gameSystems: SystemFactory[] = []) => {
  const world = createWorld() as SimWorld;
  world.time = 0;
  world.dt = 1 / 60;

  const coreSystems = [
    createMovementSystem() 
  ];

  const pipeline = pipe(
    ...coreSystems,
    ...gameSystems.map(create => create())
  );

  const step = (dt: number) => {
    world.dt = dt;
    world.time += dt;
    pipeline(world);
  };

  return { world, step };
};