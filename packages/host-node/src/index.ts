import { WebSocketServer, WebSocket } from 'ws';
import { pack, unpack } from 'msgpackr';
import { createSimulation, addEntity, addComponent } from '@bf42lite/sim';
import { ClientMessage, ServerMessage, Snapshot } from '@bf42lite/protocol';

// Import the Game as a module
import * as Game from '@bf42lite/games-bf42'; 

const PORT = 8080;
const TICK_RATE = 60;
const SNAPSHOT_RATE = 20;

console.log(`[Host] Loading Game Systems...`);

// 1. LOAD SYSTEMS (Generic)
const { world, step } = createSimulation(Game.getSystems());
const clients = new Map<WebSocket, number>(); 

// 2. SETUP GLOBAL GAME STATE (This could also be moved to a Game.init() function)
const rulesId = addEntity(world);
addComponent(world, Game.GameRules, rulesId);
Game.GameRules.ticketsAxis[rulesId] = 100;
Game.GameRules.ticketsAllies[rulesId] = 100;

const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (ws) => {
  const eid = addEntity(world);
  
  // DECOUPLED: We just tell the Game "A player joined, set them up."
  Game.onPlayerJoin(world, eid);

  clients.set(ws, eid);
  console.log(`[Host] Player Joined: ${eid}`);

  const welcomeMsg: ServerMessage = { 
    type: 'welcome', 
    playerId: eid, 
    tick: world.time 
  };
  ws.send(pack(welcomeMsg));

  ws.on('message', (raw) => {
    try {
        const msg = unpack(raw as Buffer) as ClientMessage;
        if (msg.type === 'input') {
            // DECOUPLED: We pass the raw input to the Game to interpret
            Game.processInput(world, eid, msg);
        }
    } catch (e) { console.error(e); }
  });

  ws.on('close', () => {
    clients.delete(ws);
    // Optional: Game.onPlayerLeave(world, eid);
  });
});

// 3. GAME LOOP
setInterval(() => {
  step(1 / TICK_RATE);
}, 1000 / TICK_RATE);

// 4. SNAPSHOT LOOP
setInterval(() => {
  const entities = [];
  
  for (const eid of clients.values()) {
    // DECOUPLED: The Game decides what data constitutes a "snapshot"
    entities.push(Game.getPlayerState(world, eid));
  }

  const snapshot: Snapshot = {
    type: 'snapshot',
    tick: Math.floor(world.time * 60),
    game: { 
        ticketsAxis: Game.GameRules.ticketsAxis[rulesId], 
        ticketsAllies: Game.GameRules.ticketsAllies[rulesId], 
        state: Game.GameRules.state[rulesId] 
    },
    entities
  };

  const data = pack(snapshot);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(data);
  }
}, 1000 / SNAPSHOT_RATE);