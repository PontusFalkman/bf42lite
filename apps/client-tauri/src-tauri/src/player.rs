// apps/client-tauri/src-tauri/src/player.rs
use serde::{Deserialize, Serialize};
use crate::protocol::{Transform, TeamId};

pub const MAX_HEALTH: f32 = 100.0;
pub const RESPAWN_TIME: f32 = 5.0;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Player {
    pub id: u32,
    pub transform: Transform,
    pub velocity: (f32, f32, f32),
    pub team: TeamId,
    pub health: f32,
    pub max_health: f32,
    pub is_dead: bool,
    pub respawn_timer: f32,
    pub fire_cooldown: f32, 
    pub score_kills: u32,
    pub score_deaths: u32,
    pub last_time_damage_taken: f32,
    pub aura_charge_progress: f32,
    pub is_healing_aura_active: bool,
}

impl Player {
    pub fn new(id: u32, team: TeamId) -> Self {
        Self {
            id,
            transform: Transform { x: 0.0, y: 2.0, z: 0.0, yaw: 0.0, pitch: 0.0 },
            velocity: (0.0, 0.0, 0.0),
            team,
            health: MAX_HEALTH,
            max_health: MAX_HEALTH,
            is_dead: false,
            respawn_timer: 0.0,
            fire_cooldown: 0.0,
            score_kills: 0,
            score_deaths: 0,
            last_time_damage_taken: 0.0,
            aura_charge_progress: 0.0,
            is_healing_aura_active: false,
        }
    }

    pub fn respawn(&mut self) {
        self.health = self.max_health;
        self.is_dead = false;
        self.fire_cooldown = 0.0;
        self.transform.x = 0.0;
        self.transform.z = 0.0; 
        self.transform.y = 2.0;
        println!("[GAME] Player {} respawned", self.id);
    }
}