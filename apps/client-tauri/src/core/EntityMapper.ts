// apps/client-tauri/src/core/EntityMapper.ts
//
// Convert ECS components into clean, renderer-ready RenderState objects.
// This keeps rendering code 100% independent from ECS internals.

import {
  Transform,
  InputState,
} from '@bf42lite/engine-core';

import {
  Soldier,
  Team,
  CapturePoint,
} from '@bf42lite/games-bf42';

export type RenderStatePlayer = {
  type: 'player';
  id: number;
  pos: { x: number; y: number; z: number };
  rot: number;
  pitch: number;
  team: number;
};

export type RenderStateFlag = {
  type: 'flag';
  id: number;
  pos: { x: number; y: number; z: number };
  rot: number;
  team: number;
  progress: number; // normalized -1..1 (sign = which team is capturing)
};

export type RenderState = RenderStatePlayer | RenderStateFlag;

export class EntityMapper {
  /**
   * Convert a player ECS entity into a RenderStatePlayer.
   */
  public static mapPlayer(eid: number, world: any, isMe: boolean): RenderStatePlayer {
    return {
      type: 'player',
      id: eid,
      pos: {
        x: Transform.x[eid],
        y: Transform.y[eid],
        z: Transform.z[eid],
      },
      rot: Transform.rotation[eid],
      pitch: isMe ? InputState.viewY[eid] : 0,
      team: Team.id[eid],
    };
  }

  /**
   * Convert a flag ECS entity into a RenderStateFlag.
   *
   * CapturePoint schema (client ECS):
   * - radius: f32
   * - owner:  0 = none, 1 = TeamA, 2 = TeamB
   * - capture: f32 (server-side value, usually in [-1, 1])
   */
  public static mapFlag(eid: number, world: any): RenderStateFlag {
    // Raw capture from ECS (comes from Snapshot.flags[].capture)
    const raw =
      (CapturePoint as any).capture
        ? (CapturePoint as any).capture[eid] ?? 0
        : 0;

    // Normalize to -1..1, preserving sign.
    // If the server ever sends -100..100 again, this still works.
    let progress: number;
    if (Math.abs(raw) <= 1.001) {
      progress = raw;
    } else {
      progress = Math.max(-1, Math.min(1, raw / 100));
    }

    // Owner numeric team id (0/1/2)
    const team =
      (CapturePoint as any).owner
        ? (CapturePoint as any).owner[eid] ?? 0
        : 0;

    return {
      type: 'flag',
      id: eid,
      pos: {
        x: Transform.x[eid],
        y: Transform.y[eid],
        z: Transform.z[eid],
      },
      rot: 0,
      team,
      progress,
    };
  }
}
