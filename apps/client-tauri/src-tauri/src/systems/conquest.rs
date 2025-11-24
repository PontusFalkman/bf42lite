// apps/client-tauri/src-tauri/src/systems/conquest.rs

use std::collections::HashMap;

use crate::player::Player;
use crate::protocol::TeamId;
use crate::sim::FlagZone;

/// Run conquest capture + ticket bleed for this tick.
pub fn update_conquest(
    flags: &mut Vec<FlagZone>,
    players: &HashMap<u32, Player>,
    tickets_a: &mut f32,
    tickets_b: &mut f32,
    dt: f32,
) {
    if dt <= 0.0 {
        // Snapshot sender sometimes calls with dt = 0.0, skip progression.
        return;
    }

    // Tweak these to taste.
    const CAPTURE_SPEED: f32 = 0.25;        // progress per second
    const DECAY_SPEED: f32 = 0.10;          // decay when empty / contested
    const CAPTURE_THRESHOLD: f32 = 1.0;     // when |capture| >= 1.0, flip owner
    const TICKET_BLEED_PER_FLAG: f32 = 0.5; // tickets per second per extra flag

    // === 1) Update capture progress for each flag ===
    for flag in flags.iter_mut() {
        let mut count_a = 0u32;
        let mut count_b = 0u32;

        // Count players inside radius by team.
        for p in players.values() {
            if p.is_dead {
                continue;
            }

            let dx = p.transform.x - flag.x;
            let dy = p.transform.y - flag.y;
            let dz = p.transform.z - flag.z;
            let dist_sq = dx * dx + dy * dy + dz * dz;

            if dist_sq <= flag.radius * flag.radius {
                match p.team {
                    TeamId::TeamA => count_a += 1,
                    TeamId::TeamB => count_b += 1,
                    _ => {}
                }
            }
        }

        // Debug: if anyone is in the zone, log counts once per tick.
        if count_a > 0 || count_b > 0 {
            println!(
                "[CONQUEST-TRACE] Flag {} players in radius: A={} B={} (pos=({:.1},{:.1},{:.1}), r={:.1})",
                flag.id, count_a, count_b, flag.x, flag.y, flag.z, flag.radius
            );
        }

        let old_owner = flag.owner;

        // Decide capture direction.
        let delta = if count_a > 0 && count_b == 0 {
            // Team A capturing.
            CAPTURE_SPEED * dt
        } else if count_b > 0 && count_a == 0 {
            // Team B capturing.
            -CAPTURE_SPEED * dt
        } else if count_a == 0 && count_b == 0 {
            // No one here: decay toward 0.
            if flag.capture > 0.0 {
                -DECAY_SPEED * dt
            } else if flag.capture < 0.0 {
                DECAY_SPEED * dt
            } else {
                0.0
            }
        } else {
            // Contested: decay toward 0.
            if flag.capture > 0.0 {
                -DECAY_SPEED * dt
            } else if flag.capture < 0.0 {
                DECAY_SPEED * dt
            } else {
                0.0
            }
        };

        flag.capture += delta;

        // Clamp capture to [-1.0, 1.0].
        if flag.capture > 1.0 {
            flag.capture = 1.0;
        }
        if flag.capture < -1.0 {
            flag.capture = -1.0;
        }

        // Debug: show capture progress if it's doing anything noticeable.
        if flag.capture.abs() > 0.01 {
            println!(
                "[CONQUEST-TRACE] Flag {} capture={:.2} owner={:?} (A={}, B={})",
                flag.id, flag.capture, flag.owner, count_a, count_b
            );
        }

        // Flip ownership when fully captured.
        if flag.capture >= CAPTURE_THRESHOLD && flag.owner != TeamId::TeamA {
            flag.owner = TeamId::TeamA;
        } else if flag.capture <= -CAPTURE_THRESHOLD && flag.owner != TeamId::TeamB {
            flag.owner = TeamId::TeamB;
        }

        // Log only when the owner actually changes.
        if old_owner != flag.owner {
            match flag.owner {
                TeamId::TeamA => {
                    println!("[CONQUEST] Flag {} captured by Team A", flag.id);
                }
                TeamId::TeamB => {
                    println!("[CONQUEST] Flag {} captured by Team B", flag.id);
                }
                _ => {
                    println!("[CONQUEST] Flag {} became neutral", flag.id);
                }
            }
        }
    }

    // === 2) Ticket bleed based on majority control ===
    let mut owned_a = 0u32;
    let mut owned_b = 0u32;

    for flag in flags.iter() {
        match flag.owner {
            TeamId::TeamA => owned_a += 1,
            TeamId::TeamB => owned_b += 1,
            _ => {}
        }
    }

    if owned_a > owned_b {
        let advantage = (owned_a - owned_b) as f32;
        let bleed = advantage * TICKET_BLEED_PER_FLAG * dt;
        *tickets_b -= bleed;
        if *tickets_b < 0.0 {
            *tickets_b = 0.0;
        }
    } else if owned_b > owned_a {
        let advantage = (owned_b - owned_a) as f32;
        let bleed = advantage * TICKET_BLEED_PER_FLAG * dt;
        *tickets_a -= bleed;
        if *tickets_a < 0.0 {
            *tickets_a = 0.0;
        }
    }
}
