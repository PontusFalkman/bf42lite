import { SimWorld } from '../components';
export declare const MOVEMENT_CONSTANTS: {
    MOVE_SPEED: number;
    AIR_SPEED_FACTOR: number;
    GRAVITY: number;
    JUMP_FORCE: number;
};
export declare const MOVEMENT_VERSION = "movement-v1.0.0";
export declare const createMovementSystem: () => import("bitecs").System<[], SimWorld>;
