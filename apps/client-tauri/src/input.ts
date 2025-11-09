// apps/client-tauri/src/input.ts

let keys = new Set<string>();
export const keysPressed = new Set<string>();

// Accumulators for mouse movement
let accumulatedX = 0;
let accumulatedY = 0;

export const inputState = {
  // --- FIX ---
  // Changed from boolean back to number to match Rust (f32)
  forward: 0,
  right: 0,
  // --- END FIX ---
  jump: false,
  fire: false,
  sprint: false,

  // Gadgets / actions (from your file)
  useGadget: false,
  useMedBox: false,
  useRepairTool: false,
  useGrenade: false,

  // Mouse look
  deltaX: 0,
  deltaY: 0,

  // UI
  showScoreboard: false,
};

export function initInput(canvas: HTMLCanvasElement) {
  // --- CLICK → POINTER LOCK ---
  canvas.addEventListener("click", () => {
    if (document.pointerLockElement !== canvas) {
      console.log("[input] canvas clicked → requestPointerLock()");
      canvas.requestPointerLock();
    }
  });

  // --- DEBUG POINTER LOCK STATE ---
  const onPointerLockChange = () => {
    const locked = document.pointerLockElement === canvas;
    console.log(
      "[input] pointerlockchange:",
      locked ? "locked on canvas" : "unlocked"
    );
  };
  document.addEventListener("pointerlockchange", onPointerLockChange, false);
  document.addEventListener("pointerlockerror", console.error, false);

  // --- MOUSE MOVE ---
  document.addEventListener("mousemove", (e) => {
    if (document.pointerLockElement === canvas) {
      accumulatedX += e.movementX;
      accumulatedY += e.movementY;
    }
  });

  // --- MOUSE BUTTONS ---
  window.addEventListener("mousedown", (e) => {
    if (e.button === 0) keys.add("Mouse0"); // Left
    if (e.button === 1) keys.add("Mouse1"); // Middle
    if (e.button === 2) keys.add("Mouse2"); // Right
  });
  window.addEventListener("mouseup", (e) => {
    if (e.button === 0) keys.delete("Mouse0");
    if (e.button === 1) keys.delete("Mouse1");
    if (e.button === 2) keys.delete("Mouse2");
  });

  // --- KEYS ---
  window.addEventListener("keydown", (e) => {
    // Prevent Tab from changing focus
    if (e.code === "Tab") {
      e.preventDefault();
    }

    // One-shot press tracking
    if (!keys.has(e.code)) {
      keysPressed.add(e.code);
    }
    keys.add(e.code);
  });

  window.addEventListener("keyup", (e) => {
    keys.delete(e.code);
  });

  // --- SAFETY: CLEAR ON BLUR ---
  window.addEventListener("blur", () => {
    keys.clear();
    inputState.forward = 0;
    inputState.right = 0;
    inputState.jump = false;
    inputState.sprint = false;
    inputState.useGadget = false;
    inputState.useMedBox = false;
    inputState.useRepairTool = false;
    inputState.useGrenade = false;
  });
}

// Call this once per frame from your main loop
export function updateInput() {
  // --- THIS IS THE FIX ---
  // Movement (calculates -1, 0, or 1)
  inputState.forward = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0);
  inputState.right = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
  // --- END FIX ---

  inputState.jump = keys.has("Space");

  // Fire / sprint
  inputState.fire = keys.has("Mouse0");
  inputState.sprint = keys.has("ShiftLeft") || keys.has("ShiftRight");

  // Gadgets
  inputState.useGadget = keys.has("Digit3");
  inputState.useMedBox = keys.has("Digit4");
  inputState.useRepairTool = keys.has("Digit5");
  inputState.useGrenade = keys.has("KeyG");

  // UI
  inputState.showScoreboard = keys.has("Tab");

  // Mouse look
  inputState.deltaX = accumulatedX;
  inputState.deltaY = accumulatedY;

  // Reset accumulators
  accumulatedX = 0;
  accumulatedY = 0;

  // Clear one-shot presses
  keysPressed.clear();
}