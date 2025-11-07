# Phase 4 – Core Gameplay Backlog (v1.2)

## Scope
Introduce full combat loop and optional Rust-backed simulation tick.

## Tasks
| ID  | Task                 | Output                                       |
|-----|----------------------|----------------------------------------------|
| G1  | Health + damage      | `Health` component and damage application    |
| G2  | Weapon fire          | Hitscan shooting per weapons design          |
| G3  | Death & respawn      | Death events and respawn logic               |
| G4  | Tickets & scoring    | Conquest/TDM rules, scoreboard HUD           |
| G5  | Rust tick bridge     | Tauri command `step_tick` with parity tests  |

## Acceptance Criteria
- End-to-end match: spawn → fight → tickets expire → match ends.
- JS vs Rust simulation produces equivalent results for test scenarios.
- Rust-backed tick can run in headless mode.

Next: [64_backlog_phase5_expansion.md](./64_backlog_phase5_expansion.md)
