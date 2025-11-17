import { IWorld } from 'bitecs';
export declare const Vector3: {
    x: "f32";
    y: "f32";
    z: "f32";
};
export declare const Transform: import("bitecs").ComponentType<{
    rotation: "f32";
    x: "f32";
    y: "f32";
    z: "f32";
}>;
export declare const Velocity: import("bitecs").ComponentType<{
    x: "f32";
    y: "f32";
    z: "f32";
}>;
export declare const InputState: import("bitecs").ComponentType<{
    moveX: "f32";
    moveY: "f32";
    viewX: "f32";
    viewY: "f32";
    buttons: "ui32";
    lastTick: "ui32";
}>;
export declare const Me: import("bitecs").ComponentType<import("bitecs").ISchema>;
export interface SimWorld extends IWorld {
    time: number;
    dt: number;
    [key: string]: any;
}
