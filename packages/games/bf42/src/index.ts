import { SimWorld, addComponent, createMovementSystem, SystemFactory, InputState, Transform } from '@bf42lite/sim';
import { createCombatSystem } from './systems/combat';
import { createRespawnSystem } from './systems/respawn';
import { createGameLoopSystem } from './systems/gameloop';
import * as Components from './components';

// Export components so Host can use them if needed
export * from './components';

// 1. Define the Systems
export const getSystems = (): SystemFactory[] => [
  createMovementSystem, // Generic Physics
  createCombatSystem,   // BF42 Combat
  createRespawnSystem,  // BF42 Spawning
  createGameLoopSystem  // BF42 Ticket/Win State
];

// 2. Player Factory
let globalPlayerCount = 0;

export const onPlayerJoin = (world: SimWorld, eid: number) => {
  // Core Engine Components
  addComponent(world, Transform, eid);
  addComponent(world, InputState, eid);
  
  // Game Specific Components
  addComponent(world, Components.Health, eid);
  addComponent(world, Components.Ammo, eid);
  addComponent(world, Components.CombatState, eid);
  addComponent(world, Components.Team, eid);
  addComponent(world, Components.Soldier, eid);

  // Init Stats
  Components.Health.current[eid] = 100;
  Components.Health.max[eid] = 100;
  Components.Health.isDead[eid] = 0;

  Components.Ammo.current[eid] = 30; 
  Components.Ammo.magSize[eid] = 30;
  Components.Ammo.reserve[eid] = 120;

  // TEAM ASSIGNMENT: Alternating (1=Axis, 2=Allies)
  const teamId = (globalPlayerCount % 2) + 1;
  Components.Team.id[eid] = teamId;
  globalPlayerCount++;

  console.log(`[BF42] Player ${eid} joined Team ${teamId === 1 ? 'Axis' : 'Allies'}`);
};

// 3. Input Processor
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

  // Reload Trigger
  if (input.axes.reload) {
      if (!Components.CombatState.isReloading[eid]) {
          Components.CombatState.isReloading[eid] = 1;
          Components.CombatState.reloadStartTime[eid] = world.time;
      }
  }
};

// 4. State Serializer
export const getPlayerState = (world: SimWorld, eid: number) => {
  return {
      id: eid,
      pos: { x: Transform.x[eid], y: Transform.y[eid], z: Transform.z[eid] },
      // FIX: Added 'vel' to satisfy Protocol Snapshot interface
      vel: { x: 0, y: 0, z: 0 }, 
      rot: Transform.rotation[eid],
      health: Components.Health.current[eid],
      isDead: Boolean(Components.Health.isDead[eid]),
      ammo: Components.Ammo.current[eid],
      ammoRes: Components.Ammo.reserve[eid],
      team: Components.Team.id[eid], 
      lastProcessedTick: InputState.lastTick[eid]
  };
};