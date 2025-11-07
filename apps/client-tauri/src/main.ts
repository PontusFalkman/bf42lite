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
  RespawnMsg, // --- G3: Import RespawnMsg ---
} from "@protocol/schema";
import { WebSocketAdapter } from "@net/adapter";
// N4: Import simulation logic for client-side prediction
import {
  world as clientWorld, // Rename to avoid conflict
  step,
  Transform,
  Velocity,
  Health, // --- G1: Import Health ---
} from "@sim/logic";
import { addComponent, addEntity } from "bitecs";

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

if (
  !canvas || !hudEl || !menuEl || !btnHost || !btnJoin || !joinIpEl || 
  !healthEl || !ammoEl ||
  !respawnScreenEl || !respawnTimerEl || !btnDeploy // <-- Add V6 elements
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

/**
 * Main game initialization and loop start
 */
async function startGame(mode: "join", url: string) {
  // --- 1. HIDE MENU, SHOW GAME ---
  menuEl.style.display = "none";
  hudEl.style.display = "none"; // Start with HUD hidden
  canvas.style.display = "block";

  // --- V6: RESPAWN UI LOGIC ---
  let respawnInterval: number | null = null;

  function hideRespawnScreen() {
    respawnScreenEl!.style.display = "none";
    hudEl.style.display = "block"; // Show the main HUD
    if (respawnInterval) {
      clearInterval(respawnInterval);
      respawnInterval = null;
    }
  }

  function showRespawnScreen(duration: number = 5) {
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
  function getPlayerObject(eid: number): THREE.Object3D {
    let rootObject = playerObjects.get(eid);

    if (!rootObject) {
      // Create a placeholder Group. The model will be added to this once loaded.
      rootObject = new THREE.Group();
      scene.add(rootObject);
      playerObjects.set(eid, rootObject);
      console.log(`Added placeholder Group for player ${eid}`);

      // Asynchronously load the model
      // This path assumes a /public/models/soldier.glb file
      gltfLoader.load(
        "/models/soldier.glb",
        (gltf) => {
          // --- Model loaded successfully ---
          console.log(`Model loaded for ${eid}, adding to scene graph.`);
          const model = gltf.scene;

          // Set color based on local player or remote
          const color = eid === localPlayerEid ? 0x4488ff : 0xff8844;
          model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.material = new THREE.MeshStandardMaterial({
                color: color,
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
    const state = packr.unpack(msg) as StateMsg | JoinMsg;

    // --- N4: Handle Join Message ---
    if (state.type === "join") {
      localPlayerEid = state.eid;
      console.log(`Joined game. This client is player ${localPlayerEid}`);

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

      // Create the visual object for the local player
      // This will now be colored correctly as localPlayerEid is set
      getPlayerObject(localPlayerEid);
      
      // --- FIX: Set initial camera position ---
      // This ensures the camera doesn't start at (0,0,0) before the first render
      const obj = getPlayerObject(localPlayerEid);
      obj.position.set(state.x, state.y, state.z);
      cameraTarget.copy(obj.position).add(cameraOffset);
      camera.position.copy(cameraTarget);
      // --- END FIX ---

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

      // Process all entity snapshots from the server
      for (const snapshot of state.entities) {
        // --- C2: Get rotation from snapshot ---
        const { id, x, y, z, hp, yaw, pitch } = snapshot;

        // Make sure a visual object exists for this entity
        const obj = getPlayerObject(id);

        // --- G1: Ensure Health component exists for remote players ---
        // --- C2: Add yaw/pitch to remote entity creation ---
        if (Health.current[id] === undefined) {
          addEntity(clientWorld); // Ensure entity exists in client world
          addComponent(clientWorld, Transform, id);
          addComponent(clientWorld, Velocity, id); // For potential future interpolation
          addComponent(clientWorld, Health, id);
          Health.max[id] = hp; // Assume first packet is max
          Transform.yaw[id] = yaw;
          Transform.pitch[id] = pitch;
        }
        // --- END G1 ---

        // --- N4: Reconciliation ---
        if (id === localPlayerEid) {
          // This is our local player. We need to reconcile.
          const localX = Transform.x[localPlayerEid];
          const localZ = Transform.z[localPlayerEid];

          // Simple reconciliation: If the server's state is too different
          // from our predicted state, snap our local state to the server's.
          const error = Math.abs(localX - x) + Math.abs(localZ - z);
          if (error > 0.01) {
            // console.log(`Reconciling: error was ${error.toFixed(3)}`);
            Transform.x[localPlayerEid] = x;
            Transform.z[localPlayerEid] = z;
            // A more advanced implementation would rewind and replay inputs
            // from the snapshot's tick to the present.
          }
          
          // --- FIX: Also reconcile Y ---
          Transform.y[localPlayerEid] = y;
          // --- END FIX ---


          // --- C2: Client is authoritative over its own rotation, so we *don't*
          // snap yaw or pitch from the server. ---

          // --- G1: Always snap health (no prediction) ---
          Health.current[localPlayerEid] = hp;
          // --- END G1 ---
          
          // --- G3: Check for death ---
          if (Health.current[localPlayerEid] <= 0 && respawnScreenEl!.style.display === "none") {
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
        }
      }
    }
  });

  // === 6. GAME LOOP ===
  initInput(canvas);

  let last = performance.now();
  const FIXED_DT_MS = 1000 / 60; // 60hz in milliseconds
  let accumulator = 0;

  let frameCount = 0;
  let lastFPSUpdate = performance.now();

  function loop() {
    if (!adapter) return; // Stop loop if connection fails

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

    // === 8. N4: CLIENT-SIDE PREDICTION STEP (runs at fixed 60hz) ===
    // We run our *own* simulation loop locally for instant feedback.
    while (accumulator >= FIXED_DT_MS) {
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

        // Run the client-side simulation
        step();
      }

      tick++;
      accumulator -= FIXED_DT_MS;
    }

    // === 9. CLIENT: RENDER STEP (runs every frame) ===
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
        obj.visible = true;
        // Apply rotation to remote player models
        obj.rotation.y = Transform.yaw[eid];
      }
    }

    renderer.render(scene, camera);
    // === 10. CLIENT: UPDATE HUD (V4) ===
    
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
    
    // Update FPS counter
    frameCount++;
    if (now - lastFPSUpdate > 250) {
      const fps = frameCount / ((now - lastFPSUpdate) / 1000);
      if (fpsEl) {
        fpsEl.textContent = `FPS: ${fps.toFixed(1)}`;
      }
      frameCount = 0;
      lastFPSUpdate = now;
    }

    requestAnimationFrame(loop);
  }

  // Start the loop!
  loop();
}