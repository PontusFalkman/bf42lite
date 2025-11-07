### bf42lite Simplified Modular Docs (v1.2)

---

## 1. Vision & Core Goals

**Project:** bf42lite
**Genre:** LAN / Local Multiplayer FPS
**Inspiration:** *Battlefield 1942*
**Perspective:** First-person
**Players:** 2–12 (MVP: 2–4)
**Platforms:** Windows (primary), Linux (AppImage), macOS (later)
**Engine Stack:** JS/TS + Three.js + bitecs ECS + Tauri (Rust bridge later)

**Vision:**
Deliver fast, deterministic LAN battles with readable visuals, modular systems, and stable netcode.
Prioritize predictability, clarity, and cross-language parity (JS ↔ Rust).

**Core Principles:**

* Deterministic 60 Hz tick.
* Modular ECS and protocol separation.
* Rust-ready simulation backend.
* Minimal setup: single binary host/join.

**Phase Roadmap:**

1. Local ECS + Renderer
2. LAN Loopback
3. Visual Polish
4. Core Gameplay (Combat, Rust Tick)
5. Expansion (Vehicles, Gadgets, Dedicated Host)

---

## 2. Gameplay Design

**Core Loop:**
Host or join → Select class/spawn → Move, shoot, capture → Die and respawn → Repeat until tickets/time expire.

**Game Modes:**

| Mode            | Description                                | Phase |
| --------------- | ------------------------------------------ | ----- |
| Conquest        | Capture/hold control points; drain tickets | 4+    |
| Team Deathmatch | Eliminate enemies; respawn tickets         | 4+    |
| Sandbox         | Physics/weapons testing                    | 2+    |

**Classes (Phase 3+):**

| Class    | Role         | Traits              |
| -------- | ------------ | ------------------- |
| Assault  | Frontline    | Med pen, grenade    |
| Engineer | Anti-vehicle | Repair tool, rocket |
| Support  | Resupply     | Ammo box, LMG       |
| Recon    | Scouting     | Sniper, spot/ping   |

**Weapons (Phase 2–4):**

| Weapon  | Type         | Traits                  |
| ------- | ------------ | ----------------------- |
| Rifle   | Medium range | Moderate recoil         |
| SMG     | Close range  | High ROF                |
| LMG     | Support      | Heavy recoil, large mag |
| Sniper  | Long range   | High damage, low ROF    |
| Grenade | Throwable    | Area damage             |

**Maps:**

| Map       | Style                 | Size   | Phase |
| --------- | --------------------- | ------ | ----- |
| Warehouse | Industrial interior   | Small  | 1–3   |
| Island    | Shoreline + elevation | Medium | 5 +   |

---

## 3. Simulation Module

### 3.1 Architecture

**Framework:**

* `bitecs` ECS in `/packages/sim`.
* Future: `hecs` / `legion` Rust ports.

**Core Components:**
`Transform {x,y,z}`, `Velocity {x,y,z}`, `InputAxis {forward,right,jump}`
Later: `Health`, `Weapon`, `Projectile`, `Team`, `Score`.

**Core Systems:**
Movement → Shooting → Damage → Respawn → Tickets

**Determinism:**

* Fixed `dt = 1/60` s.
* No `Math.random()`. Use tick-seeded RNG.
* Reproducible results from input + seed.

**Simulation Interface:**

```ts
function step(world, dt): void
```

Later Rust:

```rust
fn step(world_state: &mut WorldState, dt: f32)
```

**Boundaries:**

* `/packages/sim`: ECS only.
* `/packages/net`: Transport/adapters only.
* `/packages/protocol`: Schemas/versioning.
* `/apps/client-tauri`: Rendering + input + HUD.

---

### 3.2 Movement System

**Purpose:**
Deterministic player locomotion identical in JS and Rust.

**Components:**

```ts
Transform {x,y,z}
Velocity  {x,y,z}
InputAxis {forward,right,jump}
```

**Tick Logic (`dt = 1/60`):**

```ts
Velocity.x = InputAxis.right * SPEED
Velocity.z = -InputAxis.forward * SPEED
Transform += Velocity * dt
Transform.y = 0
```

**Constants:**

| Param    | Value | Description      |
| -------- | ----- | ---------------- |
| SPEED    | 3 u/s | Walk speed       |
| GRAVITY  | 9.81  | Reserved         |
| FRICTION | 0.8   | Phase 2+ damping |

Quantize inputs if needed.
Use fixed dt regardless of frame time.

**Future Extensions:**
Phase 2 – Jump/Fall
Phase 3 – Sprint/Stamina
Phase 4 – Capsule Collision

---

### 3.3 Weapons System

**Purpose:**
Deterministic firing, damage, and death events.

**Components:**

```ts
Weapon { fireRate, cooldown, damage }
Health { current, max }
Projectile (later) {pos,dir,speed,ttl}
```

**Flow (Hitscan MVP):**

1. Client sends “fire” input.
2. Host checks `Weapon.cooldown <= 0`.
3. Perform hitscan.
4. Apply damage if hit.
5. Reset cooldown = 1 / fireRate.
6. Each tick → `cooldown -= dt`.

**Death:**

```ts
if (Health.current <= 0) trigger death/respawn
```

**Determinism:**
All recoil/spread use seeded RNG per tick.
No wall-clock dependency.

---

## 4. Networking Module

### 4.1 Protocol

**Purpose:**
Binary messages shared across JS and Rust.

**Encoding:** `msgpackr`
**Validation:** `zod` schemas

**Message Types:**

```ts
InputMsg = { type:"input", tick, axes:{forward,right,jump} }
StateMsg = { type:"state", tick, entities:[EntitySnapshot] }
EventMsg = { type:"event", tick, eventType, payload }
```

**Rules:**

* Add protocol version field.
* Schema changes additive.

---

### 4.2 Transport & Topology

**Phase 2 Model:**

* Embedded host inside same binary.
* Clients connect via WebSocket LAN.
* Later: Rust UDP / WebRTC.

**Rates:**

* Sim tick: 60 Hz
* Snapshot broadcast: 30 Hz
* Inputs: per tick or bundled

**Reliability:**

* WebSocket → ordered, reliable.
* Client predicts, host reconciles.
* Simple rewind/replay correction.

**Targets:**

| Metric        | Goal          |
| ------------- | ------------- |
| RTT (LAN)     | ≤ 5 ms        |
| Snapshot size | ≤ 5 KB/player |
| Desync rate   | ≤ 1 per 30 s  |

---

## 5. Client Module

**Renderer:** Three.js
**Scene:** Directional + ambient light, low-poly meshes.
**Target:** 1080p @ 120 fps.

**Camera:**

* First-person or chase view.
* Smooth lerp/spring follow.
* Pointer lock mouse look.

**HUD:**
Crosshair | Health | Ammo | FPS | RTT

**Input Mapping:**
Keyboard → WASD, Space jump, Shift sprint
Mouse → Look + Left click fire
Browser events → ECS InputAxis + buttons

---

## 6. Backlogs (Phases 1–5)

### Phase 1 – Core MVP

**Scope:** Local movement + rendering; no networking.
**Tasks:**

| ID                                                              | Task            | Output                         |
| --------------------------------------------------------------- | --------------- | ------------------------------ |
| M1                                                              | Workspace setup | pnpm builds without errors     |
| C1                                                              | Renderer        | Visible cube                   |
| C2                                                              | Input system    | WASD + pointer lock            |
| C3                                                              | ECS world       | Transform, Velocity, InputAxis |
| C4                                                              | Movement system | Cube moves via ECS             |
| C5                                                              | HUD (FPS)       | FPS overlay                    |
| **Acceptance:** No errors, smooth ECS movement, 120 fps stable. |                 |                                |

---

### Phase 2 – LAN Loopback

**Scope:** Embedded host + WebSocket LAN.
**Tasks:**

| ID                                                                                    | Task                  | Output                        |
| ------------------------------------------------------------------------------------- | --------------------- | ----------------------------- |
| N1                                                                                    | LoopbackAdapter       | Local client ↔ host pipeline  |
| N2                                                                                    | WebSocket server      | 2–4 clients                   |
| N3                                                                                    | Snapshot broadcast    | 30 Hz state deltas            |
| N4                                                                                    | Client reconciliation | Input buffering + corrections |
| N5                                                                                    | Ping/RTT display      | HUD RTT indicator             |
| N6                                                                                    | Host/Join UI          | Basic LAN menu                |
| **Acceptance:** 2 PCs LAN control independent entities; RTT ≤ 5 ms; no rubberbanding. |                       |                               |

---

### Phase 3 – Visual Polish

**Scope:** Graphics & UX refinement.
**Tasks:**

| ID                                                               | Task             | Output                  |
| ---------------------------------------------------------------- | ---------------- | ----------------------- |
| V1                                                               | Player mesh      | Low-poly soldier        |
| V2                                                               | Warehouse map    | Walls/floor/cover       |
| V3                                                               | Lighting         | Baked/simple runtime    |
| V4                                                               | HUD expansion    | Health, ammo, crosshair |
| V5                                                               | Camera smoothing | Lerp/spring             |
| V6                                                               | Spawn UI         | Countdown screen        |
| **Acceptance:** Loads < 3 s; 1080p @ 120 fps; clear UI feedback. |                  |                         |

---

### Phase 4 – Core Gameplay

**Scope:** Combat loop + Rust tick.
**Tasks:**

| ID                                                                                            | Task              | Output                    |
| --------------------------------------------------------------------------------------------- | ----------------- | ------------------------- |
| G1                                                                                            | Health + damage   | Health component          |
| G2                                                                                            | Weapon fire       | Hitscan shooting          |
| G3                                                                                            | Death & respawn   | Death events + respawn    |
| G4                                                                                            | Tickets & scoring | Conquest/TDM rules        |
| G5                                                                                            | Rust tick bridge  | Tauri command `step_tick` |
| **Acceptance:** Full match flow spawn→fight→end; JS = Rust results; headless Rust mode works. |                   |                           |

---

### Phase 5 – Expansion

**Scope:** Advanced mechanics + scaling.
**Tasks:**

| ID                                                                                       | Task              | Output                         |
| ---------------------------------------------------------------------------------------- | ----------------- | ------------------------------ |
| X1                                                                                       | Sprint + stamina  | Movement state machine         |
| X2                                                                                       | Gadgets           | Ammo box, med kit, repair tool |
| X3                                                                                       | Grenades          | Projectile arc + explosion     |
| X4                                                                                       | Ping/spot system  | Team markers                   |
| X5                                                                                       | Vehicle prototype | Simple jeep physics            |
| X6                                                                                       | Dedicated server  | Headless host (Rust/Node)      |
| **Acceptance:** 12-player LAN stable ≥ 30 min; feature flags; CI tests both host/client. |                   |                                |

---

## 7. Infrastructure & Repo Structure

**Layout:**

```
bf42lite/
├─ apps/
│  └─ client-tauri/     # Renderer + UI
├─ packages/
│  ├─ sim/              # ECS systems
│  ├─ net/              # Networking adapters
│  ├─ protocol/         # Message schemas
│  ├─ host-node/        # Node or Rust host
│  └─ common/           # Shared utils
├─ assets/
│  └─ tuning/           # JSON configs
└─ docs/                # Modular documentation
```

**Conventions:**

* One system per file in `/sim`.
* No DOM logic in sim.
* Protocol owns schemas; net transports only.
* Tune via JSON, not hard-coded values.

**Commit Rules:**

1. `pnpm lint` + `pnpm build` pass.
2. Maintain ≥ 120 fps through Phase 3.
3. Networking RTT and desync within phase targets.
4. Merge only after phase acceptance met.

---

### End of bf42lite Simplified Docs (v1.2)

Each numbered module (1 → 7) can be isolated and edited per session while remaining context-safe for GPT-5.
