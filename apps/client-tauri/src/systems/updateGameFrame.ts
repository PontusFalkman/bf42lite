// src/systems/updateGameFrame.ts

import { InputState, type SimWorld } from '@bf42lite/engine-core';
import type { InputManager } from '../core/InputManager';

/**
 * One per-frame client update:
 * - Read input
 * - Write into InputState for the local entity
 * - Run the movement system
 * - Return the input command so the caller can push history / send to server
 */
export function updateGameFrame(
  dt: number,
  currentTick: number,
  localEntityId: number,
  simWorld: SimWorld,
  input: InputManager,
  movementSystem: (world: SimWorld) => void,
) {
  // 1. Read input for this tick
  const cmd = input.getCommand(currentTick);

  // 2. Write into ECS input components for the local entity
  if (localEntityId >= 0) {
    InputState.moveY[localEntityId] = cmd.axes.forward;
    InputState.moveX[localEntityId] = cmd.axes.right;
    InputState.viewX[localEntityId] = cmd.axes.yaw;
    InputState.viewY[localEntityId] = cmd.axes.pitch;

    // Button bitmask:
    // bit 0: jump
    // bit 1: shoot  (used by WeaponSystem via InputState.buttons & 2)
    // bit 2: reload
    let buttons = 0;
    if (cmd.axes.jump)   buttons |= 1;
    if (cmd.axes.shoot)  buttons |= 2;
    if (cmd.axes.reload) buttons |= 4;

    InputState.buttons[localEntityId] = buttons;
  }

  // 3. Run movement (local prediction)
  movementSystem(simWorld);

  // 4. Hand the command back to ClientGame
  return cmd;
}
