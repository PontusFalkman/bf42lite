// apps/client-tauri/src/main.ts

import * as THREE from "three";
import { initInput, updateInput, inputState } from "./input";
import { invoke } from "@tauri-apps/api/core";
import { Packr } from "msgpackr";

const msgpackr = new Packr();
let socket: WebSocket | null = null;

// === 0. GET UI ELEMENTS ===
const canvas = document.getElementById("game") as HTMLCanvasElement | null;
const hudEl = document.getElementById("hud") as HTMLDivElement | null;
const menuEl = document.getElementById("menu") as HTMLDivElement | null;
const fpsEl = document.getElementById("fps-counter") as HTMLDivElement | null;
const healthEl = document.getElementById("health-counter") as HTMLDivElement | null;
const staminaEl = document.getElementById(
  "stamina-counter"
) as HTMLDivElement | null;

const respawnScreenEl = document.getElementById(
  "respawn-screen"
) as HTMLDivElement | null;
const respawnTimerEl = document.getElementById(
  "respawn-timer"
) as HTMLSpanElement | null;
const btnDeploy = document.getElementById(
  "btn-deploy"
) as HTMLButtonElement | null;

const scoreboardEl = document.getElementById(
  "scoreboard"
) as HTMLDivElement | null;
const matchEndEl = document.getElementById(
  "match-end-message"
) as HTMLDivElement | null;

const teamATicketsEl = document.getElementById(
  "team-a-tickets"
) as HTMLSpanElement | null;
const teamBTicketsEl = document.getElementById(
  "team-b-tickets"
) as HTMLSpanElement | null;
const matchWinnerEl = document.getElementById(
  "match-winner"
) as HTMLSpanElement | null;

// Basic null-check
if (
  !canvas ||
  !hudEl ||
  !menuEl ||
  !fpsEl ||
  !healthEl ||
  !staminaEl ||
  !respawnScreenEl ||
  !respawnTimerEl ||
  !btnDeploy ||
  !scoreboardEl ||
  !matchEndEl ||
  !teamATicketsEl ||
  !teamBTicketsEl ||
  !matchWinnerEl
) {
  throw new Error("Failed to find one or more essential UI elements!");
}

// === 1. THREE.JS SETUP ===
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
// --- FIX: Give camera a default starting position ---
camera.position.set(0, 2, 5);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 7.5);
scene.add(dirLight);
const groundGeo = new THREE.PlaneGeometry(100, 100);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// DEBUG: red cube at origin so we always have something to see
const debugCubeGeo = new THREE.BoxGeometry(1, 1, 1);
const debugCubeMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const debugCube = new THREE.Mesh(debugCubeGeo, debugCubeMat);
debugCube.position.set(0, 0.5, 0);
scene.add(debugCube);


const playerObjects = new Map<number, THREE.Mesh>();
const playerGeo = new THREE.BoxGeometry(1, 1.8, 1);
const playerMat = new THREE.MeshStandardMaterial({ color: 0x00ff00 });

// === 2. RUST INTERFACES (UPDATED) ===
interface PlayerInputs {
  forward: number;
  right: number;
  jump: boolean;
  fire: boolean;
  sprint: boolean;
  showScoreboard: boolean;
}
enum TeamId {
  None = "None",
  TeamA = "TeamA",
  TeamB = "TeamB",
}
interface Team {
  id: TeamId;
}
interface Score {
  kills: number;
  deaths: number;
}
interface Transform {
  x: number;
  y: number;
  z: number;
}
interface Health {
  current: number;
  max: number;
}
interface Stamina {
  current: number;
  max: number;
}
interface EntitySnapshot {
  eid: number;
  transform: Transform;
  health: Health | null;
  stamina: Stamina | null;
  team: Team | null;
  score: Score | null;
}
interface GameModeState {
  team_a_tickets: number;
  team_b_tickets: number;
  match_ended: boolean;
  winner: TeamId;
}
interface TickSnapshot {
  entities: EntitySnapshot[];
  game_state: GameModeState;
}

// === 3. GAME STATE & HELPERS ===
let localPlayerEid: number | null = null;
let playerRotation = new THREE.Euler(0, 0, 0, "YXZ");
let tick = 0;
let isDeployed = false;
let respawnInterval: number | null = null;

function getPlayerObject(eid: number): THREE.Mesh {
  let obj = playerObjects.get(eid);
  if (!obj) {
    obj = new THREE.Mesh(playerGeo, playerMat.clone());
    scene.add(obj);
    playerObjects.set(eid, obj);
  }
  return obj;
}

function hideRespawnScreen() {
  respawnScreenEl!.classList.add("hidden");
  if (matchEndEl?.classList.contains("hidden")) {
    hudEl?.classList.remove("hidden");
  }
  if (respawnInterval) {
    clearInterval(respawnInterval);
    respawnInterval = null;
  }
}

function showRespawnScreen(duration: number = 5) {
  respawnScreenEl!.classList.remove("hidden");
  hudEl?.classList.add("hidden");

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

// === 4. CLIENT LOGIC ===
function setupClientLogic() {
  console.log("Client: Connecting to ws://127.0.0.1:8080...");
  socket = new WebSocket("ws://127.0.0.1:8080");
  socket.binaryType = "arraybuffer";

  // 1. On Connection Open
  socket.onopen = () => {
    console.log("Client: WebSocket connection established!");
    menuEl?.classList.add("hidden");
    showRespawnScreen();
    initInput(canvas);
    gameLoop(0); // Start the game loop
  };

  // 2. On Message Received
  socket.onmessage = (event) => {
    try {
      const tickData: TickSnapshot = msgpackr.decode(
        new Uint8Array(event.data)
      );

      // Robust EID finding
      if (localPlayerEid === null) {
        if (tickData.entities.length > 0) {
          localPlayerEid = tickData.entities.reduce(
            (max, e) => Math.max(max, e.eid),
            -1 // Use -1 as initial to handle EID 0
          );
          console.log(`Client: Local player EID set to: ${localPlayerEid}`);
        }
      }

      updateUI(tickData.game_state);

      for (const entity of tickData.entities) {
        const { eid, transform, health, stamina } = entity;
        const obj = getPlayerObject(eid);

        // --- THIS IS THE KEY ---
        // The server's transform is ALWAYS applied to the mesh
        obj.position.set(transform.x, transform.y, transform.z);

        if (eid === localPlayerEid) {
          obj.visible = false; // Hide local player

          // Update HUD from server state.
          if (health && healthEl) {
            healthEl.textContent = `HP: ${health.current.toFixed(0)}`;
          }
          if (stamina && staminaEl) {
            staminaEl.textContent = `STAM: ${stamina.current.toFixed(0)}`;
          }
        } else {
          // Everyone else is visible
          obj.visible = true;
        }
      }
    } catch (e) {
      console.error("Client error processing host message:", e);
    }
  };

  // 3. On Connection Close
  socket.onclose = () => {
    console.error("Client: WebSocket connection lost!");
    hudEl?.classList.add("hidden");
    menuEl?.classList.remove("hidden");
    menuEl!.textContent = "CONNECTION LOST";
  };

  // 4. On Error
  socket.onerror = (err) => {
    console.error("Client: WebSocket error:", err);
  };
}

// === 5. CORE GAME STARTUP ===
async function init() {
  console.log("Initializing client...");
  console.log("Telling Rust backend to start host...");

  btnDeploy.onclick = () => {
    hideRespawnScreen();
    isDeployed = true;
    console.log("Player clicked DEPLOY");
    canvas.requestPointerLock();
  };

  try {
    // This calls the "start_host" command in src-tauri/src/main.rs
    await invoke("start_host");
    console.log("Client: Host server started by Rust.");
    // Give the server a moment to bind before connecting
    setTimeout(setupClientLogic, 100);
  } catch (e) {
    console.error("Failed to start host:", e);
    alert("FATAL: Failed to start host. See console.");
  }
}

// === 6. CORE GAME LOOP (Client) ===
let lastTime = 0;
let frameCount = 0;
let lastFPSUpdate = 0;

async function gameLoop(now: number) {
  requestAnimationFrame(gameLoop); // Loop every frame

  const dt = (now - lastTime) / 1000.0; // Delta time in *seconds*
  lastTime = now;

  // Update input state (keyboard/mouse)
  updateInput();

  const deltaX = inputState.deltaX;
  const deltaY = inputState.deltaY;
  const inputs = inputState as PlayerInputs;

  // --- THIS IS THE NEW, CORRECT LOGIC ---
  if (isDeployed) {
    // 1. Apply mouse look to camera rotation
    playerRotation.y -= deltaX;
    playerRotation.x -= deltaY;
    playerRotation.x = Math.max(
      -Math.PI / 2,
      Math.min(Math.PI / 2, playerRotation.x)
    );
    camera.rotation.copy(playerRotation);

    // 2. Tell the camera to FOLLOW the player mesh
    if (localPlayerEid !== null) {
      const localPlayerObj = playerObjects.get(localPlayerEid);
      if (localPlayerObj) {
        // --- THIS IS THE FIX ---
        // Get the position from the server-controlled mesh
        const cameraOffset = new THREE.Vector3(0, 0.6, 0); // eye height
        camera.position.copy(localPlayerObj.position).add(cameraOffset);
      }
    }
  }
  // --- END NEW LOGIC BLOCK ---

  // Send inputs to server
  const clientMsg = msgpackr.encode([
    tick++,
    [
      inputs.forward ?? 0,
      inputs.right ?? 0,
      !!inputs.jump,
      !!inputs.fire,
      !!inputs.sprint,
      !!inputs.showScoreboard,
    ],
    deltaX,
    deltaY,
  ]);

  try {
    if (socket && socket.readyState === WebSocket.OPEN && isDeployed) {
      socket.send(clientMsg);
    }
  } catch (e) {
    console.error(`Error sending client message ${tick}:`, e);
  }

  renderer.render(scene, camera);

  // Update FPS counter
  frameCount++;
  if (now - lastFPSUpdate > 250) {
    const fps = (frameCount * 1000) / (now - lastFPSUpdate);
    if (fpsEl) {
      fpsEl.textContent = `FPS: ${fps.toFixed(1)}`;
    }
    frameCount = 0;
    lastFPSUpdate = now;
  }
}

// === 7. UI & STARTUP ===
function updateUI(gameState: GameModeState) {
  if (teamATicketsEl)
    teamATicketsEl.textContent = String(gameState.team_a_tickets);
  if (teamBTicketsEl)
    teamBTicketsEl.textContent = String(gameState.team_b_tickets);

  // Scoreboard visibility is driven by local input for responsiveness
  if (inputState.showScoreboard) {
    scoreboardEl?.classList.remove("hidden");
  } else {
    scoreboardEl?.classList.add("hidden");
  }

  if (gameState.match_ended) {
    hudEl?.classList.add("hidden");
    scoreboardEl?.classList.add("hidden");
    if (respawnScreenEl && !respawnScreenEl.classList.contains("hidden")) {
      hideRespawnScreen();
    }
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }

    if (matchEndEl && matchWinnerEl) {
      const winnerText =
        gameState.winner === TeamId.TeamA
          ? "Team A Wins!"
          : gameState.winner === TeamId.TeamB
          ? "Team B Wins!"
          : "Draw";

      matchWinnerEl.textContent = winnerText;
      matchEndEl.classList.remove("hidden");
    }
  } else {
    if (respawnScreenEl?.classList.contains("hidden")) {
      hudEl?.classList.remove("hidden");
    }
    matchEndEl?.classList.add("hidden");
  }
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start the entire process
init();