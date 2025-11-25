// apps/client-tauri/src/core/local-player.ts
import {
    addEntity,
    addComponent,
    Transform,
    Velocity,
    InputState,
    Me,
  } from '@bf42lite/engine-core';
  
  import { Health, Ammo, Soldier, Team, Loadout } from '@bf42lite/games-bf42';
  
  export function createLocalPlayer(world: any): number {
    const id = addEntity(world);
  
    addComponent(world, Transform, id);
    addComponent(world, Velocity, id);
    addComponent(world, InputState, id);
    addComponent(world, Me, id);
  
    addComponent(world, Health, id);
    addComponent(world, Ammo, id);
    addComponent(world, Soldier, id);
    addComponent(world, Team, id);
    addComponent(world, Loadout, id);
  
    return id;
  }
  