// apps/client-tauri/src-tauri/src/config.rs
use serde::Deserialize;
use std::fs;

#[derive(Debug, Clone, Deserialize)]
pub struct MovementConfig {
    pub move_speed: f32,
    pub gravity: f32,
    pub jump_force: f32,
    pub sprint_multiplier: f32,
    pub mouse_sensitivity: f32,
}

impl Default for MovementConfig {
    fn default() -> Self {
        Self {
            move_speed: 6.0,
            gravity: -9.81,
            jump_force: 5.0,
            sprint_multiplier: 1.5,
            mouse_sensitivity: 0.1,
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct WeaponConfig {
    pub id: u32,
    pub key: String,
    pub name: String,
    pub damage_per_hit: f32,
    pub fire_rate: f32, // seconds between shots
    pub mag_size: u32,
    pub reserve_ammo: u32,
    pub recoil: f32,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ClassConfig {
    pub id: u8,
    pub key: String,
    pub name: String,
    pub max_health: f32,
    pub primary_weapon_id: u32,
}

#[derive(Debug, Deserialize, Clone)]
pub struct ConquestConfig {
    pub team_a_initial_tickets: i32,
    pub team_b_initial_tickets: i32,
    pub tickets_per_death: i32,
    pub tickets_per_bleed: i32,
    pub bleed_interval_seconds: f32,
}

impl Default for ConquestConfig {
    fn default() -> Self {
        Self {
            team_a_initial_tickets: 100,
            team_b_initial_tickets: 100,
            tickets_per_death: 1,
            tickets_per_bleed: 1,
            bleed_interval_seconds: 5.0,
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct GameConfig {
    #[serde(default)]
    pub movement: MovementConfig,

    #[serde(default)]
    pub weapons: Vec<WeaponConfig>,

    #[serde(default)]
    pub classes: Vec<ClassConfig>,

    #[serde(default)]
    pub conquest: ConquestConfig,
}

impl Default for GameConfig {
    fn default() -> Self {
        Self {
            // movement still has code defaults as a safety net
            movement: MovementConfig::default(),
            // NO in-code weapons/classes stats anymore
            weapons: Vec::new(),
            classes: Vec::new(),
            conquest: ConquestConfig::default(),
        }
    }
}

impl GameConfig {
    /// Keep TOML loader for movement (and as a general config file if you want).
    pub fn load_from_file(path: &str) -> Self {
        let contents = fs::read_to_string(path).unwrap_or_else(|err| {
            eprintln!(
                "[GameConfig] Failed to read {}: {}. Using defaults.",
                path, err
            );
            String::new()
        });

        if contents.trim().is_empty() {
            eprintln!("[GameConfig] Empty or missing config file. Using defaults.");
            return GameConfig::default();
        }

        match toml::from_str::<GameConfig>(&contents) {
            Ok(cfg) => cfg,
            Err(err) => {
                eprintln!(
                    "[GameConfig] Failed to parse {}: {}. Using defaults.",
                    path, err
                );
                GameConfig::default()
            }
        }
    }

    /// Weapons/classes come only from JSON.
    pub fn load_all() -> Self {
        // 1) Start from TOML (for movement); weapons/classes will be overwritten by JSON
        let mut cfg = GameConfig::load_from_file("game_config.toml");

        // 2) weapons.json
        match fs::read_to_string("weapons.json") {
            Ok(text) => match serde_json::from_str::<Vec<WeaponConfig>>(&text) {
                Ok(weapons) => {
                    println!("[GameConfig] Loaded {} weapons from weapons.json", weapons.len());
                    cfg.weapons = weapons;
                }
                Err(err) => {
                    eprintln!("[GameConfig] Failed to parse weapons.json: {}. Leaving weapons empty.", err);
                    cfg.weapons.clear();
                }
            },
            Err(err) => {
                eprintln!(
                    "[GameConfig] Failed to read weapons.json: {}. Leaving weapons empty.",
                    err
                );
                cfg.weapons.clear();
            }
        }

        // 3) classes.json
        match fs::read_to_string("classes.json") {
            Ok(text) => match serde_json::from_str::<Vec<ClassConfig>>(&text) {
                Ok(classes) => {
                    println!("[GameConfig] Loaded {} classes from classes.json", classes.len());
                    cfg.classes = classes;
                }
                Err(err) => {
                    eprintln!("[GameConfig] Failed to parse classes.json: {}. Leaving classes empty.", err);
                    cfg.classes.clear();
                }
            },
            Err(err) => {
                eprintln!(
                    "[GameConfig] Failed to read classes.json: {}. Leaving classes empty.",
                    err
                );
                cfg.classes.clear();
            }
        }

        cfg
    }
}
