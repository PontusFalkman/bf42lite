import { WebSocketServer, WebSocket } from 'ws';
import { pack, unpack } from 'msgpackr';
import { 
  createSimulation, 
  spawnPlayer, 
  PlayerInput, 
  Transform, 
  Velocity,
  SimWorld
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

// 2. SETUP NETWORK
const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (ws) => {
  console.log('[Host] Player connected');

  // Spawn entity for this client
  // TODO: Use spawn points from map data later
  const entityId = spawnPlayer(world, 0, 0);
  clients.set(ws, entityId);

  // Send Welcome Packet
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
        // Apply Input to ECS immediately
        // In a perfect server, we'd buffer this for the exact tick
        PlayerInput.forward[entityId] = msg.axes.forward;
        PlayerInput.right[entityId] = msg.axes.right;
        PlayerInput.jump[entityId] = msg.axes.jump ? 1 : 0;
        PlayerInput.shoot[entityId] = msg.axes.shoot ? 1 : 0;
      }
    } catch (e) {
      console.error('[Host] Invalid message', e);
    }
  });

  ws.on('close', () => {
    console.log(`[Host] Player ${entityId} disconnected`);
    clients.delete(ws);
    // TODO: Despawn entity (add removeEntity to sim exports)
  });
});

// 3. GAME LOOP (60Hz)
setInterval(() => {
  step(1 / TICK_RATE);
}, 1000 / TICK_RATE);

// 4. SNAPSHOT LOOP (20Hz)
// We send state less often to save bandwidth
setInterval(() => {
  const entities = [];
  
  // Iterate all players (simplification for MVP)
  // Real implementation would query all networked entities
  for (const eid of clients.values()) {
    entities.push({
      id: eid,
      pos: { 
        x: Transform.x[eid], 
        y: Transform.y[eid], 
        z: Transform.z[eid] 
      },
      rot: Transform.rotation[eid]
    });
  }

  const snapshot: Snapshot = {
    type: 'snapshot',
    tick: Math.floor(world.time * 60), // Approx tick count
    entities
  };

  const data = pack(snapshot);

  // Broadcast
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}, 1000 / SNAPSHOT_RATE);