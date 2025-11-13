// apps/client-tauri/src/main.ts

import { invoke } from "@tauri-apps/api/core";
import { initInput, updateInput, inputState } from "./input";
import { UIManager } from "./UIManager";
import { Renderer } from "./Renderer";
import { NetworkClient, TickSnapshot } from "./NetworkClient";

// === STATE ===
let localPlayerEid: number | null = null;
let isDeployed = false;
let tick = 0;
let frames = 0;
let lastFPS = performance.now();

// Camera & Movement state
let cameraYaw = 0;
let cameraPitch = 0; // Note: Pitch is currently visual-only in this client refactor
let lastMe = { x: 0, y: 0, z: 0, has: false };
let lastYaw = 0;

// === INITIALIZE SUBSYSTEMS ===
const ui = new UIManager();
const renderer = new Renderer(ui.canvasEl);

// Setup Mouse Look
window.addEventListener("mousemove", (event) => {
  if (document.pointerLockElement !== ui.canvasEl || !isDeployed) return;
  // We update the camera yaw locally for smooth feel, 
  // though the server authorizes position.
  cameraYaw   -= event.movementX * 0.002;
  cameraPitch -= event.movementY * 0.002;
  cameraPitch = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, cameraPitch));
});

const net = new NetworkClient(
  // onSnapshot
  (tickData: TickSnapshot, yourId: number | null) => {
    if (!tickData?.entities?.length) return;
  
    // Lock my id
    if (localPlayerEid === null) {
      localPlayerEid = yourId ?? (tickData.entities[0]?.eid ?? null);
      console.log("[NET] my id =", localPlayerEid);
    }

    // Update Renderer
    renderer.updateEntities(tickData.entities, localPlayerEid);

    // Capture my own state for camera logic
    let meFound = false;
    for (const e of tickData.entities) {
      if (e.eid === localPlayerEid) {
        meFound = true;
        lastMe.x = e.transform.x ?? 0; 
        lastMe.y = e.transform.y ?? 0; 
        lastMe.z = e.transform.z ?? 0; 
        lastMe.has = true;
        if (typeof e.transform.yaw === "number") lastYaw = e.transform.yaw;
      }
    }
    
    if (!meFound) {
      // Fallback if I'm not in the list (dead?)
      const e = tickData.entities[0];
      lastMe.x = e.transform.x ?? 0; 
      lastMe.y = e.transform.y ?? 0; 
      lastMe.z = e.transform.z ?? 0; 
      lastMe.has = true;
      if (typeof e.transform.yaw === "number") lastYaw = e.transform.yaw;
    }
  },
  // onConnect
  () => {
    initInput(ui.canvasEl);
  }
);

// === GAME LOOP ===
async function gameLoop(now: number) {
  requestAnimationFrame(gameLoop);

  // 1. Update Camera
  if (lastMe.has) {
    renderer.updateCamera(lastMe.x, lastMe.y, lastMe.z, lastYaw);
  }

  // 2. Calculate FPS
  frames++;
  const nowMs = performance.now();
  if (nowMs - lastFPS > 250) {
    const fps = (frames * 1000) / (nowMs - lastFPS);
    ui.updateFPS(fps);
    frames = 0;
    lastFPS = nowMs;
  }

  // 3. Send Inputs
  if (isDeployed) {
    updateInput();
    // inputs: [fwd, right, jump, fire, sprint, scoreboard]
    const inputs = [
      inputState.forward||0, 
      inputState.right||0, 
      !!inputState.jump, 
      !!inputState.fire, 
      !!inputState.sprint, 
      !!inputState.showScoreboard
    ];
    
    net.sendInput(tick++, inputs, inputState.deltaX, inputState.deltaY);
  }

  // 4. Render
  renderer.render();
}

// === BOOT ===
async function init() {
  console.log("[BOOT] init");
  // Start Host (Tauri specific)
  try { await invoke("start_host"); } catch(e) { console.error(e); }

  // Connect Network
  net.connect("ws://127.0.0.1:8080");

  // Auto-deploy logic (for now)
  ui.hideRespawnScreen();
  isDeployed = true;
  
  // Start Loop
  gameLoop(0);
}
init();