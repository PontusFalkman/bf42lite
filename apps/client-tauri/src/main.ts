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
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);

// Simple lighting so we can see the player cubes
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 7.5);
scene.add(dirLight);

// Simple ground plane
const groundGeo = new THREE.PlaneGeometry(100, 100);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// Player object map
const playerObjects = new Map<number, THREE.Mesh>();
const playerGeo = new THREE.BoxGeometry(1, 1.8, 1);
const playerMat = new THREE.MeshStandardMaterial({ color: 0x00ff00 });

// === 2. RUST INTERFACES (UPDATED) ===
// These must match 'sim.rs'

interface PlayerInputs {
  forward: number;
  right: number;
  jump: boolean;
  fire: boolean;
  sprint: boolean;
  showScoreboard: boolean; // Must be camelCase (serde rename on Rust side)
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

// === 4. CORE GAME LOOP ===

// The gameLoop(0) call lives inside init()
async function init() {
  console.log("Initializing simulation...");
  try {
    const initialSnapshot: TickSnapshot = await invoke("init_sim");

    if (initialSnapshot.entities.length > 0) {
      localPlayerEid = initialSnapshot.entities[0].eid;
      console.log(`Local player EID set to: ${localPlayerEid}`);
    } else {
      console.error("Init snapshot was empty!");
    }

    menuEl?.classList.add("hidden");
    hudEl?.classList.remove("hidden");

    initInput(canvas);

    // Start the game loop after init is done
    gameLoop(0);
  } catch (e) {
    console.error("Failed to init simulation:", e);
    alert("Failed to start simulation. See console for details.");
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

  // Apply mouse look
  playerRotation.y -= deltaX;
  playerRotation.x -= deltaY;
  playerRotation.x = Math.max(
    -Math.PI / 2,
    Math.min(Math.PI / 2, playerRotation.x)
  );

  const payload: InputPayload = {
    tick: tick++,
    inputs: inputState as PlayerInputs,
    delta_x: deltaX,
    delta_y: deltaY,
  };

  try {
    const tickData: TickSnapshot = await invoke("step_tick", {
      payload,
    });

    updateUI(tickData.game_state);

    for (const entity of tickData.entities) {
      const { eid, transform, health, stamina } = entity;
      const obj = getPlayerObject(eid);
    
      obj.position.set(transform.x, transform.y, transform.z);
    
      if (eid === localPlayerEid) {
        // hide local player model so camera is not inside it
        obj.visible = false;
    
        camera.rotation.copy(playerRotation);
        const cameraOffset = new THREE.Vector3(0, 0.6, 0); // eye height
        camera.position.copy(obj.position).add(cameraOffset);
    
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

    // FPS counter
    frameCount++;
    if (now - lastFPSUpdate > 250) {
      const fps = (frameCount * 1000) / (now - lastFPSUpdate);
      if (fpsEl) {
        fpsEl.textContent = `FPS: ${fps.toFixed(1)}`;
      }
      frameCount = 0;
      lastFPSUpdate = now;
    }
  } catch (e) {
    console.error(`Error in tick ${tick}:`, e);
  }
}

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

// === 5. STARTUP ===
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

init();
