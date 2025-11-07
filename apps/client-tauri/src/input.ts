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
  deltaX: 0,
  deltaY: 0,
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

  // --- C2: Copy accumulated deltas and reset ---
  inputState.deltaX = accumulatedX;
  inputState.deltaY = accumulatedY;
  accumulatedX = 0;
  accumulatedY = 0;
  // --- END C2 ---

  // 3. ADD this line at the end
  // This clears all the "just pressed" keys at the end of the frame
  keysPressed.clear();
}