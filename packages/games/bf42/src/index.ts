import { SimWorld, addComponent, addEntity, createMovementSystem, SystemFactory, InputState, Transform, defineQuery } from '@bf42lite/sim'; // <--- ADD defineQuery
import { createCombatSystem } from './systems/combat';
import { createRespawnSystem } from './systems/respawn';
import { createGameLoopSystem } from './systems/gameloop';
import { createHistorySystem } from './systems/history';
import { createCaptureSystem } from './systems/capture'; 
import * as Components from './components';

export * from './components';

export const getSystems = (): SystemFactory[] => [
  createMovementSystem,
  createHistorySystem,
  createCombatSystem,
  createRespawnSystem,
  createCaptureSystem,
  createGameLoopSystem
];

// --- QUERIES FOR SNAPSHOTS ---
const soldierQuery = defineQuery([Components.Soldier, Transform]);
const flagQuery = defineQuery([Components.CapturePoint, Transform]);

let globalPlayerCount = 0;

export const initGameWorld = (world: SimWorld) => {
    const flag = addEntity(world);
    addComponent(world, Transform, flag);
    addComponent(world, Components.CapturePoint, flag);
    addComponent(world, Components.Team, flag); 

    Transform.x[flag] = 0;
    Transform.y[flag] = 0; 
    Transform.z[flag] = 0;

    Components.CapturePoint.id[flag] = 0;
    Components.CapturePoint.radius[flag] = 8; 
    Components.CapturePoint.progress[flag] = 0;
    Components.CapturePoint.team[flag] = 0; 
    
    console.log("🚩 Flag generated at 0,0,0");
};

export const onPlayerJoin = (world: SimWorld, eid: number) => {
  addComponent(world, Transform, eid);
  addComponent(world, InputState, eid);
  addComponent(world, Components.Health, eid);
  addComponent(world, Components.Ammo, eid);
  addComponent(world, Components.CombatState, eid);
  addComponent(world, Components.Team, eid);
  addComponent(world, Components.Soldier, eid); // <--- Important for query
  addComponent(world, Components.Stats, eid);

  Components.Stats.kills[eid] = 0;
  Components.Stats.deaths[eid] = 0;
  
  Components.Health.current[eid] = 0;
  Components.Health.max[eid] = 100;
  Components.Health.isDead[eid] = 1;

  addComponent(world, Components.RespawnTimer, eid);
  Components.RespawnTimer.timeLeft[eid] = 0; 

  Transform.x[eid] = 0;
  Transform.z[eid] = 0;
  Transform.y[eid] = -50; 

  Components.Ammo.current[eid] = 30; 
  Components.Ammo.magSize[eid] = 30;
  Components.Ammo.reserve[eid] = 120;

  const teamId = (globalPlayerCount % 2) + 1;
  Components.Team.id[eid] = teamId;
  globalPlayerCount++;

  console.log(`[BF42] Player ${eid} joined Team ${teamId === 1 ? 'Axis' : 'Allies'}`);
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

// Helper to get single state
export const getPlayerState = (world: SimWorld, eid: number) => {
  const isFlag = Components.CapturePoint.radius[eid] > 0; 

  return {
      id: eid,
      pos: { x: Transform.x[eid], y: Transform.y[eid], z: Transform.z[eid] },
      vel: { x: 0, y: 0, z: 0 }, 
      rot: Transform.rotation[eid],
      
      type: isFlag ? 'flag' : 'soldier',

      health: Components.Health.current[eid],
      isDead: Boolean(Components.Health.isDead[eid]),
      respawnTimer: Components.RespawnTimer.timeLeft[eid] || 0,
      kills: Components.Stats.kills[eid] || 0,
      deaths: Components.Stats.deaths[eid] || 0,
      ammo: Components.Ammo.current[eid],
      ammoRes: Components.Ammo.reserve[eid],
      
      team: isFlag ? Components.CapturePoint.team[eid] : Components.Team.id[eid], 
      captureProgress: isFlag ? Components.CapturePoint.progress[eid] : 0,
      lastProcessedTick: InputState.lastTick[eid]
  };
};

// --- NEW: GET ALL ENTITIES FOR SNAPSHOT ---
export const getWorldState = (world: SimWorld) => {
    const entities = [];
    
    // 1. Get Soldiers
    const soldiers = soldierQuery(world);
    for (const eid of soldiers) {
        entities.push(getPlayerState(world, eid));
    }

    // 2. Get Flags
    const flags = flagQuery(world);
    for (const eid of flags) {
        entities.push(getPlayerState(world, eid));
    }

    return entities;
};