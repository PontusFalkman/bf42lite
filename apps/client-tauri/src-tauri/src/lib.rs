// This file is intentionally empty for the v1.3 Client Container.
// All game logic is currently handled in TypeScript or the Node.js Host.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}