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
    // In Phase 4, we'll send a "respawn" message to the server here
    console.log("Player clicked DEPLOY");
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
  camera.position.set(0, 1.6, 3);
  // --- V5: CAMERA SMOOTHING ---
  // A reusable vector to store the camera's target position
  const cameraTarget = new THREE.Vector3(); 
  // How fast the camera should "catch up" (lower is smoother)
  const smoothingFactor = 0.1; 
  // --- END V5 ---
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

      // --- G1: Add Health component on join ---
      addComponent(clientWorld, Health, localPlayerEid);
      Health.current[localPlayerEid] = state.hp;
      Health.max[localPlayerEid] = state.hp; // Assume max health
      // --- END G1 ---

      // Create the visual object for the local player
      // This will now be colored correctly as localPlayerEid is set
      getPlayerObject(localPlayerEid);
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
        // --- G1: Get hp from snapshot ---
        const { id, x, y, z, hp } = snapshot;

        // Make sure a visual object exists for this entity
        const obj = getPlayerObject(id);

        // --- G1: Ensure Health component exists for remote players ---
        if (Health.current[id] === undefined) {
          addEntity(clientWorld); // Ensure entity exists in client world
          addComponent(clientWorld, Transform, id);
          addComponent(clientWorld, Velocity, id); // For potential future interpolation
          addComponent(clientWorld, Health, id);
          Health.max[id] = hp; // Assume first packet is max
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

          // --- G1: Always snap health (no prediction) ---
          Health.current[localPlayerEid] = hp;
          // --- END G1 ---

        } else {
          // This is a remote player. Just snap their position.
          // (Later, this will be interpolated for smoothness)
          obj.position.set(x, y, z);
          
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

    // --- V6: TEST KEY (MOVED) ---
    // CHECK FIRST...
    if (keysPressed.has("KeyK") && menuEl.style.display === "none") {
      console.log("Test: Showing respawn screen");
      if (respawnScreenEl.style.display === "none") {
        showRespawnScreen();
      }
    }
    // --- END V6 ---
    
    // ...THEN UPDATE (which clears the set for the next frame)
    updateInput(); 

    const inputMsg: InputMsg = {
      type: "input",
      tick: tick,
      axes: { ...inputState },
    };
    sendTimeMap.set(tick, performance.now());
    adapter.send(packr.pack(inputMsg));

    // === 8. N4: CLIENT-SIDE PREDICTION STEP (runs at fixed 60hz) ===
    // We run our *own* simulation loop locally for instant feedback.
    while (accumulator >= FIXED_DT_MS) {
      if (localPlayerEid !== null) {
        // Apply local input directly to the client's ECS world
        Velocity.x[localPlayerEid] = inputState.right * SPEED;
        Velocity.z[localPlayerEid] = -inputState.forward * SPEED;
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
      if (Transform.x[eid] !== undefined) {
        obj.position.x = Transform.x[eid];
        obj.position.y = Transform.y[eid];
        obj.position.z = Transform.z[eid];
      }

      // Camera follows the local player
      if (eid === localPlayerEid) {
        // --- V5: CAMERA SMOOTHING ---
        // Set where the camera *should* be
        cameraTarget.x = Transform.x[eid];
        cameraTarget.y = 1.6; // Keep the same static height
        cameraTarget.z = Transform.z[eid] + 3; // 3 units behind the player

        // Smoothly move the camera's current position *towards* the target
        camera.position.lerp(cameraTarget, smoothingFactor);
        // --- END V5 ---
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