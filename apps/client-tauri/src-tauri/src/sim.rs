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

// --- NEW: Add Stamina component (Task X1) ---
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Stamina {
    pub current: f32,
    pub max: f32,
    pub regen_rate: f32, // How much to regen per second
    pub drain_rate: f32, // How much to drain per second
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Player;

// --- UPDATED: InputAxis to include 'sprint' ---
// (matches input.ts)
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct InputAxis {
    pub forward: f32,
    pub right: f32,
    pub jump: f32,
    pub fire: bool,
    pub sprint: bool, // <--- ADD THIS
}

// --- Constants ---
pub const SPEED: f32 = 3.0;
pub const SPRINT_SPEED: f32 = 6.0; // <--- ADD THIS
pub const TICK_RATE: u32 = 60;
pub const TICK_DT: f32 = 1.0 / TICK_RATE as f32;

// --- Data Structures for Tauri ---

// --- UPDATED: InputPayload to match InputAxis ---
#[derive(Debug, Clone, Deserialize)]
pub struct InputPayload {
    pub tick: u32,
    pub inputs: InputAxis,
}

// --- UPDATED: EntitySnapshot to include Stamina ---
#[derive(Debug, Clone, Serialize)]
pub struct EntitySnapshot {
    pub eid: u32,
    pub transform: Transform,
    pub health: Option<Health>,
    pub stamina: Option<Stamina>, // <--- ADD THIS
}

pub type WorldSnapshot = Vec<EntitySnapshot>;