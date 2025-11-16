// apps/client-tauri/src-tauri/src/systems/movement.rs
use std::collections::HashMap;
use std::f32::consts::PI;
use crate::player::Player;
use crate::protocol::{ClientMessage, ClientInputs};

pub const MOVE_SPEED: f32 = 10.0;
pub const AIR_SPEED_FACTOR: f32 = 0.6;
pub const GRAVITY: f32 = -25.0;
pub const JUMP_FORCE: f32 = 9.0;
pub const MOVEMENT_VERSION: &str = "movement-v1.0.0";

fn print_versions() {
    println!("Server movement version: {}", MOVEMENT_VERSION);
}


pub fn update(players: &mut HashMap<u32, Player>, input_map: &HashMap<u32, ClientMessage>, dt: f32, frame_count: u64) {
    for (id, player) in players.iter_mut() {
        if player.is_dead { continue; }

        if let Some(msg) = input_map.get(id) {
            let ClientMessage(_tick, inputs, dx, dy) = msg;
            let ClientInputs(fwd, right, _jump, _fire, sprint, _scoreboard) = inputs;

            // Mouse Look
            player.transform.yaw -= dx * MOUSE_SENSITIVITY;
            player.transform.pitch -= dy * MOUSE_SENSITIVITY;
            player.transform.pitch = player.transform.pitch.clamp(-PI / 2.0 + 0.1, PI / 2.0 - 0.1);

            // Movement Math
            let yaw = player.transform.yaw;
            let speed = if *sprint { MOVE_SPEED * SPRINT_MULTIPLIER } else { MOVE_SPEED };
            
            // --- FIX: Removed Negative Signs to match Client WASD ---
            // Was: -yaw.sin(), -yaw.cos()
            // Now: yaw.sin(), yaw.cos()
            let vec_fwd_x = yaw.sin();
            let vec_fwd_z = yaw.cos();
            
            // Was: -yaw.cos(), yaw.sin() (Inverted Left/Right)
            // Now: yaw.cos(), -yaw.sin() (Matches Client)
            let vec_right_x = yaw.cos(); 
            let vec_right_z = -yaw.sin();

            let move_x = (vec_fwd_x * fwd) + (vec_right_x * right);
            let move_z = (vec_fwd_z * fwd) + (vec_right_z * right);

            let len = (move_x * move_x + move_z * move_z).sqrt();
            if len > 0.0 {
                player.transform.x += (move_x / len) * speed * dt;
                player.transform.z += (move_z / len) * speed * dt;

                if frame_count % 30 == 0 {
                        println!("[PHYSICS] Player {} Moved: {:.2}, {:.2}", id, player.transform.x, player.transform.z);
                }
            }
        }
    }
}