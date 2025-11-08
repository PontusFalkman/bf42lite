import { WebSocket, WebSocketServer } from "ws";
import { addComponent, addEntity } from "bitecs";
import { Packr } from "msgpackr";
import {
  InputMsg,
  StateMsg,
  EntitySnapshot,
  JoinMsg,
  RespawnMsg,
  // --- G4: Import new types ---
  GameState as GameStateSchema,
  // --- END G4 ---
} from "@protocol/schema";
import {
  world,
  step,
  Transform,
  Velocity,
  Health,
  Team,
  PlayerStats,
  GameState,
  GameModeSystem,
  Stamina, // <-- 1. IMPORT STAMINA
} from "@sim/logic";

const PORT = 8080;
const TICK_RATE = 60; // 60hz
const SNAPSHOT_RATE = 30; // 30hz
const TICK_MS = 1000 / TICK_RATE;
const SPEED = 3.0;
const SPRINT_SPEED = 6.0; // <-- 2. ADD SPRINT SPEED
const DEFAULT_HEALTH = 100;

const STAMINA_MAX = 100.0; // <-- 3. ADD STAMINA CONSTANTS
const STAMINA_DRAIN_PS = 20.0; // Per second
const STAMINA_REGEN_PS = 15.0; // Per second

// --- G2: Add weapon constants ---
const SHOT_DAMAGE = 10;
const SHOT_RANGE = 20.0; // Max distance for a hit
// --- END G2 ---

// --- G4: ADD GAME STATE CONSTANTS ---
const STARTING_TICKETS = 50;
const GAME_STATE_EID = addEntity(world); // Singleton entity for game state
// --- END G4 ---

const wss = new WebSocketServer({ port: PORT });
const packr = new Packr();

// Store all connected clients
const clients = new Map<WebSocket, number>();
// Store the last input for each entity
const inputs = new Map<number, InputMsg["axes"]>();

let tick = 0;
let teamCounter = 0; // --- G4: For balancing teams ---

// --- G4: INITIALIZE GAME STATE ---
addComponent(world, GameState, GAME_STATE_EID);
GameState.phase[GAME_STATE_EID] = 1; // 1 = InProgress
GameState.team1Tickets[GAME_STATE_EID] = STARTING_TICKETS;
GameState.team2Tickets[GAME_STATE_EID] = STARTING_TICKETS;
// --- END G4 ---

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

  addComponent(world, Stamina, playerEid); // <-- 4. ADD STAMINA COMPONENT
  Stamina.current[playerEid] = STAMINA_MAX;
  Stamina.max[playerEid] = STAMINA_MAX;

  // --- G4: ADD TEAM AND STATS ---
  addComponent(world, Team, playerEid);
  Team.id[playerEid] = teamCounter % 2; // Alternate teams (0 or 1)
  teamCounter++;
  
  addComponent(world, PlayerStats, playerEid);
  PlayerStats.kills[playerEid] = 0;
  PlayerStats.deaths[playerEid] = 0;
  // --- END G4 ---

  // Store the client and their entity ID
  clients.set(ws, playerEid);
  // --- C2: Update default input state ---
  inputs.set(playerEid, { forward: 0, right: 0, jump: false, fire: false, yaw: 0, pitch: 0, sprint: false }); // <-- 5. ADD SPRINT

  // --- N4: Send JoinMsg to the new client ---
  // --- C2: Add yaw/pitch to JoinMsg ---
  // --- G4: Add team/stats to JoinMsg ---
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
    // --- G4 ---
    teamId: Team.id[playerEid],
    kills: PlayerStats.kills[playerEid],
    deaths: PlayerStats.deaths[playerEid],
    stamina: Stamina.current[playerEid], // <-- 6. ADD STAMINA
  };
  ws.send(packr.pack(joinMsg));
  // --- End N4 & G4 ---

  ws.on("message", (message) => {
    const data = message as Uint8Array;
    // --- G3: Update message typing ---
    const msg = packr.unpack(data) as InputMsg | RespawnMsg;
    
    // --- G4: Don't process inputs if game is over ---
    const gamePhase = GameState.phase[GAME_STATE_EID];
    if (gamePhase !== 1) return; // 1 = InProgress
    // --- END G4 ---

    if (msg.type === "input") {
      // Don't overwrite fire state if it was set by G2 logic
      const oldFire = inputs.get(playerEid)?.fire ?? false;
      inputs.set(playerEid, { ...msg.axes, fire: oldFire || msg.axes.fire }); // <-- 7. UPDATE INPUTS
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
  // --- G4: Check game state ---
  GameModeSystem(world);
  const gamePhase = GameState.phase[GAME_STATE_EID];
  const dt = TICK_MS / 1000.0; // <-- 8. GET DELTA-TIME IN SECONDS
  // --- END G4 ---

  // --- 9. STAMINA DRAIN/REGEN LOGIC ---
  if (gamePhase === 1) {
    for (const eid of clients.values()) {
      const input = inputs.get(eid);
      if (!input) continue;

      if (input.sprint && Health.current[eid] > 0) {
        // Drain stamina
        Stamina.current[eid] -= STAMINA_DRAIN_PS * dt;
        if (Stamina.current[eid] < 0) Stamina.current[eid] = 0;
      } else if (Stamina.current[eid] < Stamina.max[eid]) {
        // Regenerate stamina
        Stamina.current[eid] += STAMINA_REGEN_PS * dt;
        if (Stamina.current[eid] > Stamina.max[eid]) {
          Stamina.current[eid] = Stamina.max[eid];
        }
      }
    }
  }
  // --- END 9 ---

  // A. Apply inputs to ECS Velocity
  for (const [eid, input] of inputs.entries()) {
    // --- C2: Store rotation from client input ---
    Transform.yaw[eid] = input.yaw;
    Transform.pitch[eid] = input.pitch;

    // --- G3: Only apply input if alive ---
    // --- G4: And if game is running ---
    if (Health.current[eid] > 0 && gamePhase === 1) {
      // --- C2: Calculate movement based on yaw ---
      // --- X1: ADD SPRINT LOGIC ---
      const isSprinting = input.sprint && Stamina.current[eid] > 0;
      const currentSpeed = isSprinting ? SPRINT_SPEED : SPEED;

      const yaw = Transform.yaw[eid];
      const forward = input.forward * currentSpeed; // <-- 10. USE CURRENT SPEED
      const right = input.right * currentSpeed; // <-- 10. USE CURRENT SPEED

      Velocity.x[eid] = Math.sin(yaw) * -forward + Math.cos(yaw) * right;
      Velocity.z[eid] = Math.cos(yaw) * -forward - Math.sin(yaw) * right;
      Velocity.y[eid] = 0; // No gravity yet
      // --- END C2 & X1 ---
    }
  }

  // --- G2: Handle Firing ---
  // --- G4: Only if game is running ---
  if (gamePhase === 1) {
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
          // --- G4: Can't shoot teammates ---
          if (Team.id[targetEid] === Team.id[firingEid]) continue;
          // --- END G4 ---

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
            inputs.set(closestTarget, { forward: 0, right: 0, jump: false, fire: false, yaw: 0, pitch: 0, sprint: false }); // C2: Add rotation, X1: Add sprint
            // Stop their movement
            Velocity.x[closestTarget] = 0;
            Velocity.y[closestTarget] = 0;
            Velocity.z[closestTarget] = 0;

            // --- G4: UPDATE STATS AND TICKETS ---
            PlayerStats.kills[firingEid]++;
            PlayerStats.deaths[closestTarget]++;
            
            // Decrement tickets for the team that died
            if (Team.id[closestTarget] === 0) { // Team 1 died
              GameState.team1Tickets[GAME_STATE_EID]--;
            } else { // Team 2 died
              GameState.team2Tickets[GAME_STATE_EID]--;
            }
            console.log(`[Host] Team 1: ${GameState.team1Tickets[GAME_STATE_EID]} | Team 2: ${GameState.team2Tickets[GAME_STATE_EID]}`);
            // --- END G4 ---
          }
          // --- END G3 ---
        }

        // Prevent holding mouse down from firing every tick
        input.fire = false;
        inputs.set(firingEid, input);
      }
    }
  }
  // --- END G2 & G4 ---

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
        // --- G4: ADD SCORING TO SNAPSHOT ---\
        teamId: Team.id[eid],
        kills: PlayerStats.kills[eid],
        deaths: PlayerStats.deaths[eid],
        stamina: Stamina.current[eid], // <-- 11. ADD STAMINA
        // --- END G4 ---
      });
    }

    // --- G4: GET GAME STATE SNAPSHOT ---
    const gameState: GameStateSchema = {
      phase: GameState.phase[GAME_STATE_EID],
      team1Tickets: GameState.team1Tickets[GAME_STATE_EID],
      team2Tickets: GameState.team2Tickets[GAME_STATE_EID],
    };
    // --- END G4 ---

    const stateMsg: StateMsg = {
      type: "state",
      tick: tick,
      entities: snapshots,
      gameState: gameState, // --- G4: Add to message ---
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