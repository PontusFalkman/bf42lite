// apps/client-tauri/src/input.ts

let keys = new Set<string>();
export const keysPressed = new Set<string>();

// Accumulators for mouse movement
let accumulatedX = 0;
let accumulatedY = 0;

export const inputState = {
  forward: 0,
  right: 0,
  jump: false,
  fire: false,
  sprint: false,

  // Gadgets / actions
  useGadget: false,     // ammo box (3)
  useMedBox: false,     // med box (4)
  useRepairTool: false, // repair tool (5)
  useGrenade: false,    // grenade (G)

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
  const onPointerLockError = (e: Event) => {
    console.warn("[input] pointerlockerror", e);
  };

  document.addEventListener("pointerlockchange", onPointerLockChange);
  document.addEventListener("pointerlockerror", onPointerLockError);

  // --- MOUSE MOVE (ONLY WHEN LOCKED TO THIS CANVAS) ---
  const onMouseMove = (e: MouseEvent) => {
    // if (document.pointerLockElement !== canvas) return; // <-- TEMP: Comment out
    accumulatedX += e.movementX;
    accumulatedY += e.movementY;
  };
  document.addEventListener("mousemove", onMouseMove);

  // Optional: avoid right-click menu over the game
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  // --- MOUSE BUTTONS ---
  window.addEventListener("mousedown", (e) => {
    if (e.button === 0) {
      keys.add("Mouse0");
    }
  });

  window.addEventListener("mouseup", (e) => {
    if (e.button === 0) {
      keys.delete("Mouse0");
    }
  });

  // --- KEYBOARD ---
  window.addEventListener("keydown", (e) => {
    // Prevent Tab from changing browser focus
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
  // Movement
  inputState.forward =
    (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0);
  inputState.right =
    (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
  inputState.jump = keys.has("Space");

  // Fire / sprint
  inputState.fire = keys.has("Mouse0");
  inputState.sprint = keys.has("ShiftLeft") || keys.has("ShiftRight");

  // Gadgets
  inputState.useGadget = keys.has("Digit3");
  inputState.useMedBox = keys.has("Digit4");
  inputState.useRepairTool = keys.has("Digit5");
  inputState.useGrenade = keys.has("KeyG");

  // Scoreboard: visible while Tab is held
  inputState.showScoreboard = keys.has("Tab");

  // Reset one-shot Tab press
  if (!keys.has("Tab")) {
    keysPressed.delete("Tab");
  }

  // Mouse look
  inputState.deltaX = accumulatedX;
  inputState.deltaY = accumulatedY;

  accumulatedX = 0;
  accumulatedY = 0;
}
