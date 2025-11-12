// apps/client-tauri/src-tauri/src/sim.rs

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::f32::consts::PI;

// === CONSTANTS ===
const MOVE_SPEED: f32 = 10.0;      
const SPRINT_MULTIPLIER: f32 = 1.5;
const MOUSE_SENSITIVITY: f32 = 0.002; 

const DAMAGE_PER_HIT: f32 = 34.0; 
const FIRE_RATE: f32 = 0.15;      
const MAX_HEALTH: f32 = 100.0;
const RESPAWN_TIME: f32 = 5.0;

// === DATA STRUCTURES ===

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

#[derive(Serialize, Deserialize)]
pub struct EntitySnapshot {
    pub eid: u32,
    pub transform: Transform,
    pub health: Option<HealthStruct>, 
    pub stamina: Option<StaminaStruct>,
    pub team: Option<TeamStruct>,
    pub score: Option<ScoreStruct>,
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

// === SIMULATION STATE ===

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

        for (id, player) in self.players.iter_mut() {
            if player.is_dead {
                player.respawn_timer -= dt;
                if player.respawn_timer <= 0.0 { player.respawn(); }
                continue;
            }

            if let Some(msg) = input_map.get(id) {
                let ClientMessage(_tick, inputs, dx, dy) = msg;
                let ClientInputs(fwd, right, _jump, _fire, sprint, _scoreboard) = inputs;

                if self.frame_count % 60 == 0 && (*fwd != 0.0 || *right != 0.0) {
                    println!("[INPUT] Player {} moving: Fwd={:.1} Right={:.1}", id, fwd, right);
                }
                
                player.transform.yaw -= dx * MOUSE_SENSITIVITY;
                player.transform.pitch -= dy * MOUSE_SENSITIVITY;
                player.transform.pitch = player.transform.pitch.clamp(-PI / 2.0 + 0.1, PI / 2.0 - 0.1);

                let yaw = player.transform.yaw;
                let speed = if *sprint { MOVE_SPEED * SPRINT_MULTIPLIER } else { MOVE_SPEED };
                
                let vec_fwd_x = -yaw.sin();
                let vec_fwd_z = -yaw.cos();
                let vec_right_x = -yaw.cos(); 
                let vec_right_z = yaw.sin();

                let move_x = (vec_fwd_x * fwd) + (vec_right_x * right);
                let move_z = (vec_fwd_z * fwd) + (vec_right_z * right);

                let len = (move_x * move_x + move_z * move_z).sqrt();
                if len > 0.0 {
                    let old_x = player.transform.x;
                    let old_z = player.transform.z;
                    player.transform.x += (move_x / len) * speed * dt;
                    player.transform.z += (move_z / len) * speed * dt;

                    if self.frame_count % 30 == 0 {
                         println!("[PHYSICS] Player {} Moved: ({:.2}, {:.2}) -> ({:.2}, {:.2})", id, old_x, old_z, player.transform.x, player.transform.z);
                    }
                }

                if player.fire_cooldown > 0.0 { player.fire_cooldown -= dt; }
            }
        }

        // Shooting
        let mut hits: Vec<(u32, u32)> = Vec::new(); 
        for (shooter_id, shooter) in &self.players {
            if let Some(msg) = input_map.get(shooter_id) {
                let ClientInputs(_, _, _, fire, _, _) = msg.1;
                
                if fire && shooter.fire_cooldown <= 0.0 && !shooter.is_dead {
                    println!("[COMBAT] Player {} FIRED!", shooter_id);
                    
                    let origin_x = shooter.transform.x;
                    let origin_y = shooter.transform.y + 0.6; 
                    let origin_z = shooter.transform.z;
                    let yaw = shooter.transform.yaw;
                    let pitch = shooter.transform.pitch;

                    let dir_x = -yaw.sin() * pitch.cos();
                    let dir_y = pitch.sin();
                    let dir_z = -yaw.cos() * pitch.cos();

                    let mut best_dist = 1000.0;
                    let mut hit_victim = None;

                    for (victim_id, victim) in &self.players {
                        if shooter_id == victim_id || victim.is_dead { continue; }
                        let vx = victim.transform.x;
                        let vy = victim.transform.y + 0.9; 
                        let vz = victim.transform.z;
                        let radius = 1.0; 

                        let oc_x = vx - origin_x;
                        let oc_y = vy - origin_y;
                        let oc_z = vz - origin_z;

                        let projection = oc_x * dir_x + oc_y * dir_y + oc_z * dir_z;
                        if projection < 0.0 { continue; } 

                        let dist_sq = (oc_x*oc_x + oc_y*oc_y + oc_z*oc_z) - (projection * projection);
                        if dist_sq < (radius * radius) && projection < best_dist {
                            best_dist = projection;
                            hit_victim = Some(*victim_id);
                        }
                    }

                    if let Some(vid) = hit_victim {
                        hits.push((*shooter_id, vid));
                        println!("[COMBAT] -> HIT Player {}!", vid);
                    } else {
                        println!("[COMBAT] -> MISSED");
                    }
                }
            }
        }

        for (shooter_id, _) in &hits {
            if let Some(p) = self.players.get_mut(shooter_id) { p.fire_cooldown = FIRE_RATE; }
        }
        for (pid, p) in self.players.iter_mut() {
             if let Some(msg) = input_map.get(pid) {
                 if msg.1.3 && p.fire_cooldown <= 0.0 { p.fire_cooldown = FIRE_RATE; }
             }
        }

        for (shooter_id, victim_id) in hits {
            if let Some(victim) = self.players.get_mut(&victim_id) {
                victim.health -= DAMAGE_PER_HIT;
                println!("[COMBAT] Player {} took damage. HP: {}", victim_id, victim.health);

                if victim.health <= 0.0 {
                    victim.health = 0.0;
                    victim.is_dead = true;
                    victim.respawn_timer = RESPAWN_TIME;
                    victim.score_deaths += 1;
                    println!("[COMBAT] Player {} ELIMINATED.", victim_id);
                    if let Some(shooter) = self.players.get_mut(&shooter_id) {
                        shooter.score_kills += 1;
                    }
                }
            }
        }

        let mut entities = Vec::new();
        for p in self.players.values() {
            entities.push(EntitySnapshot {
                eid: p.id,
                transform: p.transform.clone(),
                health: Some(HealthStruct { current: p.health, max: p.max_health }),
                stamina: Some(StaminaStruct { current: 100.0, max: 100.0 }),
                team: Some(TeamStruct { id: p.team }),
                score: Some(ScoreStruct { kills: p.score_kills, deaths: p.score_deaths }),
            });
        }

        let winner = if self.tickets_a <= 0 { TeamId::TeamB } 
                     else if self.tickets_b <= 0 { TeamId::TeamA } 
                     else { TeamId::None };

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