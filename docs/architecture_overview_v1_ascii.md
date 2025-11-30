# bf42lite — Architecture Overview (Updated 2025)

This document describes the current architecture of **bf42lite**, reflecting the latest refactors:
- Server-authoritative simulation (Rust)
- Client (TS) as a prediction/visualization layer only
- Config-driven gameplay rules (TOML/JSON)
- Deterministic tick loop
- Snapshot networking model

---

## 1. High-Level Architecture

The game consists of **three main layers**:

1. **Engine-Core (Rust + TS shared schema)**  
   - ECS components (Transform, Velocity, Health, Ammo, Soldier, Team, etc.)  
   - Tick-based deterministic simulation loop  
   - Prediction & reconciliation model  
   - Snapshot schema and message formats (in `@bf42lite/protocol`)

2. **Game Logic Layer (Rust)**  
   - Conquest rules (capture, bleed, tickets, match end, winner)  
   - Weapon damage, firing rules, rpm enforcement  
   - Movement physics (gravity, jump, speed)  
   - Respawns & spawn points  
   - Map geometry (flags, radii, base spawns)

3. **Client (TypeScript)**  
   - Rendering (Three.js + Tauri canvas)  
   - HUD/UI  
   - Crosshair, recoil, view animations  
   - Sound, hitmarkers, screen effects  
   - Input gathering  
   - Prediction + interpolation of entities between snapshots

The **server owns all gameplay truth**.  
The **client only predicts visually** and corrects from snapshots.

---

## 2. Networking Model

### 2.1 Input → Server  
Client sends:
- movement inputs  
- aim direction  
- fire requests  
- class selection  
- spawn requests  

### 2.2 Server Simulation  
Server applies:
- movement physics  
- combat calculations  
- flag capture  
- ticket loss  
- bleeding  
- setting `match_ended` & `winner`

### 2.3 Snapshot → Client  
Server sends snapshots containing:
```ts
{
  tick: number,
  entities: [...],
  game_state: {
     team_a_tickets: number,
     team_b_tickets: number,
     match_ended: boolean,
     winner: 'TEAM_A' | 'TEAM_B' | null
  },
  flags: [...FlagSnapshot...]
}
Client interpolates remote entities and reconciles the local player.

3. Prediction, Reconciliation, Interpolation
Prediction (Client)

Client simulates its own movement frame-to-frame using:

movement config values

local inputs

last known server state

Reconciliation (Client)

On snapshot:

Rewind to server-confirmed position

Re-apply predicted inputs

Correct divergence

Interpolation (Client)

Remote players:

Stored in a small buffer

Interpolated smoothly across snapshots

Never predicted

4. Game Rules Ownership
System	Owner	Notes
Movement physics	Server	Client predicts; server corrects.
Weapon damage	Server	All damage/hits authoritative.
Fire rate enforcement	Server	Cannot fire too quickly client-side.
Conquest ticket rules	Server	Capture, bleed, per-death ticket loss.
Map geometry	Server	Spawn points, flags, radii.
Match start/end	Server	Exported via snapshot.
HUD/UI	Client	Purely render-only.
Crosshair & recoil	Client	Cosmetic only.
Interpolation	Client	Smooth remote entities.
5. Config-Driven Data

game_config.toml contains:

[movement]

[conquest]

[[weapons]]

[[classes]]

Rust loads the config; the client may load it only for prediction/UX.

6. Directory Diagram (Conceptual)
root
├── apps
│   ├── client-tauri (TS)
│   │   ├── src
│   │   │   ├── core/ (renderer, weapon visuals)
│   │   │   ├── systems/ (prediction, interpolation)
│   │   │   ├── ui/ (HUDUpdater, UIManager)
│   │   │   ├── net/ (NetworkManager)
│   │   └── src-tauri/ (Rust server)
│   │       ├── config.rs
│   │       ├── sim.rs
│   │       ├── systems/
│   │       │   ├── conquest.rs
│   │       │   ├── combat.rs
│   │       │   ├── movement.rs
│   │       └── maps/
├── packages
│   ├── protocol
│   └── engine-core
└── docs
