import * as THREE from "three";
// Import the GLTFLoader
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { initInput, updateInput, inputState, keysPressed } from "./input";
import { Packr } from "msgpackr";
import {
  InputMsg,
  StateMsg,
  JoinMsg, // Import new message
  EntitySnapshot,
  RespawnMsg,
  GameState as GameStateSchema, // <-- G4: Import
} from "@protocol/schema";
import { WebSocketAdapter } from "@net/adapter";
// N4: Import simulation logic for client-side prediction
import {
  world as clientWorld, // Rename to avoid conflict
  step,
  Transform,
  Velocity,
  Health,
  Team, // <-- G4: Import
  PlayerStats, // <-- G4: Import
} from "@sim/logic";
// ++ G5: IMPORT 'invoke' FROM TAURI ++
import { invoke } from "@tauri-apps/api/core"; // <-- FIXED: Changed from /tauri to /core
// ++ G5: IMPORT 'query' FROM BITECS ++
import * as Bitecs from "bitecs"; // <-- FIX: Import as namespace
const { addComponent, addEntity, query } = Bitecs; // <-- FIX: Destructure named exports

// === 0. GET UI ELEMENTS ===
const canvas = document.getElementById("game") as HTMLCanvasElement | null;
const hudEl = document.getElementById("hud") as HTMLDivElement | null;
const menuEl = document.getElementById("menu") as HTMLDivElement | null;
const fpsEl = document.getElementById("fps-counter") as HTMLDivElement | null;
const rttEl = document.getElementById("rtt-counter") as HTMLDivElement | null;
const btnHost = document.getElementById("btn-host") as HTMLButtonElement | null;
const btnJoin = document.getElementById("btn-join") as HTMLButtonElement | null;
const joinIpEl = document.getElementById("join-ip") as HTMLInputElement | null;

// --- V4: HUD EXPANSION ---
const healthEl = document.getElementById("health-counter") as HTMLDivElement | null;
const ammoEl = document.getElementById("ammo-counter") as HTMLDivElement | null;
// --- END V4 ---

// --- V6: RESPAWN UI ---
const respawnScreenEl = document.getElementById("respawn-screen") as HTMLDivElement | null;
const respawnTimerEl = document.getElementById("respawn-timer") as HTMLDivElement | null;
const btnDeploy = document.getElementById("btn-deploy") as HTMLButtonElement | null;
// --- END V6 ---
// ++ G4: GET SCOREBOARD ELEMENTS ++
const scoreboardEl = document.getElementById("scoreboard") as HTMLDivElement | null;
const team1ScoreEl = document.getElementById("team1-score") as HTMLDivElement | null;
const team2ScoreEl = document.getElementById("team2-score") as HTMLDivElement | null;
const matchEndEl = document.getElementById("match-end-message") as HTMLDivElement | null;
// ++ END G4 ++
if (
  !canvas || !hudEl || !menuEl || !btnHost || !btnJoin || !joinIpEl || 
  !healthEl || !ammoEl ||
  !respawnScreenEl || !respawnTimerEl || !btnDeploy ||
  !scoreboardEl || !team1ScoreEl || !team2ScoreEl || !matchEndEl // <-- G4: Add check
) {
  throw new Error("UI elements not found. Check index.html.");
}

// === 1. BUTTON EVENT LISTENERS ===
btnHost.onclick = () => {
  alert(
    "Refactor Complete! Please run 'pnpm dev:host' in your terminal first, then click 'Join'."
  );
};

btnJoin.onclick = () => {
  const url = joinIpEl.value;
  console.log(`Connecting to ${url}...`);
  startGame("join", url);
};

// ++ G5: RUST BRIDGE TYPES ++
// Define the shape of an entity for Rust
interface RustEntity {
  id: number;
  transform: { x: number; y: number; z: number; yaw: number; pitch: number; };
  velocity: { x: number; y: number; z: number; };
  health: { current: number; max: number; };
  team: { id: number; };
  stats: { kills: number; deaths: number; };
}

// Define the world state packet for Rust
interface WorldState {
  entities: RustEntity[];
}
// ++ END G5 ++

// ++ G5: RUST BRIDGE FUNCTIONS ++
const entityQuery = query(clientWorld, Transform); // Query for all entities with a Transform

/**
 * Serializes the entire bitecs world into a 'WorldState' object for Rust.
 */
function serializeWorldToRust(): WorldState {
  const entities = entityQuery(clientWorld);
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

/**
 * Deserializes a 'WorldState' object from Rust and applies it to the bitecs world.
 */
function deserializeWorldFromRust(newState: WorldState) {
  for (const entity of newState.entities) {
    const eid = entity.id;
    
    // TODO: Need a robust way to handle entity creation/deletion
    if (Transform.x[eid] === undefined) {
      // Entity doesn't exist, skip for now.
      // A proper implementation would add it.
      continue; 
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
    
    Team.id[eid] = entity.team.id;
    PlayerStats.kills[eid] = entity.stats.kills;
    PlayerStats.deaths[eid] = entity.stats.deaths;
  }
}
// ++ END G5 ++


/**
 * Main game initialization and loop start
 */
async function startGame(mode: "join", url: string) {
  // --- 1. HIDE MENU, SHOW GAME ---
  menuEl.style.display = "none";
  hudEl.style.display = "none"; // Start with HUD hidden
  canvas.style.display = "block";
  
  // --- G4: Add client-side state ---
  let currentGameState: GameStateSchema | undefined = undefined;
  let localTeamId: number | undefined = undefined;
  // --- END G4 ---

  // --- V6: RESPAWN UI LOGIC ---
  let respawnInterval: number | null = null;

  function hideRespawnScreen() {
    respawnScreenEl!.style.display = "none";
    // --- G4: Only show HUD if game isn't over ---
    if (currentGameState?.phase !== 2) {
      hudEl.style.display = "block";
    }
    // --- END G4 ---
    if (respawnInterval) {
      clearInterval(respawnInterval);
      respawnInterval = null;
    }
  }

  function showRespawnScreen(duration: number = 5) {
    // --- G4: Don't show respawn screen if game is over ---
    if (currentGameState?.phase === 2) return;
    // --- END G4 ---

    respawnScreenEl!.style.display = "flex";
    hudEl.style.display = "none"; // Hide the main HUD

    btnDeploy.disabled = true;
    btnDeploy.textContent = `DEPLOYING IN...`;
    
    let remaining = duration;
    respawnTimerEl!.textContent = remaining.toString();
    
    if (respawnInterval) clearInterval(respawnInterval);
    
    respawnInterval = setInterval(() => {
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
    }, 1000); // Run every 1 second
  }

  // Hook up the deploy button
  btnDeploy.onclick = () => {
    hideRespawnScreen();
    // --- G3: Send Respawn Message ---
    console.log("Player clicked DEPLOY");
    const respawnMsg: RespawnMsg = { type: "respawn" };
    adapter.send(packr.pack(respawnMsg));
    // --- END G3 ---

    canvas.requestPointerLock();
  };

  showRespawnScreen(); // Show the respawn screen on initial join

  // --- END V6 ---

  // === 2. NETWORK & SERIALIZATION SETUP ===
  const adapter = new WebSocketAdapter(url!);
  try {
    await adapter.awaitConnection();
    console.log("Connection successful!");
  } catch (err) {
    console.error("Connection failed", err);
    alert("Connection failed. Is the server running?");
    menuEl.style.display = "flex";
    hudEl.style.display = "none";
    canvas.style.display = "none";
    return;
  }

  const packr = new Packr();
  let tick = 0;
  const sendTimeMap = new Map<number, number>();

  // === 3. THREE.JS (CLIENT) SETUP ===
  const renderer = new THREE.WebGLRenderer({ canvas });
  renderer.setSize(window.innerWidth, window.innerHeight);
  // Enable shadows
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x202028);

  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  // --- C2: Set camera rotation order ---
  camera.rotation.order = "YXZ"; // Use YXZ order for FPS controls

  // --- C2: Add rotation logic ---
  const playerRotation = new THREE.Euler(0, 0, 0, "YXZ");
  const MOUSE_SENSITIVITY = 0.002;
  
  // --- V5 / C2: Camera smoothing logic ---
  const cameraTarget = new THREE.Vector3();
  const smoothingFactor = 0.1;
  const cameraOffset = new THREE.Vector3(0, 1.6, 3.0); // x:0, y:1.6 (up), z:3.0 (behind)
  const yawEuler = new THREE.Euler(0, 0, 0, "YXZ");
  // --- END V5 / C2 ---


  const light = new THREE.DirectionalLight(0xffffff, 1.0); // Keep intensity at 1.0
  light.position.set(10, 20, 5); // Change position for a different shadow angle
  // Enable shadows for the light
  light.castShadow = true;

  // --- V3 LIGHTING POLISH (MVP) ---
  // Tweak shadow map for better (but still fast) shadows
  light.shadow.mapSize.width = 1024; // Default 512
  light.shadow.mapSize.height = 1024; // Default 512
  light.shadow.camera.near = 0.5;
  light.shadow.camera.far = 50;
  // --- END V3 ---

  scene.add(light);

  // Add some ambient light
  const ambientLight = new THREE.AmbientLight(0x606060, 1.5); // (Original was 0x404040, 2)
    scene.add(ambientLight);

  // --- V2: ADD WAREHOUSE MAP GEOMETRY ---
  const mapGroup = new THREE.Group();
  scene.add(mapGroup);

  // Define materials
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

  // Floor
  const floorGeometry = new THREE.BoxGeometry(50, 1, 50);
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.position.y = -0.5; // Place it so its top is at y=0
  floor.receiveShadow = true; // Allow floor to receive shadows
  mapGroup.add(floor);

  // Walls
  const wallHeight = 10;
  const wallThickness = 1;
  const wallLength = 50;

  // Wall North (z=-25)
  const wallNorth = new THREE.Mesh(
    new THREE.BoxGeometry(wallLength, wallHeight, wallThickness),
    wallMaterial
  );
  wallNorth.position.set(0, wallHeight / 2, -wallLength / 2);
  wallNorth.castShadow = true;
  wallNorth.receiveShadow = true;
  mapGroup.add(wallNorth);

  // Wall South (z=25)
  const wallSouth = new THREE.Mesh(
    new THREE.BoxGeometry(wallLength, wallHeight, wallThickness),
    wallMaterial
  );
  wallSouth.position.set(0, wallHeight / 2, wallLength / 2);
  wallSouth.castShadow = true;
  wallSouth.receiveShadow = true;
  mapGroup.add(wallSouth);

  // Wall East (x=25)
  const wallEast = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness, wallHeight, wallLength),
    wallMaterial
  );
  wallEast.position.set(wallLength / 2, wallHeight / 2, 0);
  wallEast.castShadow = true;
  wallEast.receiveShadow = true;
  mapGroup.add(wallEast);

  // Wall West (x=-25)
  const wallWest = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness, wallHeight, wallLength),
    wallMaterial
  );
  wallWest.position.set(-wallLength / 2, wallHeight / 2, 0);
  wallWest.castShadow = true;
  wallWest.receiveShadow = true;
  mapGroup.add(wallWest);

  // --- END V2 ---

  // === 4. N4: CLIENT-SIDE SIMULATION SETUP ===
  const SPEED = 3.0;
  let localPlayerEid: number | null = null;
  // Map THREE.js objects to entity IDs (Object3D is the base for Groups/Meshes)
  const playerObjects = new Map<number, THREE.Object3D>();

  // Add GLTFLoader and a fallback geometry
  const gltfLoader = new GLTFLoader();
  const fallbackGeometry = new THREE.BoxGeometry();

  // Store a history of inputs for reconciliation
  // TODO: Add input history buffer for full reconciliation

  /**
   * Helper to get or create a visual object for an entity
   */
  // --- G4: UPDATE FUNCTION SIGNATURE ---
  function getPlayerObject(eid: number, teamId: number): THREE.Object3D {
    let rootObject = playerObjects.get(eid);

    if (!rootObject) {
      // Create a placeholder Group. The model will be added to this once loaded.
      rootObject = new THREE.Group();
      scene.add(rootObject);
      playerObjects.set(eid, rootObject);
      console.log(`Added placeholder Group for player ${eid} on team ${teamId}`);

      // Asynchronously load the model
      // This path assumes a /public/models/soldier.glb file
      gltfLoader.load(
        "/models/soldier.glb",
        (gltf) => {
          // --- Model loaded successfully ---
          console.log(`Model loaded for ${eid}, adding to scene graph.`);
          const model = gltf.scene;

          // --- G4: SET TEAM COLOR ---
          // 0 = Team 1 (Red), 1 = Team 2 (Blue)
          let color = teamId === 0 ? 0xff6666 : 0x6666ff;
          // Local player is always "friendly" (Green)
          if (eid === localPlayerEid) {
            color = 0x66ff66;
          }
          // --- END G4 ---

          model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.material = new THREE.MeshStandardMaterial({
                color: color, // <-- G4: USE TEAM COLOR
              });
              mesh.castShadow = true; // Make the model cast shadows
            }
          });

          // Scale and position the model relative to the placeholder Group
          // TODO: You will need to adjust these values
          model.scale.set(0.5, 0.5, 0.5);
          model.position.y = -0.5; // Assumes model pivot is at its feet

          // Add the loaded model to our placeholder
          rootObject!.add(model);
        },
        undefined, // onProgress callback (optional)
        (error) => {
          // --- Model failed to load ---
          console.error(`Error loading model for ${eid}, using fallback cube:`, error);

          // Use a red Box as a fallback so the game doesn't break
          const material = new THREE.MeshStandardMaterial({
            color: 0xff0000, // Red = Error
          });
          const fallbackCube = new THREE.Mesh(fallbackGeometry, material);
          fallbackCube.position.y = 0.5; // BoxGeometry pivot is at its center
          fallbackCube.castShadow = true;

          rootObject!.add(fallbackCube); // Add to the placeholder
        }
      );
    }

    return rootObject; // <-- Return the placeholder Group immediately
  }

  // === 5. MESSAGE HANDLERS ===
  adapter.onMessage((msg) => {
    try { // <-- ADDED: Try/Catch for network message processing errors
      const state = packr.unpack(msg) as StateMsg | JoinMsg;

      // --- N4: Handle Join Message ---
      if (state.type === "join") {
        localPlayerEid = state.eid;
        localTeamId = state.teamId; // <-- G4: STORE LOCAL TEAM ID
        console.log(`Joined game. This client is player ${localPlayerEid} on team ${localTeamId}`);

        // Create the local player entity in the client's world
        addEntity(clientWorld);
        addComponent(clientWorld, Transform, localPlayerEid);
        addComponent(clientWorld, Velocity, localPlayerEid);
        Transform.x[localPlayerEid] = state.x;
        Transform.y[localPlayerEid] = state.y;
        Transform.z[localPlayerEid] = state.z;
        // --- C2: Set initial rotation ---
        Transform.yaw[localPlayerEid] = state.yaw;
        Transform.pitch[localPlayerEid] = state.pitch;
        playerRotation.y = state.yaw;
        playerRotation.x = state.pitch;

        // --- G1: Add Health component on join ---
        addComponent(clientWorld, Health, localPlayerEid);
        Health.current[localPlayerEid] = state.hp;
        Health.max[localPlayerEid] = state.hp; // Assume max health
        // --- END G1 ---
        
        // --- G4: ADD TEAM & STATS TO CLIENT SIM ---
        addComponent(clientWorld, Team, localPlayerEid);
        Team.id[localPlayerEid] = state.teamId;
        addComponent(clientWorld, PlayerStats, localPlayerEid);
        PlayerStats.kills[localPlayerEid] = state.kills;
        PlayerStats.deaths[localPlayerEid] = state.deaths;
        // --- END G4 ---

        // Create the visual object for the local player
        // This will now be colored correctly as localPlayerEid is set
        getPlayerObject(localPlayerEid, localTeamId); // <-- G4: PASS TEAM ID
        
        // --- FIX: Set initial camera position ---
        // This ensures the camera doesn't start at (0,0,0) before the first render
        const obj = playerObjects.get(localPlayerEid)!; // We know it exists now
        obj.position.set(state.x, state.y, state.z);
        cameraTarget.copy(obj.position).add(cameraOffset);
        camera.position.copy(cameraTarget);
        // --- END FIX ---

        // --- G4: SHOW SCOREBOARD ---
        scoreboardEl!.style.display = "flex";
        // --- END G4 ---

        return;
      }

      // --- N4: Handle State Message ---
      if (state.type === "state") {
        // --- RTT CALCULATION (N5) ---
        const stateTick = state.tick;
        const clientTick = Array.from(sendTimeMap.keys()).pop() || 0;
        const sendTime = sendTimeMap.get(clientTick);

        if (sendTime && rttEl) {
          const rtt = performance.now() - sendTime;
          rttEl.textContent = `RTT: ${rtt.toFixed(1)} ms`;
          sendTimeMap.delete(clientTick);
        }
        // --- END RTT CALCULATION ---
        
        // --- G4: STORE GAME STATE ---
        if (state.gameState) {
          currentGameState = state.gameState;
        }
        // --- END G4 ---

        const seenEids = new Set<number>(); // G4: To remove disconnected players
        // Process all entity snapshots from the server
        for (const snapshot of state.entities) {
          // --- G4: DESTRUCTURE ALL FIELDS ---
          const { id, x, y, z, hp, yaw, pitch, teamId, kills, deaths } = snapshot;
          seenEids.add(id); // G4

          // Make sure a visual object exists for this entity
          const obj = getPlayerObject(id, teamId ?? 0); // <-- G4: PASS TEAM ID

          // --- G1/G4: Ensure components exist for remote players ---
          // --- C2: Add yaw/pitch to remote entity creation ---
          if (Health.current[id] === undefined) {
            addEntity(clientWorld); // Ensure entity exists in client world
            addComponent(clientWorld, Transform, id);
            addComponent(clientWorld, Velocity, id); // For potential future interpolation
            addComponent(clientWorld, Health, id);
            Health.max[id] = hp; // Assume first packet is max
            Transform.yaw[id] = yaw;
            Transform.pitch[id] = pitch;
            // --- G4: ADD TEAM & STATS FOR REMOTE PLAYERS ---
            addComponent(clientWorld, Team, id);
            addComponent(clientWorld, PlayerStats, id);
            // --- END G4 ---
          }
          // --- END G1/G4 ---
          
          // --- G4: ALWAYS UPDATE TEAM & STATS ---
          Team.id[id] = teamId ?? 0;
          PlayerStats.kills[id] = kills ?? 0;
          PlayerStats.deaths[id] = deaths ?? 0;
          // --- END G4 ---

          // --- N4: Reconciliation ---
          if (id === localPlayerEid) {
            // This is our local player. We need to reconcile.
            const localX = Transform.x[localPlayerEid!];
            const localZ = Transform.z[localPlayerEid!];

            // Simple reconciliation
            const error = Math.abs(localX - x) + Math.abs(localZ - z);
            if (error > 0.01) {
              // console.log(`Reconciling: error was ${error.toFixed(3)}`);
              Transform.x[localPlayerEid!] = x;
              Transform.z[localPlayerEid!] = z;
            }
            
            // --- FIX: Also reconcile Y ---
            Transform.y[localPlayerEid!] = y;
            // --- END FIX ---

            // --- C2: Client is authoritative over its own rotation... ---

            // --- G1: Always snap health (no prediction) ---
            Health.current[localPlayerEid!] = hp;
            // --- END G1 ---
            
            // --- G3: Check for death ---
            if (Health.current[localPlayerEid!] <= 0 && respawnScreenEl!.style.display === "none") {
              console.log("Client died, showing respawn screen.");
              showRespawnScreen();
            }
            // --- END G3 ---

          } else {
            // This is a remote player. Just snap their position and rotation.
            obj.position.set(x, y, z);
            Transform.yaw[id] = yaw;
            Transform.pitch[id] = pitch;
            
            // --- G1: Snap remote player health ---
            Health.current[id] = hp;
            // --- END G1 ---
            
            // --- G4: UPDATE REMOTE PLAYER MODEL COLOR ---
            // 0 = Team 1 (Red), 1 = Team 2 (Blue)
            const newColor = teamId === 0 ? 0xff6666 : 0x6666ff;
            (obj as THREE.Group).traverse((child) => {
              if ((child as THREE.Mesh).isMesh) {
                // Check if material is a standard material and has a color property
                const material = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
                if (material.color) {
                    material.color.setHex(newColor);
                }
              }
            });
            // --- END G4 ---
          }
        }

        // --- G4: Remove disconnected players ---
        for (const [eid, obj] of playerObjects.entries()) {
          if (!seenEids.has(eid)) {
            scene.remove(obj);
            playerObjects.delete(eid);
            // TODO: Properly remove entity from bitecs world
          }
        }
        // --- END G4 ---
      }
    } catch (error) { // <-- ADDED: Catch block
        console.error("Client Error Processing Network Message:", error);
        alert("A critical game error occurred. Check the console for details.");
    }
  });

  // === 6. GAME LOOP ===
  initInput(canvas);

  let last = performance.now();
  const FIXED_DT_MS = 1000 / 60; // 60hz in milliseconds
  let accumulator = 0;

  let frameCount = 0;
  let lastFPSUpdate = performance.now();

  // ++ G5: Flag to prevent re-entrant async ticks
  let isProcessingTick = false;

  function loop() {
    if (!adapter) return; // Stop loop if connection fails

    // ++ G5: ASYNC LOOP REFACTOR ++
    // The new structure ensures that rendering and HUD updates
    // only happen *after* the async Rust tick has completed.
    
    const now = performance.now();
    const frameTime = Math.min(now - last, 1000);
    last = now;

    accumulator += frameTime;

    // === 7. CLIENT: SEND INPUT (runs every frame) ===
    
    // ...THEN UPDATE (which clears the set for the next frame)
    updateInput(); 

    // --- C2: Apply mouse delta to rotation ---
    // We only do this if the respawn screen is not visible
    if (respawnScreenEl!.style.display === "none") {
      playerRotation.y -= inputState.deltaX * MOUSE_SENSITIVITY;
      playerRotation.x -= inputState.deltaY * MOUSE_SENSITIVITY;
      // Clamp vertical rotation (pitch)
      playerRotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, playerRotation.x));
    }
    // --- END C2 ---

    const inputMsg: InputMsg = {
      type: "input",
      tick: tick,
      // --- C2: Send rotation in input message ---
      axes: { 
        ...inputState,
        yaw: playerRotation.y,
        pitch: playerRotation.x,
      },
    };
    sendTimeMap.set(tick, performance.now());
    adapter.send(packr.pack(inputMsg));

    // === 8. G5: RUST-BASED PREDICTION STEP (runs at fixed 60hz, async) ===
    // We only process *one* tick at a time due to the async invoke.
    // The `isProcessingTick` flag prevents multiple ticks from being
    // fired off before the first one finishes.
    if (accumulator >= FIXED_DT_MS && !isProcessingTick) {
      isProcessingTick = true; // Set lock

      // --- G3: Only predict if alive ---
      if (localPlayerEid !== null && Health.current[localPlayerEid] > 0) {
        
        // --- C2: Store predicted rotation locally ---
        Transform.yaw[localPlayerEid] = playerRotation.y;
        Transform.pitch[localPlayerEid] = playerRotation.x;

        // --- C2: Calculate movement based on yaw ---
        const yaw = playerRotation.y;
        const forward = inputState.forward * SPEED;
        const right = inputState.right * SPEED;

        Velocity.x[localPlayerEid] = Math.sin(yaw) * -forward + Math.cos(yaw) * right;
        Velocity.z[localPlayerEid] = Math.cos(yaw) * -forward - Math.sin(yaw) * right;
        Velocity.y[localPlayerEid] = 0; // No gravity yet
      }

      // Run the client-side simulation
      // REMOVED: step();
      
      // ++ G5: RUST BRIDGE CALL ++
      const worldState = serializeWorldToRust();
      
      invoke<WorldState>('step_tick', { world: worldState })
        .then((newState) => {
          // 1. Deserialize the new state from Rust
          deserializeWorldFromRust(newState);
          
          // 2. Run all rendering and HUD logic
          // === 9. CLIENT: RENDER STEP (MOVED INSIDE .then()) ===
          // Update object positions from the *client's* ECS world
          for (const [eid, obj] of playerObjects.entries()) {
            const isLocalPlayer = (eid === localPlayerEid);
            const isAlive = Health.current[eid] > 0;

            // Handle visibility and position for all entities
            if (Transform.x[eid] !== undefined) {
              if (isAlive) {
                obj.position.x = Transform.x[eid];
                obj.position.y = Transform.y[eid];
                obj.position.z = Transform.z[eid];
              } else {
                // Hide dead players by moving them away
                obj.position.y = -1000; 
              }
            }

            if (isLocalPlayer) {
              // --- 3RD PERSON CAMERA LOGIC (FIXED) ---
              
              // 1. Rotate the player model left/right (yaw)
              obj.rotation.y = playerRotation.y;

              // 2. Set the camera's rotation (pitch and yaw)
              camera.rotation.copy(playerRotation);

              if (isAlive) {
                obj.visible = true; // Make sure we can see our own model
        
                // 3. Calculate the camera's target position
                // Start with the base offset (up and behind)
                cameraOffset.set(0, 1.6, 3.0);
        
                // Create an Euler with only the yaw rotation
                yawEuler.set(0, playerRotation.y, 0);
        
                // Apply *only* the yaw rotation to the offset
                cameraOffset.applyEuler(yawEuler);
        
                // Add the player's *object* position (which is smoothed) to the rotated offset
                cameraTarget.copy(obj.position).add(cameraOffset);
                
                // 4. Smoothly move the camera to the target
                camera.position.lerp(cameraTarget, smoothingFactor);
              
              } else {
                // Player is dead, hide the model
                obj.visible = false;
                // The camera position will stop lerping and stay put,
                // which is fine since the respawn screen is up.
              }
              // --- END 3RD PERSON ---

            } else {
              // This is a remote player
              // --- G4: Use isAlive to set visibility ---
              obj.visible = isAlive;
              // --- END G4 ---
              // Apply rotation to remote player models
              obj.rotation.y = Transform.yaw[eid];
            }
          }

          renderer.render(scene, camera);
          
          // === 10. CLIENT: UPDATE HUD (V4) (MOVED INSIDE .then()) ===
          
          // --- G1: Update health from local sim state ---
          if (localPlayerEid !== null && healthEl) {
            const hp = Health.current[localPlayerEid];
            if (hp !== undefined) {
              healthEl.textContent = `HP: ${hp.toFixed(0)}`;
            }
          }
          // --- END G1 ---

          // Placeholder ammo
          if (ammoEl) {
            ammoEl.textContent = `AMMO: 30 / 120`;
          }
          
          // --- G4: UPDATE SCOREBOARD HUD ---
          if (currentGameState) {
            team1ScoreEl!.textContent = `Team 1: ${currentGameState.team1Tickets}`;
            team2ScoreEl!.textContent = `Team 2: ${currentGameState.team2Tickets}`;
            
            // Check for match end
            if (currentGameState.phase === 2 && matchEndEl!.style.display === "none") {
              matchEndEl!.style.display = "block";
              const winner = currentGameState.team1Tickets <= 0 ? "Team 2" : "Team 1";
              matchEndEl!.textContent = `${winner} Wins!`;
              
              // Hide game HUDs, show end message
              hudEl.style.display = "none";
              scoreboardEl!.style.display = "none";
              if (respawnScreenEl!.style.display === "flex") {
                hideRespawnScreen(); // Hide respawn screen if it's up
              }
              if (document.pointerLockElement) {
                  document.exitPointerLock(); // Unlock mouse
              }
            }
          }
          // --- END G4 ---
          
          // Update FPS counter
          frameCount++;
          // Note: 'now' is captured from the start of the outer 'loop' function
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
          isProcessingTick = false; // Release lock
        });
      // ++ END G5 ++

      tick++;
      accumulator -= FIXED_DT_MS;
    }
    // ++ END G5 REFACTOR ++

    // === 9. CLIENT: RENDER STEP (MOVED) ===
    // (This logic is now inside the .then() block)

    // === 10. CLIENT: UPDATE HUD (V4) (MOVED) ===
    // (This logic is now inside the .then() block)

    requestAnimationFrame(loop);
  }

  // Start the loop!
  loop();
}