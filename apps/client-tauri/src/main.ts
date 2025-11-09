// apps/client-tauri/src/main.ts

import * as THREE from "three";
import { initInput, updateInput, inputState } from "./input";

// TAURI invoke
import { invoke } from "@tauri-apps/api/core";

// === 0. GET UI ELEMENTS ===
const canvas = document.getElementById("game") as HTMLCanvasElement | null;
const hudEl = document.getElementById("hud") as HTMLDivElement | null;
const menuEl = document.getElementById("menu") as HTMLDivElement | null;
const fpsEl = document.getElementById("fps-counter") as HTMLDivElement | null;
const healthEl = document.getElementById("health-counter") as HTMLDivElement | null;
const staminaEl = document.getElementById(
  "stamina-counter"
) as HTMLDivElement | null;

// --- Get all other overlays ---
const respawnScreenEl = document.getElementById(
  "respawn-screen"
) as HTMLDivElement | null;
const scoreboardEl = document.getElementById(
  "scoreboard"
) as HTMLDivElement | null;
const matchEndEl = document.getElementById(
  "match-end-message"
) as HTMLDivElement | null;

if (
  !canvas ||
  !hudEl ||
  !menuEl ||
  !fpsEl ||
  !healthEl ||
  !staminaEl ||
  !respawnScreenEl ||
  !scoreboardEl ||
  !matchEndEl
) {
  throw new Error("UI elements not found. Check index.html.");
}

// === 1. DEFINE RUST BRIDGE TYPES ===
interface RustTransform {
  x: number;
  y: number;
  z: number;
}

interface RustHealth {
  current: number;
  max: number;
}

interface RustStamina {
  current: number;
  max: number;
  regen_rate: number;
  drain_rate: number;
}

interface EntitySnapshot {
  eid: number;
  transform: RustTransform;
  health: RustHealth | null;
  stamina: RustStamina | null;
}

type WorldSnapshot = EntitySnapshot[];

interface InputPayload {
  tick: number;
  inputs: {
    forward: number;
    right: number;
    jump: boolean;
    fire: boolean;
    sprint: boolean;
  };
}
// === 2. MAIN ENTRY ===
async function startGame() {
  // --- THIS IS THE FIX ---
  // Make all overlays invisible to mouse clicks,
  // so the click "passes through" to the canvas.
  hudEl.style.pointerEvents = "none";
  respawnScreenEl.style.pointerEvents = "none";
  scoreboardEl.style.pointerEvents = "none";
  matchEndEl.style.pointerEvents = "none";
  // --- END OF FIX ---

  // Show/Hide Logic
  menuEl.style.display = "none";
  hudEl.style.display = "block"; // Show the HUD
  canvas.style.display = "block";
  respawnScreenEl.style.display = "none";
  scoreboardEl.style.display = "none";
  matchEndEl.style.display = "none";

  // === 3. THREE.JS SETUP ===
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
  camera.rotation.order = "YXZ";

  const playerRotation = new THREE.Euler(0, 0, 0, "YXZ");
  const MOUSE_SENSITIVITY = 0.002;

  const light = new THREE.DirectionalLight(0xffffff, 1.0);
  light.position.set(10, 20, 5);
  scene.add(light);
  const ambientLight = new THREE.AmbientLight(0x606060, 1.5);
  scene.add(ambientLight);

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(50, 1, 50),
    new THREE.MeshStandardMaterial({ color: 0x444444 })
  );
  floor.position.y = -0.5;
  scene.add(floor);

  // === 4. CLIENT RENDER STATE ===
  let localPlayerEid: number | null = null;
  const playerObjects = new Map<number, THREE.Object3D>();
  const fallbackGeometry = new THREE.BoxGeometry();
  const fallbackMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });

  function getPlayerObject(eid: number): THREE.Object3D {
    let rootObject = playerObjects.get(eid);
    if (!rootObject) {
      rootObject = new THREE.Mesh(fallbackGeometry, fallbackMaterial);
      scene.add(rootObject);
      playerObjects.set(eid, rootObject);
      console.log(`Created render object for new entity ${eid}`);
    }
    return rootObject;
  }

  // === 5. CALL RUST `init_sim` ===
  try {
    const initSnapshot: EntitySnapshot = await invoke("init_sim");
    localPlayerEid = initSnapshot.eid;

    const obj = getPlayerObject(localPlayerEid);

    obj.position.set(
      initSnapshot.transform.x,
      initSnapshot.transform.y,
      initSnapshot.transform.z
    );

    // Set initial HUD values
    if (initSnapshot.health && healthEl) {
      healthEl.textContent = `HP: ${initSnapshot.health.current.toFixed(0)}`;
    }
    if (initSnapshot.stamina && staminaEl) {
      staminaEl.textContent = `STAM: ${initSnapshot.stamina.current.toFixed(0)}`;
    }

    const cameraOffset = new THREE.Vector3(0, 2, 4);
    camera.position.copy(obj.position).add(cameraOffset);
    camera.lookAt(obj.position);

    console.log(
      `Rust simulation initialized. Local player EID: ${localPlayerEid}`
    );
  } catch (e) {
    console.error("Failed to init simulation:", e);
    alert("Failed to init Rust simulation. Check console.");
    return;
  }

  // === 6. GAME LOOP ===
  // This line is CRITICAL. It finds the canvas and adds
  // the 'onclick' listener that triggers the mouse lock.
  initInput(canvas);

  let last = performance.now();
  const FIXED_DT_MS = 1000 / 60; // 60hz
  let accumulator = 0;
  let tick = 0;

  let frameCount = 0;
  let lastFPSUpdate = performance.now();
  let isProcessingTick = false;

  function loop() {
    requestAnimationFrame(loop);

    const now = performance.now();
    const frameTime = Math.min(now - last, 1000);
    last = now;
    accumulator += frameTime;

// 1. Get Mouse/Key Input
updateInput();
// if (canvas === document.pointerLockElement) { // <-- TEMP: Comment out
  playerRotation.y -= inputState.deltaX * MOUSE_SENSITIVITY;
  playerRotation.x -= inputState.deltaY * MOUSE_SENSITIVITY;
  playerRotation.x = Math.max(
    -Math.PI / 2,
    Math.min(Math.PI / 2, playerRotation.x)
  );
// } // <-- TEMP: Comment out

    // 2. Run Rust simulation at a fixed 60Hz tick
    if (accumulator >= FIXED_DT_MS && !isProcessingTick) {
      isProcessingTick = true;

      const payload: InputPayload = {
        tick,
        inputs: {
          forward: inputState.forward,
          right: inputState.right,
          jump: inputState.jump,   // <-- FIX
          fire: inputState.fire,   // <-- FIX
          sprint: inputState.sprint, // <-- FIX
        },
      };
      

      // 3. Call `step_tick`
      invoke<WorldSnapshot>("step_tick", { payload: payload })
        .then((snapshot) => {
          // 4. Apply the new state from Rust
          for (const entity of snapshot) {
            const { eid, transform, health, stamina } = entity;
            const obj = getPlayerObject(eid);

            obj.position.set(transform.x, transform.y, transform.z);

            // 5. Update camera and HUD for local player
            if (eid === localPlayerEid) {
              camera.rotation.copy(playerRotation);
              const cameraOffset = new THREE.Vector3(0, 2, 4);
              cameraOffset.applyEuler(playerRotation);
              camera.position.copy(obj.position).add(cameraOffset);

              if (health && healthEl) {
                healthEl.textContent = `HP: ${health.current.toFixed(0)}`;
              }
              if (stamina && staminaEl) {
                staminaEl.textContent = `STAM: ${stamina.current.toFixed(0)}`;
              }
            }
          }

          // 6. Render the scene
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
        })
        .catch(console.error)
        .finally(() => {
          isProcessingTick = false;
        });

      tick++;
      accumulator -= FIXED_DT_MS;
    }
  }

  loop();
}

startGame();