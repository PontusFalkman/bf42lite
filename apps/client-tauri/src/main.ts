// apps/client-tauri/src/main.ts

import * as THREE from "three";
import { initInput, updateInput, inputState } from "./input";
import { invoke } from "@tauri-apps/api/core";
import { Packr } from "msgpackr";

const msgpackr = new Packr();
let socket: WebSocket | null = null;

// === 1. CSS INJECTION (Fix #1: CSS & DOM Visibilty) ===
const style = document.createElement("style");
style.textContent = `
  html, body { margin:0; height:100%; overflow:hidden; background:#000; }
  #game { display:block; width:100vw; height:100vh; position:relative; z-index:0; }
  #hud { position:absolute; top:8px; left:8px; z-index:10; color:#fff; font:14px monospace; }
  #menu, #respawn-screen { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; z-index:20; }
  .hidden { display:none !important; }
`;
document.head.appendChild(style);

// === 2. UI ELEMENTS ===
let canvasEl = document.getElementById("game") as HTMLCanvasElement | null;
const hudEl = document.getElementById("hud");
const menuEl = document.getElementById("menu");
const fpsEl = document.getElementById("fps-counter");
const healthEl = document.getElementById("health-counter");
const staminaEl = document.getElementById("stamina-counter");
const respawnScreenEl = document.getElementById("respawn-screen");
const respawnTimerEl = document.getElementById("respawn-timer");
const btnDeploy = document.getElementById("btn-deploy") as HTMLButtonElement;

const missing: string[] = [];
if (!hudEl) missing.push("#hud");
if (!menuEl) missing.push("#menu");
if (!fpsEl) missing.push("#fps-counter");
if (!healthEl) missing.push("#health-counter");
if (!staminaEl) missing.push("#stamina-counter");
if (!respawnScreenEl) missing.push("#respawn-screen");
if (!respawnTimerEl) missing.push("#respawn-timer");
if (!btnDeploy) missing.push("#btn-deploy");
if (!document.getElementById("scoreboard-top")) missing.push("#scoreboard-top");
if (!document.getElementById("team-a-tickets")) missing.push("#team-a-tickets");
if (!document.getElementById("team-b-tickets")) missing.push("#team-b-tickets");
if (!document.getElementById("crosshair")) missing.push("#crosshair");
if (!document.getElementById("scoreboard")) missing.push("#scoreboard");
if (!document.getElementById("match-end-message")) missing.push("#match-end-message");
if (!document.getElementById("match-winner")) missing.push("#match-winner");

if (missing.length)
  console.warn("Missing UI ids:", missing.join(", "));


// === 3. RENDERER SETUP (Fix #1: Guarantee Canvas) ===
if (!canvasEl) {
  console.warn("Canvas #game missing, creating fallback.");
  canvasEl = document.createElement("canvas");
  canvasEl.id = "game";
  document.body.appendChild(canvasEl);
}

const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio || 1);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

// CROSSHAIR
const crosshairEl = document.createElement("div");
crosshairEl.style.position = "absolute";
crosshairEl.style.top = "50%";
crosshairEl.style.left = "50%";
crosshairEl.style.width = "10px";
crosshairEl.style.height = "10px";
crosshairEl.style.border = "2px solid white";
crosshairEl.style.borderRadius = "50%"; 
crosshairEl.style.transform = "translate(-50%, -50%)";
crosshairEl.style.pointerEvents = "none"; 
crosshairEl.style.zIndex = "100";
document.body.appendChild(crosshairEl);

// === 4. THREE.JS SCENE ===
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 20, 30);
camera.lookAt(0, 0, 0);

scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(50, 100, 50);
dirLight.castShadow = true;
scene.add(dirLight);

const groundGeo = new THREE.PlaneGeometry(200, 200);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x228b22 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
scene.add(new THREE.GridHelper(200, 50));

// Pillars
const pillarGeo = new THREE.BoxGeometry(1, 4, 1);
const pillarMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
const pillars = [ {x: 5, z: 5}, {x: -5, z: 5}, {x: 5, z: -5}, {x: -5, z: -5} ];
pillars.forEach(p => {
    const mesh = new THREE.Mesh(pillarGeo, pillarMat);
    mesh.position.set(p.x, 2, p.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
});

const playerGeo = new THREE.BoxGeometry(2, 2, 2);
const localMat = new THREE.MeshStandardMaterial({ color: 0x0044ff }); 
const enemyMat = new THREE.MeshStandardMaterial({ color: 0xff0000 }); 
const playerObjects = new Map<number, THREE.Mesh>();

// === 5. GAME STATE ===
let localPlayerEid: number | null = null;
let cameraYaw = 0;
let cameraPitch = 0;
let tick = 0;
let isDeployed = false;
let respawnInterval: number | null = null; 
let lastMe = { x: 0, y: 0, z: 0, has: false };
let frames = 0;
let lastFPS = performance.now();
let lastYaw = 0; // radians from server

const debugCube = new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshNormalMaterial());
debugCube.position.set(0,1,0);
scene.add(debugCube);

interface PlayerInputs { forward: number; right: number; jump: boolean; fire: boolean; sprint: boolean; showScoreboard: boolean; }
interface TickSnapshot { entities: any[]; game_state: any; }
interface ServerEnvelope { your_id: number; snapshot: TickSnapshot; }

// === 6. INPUT ===
window.addEventListener("mousemove", (event) => {
  if (document.pointerLockElement !== canvasEl || !isDeployed) return;
  cameraYaw   -= event.movementX * 0.002;
  cameraPitch -= event.movementY * 0.002;
  cameraPitch = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, cameraPitch));
});

function getPlayerObject(eid: number, isLocal: boolean): THREE.Mesh {
  let obj = playerObjects.get(eid);
  if (!obj) {
    const mat = isLocal ? localMat : enemyMat;
    obj = new THREE.Mesh(playerGeo, mat.clone());
    obj.castShadow = true;
    obj.receiveShadow = true;
    scene.add(obj);
    playerObjects.set(eid, obj);
  }
  return obj;
}

// === 7. UI LOGIC ===
function showRespawnScreen(duration: number = 5) {
  isDeployed = false;
  document.exitPointerLock();
  crosshairEl.style.display = "none"; 
  respawnScreenEl?.classList.remove("hidden");
  hudEl?.classList.add("hidden");
  if(btnDeploy) {
    btnDeploy.disabled = true;
    btnDeploy.textContent = "DEPLOYING IN...";
  }
  let remaining = duration;
  if(respawnTimerEl) respawnTimerEl.textContent = remaining.toString();
  if (respawnInterval) window.clearInterval(respawnInterval);
  respawnInterval = window.setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      window.clearInterval(respawnInterval!);
      respawnInterval = null;
      if(respawnTimerEl) respawnTimerEl.textContent = "READY";
      if(btnDeploy) {
        btnDeploy.disabled = false;
        btnDeploy.textContent = "DEPLOY";
      }
    } else {
      if(respawnTimerEl) respawnTimerEl.textContent = remaining.toString();
    }
  }, 1000);
}

function hideRespawnScreen() {
  respawnScreenEl?.classList.add("hidden");
  hudEl?.classList.remove("hidden");
  crosshairEl.style.display = "block"; 
  if (respawnInterval) { window.clearInterval(respawnInterval); respawnInterval = null; }
}

// === 8. NETWORKING ===

// (Patch C: Modified init function)
async function init() {
  console.log("[BOOT] init");
  try { await invoke("start_host"); } catch(e) { console.error(e); }
  setupClientLogic();

  // debug auto-deploy so inputs flow
  hideRespawnScreen();
  isDeployed = true;
  canvasEl!.requestPointerLock();

  // start the render loop exactly once here
  gameLoop(0);
}

function setupClientLogic() {
  socket = new WebSocket("ws://127.0.0.1:8080");
  socket.binaryType = "arraybuffer";

  socket.onopen = () => {
    console.log("[WS] open");
    initInput(canvasEl!); // use the guaranteed canvas
    // (Patch C: Removed gameLoop(0) from here)
  };

  socket.onerror = (ev) => { console.error("[WS] error", ev); };
  socket.onclose = (ev) => { console.warn("[WS] close", ev.code, ev.reason); };

  // (Patch A: Replaced entire onmessage handler)
  socket.onmessage = async (event) => {
    // robust Blob/ArrayBuffer handling
    let ab: ArrayBuffer;
    if (event.data instanceof Blob) ab = await event.data.arrayBuffer();
    else if (event.data instanceof ArrayBuffer) ab = event.data;
    else if (event.data?.buffer instanceof ArrayBuffer) ab = event.data.buffer as ArrayBuffer;
    else { console.error("[WS] unknown event.data type", typeof event.data); return; }
  
    // decode
    let tickData: TickSnapshot;
    let yourId: number | null = null;
    try {
      const raw = msgpackr.decode(new Uint8Array(ab)) as any;  // NOTE: Uint8Array
      const hasEnvelope = raw && typeof raw === "object" && "snapshot" in raw && "your_id" in raw;
      if (hasEnvelope) { yourId = (raw as ServerEnvelope).your_id; tickData = (raw as ServerEnvelope).snapshot; }
      else { tickData = raw as TickSnapshot; }
    } catch (e) { console.error("[WS] decode failed", e); return; }
  
    if (!tickData?.entities?.length) return;
  
    // lock my id before loop
    if (localPlayerEid === null) {
      localPlayerEid = yourId ?? (tickData.entities[0]?.eid ?? null);
      console.log("[NET] my id =", localPlayerEid);
    }
  
    // sync meshes + capture my transform
    let meFound = false;
    for (const e of tickData.entities) {
      const isMe = (e.eid === localPlayerEid);
      const obj = getPlayerObject(e.eid, isMe);
  
      const px = e.transform.x ?? 0;
      const py = e.transform.y ?? 0;
      const pz = e.transform.z ?? 0;
  
      obj.position.set(px, py, pz);
      if (typeof e.transform.yaw === "number") obj.rotation.y = e.transform.yaw;
  
      obj.visible = true;
  
      if (isMe) {
        meFound = true;
        lastMe.x = px; lastMe.y = py; lastMe.z = pz; lastMe.has = true;
        if (typeof e.transform.yaw === "number") lastYaw = e.transform.yaw;
      }
    }
  
    if (!meFound) {
      const e = tickData.entities[0];
      lastMe.x = e.transform.x ?? 0; lastMe.y = e.transform.y ?? 0; lastMe.z = e.transform.z ?? 0; lastMe.has = true;
      if (typeof e.transform.yaw === "number") lastYaw = e.transform.yaw;
    }
  };  
};

async function gameLoop(now: number) {
  requestAnimationFrame(gameLoop);

  // (Patch B: Replaced camera logic with first-person)
  if (lastMe.has) {
    const dist = 6;
    const height = 2;
    const offX = -Math.sin(lastYaw) * dist;
    const offZ = -Math.cos(lastYaw) * dist;
    camera.position.set(lastMe.x + offX, lastMe.y + height, lastMe.z + offZ);
    camera.lookAt(lastMe.x, lastMe.y + 1.2, lastMe.z);
  } else {
    camera.position.set(0, 20, 30);
    camera.lookAt(0, 0, 0);
  }
  

  debugCube.rotation.y += 0.01;

  frames++;
  const nowMs = performance.now();
  if (nowMs - lastFPS > 250) {
    const fps = (frames * 1000) / (nowMs - lastFPS);
    if (fpsEl) {
      fpsEl.textContent = `FPS: ${fps.toFixed(1)}`;
    }
    frames = 0;
    lastFPS = nowMs;
  }
  
  if (socket && socket.readyState === WebSocket.OPEN && isDeployed) {
    updateInput();
    const inputs = inputState as PlayerInputs;
    const msg = msgpackr.encode([
      tick++,
      [inputs.forward||0, inputs.right||0, !!inputs.jump, !!inputs.fire, !!inputs.sprint, !!inputs.showScoreboard],
      inputState.deltaX,
      inputState.deltaY
    ]);
    socket.send(msg);
  }
  
  renderer.render(scene, camera);
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

init();