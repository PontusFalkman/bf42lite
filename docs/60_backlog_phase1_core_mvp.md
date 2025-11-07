\# Phase 1 – Core MVP Backlog (v1.2)



\## Scope

Single-player local movement and rendering.  

No networking; goal is a clean, deterministic ECS and renderer.



\## Tasks

| ID | Task              | Output                                  |

|----|-------------------|------------------------------------------|

| M1 | Workspace setup   | pnpm workspaces; builds without errors   |

| C1 | Renderer          | Three.js scene with visible cube         |

| C2 | Input system      | WASD + pointer lock                      |

| C3 | ECS world         | `Transform`, `Velocity`, `InputAxis`     |

| C4 | Movement system   | Cube moves via ECS per design spec       |

| C5 | Basic HUD (FPS)   | Simple FPS counter overlay               |



\## Acceptance Criteria

\- `pnpm dev` runs without errors.

\- Cube moves according to WASD input.

\- Movement uses ECS (`step(world, dt)`), not ad-hoc logic.

\- FPS counter present and stable near 120 fps.



Next: \[61\_backlog\_phase2\_lan\_loopback.md](./61\_backlog\_phase2\_lan\_loopback.md)



