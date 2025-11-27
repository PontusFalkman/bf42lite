// apps/client-tauri/src-tauri/src/config.rs

use serde::Deserialize;
use std::fs;

#[derive(Debug, Clone, Deserialize)]
pub struct MovementConfig {
    pub move_speed: f32,
    pub air_speed_factor: f32,
    pub gravity: f32,
    pub jump_force: f32,
    pub sprint_multiplier: f32,
    pub mouse_sensitivity: f32,
}

impl Default for MovementConfig {
    fn default() -> Self {
        Self {
            // These are your current hardcoded values:
            move_speed: 10.0,
            air_speed_factor: 0.6,
            gravity: -25.0,
            jump_force: 9.0,
            sprint_multiplier: 1.5,
            mouse_sensitivity: 0.002,
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct GameConfig {
    #[serde(default)]
    pub movement: MovementConfig,
}

impl Default for GameConfig {
    fn default() -> Self {
        Self {
            movement: MovementConfig::default(),
        }
    }
}

impl GameConfig {
    /// Load config from a TOML file. If anything fails, fall back to defaults.
    pub fn load_from_file(path: &str) -> Self {
        match fs::read_to_string(path) {
            Ok(contents) => toml::from_str(&contents).unwrap_or_default(),
            Err(_) => GameConfig::default(),
        }
    }
}
