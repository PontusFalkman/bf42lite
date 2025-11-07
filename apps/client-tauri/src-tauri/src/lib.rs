use serde::{Deserialize, Serialize};

// --- RUST BRIDGE STRUCTS ---
// These match the TypeScript interfaces in src/main.ts
#[derive(Debug, Serialize, Deserialize, Clone)]
struct RustEntity {
  id: u32,
  transform: TransformComponent,
  velocity: VelocityComponent,
  health: HealthComponent,
  team: TeamComponent,
  stats: PlayerStatsComponent,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct TransformComponent {
  x: f32, y: f32, z: f32, yaw: f32, pitch: f32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct VelocityComponent {
  x: f32, y: f32, z: f32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct HealthComponent {
  current: u32, max: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct TeamComponent {
  id: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct PlayerStatsComponent {
  kills: u32, deaths: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct WorldState {
  entities: Vec<RustEntity>,
}
// --- END STRUCTS ---

// Simulation constants
const FIXED_DT: f32 = 1.0 / 60.0; // 60hz step

// --- TAURI COMMAND (with movement logic) ---
#[tauri::command]
async fn step_tick(mut world: WorldState) -> Result<WorldState, String> {
    // Implement the actual client-side prediction logic here:
    for entity in &mut world.entities {
        // Apply simple Euler integration (P = P + V * dt)
        entity.transform.x += entity.velocity.x * FIXED_DT;
        // Gravity (or lack thereof) is handled on the server, but client must predict Y as well
        entity.transform.y += entity.velocity.y * FIXED_DT;
        entity.transform.z += entity.velocity.z * FIXED_DT;
        
        // Note: Rotation (yaw/pitch) is client-authoritative and already in the transform.
    }
    
    // Return the updated world state to the TypeScript client for rendering
    Ok(world)
}
// --- END TAURI COMMAND ---

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
    // NOTE: Command registration is already here from previous steps
    .invoke_handler(tauri::generate_handler![step_tick])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}