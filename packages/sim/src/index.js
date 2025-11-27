import { createWorld, addEntity, removeEntity, addComponent, pipe, defineQuery } from 'bitecs';
import { createMovementSystem } from './systems/movement';
export { addEntity, removeEntity, addComponent, createWorld, pipe, defineQuery };
export * from './components';
export * from './systems/movement';
export const createSimulation = (gameSystems = []) => {
    const world = createWorld();
    world.time = 0;
    world.dt = 1 / 60;
    const coreSystems = [
        createMovementSystem()
    ];
    const pipeline = pipe(...coreSystems, ...gameSystems.map(create => create()));
    const step = (dt) => {
        world.dt = dt;
        world.time += dt;
        pipeline(world);
    };
    return { world, step };
};
