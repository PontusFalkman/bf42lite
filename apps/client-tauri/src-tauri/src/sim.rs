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

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Rotation {
    pub yaw: f32,
    pub pitch: f32,
}

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

// --- REMOVED 'Target' STRUCT ---

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum TeamId {
    None,
    TeamA,
    TeamB,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Team {
    pub id: TeamId,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Score {
    pub kills: u32,
    pub deaths: u32,
}

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
pub const MOUSE_SENSITIVITY: f32 = 0.002;
pub const WEAPON_MAX_RANGE: f32 = 100.0;
pub const WEAPON_HIT_ACCURACY: f32 = 0.98;

// --- DATA STRUCTURES FOR TAURI ---

#[derive(Debug, Clone, Deserialize)]
pub struct InputPayload {
    pub tick: u32,
    pub inputs: PlayerInputs, // Nested object
    pub delta_x: f32,
    pub delta_y: f32,
}

#[derive(Debug, Clone, Serialize)]
pub struct EntitySnapshot {
    pub eid: u32,
    pub transform: Transform,
    pub health: Option<Health>,
    pub stamina: Option<Stamina>,
    pub team: Option<Team>,
    pub score: Option<Score>,
}

pub type WorldSnapshot = Vec<EntitySnapshot>;

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct GameModeState {
    pub team_a_tickets: i32,
    pub team_b_tickets: i32,
    pub match_ended: bool,
    pub winner: TeamId,
}

#[derive(Debug, Clone, Serialize)]
pub struct TickSnapshot {
    pub entities: WorldSnapshot,
    pub game_state: GameModeState,
}