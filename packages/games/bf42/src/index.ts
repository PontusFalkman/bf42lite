import { SimWorld, addComponent, addEntity, createMovementSystem, SystemFactory, InputState, Transform, defineQuery } from '@bf42lite/sim';
import { ClientMessage } from '@bf42lite/protocol'; 
import { createCombatSystem } from './systems/combat';
import { createRespawnSystem } from './systems/respawn';
import { createGameLoopSystem } from './systems/gameloop';
import { createHistorySystem } from './systems/history';
import { createCaptureSystem } from './systems/capture';
import * as Components from './components';

export * from './components';

// --- 1. UNIFIED WEAPON & LOADOUT STATS ---
export const WEAPONS = {
  0: { name: 'THOMPSON', damage: 20, rate: 0.12, range: 80,  mag: 30, res: 120, hp: 100 }, // Assault
  1: { name: 'MP40',     damage: 18, rate: 0.15, range: 100, mag: 30, res: 60,  hp: 100 }, // Medic
  2: { name: 'KAR98K',   damage: 95, rate: 1.50, range: 300, mag: 5,  res: 20,  hp: 60  }, // Scout
};

export const getSystems = (): SystemFactory[] => [
  createMovementSystem,
  createHistorySystem,
  createCombatSystem,
  createRespawnSystem,
  createCaptureSystem,
  createGameLoopSystem
];

// --- QUERIES ---
const soldierQuery = defineQuery([Components.Soldier, Transform]);
const flagQuery = defineQuery([Components.CapturePoint, Transform, Components.Team]); // Added Team to query

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
  addComponent(world, Components.Soldier, eid);
  addComponent(world, Components.Stats, eid);
  
  // [FIX] Must add this component before using it!
  addComponent(world, Components.Loadout, eid);

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

  const teamId = (globalPlayerCount % 2) + 1;
  Components.Team.id[eid] = teamId;
  globalPlayerCount++;

  console.log(`[BF42] Player ${eid} joined Team ${teamId} (Waiting in Lobby)`);
};

// --- STRATEGIC SPAWN LOGIC ---
export const spawnPlayer = (world: SimWorld, eid: number, classId: number) => {
  if (!Components.Health.isDead[eid]) return;

  // Use WEAPONS as the single source of truth
  const stats = WEAPONS[classId as keyof typeof WEAPONS] || WEAPONS[0];
  
  Components.Loadout.classId[eid] = classId;

  Components.Health.current[eid] = stats.hp;
  Components.Health.max[eid] = stats.hp;
  Components.Health.isDead[eid] = 0;

  Components.Ammo.current[eid] = stats.mag;
  Components.Ammo.magSize[eid] = stats.mag;
  Components.Ammo.reserve[eid] = stats.res;

  // --- NEW: FIND SPAWN POINT ---
  const myTeam = Components.Team.id[eid];
  const flags = flagQuery(world);
  const myFlags: number[] = [];

  // 1. Find flags owned by my team
  for (const fid of flags) {
      if (Components.CapturePoint.team[fid] === myTeam) {
          myFlags.push(fid);
      }
  }

  // 2. Determine Spawn Position
  if (myFlags.length > 0) {
      // Pick random owned flag
      const randomFlag = myFlags[Math.floor(Math.random() * myFlags.length)];
      const fx = Transform.x[randomFlag];
      const fz = Transform.z[randomFlag];
      
      // Offset slightly (2m - 5m away)
      const angle = Math.random() * Math.PI * 2;
      const dist = 2 + Math.random() * 3; 

      Transform.x[eid] = fx + Math.cos(angle) * dist;
      Transform.z[eid] = fz + Math.sin(angle) * dist;
      Transform.y[eid] = 2; // Ground level
  } else {
      // Emergency Spawn (No flags owned) -> Random drop
      console.log("WARNING: No flags owned! Spawning in wilderness.");
      Transform.x[eid] = (Math.random() - 0.5) * 50;
      Transform.z[eid] = (Math.random() - 0.5) * 50;
      Transform.y[eid] = 5;
  }

  console.log(`[BF42] Player ${eid} DEPLOYED with ${stats.name}`);
};

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

export const getPlayerState = (world: SimWorld, eid: number) => {
  const isFlag = Components.CapturePoint.radius[eid] > 0; 

  return {
      id: eid,
      pos: { x: Transform.x[eid], y: Transform.y[eid], z: Transform.z[eid] },
      vel: { x: 0, y: 0, z: 0 }, 
      rot: Transform.rotation[eid],
      type: isFlag ? 'flag' : 'soldier',
      
      // Send Class ID so client knows what gun to draw/limit
      classId: isFlag ? 0 : Components.Loadout.classId[eid],

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

export const getWorldState = (world: SimWorld) => {
    const entities = [];
    const soldiers = soldierQuery(world);
    for (const eid of soldiers) entities.push(getPlayerState(world, eid));
    const flags = flagQuery(world);
    for (const eid of flags) entities.push(getPlayerState(world, eid));
    return entities;
};