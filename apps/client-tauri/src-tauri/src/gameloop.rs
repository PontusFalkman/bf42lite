// apps/client-tauri/src-tauri/src/gameloop.rs

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tokio::time::sleep;

use crate::sim::{SimState, ClientMessage};

pub async fn run(
    sim_state: Arc<Mutex<SimState>>, 
    inputs_state: Arc<Mutex<HashMap<u32, ClientMessage>>>
) {
    let tick_rate = Duration::from_millis(16); // ~60 FPS
    
    loop {
        let start = Instant::now();
        {
            // Lock state
            let mut sim = sim_state.lock().unwrap();
            let mut inputs = inputs_state.lock().unwrap();
            
            // Update Physics
            sim.update(0.016, &inputs); 

            // Clear "Delta" inputs (mouse movement) after processing
            for msg in inputs.values_mut() {
                msg.2 = 0.0; // Reset dx
                msg.3 = 0.0; // Reset dy
            }
        }
        
        // Sleep to maintain steady tick rate
        let elapsed = start.elapsed();
        if elapsed < tick_rate {
            sleep(tick_rate - elapsed).await;
        }
    }
}