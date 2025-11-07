import * as THREE from "three";
import { initInput, updateInput, inputState } from "./input";
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

if (!canvas || !hudEl || !menuEl || !btnHost || !btnJoin || !joinIpEl) {
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


/**
 * Main game initialization and loop start
 */
async function startGame(mode: "join", url: string) {
  // --- 1. HIDE MENU, SHOW GAME ---
  menuEl.style.display = "none";
  hudEl.style.display = "block";
  canvas.style.display = "block";

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

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x202028);

  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 1.6, 3);

  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(5, 10, 7);
  scene.add(light);

  // === 4. N4: CLIENT-SIDE SIMULATION SETUP ===
  const SPEED = 3.0;
  let localPlayerEid: number | null = null;
  // Map THREE.js cubes to entity IDs
  const playerCubes = new Map<number, THREE.Mesh>();
  // Store a history of inputs for reconciliation
  // TODO: Add input history buffer for full reconciliation

  /**
   * Helper to get or create a cube for an entity
   */
  function getPlayerCube(eid: number): THREE.Mesh {
    let cube = playerCubes.get(eid);
    if (!cube) {
      const geometry = new THREE.BoxGeometry();
      const material = new THREE.MeshStandardMaterial({
        color: eid === localPlayerEid ? 0x4488ff : 0xff8844, // Different color for local player
      });
      cube = new THREE.Mesh(geometry, material);
      scene.add(cube);
      playerCubes.set(eid, cube);
      console.log(`Added cube for player ${eid}`);
    }
    return cube;
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
      
      // Create the visual cube for the local player
      getPlayerCube(localPlayerEid);
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
        const { id, x, y, z } = snapshot;

        // Make sure a cube exists for this entity
        const cube = getPlayerCube(id);

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

        } else {
          // This is a remote player. Just snap their position.
          // (Later, this will be interpolated for smoothness)
          cube.position.set(x, y, z);
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
    // Update cube positions from the *client's* ECS world
    for (const [eid, cube] of playerCubes.entries()) {
      if (Transform.x[eid] !== undefined) {
        cube.position.x = Transform.x[eid];
        cube.position.y = Transform.y[eid];
        cube.position.z = Transform.z[eid];
      }

      // Camera follows the local player
      if (eid === localPlayerEid) {
        camera.position.x = Transform.x[eid];
        camera.position.z = Transform.z[eid] + 3;
      }
    }

    renderer.render(scene, camera);

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