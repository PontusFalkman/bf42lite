// apps/client-tauri/src/world/worldRender.ts

import {
  defineQuery,
  Transform,
  InputState,
} from '@bf42lite/engine-core';
import {
  Soldier,
  CapturePoint,
  Team,
  Health,
} from '@bf42lite/games-bf42';

import type { Renderer } from '../core/Renderer';
import type { UIManager } from '../managers/UIManager';

// ECS queries for players and flags
const playerQuery = defineQuery([Transform, Soldier]);
const flagQuery = defineQuery([CapturePoint, Transform]);

/**
 * Normalize capture progress into -1..1 for FlagVisual.
 *
 * Supports both legacy integer schemas (-100..100 or 0..100)
 * and the newer float -1..1 schema.
 */
function normalizeProgress(raw: number | undefined): number {
  const value = raw ?? 0;

  // Already in -1..1 range
  if (Math.abs(value) <= 1.001) {
    return value;
  }

  // Legacy i16 style: -100..100 or 0..100
  const scaled = value / 100;
  return Math.max(-1, Math.min(1, scaled));
}

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
  ui: UIManager,
  localEntityId: number,
  fps: number,
  rttMs: number,
): void {
  // Basic HUD stats
  ui.updateStats(fps, rttMs);

  if (localEntityId >= 0) {
    const hp = Health.current[localEntityId] ?? 0;
    ui.updateHealth(hp);
  }

  // === PLAYERS ===
  const players = playerQuery(world);

  for (const eid of players) {
    const isLocal = eid === localEntityId;

    const state = {
      type: 'player' as const,
      pos: {
        x: Transform.x[eid],
        y: Transform.y[eid],
        z: Transform.z[eid],
      },
      // Yaw comes from Transform; pitch from input state (if present)
      rot: Transform.rotation[eid] ?? 0,
      pitch: InputState.viewY ? InputState.viewY[eid] ?? 0 : 0,
      team: Team.id ? Team.id[eid] ?? 0 : 0,
    };

    renderer.updateEntity(eid, state, isLocal);
  }

  // === FLAGS (CONQUEST POINTS) ===
  const flags = flagQuery(world);

  for (const eid of flags) {
    const rawProgress =
      CapturePoint.progress ? CapturePoint.progress[eid] : 0;
    const progress = normalizeProgress(rawProgress);

    const state = {
      type: 'flag' as const,
      pos: {
        x: Transform.x[eid],
        y: Transform.y[eid],
        z: Transform.z[eid],
      },
      // CapturePoint.team is expected to map to TEAM_IDS.* on the client
      team: CapturePoint.team ? CapturePoint.team[eid] ?? 0 : 0,
      progress,
    };

    renderer.updateEntity(eid, state, false);
  }

  // Final frame
  renderer.render();
}
