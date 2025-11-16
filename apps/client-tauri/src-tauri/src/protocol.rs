// apps/client-tauri/src-tauri/src/protocol.rs
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct ServerEnvelope {
    pub your_id: u32,
    pub snapshot: TickSnapshot,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum TeamId { None, TeamA, TeamB }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transform {
    pub x: f32, pub y: f32, pub z: f32,
    pub yaw: f32, pub pitch: f32, 
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientInputs(pub f32, pub f32, pub bool, pub bool, pub bool, pub bool);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientMessage(pub u32, pub ClientInputs, pub f32, pub f32);

#[derive(Serialize, Deserialize)]
pub struct EntitySnapshot {
    pub eid: u32,
    pub transform: Transform,
    pub health: Option<HealthStruct>, 
    pub stamina: Option<StaminaStruct>,
    pub team: Option<TeamStruct>,
    pub score: Option<ScoreStruct>,
    pub aura_charge_progress: f32,
    pub is_healing_aura_active: bool,
}

#[derive(Serialize, Deserialize)]
pub struct HealthStruct { pub current: f32, pub max: f32 }
#[derive(Serialize, Deserialize)]
pub struct StaminaStruct { pub current: f32, pub max: f32 }
#[derive(Serialize, Deserialize)]
pub struct TeamStruct { pub id: TeamId }
#[derive(Serialize, Deserialize)]
pub struct ScoreStruct { pub kills: u32, pub deaths: u32 }

#[derive(Serialize, Deserialize)]
pub struct GameModeState {
    pub team_a_tickets: i32,
    pub team_b_tickets: i32,
    pub match_ended: bool,
    pub winner: TeamId,
}

#[derive(Serialize, Deserialize)]
pub struct TickSnapshot {
    pub entities: Vec<EntitySnapshot>,
    pub game_state: GameModeState,
}