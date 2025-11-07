use serde::{Deserialize, Serialize};

// --- 1. Component Structs (Ported from components.ts) ---

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq)]
pub struct Transform {
    pub x: f32,
    pub y: f32,
    pub z: f32,
    pub yaw: f32,
    pub pitch: f32,
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq)]
pub struct Velocity {
    pub x: f32,
    pub y: f32,
    pub z: f32,
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq)]
pub struct Health {
    pub current: f32,
    pub max: f32,
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq)]
pub struct Team {
    pub id: u8,
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq)]
pub struct PlayerStats {
    pub kills: u16,
    pub deaths: u16,
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq)]
pub struct GameState {
    pub phase: u8,
    pub team1_tickets: i16,
    pub team2_tickets: i16,
}

// "Tag" component
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq)]
pub struct Player;

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq)]
pub struct Input {
    pub move_fwd: u8,
    pub move_back: u8,
    pub move_left: u8,
    pub move_right: u8,
    pub yaw: f32,
    pub pitch: f32,
}

// --- Constants (From bf_42_lite_simplified_docs.md) ---
const SPEED: f32 = 3.0;

// --- 2. The Main WorldState ---
// This is the object that gets passed between JS and Rust
#[derive(Serialize, Deserialize, Debug)]
pub struct WorldState {
    pub dt: f32,
    
    // Data for MovementSystem
    pub move_eids: Vec<u32>, // EIDs with Transform + Velocity
    pub transforms: Vec<Transform>,
    pub velocities: Vec<Velocity>,

    // Data for GameModeSystem
    pub game_state_eid: Option<u32>, // The single game entity
    pub game_states: Vec<GameState>,

    // Data for InputSystem
    pub input_eids: Vec<u32>, // EIDs with Input, Transform, Velocity
    pub inputs: Vec<Input>,
    // (InputSystem also uses 'transforms' and 'velocities' defined above)
}


// --- 3. Ported Systems (Logic) ---

/**
 * Port of Input System
 * (Logic from bf_42_lite_simplified_docs.md)
 */
pub fn input_system(world: &mut WorldState) {
    for &eid in &world.input_eids {
        let i = eid as usize;

        // Get all the components for this entity
        if let (Some(input), Some(transform), Some(velocity)) = (
            world.inputs.get(i),
            world.transforms.get_mut(i),
            world.velocities.get_mut(i)
        ) {
            // 1. Apply look (rotation) directly to Transform
            transform.yaw = input.yaw;
            transform.pitch = input.pitch;

            // 2. Apply movement input to Velocity
            let mut move_x = 0.0;
            let mut move_z = 0.0;

            if input.move_fwd > 0 { move_z = -1.0; } // Z- is forward
            if input.move_back > 0 { move_z = 1.0; }
            if input.move_left > 0 { move_x = -1.0; }
            if input.move_right > 0 { move_x = 1.0; }

            // TODO: Apply yaw rotation to velocity vector
            // For now, using simple axis-aligned movement as per docs
            velocity.x = move_x * SPEED;
            velocity.z = move_z * SPEED;
        }
    }
}

/**
 * Port of MovementSystem
 * (Logic from packages/sim/src/systems.ts)
 */
pub fn movement_system(world: &mut WorldState) {
    let dt = world.dt;
    
    for &eid in &world.move_eids {
        let i = eid as usize; // eid is the index
        
        if let (Some(transform), Some(velocity)) = 
            (world.transforms.get_mut(i), world.velocities.get(i)) 
        {
            transform.x += velocity.x * dt;
            transform.y += velocity.y * dt;
            transform.z += velocity.z * dt;
        }
    }
}

/**
 * Port of GameModeSystem
 * (Logic from packages/sim/src/systems.ts)
 */
pub fn game_mode_system(world: &mut WorldState) {
    if let Some(eid) = world.game_state_eid {
        let i = eid as usize;
        
        if let Some(game_state) = world.game_states.get_mut(i) {
            // Only check if the game is in progress
            if game_state.phase == 1 {
                if game_state.team1_tickets <= 0 || game_state.team2_tickets <= 0 {
                    println!("[Rust GameModeSystem] Game over! Setting phase to 2 (PostMatch).");
                    game_state.phase = 2; // Set to PostMatch
                }
            }
        }
    }
}