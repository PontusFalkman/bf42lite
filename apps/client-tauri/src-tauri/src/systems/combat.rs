// apps/client-tauri/src-tauri/src/systems/combat.rs
use std::collections::HashMap;
use crate::player::{Player, RESPAWN_TIME};
use crate::protocol::{ClientMessage, ClientInputs};

const DAMAGE_PER_HIT: f32 = 34.0; 
const FIRE_RATE: f32 = 0.15;

pub fn update(players: &mut HashMap<u32, Player>, input_map: &HashMap<u32, ClientMessage>, dt: f32) {
    // 1. Cooldowns
    // === FIX: Changed 'id' to '_' to silence unused variable warning ===
    for (_, player) in players.iter_mut() {
        if player.fire_cooldown > 0.0 { 
            player.fire_cooldown -= dt; 
        }
        
        // Handle Respawn Timer
        if player.is_dead {
            player.respawn_timer -= dt;
            if player.respawn_timer <= 0.0 { 
                player.respawn(); 
            }
        }
    }

    // 2. Hitscan Logic
    let mut hits: Vec<(u32, u32)> = Vec::new(); 

    // We have to iterate differently to compare shooter vs victims
    // A read-only clone or double-loop approach is needed to satisfy borrow checker.
    // Since we moved this to a function, we can collect necessary data first.
    
    let shooter_data: Vec<(u32, f32, f32, f32, f32, f32, bool)> = players.iter()
        .map(|(id, p)| (*id, p.transform.x, p.transform.y, p.transform.z, p.transform.yaw, p.transform.pitch, p.is_dead))
        .collect();

    for (shooter_id, sx, sy, sz, syaw, spitch, sdead) in &shooter_data {
        if *sdead { continue; }

        if let Some(msg) = input_map.get(shooter_id) {
            let ClientInputs(_, _, _, fire, _, _) = msg.1;
            let shooter_cooldown = players.get(shooter_id).unwrap().fire_cooldown;

            if fire && shooter_cooldown <= 0.0 {
                println!("[COMBAT] Player {} FIRED!", shooter_id);
                
                // Register that this player shot (for cooldown reset later)
                hits.push((*shooter_id, 0)); // 0 means "shot but maybe didn't hit"

                let origin_x = *sx;
                let origin_y = *sy + 0.6; 
                let origin_z = *sz;
                
                let dir_x = -syaw.sin() * spitch.cos();
                let dir_y = spitch.sin();
                let dir_z = -syaw.cos() * spitch.cos();

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
                    // Replace the "0" entry with the actual victim
                    hits.pop(); 
                    hits.push((*shooter_id, vid));
                    println!("[COMBAT] -> HIT Player {}!", vid);
                } else {
                    println!("[COMBAT] -> MISSED");
                }
            }
        }
    }

    // 3. Apply Damage & Cooldowns
    for (shooter_id, victim_id) in hits {
        // Apply cooldown to shooter
        if let Some(p) = players.get_mut(&shooter_id) { 
            p.fire_cooldown = FIRE_RATE; 
        }

        // Apply damage to victim (if valid)
        if victim_id != 0 {
            if let Some(victim) = players.get_mut(&victim_id) {
                victim.health -= DAMAGE_PER_HIT;
                println!("[COMBAT] Player {} took damage. HP: {}", victim_id, victim.health);

                if victim.health <= 0.0 {
                    victim.health = 0.0;
                    victim.is_dead = true;
                    victim.respawn_timer = RESPAWN_TIME;
                    victim.score_deaths += 1;
                    println!("[COMBAT] Player {} ELIMINATED.", victim_id);
                    
                    // Award Kill
                    // (We have to re-borrow shooter here, careful with the borrow checker)
                    // Since we are modifying victim now, we can't modify shooter in the same scope easily
                    // without a second pass or RefCell. 
                    // For this simple refactor, we will defer the kill score update slightly.
                }
            }
            
            // Award Kill (Safe Pass)
            if let Some(victim) = players.get(&victim_id) {
                 if victim.is_dead && victim.health == 0.0 {
                      // Check if this specific shot killed them (this is a simplified check)
                      if let Some(shooter) = players.get_mut(&shooter_id) {
                           shooter.score_kills += 1;
                      }
                 }
            }
        }
    }
}