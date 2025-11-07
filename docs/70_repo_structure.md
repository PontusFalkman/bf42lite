\# Repository Structure (v1.2)



\## Tree Overview

```text

bf42lite/

├─ apps/

│  └─ client-tauri/    # UI and rendering

├─ packages/

│  ├─ sim/             # ECS components and systems

│  ├─ net/             # Network adapters and utilities

│  ├─ protocol/        # Message schemas and validation

│  ├─ host-node/       # Optional Node or Rust host

│  └─ common/          # Shared helpers

├─ assets/

│  └─ tuning/          # JSON tuning configs (weapons, classes, movement)

└─ docs/               # Modular documentation



Coding Conventions



One system per file in /packages/sim.



No rendering or DOM logic inside /packages/sim.



/packages/protocol owns message formats; /packages/net only transports them.



Tune gameplay via JSON files in assets/tuning/, not hard-coded constants in systems.



Commit and Phase Rules



pnpm lint and pnpm build must pass before merging.



For Phase 1–3 work, maintain target FPS ≥ 120 in test scenes.



For networking work, keep RTT and desync metrics within phase acceptance targets.



Merge only when the corresponding phase backlog doc’s acceptance criteria are met.



End of v1.2 documentation set.

