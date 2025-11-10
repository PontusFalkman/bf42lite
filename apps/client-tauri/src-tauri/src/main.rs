// apps/client-tauri/src-tauri/src/main.rs

// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// --- N2: Add All Imports ---
use futures_util::{stream::StreamExt, SinkExt};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::State;
use tokio::net::{TcpListener, TcpStream};
use tokio_tungstenite::{accept_async, tungstenite::protocol::Message};

// N2: Import your sim structs from lib.rs (which points to sim.rs)
use bf42lite_lib::sim::{
    EntitySnapshot, GameModeState, Health, InputPayload, InputPayloadWire, Score, Stamina, Team,
    TeamId, TickSnapshot, Transform,
};
// --- End N2 Imports ---

// --- N2: Define the Game State ---
#[derive(Debug, Clone)]
struct GameState {
    tick: u32,
    entities: HashMap<u32, EntitySnapshot>,
    game_mode: GameModeState,
    next_eid: u32,
}

impl GameState {
    fn new() -> Self {
        Self {
            tick: 0,
            entities: HashMap::new(),
            game_mode: GameModeState {
                team_a_tickets: 100,
                team_b_tickets: 100,
                match_ended: false,
                winner: TeamId::None,
            },
            next_eid: 1,
        }
    }

    // Creates a new player entity and returns its ID
    fn add_player(&mut self) -> u32 {
        let eid = self.next_eid;
        self.next_eid += 1;

        let player_entity = EntitySnapshot {
            eid,
            transform: Transform { x: 0.0, y: 1.0, z: 0.0 }, // Start at world origin
            health: Some(Health { current: 100.0, max: 100.0 }),
            stamina: Some(Stamina { 
                current: 100.0, 
                max: 100.0, 
                regen_rate: 5.0,
                drain_rate: 10.0
            }),
            team: Some(Team { id: TeamId::TeamA }),
            score: Some(Score { kills: 0, deaths: 0 }),
        };

        self.entities.insert(eid, player_entity);
        println!("Host: Added player with EID: {}", eid);
        eid
    }

    // Applies a client's input payload to the game state
    fn step(&mut self, eid: u32, payload: InputPayload) {
        self.tick = payload.tick; // Use client's tick for now

        if let Some(entity) = self.entities.get_mut(&eid) {
            // This is a minimal version of your movement system
            let speed = 3.0 / 60.0; // speed * dt
            entity.transform.x += payload.inputs.right * speed;
            entity.transform.z -= payload.inputs.forward * speed;
        }
    }

    // Creates a snapshot of the current world
    fn get_snapshot(&self) -> TickSnapshot {
        TickSnapshot {
            entities: self.entities.values().cloned().collect(),
            game_state: self.game_mode,
        }
    }
}

// This state is managed by Tauri and shared with all commands
struct AppState(Arc<Mutex<GameState>>);
// --- End N2 Game State ---

// --- N2: The new "start host" command ---
#[tauri::command]
async fn start_host(state: State<'_, AppState>) -> Result<(), String> {
    let addr = "127.0.0.1:8080";
    println!("Starting WebSocket host at: ws://{}", addr);

    let listener = TcpListener::bind(addr).await.map_err(|e| e.to_string())?;

    let game_state_arc = state.0.clone();

    // Spawn the main server task. It will run forever.
    tokio::spawn(async move {
        while let Ok((stream, _)) = listener.accept().await {
            // For each new connection, spawn a new task to handle it
            tokio::spawn(accept_connection(
                stream,
                game_state_arc.clone(),
            ));
        }
    });

    Ok(())
}

// --- N2: Connection Handler ---
async fn accept_connection(stream: TcpStream, game_state_arc: Arc<Mutex<GameState>>) {
    let addr = stream.peer_addr().expect("Failed to get peer address");
    println!("New client connected: {}", addr);

    let ws_stream = match accept_async(stream).await {
        Ok(ws) => ws,
        Err(e) => {
            println!("WebSocket handshake error: {}", e);
            return;
        }
    };

    let (mut ws_write, mut ws_read) = ws_stream.split();

    // --- N2: Client "Join" Logic ---
    let player_eid = {
        let mut state = game_state_arc.lock().unwrap();
        state.add_player()
    };
    
    let first_snapshot = {
        let state = game_state_arc.lock().unwrap();
        state.get_snapshot()
    };

    let snapshot_bin = rmp_serde::to_vec(&first_snapshot).expect("Failed to serialize snapshot");
    if ws_write.send(Message::Binary(snapshot_bin)).await.is_err() {
        println!("Failed to send first snapshot to {}", addr);
        return;
    }
    // --- End N2 Join ---


    // --- N2: Main Client Loop ---
    while let Some(msg) = ws_read.next().await {
        let msg = match msg {
            Ok(msg) => msg,
            Err(e) => {
                println!("Error reading message from {}: {}", addr, e);
                break;
            }
        };

        match msg {
            Message::Binary(bin) => {
                // 1. Decode the client's input as tuple [tick, inputs, delta_x, delta_y]
                let wire: InputPayloadWire = match rmp_serde::from_slice(&bin) {
                    Ok(w) => w,
                    Err(e) => {
                        println!("Failed to decode InputPayloadWire: {}", e);
                        continue;
                    }
                };
                let payload: InputPayload = wire.into();

                // 2. Lock the state and run one simulation tick
                let snapshot = {
                    let mut state = game_state_arc.lock().unwrap();
                    state.step(player_eid, payload);
                    state.get_snapshot()
                };

                // 3. Serialize and send the new state back
                let snapshot_bin = rmp_serde::to_vec(&snapshot).expect("Failed to serialize snapshot");
                if ws_write.send(Message::Binary(snapshot_bin)).await.is_err() {
                    println!("Failed to send snapshot to {}", addr);
                    break;
                }
            }
            Message::Text(txt) => {
                println!("Received text message (ignoring): {}", txt);
            }
            Message::Close(_) => {
                println!("Client {} disconnected.", addr);
                break;
            }
            _ => {}
        }
    }

    // --- N2: Client "Leave" Logic ---
    println!("Cleaning up player EID: {}", player_eid);
    let mut state = game_state_arc.lock().unwrap();
    state.entities.remove(&player_eid);
    // --- End N2 Leave ---
}

fn main() {
    // N2: Create the game state and wrap it for sharing
    let game_state = Arc::new(Mutex::new(GameState::new()));

    tauri::Builder::default()
        // N2: Add the state to Tauri so commands can access it
        .manage(AppState(game_state))
        // N2: Register the one and only command
        .invoke_handler(tauri::generate_handler![start_host])
        
        .build(tauri::generate_context!()) 
        .expect("Failed to build Tauri app")
        .run(|_app_handle, _event| {}); // N2: Updated .run() for v2
}