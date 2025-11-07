let keys = new Set<string>();
// 1. ADD this new export
export const keysPressed = new Set<string>();

export const inputState = {
  forward: 0,
  right: 0,
  jump: false,
};

export function initInput(canvas: HTMLElement) {
  canvas.onclick = () => {
    canvas.requestPointerLock();
  };

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

  // 3. ADD this line at the end
  // This clears all the "just pressed" keys at the end of the frame
  keysPressed.clear();
}