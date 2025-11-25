// apps/client-tauri/src/core/render-update.ts
import { updateGameFrame } from '../systems/updateGameFrame';
import type { Renderer } from './Renderer';
import type { InputManager } from './InputManager';
import type { WeaponSystem } from './WeaponSystem';

export function updateRenderFrame(
  dt: number,
  renderer: Renderer,
  input: InputManager,
  weapon: WeaponSystem
) {
  updateGameFrame(dt, renderer, input, weapon);
}
