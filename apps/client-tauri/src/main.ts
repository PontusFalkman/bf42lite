import * as THREE from "three";
import { initInput, updateInput, inputState } from "./input";
import { addEntity, addComponent } from "bitecs";
import { world, step } from "./loop";
import { Transform, Velocity } from "./ecs/components";
import { LoopbackAdapter } from "@net/adapter";
import { Packr } from "msgpackr";
import {
  InputMsg,
  StateMsg,
  EntitySnapshot,
} from "@protocol/schema";

const canvas = document.getElementById("game") as HTMLCanvasElement | null;
const fpsEl = document.getElementById("fps-counter") as HTMLDivElement | null;

if (!canvas) {
  throw new Error("Canvas with id 'game' not found");
}

// === 1. NETWORK & SERIALIZATION SETUP ===
const adapter = new LoopbackAdapter();
const packr = new Packr();
let tick = 0;

// === 2. THREE.JS (CLIENT) SETUP ===
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

const geometry = new THREE.BoxGeometry();
const material = new THREE.MeshStandardMaterial({ color: 0x4488ff });
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);
// This cube's state will now be driven by network messages

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 10, 7);
scene.add(light);

// === 3. ECS (HOST) SETUP ===
const SPEED = 3.0;
const playerEid = addEntity(world);
addComponent(world, Transform, playerEid);
addComponent(world, Velocity, playerEid);
Transform.x[playerEid] = 0;
Transform.y[playerEid] = 0;
Transform.z[playerEid] = 0;
// This will store the last input received by the host
let lastHostInput: InputMsg["axes"] = { forward: 0, right: 0, jump: false };

// === 4. MESSAGE HANDLERS ===

/**
 * CLIENT: Receives state from the host
 */
adapter.onClientMessage((msg) => {
  const stateMsg = packr.unpack(msg) as StateMsg;
  if (stateMsg.type === "state") {
    // In a real client, we'd interpolate. For loopback, we just copy.
    const snapshot = stateMsg.entities[0];
    if (snapshot) {
      cube.position.x = snapshot.x;
      cube.position.y = snapshot.y;
      cube.position.z = snapshot.z;
    }
  }
});

/**
 * HOST: Receives input from the client
 */
adapter.onHostMessage((msg) => {
  const inputMsg = packr.unpack(msg) as InputMsg;
  if (inputMsg.type === "input") {
    // Store the latest input to be used in the next sim tick
    lastHostInput = inputMsg.axes;
  }
});

// === 5. GAME LOOP ===
initInput(canvas);

let last = performance.now();
const FIXED_DT_MS = 1000 / 60; // 60hz in milliseconds
let accumulator = 0;

let frameCount = 0;
let lastFPSUpdate = performance.now();

function loop() {
  const now = performance.now();
  const frameTime = Math.min(now - last, 1000);
  last = now;

  accumulator += frameTime;

  // === 6. CLIENT: SEND INPUT (runs every frame) ===
  updateInput();
  const inputMsg: InputMsg = {
    type: "input",
    tick: tick, // We'll use this for reconciliation later
    axes: { ...inputState },
  };
  adapter.sendClientMessage(packr.pack(inputMsg));

  // === 7. HOST: SIMULATION STEP (runs at fixed 60hz) ===
  while (accumulator >= FIXED_DT_MS) {
    // A. Apply last received input to ECS Velocity
    Velocity.x[playerEid] = lastHostInput.right * SPEED;
    Velocity.z[playerEid] = -lastHostInput.forward * SPEED;
    Velocity.y[playerEid] = 0; // No gravity yet

    // B. Run the ECS simulation
    step(); // This runs MovementSystem
    tick++;

    // C. Create a snapshot of the result
    const snapshot: EntitySnapshot = {
      id: playerEid,
      x: Transform.x[playerEid],
      y: Transform.y[playerEid],
      z: Transform.z[playerEid],
    };
    const stateMsg: StateMsg = {
      type: "state",
      tick: tick,
      entities: [snapshot],
    };

    // D. HOST: Send state to client
    adapter.sendHostMessage(packr.pack(stateMsg));

    // E. Decrement accumulator
    accumulator -= FIXED_DT_MS;
  }

  // === 8. CLIENT: RENDER STEP (runs every frame) ===
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