import { WebSocketServer, WebSocket } from 'ws';
import { pack, unpack } from 'msgpackr';
import { createSimulation, addEntity, addComponent, InputState, Transform } from '@bf42lite/sim';
// FIX: Import from the new package name we defined in step 1
import * as BF42 from '@bf42lite/games-bf42'; 
import { ClientMessage, ServerMessage, Snapshot } from '@bf42lite/protocol';

const PORT = 8080;
const TICK_RATE = 60;
const SNAPSHOT_RATE = 20;

console.log(`[Host] Loading Game: BF42 Lite...`);

// 1. LOAD SYSTEMS
const { world, step } = createSimulation(BF42.getSystems());
const clients = new Map<WebSocket, number>(); 

// 2. SETUP GAME STATE
const rulesId = addEntity(world);
addComponent(world, BF42.GameRules, rulesId);
BF42.GameRules.ticketsAxis[rulesId] = 100;
BF42.GameRules.ticketsAllies[rulesId] = 100;

const wss = new WebSocketServer({ port: PORT });

// Helper constants for Input Bitmask
const BUTTON_JUMP = 1;
const BUTTON_FIRE = 2;
const BUTTON_RELOAD = 4;

wss.on('connection', (ws) => {
  const eid = addEntity(world);
  
  // Core Engine Components
  addComponent(world, Transform, eid);
  addComponent(world, InputState, eid); // FIX: Use InputState
  
  // Game Components
  addComponent(world, BF42.Health, eid);
  BF42.Health.current[eid] = 100;
  BF42.Health.max[eid] = 100;
  BF42.Health.isDead[eid] = 0;

  addComponent(world, BF42.Ammo, eid);
  BF42.Ammo.current[eid] = 30; 
  BF42.Ammo.magSize[eid] = 30;
  BF42.Ammo.reserve[eid] = 120;

  addComponent(world, BF42.CombatState, eid);
  addComponent(world, BF42.Team, eid);
  addComponent(world, BF42.Soldier, eid); // Tag as Soldier

  clients.set(ws, eid);
  console.log(`[Host] Player Joined: ${eid}`);

  // Send Welcome
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
        // FIX: Map Client "Axes" object to Engine "InputState"
        InputState.moveY[eid] = msg.axes.forward; // Y is forward in our engine logic
        InputState.moveX[eid] = msg.axes.right;
        InputState.viewX[eid] = msg.axes.yaw;
        InputState.viewY[eid] = msg.axes.pitch;
        InputState.lastTick[eid] = msg.tick;

        // FIX: Map booleans to Bitmask
        let buttons = 0;
        if (msg.axes.jump) buttons |= BUTTON_JUMP;
        if (msg.axes.shoot) buttons |= BUTTON_FIRE;
        if (msg.axes.reload) buttons |= BUTTON_RELOAD;
        InputState.buttons[eid] = buttons;

        // Handle Reload (Game Logic trigger)
        if (msg.axes.reload) {
            // We manually trigger the reloading flag if needed, 
            // though ideally the CombatSystem reads the button directly.
            if (!BF42.CombatState.isReloading[eid]) {
                BF42.CombatState.isReloading[eid] = 1;
                BF42.CombatState.reloadStartTime[eid] = world.time;
            }
        }
        }
    } catch (e) { console.error(e); }
  });

  ws.on('close', () => {
    clients.delete(ws);
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
    entities.push({
      id: eid,
      pos: { x: Transform.x[eid], y: Transform.y[eid], z: Transform.z[eid] },
      vel: { x: 0, y: 0, z: 0 }, // optimization: skip vel for now
      rot: Transform.rotation[eid],
      health: BF42.Health.current[eid],
      isDead: Boolean(BF42.Health.isDead[eid]),
      ammo: BF42.Ammo.current[eid],
      ammoRes: BF42.Ammo.reserve[eid],
      lastProcessedTick: InputState.lastTick[eid]
    });
  }

  const snapshot: Snapshot = {
    type: 'snapshot',
    tick: Math.floor(world.time * 60),
    game: { 
        ticketsAxis: BF42.GameRules.ticketsAxis[rulesId], 
        ticketsAllies: BF42.GameRules.ticketsAllies[rulesId], 
        state: BF42.GameRules.state[rulesId] 
    },
    entities
  };

  const data = pack(snapshot);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(data);
  }
}, 1000 / SNAPSHOT_RATE);