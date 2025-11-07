# Simulation Architecture (v1.2)

## ECS Framework
- **JS/TS:** `bitecs` in `/packages/sim`.
- **Future Rust:** `hecs` or `legion` with equivalent components.

Core components for MVP:

- `Transform { x, y, z }`
- `Velocity { x, y, z }`
- `InputAxis { forward, right, jump }`
- Phase 4+: `Health`, `Weapon`, `Projectile`, `Team`, `Score`.

Core systems:

- Movement system.
- Future: Shooting, damage, respawn, ticket system.

## Determinism Rules
- Fixed timestep: `dt = 1/60` seconds.
- No use of `Math.random()` inside tick logic.
- Use tick-indexed seeded RNG for any randomness (e.g. recoil).
- Simulation results must be reproducible from input streams and seeds.

## Simulation Entry Point
Public interface:

```ts
// JS version
function step(world, dt): void;

Later, a Rust backend can expose the same semantics:

fn step(world_state: &mut WorldState, dt: f32);


The client does not depend on the internal implementation; it only calls step.

Separation of Concerns

/packages/sim: ECS components and systems only.

/packages/net: Transport and adapters; no ECS logic.

/packages/protocol: Message schemas and versions.

apps/client-tauri: Rendering, input, HUD.

Next: 31_design_sim_movement.md