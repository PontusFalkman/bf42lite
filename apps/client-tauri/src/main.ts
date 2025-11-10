// apps/client-tauri/src/main.ts

import * as THREE from "three";
import { initInput, updateInput, inputState } from "./input";
import { invoke } from "@tauri-apps/api/core";
// N1: Import the encoder
import { Packr } from "msgpackr";

// N2: --- REMOVED LoopbackAdapter ---
// N2: Instantiate encoder
const msgpackr = new Packr();
// N2: Declare the WebSocket
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

// --- Get new scoreboard UI elements ---
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
if (!canvas || !hudEl || !menuEl) {
  throw new Error("Failed to find one or more essential UI elements!");
}

// === 1. THREE.JS SETUP ===
// (This section is identical to your previous file)
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 7.5);
scene.add(dirLight);
const groundGeo = new THREE.PlaneGeometry(100, 100);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
const playerObjects = new Map<number, THREE.Mesh>();
const playerGeo = new THREE.BoxGeometry(1, 1.8, 1);
const playerMat = new THREE.MeshStandardMaterial({ color: 0x00ff00 });

// === 2. RUST INTERFACES (UPDATED) ===
// (This section is identical to your previous file)
interface PlayerInputs {
  forward: number;
  right: number;
  jump: boolean;
  fire: boolean;
  sprint: boolean;
  showScoreboard: boolean;
}
interface InputPayload {
  tick: number;
  inputs: PlayerInputs;
  delta_x: number;
  delta_y: number;
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
// (This section is identical to your previous file)
let localPlayerEid: number | null = null;
let playerRotation = new THREE.Euler(0, 0, 0, "YXZ");
let tick = 0;

function getPlayerObject(eid: number): THREE.Mesh {
  let obj = playerObjects.get(eid);
  if (!obj) {
    obj = new THREE.Mesh(playerGeo, playerMat.clone());
    scene.add(obj);
    playerObjects.set(eid, obj);
  }
  return obj;
}

// === N2: REMOVED setupHostLogic() ===

// === N2: CLIENT LOGIC (Simplified) ===
/**
 * Sets up the client's WebSocket connection.
 */
function setupClientLogic() {
  console.log("Client: Connecting to ws://127.0.0.1:8080...");
  socket = new WebSocket("ws://127.0.0.1:8080");
  socket.binaryType = "arraybuffer"; // Important!

  // 1. On Connection Open
  socket.onopen = () => {
    console.log("Client: WebSocket connection established!");
    menuEl?.classList.add("hidden");
    hudEl?.classList.remove("hidden");

    // Start the input/render loop
    initInput(canvas);
    gameLoop(0); // Start the game loop
  };

  // 2. On Message Received
  socket.onmessage = (event) => {
    try {
      // Decode the binary snapshot from the server
      const tickData: TickSnapshot = msgpackr.decode(
        new Uint8Array(event.data)
      );

      // N2: Find the local player EID on the first snapshot
      if (localPlayerEid === null) {
        // Find our player. This is a simple/bad way, but it works for N2.
        // A real "Join" message would be better.
        // Let's assume the server gives us the highest EID.
        if (tickData.entities.length > 0) {
            localPlayerEid = tickData.entities.reduce((max, e) => Math.max(max, e.eid), 0);
            console.log(`Client: Local player EID set to: ${localPlayerEid}`);
        }
      }

      // N2: All rendering logic from N1's setupClientLogic is identical
      updateUI(tickData.game_state);

      for (const entity of tickData.entities) {
        const { eid, transform, health, stamina } = entity;
        const obj = getPlayerObject(eid);

        obj.position.set(transform.x, transform.y, transform.z);

        if (eid === localPlayerEid) {
          // hide local player model
          obj.visible = false;

          // Apply local rotation to camera
          camera.rotation.copy(playerRotation);
          const cameraOffset = new THREE.Vector3(0, 0.6, 0); // eye height
          camera.position.copy(obj.position).add(cameraOffset);

          // Update local HUD
          if (health && healthEl) {
            healthEl.textContent = `HP: ${health.current.toFixed(0)}`;
          }
          if (stamina && staminaEl) {
            staminaEl.textContent = `STAM: ${stamina.current.toFixed(0)}`;
          }
        } else {
          // show everyone else
          obj.visible = true;
        }
      }

      renderer.render(scene, camera);
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

// === 4. CORE GAME LOOP (Client) ===
async function init() {
  console.log("Initializing client...");
  console.log("Telling Rust backend to start host...");

  try {
    // N2: Tell the Rust backend to start the server
    await invoke("start_host");
    console.log("Client: Host server started by Rust.");
    
    // N2: Now, this client will connect to it
    // Give the server a moment to bind
    setTimeout(setupClientLogic, 100); 

  } catch (e) {
    console.error("Failed to start host:", e);
    alert("FATAL: Failed to start host. See console.");
  }
}

let lastTime = 0;
let frameCount = 0;
let lastFPSUpdate = 0;

async function gameLoop(now: number) {
  requestAnimationFrame(gameLoop);

  const dt = (now - lastTime) / 1000;
  lastTime = now;

  // Update input state for this frame
  updateInput();

  const deltaX = inputState.deltaX;
  const deltaY = inputState.deltaY;

  // Apply mouse look *locally*
  playerRotation.y -= deltaX;
  playerRotation.x -= deltaY;
  playerRotation.x = Math.max(
    -Math.PI / 2,
    Math.min(Math.PI / 2, playerRotation.x)
  );

  const inputs = inputState as PlayerInputs;

  const clientMsg = msgpackr.encode([
    tick++, // 0: tick
    [
      inputs.forward ?? 0,          // 0: forward (f32)
      inputs.right ?? 0,            // 1: right   (f32)
      !!inputs.jump,                // 2: jump    (bool)
      !!inputs.fire,                // 3: fire    (bool)
      !!inputs.sprint,              // 4: sprint  (bool)
      !!inputs.showScoreboard,      // 5: showScoreboard (bool)
    ],
    deltaX, // 2: delta_x
    deltaY, // 3: delta_y
  ]);

  try {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(clientMsg);
    }
  } catch (e) {
    console.error(`Error sending client message ${tick}:`, e);
  }

  // N2: The FPS counter can stay here
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

// === 5. UI & STARTUP ===
// (This section is identical to your previous file)
function updateUI(gameState: GameModeState) {
  if (teamATicketsEl)
    teamATicketsEl.textContent = String(gameState.team_a_tickets);
  if (teamBTicketsEl)
    teamBTicketsEl.textContent = String(gameState.team_b_tickets);

  if (inputState.showScoreboard) {
    scoreboardEl?.classList.remove("hidden");
  } else {
    scoreboardEl?.classList.add("hidden");
  }

  if (gameState.match_ended) {
    hudEl?.classList.add("hidden");

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
    hudEl?.classList.remove("hidden");
    matchEndEl?.classList.add("hidden");
  }
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// N2: This one call now starts the whole new process
init();