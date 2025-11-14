// apps/client-tauri/src/main.ts

import { invoke } from "@tauri-apps/api/core";
import { initInput, updateInput, inputState } from "./input";
import { UIManager } from "./UIManager";
import { Renderer } from "./Renderer";
import { NetworkClient, TickSnapshot } from "./NetworkClient";

// === CONFIGURATION ===
const DEBUG_AUTO_DEPLOY = false; 
const MOVEMENT_SPEED = 10.0; // Matches Rust server speed
const SPRINT_MULTIPLIER = 1.5;

// === STATE ===
let localPlayerEid: number | null = null;
let isDeployed = false; 
let tick = 0;
let frames = 0;
let lastFPS = performance.now();
let lastFrameTime = performance.now(); // Track delta time for smooth movement

// Camera & Movement state
let cameraYaw = 0;
let cameraPitch = 0;
// We initialize "has" to true so we can move before the server spawns us if we want
let lastMe = { x: 0, y: 0, z: 0, has: true };

let verticalVelocity = 0;
const GRAVITY = -25.0; // Downward force
const JUMP_FORCE = 10.0; // Upward force

// === INITIALIZE SUBSYSTEMS ===
const ui = new UIManager();
const renderer = new Renderer(ui.canvasEl);

// Mouse Look
window.addEventListener("mousemove", (event) => {
  if (document.pointerLockElement !== ui.canvasEl || !isDeployed) return;
  
  const sens = 0.002;
  cameraYaw   -= event.movementX * sens;
  cameraPitch += event.movementY * sens;
  cameraPitch = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, cameraPitch));
});

const net = new NetworkClient(
  (tickData: TickSnapshot, yourId: number | null) => {
    if (!tickData?.entities?.length) return;
  
    if (localPlayerEid === null) {
      localPlayerEid = yourId ?? (tickData.entities[0]?.eid ?? null);
      console.log("[NET] my id =", localPlayerEid);
    }

    renderer.updateEntities(tickData.entities, localPlayerEid);

  },
  () => {
    console.log("[NET] Connected");
    initInput(ui.canvasEl);
    if (DEBUG_AUTO_DEPLOY) {
        handleDeploy();
    } else {
        ui.showRespawnScreen(3, handleDeploy);
    }
  }
);

// === CORE FUNCTIONS ===

function handleDeploy() {
    console.log("[GAME] Deploying...");
    ui.hideRespawnScreen();
    isDeployed = true;
    ui.canvasEl.requestPointerLock();
}

async function gameLoop(now: number) {
  requestAnimationFrame(gameLoop);

  // Calculate Delta Time (dt) in seconds
  const nowMs = performance.now();
  const dt = (nowMs - lastFrameTime) / 1000;
  lastFrameTime = nowMs;

  if (isDeployed) {
    updateInput(dt);

    // --- 1. HORIZONTAL MOVEMENT (WASD) ---
    const fwd = inputState.forward;
    const right = inputState.right;
    const isSprinting = inputState.sprint;

    if (fwd !== 0 || right !== 0) {
        const speed = isSprinting ? MOVEMENT_SPEED * SPRINT_MULTIPLIER : MOVEMENT_SPEED;
        
        // Corrected Math (Standard Forward/Right)
        const vecFwdX = Math.sin(cameraYaw);
        const vecFwdZ = Math.cos(cameraYaw);
        const vecRightX = Math.cos(cameraYaw);
        const vecRightZ = -Math.sin(cameraYaw);

        const moveX = (vecFwdX * fwd) + (vecRightX * right);
        const moveZ = (vecFwdZ * fwd) + (vecRightZ * right);

        const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
        if (len > 0) {
            lastMe.x += (moveX / len) * speed * dt;
            lastMe.z += (moveZ / len) * speed * dt;
        }
    }

    // --- 2. VERTICAL MOVEMENT (JUMP & GRAVITY) ---
    
    // Apply Gravity
    verticalVelocity += GRAVITY * dt;

    // Check Jump Input (Only if we are on the ground)
    if (inputState.jump && lastMe.y <= 0) {
        verticalVelocity = JUMP_FORCE;
    }

    // Apply Velocity to Position
    lastMe.y += verticalVelocity * dt;

    // Floor Collision (Ground is at y = 0)
    if (lastMe.y <= 0) {
        lastMe.y = 0;
        verticalVelocity = 0; // Stop falling
    }

    // --- 3. NETWORK SYNC ---
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

  // Render using local variables
  renderer.updateCamera(lastMe.x, lastMe.y, lastMe.z, cameraYaw, cameraPitch);

  // FPS & UI Updates
  frames++;
  if (nowMs - lastFPS > 250) {
    const fps = (frames * 1000) / (nowMs - lastFPS);
    ui.updateFPS(fps);
    frames = 0;
    lastFPS = nowMs;
  }

  ui.setScoreboardVisible(inputState.showScoreboard);
  renderer.render();
}

// === BOOT ===
async function init() {
  console.log("[BOOT] init");
  try { await invoke("start_host"); } catch(e) { console.error(e); }

  net.connect("ws://127.0.0.1:8080");
  gameLoop(0);
}

init();