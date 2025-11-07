let keys = new Set<string>();

export const inputState = {
  forward: 0,
  right: 0,
  jump: false,
};

export function initInput(canvas: HTMLElement) {
  canvas.onclick = () => {
    canvas.requestPointerLock();
  };

  window.addEventListener("keydown", (e) => {
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
}
