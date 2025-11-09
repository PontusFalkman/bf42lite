use serde::{Deserialize, Serialize};

// --- 1. STRUCTS TO MATCH main.ts ---
// These must match the TypeScript interfaces

#[derive(Debug, Serialize, Deserialize, Clone)]
struct RustTransform {
    x: f32,
    y: f32,
    z: f32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct RustHealth {
    current: f64, // Use f64 to match JS 'number'
    max: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct RustStamina {
    current: f64,
    max: f64,
    regen_rate: f64,
    drain_rate: f64,
}

// This is the 'EntitySnapshot' from main.ts
#[derive(Debug, Serialize, Deserialize, Clone)]
struct RustEntity {
    eid: u32,
    transform: RustTransform,
    health: Option<RustHealth>,
    stamina: Option<RustStamina>,
}

// This is the 'WorldSnapshot' from main.ts
type WorldSnapshot = Vec<RustEntity>;

// This is the 'InputPayload' from main.ts
#[derive(Debug, Serialize, Deserialize, Clone)]
struct Inputs {
    forward: f64,
    right: f64,
    jump: bool,
    fire: bool,
    sprint: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct InputPayload {
    tick: u32,
    inputs: Inputs,
}

// --- 2. THE MISSING init_sim COMMAND ---
#[tauri::command]
fn init_sim() -> RustEntity {
    // Create and return the initial player entity
    RustEntity {
        eid: 1, // The local player EID
        transform: RustTransform {
            x: 0.0,
            y: 2.0,
            z: 0.0,
        },
        health: Some(RustHealth {
            current: 100.0,
            max: 100.0,
        }),
        stamina: Some(RustStamina {
            current: 100.0,
            max: 100.0,
            regen_rate: 10.0,
            drain_rate: 20.0,
        }),
    }
}

// --- 3. THE CORRECT step_tick COMMAND ---
#[tauri::command]
fn step_tick(payload: InputPayload) -> WorldSnapshot {
    // --- THIS IS WHERE YOUR GAME LOGIC WILL GO ---
    // For now, just print the input and return a dummy player state.
    
    // Log the input (you'll see this in the 'cargo' terminal)
    println!("Tick {}: Inputs: {:?}", payload.tick, payload.inputs);

    // Create a dummy entity for the snapshot
    let mut player_entity = init_sim(); // Get the base player
    
    // In a real game, you would apply physics, etc.
    // Here we just modify its position based on input
    if payload.inputs.forward > 0.0 {
        player_entity.transform.z -= 0.1; // Move forward
    }
    if payload.inputs.forward < 0.0 {
        player_entity.transform.z += 0.1; // Move back
    }

    // Return a snapshot containing only our player
    vec![player_entity]
}

// --- 4. THE APP RUNNER ---
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        // REGISTER BOTH COMMANDS
        .invoke_handler(tauri::generate_handler![init_sim, step_tick])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}