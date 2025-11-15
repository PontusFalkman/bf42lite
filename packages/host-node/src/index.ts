import { WebSocketServer, WebSocket } from 'ws';
import { pack, unpack } from 'msgpackr';
import { 
  createSimulation, 
  spawnPlayer, 
  PlayerInput, 
  Transform, 
  Velocity, 
  Health,
  GameRules, 
  Team,
  addComponent,
  addEntity,
  Ammo,         // <--- NEW
  CombatState,  // <--- NEW
  defineQuery   // <--- NEW
} from '@bf42lite/sim';
import { 
  ClientMessage, 
  ServerMessage, 
  Snapshot
} from '@bf42lite/protocol';

const PORT = 8080;
const TICK_RATE = 60;
const SNAPSHOT_RATE = 20;

// --- COMBAT CONSTANTS ---
const PLAYER_RADIUS = 0.5; 
const PLAYER_HEIGHT = 1.8;
const WEAPON_DAMAGE = 25;
const RELOAD_TIME = 2.0; // Seconds

console.log(`[Host] Starting Dedicated Server on port ${PORT}...`);

// 1. SETUP SIMULATION
const { world, step } = createSimulation();
const clients = new Map<WebSocket, number>(); // Socket -> EntityID

// --- INIT GAME RULES ---
const rulesId = addEntity(world);
addComponent(world, GameRules, rulesId);
GameRules.ticketsAxis[rulesId] = 100;
GameRules.ticketsAllies[rulesId] = 100;
GameRules.state[rulesId] = 0;

// Define Queries
const reloadQuery = defineQuery([Ammo, CombatState]);

// 2. HELPER: Ray vs Cylinder Intersection
function checkHit(
    ox: number, oy: number, oz: number,   
    dx: number, dy: number, dz: number,   
    targetId: number
): boolean {
    const tx = Transform.x[targetId];
    const ty = Transform.y[targetId];
    const tz = Transform.z[targetId];

    const cx = tx - ox;
    const cz = tz - oz;

    const t = cx * dx + cz * dz;
    if (t < 0) return false; 

    const px = ox + t * dx;
    const pz = oz + t * dz;

    const distSq = (px - tx) ** 2 + (pz - tz) ** 2;
    if (distSq > PLAYER_RADIUS * PLAYER_RADIUS) return false; 

    const hitY = oy + t * dy;
    if (hitY >= ty && hitY <= ty + PLAYER_HEIGHT) {
        return true;
    }
    return false;
}

// 3. SETUP NETWORK
const wss = new WebSocketServer({ port: PORT });
let nextTeam = 1; 

wss.on('connection', (ws) => {
  const entityId = spawnPlayer(world, 0, 0);
  clients.set(ws, entityId);

  // --- ASSIGN TEAM, HEALTH, AMMO ---
  addComponent(world, Team, entityId);
  Team.id[entityId] = nextTeam;
  nextTeam = nextTeam === 1 ? 2 : 1;
  
  addComponent(world, Health, entityId);
  Health.max[entityId] = 100;
  Health.current[entityId] = 100;
  Health.isDead[entityId] = 0;

  // Initialize Ammo
  addComponent(world, Ammo, entityId);
  Ammo.current[entityId] = 30;
  Ammo.reserve[entityId] = 120;
  Ammo.magSize[entityId] = 30;

  // Initialize Combat State
  addComponent(world, CombatState, entityId);
  CombatState.lastFireTime[entityId] = 0;
  CombatState.isReloading[entityId] = 0;
  CombatState.reloadStartTime[entityId] = 0;

  console.log(`[Host] Player Connected: ID ${entityId} (Team ${Team.id[entityId]})`);

  const welcomeMsg: ServerMessage = { 
    type: 'welcome', 
    playerId: entityId, 
    tick: world.time 
  };
  ws.send(pack(welcomeMsg));

  ws.on('message', (raw) => {
    try {
      const msg = unpack(raw as Buffer) as ClientMessage;

      // --- HANDLE INPUT ---
      if (msg.type === 'input') {
        PlayerInput.forward[entityId] = msg.axes.forward;
        PlayerInput.right[entityId] = msg.axes.right;
        PlayerInput.jump[entityId] = msg.axes.jump ? 1 : 0;
        PlayerInput.shoot[entityId] = msg.axes.shoot ? 1 : 0;
        PlayerInput.yaw[entityId] = msg.axes.yaw;
        PlayerInput.pitch[entityId] = msg.axes.pitch;
        PlayerInput.lastTick[entityId] = msg.tick; 

        // Reload Request
        if (msg.axes.reload && !CombatState.isReloading[entityId]) {
            const current = Ammo.current[entityId];
            const reserve = Ammo.reserve[entityId];
            const magSize = Ammo.magSize[entityId];

            // Only reload if not full and has reserve
            if (current < magSize && reserve > 0) {
                console.log(`[Combat] Player ${entityId} started reloading...`);
                CombatState.isReloading[entityId] = 1;
                CombatState.reloadStartTime[entityId] = world.time;
            }
        }
      }
      
      // --- HANDLE FIRE ---
      else if (msg.type === 'fire') {
        if (Health.isDead[entityId]) return;

        // AMMO CHECK
        if (CombatState.isReloading[entityId]) return;
        if (Ammo.current[entityId] <= 0) return;

        // Deduct Ammo
        Ammo.current[entityId]--;

        // Iterate targets
        for (const [targetWs, targetId] of clients) {
          if (targetId === entityId) continue; 
          if (Health.isDead[targetId]) continue; 

          const isHit = checkHit(
            msg.origin.x, msg.origin.y, msg.origin.z,
            msg.direction.x, msg.direction.y, msg.direction.z,
            targetId
          );

          if (isHit) {
             const currentHp = Health.current[targetId];
             const newHp = Math.max(0, currentHp - WEAPON_DAMAGE);
             Health.current[targetId] = newHp;
             
             console.log(`[Combat] HIT: ${entityId} -> ${targetId} [HP: ${newHp}]`);

             const confirmMsg: ServerMessage = {
               type: 'hitConfirmed',
               shooterId: entityId,
               targetId: targetId,
               damage: WEAPON_DAMAGE
             };
             ws.send(pack(confirmMsg));

             if (newHp === 0) {
                 Health.isDead[targetId] = 1;
                 
                 // Deduct Ticket
                 const victimTeam = Team.id[targetId];
                 if (victimTeam === 1) GameRules.ticketsAxis[rulesId]--;
                 else if (victimTeam === 2) GameRules.ticketsAllies[rulesId]--;
             }
          }
        }
      }

    } catch (e) {
      console.error('[Host] Invalid message', e);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
  });
});

// 4. GAME LOOP (60Hz)
setInterval(() => {
  // --- RELOAD SYSTEM ---
  const reloadingEntities = reloadQuery(world);
  for (let i = 0; i < reloadingEntities.length; i++) {
      const eid = reloadingEntities[i];
      if (CombatState.isReloading[eid]) {
          if (world.time - CombatState.reloadStartTime[eid] >= RELOAD_TIME) {
              // Finish Reload
              const magSize = Ammo.magSize[eid];
              const current = Ammo.current[eid];
              const reserve = Ammo.reserve[eid];
              
              const needed = magSize - current;
              const actual = Math.min(needed, reserve);
              
              Ammo.current[eid] += actual;
              Ammo.reserve[eid] -= actual;
              CombatState.isReloading[eid] = 0;
              
              console.log(`[Combat] Player ${eid} finished reloading.`);
          }
      }
  }

  step(1 / TICK_RATE);
}, 1000 / TICK_RATE);

// 5. SNAPSHOT LOOP (20Hz)
setInterval(() => {
  const entities = [];
  
  for (const eid of clients.values()) {
    entities.push({
      id: eid,
      pos: { 
        x: Transform.x[eid], 
        y: Transform.y[eid], 
        z: Transform.z[eid] 
      },
      vel: {
        x: Velocity.x[eid],
        y: Velocity.y[eid],
        z: Velocity.z[eid]
      },
      rot: Transform.rotation[eid],
      health: Health.current[eid],
      isDead: Boolean(Health.isDead[eid]),
      // SYNC AMMO
      ammo: Ammo.current[eid],
      ammoRes: Ammo.reserve[eid],
      lastProcessedTick: PlayerInput.lastTick[eid]
    });
  }

  const ticketsAxis = GameRules.ticketsAxis[rulesId];
  const ticketsAllies = GameRules.ticketsAllies[rulesId];
  const state = GameRules.state[rulesId];

  const snapshot: Snapshot = {
    type: 'snapshot',
    tick: Math.floor(world.time * 60),
    game: { ticketsAxis, ticketsAllies, state },
    entities
  };

  const data = pack(snapshot);

  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}, 1000 / SNAPSHOT_RATE);