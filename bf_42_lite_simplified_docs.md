bf42lite Simplified Modular Docs (v1.3)
Updated for: Client-Predicted, Server-Reconciled Hits
Focus: LAN gameplay (no anti-cheat, but full consistency)
1. Vision & Core Goals

Project: bf42lite
Genre: LAN / Local Multiplayer FPS
Inspiration: Battlefield 1942
Players: 2–12 (MVP: 2–4)
Platforms: Windows (primary), Linux (AppImage), macOS (later)
Engine Stack: JS/TS (Client Physics) + Three.js + Tauri + Rust (Server State)

Vision:
Deliver fast and responsive LAN battles with smooth movement, readable visuals, and consistent state.
Use Client Authority for movement and aiming, while the server ensures consistent results for health, tickets, and confirmed hits.

Core Principles:

Client controls continuous physics (movement, aiming).

Server controls all discrete game rules (health, kills, scores).

Hits feel instant (client prediction) but are reconciled by the server so all players see the same outcome.

Minimal setup: single host, quick join.

2. Gameplay Design
Core Loop

Host or join → Spawn → Move, shoot, capture flags → Die and respawn → Tickets or time expire.

Modes
Mode	Description	Phase
Conquest	Hold control points to drain enemy tickets.	4+
Team DM	Eliminate enemies; tickets = respawns.	4+
Sandbox	Physics/weapons testing.	2+
Classes (Later)

Assault, Engineer, Support, Recon (light roles only).

Weapons (Phases 2–4)

Rifle, SMG, Sniper, Grenade.

Maps

Warehouse (MVP)

Island (Phase 5)

3. Simulation Architecture (Hybrid Authority)

The architecture explicitly avoids cross-language determinism by splitting continuous vs. discrete responsibilities.

Authority Split
Feature	Authority	Location	Reason
Movement Physics	Client	packages/sim (TS)	Instant input response.
Collision (visual)	Client	TS	Immediate feedback.
Hit Detection (final)	Server	Rust	Ensures both players see the same result.
Health/Death	Server	Rust	Centralized game rules.
Scoring/Tickets	Server	Rust	Consistent match flow.
Rate Limits	Server	Rust	Prevents accidental spam.
Hit Model: Predict + Reconcile

Client

Performs raycast.

Shows hit spark / marker immediately.

Sends a fire proposal:

{ type: "fire", origin, direction, weaponId, clientTick }


Server

Re-runs the raycast using authoritative positions.

Confirms if the hit is valid.

Computes damage.

Broadcasts a final event:

{ type: "hitConfirmed", shooterId, targetId, damage }


This avoids “I was behind cover on my screen” even on LAN.

Determinism Rules

Client runs fixed timestep (1/60).

Server stores authoritative transforms from client reports.

Server validates movement with simple checks (max speed, max teleport).

Server performs only discrete logic (health, respawns, tickets).

4. Networking Protocol
Transport

UDP: State updates (positions, rotations).

TCP/WebSocket: Reliable events (joins, hits, killfeed, system messages).

Message Structure

Client → Server

State Update:
{ type: 'update', x, y, z, yaw }

Fire Proposal:
{ type: 'fire', origin, direction, weaponId, clientTick }

Actions:
{ type: 'respawn', classId }, etc.

Server → Client

Snapshot:
{ type: 'snapshot', entities: [...], scores, tickets }

Hit Confirmation:
{ type: 'hitConfirmed', shooterId, targetId, damage }

Death Event:
{ type: 'death', victimId, killerId }

Encoding

msgpackr for binary transport

zod schemas for strict validation (packages/protocol)

Snapshot Rate

Target: 10–20 Hz snapshots, client interpolates to 60 FPS.

5. Client Rendering
Tech

Three.js + React overlay.

Interpolation

Local player: Immediate (predicted).

Remote players: Interpolated between last two snapshots for smoothness.

Visual Style

Low-poly, flat shading, readable silhouettes.
Target 60 FPS on basic GPUs/APUs.

6. Development Backlog (Phases)

Current: Phase 4 — Core Gameplay & Hit Reconciliation

Phase	Goal	Deliverables
1	Core MVP	Movement, ECS loop, glTF models
2	LAN Loopback	Host/join, basic messages
3	Visual Polish	Camera, HUD, map
4	Core Gameplay	Shooting, hit reconcile, death/respawn, tickets
5	Expansion	Vehicles, Island map, class roles
Phase 4 Acceptance Criteria

 Player movement is smooth on other clients via interpolation.

 Client proposes fire; server validates and confirms hits.

 Server applies damage, death, respawn logic.

 Tickets drain reliably and reach Game Over state.

7. Infrastructure & Repo Layout
bf42lite/
├─ apps/
│  └─ client-tauri/     # Renderer, client physics
├─ packages/
│  ├─ sim/              # Physics, movement, shared types
│  ├─ net/              # Networking helpers
│  ├─ protocol/         # Binary schemas
│  ├─ host-node/        # Dev-only host
│  └─ common/           # Shared utilities
├─ src-tauri/           # Rust Host (state, validation, relay)
├─ assets/
│  └─ tuning/           # Weapon + gameplay configs
└─ docs/                # Modular documentation

Conventions

Client handles continuous math.

Server handles discrete logic and final truth.

Protocol strictly defines the contract.

End of v1.4