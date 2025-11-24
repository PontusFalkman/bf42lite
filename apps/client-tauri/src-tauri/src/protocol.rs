// apps/client-tauri/src-tauri/src/protocol.rs
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct ServerEnvelope {
    pub your_id: u32,
    pub snapshot: TickSnapshot,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum TeamId {
    None,
    TeamA,
    TeamB,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transform {
    pub x: f32,
    pub y: f32,
    pub z: f32,
    pub yaw: f32,
    pub pitch: f32,
}

// ---------- CLIENT → SERVER ----------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientAxes {
    pub forward: f32,
    pub right: f32,
    pub jump: bool,
    pub shoot: bool,
    pub reload: bool,
    pub yaw: f32,
    pub pitch: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Vec3 {
    pub x: f32,
    pub y: f32,
    pub z: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ClientMessage {
    #[serde(rename = "input")]
    Input {
        tick: u32,
        axes: ClientAxes,
    },

    #[serde(rename = "fire")]
    Fire {
        tick: u32,
        origin: Vec3,
        direction: Vec3,
        #[serde(rename = "weaponId")]
        weapon_id: u32,
    },

    #[serde(rename = "spawn_request")]
    SpawnRequest {
        #[serde(rename = "classId")]
        class_id: u32,
    },
}

// ---------- SERVER → CLIENT (SNAPSHOT) ----------

#[derive(Serialize, Deserialize)]
pub struct EntitySnapshot {
    pub eid: u32,
    pub transform: Transform,
    pub health: Option<HealthStruct>,
    pub stamina: Option<StaminaStruct>,
    pub team: Option<TeamStruct>,
    pub score: Option<ScoreStruct>,
    pub loadout: Option<LoadoutStruct>,
}

#[derive(Serialize, Deserialize)]
pub struct HealthStruct {
    pub current: f32,
    pub max: f32,
}

#[derive(Serialize, Deserialize)]
pub struct StaminaStruct {
    pub current: f32,
    pub max: f32,
}

#[derive(Serialize, Deserialize)]
pub struct TeamStruct {
    pub id: TeamId,
}

#[derive(Serialize, Deserialize)]
pub struct ScoreStruct {
    pub kills: u32,
    pub deaths: u32,
}

#[derive(Serialize, Deserialize)]
pub struct LoadoutStruct {
    pub class_id: u8,
}

#[derive(Serialize, Deserialize)]
pub struct GameModeState {
    pub team_a_tickets: i32,
    pub team_b_tickets: i32,
    pub match_ended: bool,
    pub winner: TeamId,
}

#[derive(Serialize, Deserialize)]
pub struct FlagSnapshot {
    pub id: u32,
    pub x: f32,
    pub y: f32,
    pub z: f32,
    pub radius: f32,
    pub owner: TeamId,
    pub capture: f32,
}

#[derive(Serialize, Deserialize)]
pub struct TickSnapshot {
    pub entities: Vec<EntitySnapshot>,
    pub flags: Vec<FlagSnapshot>,
    pub game_state: GameModeState,
}
