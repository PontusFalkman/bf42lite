// File: apps/client-tauri/src-tauri/src/sim.rs

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// --- Constants ---
pub const SPEED: f32 = 3.0;
pub const SPRINT_SPEED: f32 = 6.0;
pub const TICK_DT: f32 = 1.0 / 60.0; // 60hz

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
pub struct Stamina {
    pub current: f32,
    pub max: f32,
}

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

// --- Player & Game Structs ---

#[derive(Debug, Clone, Copy, Default, Deserialize)]
pub struct PlayerInputs {
    pub forward: f32,
    pub right: f32,
    pub jump: bool,
    pub fire: bool,
    pub sprint: bool,
    #[serde(rename = "showScoreboard")]
    pub show_scoreboard: bool,
    // --- THIS FIELD IS NEW (Fixes E0609) ---
    pub delta_x: f32,
}

#[derive(Debug, Clone)]
pub struct Player {
    pub eid: u32,
    pub transform: Transform,
    pub velocity: Velocity,
    pub health: Health,
    pub stamina: Stamina,
    pub team: Team,
    pub score: Score,
    pub inputs: PlayerInputs,
    pub rotation_y: f32,
}

impl Player {
    pub fn new(eid: u32, team_id: TeamId) -> Self {
        Self {
            eid,
            transform: Transform { x: 0.0, y: 1.0, z: 0.0 }, // Start at y=1 so not in floor
            velocity: Velocity { x: 0.0, y: 0.0, z: 0.0 },
            health: Health { current: 100.0, max: 100.0 },
            stamina: Stamina { current: 100.0, max: 100.0 },
            team: Team { id: team_id },
            score: Score { kills: 0, deaths: 0 },
            inputs: PlayerInputs::default(), // delta_x will be 0.0
            rotation_y: 0.0,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct GameModeState {
    pub team_a_tickets: i32,
    pub team_b_tickets: i32,
    pub match_ended: bool,
    pub winner: TeamId,
}

pub struct Game {
    pub players: HashMap<u32, Player>,
    pub game_state: GameModeState,
    next_eid: u32,
    team_a_count: u32,
    team_b_count: u32,
}

impl Game {
    pub fn new() -> Self {
        Self {
            players: HashMap::new(),
            game_state: GameModeState {
                team_a_tickets: 100,
                team_b_tickets: 100,
                match_ended: false,
                winner: TeamId::None,
            },
            next_eid: 0,
            team_a_count: 0,
            team_b_count: 0,
        }
    }

    pub fn add_player(&mut self) -> u32 {
        let eid = self.next_eid;
        self.next_eid += 1;

        let team_id = if self.team_a_count <= self.team_b_count {
            self.team_a_count += 1;
            TeamId::TeamA
        } else {
            self.team_b_count += 1;
            TeamId::TeamB
        };

        let player = Player::new(eid, team_id);
        self.players.insert(eid, player);
        eid
    }

    pub fn remove_player(&mut self, eid: u32) {
        if let Some(player) = self.players.remove(&eid) {
            if player.team.id == TeamId::TeamA {
                self.team_a_count -= 1;
            } else if player.team.id == TeamId::TeamB {
                self.team_b_count -= 1;
            }
        }
    }

    pub fn tick(&mut self, dt: f32) {
        for player in self.players.values_mut() {
            let current_speed = if player.inputs.sprint { SPRINT_SPEED } else { SPEED };

            // --- THIS IS THE MOVEMENT FIX ---
            
            // Accumulate rotation from mouse delta
            player.rotation_y -= player.inputs.delta_x;
            // Use the accumulated rotation for movement
            let (sin, cos) = player.rotation_y.sin_cos();
            
            // --- END FIX ---

            let forward = player.inputs.forward as f32;
            let right = player.inputs.right as f32;

            player.velocity.x = (forward * sin) + (right * cos);
            player.velocity.z = (forward * cos) - (right * sin);

            player.transform.x += player.velocity.x * current_speed * dt;
            player.transform.z += player.velocity.z * current_speed * dt;
        }
    }

    pub fn get_tick_snapshot(&self) -> TickSnapshot {
        let entities = self.players.values().map(|p| EntitySnapshot {
            eid: p.eid,
            transform: p.transform,
            health: Some(p.health),
            stamina: Some(p.stamina),
            team: Some(p.team),
            score: Some(p.score),
        }).collect();

        TickSnapshot {
            entities,
            game_state: self.game_state,
        }
    }
}

// --- Network Snapshot Structs ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntitySnapshot {
    pub eid: u32,
    pub transform: Transform,
    pub health: Option<Health>,
    pub stamina: Option<Stamina>,
    pub team: Option<Team>,
    pub score: Option<Score>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TickSnapshot {
    pub entities: Vec<EntitySnapshot>,
    pub game_state: GameModeState,
}