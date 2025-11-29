===========================================================
                    BF42LITE – ARCHITECTURE
         (Where We Started → Where We Are → v1.0 Goal)
===========================================================


───────────────────────────────────────────────────────────
1. WHERE WE STARTED (Early Prototypes)
───────────────────────────────────────────────────────────

                   ┌──────────────────────────┐
                   │     CLIENT (TS)          │
                   │  - movement logic        │
                   │  - prediction             │
                   │  - interpolation          │
                   │  - rendering              │
                   │  ALL in one place         │
                   └────────────┬─────────────┘
                                │
                                │ (mixed logic)
                                ▼
                   ┌──────────────────────────┐
                   │  SERVER (Rust/Tauri)     │
                   │  - minimal movement      │
                   │  - basic combat          │
                   │  - hardcoded flags/maps  │
                   │  tightly coupled to UI   │
                   └──────────────────────────┘

       • Hard-coded gameplay rules everywhere  
       • Duplicate logic in TS + Rust  
       • No engine/game separation  
       • No package boundaries  
       • Legacy TS network code still in tree  



───────────────────────────────────────────────────────────
2. WHERE WE ARE NOW (v0.4 Modular Client Baseline)
───────────────────────────────────────────────────────────

               ┌────────────────────────────────────┐
               │           MONOREPO ROOT             │
               │  packages/   apps/   src-tauri/     │
               └──────────────────┬──────────────────┘
                                  │
                                  │
     ┌────────────────────────────┴────────────────────────────┐
     │                     TYPESCRIPT SIDE                     │
     └─────────────────────────────────────────────────────────┘

     packages/
     ┌────────────────────────────────────────────────────────┐
     │ @bf42lite/protocol    -> shared message schemas        │
     │ @bf42lite/net         -> WS/Tauri network adapters     │
     │ @bf42lite/engine-core -> generic ECS utilities         │
     │ @bf42lite/games-bf42  -> BF42 components/constants     │
     │ @bf42lite/sim         -> TS prediction sim (bitecs)    │
     └────────────────────────────────────────────────────────┘

     apps/client-tauri/
     ┌────────────────────────────────────────────────────────┐
     │ ClientGame (orchestrator)                              │
     │ Systems: prediction, interpolation, reconciler          │
     │ Renderer: Three.js scene, models, flags                 │
     │ Managers: InputManager, UIManager, NetworkManager       │
     │ HUDUpdater: single HUD authority                        │
     │ WorldRender: ECS → render state                         │
     └────────────────────────────────────────────────────────┘

                                  │
                                  ▼

     ┌─────────────────────────────────────────────────────────┐
     │                    RUST SIDE (Server)                   │
     └─────────────────────────────────────────────────────────┘

     src-tauri/
     ┌────────────────────────────────────────────────────────┐
     │ Server tick loop                                        │
     │ systems/movement.rs                                     │
     │ systems/combat.rs                                       │
     │ systems/conquest.rs                                     │
     │ maps/warehouse.rs                                       │
     │ snapshot.rs (TickSnapshot builder)                      │
     │ player.rs / game_state.rs                               │
     └────────────────────────────────────────────────────────┘

     • Server authoritative over:                             
       movement, combat, flags, tickets, respawn, match end   
     • Client predicts & reconciles                            
     • Snapshots drive rendering                               


───────────────────────────────────────────────────────────
3. WHERE WE ARE GOING (v1.0 Target Architecture)
───────────────────────────────────────────────────────────

                      ┌─────────────────────────────┐
                      │      CONFIG ASSETS          │
                      │  maps/*.toml                │
                      │  gamemodes/*.toml           │
                      │  weapons/*.toml             │
                      │  classes/*.toml             │
                      │  movement.toml              │
                      └───────────────┬─────────────┘
                                      │  (data-driven)
                                      ▼

────────────────────────────── Rust Side ───────────────────────────────

crates/
┌───────────────────────────┬──────────────────────────────────────────┐
│  engine (WASM-ready)      │  game-bf42 (rules)                       │
│  - ECS core               │  - Conquest rules                        │
│  - math                   │  - Weapon configs                        │
│  - physics                │  - Movement parameters                   │
│  - WASM bindings          │  - Map loading                           │
└───────────────────────────┴──────────────────────────────────────────┘
                │  native
                │
                │ WASM
                ▼
        ┌────────────────────────────────────────┐
        │      CLIENT USES RUST SIM VIA WASM     │
        │     (prediction + reconciliation)       │
        └────────────────────────────────────────┘


────────────────────────── TS Side (Final Form) ───────────────────────

packages/
┌─────────────────────────────────────────────────────────────────────┐
│ @bf42lite/protocol   → types only                                   │
│ @bf42lite/net        → transport adapters                            │
│ @bf42lite/engine-core→ rendering helpers, TS ECS glue               │
│ @bf42lite/games-bf42 → client-side components & visuals              │
│ @bf42lite/sim        → becomes WASM wrapper over Rust sim            │
└─────────────────────────────────────────────────────────────────────┘

client-tauri/
┌─────────────────────────────────────────────────────────────────────┐
│ UI, HUD, settings, Three.js renderer                                │
│ ClientGame orchestrates WASM sim + Renderer + Systems               │
│ No gameplay rules hardcoded                                         │
└─────────────────────────────────────────────────────────────────────┘


───────────────────────────────────────────────────────────
4. FLOW SUMMARY
───────────────────────────────────────────────────────────

                  SERVER (RUST)
             (authoritative simulation)
                         │
                         │ snapshots @ tick
                         ▼
       CLIENT (TS + RUST/WASM sim for prediction)
                         │
                         │ input @ 30Hz
                         ▼
                  SERVER (RUST)

Prediction → Reconciliation → Interpolation → Rendering  
All gameplay rules resolved via **data configs**, not hardcoded.


───────────────────────────────────────────────────────────
5. LONG-TERM EXTENSION LAYER
───────────────────────────────────────────────────────────

Vehicles │ AI bots │ New maps │ Game modes │ Zombie faction │ Spotting │ UI Themes  
All plug into the **game crate** + config files,  
NOT into the engine or the renderer.


===========================================================
END OF ASCII ARCHITECTURE OVERVIEW
===========================================================
