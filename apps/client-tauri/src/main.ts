// apps/client-tauri/src/main.ts

import * as THREE from "three";
// Import the GLTFLoader
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { initInput, updateInput, inputState, keysPressed } from "./input";
import { Packr } from "msgpackr";
import {
  InputMsg,
  StateMsg,
  JoinMsg,
  RespawnMsg,
  GameState as GameStateSchema,
} from "@protocol/schema";
import { WebSocketAdapter } from "@net/adapter";

// N4: Import simulation logic for client-side prediction
import {
  world as clientWorld,
  Transform,
  Velocity,
  Health,
  Team,
  PlayerStats,
  Stamina, // <-- 1. IMPORT STAMINA
  // --- X2: IMPORT NEW COMPONENTS ---
  Ammo,
  Gadget,
  AmmoBox,
  // --- END X2 ---
} from "@sim/logic";

// TAURI invoke
import { invoke } from "@tauri-apps/api/core";

// ECS helpers from bitecs
// --- X2: Import defineQuery ---
import { addComponent, addEntity, defineQuery } from "bitecs";

// === 0. GET UI ELEMENTS ===
const canvas = document.getElementById("game") as HTMLCanvasElement | null;
const hudEl = document.getElementById("hud") as HTMLDivElement | null;
const menuEl = document.getElementById("menu") as HTMLDivElement | null;
const fpsEl = document.getElementById("fps-counter") as HTMLDivElement | null;
const rttEl = document.getElementById("rtt-counter") as HTMLDivElement | null;
const btnHost = document.getElementById("btn-host") as HTMLButtonElement | null;
const btnJoin = document.getElementById("btn-join") as HTMLButtonElement | null;
const joinIpEl = document.getElementById("join-ip") as HTMLInputElement | null;

// HUD
const healthEl = document.getElementById("health-counter") as HTMLDivElement | null;
const staminaEl = document.getElementById("stamina-counter") as HTMLDivElement | null; // <-- 2. GET STAMINA ELEMENT
const ammoEl = document.getElementById("ammo-counter") as HTMLDivElement | null;
const gadgetEl = document.getElementById("gadget-counter") as HTMLDivElement | null; // <-- ADD THIS

// Respawn UI
const respawnScreenEl = document.getElementById("respawn-screen") as HTMLDivElement | null;
const respawnTimerEl = document.getElementById("respawn-timer") as HTMLDivElement | null;
const btnDeploy = document.getElementById("btn-deploy") as HTMLButtonElement | null;

// Scoreboard
const scoreboardEl = document.getElementById("scoreboard") as HTMLDivElement | null;
const team1ScoreEl = document.getElementById("team1-score") as HTMLDivElement | null;
const team2ScoreEl = document.getElementById("team2-score") as HTMLDivElement | null;
const matchEndEl = document.getElementById("match-end-message") as HTMLDivElement | null;

if (
  !canvas || !hudEl || !menuEl || !btnHost || !btnJoin || !joinIpEl ||
  !healthEl || !staminaEl || !ammoEl || !gadgetEl || // <-- ADD TO CHECK
  !respawnScreenEl || !respawnTimerEl || !btnDeploy ||
  !scoreboardEl || !team1ScoreEl || !team2ScoreEl || !matchEndEl
) {
  throw new Error("UI elements not found. Check index.html.");
}

// === 1. BUTTON EVENT LISTENERS ===
btnHost.onclick = () => {
  alert("Refactor Complete! Please run 'pnpm dev:host' in your terminal first, then click 'Join'.");
};

btnJoin.onclick = () => {
  const url = joinIpEl.value;
  console.log(`Connecting to ${url}...`);
  startGame("join", url);
};

// --- Rust bridge types ---
interface RustEntity {
  id: number;
  transform: { x: number; y: number; z: number; yaw: number; pitch: number };
  velocity: { x: number; y: number; z: number };
  health: { current: number; max: number };
  team: { id: number };
  stats: { kills: number; deaths: number };
}

interface WorldState {
  entities: RustEntity[];
}

// ECS query: all entities with Transform
const entityQuery = defineQuery([Transform]);
// --- X2: Gadget query ---
const ammoBoxQuery = defineQuery([AmmoBox, Transform]);

function serializeWorldToRust(): WorldState {
  const entities = entityQuery(clientWorld as any);
  const rustEntities: RustEntity[] = [];

  for (const eid of entities) {
    rustEntities.push({
      id: eid,
      transform: {
        x: Transform.x[eid],
        y: Transform.y[eid],
        z: Transform.z[eid],
        yaw: Transform.yaw[eid],
        pitch: Transform.pitch[eid],
      },
      velocity: {
        x: Velocity.x[eid] ?? 0,
        y: Velocity.y[eid] ?? 0,
        z: Velocity.z[eid] ?? 0,
      },
      health: {
        current: Health.current[eid] ?? 0,
        max: Health.max[eid] ?? 100,
      },
      team: {
        id: Team.id[eid] ?? 0,
      },
      stats: {
        kills: PlayerStats.kills[eid] ?? 0,
        deaths: PlayerStats.deaths[eid] ?? 0,
      },
    });
  }

  return { entities: rustEntities };
}

function deserializeWorldFromRust(newState: WorldState) {
  for (const entity of newState.entities) {
    const eid = entity.id;

    if (Transform.x[eid] === undefined) {
      addComponent(clientWorld, Transform, eid);
      addComponent(clientWorld, Velocity, eid);
      addComponent(clientWorld, Health, eid);
      addComponent(clientWorld, Team, eid);
      addComponent(clientWorld, PlayerStats, eid);
      addComponent(clientWorld, Stamina, eid); // <-- 4. ADD STAMINA
      addComponent(clientWorld, Ammo, eid); // <-- ADD THIS
      addComponent(clientWorld, Gadget, eid); // <-- ADD THIS
    }

    Transform.x[eid] = entity.transform.x;
    Transform.y[eid] = entity.transform.y;
    Transform.z[eid] = entity.transform.z;
    Transform.yaw[eid] = entity.transform.yaw;
    Transform.pitch[eid] = entity.transform.pitch;

    Velocity.x[eid] = entity.velocity.x;
    Velocity.y[eid] = entity.velocity.y;
    Velocity.z[eid] = entity.velocity.z;

    Health.current[eid] = entity.health.current;
    Health.max[eid] = entity.health.max;

    // Stamina isn't part of the Rust->JS bridge yet,
    // so we just initialize it. The server's network
    // message will correct the value.
    if (Stamina.current[eid] === undefined) { // <-- 5. INITIALIZE STAMINA
      Stamina.current[eid] = 100;
      Stamina.max[eid] = 100;
    }

    // --- X2: Initialize Ammo/Gadget if not present ---
    if (Ammo.current[eid] === undefined) {
      Ammo.current[eid] = 30;
      Ammo.reserve[eid] = 120;
    }
    if (Gadget.cooldown[eid] === undefined) {
      Gadget.cooldown[eid] = 0;
    }
    // --- END X2 ---

    Team.id[eid] = entity.team.id;
    PlayerStats.kills[eid] = entity.stats.kills;
    PlayerStats.deaths[eid] = entity.stats.deaths;
  }
}

// === MAIN ENTRY ===
async function startGame(mode: "join", url: string) {
  menuEl.style.display = "none";
  hudEl.style.display = "none";
  canvas.style.display = "block";

  let currentGameState: GameStateSchema | undefined = undefined;
  let localTeamId: number | undefined = undefined;

  // Respawn UI state
  let respawnInterval: number | null = null;

  function hideRespawnScreen() {
    respawnScreenEl!.style.display = "none";
    if (currentGameState?.phase !== 2) {
      hudEl.style.display = "block";
    }
    if (respawnInterval) {
      clearInterval(respawnInterval);
      respawnInterval = null;
    }
  }

  function showRespawnScreen(duration: number = 5) {
    if (currentGameState?.phase === 2) return;

    respawnScreenEl!.style.display = "flex";
    hudEl.style.display = "none";

    btnDeploy.disabled = true;
    btnDeploy.textContent = "DEPLOYING IN...";

    let remaining = duration;
    respawnTimerEl!.textContent = remaining.toString();

    if (respawnInterval) clearInterval(respawnInterval);

    respawnInterval = window.setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(respawnInterval!);
        respawnInterval = null;
        respawnTimerEl!.textContent = "READY";
        btnDeploy.disabled = false;
        btnDeploy.textContent = "DEPLOY";
      } else {
        respawnTimerEl!.textContent = remaining.toString();
      }
    }, 1000);
  }

  const adapter = new WebSocketAdapter(url!);
  const packr = new Packr();
  let tick = 0;
  const sendTimeMap = new Map<number, number>();

  let joinResolve: (() => void) | null = null;
  const joinPromise = new Promise<void>((resolve) => {
    joinResolve = resolve;
  });

  btnDeploy.onclick = () => {
    hideRespawnScreen();
    console.log("Player clicked DEPLOY");
    const respawnMsg: RespawnMsg = { type: "respawn" };
    adapter.send(packr.pack(respawnMsg));
    canvas.requestPointerLock();
  };

  showRespawnScreen();

  // THREE.js setup
  const renderer = new THREE.WebGLRenderer({ canvas });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x202028);

  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.rotation.order = "YXZ";

  const playerRotation = new THREE.Euler(0, 0, 0, "YXZ");
  const MOUSE_SENSITIVITY = 0.002;

  const cameraTarget = new THREE.Vector3();
  const smoothingFactor = 0.1;
  const cameraOffset = new THREE.Vector3(0, 1.6, 3.0);
  const yawEuler = new THREE.Euler(0, 0, 0, "YXZ");

  const light = new THREE.DirectionalLight(0xffffff, 1.0);
  light.position.set(10, 20, 5);
  light.castShadow = true;
  light.shadow.mapSize.width = 1024;
  light.shadow.mapSize.height = 1024;
  light.shadow.camera.near = 0.5;
  light.shadow.camera.far = 50;
  scene.add(light);

  const ambientLight = new THREE.AmbientLight(0x606060, 1.5);
  scene.add(ambientLight);

  // Simple warehouse
  const mapGroup = new THREE.Group();
  scene.add(mapGroup);

  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x444444,
    metalness: 0.1,
    roughness: 0.8,
  });

  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0x888888,
    metalness: 0.1,
    roughness: 0.8,
  });

  const floorGeometry = new THREE.BoxGeometry(50, 1, 50);
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.position.y = -0.5;
  floor.receiveShadow = true;
  mapGroup.add(floor);

  const wallHeight = 10;
  const wallThickness = 1;
  const wallLength = 50;

  const wallNorth = new THREE.Mesh(
    new THREE.BoxGeometry(wallLength, wallHeight, wallThickness),
    wallMaterial
  );
  wallNorth.position.set(0, wallHeight / 2, -wallLength / 2);
  wallNorth.castShadow = true;
  wallNorth.receiveShadow = true;
  mapGroup.add(wallNorth);

  const wallSouth = new THREE.Mesh(
    new THREE.BoxGeometry(wallLength, wallHeight, wallThickness),
    wallMaterial
  );
  wallSouth.position.set(0, wallHeight / 2, wallLength / 2);
  wallSouth.castShadow = true;
  wallSouth.receiveShadow = true;
  mapGroup.add(wallSouth);

  const wallEast = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness, wallHeight, wallLength),
    wallMaterial
  );
  wallEast.position.set(wallLength / 2, wallHeight / 2, 0);
  wallEast.castShadow = true;
  wallEast.receiveShadow = true;
  mapGroup.add(wallEast);

  const wallWest = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness, wallHeight, wallLength),
    wallMaterial
  );
  wallWest.position.set(-wallLength / 2, wallHeight / 2, 0);
  wallWest.castShadow = true;
  wallWest.receiveShadow = true;
  mapGroup.add(wallWest);

  // === client-side sim state ===
  const SPEED = 3.0;
  const SPRINT_SPEED = 6.0; // <-- 12. ADD SPRINT SPEED FOR CLIENT
  let localPlayerEid: number | null = null;
  const playerObjects = new Map<number, THREE.Object3D>();
  // --- X2: GADGET RENDER STATE ---
  const gadgetObjects = new Map<number, THREE.Object3D>();
  const fallbackGadgetGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  const ammoBoxMaterial = new THREE.MeshStandardMaterial({
    color: 0x00ff00, // Bright green
    roughness: 0.7,
  });
  // --- END X2 ---

  const gltfLoader = new GLTFLoader();
  const fallbackGeometry = new THREE.BoxGeometry();

  // Ensure ECS entity exists for given id
  function ensureEntity(world: any, eid: number) {
    while (world.entityCursor <= eid) {
      addEntity(world);
    }
  }
  function safeAddComponent(world: any, component: any, eid: number) {
    ensureEntity(world, eid);
    try {
      // --- X2: Add Ammo/Gadget/AmmoBox components ---
      if (
        component === Ammo &&
        Ammo.current[eid] === undefined
      ) {
        addComponent(world, Ammo, eid);
      } else if (
        component === Gadget &&
        Gadget.cooldown[eid] === undefined
      ) {
        addComponent(world, Gadget, eid);
      } else if (
        component === AmmoBox &&
        AmmoBox.getStorage(eid) === undefined // Check if tag exists
      ) {
        addComponent(world, AmmoBox, eid);
      } else if (component !== Ammo && component !== Gadget && component !== AmmoBox) {
      // --- END X2 ---
        addComponent(world, component, eid);
      }
    } catch (err) {
      console.warn("safeAddComponent failed", {
        eid,
        component: component?.name ?? "unknown",
        err,
      });
      // Do NOT rethrow – prevents the outer try/catch from logging a fatal error
    }
  }

  function getPlayerObject(eid: number, teamId: number): THREE.Object3D {
    let rootObject = playerObjects.get(eid);

    if (!rootObject) {
      rootObject = new THREE.Group();
      scene.add(rootObject);
      playerObjects.set(eid, rootObject);
      console.log(`Added placeholder Group for player ${eid} on team ${teamId}`);

      gltfLoader.load(
        "/models/soldier.glb",
        (gltf) => {
          console.log(`Model loaded for ${eid}, adding to scene graph.`);
          const model = gltf.scene;

          let color = teamId === 0 ? 0xff6666 : 0x6666ff;
          if (eid === localPlayerEid) {
            color = 0x66ff66;
          }

          model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.material = new THREE.MeshStandardMaterial({
                color,
              });
              mesh.castShadow = true;
            }
          });

          model.scale.set(0.5, 0.5, 0.5);
          model.position.y = -0.5;

          rootObject!.add(model);
        },
        undefined,
        (error) => {
          console.error(`Error loading model for ${eid}, using fallback cube:`, error);

          const material = new THREE.MeshStandardMaterial({
            color: 0xff0000,
          });
          const fallbackCube = new THREE.Mesh(fallbackGeometry, material);
          fallbackCube.position.y = 0.5;
          fallbackCube.castShadow = true;

          rootObject!.add(fallbackCube);
        }
      );
    }

    return rootObject;
  }

  // --- X2: ADD GADGET RENDER FUNCTION ---
  function getGadgetObject(eid: number, snapshot: any): THREE.Object3D {
    let rootObject = gadgetObjects.get(eid);

    if (!rootObject) {
      let material = ammoBoxMaterial; // Default to green
      // (Later, we can add: if (snapshot.isMedkit) material = medkitMaterial;)
      
      rootObject = new THREE.Mesh(fallbackGadgetGeometry, material);
      rootObject.position.set(snapshot.x, snapshot.y, snapshot.z);
      rootObject.castShadow = true;
      rootObject.receiveShadow = true;

      scene.add(rootObject);
      gadgetObjects.set(eid, rootObject);
    }
    
    // Update position
    rootObject.position.set(snapshot.x, snapshot.y, snapshot.z);

    return rootObject;
  }
  // --- END X2 ---

  // === 5. MESSAGE HANDLERS ===
  adapter.onMessage((msg) => {
    try {
      const state = packr.unpack(msg) as StateMsg | JoinMsg;

      if (state.type === "join") {
        localPlayerEid = state.eid;
        localTeamId = state.teamId;
        console.log(`Joined game. This client is player ${localPlayerEid} on team ${localTeamId}`);

        safeAddComponent(clientWorld, Transform, localPlayerEid);
        safeAddComponent(clientWorld, Velocity, localPlayerEid);
        Transform.x[localPlayerEid] = state.x;
        Transform.y[localPlayerEid] = state.y;
        Transform.z[localPlayerEid] = state.z;
        Transform.yaw[localPlayerEid] = state.yaw;
        Transform.pitch[localPlayerEid] = state.pitch;
        playerRotation.y = state.yaw;
        playerRotation.x = state.pitch;

        safeAddComponent(clientWorld, Health, localPlayerEid);
        Health.current[localPlayerEid] = state.hp;
        Health.max[localPlayerEid] = state.hp;

        safeAddComponent(clientWorld, Stamina, localPlayerEid); // <-- 6. ADD STAMINA ON JOIN
        Stamina.current[localPlayerEid] = state.stamina;
        Stamina.max[localPlayerEid] = state.stamina;

        // --- X2: ADD AMMO/GADGET ON JOIN ---
        safeAddComponent(clientWorld, Ammo, localPlayerEid);
        Ammo.current[localPlayerEid] = state.ammoCurrent;
        Ammo.reserve[localPlayerEid] = state.ammoReserve;
        safeAddComponent(clientWorld, Gadget, localPlayerEid);
        Gadget.cooldown[localPlayerEid] = state.gadgetCooldown;
        // --- END X2 ---

        safeAddComponent(clientWorld, Team, localPlayerEid);
        Team.id[localPlayerEid] = state.teamId;
        safeAddComponent(clientWorld, PlayerStats, localPlayerEid);
        PlayerStats.kills[localPlayerEid] = state.kills;
        PlayerStats.deaths[localPlayerEid] = state.deaths;

        getPlayerObject(localPlayerEid, localTeamId!);

        const obj = playerObjects.get(localPlayerEid)!;
        obj.position.set(state.x, state.y, state.z);
        cameraTarget.copy(obj.position).add(cameraOffset);
        camera.position.copy(cameraTarget);

        scoreboardEl!.style.display = "flex";

        if (joinResolve) {
          joinResolve();
          joinResolve = null;
        }

        return;
      }

      if (state.type === "state") {
        const stateTick = state.tick;
        const clientTick = Array.from(sendTimeMap.keys()).pop() || 0;
        const sendTime = sendTimeMap.get(clientTick);

        if (sendTime && rttEl) {
          const rtt = performance.now() - sendTime;
          rttEl.textContent = `RTT: ${rtt.toFixed(1)} ms`;
          sendTimeMap.delete(clientTick);
        }

        if (state.gameState) {
          currentGameState = state.gameState;
        }

        const seenEids = new Set<number>();
        // --- X2: Add separate set for gadgets ---
        const seenGadgetEids = new Set<number>();

        for (const snapshot of state.entities) {
          const { 
            id, x, y, z, hp, yaw, pitch, teamId, kills, deaths, stamina,
            // --- X2: Destructure new state ---
            ammoCurrent, ammoReserve, gadgetCooldown, isAmmoBox
          } = snapshot;
          
          // --- X2: ROUTE TO CORRECT HANDLER ---
          if (isAmmoBox) {
            seenGadgetEids.add(id);
            safeAddComponent(clientWorld, Transform, id);
            safeAddComponent(clientWorld, AmmoBox, id);
            Transform.x[id] = x;
            Transform.y[id] = y;
            Transform.z[id] = z;
            getGadgetObject(id, snapshot);
            continue; // Go to next entity
          }
          // --- END X2 ---

          // If not a gadget, it's a player
          seenEids.add(id);

          const obj = getPlayerObject(id, teamId ?? 0);

          if (Health.current[id] === undefined) {
            safeAddComponent(clientWorld, Transform, id);
            safeAddComponent(clientWorld, Velocity, id);
            safeAddComponent(clientWorld, Health, id);
            Health.max[id] = hp;
            Transform.yaw[id] = yaw;
            Transform.pitch[id] = pitch;
            safeAddComponent(clientWorld, Team, id);
            safeAddComponent(clientWorld, PlayerStats, id);
            safeAddComponent(clientWorld, Stamina, id); // <-- 8. ADD STAMINA FOR NEW ENTITIES
            Stamina.max[id] = stamina ?? 100;
            safeAddComponent(clientWorld, Ammo, id); // <-- ADD THIS
            safeAddComponent(clientWorld, Gadget, id); // <-- ADD THIS
          }

          Stamina.current[id] = stamina ?? Stamina.max[id]; // <-- 9. UPDATE STAMINA
          // --- X2: UPDATE AMMO/GADGET FOR ALL PLAYERS ---
          Ammo.current[id] = ammoCurrent ?? Ammo.current[id];
          Ammo.reserve[id] = ammoReserve ?? Ammo.reserve[id];
          Gadget.cooldown[id] = gadgetCooldown ?? Gadget.cooldown[id];
          // --- END X2 ---

          Team.id[id] = teamId ?? 0;
          PlayerStats.kills[id] = kills ?? 0;
          PlayerStats.deaths[id] = deaths ?? 0;

          if (id === localPlayerEid) {
            const localX = Transform.x[localPlayerEid!];
            const localZ = Transform.z[localPlayerEid!];

            const error = Math.abs(localX - x) + Math.abs(localZ - z);
            if (error > 0.01) {
              Transform.x[localPlayerEid!] = x;
              Transform.z[localPlayerEid!] = z;
            }
            Transform.y[localPlayerEid!] = y;

            Health.current[localPlayerEid!] = hp;

            if (Health.current[localPlayerEid!] <= 0 && respawnScreenEl!.style.display === "none") {
              console.log("Client died, showing respawn screen.");
              showRespawnScreen();
            }
          } else {
            obj.position.set(x, y, z);
            Transform.yaw[id] = yaw;
            Transform.pitch[id] = pitch;
            Health.current[id] = hp;

            const newColor = teamId === 0 ? 0xff6666 : 0x6666ff;
            (obj as THREE.Group).traverse((child) => {
              if ((child as THREE.Mesh).isMesh) {
                const material = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
                if (material.color) {
                  material.color.setHex(newColor);
                }
              }
            });
          }
        }

        // --- X2: Clean up removed players AND gadgets ---
        for (const [eid, obj] of playerObjects.entries()) {
          if (!seenEids.has(eid)) {
            scene.remove(obj);
            playerObjects.delete(eid);
            // TODO: Also remove from ECS
          }
        }
        for (const [eid, obj] of gadgetObjects.entries()) {
          if (!seenGadgetEids.has(eid)) {
            scene.remove(obj);
            gadgetObjects.delete(eid);
            // TODO: Also remove from ECS
          }
        }
      }
    } catch (error) {
      console.error("Client Error Processing Network Message:", error);
      alert("A critical game error occurred. Check the console for details.");
    }
  });

  // wait for connection and join
  try {
    await adapter.awaitConnection();
    console.log("Connection successful! Waiting for JoinMsg...");
    await joinPromise;
    console.log("JoinMsg received and processed. Starting game loop.");
  } catch (err) {
    console.error("Connection failed", err);
    alert("Connection failed. Is the server running?");
    menuEl.style.display = "flex";
    hudEl.style.display = "none";
    canvas.style.display = "none";
    return;
  }

  // === GAME LOOP ===
  initInput(canvas);

  let last = performance.now();
  const FIXED_DT_MS = 1000 / 60;
  let accumulator = 0;

  let frameCount = 0;
  let lastFPSUpdate = performance.now();
  let isProcessingTick = false;

  function loop() {
    if (!adapter) return;

    const now = performance.now();
    const frameTime = Math.min(now - last, 1000);
    last = now;

    accumulator += frameTime;

    updateInput();

    if (respawnScreenEl!.style.display === "none") {
      playerRotation.y -= inputState.deltaX * MOUSE_SENSITIVITY;
      playerRotation.x -= inputState.deltaY * MOUSE_SENSITIVITY;
      playerRotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, playerRotation.x));
    }

    const inputMsg: InputMsg = {
      type: "input",
      tick: tick,
      axes: {
        ...inputState,
        yaw: playerRotation.y,
        pitch: playerRotation.x,
      },
    };
    sendTimeMap.set(tick, performance.now());
    adapter.send(packr.pack(inputMsg));

    if (accumulator >= FIXED_DT_MS && !isProcessingTick) {
      isProcessingTick = true;

      if (localPlayerEid !== null && Health.current[localPlayerEid] > 0) {
        Transform.yaw[localPlayerEid] = playerRotation.y;
        Transform.pitch[localPlayerEid] = playerRotation.x;

        // --- 13. UPDATE CLIENT PREDICTION FOR SPRINT ---
        const yaw = playerRotation.y;
        // Client prediction for stamina is tricky, so we just check the input.
        // The server will correct us if we're out of stamina.
        const isSprinting = inputState.sprint; 
        const currentSpeed = isSprinting ? SPRINT_SPEED : SPEED;
        
        const forward = inputState.forward * currentSpeed; // <-- USE CURRENT SPEED
        const right = inputState.right * currentSpeed;   // <-- USE CURRENT SPEED

        Velocity.x[localPlayerEid] = Math.sin(yaw) * -forward + Math.cos(yaw) * right;
        Velocity.z[localPlayerEid] = Math.cos(yaw) * -forward - Math.sin(yaw) * right;
        Velocity.y[localPlayerEid] = 0;
        // --- END 13 ---
      }

      const worldState = serializeWorldToRust();

      invoke<WorldState>("step_tick", { world: worldState })
        .then((newState) => {
          deserializeWorldFromRust(newState);

          const localObj = localPlayerEid !== null ? playerObjects.get(localPlayerEid) : undefined;
          if (localObj === undefined) {
            renderer.render(scene, camera);
            return;
          }

          for (const [eid, obj] of playerObjects.entries()) {
            const isLocalPlayer = eid === localPlayerEid;
            const isAlive = Health.current[eid] > 0;

            if (Transform.x[eid] !== undefined) {
              if (isAlive) {
                obj.position.x = Transform.x[eid];
                obj.position.y = Transform.y[eid];
                obj.position.z = Transform.z[eid];
              } else {
                obj.position.y = -1000;
              }
            }

            if (isLocalPlayer) {
              obj.rotation.y = playerRotation.y;
              camera.rotation.copy(playerRotation);

              if (isAlive) {
                obj.visible = true;

                cameraOffset.set(0, 1.6, 3.0);
                yawEuler.set(0, playerRotation.y, 0);
                cameraOffset.applyEuler(yawEuler);

                cameraTarget.copy(obj.position).add(cameraOffset);
                camera.position.lerp(cameraTarget, smoothingFactor);
              } else {
                obj.visible = false;
              }
            } else {
              obj.visible = isAlive;
              obj.rotation.y = Transform.yaw[eid];
            }
          }

          // --- X2: UPDATE GADGET OBJECT TRANSFORMS ---
          const boxes = ammoBoxQuery(clientWorld as any);
          for (const eid of boxes) {
            const obj = gadgetObjects.get(eid);
            if (obj && Transform.x[eid] !== undefined) {
              obj.position.x = Transform.x[eid];
              obj.position.y = Transform.y[eid];
              obj.position.z = Transform.z[eid];
            }
          }
          // --- END X2 ---

          renderer.render(scene, camera);

          // --- X2: UPDATE HUD ---
          if (localPlayerEid !== null) {
            if (healthEl) { // <-- 10. UPDATE HUD
              const hp = Health.current[localPlayerEid];
              if (hp !== undefined) {
                healthEl.textContent = `HP: ${hp.toFixed(0)}`;
              }
            }
            if (staminaEl) { // <-- 11. ADD STAMINA TO HUD
              const stam = Stamina.current[localPlayerEid];
              if (stam !== undefined) {
                staminaEl.textContent = `STAM: ${stam.toFixed(0)}`;
              }
            }
            // Update Ammo
            if (ammoEl) {
              const ammo = Ammo.current[localPlayerEid];
              const reserve = Ammo.reserve[localPlayerEid];
              if (ammo !== undefined && reserve !== undefined) {
                // --- BUGFIX 2: Floor the reserve ammo for display ---
                ammoEl.textContent = `AMMO: ${ammo} / ${Math.floor(reserve)}`;
              }
            }
            // Update Gadget Cooldown
            if (gadgetEl) {
              const cooldown = Gadget.cooldown[localPlayerEid];
              if (cooldown !== undefined) {
                if (cooldown > 0) {
                  gadgetEl.textContent = `GADGET: ${cooldown.toFixed(1)}s`;
                } else {
                  gadgetEl.textContent = `GADGET: READY`;
                }
              }
            }
          } else {
            // Fallback if localPlayerEid is null for some reason
            if (ammoEl) {
              ammoEl.textContent = "AMMO: 30 / 120";
            }
          }
          // --- END X2 ---


          if (currentGameState) {
            team1ScoreEl!.textContent = `Team 1: ${currentGameState.team1Tickets}`;
            team2ScoreEl!.textContent = `Team 2: ${currentGameState.team2Tickets}`;

            if (currentGameState.phase === 2 && matchEndEl!.style.display === "none") {
              matchEndEl!.style.display = "block";
              const winner =
                currentGameState.team1Tickets <= 0 ? "Team 2" : "Team 1";
              matchEndEl!.textContent = `${winner} Wins!`;

              hudEl.style.display = "none";
              scoreboardEl!.style.display = "none";
              if (respawnScreenEl!.style.display === "flex") {
                hideRespawnScreen();
              }
              if (document.pointerLockElement) {
                document.exitPointerLock();
              }
            }
          }

          frameCount++;
          if (now - lastFPSUpdate > 250) {
            const fps = frameCount / ((now - lastFPSUpdate) / 1000);
            if (fpsEl) {
              fpsEl.textContent = `FPS: ${fps.toFixed(1)}`;
            }
            frameCount = 0;
            lastFPSUpdate = now;
          }
        })
        .catch(console.error)
        .finally(() => {
          isProcessingTick = false;
        });

      tick++;
      accumulator -= FIXED_DT_MS;
    }

    requestAnimationFrame(loop);
  }

  loop();
}