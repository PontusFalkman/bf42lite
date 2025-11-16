import { SimWorld, addComponent, createMovementSystem, SystemFactory, InputState, Transform } from '@bf42lite/sim';
import { createCombatSystem } from './systems/combat';
import { createRespawnSystem } from './systems/respawn';
import { createGameLoopSystem } from './systems/gameloop';
import * as Components from './components';

export * from './components';

export const getSystems = (): SystemFactory[] => [
  createMovementSystem,
  createCombatSystem,
  createRespawnSystem,
  createGameLoopSystem
];

let globalPlayerCount = 0;

export const onPlayerJoin = (world: SimWorld, eid: number) => {
  addComponent(world, Transform, eid);
  addComponent(world, InputState, eid);
  
  addComponent(world, Components.Health, eid);
  addComponent(world, Components.Ammo, eid);
  addComponent(world, Components.CombatState, eid);
  addComponent(world, Components.Team, eid);
  addComponent(world, Components.Soldier, eid);
  addComponent(world, Components.Stats, eid);


  Components.Stats.kills[eid] = 0;
  Components.Stats.deaths[eid] = 0;
  // --- CHANGE START: Spawn as "Dead/Waiting" ---
  
  // 1. Set status to Dead so UI triggers
  Components.Health.current[eid] = 0;
  Components.Health.max[eid] = 100;
  Components.Health.isDead[eid] = 1;

  // 2. Add Timer manually, set to 0 so they don't wait 3s
  addComponent(world, Components.RespawnTimer, eid);
  Components.RespawnTimer.timeLeft[eid] = 0; 

  // 3. Hide them under the map ("Purgatory")
  Transform.x[eid] = 0;
  Transform.z[eid] = 0;
  Transform.y[eid] = -50; 

  // --- CHANGE END ---

  Components.Ammo.current[eid] = 30; 
  Components.Ammo.magSize[eid] = 30;
  Components.Ammo.reserve[eid] = 120;

  const teamId = (globalPlayerCount % 2) + 1;
  Components.Team.id[eid] = teamId;
  globalPlayerCount++;

  console.log(`[BF42] Player ${eid} joined Team ${teamId === 1 ? 'Axis' : 'Allies'} (Waiting to Deploy)`);
};

export const processInput = (world: SimWorld, eid: number, input: any) => {
  const BUTTON_JUMP = 1;
  const BUTTON_FIRE = 2;
  const BUTTON_RELOAD = 4;

  InputState.moveY[eid] = input.axes.forward; 
  InputState.moveX[eid] = input.axes.right;
  InputState.viewX[eid] = input.axes.yaw;
  InputState.viewY[eid] = input.axes.pitch;
  InputState.lastTick[eid] = input.tick;

  let buttons = 0;
  if (input.axes.jump) buttons |= BUTTON_JUMP;
  if (input.axes.shoot) buttons |= BUTTON_FIRE;
  if (input.axes.reload) buttons |= BUTTON_RELOAD;
  InputState.buttons[eid] = buttons;

  if (input.axes.reload) {
      if (!Components.CombatState.isReloading[eid]) {
          Components.CombatState.isReloading[eid] = 1;
          Components.CombatState.reloadStartTime[eid] = world.time;
      }
  }
};

export const getPlayerState = (world: SimWorld, eid: number) => {
  return {
      id: eid,
      pos: { x: Transform.x[eid], y: Transform.y[eid], z: Transform.z[eid] },
      vel: { x: 0, y: 0, z: 0 }, 
      rot: Transform.rotation[eid],
      health: Components.Health.current[eid],
      isDead: Boolean(Components.Health.isDead[eid]),
      // Ensure this field is here from Step 3
      respawnTimer: Components.RespawnTimer.timeLeft[eid] || 0,
      kills: Components.Stats.kills[eid] || 0,
      deaths: Components.Stats.deaths[eid] || 0,
      ammo: Components.Ammo.current[eid],
      ammoRes: Components.Ammo.reserve[eid],
      team: Components.Team.id[eid], 
      lastProcessedTick: InputState.lastTick[eid]
  };
};