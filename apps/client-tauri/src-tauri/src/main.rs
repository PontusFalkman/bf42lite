// apps/client-tauri/src-tauri/src/main.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::State;

// === MODULES ===
mod protocol; // NEW
mod player;   // NEW
mod systems;  // NEW
mod sim;
mod gameloop; 
mod network; 

use sim::SimState;
use protocol::ClientMessage; // Updated import

struct AppState {
    sim: Arc<Mutex<SimState>>,
    inputs: Arc<Mutex<HashMap<u32, ClientMessage>>>,
}

#[tauri::command]
async fn start_host(state: State<'_, AppState>) -> Result<(), String> {
    let addr = "127.0.0.1:8080";
    println!("Starting Host at ws://{}", addr);

    // Clone references for the threads
    let sim_loop = state.sim.clone();
    let inputs_loop = state.inputs.clone();
    
    let sim_net = state.sim.clone();
    let inputs_net = state.inputs.clone();

    // 1. Spawn the Game Loop (Heartbeat)
    tokio::spawn(async move {
        gameloop::run(sim_loop, inputs_loop).await;
    });

    // 2. Spawn the Network Server (Listener)
    tokio::spawn(async move {
        if let Err(e) = network::start_server(addr, sim_net, inputs_net).await {
            eprintln!("Network server error: {}", e);
        }
    });

    Ok(())
}

fn main() {
    let sim = Arc::new(Mutex::new(SimState::new()));
    let inputs = Arc::new(Mutex::new(HashMap::new()));

    tauri::Builder::default()
        .manage(AppState { sim, inputs })
        .invoke_handler(tauri::generate_handler![start_host])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}