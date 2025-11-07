import { createWorld, IWorld } from "bitecs";
import { MovementSystem } from "./systems"; // <-- This path is now corrected

// Export the world so other files can access it
export const world = createWorld() as IWorld & { dt: number };

// Set the fixed delta time (1/60th of a second)
world.dt = 1 / 60;

export function step() {
  // dt is already on the world object, MovementSystem will use it
  MovementSystem(world);
}