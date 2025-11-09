// File: apps/client-tauri/src-tauri/src/main.rs

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod sim;

use hecs::World;
use sim::{
    PlayerInputs, InputPayload, EntitySnapshot, WorldSnapshot,
    Transform, Velocity, Health, Weapon, Player,
    Stamina,
    Rotation, // <-- IMPORT Rotation
    TICK_DT, SPEED, SPRINT_SPEED, MOUSE_SENSITIVITY // <-- IMPORT MOUSE_SENSITIVITY
};
use std::sync::Mutex;
use tauri::State;

pub struct GameState(Mutex<World>);

impl Default for GameState {
    fn default() -> Self {
        Self(Mutex::new(World::new()))
    }
}

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
    let start_velocity = Velocity { x: 0.0, y: 0.0, z: 0.0 };
    let start_weapon = Weapon { fire_rate: 0.1, cooldown: 0.0, damage: 10.0 };
    let start_rotation = Rotation { yaw: 0.0, pitch: 0.0 }; // <-- ADD start_rotation

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
        start_rotation, // <-- ADD Rotation component to player
        start_weapon,
    ));

    EntitySnapshot {
        eid: player_eid.to_bits().get() as u32,
        transform: start_transform,
        health: Some(start_health),
        stamina: Some(start_stamina),
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

// --- UPDATED: movement_system ---
// Now queries for 'Rotation' and uses it to calculate velocity
fn movement_system(world: &mut World, dt: f32) {
    for (_eid, (transform, velocity, stamina, input, rotation)) in world // <-- ADD rotation
        .query_mut::<(&mut Transform, &mut Velocity, &Stamina, &PlayerInputs, &Rotation)>() // <-- ADD &Rotation
    {
        let is_sprinting = input.sprint && input.forward > 0.0 && stamina.current > 0.0;
        let current_speed = if is_sprinting { SPRINT_SPEED } else { SPEED };

        let forward = input.forward * current_speed;
        let right = input.right * current_speed;

        // --- USE YAW FOR MOVEMENT ---
        let yaw = rotation.yaw;
        let sin_yaw = yaw.sin();
        let cos_yaw = yaw.cos();
        
        // This calculates camera-relative movement
        velocity.x = sin_yaw * -forward + cos_yaw * right;
        velocity.z = cos_yaw * -forward - sin_yaw * right;
        // --- END OF FIX ---

        transform.x += velocity.x * dt;
        transform.z += velocity.z * dt;
    }
}

// --- UPDATED: `step_tick` ---
#[tauri::command]
fn step_tick(payload: InputPayload, state: State<GameState>) -> WorldSnapshot {
    let mut world = state.0.lock().unwrap();

    // 1. Update all player inputs and rotation
    // --- THIS FIXES THE WARNING ---
    for (_eid, (inputs, rotation)) in world.query_mut::<(&mut PlayerInputs, &mut Rotation)>() {
        *inputs = payload.inputs;
        
        // Use the deltas to update the player's rotation
        rotation.yaw -= payload.delta_x * MOUSE_SENSITIVITY;
        rotation.pitch -= payload.delta_y * MOUSE_SENSITIVITY;

        // Clamp pitch to prevent looking upside down
        rotation.pitch = rotation.pitch.clamp(-std::f32::consts::FRAC_PI_2, std::f32::consts::FRAC_PI_2);
    }
    // --- END OF FIX ---

    // 2. Update weapon cooldowns
    for (_eid, weapon) in world.query_mut::<&mut Weapon>() {
        if weapon.cooldown > 0.0 {
            weapon.cooldown -= TICK_DT;
        }
    }

    // 3. Run Weapon System
    // --- THIS FIXES THE COMPILE ERROR ---
    // Changed query from 'InputAxis' to 'PlayerInputs'
    for (_eid, (input, weapon, transform)) in world.query_mut::<(&PlayerInputs, &mut Weapon, &Transform)>() {
    // --- END OF FIX ---
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

    for (eid, (transform, health, stamina)) in world
        .query::<(&Transform, Option<&Health>, Option<&Stamina>)>()
        .iter()
    {
        snapshot.push(EntitySnapshot {
            eid: eid.to_bits().get() as u32,
            transform: *transform,
            health: health.copied(),
            stamina: stamina.copied(),
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