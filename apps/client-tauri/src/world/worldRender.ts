// apps/client-tauri/src/world/worldRender.ts

import {
    defineQuery,
    Transform,
    InputState,
  } from '@bf42lite/engine-core';
  import { Soldier, CapturePoint, Team, Health } from '@bf42lite/games-bf42';
  
  import type { Renderer } from '../core/Renderer';
  import type { UIManager } from '../managers/UIManager';
  
  // ECS queries for players and flags
  const playerQuery = defineQuery([Transform, Soldier]);
  const flagQuery = defineQuery([CapturePoint, Transform]);
  
  /**
   * Single place responsible for:
   * - Updating HUD stats from ECS
   * - Rendering players and flags via Renderer
   */
  export function updateWorldRender(
    world: any,
    renderer: Renderer,
    ui: UIManager,
    localEntityId: number,
    currentFps: number,
    lastRtt: number,
  ) {
    // UI stats + health
    ui.updateStats(currentFps, lastRtt);
    if (localEntityId >= 0) {
      ui.updateHealth(Health.current[localEntityId]);
    }
  
    // Render players
    const players = playerQuery(world);
    for (const eid of players) {
      const isMe = eid === localEntityId;
  
      const state = {
        type: 'player' as const,
        pos: {
          x: Transform.x[eid],
          y: Transform.y[eid],
          z: Transform.z[eid],
        },
        rot: Transform.rotation[eid],
        pitch: isMe ? InputState.viewY[eid] : 0,
        team: Team.id[eid],
      };
  
      renderer.updateEntity(eid, state, isMe);
    }
  
    // Render flags (capture points)
    const flags = flagQuery(world);
    for (const eid of flags) {
        const raw = CapturePoint.progress[eid] || 0;
        const progress = Math.min(1, Math.abs(raw / 100));
        
        const state = {
          type: 'flag' as const,
          pos: {
            x: Transform.x[eid],
            y: Transform.y[eid],
            z: Transform.z[eid],
          },
          team: CapturePoint.team[eid],    // existing schema
          progress,
        };
        
  
      renderer.updateEntity(eid, state, false);
    }
  
    // Final frame
    renderer.render();
  }
  