// packages/host-node/src/index.ts

import { WebSocket, WebSocketServer } from "ws";
// --- X2: Import defineQuery ---
// --- X3: Import removeEntity (or not, see below) ---
import { addComponent, addEntity, defineQuery, removeComponent } from "bitecs";
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
  // --- X2: IMPORT NEW COMPONENTS ---
  Ammo,
  Gadget,
  AmmoBox,
  // --- END X2 ---
  // --- IMPORT MED BOX ---
  MedGadget,
  MedBox,
  // --- END MED BOX ---
  // --- IMPORT REPAIR TOOL ---
  RepairTool,
  // --- END REPAIR TOOL ---
  // --- X3: IMPORT GRENADE COMPONENTS ---
  GrenadeGadget,
  Grenade,
  GrenadeTimer,
  Gravity,
  // --- END X3 ---
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

// --- X2: ADD GADGET & AMMO CONSTANTS ---
const DEFAULT_AMMO_CURRENT = 30;
const DEFAULT_AMMO_RESERVE = 120;
const DEFAULT_AMMO_MAX_RESERVE = 120;
const GADGET_COOLDOWN_SEC = 15.0; // Ammo box
const AMMO_RESUPPLY_RADIUS_SQ = 5.0 * 5.0; // Use squared radius
const AMMO_RESUPPLY_RATE_PS = 40; // reserve ammo per second
// --- END X2 ---

// --- ADD MED BOX CONSTANTS ---
const MEDGADGET_COOLDOWN_SEC = 15.0; // Med box
const HEALTH_RESUPPLY_RADIUS_SQ = 5.0 * 5.0;
const HEALTH_RESUPPLY_RATE_PS = 10; // 10 HP per second
// --- END MED BOX CONSTANTS ---

// --- ADD REPAIR TOOL CONSTANTS ---
const REPAIR_TOOL_MAX_HEAT = 100.0;
const REPAIR_TOOL_HEAT_PS = 30.0; // Heat generated per second
const REPAIR_TOOL_COOLDOWN_PS = 25.0; // Heat lost per second
const REPAIR_HEAL_PS = 15.0; // HP healed per second
const REPAIR_RANGE = 5.0; // Max distance to heal a teammate
// --- END REPAIR TOOL CONSTANTS ---

// --- X3: ADD GRENADE & PHYSICS CONSTANTS ---
const GRENADE_COOLDOWN_SEC = 10.0;
const GRENADE_TIMER_SEC = 3.0;
const GRENADE_THROW_FORCE = 10.0;
const GRENADE_DAMAGE = 80;
const GRENADE_EXPLOSION_RADIUS_SQ = 7.0 * 7.0;
const GRAVITY_ACCEL = -9.81 * 2.0; // A bit stronger for "game feel"
const BOUNCE_DAMPENING = 0.5; // 50% energy loss on bounce
// --- END X3 ---

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
// --- X2: Query for ammo boxes ---
const ammoBoxQuery = defineQuery([AmmoBox, Transform]);
// --- END X2 ---
// --- Query for med boxes ---
const medBoxQuery = defineQuery([MedBox, Transform]);
// --- END med box ---
// --- X3: Query for grenades & physics ---
const grenadeQuery = defineQuery([Grenade, Transform, Velocity, GrenadeTimer]);
const physicsQuery = defineQuery([Gravity, Transform, Velocity]);
// --- END X3 ---

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

  // --- X2: ADD AMMO & GADGET ---
  addComponent(world, Ammo, playerEid);
  Ammo.current[playerEid] = DEFAULT_AMMO_CURRENT;
  Ammo.reserve[playerEid] = DEFAULT_AMMO_RESERVE;
  Ammo.maxReserve[playerEid] = DEFAULT_AMMO_MAX_RESERVE;

  addComponent(world, Gadget, playerEid); // This is for the Ammo Box
  Gadget.cooldown[playerEid] = 0.0;
  Gadget.maxCooldown[playerEid] = GADGET_COOLDOWN_SEC;
  // --- END X2 ---

  // --- ADD MED BOX GADGET ---
  addComponent(world, MedGadget, playerEid); // This is for the Med Box
  MedGadget.cooldown[playerEid] = 0.0;
  MedGadget.maxCooldown[playerEid] = MEDGADGET_COOLDOWN_SEC;
  // --- END MED BOX GADGET ---

  // --- ADD REPAIR TOOL ---
  addComponent(world, RepairTool, playerEid);
  RepairTool.current[playerEid] = 0.0;
  RepairTool.max[playerEid] = REPAIR_TOOL_MAX_HEAT;
  // --- END REPAIR TOOL ---

  // --- X3: ADD GRENADE GADGET ---
  addComponent(world, GrenadeGadget, playerEid);
  GrenadeGadget.cooldown[playerEid] = 0.0;
  GrenadeGadget.maxCooldown[playerEid] = GRENADE_COOLDOWN_SEC;
  // --- END X3 ---

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
  // --- X2: Add useGadget ---
  // --- X3: Add useGrenade ---
  inputs.set(playerEid, { forward: 0, right: 0, jump: false, fire: false, yaw: 0, pitch: 0, sprint: false, useGadget: false, useMedBox: false, useRepairTool: false, useGrenade: false }); // <-- 5. ADD SPRINT & X2 & MEDBOX & REPAIR & X3
  // --- N4: Send JoinMsg to the new client ---
  // --- C2: Add yaw/pitch to JoinMsg ---
  // --- G4: Add team/stats to JoinMsg ---
  // --- X2: Add ammo/gadget to JoinMsg ---
  // --- X3: Add grenade gadget to JoinMsg ---
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
    // --- X2 ---
    ammoCurrent: Ammo.current[playerEid],
    ammoReserve: Ammo.reserve[playerEid],
    gadgetCooldown: Gadget.cooldown[playerEid],
    // --- MED BOX ---
    medGadgetCooldown: MedGadget.cooldown[playerEid],
    // --- REPAIR TOOL ---
    repairToolHeat: RepairTool.current[playerEid],
    // --- X3 ---
    grenadeGadgetCooldown: GrenadeGadget.cooldown[playerEid],
  };
  ws.send(packr.pack(joinMsg));
  // --- End N4 & G4 & X2 & MED BOX & REPAIR & X3 ---

  ws.on("message", (message) => {
    const data = message as Uint8Array;
    // --- G3: Update message typing ---
    const msg = packr.unpack(data) as InputMsg | RespawnMsg;
    
    // --- G4: Don't process inputs if game is over ---
    const gamePhase = GameState.phase[GAME_STATE_EID];
    if (gamePhase !== 1) return; // 1 = InProgress
    // --- END G4 ---

    if (msg.type === "input") {
      // --- BUGFIX: This is the fix for the auto-deploy bug ---
      const oldInput = inputs.get(playerEid);
      if (!oldInput) return; // Should not happen

      // 1. Get the "new" press events.
      // We only care about `fire` and gadgets.
      // `fire` is true if the client *just* clicked.
      const newFire = !oldInput.fire && msg.axes.fire;
      
      // `useGadget` is true if client *just* pressed and cooldown is ready.
      const newUseGadget = !oldInput.useGadget && msg.axes.useGadget && Gadget.cooldown[playerEid] === 0;
      const newUseMedBox = !oldInput.useMedBox && msg.axes.useMedBox && MedGadget.cooldown[playerEid] === 0;
      const newUseGrenade = !oldInput.useGrenade && msg.axes.useGrenade && GrenadeGadget.cooldown[playerEid] === 0;

      // 2. Set the new input state
      inputs.set(playerEid, {
        ...msg.axes,
        // Carry over the "latched" state *only* if the new input is also true.
        // Otherwise, reset it. This consumes the input.
        fire: oldInput.fire || newFire,
        useGadget: oldInput.useGadget || newUseGadget,
        useMedBox: oldInput.useMedBox || newUseMedBox,
        useGrenade: oldInput.useGrenade || newUseGrenade,
        // Repair tool is a "hold" action, so it's fine to be overwritten
        useRepairTool: msg.axes.useRepairTool, 
      });
      // --- END BUGFIX ---
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
      // --- X2: Reset ammo and gadgets ---
      Ammo.current[playerEid] = DEFAULT_AMMO_CURRENT;
      Ammo.reserve[playerEid] = DEFAULT_AMMO_RESERVE;
      Gadget.cooldown[playerEid] = 0.0;
      // --- END X2 ---
      // --- MED BOX ---
      MedGadget.cooldown[playerEid] = 0.0;
      // --- END MED BOX ---
      // --- REPAIR TOOL ---
      RepairTool.current[playerEid] = 0.0;
      // --- END REPAIR TOOL ---
      // --- X3: RESET GRENADE ---
      GrenadeGadget.cooldown[playerEid] = 0.0;
      // --- END X3 ---
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

  // --- 9. STAMINA & GADGET COOLDOWN & REPAIR HEAT LOGIC ---
  // --- X3: ADD GRENADE COOLDOWN ---
  if (gamePhase === 1) {
    for (const eid of clients.values()) {
      const input = inputs.get(eid);
      if (!input) continue;

      // Stamina
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

      // --- X2: Gadget Cooldown (Ammo Box) ---
      if (Gadget.cooldown[eid] > 0) {
        Gadget.cooldown[eid] -= dt;
        if (Gadget.cooldown[eid] < 0) {
          Gadget.cooldown[eid] = 0;
        }
      }
      // --- END X2 ---

      // --- MedGadget Cooldown (Med Box) ---
      if (MedGadget.cooldown[eid] > 0) {
        MedGadget.cooldown[eid] -= dt;
        if (MedGadget.cooldown[eid] < 0) {
          MedGadget.cooldown[eid] = 0;
        }
      }
      // --- END MED BOX ---

      // --- Repair Tool Heat/Cooldown ---
      if (input.useRepairTool && Health.current[eid] > 0) {
        // Build heat
        RepairTool.current[eid] += REPAIR_TOOL_HEAT_PS * dt;
        if (RepairTool.current[eid] > RepairTool.max[eid]) {
          RepairTool.current[eid] = RepairTool.max[eid];
        }
      } else if (RepairTool.current[eid] > 0) {
        // Cool down
        RepairTool.current[eid] -= REPAIR_TOOL_COOLDOWN_PS * dt;
        if (RepairTool.current[eid] < 0) {
          RepairTool.current[eid] = 0;
        }
      }
      // --- END REPAIR TOOL ---

      // --- X3: Grenade Cooldown ---
      if (GrenadeGadget.cooldown[eid] > 0) {
        GrenadeGadget.cooldown[eid] -= dt;
        if (GrenadeGadget.cooldown[eid] < 0) {
          GrenadeGadget.cooldown[eid] = 0;
        }
      }
      // --- END X3 ---
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

      // --- X2: HANDLE GADGET DEPLOY (AMMO BOX) ---
      if (input.useGadget && Gadget.cooldown[eid] === 0) {
        console.log(`[Host] Player ${eid} deploying AmmoBox.`);
        const boxEid = addEntity(world);
        addComponent(world, Transform, boxEid);
        // Spawn slightly in front of player
        const spawnX = Transform.x[eid] + Math.sin(yaw) * -1.0;
        const spawnZ = Transform.z[eid] + Math.cos(yaw) * -1.0;
        Transform.x[boxEid] = spawnX;
        Transform.y[boxEid] = Transform.y[eid]; // On the ground
        Transform.z[boxEid] = spawnZ;
        
        addComponent(world, Team, boxEid);
        Team.id[boxEid] = Team.id[eid]; // Same team
        
        addComponent(world, AmmoBox, boxEid); // Tag it
        
        // Start cooldown
        Gadget.cooldown[eid] = Gadget.maxCooldown[eid];
        
        // Consume input
        input.useGadget = false;
        inputs.set(eid, input);
      }
      // --- END X2 ---
      
      // --- HANDLE MED BOX DEPLOY ---
      if (input.useMedBox && MedGadget.cooldown[eid] === 0) {
        console.log(`[Host] Player ${eid} deploying MedBox.`);
        const boxEid = addEntity(world);
        addComponent(world, Transform, boxEid);
        // Spawn slightly in front of player
        const spawnX = Transform.x[eid] + Math.sin(yaw) * -1.0;
        const spawnZ = Transform.z[eid] + Math.cos(yaw) * -1.0;
        Transform.x[boxEid] = spawnX;
        Transform.y[boxEid] = Transform.y[eid]; // On the ground
        Transform.z[boxEid] = spawnZ;
        
        addComponent(world, Team, boxEid);
        Team.id[boxEid] = Team.id[eid]; // Same team
        
        addComponent(world, MedBox, boxEid); // Tag it
        
        // Start cooldown
        MedGadget.cooldown[eid] = MedGadget.maxCooldown[eid];
        
        // Consume input
        input.useMedBox = false;
        inputs.set(eid, input);
      }
      // --- END MED BOX ---
      
      // --- X3: HANDLE GRENADE THROW ---
      if (input.useGrenade && GrenadeGadget.cooldown[eid] === 0) {
        console.log(`[Host] Player ${eid} throwing Grenade.`);
        const nadeEid = addEntity(world);
        
        // Add components
        addComponent(world, Transform, nadeEid);
        addComponent(world, Velocity, nadeEid);
        addComponent(world, Team, nadeEid);
        addComponent(world, Grenade, nadeEid); // Tag
        addComponent(world, Gravity, nadeEid); // Tag
        addComponent(world, GrenadeTimer, nadeEid);
        
        // Set initial state
        Team.id[nadeEid] = Team.id[eid]; // Same team
        GrenadeTimer.remaining[nadeEid] = GRENADE_TIMER_SEC;
        
        // Spawn at player's head height
        Transform.x[nadeEid] = Transform.x[eid];
        Transform.y[nadeEid] = Transform.y[eid] + 1.5; // Eye level
        Transform.z[nadeEid] = Transform.z[eid];
        
        // Calculate throw vector
        const pitch = Transform.pitch[eid];
        
        // Get forward vector (from player's aim)
        const forwardX = Math.sin(yaw) * -1.0;
        const forwardZ = Math.cos(yaw) * -1.0;
        
        // Combine horizontal (yaw) and vertical (pitch) components
        // We use sin(pitch) for vertical velocity
        // We use cos(pitch) to scale the horizontal velocity
        Velocity.x[nadeEid] = forwardX * Math.cos(pitch) * GRENADE_THROW_FORCE;
        Velocity.y[nadeEid] = Math.sin(pitch) * GRENADE_THROW_FORCE * -1.0; // Pitches are inverted
        Velocity.z[nadeEid] = forwardZ * Math.cos(pitch) * GRENADE_THROW_FORCE;
        
        // Add player's current velocity so it's a "relative" throw
        Velocity.x[nadeEid] += Velocity.x[eid];
        Velocity.z[nadeEid] += Velocity.z[eid];
        
        // Start cooldown
        GrenadeGadget.cooldown[eid] = GrenadeGadget.maxCooldown[eid];
        
        // Consume input
        input.useGrenade = false;
        inputs.set(eid, input);
      }
      // --- END X3 ---
    }
  }

  // --- NEW: Handle Repairing ---
  if (gamePhase === 1) {
    for (const [repairingEid, input] of inputs.entries()) {
      // Only allow repairing if alive, holding the button, and not overheated
      if (input.useRepairTool && Health.current[repairingEid] > 0 && RepairTool.current[repairingEid] < RepairTool.max[repairingEid]) {
        
        let closestTeammate: number | null = null;
        let minDistance = REPAIR_RANGE * REPAIR_RANGE; 

        for (const targetEid of clients.values()) {
          if (targetEid === repairingEid) continue; // Can't heal yourself
          if (Health.current[targetEid] <= 0) continue; // Can't heal dead players
          if (Team.id[targetEid] !== Team.id[repairingEid]) continue; // Can't heal enemies
          if (Health.current[targetEid] >= Health.max[targetEid]) continue; // Can't heal full health

          // Squared distance check
          const dx = Transform.x[targetEid] - Transform.x[repairingEid];
          const dy = Transform.y[targetEid] - Transform.y[repairingEid];
          const dz = Transform.z[targetEid] - Transform.z[repairingEid];
          const distSq = dx*dx + dy*dy + dz*dz;

          // TODO: Add "is in front" check (dot product)
          if (distSq < minDistance) {
            minDistance = distSq;
            closestTeammate = targetEid;
          }
        }

        if (closestTeammate !== null) {
          console.log(`[Host] Player ${repairingEid} is healing Player ${closestTeammate}!`);
          Health.current[closestTeammate] += REPAIR_HEAL_PS * dt;
          if (Health.current[closestTeammate] > Health.max[closestTeammate]) {
            Health.current[closestTeammate] = Health.max[closestTeammate];
          }
        }
      }
    }
  }
  // --- END Handle Repairing ---

  // --- G2: Handle Firing ---
  // --- G4: Only if game is running ---
  if (gamePhase === 1) {
    for (const [firingEid, input] of inputs.entries()) {
      // --- G3: Only allow firing if alive ---
      if (input.fire && Health.current[firingEid] > 0) {
        
        // --- BUGFIX 1: REWORKED AMMO/RELOAD LOGIC ---
        
        // Check if we have ammo *before* firing
        if (Ammo.current[firingEid] > 0) {
          console.log(`[Host] Player ${firingEid} is firing!`);
          Ammo.current[firingEid]--; // Consume ammo

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
              inputs.set(closestTarget, { forward: 0, right: 0, jump: false, fire: false, yaw: 0, pitch: 0, sprint: false, useGadget: false, useMedBox: false, useRepairTool: false, useGrenade: false }); // C2, X1, X2, MedBox, Repair, X3
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
        } else {
          // No ammo in clip, try to "auto-reload"
          console.log(`[Host] Player ${firingEid} is empty, reloading...`);
          const toReload = Math.min(DEFAULT_AMMO_CURRENT, Ammo.reserve[firingEid]);
          if (toReload > 0) {
            Ammo.current[firingEid] = toReload;
            Ammo.reserve[firingEid] -= toReload;
          } else {
            // "click click" - no ammo left at all
            Ammo.current[firingEid] = 0; 
          }
        }
        // --- END BUGFIX 1 ---

        // Prevent holding mouse down from firing every tick
        input.fire = false;
        inputs.set(firingEid, input);
      }
    }
  }
  // --- END G2 & G4 ---

  // --- X3: NEW SYSTEM: PHYSICS (GRAVITY & BOUNCE) ---
  if (gamePhase === 1) {
    const physicsEntities = physicsQuery(world);
    for (const eid of physicsEntities) {
      // Apply gravity
      Velocity.y[eid] += GRAVITY_ACCEL * dt;
      
      // Simple floor bounce
      if (Transform.y[eid] <= 0 && Velocity.y[eid] < 0) {
        Transform.y[eid] = 0; // Correct position
        Velocity.y[eid] *= -BOUNCE_DAMPENING; // Reverse and dampen
        // Add friction
        Velocity.x[eid] *= 0.8;
        Velocity.z[eid] *= 0.8;
      }
    }
  }
  // --- END X3 ---

  // B. Run the ECS simulation step (updates Transform based on Velocity)
  step();

// --- X3: GRENADE TIMER & EXPLOSION ---
if (gamePhase === 1) {
  const grenadeEntities = grenadeQuery(world);
  const grenadesToRemove: number[] = [];

  for (const nadeEid of grenadeEntities) {
    // Guard against missing timers
    if (GrenadeTimer.remaining[nadeEid] === undefined) {
      GrenadeTimer.remaining[nadeEid] = GRENADE_TIMER_SEC;
    }

    GrenadeTimer.remaining[nadeEid] -= dt;

    if (GrenadeTimer.remaining[nadeEid] <= 0) {
      // --- EXPLODE ---
      const nadeX = Transform.x[nadeEid];
      const nadeY = Transform.y[nadeEid];
      const nadeZ = Transform.z[nadeEid];
      const nadeTeam = Team.id[nadeEid];

      console.log(`[Host] Grenade ${nadeEid} exploded!`);

        // Find all players and check distance
        for (const [ws, playerEid] of clients.entries()) {
          // Ignore dead players
          if (Health.current[playerEid] <= 0) continue;
  
          const dx = Transform.x[playerEid] - nadeX;
          const dy = Transform.y[playerEid] - nadeY;
          const dz = Transform.z[playerEid] - nadeZ;
          const distSq = dx * dx + dy * dy + dz * dz;
  
          if (distSq <= GRENADE_EXPLOSION_RADIUS_SQ) {
            console.log(`[Host] Grenade hit player ${playerEid}!`);
            Health.current[playerEid] -= GRENADE_DAMAGE;
  
            // Death handling (uses the updated block from step 1)
            if (Health.current[playerEid] <= 0) {
              console.log(`[Host] Player ${playerEid} has died from grenade.`);
              Health.current[playerEid] = 0;
  
              inputs.set(playerEid, {
                forward: 0,
                right: 0,
                jump: false,
                fire: false,
                sprint: false,
                useGadget: false,
                useMedBox: false,
                useRepairTool: false,
                useGrenade: false,
              });
  
              Velocity.x[playerEid] = 0;
              Velocity.y[playerEid] = 0;
              Velocity.z[playerEid] = 0;
  
              PlayerStats.deaths[playerEid]++;
  
              if (Team.id[playerEid] === 0) {
                GameState.team1Tickets[GAME_STATE_EID]--;
              } else {
                GameState.team2Tickets[GAME_STATE_EID]--;
              }
              console.log(
                `[Host] Team 1: ${GameState.team1Tickets[GAME_STATE_EID]} | Team 2: ${GameState.team2Tickets[GAME_STATE_EID]}`
              );
            }
          }
        }
        
      // Move grenade underground and stop its timer/movement.
      // Move grenade underground and stop its motion
      Transform.y[nadeEid] = -10000;
      Velocity.x[nadeEid] = 0;
      Velocity.y[nadeEid] = 0;
      Velocity.z[nadeEid] = 0;

      // Mark this grenade for removal after the loop
      grenadesToRemove.push(nadeEid);
    }
  }

  // Now safely remove components after iteration
  for (const nadeEid of grenadesToRemove) {
    removeComponent(world, Gravity, nadeEid);
    removeComponent(world, Grenade, nadeEid);
    removeComponent(world, GrenadeTimer, nadeEid);
  }
}
  // --- END X3 ---

  // --- X2: NEW SYSTEM: AMMO RESUPPLY ---
  if (gamePhase === 1) {
    const ammoBoxes = ammoBoxQuery(world);
    for (const boxEid of ammoBoxes) {
      const boxX = Transform.x[boxEid];
      const boxZ = Transform.z[boxEid];
      const boxTeam = Team.id[boxEid];

      for (const playerEid of clients.values()) {
        // Check if player is alive and needs ammo
        if (Health.current[playerEid] <= 0) continue;
        if (Ammo.reserve[playerEid] >= Ammo.maxReserve[playerEid]) continue;
        // Check if same team
        if (Team.id[playerEid] !== boxTeam) continue;

        // Check distance (squared)
        const dx = Transform.x[playerEid] - boxX;
        const dz = Transform.z[playerEid] - boxZ;
        const distSq = dx * dx + dz * dz;

        if (distSq <= AMMO_RESUPPLY_RADIUS_SQ) {
          // Resupply
          // --- BUGFIX 2: This logic now works thanks to f32 component ---
          Ammo.reserve[playerEid] += AMMO_RESUPPLY_RATE_PS * dt;
          if (Ammo.reserve[playerEid] > Ammo.maxReserve[playerEid]) {
            Ammo.reserve[playerEid] = Ammo.maxReserve[playerEid];
          }
          // --- END BUGFIX 2 ---
        }
      }
    }
  }
  // --- END X2 ---

  // --- NEW SYSTEM: HEALTH RESUPPLY ---
  if (gamePhase === 1) {
    const medBoxes = medBoxQuery(world);
    for (const boxEid of medBoxes) {
      const boxX = Transform.x[boxEid];
      const boxZ = Transform.z[boxEid];
      const boxTeam = Team.id[boxEid];

      for (const playerEid of clients.values()) {
        // Check if player is alive and needs health
        if (Health.current[playerEid] <= 0) continue;
        if (Health.current[playerEid] >= Health.max[playerEid]) continue;
        // Check if same team
        if (Team.id[playerEid] !== boxTeam) continue;

        // Check distance (squared)
        const dx = Transform.x[playerEid] - boxX;
        const dz = Transform.z[playerEid] - boxZ;
        const distSq = dx * dx + dz * dz;

        if (distSq <= HEALTH_RESUPPLY_RADIUS_SQ) {
          // Resupply (Heal)
          Health.current[playerEid] += HEALTH_RESUPPLY_RATE_PS * dt;
          if (Health.current[playerEid] > Health.max[playerEid]) {
            Health.current[playerEid] = Health.max[playerEid];
          }
        }
      }
    }
  }
  // --- END HEALTH RESUPPLY ---

  // C. Broadcast snapshots (at SNAPSHOT_RATE)
  if (tick % (TICK_RATE / SNAPSHOT_RATE) === 0) {
    const snapshots: EntitySnapshot[] = [];

    // Player snapshots
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
        // --- X2: ADD AMMO/GADGET TO SNAPSHOT ---
        ammoCurrent: Ammo.current[eid],
        ammoReserve: Ammo.reserve[eid], // This will be a float, client will parse
        gadgetCooldown: Gadget.cooldown[eid],
        // --- END X2 & G4 ---
        // --- MED BOX ---
        medGadgetCooldown: MedGadget.cooldown[eid],
        // --- END MED BOX ---
        // --- REPAIR TOOL ---
        repairToolHeat: RepairTool.current[eid],
        // --- END REPAIR TOOL ---
        // --- X3: ADD GRENADE GADGET ---
        grenadeGadgetCooldown: GrenadeGadget.cooldown[eid],
        // --- END X3 ---
      });
    }

    // --- X2: AmmoBox snapshots ---
    const ammoBoxes = ammoBoxQuery(world);
    for (const boxEid of ammoBoxes) {
      snapshots.push({
        id: boxEid,
        x: Transform.x[boxEid],
        y: Transform.y[boxEid],
        z: Transform.z[boxEid],
        hp: 1, // Doesn't have health, but schema needs it
        yaw: 0,
        pitch: 0,
        teamId: Team.id[boxEid],
        isAmmoBox: true,
      });
    }
    // --- END X2 ---
    
    // --- MedBox snapshots ---
    const medBoxes = medBoxQuery(world);
    for (const boxEid of medBoxes) {
      snapshots.push({
        id: boxEid,
        x: Transform.x[boxEid],
        y: Transform.y[boxEid],
        z: Transform.z[boxEid],
        hp: 1, // Doesn't have health, but schema needs it
        yaw: 0,
        pitch: 0,
        teamId: Team.id[boxEid],
        isMedBox: true,
      });
    }
    // --- END MED BOX ---

    // --- X3: Grenade snapshots ---
    const grenadeEntities = grenadeQuery(world);
    for (const nadeEid of grenadeEntities) {
      // Don't send "dead" grenades
      if (Transform.y[nadeEid] < -100) continue; 
      
      snapshots.push({
        id: nadeEid,
        x: Transform.x[nadeEid],
        y: Transform.y[nadeEid],
        z: Transform.z[nadeEid],
        hp: 1, // Schema needs it
        yaw: 0,
        pitch: 0,
        teamId: Team.id[nadeEid],
        isGrenade: true,
        grenadeTimer: GrenadeTimer.remaining[nadeEid],
      });
    }
    // --- END X3 ---

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