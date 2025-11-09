// File: apps/client-tauri/src-tauri/src/main.rs

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod sim;

use hecs::{Entity, World};
use sim::{
    PlayerInputs, InputPayload, EntitySnapshot, WorldSnapshot,
    Transform, Velocity, Health, Weapon, Player,
    Stamina,
    Rotation,
    // Target, // <-- REMOVED
    Team, TeamId, Score, GameModeState, TickSnapshot,
    TICK_DT, SPEED, SPRINT_SPEED, MOUSE_SENSITIVITY,
    WEAPON_MAX_RANGE, WEAPON_HIT_ACCURACY
};
use std::sync::Mutex;
use tauri::State;

pub struct GameState {
    world: Mutex<World>,
    game_mode: Mutex<GameModeState>,
}

impl Default for GameState {
    fn default() -> Self {
        Self {
            world: Mutex::new(World::new()),
            game_mode: Mutex::new(GameModeState {
                team_a_tickets: 5, // Starting tickets
                team_b_tickets: 5, // Starting tickets
                match_ended: false,
                winner: TeamId::None,
            }),
        }
    }
}


#[tauri::command]
fn init_sim(state: State<GameState>) -> TickSnapshot {
    let mut world = state.world.lock().unwrap();
    let mut game_mode = state.game_mode.lock().unwrap();
    world.clear();

    *game_mode = GameModeState {
        team_a_tickets: 5,
        team_b_tickets: 5,
        match_ended: false,
        winner: TeamId::None,
    };

    // --- Player Spawn ---
    let start_transform = Transform { x: 0.0, y: 0.5, z: 0.0 };
    let start_health = Health { current: 100.0, max: 100.0 };
    let start_stamina = Stamina {
        current: 50.0,
        max: 50.0,
        regen_rate: 10.0,
        drain_rate: 15.0,
    };
    let start_velocity = Velocity { x: 0.0, y: 0.0, z: 0.0 };
    let start_weapon = Weapon { fire_rate: 0.1, cooldown: 0.0, damage: 10.0 };
    let start_rotation = Rotation { yaw: 0.0, pitch: 0.0 };
    let start_team = Team { id: TeamId::TeamA }; // Player 1 is on Team A
    let start_score = Score { kills: 0, deaths: 0 };

    let player_eid = world.spawn((
        Player,
        PlayerInputs {
            forward: 0.0,
            right: 0.0,
            jump: false,
            fire: false,
            sprint: false,
            show_scoreboard: false,
        },
        start_transform,
        start_velocity,
        start_health,
        start_stamina,
        start_rotation,
        start_weapon,
        start_team,
        start_score,
    ));

    // --- REMOVED: Spawn a dummy target ---

    // Return a dummy TickSnapshot for initialization
    let snapshot = EntitySnapshot {
        eid: player_eid.to_bits().get() as u32,
        transform: start_transform,
        health: Some(start_health),
        stamina: Some(start_stamina),
        team: Some(start_team),
        score: Some(start_score),
    };

    TickSnapshot {
        entities: vec![snapshot],
        game_state: *game_mode,
    }
}

// --- SYSTEMS ---
fn stamina_system(world: &mut World, dt: f32) {
    for (_eid, (stamina, input)) in world.query_mut::<(&mut Stamina, &PlayerInputs)>() {
        if input.sprint && input.forward > 0.0 {
            stamina.current = (stamina.current - stamina.drain_rate * dt).max(0.0);
        } else {
            stamina.current = (stamina.current + stamina.regen_rate * dt).min(stamina.max);
        }
    }
}

fn movement_system(world: &mut World, dt: f32) {
    for (_eid, (transform, velocity, stamina, input, rotation)) in world
        .query_mut::<(&mut Transform, &mut Velocity, &Stamina, &PlayerInputs, &Rotation)>()
    {
        let is_sprinting = input.sprint && input.forward > 0.0 && stamina.current > 0.0;
        let current_speed = if is_sprinting { SPRINT_SPEED } else { SPEED };

        let forward = input.forward * current_speed;
        let right = input.right * current_speed;

        let yaw = rotation.yaw;
        let sin_yaw = yaw.sin();
        let cos_yaw = yaw.cos();
        
        velocity.x = sin_yaw * -forward + cos_yaw * right;
        velocity.z = cos_yaw * -forward - sin_yaw * right;

        transform.x += velocity.x * dt;
        transform.z += velocity.z * dt;
    }
}

fn weapon_system(world: &mut World, _tick: u32) {
    let mut hits_to_apply: Vec<(Entity, f32, Entity)> = Vec::new(); // (target_eid, damage, killer_eid)

    #[derive(Clone, Copy)]
    struct TargetInfo {
        eid: Entity,
        transform: Transform,
        team: Team,
    }
    let mut targets: Vec<TargetInfo> = Vec::new();
    
    // Pass 1: (Immutable) Collect all players
    for (eid, (t_transform, t_team, _player)) in // <-- UPDATED: Only query for &Player
        world.query::<(&Transform, &Team, &Player)>().iter()
    {
        targets.push(TargetInfo {
            eid,
            transform: *t_transform,
            team: *t_team,
        });
    }

    // Pass 2: (Mutable) Iterate shooters and check against the target list
    for (shooter_eid, (input, weapon, s_transform, s_rotation, s_team)) in world
        .query_mut::<(&PlayerInputs, &mut Weapon, &Transform, &Rotation, &Team)>()
    {
        if input.fire && weapon.cooldown <= 0.0 {
            weapon.cooldown = weapon.fire_rate;
            
            let forward_x = -s_rotation.yaw.sin();
            let forward_z = -s_rotation.yaw.cos();

            for target in &targets {
                if target.eid == shooter_eid { continue; } // Don't shoot self
                if target.team.id == s_team.id { continue; } // Don't shoot teammates

                let dir_to_target_x = target.transform.x - s_transform.x;
                let dir_to_target_z = target.transform.z - s_transform.z;
                let distance_sq = dir_to_target_x.powi(2) + dir_to_target_z.powi(2);

                if distance_sq > WEAPON_MAX_RANGE.powi(2) { continue; }

                let dist = distance_sq.sqrt();
                if dist < 1e-6 { continue; }
                let norm_dir_x = dir_to_target_x / dist;
                let norm_dir_z = dir_to_target_z / dist;
                let dot_product = forward_x * norm_dir_x + forward_z * norm_dir_z;

                if dot_product > WEAPON_HIT_ACCURACY {
                    println!("Rust: Player {:?} HIT player {:?}", shooter_eid, target.eid);
                    hits_to_apply.push((target.eid, weapon.damage, shooter_eid));
                    break;
                }
            }
        }
    }

    // Pass 3: (Mutable) Apply all queued hits and update scores
    for (target_eid, damage, killer_eid) in hits_to_apply {
        if let Ok(mut health) = world.query_one_mut::<&mut Health>(target_eid) {
            if health.current > 0.0 {
                health.current = (health.current - damage).max(0.0);
                println!(
                    "Rust: Target {:?} health now: {}",
                    target_eid, health.current
                );
                if health.current <= 0.0 {
                    if let Ok(mut killer_score) = world.query_one_mut::<&mut Score>(killer_eid) {
                        killer_score.kills += 1;
                    }
                }
            }
        }
    }
}

fn death_system(world: &mut World, game_mode: &mut GameModeState) {
    if game_mode.match_ended { return; }

    // Pass 1: (Immutable) Collect all dead players
    let mut dead_entities: Vec<(Entity, TeamId)> = Vec::new();
    for (eid, (health, team, _player)) in world.query::<(&Health, &Team, &Player)>().iter() { // <-- UPDATED
        if health.current <= 0.0 {
            dead_entities.push((eid, team.id));
        }
    }

    if dead_entities.is_empty() {
        return;
    }

    // Pass 2: (Mutable) Process all deaths
    for (eid, team_id) in dead_entities {
        
        let mut should_process = false;
        if let Ok(health) = world.get::<&Health>(eid) {
            if health.current <= 0.0 {
                should_process = true;
            }
        }

        if should_process {
            // 1. Update Score (add a death)
            if let Ok(mut score) = world.query_one_mut::<&mut Score>(eid) {
                score.deaths += 1;
            }

            // 2. Update Tickets
            match team_id {
                TeamId::TeamA => game_mode.team_a_tickets -= 1,
                TeamId::TeamB => game_mode.team_b_tickets -= 1,
                TeamId::None => {}
            }
            println!("Rust: Player {:?} died. Team A: {}, Team B: {}", eid, game_mode.team_a_tickets, game_mode.team_b_tickets);
        
            // 3. Respawn (reset health and transform)
            if let Ok((mut health, mut transform)) =
                world.query_one_mut::<(&mut Health, &mut Transform)>(eid)
            {
                health.current = health.max;
                transform.x = 0.0; transform.y = 0.5; transform.z = 0.0; // Player spawn
            }
        }
    }

    // Check for match end condition
    if game_mode.team_a_tickets <= 0 {
        game_mode.match_ended = true;
        game_mode.winner = TeamId::TeamB;
        println!("Rust: Match Over! Team B wins!");
    } else if game_mode.team_b_tickets <= 0 {
        game_mode.match_ended = true;
        game_mode.winner = TeamId::TeamA;
        println!("Rust: Match Over! Team A wins!");
    }
}


#[tauri::command]
fn step_tick(payload: InputPayload, state: State<GameState>) -> TickSnapshot {
    let mut world = state.world.lock().unwrap();
    let mut game_mode = state.game_mode.lock().unwrap();

    // 1. Update all player inputs and rotation
    for (_eid, (inputs, rotation)) in world.query_mut::<(&mut PlayerInputs, &mut Rotation)>() {
        *inputs = payload.inputs;
        rotation.yaw -= payload.delta_x * MOUSE_SENSITIVITY;
        rotation.pitch -= payload.delta_y * MOUSE_SENSITIVITY;
        
        // --- FIX: Corrected typo ---
        rotation.pitch = rotation.pitch.clamp(-std::f32::consts::FRAC_PI_2, std::f32::consts::FRAC_PI_2);
    }

    if !game_mode.match_ended {
        // 2. Update weapon cooldowns
        for (_eid, weapon) in world.query_mut::<&mut Weapon>() {
            if weapon.cooldown > 0.0 {
                weapon.cooldown -= TICK_DT;
            }
        }

        // 3. Run Weapon System
        weapon_system(&mut world, payload.tick);

        // 4. Run Death System
        death_system(&mut world, &mut game_mode);

        // 5. Run Stamina System
        stamina_system(&mut world, TICK_DT);

        // 6. Run Movement System
        movement_system(&mut world, TICK_DT);
    }
    
    // 7. Create snapshot
    let mut snapshot: WorldSnapshot = Vec::new();
    for (eid, (transform, health, stamina, team, score)) in world
        .query::<(&Transform, Option<&Health>, Option<&Stamina>, Option<&Team>, Option<&Score>)>()
        .iter()
    {
        snapshot.push(EntitySnapshot {
            eid: eid.to_bits().get() as u32,
            transform: *transform,
            health: health.copied(),
            stamina: stamina.copied(),
            team: team.copied(),
            score: score.copied(),
        });
    }

    // 8. Return the new state
    TickSnapshot {
        entities: snapshot,
        game_state: *game_mode,
    }
}

fn main() {
    tauri::Builder::default()
        .manage(GameState::default())
        .invoke_handler(tauri::generate_handler![
            init_sim,
            step_tick
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}