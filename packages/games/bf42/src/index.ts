import { SimWorld, addComponent, addEntity, createMovementSystem, SystemFactory, InputState, Transform, defineQuery } from '@bf42lite/sim';
// IMPORT ClientMessage
import { ClientMessage } from '@bf42lite/protocol'; 
import { createCombatSystem } from './systems/combat';
import { createRespawnSystem } from './systems/respawn';
import { createGameLoopSystem } from './systems/gameloop';
import { createHistorySystem } from './systems/history';
import { createCaptureSystem } from './systems/capture';
import * as Components from './components';

export * from './components';

const LOADOUTS = {
  0: { name: 'Assault', hp: 100, ammo: 30, mag: 30, res: 120 },
  1: { name: 'Medic',   hp: 100, ammo: 30, mag: 30, res: 60 }, // Less reserve
  2: { name: 'Scout',   hp: 60,  ammo: 5,  mag: 5,  res: 20 }, // Glass Cannon
};

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

  console.log(`[BF42] Player ${eid} joined Team ${teamId} (Waiting in Lobby)`);
};

// --- NEW: SPAWN LOGIC ---
export const spawnPlayer = (world: SimWorld, eid: number, classId: number) => {
  // Only allow spawn if currently dead
  if (!Components.Health.isDead[eid]) return;

  const loadout = LOADOUTS[classId as keyof typeof LOADOUTS] || LOADOUTS[0];

  Components.Health.current[eid] = loadout.hp;
  Components.Health.max[eid] = loadout.hp;
  Components.Health.isDead[eid] = 0;

  Components.Ammo.current[eid] = loadout.mag;
  Components.Ammo.magSize[eid] = loadout.mag;
  Components.Ammo.reserve[eid] = loadout.res;

  // Random Spawn
  Transform.x[eid] = (Math.random() - 0.5) * 20;
  Transform.z[eid] = (Math.random() - 0.5) * 20;
  Transform.y[eid] = 5; // Drop in

  console.log(`[BF42] Player ${eid} DEPLOYED as ${loadout.name}`);
};
// --- NEW: MESSAGE ROUTER ---
export const processMessage = (world: SimWorld, eid: number, msg: ClientMessage) => {
  if (msg.type === 'input') {
      processInput(world, eid, msg);
  }
  else if (msg.type === 'spawn_request') {
      spawnPlayer(world, eid, msg.classId);
  }
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