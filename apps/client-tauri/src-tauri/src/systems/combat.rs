// apps/client-tauri/src-tauri/src/systems/combat.rs
use std::collections::HashMap;
use crate::player::{Player, RESPAWN_TIME};
use crate::protocol::ClientMessage;

const DAMAGE_PER_HIT: f32 = 34.0; 
const FIRE_RATE: f32 = 0.15;

pub fn update(players: &mut HashMap<u32, Player>, input_map: &HashMap<u32, ClientMessage>, dt: f32) {
    // 1. Cooldowns
    for (_, player) in players.iter_mut() {
        if player.fire_cooldown > 0.0 { player.fire_cooldown -= dt; }
        if player.is_dead {
            player.respawn_timer -= dt;
            if player.respawn_timer <= 0.0 { player.respawn(); }
        }
    }

    // 2. Hitscan
    let mut hits: Vec<(u32, u32)> = Vec::new(); 
    
    let shooter_data: Vec<(u32, f32, f32, f32, f32, f32, bool)> = players.iter()
        .map(|(id, p)| (*id, p.transform.x, p.transform.y, p.transform.z, p.transform.yaw, p.transform.pitch, p.is_dead))
        .collect();

        for (shooter_id, sx, sy, sz, syaw, spitch, sdead) in &shooter_data {
            if *sdead {
                continue;
            }
    
            if let Some(msg) = input_map.get(shooter_id) {
                // Derive the "fire" flag from the new client message shape.
                let fire = match msg {
                    ClientMessage::Input { axes, .. } => axes.shoot,
                    ClientMessage::Fire { .. } => true,           // explicit fire message = fire
                    _ => false,
                };
    
                let current_cooldown = players
                    .get(shooter_id)
                    .map(|p| p.fire_cooldown)
                    .unwrap_or(0.0);
    
                if fire && current_cooldown <= 0.0 {
                    hits.push((*shooter_id, 0));
                    println!("[COMBAT] Player {} FIRED!", shooter_id);
    
                    let origin_x = *sx;
                    let origin_y = *sy + 0.6;
                    let origin_z = *sz;
    
                    // Direction: already matched to client camera
                    let dir_x = syaw.sin() * spitch.cos();
                    let dir_y = spitch.sin();
                    let dir_z = syaw.cos() * spitch.cos();
    
                    let mut best_dist = 1000.0;
                    let mut hit_victim = None;    

                for (victim_id, victim) in players.iter() {
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
                    hits.pop(); 
                    hits.push((*shooter_id, vid));
                    println!("[COMBAT] -> HIT Player {}!", vid);
                } else {
                    println!("[COMBAT] -> MISSED");
                }
            }
        }
    }

    // 3. Apply Damage
    let mut kills_to_award: Vec<u32> = Vec::new();
    for (shooter_id, victim_id) in hits {
        if let Some(p) = players.get_mut(&shooter_id) { p.fire_cooldown = FIRE_RATE; }

        if victim_id != 0 {
            let mut killed = false;
            if let Some(victim) = players.get_mut(&victim_id) {
                victim.health -= DAMAGE_PER_HIT;
                println!("[COMBAT] Player {} HP: {:.1}", victim_id, victim.health);
                if victim.health <= 0.0 {
                    victim.health = 0.0;
                    victim.is_dead = true;
                    victim.respawn_timer = RESPAWN_TIME;
                    victim.score_deaths += 1;
                    println!("[COMBAT] Player {} ELIMINATED by Player {}", victim_id, shooter_id);
                    killed = true;
                }
            }
            if killed { kills_to_award.push(shooter_id); }
        }
    }
    
    // 4. Scores
    for shooter_id in kills_to_award {
        if let Some(shooter) = players.get_mut(&shooter_id) { shooter.score_kills += 1; }
    }
}