// apps/client-tauri/src/input.ts

let keys = new Set<string>();
export const keysPressed = new Set<string>();

// --- C2: Add accumulators for mouse movement ---
let accumulatedX = 0;
let accumulatedY = 0;

export const inputState = {
  forward: 0,
  right: 0,
  jump: false,
  fire: false, // --- G2: ADD THIS ---
  // --- C2: Add deltaX/Y to state ---
  sprint: false, // <-- ADD THIS
  useGadget: false, // <-- ADD THIS (Ammo Box)
  useMedBox: false, // <-- ADD THIS (Med Box)
  useRepairTool: false, // <-- ADD THIS (Repair Tool)
  useGrenade: false, // <-- X3: ADD THIS
  deltaX: 0,
  deltaY: 0,
  // --- G4: ADD SCOREBOARD STATE ---
  showScoreboard: false,
  // --- END G4 ---
};

export function initInput(canvas: HTMLElement) {
  canvas.onclick = () => {
    canvas.requestPointerLock();
  };

  // --- C2: Add mouse move listener ---
  document.addEventListener("mousemove", (e) => {
    // Only accumulate movement if pointer is locked
    if (document.pointerLockElement === canvas) {
      accumulatedX += e.movementX;
      accumulatedY += e.movementY;
    }
  });

  // --- G2: ADD MOUSE LISTENERS ---
  window.addEventListener("mousedown", (e) => {
    if (e.button === 0) { // 0 = Left click
      keys.add("Mouse0");
    }
  });

  window.addEventListener("mouseup", (e) => {
    if (e.button === 0) {
      keys.delete("Mouse0");
    }
  });
  // --- END G2 ---

  // 2. MODIFY this listener
  window.addEventListener("keydown", (e) => {
    // --- G4: HANDLE TAB KEY ---
    if (e.code === "Tab") {
      e.preventDefault(); // Stop the browser from changing focus

      // Only toggle on the *first* press, not when held down
      if (!keys.has(e.code)) { 
        inputState.showScoreboard = !inputState.showScoreboard;
      }
    }
    // --- END G4 ---


    // This logic prevents the key from being added every frame if held down
    if (!keys.has(e.code)) {
      keysPressed.add(e.code);
    }
    keys.add(e.code);
  });

  window.addEventListener("keyup", (e) => {
    keys.delete(e.code);
  });
}

export function updateInput() {
  inputState.forward =
    (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0);
  inputState.right =
    (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
  inputState.jump = keys.has("Space");
  inputState.fire = keys.has("Mouse0"); // --- G2: ADD THIS ---
  inputState.sprint = keys.has("ShiftLeft"); // <-- ADD THIS
  inputState.useGadget = keys.has("Digit3"); // <-- ADD THIS (Use '3' key)
  inputState.useMedBox = keys.has("Digit4"); // <-- ADD THIS (Use '4' key)
  inputState.useRepairTool = keys.has("Digit5"); // <-- ADD THIS (Use '5' key)
  inputState.useGrenade = keys.has("KeyG"); // <-- X3: ADD THIS (Use 'G' key)
  
  // --- G4: UPDATE SCOREBOARD STATE ---
  if (!keys.has("Tab")) {
    // This ensures showScoreboard only toggles once per press
    keysPressed.delete("Tab"); 
  }
  // --- END G4 ---

  // --- MOUSE FIX ---
  // Copy accumulated mouse movement into the state
  inputState.deltaX = accumulatedX;
  inputState.deltaY = accumulatedY;
  
  // Reset accumulators for the next frame
  accumulatedX = 0;
  accumulatedY = 0;
}