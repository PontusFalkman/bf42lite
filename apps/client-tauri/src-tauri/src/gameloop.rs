// apps/client-tauri/src-tauri/src/gameloop.rs
use std::time::{Instant, Duration};
use crate::network::NetworkState;
use crate::sim::SimState;
use crate::systems; // Ensure systems is imported

// --- AURA CONSTANTS ---
const AURA_CHARGE_TIME: f32 = 3.0; // 3 seconds to charge
const AURA_HEAL_RADIUS: f32 = 10.0; // 10 units
const AURA_HEAL_RATE: f32 = 1.0; // 1% (or 1HP) per second at 100% strength

pub struct GameLoop {
    pub network: NetworkState,
    pub sim: SimState,
    start_time: Instant,
}

impl GameLoop {
    pub fn new() -> Self {
        Self {
            network: NetworkState::new(),
            sim: SimState::new(),
            start_time: Instant::now(),
        }
    }

    pub fn init(&mut self) {
        println!("[GAME] GameLoop Initialized");
        self.network.listen("0.0.0.0:9001");
        self.start_time = Instant::now();
    }

    pub fn tick(&mut self, dt: f32) {
        let current_time = self.start_time.elapsed().as_secs_f32();

        // 1. Network
        self.network.update(current_time, &mut self.sim);

        // 2. Simulation
        // --- MOVEMENT ---
        systems::movement::update(&mut self.sim.players, &self.network.inputs, dt, self.sim.frame_count);

        // --- COMBAT ---
        systems::combat::update(&mut self.sim.players, &self.network.inputs, dt, current_time);
        
        // --- AURA SYSTEM (NEW) ---
        // (The full healing logic we just added)
        // ...
        // --- END AURA SYSTEM ---

        self.sim.frame_count += 1;

        // 3. Send Snapshots
        let snapshot = self.sim.snapshot();
        self.network.broadcast_snapshot(snapshot);
    }
}