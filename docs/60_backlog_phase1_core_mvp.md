# Development Backlog (v1.3)

**Current Focus:** Phase 4 — Core Gameplay & Hit Reconciliation

## Phases
| Phase | Goal | Deliverables |
| :--- | :--- | :--- |
| **1** | Core MVP | Movement, ECS loop, glTF models |
| **2** | LAN Loopback | Host/join, basic messages |
| **3** | Visual Polish | Camera, HUD, map |
| **4** | Core Gameplay | Shooting, hit reconcile, death/respawn, tickets |
| **5** | Expansion | Vehicles, Island map, class roles |

## Phase 4 Acceptance Criteria
* [ ] Player movement is smooth on other clients via interpolation.
* [ ] Client proposes fire; server validates and confirms hits.
* [ ] Server applies damage, death, respawn logic.
* [ ] Tickets drain reliably and reach Game Over state.