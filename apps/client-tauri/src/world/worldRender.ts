// apps/client-tauri/src/world/worldRender.ts

import { defineQuery } from '@bf42lite/engine-core';
import { Soldier, CapturePoint, Health } from '@bf42lite/games-bf42';

import { EntityMapper } from '../core/EntityMapper';
import type { Renderer } from '../core/Renderer';
import type { HUDUpdater } from '../ui/HUDUpdater';

// ECS queries for players and flags
const playerQuery = defineQuery([Soldier]);
const flagQuery = defineQuery([CapturePoint]);

/**
 * Build and send all render + HUD state for this frame.
 *
 * - Renders all players (local + remote).
 * - Renders all flags (Conquest points).
 * - Updates basic HUD stats (FPS / RTT / Health).
 */
export function updateWorldRender(
  world: any,
  renderer: Renderer,
  hud: HUDUpdater,
  localEntityId: number,
  fps: number,
  rttMs: number,
): void {
  // Basic HUD stats
  hud.updateStats(fps, rttMs);

  if (localEntityId >= 0) {
    const hp = Health.current[localEntityId] ?? 0;
    hud.updateHealth(hp);
  }

  // === PLAYERS ===
  const players = playerQuery(world);
  for (const eid of players) {
    const state = EntityMapper.mapPlayer(eid, world, eid === localEntityId);
    renderer.updateEntity(eid, state, eid === localEntityId);
  }

  // === FLAGS (CONQUEST POINTS) ===
  const flags = flagQuery(world);
  for (const eid of flags) {
    const state = EntityMapper.mapFlag(eid, world);

    // Optional debug:
    // console.log('[FLAG-RENDER]', eid, state.team, state.progress);

    renderer.updateEntity(eid, state, false);
  }

  // Final frame
  renderer.render();
}
