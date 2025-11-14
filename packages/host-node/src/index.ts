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
  addEntity
} from '@bf42lite/sim';
import { 
  ClientMessage, 
  ServerMessage, 
  Snapshot,
  ClientFire // Ensure this is exported in your protocol schema
} from '@bf42lite/protocol';

const PORT = 8080;
const TICK_RATE = 60;
const SNAPSHOT_RATE = 20;

// --- COMBAT CONSTANTS ---
const PLAYER_RADIUS = 0.5; 
const PLAYER_HEIGHT = 1.8;
const WEAPON_DAMAGE = 25;

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

// 2. HELPER: Ray vs Cylinder Intersection
function checkHit(
    ox: number, oy: number, oz: number,   // Ray Origin
    dx: number, dy: number, dz: number,   // Ray Direction (Normalized)
    targetId: number
): boolean {
    const tx = Transform.x[targetId];
    const ty = Transform.y[targetId];
    const tz = Transform.z[targetId];

    // A. Check XZ (Top-down Circle) Intersection
    const cx = tx - ox;
    const cz = tz - oz;

    // Project C onto D to find closest point on the infinite line
    const t = cx * dx + cz * dz;

    if (t < 0) return false; // Target is behind the shooter

    // Find the closest point on the ray line
    const px = ox + t * dx;
    const pz = oz + t * dz;

    // Check distance squared against radius squared
    const distSq = (px - tx) ** 2 + (pz - tz) ** 2;
    if (distSq > PLAYER_RADIUS * PLAYER_RADIUS) return false; // Missed the "width"

    // B. Check Y (Height) Intersection at that distance
    const hitY = oy + t * dy;

    // Check if the ray passes within the cylinder's height
    if (hitY >= ty && hitY <= ty + PLAYER_HEIGHT) {
        return true;
    }

    return false;
}

// 3. SETUP NETWORK
const wss = new WebSocketServer({ port: PORT });
let nextTeam = 1; // Toggle 1 (Axis) / 2 (Allies)

wss.on('connection', (ws) => {
  const entityId = spawnPlayer(world, 0, 0);
  clients.set(ws, entityId);

  // --- ASSIGN TEAM & HEALTH ---
  addComponent(world, Team, entityId);
  Team.id[entityId] = nextTeam;
  nextTeam = nextTeam === 1 ? 2 : 1;
  
  addComponent(world, Health, entityId);
  Health.max[entityId] = 100;
  Health.current[entityId] = 100;
  Health.isDead[entityId] = 0;

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
      }
      
      // --- HANDLE FIRE ---
      else if (msg.type === 'fire') {
        // Basic Validation: Is player dead?
        if (Health.isDead[entityId]) return;

        console.log(`[Combat] Player ${entityId} FIRED at tick ${msg.tick}`);

        // Iterate over all other players to check for hits
        for (const [targetWs, targetId] of clients) {
          if (targetId === entityId) continue; // Don't hit self
          if (Health.isDead[targetId]) continue; // Don't hit dead players

          // Friendly Fire Check (Optional: disable for now)
          // if (Team.id[targetId] === Team.id[entityId]) continue; 

          const isHit = checkHit(
            msg.origin.x, msg.origin.y, msg.origin.z,
            msg.direction.x, msg.direction.y, msg.direction.z,
            targetId
          );

          if (isHit) {
             // Apply Damage
             const currentHp = Health.current[targetId];
             const newHp = Math.max(0, currentHp - WEAPON_DAMAGE);
             Health.current[targetId] = newHp;
             
             console.log(`[Combat] HIT CONFIRMED! ${entityId} -> ${targetId} [HP: ${currentHp} -> ${newHp}]`);

             // Send Hit Marker to Shooter
             const confirmMsg: ServerMessage = {
               type: 'hitConfirmed',
               shooterId: entityId,
               targetId: targetId,
               damage: WEAPON_DAMAGE
             };
             ws.send(pack(confirmMsg));

// Check Death
if (newHp === 0) {
  Health.isDead[targetId] = 1;
  console.log(`[Combat] Player ${targetId} ELIMINATED by ${entityId}`);

  // === NEW: DEDUCT TICKET ===
  // Get the victim's team
  const victimTeam = Team.id[targetId];
  
  // Deduct from that team
  if (victimTeam === 1) {
     GameRules.ticketsAxis[rulesId]--;
     console.log(`[Game] Axis Ticket Lost. Remaining: ${GameRules.ticketsAxis[rulesId]}`);
  }
  else if (victimTeam === 2) {
     GameRules.ticketsAllies[rulesId]--;
     console.log(`[Game] Allies Ticket Lost. Remaining: ${GameRules.ticketsAllies[rulesId]}`);
  }
}
}
        }
      }

    } catch (e) {
      console.error('[Host] Invalid message', e);
    }
  });

  ws.on('close', () => {
    console.log(`[Host] Player ${entityId} disconnected`);
    clients.delete(ws);
  });
});

// 4. GAME LOOP (60Hz)
setInterval(() => {
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
      lastProcessedTick: PlayerInput.lastTick[eid]
    });
  }

  // Read Game Rules
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