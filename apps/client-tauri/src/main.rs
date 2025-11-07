// This line MUST be at the top to include your sim.rs file
mod sim;

// Import the world, state, and systems from your sim module
use sim::{WorldState, input_system, movement_system, game_mode_system};

#[tauri::command]
fn step_tick(mut world: WorldState) -> WorldState {
    // --- Run all your Rust systems in order ---
    
    // 1. Run Input System
    //    (Reads from Input component, writes to Velocity/Transform)
    input_system(&mut world);

    // 2. Run Movement System
    //    (Reads from Velocity, writes to Transform)
    movement_system(&mut world);

    // 3. Run Game Mode System
    //    (Checks tickets, updates game phase)
    game_mode_system(&mut world);
    
    // 4. Run Stat System (This will be the next step)
    // player_stat_system(&mut world);
    
    // Return the modified world state back to JavaScript
    world
}

fn main() {
    tauri::Builder::default()
        // --- Add your new 'step_tick' command ---
        .invoke_handler(tauri::generate_handler![
            step_tick
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}