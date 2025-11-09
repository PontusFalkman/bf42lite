// File: apps/client-tauri/src-tauri/src/sim.rs

use serde::{Deserialize, Serialize};

// --- Core Components ---

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Transform {
    pub x: f32,
    pub y: f32,
    pub z: f32,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Velocity {
    pub x: f32,
    pub y: f32,
    pub z: f32,
}

// --- ADD THIS NEW COMPONENT ---
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Rotation {
    pub yaw: f32,
    pub pitch: f32,
}
// --- END OF ADDITION ---

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Health {
    pub current: f32,
    pub max: f32,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Weapon {
    pub fire_rate: f32,
    pub cooldown: f32,
    pub damage: f32,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Stamina {
    pub current: f32,
    pub max: f32,
    pub regen_rate: f32, // How much to regen per second
    pub drain_rate: f32, // How much to drain per second
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Player;

// --- This struct MUST match the 'PlayerInputs' interface in main.ts ---
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct PlayerInputs {
    pub forward: f32, // This is a number (-1 to 1)
    pub right: f32,   // This is a number (-1 to 1)
    pub jump: bool,
    pub fire: bool,
    pub sprint: bool,
    #[serde(default)] // In case JS doesn't send it
    #[serde(rename = "showScoreboard")] // Match JS camelCase 'showScoreboard'
    pub show_scoreboard: bool,
}

// --- Constants ---
pub const SPEED: f32 = 3.0;
pub const SPRINT_SPEED: f32 = 6.0;
pub const TICK_RATE: u32 = 60;
pub const TICK_DT: f32 = 1.0 / TICK_RATE as f32;
pub const MOUSE_SENSITIVITY: f32 = 0.002; // <-- ADD THIS

// --- Data Structures for Tauri ---

// --- This struct MUST match the 'InputPayload' interface in main.ts ---
#[derive(Debug, Clone, Deserialize)]
pub struct InputPayload {
    pub tick: u32,
    pub inputs: PlayerInputs, // Nested object
    // Mouse deltas at the top level
    pub delta_x: f32,
    pub delta_y: f32,
}

// --- This struct MUST match the 'EntitySnapshot' interface in main.ts ---
#[derive(Debug, Clone, Serialize)]
pub struct EntitySnapshot {
    pub eid: u32,
    pub transform: Transform,
    pub health: Option<Health>,
    pub stamina: Option<Stamina>,
    // You could add pub rotation: Option<Rotation> here if needed
}

pub type WorldSnapshot = Vec<EntitySnapshot>;