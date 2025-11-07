bf42lite
A simple LAN/local multiplayer first-person shooter inspired by Battlefield 1942, built with a modern TypeScript ECS stack.

How to Run
This project is a pnpm workspace.

Install Dependencies From the root bf42lite/ directory, run:

Bash

pnpm install
Run the Dev Servers This command will start both the client (Vite) and the host (Node) servers in parallel:

Bash

pnpm dev
Play

The host server will run at ws://localhost:8080.

The client is available at http://localhost:5173.

Tech Stack
Client (apps/client-tauri):

Renderer: three.js

Simulation: bitecs (ECS)

Dev Server: Vite

Server (packages/host-node):

Runtime: Node.js / tsx

Networking: ws (WebSockets)

Networking (packages/net & packages/protocol):

Protocol: msgpackr for binary encoding and zod for validation.

Adapters: WebSocketAdapter for network play and LoopbackAdapter for local testing.

Documentation
All project documentation, including the Game Design Document (GDD) and Technical Design, is located in the /docs folder.
