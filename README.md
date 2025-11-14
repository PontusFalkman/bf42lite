Here is the new `README.md` for the root of your repository. It aligns with the \*\*v1.3 Hybrid Authority\*\* architecture and the new directory structure.



\### `README.md`



\# bf42lite



> \*\*A simplified LAN multiplayer FPS inspired by Battlefield 1942.\*\* > \*Built with TypeScript (Client Physics), Three.js (Rendering), and Rust (Server Authority).\*



\## Vision



\*\*bf42lite\*\* is designed for fast, consistently readable LAN parties. It prioritizes \*\*gameplay stability\*\* and \*\*instant feedback\*\* over graphical fidelity.



\* \*\*Genre:\*\* Local / LAN Multiplayer FPS

\* \*\*Players:\*\* 2–12 (Optimized for 2–4)

\* \*\*Architecture:\*\* Hybrid Authority (Client Prediction + Server Reconciliation)



\## Architecture: Hybrid Authority



Unlike typical web games, `bf42lite` uses a strict separation of concerns to ensure high-performance networking:



1\.  \*\*Client (TS):\*\* Runs continuous physics for movement and aiming. It predicts results instantly (0ms latency feel).

2\.  \*\*Server (Rust):\*\* The "Referee." It maintains the authoritative state, validates hits, manages health/tickets, and reconciles divergent client states.

3\.  \*\*Shared Protocol:\*\* Both sides speak a strict binary protocol defined in `packages/protocol`.



\## Repository Structure



This is a monorepo managed by \*\*pnpm\*\*.



bf42lite/

├── apps/

│   └── client-tauri/      # THE GAME (Three.js Renderer, Input Handling, UI)

├── src-tauri/             # THE SERVER (Rust Authority, Hit Validation, State)

├── packages/

│   ├── sim/               # SHARED BRAIN (Pure TS ECS, Physics logic - No Rendering)

│   ├── protocol/          # THE LAW (Zod Schemas, Message Types)

│   ├── net/               # THE WIRE (Transport adapters, Interpolation helpers)

│   └── common/            # UTILITIES (Math, Constants)

└── docs/                  # DOCUMENTATION (Architecture \& Design definitions)



\## Quick Start



\### Prerequisites



&nbsp; \* \*\*Node.js\*\* (v18+)

&nbsp; \* \*\*pnpm\*\* (`npm install -g pnpm`)

&nbsp; \* \*\*Rust\*\* (latest stable)



\### Installation



```bash

\# 1. Clone the repo

git clone \[https://github.com/PontusFalkman/bf42lite.git](https://github.com/PontusFalkman/bf42lite.git)

cd bf42lite



\# 2. Install dependencies (for all packages)

pnpm install

```



\### Running the Game



Since the Host is embedded in the Rust backend (Phase 2+), you just need to run the Tauri app.



```bash

\# Run the development build (Hot Reloading enabled)

pnpm tauri dev

```



&nbsp; \* \*\*Host a Match:\*\* Click "Host" in the main menu (starts the internal Rust server).

&nbsp; \* \*\*Join a Match:\*\* Enter the Host's LAN IP and click "Join".



\## Documentation



Detailed design documents are located in the \[`docs/`](./docs) folder:



&nbsp; \* \[\*\*Vision \& Core Goals\*\*] - The "Why" and "What".

&nbsp; \* \[\*\*Gameplay Design\*\*] - Classes, weapons, and modes.

&nbsp; \* \[\*\*Simulation Architecture\*\*] - How the ECS and Hybrid Authority work.

&nbsp; \* \[\*\*Network Protocol\*\*] - Binary message specifications.

&nbsp; \* \[\*\*Development Backlog\*\*] - Current progress and phase checklists.



\## Contributing



1\.  \*\*Logic goes in `packages/sim`:\*\* If it affects how players move or interact, it belongs here.

2\.  \*\*Visuals go in `apps/client-tauri`:\*\* If it's just for show (particles, models), it belongs here.

3\.  \*\*Validation goes in `src-tauri`:\*\* If it prevents cheating or syncing errors, it belongs here.



-----



\*Updated for v1.3 Docs\*

