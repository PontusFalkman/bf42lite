import * as THREE from "three";
import { initInput, updateInput, inputState } from "./input";
import { Packr } from "msgpackr";
import { InputMsg, StateMsg } from "@protocol/schema";
import { WebSocketAdapter } from "@net/adapter"; // <-- CORRECTED LINE

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
  // We no longer support "Host" from the client.
  // The LoopbackAdapter is now removed from the start logic.
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

  // Map to store the time we sent a message for a given tick
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

  // We will create cubes for players as they appear
  const playerCubes = new Map<number, THREE.Mesh>();

  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(5, 10, 7);
  scene.add(light);

  // === 4. MESSAGE HANDLERS ===

  /**
   * CLIENT: Receives state from the host
   */
  adapter.onMessage((msg) => {
    const stateMsg = packr.unpack(msg) as StateMsg;
    if (stateMsg.type === "state") {
      // --- RTT CALCULATION (N5) ---
      // We use the server's tick. Our client "tick" is just for sending.
      const stateTick = stateMsg.tick;
      // Find the *closest* tick we sent
      const clientTick = Array.from(sendTimeMap.keys()).pop() || 0;
      const sendTime = sendTimeMap.get(clientTick);

      if (sendTime && rttEl) {
        const rtt = performance.now() - sendTime;
        rttEl.textContent = `RTT: ${rtt.toFixed(1)} ms`;
        
        // Clean up old entries
        sendTimeMap.delete(clientTick);
      }
      // --- END RTT CALCULATION ---

      // Update/create cubes based on snapshot
      for (const snapshot of stateMsg.entities) {
        let cube = playerCubes.get(snapshot.id);

        if (!cube) {
          // Create a new cube for this player
          const geometry = new THREE.BoxGeometry();
          const material = new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff });
          cube = new THREE.Mesh(geometry, material);
          scene.add(cube);
          playerCubes.set(snapshot.id, cube);
          console.log(`Added cube for player ${snapshot.id}`);
        }

        // Apply state (interpolation will be needed later)
        cube.position.x = snapshot.x;
        cube.position.y = snapshot.y;
        cube.position.z = snapshot.z;
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
    
    // Store the send time just before sending
    sendTimeMap.set(tick, performance.now());
    (adapter as WebSocketAdapter).send(packr.pack(inputMsg));

    // === 8. HOST: SIMULATION STEP (runs at fixed 60hz) ===
    // The server is now responsible for this!
    // We just increment our local tick for input messages.
    while (accumulator >= FIXED_DT_MS) {
      tick++;
      accumulator -= FIXED_DT_MS;
    }

    // === 9. CLIENT: RENDER STEP (runs every frame) ===
    // The cube's position is now updated in adapter.onClientMessage
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