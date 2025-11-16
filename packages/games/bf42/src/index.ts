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
  createGameLoopSystem,
  createCaptureSystem
];

// --- 2. MAP & ENTITY FACTORIES ---
const createFlag = (world: SimWorld, id: number, x: number, z: number, r: number) => {
  const eid = addEntity(world);
  addComponent(world, Transform, eid);
  addComponent(world, Components.CapturePoint, eid);
  Transform.x[eid] = x;
  Transform.y[eid] = 0; // Flags are at ground level
  Transform.z[eid] = z;
  Components.CapturePoint.id[eid] = id;
  Components.CapturePoint.team[eid] = 0; // Neutral
  Components.CapturePoint.progress[eid] = 0;
  Components.CapturePoint.radius[eid] = r;
  return eid;
};

export const initGameWorld = (world: SimWorld) => {
  console.log('[Game] Initializing World (Spawning Flags)...');
  createFlag(world, 0, 0, 0, 15);   // Flag 0
  createFlag(world, 1, 50, 0, 15);  // Flag 1
  createFlag(world, 2, -50, 0, 15); // Flag 2
};


// --- 3. PLAYER LIFECYCLE HANDLERS ---
const soldierQuery = defineQuery([Components.Soldier, Transform]);
const flagQuery = defineQuery([Components.CapturePoint, Transform]);

export const onPlayerJoin = (world: SimWorld, eid: number) => {
  // Add all game-specific components to the new player entity
  addComponent(world, Components.Soldier, eid);
  addComponent(world, Components.Health, eid);
  addComponent(world, Components.Ammo, eid);
  addComponent(world, Components.CombatState, eid);
  addComponent(world, Components.Stats, eid);
  addComponent(world, Components.Team, eid);
  addComponent(world, Components.Loadout, eid);
  
  // Also add engine components (Sim uses these)
  addComponent(world, Transform, eid);
  addComponent(world, InputState, eid);
  
  // Set initial team (e.g., auto-balance)
  // TODO: Auto-balance
  Components.Team.id[eid] = 1; // Default to Axis for now
  
  // Don't spawn yet, wait for 'spawn_request'
  Components.Health.isDead[eid] = 1;
};

export const onPlayerLeave = (world: SimWorld, eid: number) => {
  // TODO: Handle leaving (e.g., remove entity)
  console.log(`[Game] Player ${eid} left (TODO: implement removal)`);
};

export const onPlayerSpawn = (world: SimWorld, eid: number, classId: number) => {
  console.log(`[Game] Spawning Player ${eid} as Class ${classId}`);
  
  // 1. Find a valid spawn point
  // TODO: Use team-based spawns
  Transform.x[eid] = (Math.random() - 0.5) * 40;
  Transform.z[eid] = (Math.random() - 0.5) * 40;
  Transform.y[eid] = 5; // Drop from sky
  Transform.rotation[eid] = 0;
  
  // 2. Get stats for the chosen class (or default to 0)
  const stats = WEAPONS[classId as keyof typeof WEAPONS] || WEAPONS[0];
  
  // 3. Reset all components
  Components.Health.max[eid] = stats.hp;
  Components.Health.current[eid] = stats.hp;
  Components.Health.isDead[eid] = 0;
  
  Components.Ammo.magSize[eid] = stats.mag;
  Components.Ammo.current[eid] = stats.mag;
  Components.Ammo.reserve[eid] = stats.res;
  
  Components.CombatState.lastFireTime[eid] = 0;
  Components.CombatState.isReloading[eid] = 0;
  
  Components.Loadout.classId[eid] = classId;
};

// --- 4. MESSAGE PROCESSOR ---
export const processMessage = (world: SimWorld, eid: number, msg: ClientMessage) => {
  // Handle game-specific messages
  if (msg.type === 'spawn_request') {
      onPlayerSpawn(world, eid, msg.classId);
      return;
  }
  
  // Handle engine-level messages (Input)
  if (msg.type === 'input') {
      // Record last tick we've seen from this player
      InputState.lastTick[eid] = msg.tick; 
      
      // [FIX] Write to new InputState.axes structure
      InputState.axes.forward[eid] = msg.axes.forward;
      InputState.axes.right[eid] = msg.axes.right;
      
      InputState.viewX[eid] = msg.axes.yaw;
      InputState.viewY[eid] = msg.axes.pitch;
      
      // [FIX] Convert booleans to 0/1 for axes
      InputState.axes.jump[eid] = msg.axes.jump ? 1 : 0;
      InputState.axes.shoot[eid] = msg.axes.shoot ? 1 : 0;
      InputState.axes.reload[eid] = msg.axes.reload ? 1 : 0;
  }
};

// --- 5. STATE SERIALIZER ---
export const getPlayerState = (world: SimWorld, eid: number) => {
  const isFlag = Components.CapturePoint.radius[eid] > 0; 

  return {
      id: eid,
      pos: { x: Transform.x[eid], y: Transform.y[eid], z: Transform.z[eid] },
      vel: { x: 0, y: 0, z: 0 }, // TODO: Add velocity
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
      
      // We don't send this for flags
      lastProcessedTick: isFlag ? 0 : InputState.lastTick[eid],
  };
};

export const getWorldState = (world: SimWorld) => {
  const soldiers = soldierQuery(world);
  const flags = flagQuery(world);
  
  const state = [];
  
  for (const eid of soldiers) {
      state.push(getPlayerState(world, eid));
  }
  for (const eid of flags) {
      state.push(getPlayerState(world, eid));
  }
  
  return state;
};