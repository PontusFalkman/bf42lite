// apps/client-tauri/src-tauri/src/systems/movement.rs
use std::collections::HashMap;
use std::f32::consts::PI;

use crate::player::Player;
use crate::protocol::ClientMessage;

pub const MOVE_SPEED: f32 = 10.0;
pub const AIR_SPEED_FACTOR: f32 = 0.6;
pub const GRAVITY: f32 = -25.0;
pub const JUMP_FORCE: f32 = 9.0;
const MOUSE_SENSITIVITY: f32 = 0.002;
const SPRINT_MULTIPLIER: f32 = 1.5;
pub const MOVEMENT_VERSION: &str = "movement-v1.0.0";

fn print_versions() {
    println!("Server movement version: {}", MOVEMENT_VERSION);
}

/// Server-side movement update.
/// `input_map` holds the latest `ClientMessage` per player.
pub fn update(
    players: &mut HashMap<u32, Player>,
    input_map: &HashMap<u32, ClientMessage>,
    dt: f32,
    frame_count: u64,
) {
    // Print versions once in a while if you want (optional)
    if frame_count == 0 {
        print_versions();
    }

    for (id, player) in players.iter_mut() {
        if player.is_dead {
            continue;
        }

        // Look up the latest message from this player
        if let Some(msg) = input_map.get(id) {
            // Only handle "input" messages here. Fire / spawn are handled elsewhere.
            if let ClientMessage::Input { tick: _tick, axes } = msg {
                // Axes from TS schema
                let mut fwd = axes.forward;
                let right = axes.right;

                // You can later map `axes.reload` to "sprint" or similar.
                let sprint = axes.reload;

                // Match client prediction logic: client uses `forward = -InputState.moveY[id]`
                fwd = -fwd;

                // Mouse look: client sends absolute yaw/pitch.
                player.transform.yaw = axes.yaw;
                player.transform.pitch = axes.pitch;
                player.transform.pitch = player.transform.pitch.clamp(
                    -PI / 2.0 + 0.1,
                    PI / 2.0 - 0.1,
                );

                // Movement vectors based on yaw.
                let yaw = player.transform.yaw;
                let speed = if sprint {
                    MOVE_SPEED * SPRINT_MULTIPLIER
                } else {
                    MOVE_SPEED
                };

                // Forward (W/S) direction
                let vec_fwd_x = yaw.sin();
                let vec_fwd_z = yaw.cos();

                // Right (D/A) direction
                let vec_right_x = yaw.cos();
                let vec_right_z = -yaw.sin();

                let move_x = (vec_fwd_x * fwd) + (vec_right_x * right);
                let move_z = (vec_fwd_z * fwd) + (vec_right_z * right);

                let len = (move_x * move_x + move_z * move_z).sqrt();
                if len > 0.0 {
                    player.transform.x += (move_x / len) * speed * dt;
                    player.transform.z += (move_z / len) * speed * dt;

                    if frame_count % 30 == 0 {
                        println!(
                            "[PHYSICS] Player {} Moved: {:.2}, {:.2}",
                            id, player.transform.x, player.transform.z
                        );
                    }
                }

                // Jump / gravity logic can be added here later using axes.jump, GRAVITY, JUMP_FORCE, etc.
            }
        }
    }
}
