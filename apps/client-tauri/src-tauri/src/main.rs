// File: apps/client-tauri/src-tauri/src/main.rs

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod sim;

use hecs::World;
use sim::{
    InputAxis, InputPayload, EntitySnapshot, WorldSnapshot,
    Transform, Velocity, Health, Weapon, Player,
    Stamina, // (From sim.rs)
    TICK_DT, SPEED, SPRINT_SPEED // (From sim.rs)
};
use std::sync::Mutex;
use tauri::State;

pub struct GameState(Mutex<World>);

impl Default for GameState {
    fn default() -> Self {
        Self(Mutex::new(World::new()))
    }
}

// --- UPDATED: `init_sim` ---
#[tauri::command]
fn init_sim(state: State<GameState>) -> EntitySnapshot {
    let mut world = state.0.lock().unwrap();
    world.clear();

    let start_transform = Transform { x: 0.0, y: 0.5, z: 0.0 };
    let start_health = Health { current: 100.0, max: 100.0 };
    let start_stamina = Stamina {
        current: 50.0,
        max: 50.0,
        regen_rate: 10.0,
        drain_rate: 15.0,
    };

    let player_e = world.spawn((
        Player,
        start_transform,
        Velocity { x: 0.0, y: 0.0, z: 0.0 },
        // --- FIX #1: Added missing 'sprint' field ---
        InputAxis { forward: 0.0, right: 0.0, jump: 0.0, fire: false, sprint: false },
        start_health,
        Weapon { fire_rate: 0.1, cooldown: 0.0, damage: 25.0 },
        start_stamina,
    ));

    println!("Rust: Initialized simulation, spawned player {:?}", player_e);

    // --- FIX #2: Added missing 'stamina' field ---
    EntitySnapshot {
        eid: player_e.to_bits().get() as u32,
        transform: start_transform,
        health: Some(start_health),
        stamina: Some(start_stamina),
    }
}

// --- NEW: Helper function for the stamina system ---
fn stamina_system(world: &mut World, dt: f32) {
    for (_eid, (stamina, input)) in world.query_mut::<(&mut Stamina, &InputAxis)>() {
        if input.sprint && (input.forward != 0.0 || input.right != 0.0) {
            stamina.current -= stamina.drain_rate * dt;
        } else {
            stamina.current += stamina.regen_rate * dt;
        }
        stamina.current = stamina.current.clamp(0.0, stamina.max);
    }
}

// --- NEW: Helper function for the movement system ---
fn movement_system(world: &mut World, dt: f32) {
    for (_eid, (transform, velocity, input, stamina)) in
        world.query_mut::<(&mut Transform, &mut Velocity, &InputAxis, &Stamina)>()
    {
        let is_sprinting = input.sprint && stamina.current > 0.0;
        let current_speed = if is_sprinting { SPRINT_SPEED } else { SPEED };

        let forward_vel = input.forward * current_speed;
        let right_vel = input.right * current_speed;

        // Note: This movement is basic (no yaw). We'll fix later.
        velocity.x = right_vel;
        velocity.z = -forward_vel;

        transform.x += velocity.x * dt;
        transform.z += velocity.z * dt;
        transform.y = 0.5;
    }
}

// --- UPDATED: `step_tick` ---
#[tauri::command]
fn step_tick(
    payload: InputPayload,
    state: State<GameState>
) -> WorldSnapshot {
    let mut world = state.0.lock().unwrap();

    // 1. Apply inputs
    for (_eid, input) in world.query_mut::<&mut InputAxis>() {
        *input = payload.inputs;
        break;
    }

    // 2. Run Cooldown System
    for (_eid, weapon) in world.query_mut::<&mut Weapon>() {
        if weapon.cooldown > 0.0 {
            weapon.cooldown -= TICK_DT;
        }
    }

    // 3. Run Weapon System
    for (_eid, (input, weapon, transform)) in world.query_mut::<(&InputAxis, &mut Weapon, &Transform)>() {
        if input.fire && weapon.cooldown <= 0.0 {
            weapon.cooldown = weapon.fire_rate;
            println!(
                "Rust: Player fired weapon at tick {} from {:?}",
                payload.tick,
                transform
            );
        }
    }

    // 4. Run Stamina System
    stamina_system(&mut world, TICK_DT);

    // 5. Run Movement System
    movement_system(&mut world, TICK_DT);
    
    // 6. Create snapshot
    let mut snapshot: WorldSnapshot = Vec::new();

    // --- FIX #3: Added missing 'stamina' field ---
    for (eid, (transform, health, stamina)) in world
        .query::<(&Transform, Option<&Health>, Option<&Stamina>)>()
        .iter()
    {
        snapshot.push(EntitySnapshot {
            eid: eid.to_bits().get() as u32,
            transform: *transform,
            health: health.copied(),
            stamina: stamina.copied(), // <-- This was missing
        });
    }

    // 7. Return the new state
    snapshot
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