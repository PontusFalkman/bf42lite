import { WebSocket, WebSocketServer } from "ws";
import { addComponent, addEntity } from "bitecs";
import { Packr } from "msgpackr";
import {
  InputMsg,
  StateMsg,
  EntitySnapshot,
  JoinMsg,
  RespawnMsg, // --- G3: Import RespawnMsg ---
} from "@protocol/schema";
// --- G1: Import Health ---
import { world, step, Transform, Velocity, Health } from "@sim/logic";

const PORT = 8080;
const TICK_RATE = 60; // 60hz
const SNAPSHOT_RATE = 30; // 30hz
const TICK_MS = 1000 / TICK_RATE;
const SPEED = 3.0;
const DEFAULT_HEALTH = 100;
// --- G2: Add weapon constants ---
const SHOT_DAMAGE = 10;
const SHOT_RANGE = 20.0; // Max distance for a hit
// --- END G2 ---

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
  // --- G3: Set initial spawn state ---
  // Player is "dead" until they send their first respawn request
  Transform.x[playerEid] = 0;
  Transform.y[playerEid] = -1000; // Start "dead" (out of bounds)
  Transform.z[playerEid] = 0;
  // --- C2: Add initial rotation ---
  Transform.yaw[playerEid] = 0;
  Transform.pitch[playerEid] = 0;

  // --- G1: Add Health component and set defaults ---
  addComponent(world, Health, playerEid);
  Health.current[playerEid] = 0; // Start with 0 health
  Health.max[playerEid] = DEFAULT_HEALTH;
  // --- END G1 ---

  // Store the client and their entity ID
  clients.set(ws, playerEid);
  // --- C2: Update default input state ---
  inputs.set(playerEid, { forward: 0, right: 0, jump: false, fire: false, yaw: 0, pitch: 0 });

  // --- N4: Send JoinMsg to the new client ---
  // --- C2: Add yaw/pitch to JoinMsg ---
  const joinMsg: JoinMsg = {
    type: "join",
    tick: tick,
    eid: playerEid,
    x: Transform.x[playerEid],
    y: Transform.y[playerEid],
    z: Transform.z[playerEid],
    hp: Health.current[playerEid],
    yaw: Transform.yaw[playerEid],
    pitch: Transform.pitch[playerEid],
  };
  ws.send(packr.pack(joinMsg));
  // --- End N4 ---

  ws.on("message", (message) => {
    const data = message as Uint8Array;
    // --- G3: Update message typing ---
    const msg = packr.unpack(data) as InputMsg | RespawnMsg;
    
    if (msg.type === "input") {
      inputs.set(playerEid, msg.axes);
    } 
    // --- G3: Handle Respawn Request ---
    else if (msg.type === "respawn") {
      console.log(`[Host] Player ${playerEid} respawning.`);
      Health.current[playerEid] = DEFAULT_HEALTH;
      // Reset position to a spawn point (just 0,0,0 for now)
      Transform.x[playerEid] = 0;
      Transform.y[playerEid] = 0;
      Transform.z[playerEid] = 0;
      // --- C2: Reset rotation on spawn ---
      Transform.yaw[playerEid] = 0;
      Transform.pitch[playerEid] = 0;
      // Reset velocity
      Velocity.x[playerEid] = 0;
      Velocity.y[playerEid] = 0;
      Velocity.z[playerEid] = 0;
    }
    // --- END G3 ---
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
    // --- C2: Store rotation from client input ---
    Transform.yaw[eid] = input.yaw;
    Transform.pitch[eid] = input.pitch;

    // --- G3: Only apply input if alive ---
    if (Health.current[eid] > 0) {
      // --- C2: Calculate movement based on yaw ---
      const yaw = Transform.yaw[eid];
      const forward = input.forward * SPEED;
      const right = input.right * SPEED;

      Velocity.x[eid] = Math.sin(yaw) * -forward + Math.cos(yaw) * right;
      Velocity.z[eid] = Math.cos(yaw) * -forward - Math.sin(yaw) * right;
      Velocity.y[eid] = 0; // No gravity yet
      // --- END C2 ---
    }
  }

  // --- G2: Handle Firing ---
  // (We do this *before* the main simulation step)
  for (const [firingEid, input] of inputs.entries()) {
    // --- G3: Only allow firing if alive ---
    if (input.fire && Health.current[firingEid] > 0) {
      console.log(`[Host] Player ${firingEid} is firing!`);
      // This is a simple "hitscan" that just finds the closest target
      // A real implementation would use raycasting
      
      let closestTarget: number | null = null;
      let minDistance = SHOT_RANGE * SHOT_RANGE; // Compare squared distances

      for (const targetEid of clients.values()) {
        if (targetEid === firingEid) continue; // Can't shoot yourself
        // --- G3: Can't shoot dead players ---
        if (Health.current[targetEid] <= 0) continue;

        // Simple squared distance check
        const dx = Transform.x[targetEid] - Transform.x[firingEid];
        const dy = Transform.y[targetEid] - Transform.y[firingEid];
        const dz = Transform.z[targetEid] - Transform.z[firingEid];
        const distSq = dx*dx + dy*dy + dz*dz;

        // --- C2: TODO: Add "is in front" check (dot product) using yaw/pitch ---
        if (distSq < minDistance) {
          minDistance = distSq;
          closestTarget = targetEid;
        }
      }

      if (closestTarget !== null) {
        console.log(`[Host] Player ${firingEid} hit Player ${closestTarget}!`);
        Health.current[closestTarget] -= SHOT_DAMAGE;
        
        // --- G3: Check for death ---
        if (Health.current[closestTarget] <= 0) {
          console.log(`[Host] Player ${closestTarget} has died.`);
          // Set health to 0 so client can see it.
          Health.current[closestTarget] = 0; 
          // Stop processing their input
          inputs.set(closestTarget, { forward: 0, right: 0, jump: false, fire: false, yaw: 0, pitch: 0 }); // C2: Add rotation
          // Stop their movement
          Velocity.x[closestTarget] = 0;
          Velocity.y[closestTarget] = 0;
          Velocity.z[closestTarget] = 0;
        }
        // --- END G3 ---
      }

      // Prevent holding mouse down from firing every tick
      input.fire = false;
      inputs.set(firingEid, input);
    }
  }
  // --- END G2 ---

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
        hp: Health.current[eid],
        // --- C2: Add rotation to snapshot ---
        yaw: Transform.yaw[eid],
        pitch: Transform.pitch[eid],
      });
    }

    const stateMsg: StateMsg = {
      type: "state",
      tick: tick,
      entities: snapshots,
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