// apps/client-tauri/src-tauri/src/sim.rs
use std::collections::HashMap;
use crate::protocol::{TickSnapshot, EntitySnapshot, GameModeState, TeamId, HealthStruct, StaminaStruct, TeamStruct, ScoreStruct, ClientMessage};
use crate::player::Player;
use crate::systems;

pub struct SimState {
    pub players: HashMap<u32, Player>,
    pub tickets_a: i32,
    pub tickets_b: i32,
    pub frame_count: u64, 
}

impl SimState {
    pub fn new() -> Self {
        Self {
            players: HashMap::new(),
            tickets_a: 100,
            tickets_b: 100,
            frame_count: 0,
        }
    }

    pub fn handle_join(&mut self, id: u32) {
        let team = TeamId::TeamA; 
        let mut p = Player::new(id, team);
        p.respawn();
        self.players.insert(id, p);
        println!("[NET] Player {} joined", id);
    }

    pub fn handle_disconnect(&mut self, id: u32) {
        self.players.remove(&id);
        println!("[NET] Player {} disconnected", id);
    }

    pub fn update(&mut self, dt: f32, input_map: &HashMap<u32, ClientMessage>) -> TickSnapshot {
        self.frame_count += 1;

        // 1. Run Systems
        systems::movement::update(&mut self.players, input_map, dt, self.frame_count);
        systems::combat::update(&mut self.players, input_map, dt);

        // 2. Game Mode Logic (Tickets)
        let winner = if self.tickets_a <= 0 { TeamId::TeamB } 
                     else if self.tickets_b <= 0 { TeamId::TeamA } 
                     else { TeamId::None };

        // 3. Snapshot Generation
        let mut entities = Vec::new();
        for p in self.players.values() {
            entities.push(EntitySnapshot {
                eid: p.id,
                transform: p.transform.clone(),
                health: Some(HealthStruct { current: p.health, max: p.max_health }),
                stamina: Some(StaminaStruct { current: 100.0, max: 100.0 }),
                team: Some(TeamStruct { id: p.team }),
                score: Some(ScoreStruct { kills: p.score_kills, deaths: p.score_deaths }),
                aura_charge_progress: p.aura_charge_progress,
                is_healing_aura_active: p.is_healing_aura_active,
            });
        }

        TickSnapshot {
            entities,
            game_state: GameModeState {
                team_a_tickets: self.tickets_a,
                team_b_tickets: self.tickets_b,
                match_ended: winner != TeamId::None,
                winner,
            },
        }
    }
}