// apps/client-tauri/src/main.ts

import { invoke } from "@tauri-apps/api/core";
import { initInput, updateInput, inputState } from "./input";
import { UIManager } from "./UIManager";
import { Renderer } from "./Renderer";
import { NetworkClient, TickSnapshot } from "./NetworkClient";

// === CONFIGURATION ===
// Set this to TRUE if you want to skip the menu and spawn instantly (good for testing physics)
// Set this to FALSE to test the full game flow (Deploy screen -> Game)
const DEBUG_AUTO_DEPLOY = false; 

// === STATE ===
let localPlayerEid: number | null = null;
let isDeployed = false; // Determines if we send inputs and lock cursor
let tick = 0;
let frames = 0;
let lastFPS = performance.now();

// Camera & Movement state
let cameraYaw = 0;
let cameraPitch = 0;
let lastMe = { x: 0, y: 0, z: 0, has: false };
let lastYaw = 0;

// === INITIALIZE SUBSYSTEMS ===
const ui = new UIManager();
const renderer = new Renderer(ui.canvasEl);

// Setup Mouse Look
window.addEventListener("mousemove", (event) => {
  if (document.pointerLockElement !== ui.canvasEl || !isDeployed) return;
  
  cameraYaw   -= event.movementX * 0.002;
  cameraPitch -= event.movementY * 0.002;
  cameraPitch = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, cameraPitch));
});

// Handle Pointer Lock Errors (e.g. user pressed ESC)
document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement !== ui.canvasEl && isDeployed) {
    // If the user pressed ESC to get their cursor back, we pause inputs
    // but we don't necessarily "undeploy" (kill them).
    // For this Lite version, we just let them be "paused".
    console.log("[Input] Pointer lock lost");
  }
});

const net = new NetworkClient(
  // onSnapshot
  (tickData: TickSnapshot, yourId: number | null) => {
    if (!tickData?.entities?.length) return;
  
    if (localPlayerEid === null) {
      localPlayerEid = yourId ?? (tickData.entities[0]?.eid ?? null);
      console.log("[NET] my id =", localPlayerEid);
    }

    renderer.updateEntities(tickData.entities, localPlayerEid);

    // Sync Camera
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
    console.log("[NET] Connected");
    initInput(ui.canvasEl);

    if (DEBUG_AUTO_DEPLOY) {
        handleDeploy();
    } else {
        // Show the initial deploy screen with a 3-second timer
        ui.showRespawnScreen(3, handleDeploy);
    }
  }
);

// === CORE FUNCTIONS ===

function handleDeploy() {
    console.log("[GAME] Deploying...");
    ui.hideRespawnScreen();
    isDeployed = true;
    
    // Lock the cursor
    // Note: requestPointerLock() only works if triggered by a user gesture (click).
    // Since handleDeploy is called by the "Deploy" button click, this works.
    ui.canvasEl.requestPointerLock();
}

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
    updateInput(0);
    ui.setScoreboardVisible(inputState.showScoreboard);
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
  try { await invoke("start_host"); } catch(e) { console.error(e); }

  // Connect Network (triggers onConnect -> showRespawnScreen)
  net.connect("ws://127.0.0.1:8080");

  // Start Render Loop
  gameLoop(0);
}

init();