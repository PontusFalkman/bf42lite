// apps/client-tauri/src/systems/MovementSystem.ts
//
// Thin wrapper around the core movement system from @bf42lite/engine-core.
// This gives the client its own named MovementSystem module, while still
// using exactly the same underlying ECS movement logic as the server.

import {
  createMovementSystem,
  type SimWorld,
  type System,
} from '@bf42lite/engine-core';

// Alias for clarity in the client layer
export type MovementSystem = System;

/**
 * Create the client movement system.
 *
 * Under the hood this is the same createMovementSystem() that the
 * engine uses for the simulation pipeline.
 */
export function createClientMovementSystem(): MovementSystem {
  return createMovementSystem();
}

/**
 * Optional helper if you prefer an object-style API.
 * Not required for your existing code; provided for future use.
 */
export class MovementSystemRunner {
  private readonly system: MovementSystem;

  constructor() {
    this.system = createMovementSystem();
  }

  /**
   * Step movement once for the given world.
   */
  public update(world: SimWorld): void {
    this.system(world);
  }
}
