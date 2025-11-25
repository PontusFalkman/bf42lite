// apps/client-tauri/src/systems/PredictionSystem.ts
//
// Encapsulates client-side movement prediction:
//
// - Reads input for the current tick
// - Writes InputState for the local entity
// - Runs the movement system (local prediction)
// - Pushes the predicted state into Reconciler history
// - Returns the ClientInput so caller can send it to the server

import { Transform, type SimWorld } from '@bf42lite/engine-core';
import type { ClientInput } from '@bf42lite/protocol';

import type { InputManager } from '../core/InputManager';
import type { Reconciler } from './Reconciler';
import { updateGameFrame } from './updateGameFrame';

export class PredictionSystem {
  private world: SimWorld;
  private input: InputManager;
  private movementSystem: (world: SimWorld) => void;
  private reconciler: Reconciler;
  private getLocalEntityId: () => number;

  /**
   * @param world           ECS world used by the simulation.
   * @param input           Input manager providing per-tick commands.
   * @param movementSystem  Movement system function (e.g. createMovementSystem()).
   * @param reconciler      Reconciler used to store prediction history.
   * @param getLocalEntityId Function returning the current local player entity id.
   */
  constructor(
    world: SimWorld,
    input: InputManager,
    movementSystem: (world: SimWorld) => void,
    reconciler: Reconciler,
    getLocalEntityId: () => number,
  ) {
    this.world = world;
    this.input = input;
    this.movementSystem = movementSystem;
    this.reconciler = reconciler;
    this.getLocalEntityId = getLocalEntityId;
  }

  /**
   * Run one prediction step.
   *
   * - Applies local input to InputState
   * - Steps the movement system
   * - Records the predicted position into Reconciler history
   *
   * Returns the ClientInput so the caller can send it over the network.
   */
  public update(dt: number, tick: number): ClientInput | null {
    const localEntityId = this.getLocalEntityId();

    // 1) Per-frame input + movement prediction
    const cmd = updateGameFrame(
      dt,
      tick,
      localEntityId,
      this.world,
      this.input,
      this.movementSystem,
    ) as ClientInput | null;

    // 2) Store prediction history for reconciliation
    if (localEntityId >= 0 && cmd) {
      this.reconciler.pushHistory(
        tick,
        cmd,
        Transform.x[localEntityId],
        Transform.y[localEntityId],
        Transform.z[localEntityId],
      );
    }

    return cmd;
  }
}
