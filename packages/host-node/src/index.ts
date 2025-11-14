import { WebSocketServer, WebSocket } from 'ws';
import { pack, unpack } from 'msgpackr';
import { 
  createSimulation, 
  spawnPlayer, 
  PlayerInput, 
  Transform, 
  Velocity, // <--- Make sure Velocity is imported
  Health,
  GameRules, 
  Team,
  addComponent,
  addEntity
} from '@bf42lite/sim';
import { 
  ClientMessage, 
  ServerMessage, 
  Snapshot 
} from '@bf42lite/protocol';

const PORT = 8080;
const TICK_RATE = 60;
const SNAPSHOT_RATE = 20;

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
// -----------------------

// 2. SETUP NETWORK
const wss = new WebSocketServer({ port: PORT });
let nextTeam = 1; // Toggle 1 (Axis) / 2 (Allies)

wss.on('connection', (ws) => {
  console.log('[Host] Player connected');

  const entityId = spawnPlayer(world, 0, 0);
  clients.set(ws, entityId);

  // --- ASSIGN TEAM ---
  addComponent(world, Team, entityId);
  Team.id[entityId] = nextTeam;
  nextTeam = nextTeam === 1 ? 2 : 1;
  
  // Initialize Health
  addComponent(world, Health, entityId);
  Health.max[entityId] = 100;
  Health.current[entityId] = 100;
  Health.isDead[entityId] = 0;

  const welcomeMsg: ServerMessage = { 
    type: 'welcome', 
    playerId: entityId, 
    tick: world.time 
  };
  ws.send(pack(welcomeMsg));

  ws.on('message', (raw) => {
    try {
      const msg = unpack(raw as Buffer) as ClientMessage;
      if (msg.type === 'input') {
        PlayerInput.forward[entityId] = msg.axes.forward;
        PlayerInput.right[entityId] = msg.axes.right;
        PlayerInput.jump[entityId] = msg.axes.jump ? 1 : 0;
        PlayerInput.shoot[entityId] = msg.axes.shoot ? 1 : 0;
        PlayerInput.yaw[entityId] = msg.axes.yaw;
        PlayerInput.pitch[entityId] = msg.axes.pitch;
        
        // --- CRITICAL FOR RTT: Save the Tick ---
        PlayerInput.lastTick[entityId] = msg.tick; 
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

// 3. GAME LOOP (60Hz)
setInterval(() => {
  step(1 / TICK_RATE);
}, 1000 / TICK_RATE);

// 4. SNAPSHOT LOOP (20Hz)
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
      // --- CRITICAL FOR RECONCILIATION: Send Velocity ---
      vel: {
        x: Velocity.x[eid],
        y: Velocity.y[eid],
        z: Velocity.z[eid]
      },
      rot: Transform.rotation[eid],
      health: Health.current[eid],
      isDead: Boolean(Health.isDead[eid]),
      // --- CRITICAL FOR RTT: Send back the stored Tick ---
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