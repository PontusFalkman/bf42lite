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
  progress: number;
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
   */
  public static mapFlag(eid: number, world: any): RenderStateFlag {
    const raw = CapturePoint.progress[eid] || 0;
    const progress = Math.min(1, Math.abs(raw / 100)); // progress is i16 in old schema
  
    return {
      type: 'flag',
      id: eid,
      pos: {
        x: Transform.x[eid],
        y: Transform.y[eid],
        z: Transform.z[eid],
      },
      rot: 0,
      team: CapturePoint.team[eid],  // existing schema
      progress,
    };
  }  
}
