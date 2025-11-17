import { createWorld, addEntity, removeEntity, addComponent, pipe, defineQuery } from 'bitecs';
import { SimWorld } from './components';
export { addEntity, removeEntity, addComponent, createWorld, pipe, defineQuery };
export * from './components';
export * from './systems/movement';
export type System = (world: SimWorld) => SimWorld;
export type SystemFactory = () => System;
export declare const createSimulation: (gameSystems?: SystemFactory[]) => {
    world: SimWorld;
    step: (dt: number) => void;
};
