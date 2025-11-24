// apps/client-tauri/src-tauri/src/lib.rs

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

mod sim;
mod network;
mod player;
mod protocol;
mod systems;
pub mod maps;

use crate::sim::SimState;
use crate::protocol::ClientMessage;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Shared state between the sim loop and the websocket server
    let sim = Arc::new(Mutex::new(SimState::new()));
    let inputs = Arc::new(Mutex::new(HashMap::<u32, ClientMessage>::new()));

    tauri::Builder::default()
        .setup(move |_app| {
            // --- SIMULATION TICK LOOP (authoritative conquest logic) ---
            let sim_for_loop = sim.clone();
            let inputs_for_loop = inputs.clone();

            tauri::async_runtime::spawn(async move {
                use tokio::time::sleep;

                let mut last = Instant::now();

                // Simple fixed tick ~20 Hz
                loop {
                    let now = Instant::now();
                    let dt = now.duration_since(last).as_secs_f32();
                    last = now;

                    {
                        let mut sim_guard = sim_for_loop.lock().unwrap();
                        let inputs_guard = inputs_for_loop.lock().unwrap();
                        // This runs movement, combat and conquest, and builds a TickSnapshot.
                        // Network code will call update() again when needed, that is fine for now.
                        sim_guard.update(dt, &*inputs_guard);
                    }

                    sleep(Duration::from_millis(50)).await;
                }
            });

            // --- WEBSOCKET SERVER (clients connect here) ---
            let sim_for_net = sim.clone();
            let inputs_for_net = inputs.clone();

            tauri::async_runtime::spawn(async move {
                if let Err(e) =
                    network::start_server("127.0.0.1:8080", sim_for_net, inputs_for_net).await
                {
                    eprintln!("[NET] WebSocket server error: {e}");
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
