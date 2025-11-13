// apps/client-tauri/src-tauri/src/lib.rs

// === 1. Register the Modules ===
// This allows the library to see the files we created.
pub mod protocol;
pub mod player;
pub mod systems;
pub mod sim;
pub mod gameloop;
pub mod network;

// === 2. Standard Tauri Entry Point ===
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  // Note: Your main.rs handles the real logic now, but this 
  // must still compile for the build to succeed.
  tauri::Builder::default()
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}