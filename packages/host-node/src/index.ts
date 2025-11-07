import { WebSocket, WebSocketServer } from "ws";
import { addComponent, addEntity } from "bitecs";
import { Packr } from "msgpackr";
import {
  InputMsg,
  StateMsg,
  EntitySnapshot,
  JoinMsg, // Import the new message type
} from "@protocol/schema";
import { world, step, Transform, Velocity } from "@sim/logic";

const PORT = 8080;
const TICK_RATE = 60; // 60hz
const SNAPSHOT_RATE = 30; // 30hz
const TICK_MS = 1000 / TICK_RATE;
const SPEED = 3.0;

const wss = new WebSocketServer({ port: PORT });
const packr = new Packr();

// Store all connected clients
const clients = new Map<WebSocket, number>();
// Store the last input for each entity
const inputs = new Map<number, InputMsg["axes"]>();

let tick = 0;

console.log(`[bf42lite] Host server started on ws://localhost:${PORT}`);

wss.on("connection", (ws) => {
  console.log("[Host] Client connected.");

  // Create a new player entity for this client
  const playerEid = addEntity(world);
  addComponent(world, Transform, playerEid);
  addComponent(world, Velocity, playerEid);
  Transform.x[playerEid] = 0;
  Transform.y[playerEid] = 0;
  Transform.z[playerEid] = 0;

  // Store the client and their entity ID
  clients.set(ws, playerEid);
  inputs.set(playerEid, { forward: 0, right: 0, jump: false });

  // --- N4: Send JoinMsg to the new client ---
  const joinMsg: JoinMsg = {
    type: "join",
    tick: tick,
    eid: playerEid,
    x: Transform.x[playerEid],
    y: Transform.y[playerEid],
    z: Transform.z[playerEid],
  };
  ws.send(packr.pack(joinMsg));
  // --- End N4 ---

  ws.on("message", (message) => {
    const data = message as Uint8Array;
    const msg = packr.unpack(data) as InputMsg;
    
    if (msg.type === "input") {
      inputs.set(playerEid, msg.axes);
    }
  });

  ws.on("close", () => {
    console.log("[Host] Client disconnected.");
    const eid = clients.get(ws);
    if (eid) {
      // TODO: Remove entity and clean up
      clients.delete(ws);
      inputs.delete(eid);
    }
  });

  ws.on("error", (error) => {
    console.error("[Host] WebSocket error:", error);
  });
});

// --- Game Loop (N3) ---
function gameLoop() {
  // A. Apply inputs to ECS Velocity
  for (const [eid, input] of inputs.entries()) {
    Velocity.x[eid] = input.right * SPEED;
    Velocity.z[eid] = -input.forward * SPEED;
    Velocity.y[eid] = 0; // No gravity yet
  }

  // B. Run the ECS simulation step
  step();

  // C. Broadcast snapshots (at SNAPSHOT_RATE)
  if (tick % (TICK_RATE / SNAPSHOT_RATE) === 0) {
    const snapshots: EntitySnapshot[] = [];
    for (const [ws, eid] of clients.entries()) {
      snapshots.push({
        id: eid,
        x: Transform.x[eid],
        y: Transform.y[eid],
        z: Transform.z[eid],
      });
    }

    const stateMsg: StateMsg = {
      type: "state",
      tick: tick,
      entities: [snapshots],
    };

    const payload = packr.pack(stateMsg);
    
    for (const ws of clients.keys()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  tick++;
}

// Start the game loop
setInterval(gameLoop, TICK_MS);