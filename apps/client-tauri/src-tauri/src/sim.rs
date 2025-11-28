// apps/client-tauri/src-tauri/src/sim.rs
use std::collections::HashMap;
use crate::protocol::{
    TickSnapshot,
    EntitySnapshot,
    GameModeState,
    TeamId,
    HealthStruct,
    StaminaStruct,
    TeamStruct,
    ScoreStruct,
    ClientMessage,
    LoadoutStruct,
    FlagSnapshot,
};
use crate::systems;
use crate::player::Player;
use crate::config::GameConfig;

pub struct SimState {
    pub players: HashMap<u32, Player>,
    pub tickets_a: f32,
    pub tickets_b: f32,
    pub frame_count: u64,
    pub flags: Vec<FlagZone>,
     pub config: GameConfig,
}

// Simple server-side representation of a Conquest flag.
pub struct FlagZone {
    pub id: u32,
    pub x: f32,
    pub y: f32,
    pub z: f32,
    pub radius: f32,

    // Which team currently owns the flag.
    pub owner: TeamId,

    // Capture progress: -1.0 .. 1.0
    // < 0 = leaning to TeamB, > 0 = leaning to TeamA, 0 = neutral
    pub capture: f32,
}

impl SimState {
    pub fn new() -> Self {
        // Try to load from a TOML file; fall back to defaults if missing.
let config = GameConfig::load_all();

        Self {
            players: HashMap::new(),
            tickets_a: 100.0,
            tickets_b: 100.0,
            frame_count: 0,
            flags: crate::maps::warehouse::create_flags(),
            config,
        }
    }

    pub fn handle_join(&mut self, id: u32) {
        let team = TeamId::TeamA; // simple for now
        let mut p = Player::new(id, team);
        p.respawn();
        self.players.insert(id, p);
        println!("[NET] Player {} joined", id);
    }

    pub fn handle_disconnect(&mut self, id: u32) {
        self.players.remove(&id);
        println!("[NET] Player {} disconnected", id);
    }

    pub fn update(
        &mut self,
        dt: f32,
        input_map: &HashMap<u32, ClientMessage>,
    ) -> TickSnapshot {
        // Debug: how many inputs did we get this tick?
        println!("[DEBUG] input_map len = {}", input_map.len());
    
        self.frame_count += 1;
    
        // 1. Run Systems
systems::movement::update(
    &mut self.players,
    input_map,
    dt,
    self.frame_count,
    &self.config.movement,
);    
        // Existing [DEBUG] After movement + conquest calls stay as-is
        if let Some((id, p)) = self.players.iter().next() {
            println!(
                "[DEBUG] After movement: Player {} at ({:.1}, {:.1}, {:.1}) team={:?}",
                id, p.transform.x, p.transform.y, p.transform.z, p.team
            );
        }
systems::combat::update(&mut self.players, input_map, dt, &self.config);

        // 2. Conquest logic: update flag capture + tickets
        systems::conquest::update_conquest(
            &mut self.flags,
            &self.players,
            &mut self.tickets_a,
            &mut self.tickets_b,
            dt,
        );

        // 3. Game Mode Logic (winner)
let winner = if self.tickets_a <= 0.0 {
    TeamId::TeamB
} else if self.tickets_b <= 0.0 {
    TeamId::TeamA
} else {
    TeamId::None
};

        // 4. Snapshot Generation: entities
        let mut entities = Vec::new();
        for p in self.players.values() {
            entities.push(EntitySnapshot {
                eid: p.id,
                transform: p.transform.clone(),
                health: Some(HealthStruct {
                    current: p.health,
                    max: p.max_health,
                }),
                stamina: Some(StaminaStruct {
                    current: 100.0,
                    max: 100.0,
                }),
                team: Some(TeamStruct { id: p.team }),
                score: Some(ScoreStruct {
                    kills: p.score_kills,
                    deaths: p.score_deaths,
                }),
                loadout: Some(LoadoutStruct {
                    class_id: p.class_id,
                }),
            });
        }

        // 5. Snapshot Generation: flags
        let flags = self.flags.iter().map(|f| FlagSnapshot {
            id: f.id,
            x: f.x,
            y: f.y,
            z: f.z,
            radius: f.radius,
            owner: f.owner,
            capture: f.capture,
        }).collect();

        TickSnapshot {
            entities,
            flags,
            game_state: GameModeState {
                team_a_tickets: self.tickets_a.round() as i32,
                team_b_tickets: self.tickets_b.round() as i32,                
                match_ended: winner != TeamId::None,
                winner,
            },
        }        
    }
}
