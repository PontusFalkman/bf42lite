// File: apps/client-tauri/src-tauri/src/main.rs

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod sim;

use futures_util::{SinkExt, StreamExt};
use once_cell::sync::Lazy;
use rmp_serde::from_slice;
use serde::Deserialize;
use sim::{Game, TickSnapshot, TICK_DT};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::mpsc::{self, UnboundedSender};
use tokio_tungstenite::tungstenite::Message;

// --- Global state for the game server ---
type ClientTx = UnboundedSender<Message>;
static GAME: Lazy<Arc<Mutex<Game>>> = Lazy::new(|| Arc::new(Mutex::new(Game::new())));
// This map will store the EID and the "sender" half of the websocket for each client
static CLIENTS: Lazy<Arc<Mutex<HashMap<SocketAddr, (u32, ClientTx)>>>> =
    Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));

// --- Define structs to match the *exact* client message ---
// [tick, [f, r, j, f, s, sb], delta_x, delta_y]
#[derive(Deserialize)]
struct ClientInputs(f32, f32, bool, bool, bool, bool);

#[derive(Deserialize)]
struct ClientMessage(u32, ClientInputs, f32, f32);

// --- The Tokio-based asynchronous server logic ---

async fn handle_connection(stream: TcpStream, addr: SocketAddr) {
    let ws_stream = tokio_tungstenite::accept_async(stream)
        .await
        .expect("Error during the websocket handshake");

    println!("Client connected: {}", addr);

    // Create a channel for this client
    let (tx, mut rx) = mpsc::unbounded_channel();

    // Add client to the global map
    let eid = {
        let mut game_lock = GAME.lock().unwrap();
        game_lock.add_player()
    };
    CLIENTS.lock().unwrap().insert(addr, (eid, tx));
    println!("Client {} assigned EID {}", addr, eid);

    let (mut ws_sender, mut ws_receiver) = ws_stream.split();

    // --- Write Task (Listens on the channel and sends to client) ---
    let write_task = tokio::spawn(async move {
        while let Some(message) = rx.recv().await {
            if ws_sender.send(message).await.is_err() {
                // Client disconnected
                break;
            }
        }
    });

    // --- Read Task (Listens to client and updates game state) ---
    let read_task = tokio::spawn(async move {
        while let Some(msg) = ws_receiver.next().await {
            match msg {
                Ok(msg) => {
                    if msg.is_binary() {
                        let msg_data = msg.into_data();
                        
                        // --- THIS IS THE CORRECT DESERIALIZATION ---
                        match from_slice::<ClientMessage>(&msg_data) {
                            Ok(msg) => {
                                // msg.0 = tick (u32)
                                // msg.1 = inputs (ClientInputs)
                                // msg.2 = delta_x (f32)
                                // msg.3 = delta_y (f32) (unused)

                                let mut game = GAME.lock().unwrap();
                                if let Some(player) = game.players.get_mut(&eid) {
                                    // Manually copy inputs from the tuple
                                    player.inputs.forward = msg.1.0;
                                    player.inputs.right = msg.1.1;
                                    player.inputs.jump = msg.1.2;
                                    player.inputs.fire = msg.1.3;
                                    player.inputs.sprint = msg.1.4;
                                    player.inputs.show_scoreboard = msg.1.5;

                                    // This is the key for the rotation fix
                                    player.inputs.delta_x = msg.2;
                                }
                            }
                            Err(e) => {
                                println!("Failed to deserialize client msg: {}", e);
                            }
                        }
                    } else if msg.is_close() {
                        break; // Client initiated disconnect
                    }
                }
                Err(e) => {
                    println!("Websocket error: {}", e);
                    break;
                }
            }
        }
    });

    // Wait for either task to finish (e.g., client disconnects)
    tokio::select! {
        _ = write_task => {},
        _ = read_task => {},
    }

    // --- Client Cleanup ---
    println!("Client {} disconnected.", addr);
    CLIENTS.lock().unwrap().remove(&addr);
    GAME.lock().unwrap().remove_player(eid);
}

// --- FIX 1: Removed #[tokio::main] ---
async fn run_server() {
    let server = TcpListener::bind("127.0.0.1:8080")
        .await
        .expect("Failed to bind server");
    println!("Server listening on ws://127.0.0.1:8080");

    // --- Game Tick Loop Thread (Blocking) ---
    let game_clone = GAME.clone();
    std::thread::spawn(move || {
        let mut last_tick = Instant::now();
        loop {
            let now = Instant::now();
            let delta = now.duration_since(last_tick);

            if delta >= Duration::from_secs_f32(TICK_DT) {
                let mut game = game_clone.lock().unwrap();
                game.tick(TICK_DT);
                last_tick = now;
            }
            std::thread::sleep(Duration::from_millis(1)); // Prevent busy-waiting
        }
    });

    // --- Snapshot Broadcasting Loop (Async) ---
    let clients_clone = CLIENTS.clone();
    tokio::spawn(async move {
        loop {
            // Get a snapshot from the game
            let snapshot: TickSnapshot = {
                let game = GAME.lock().unwrap();
                game.get_tick_snapshot()
            };
            let encoded = rmp_serde::to_vec(&snapshot).unwrap();
            let msg = Message::Binary(encoded);

            // Send to all clients without holding the lock across await
            {
                let clients_lock = clients_clone.lock().unwrap();
                for (_, tx) in clients_lock.values() {
                    let _ = tx.send(msg.clone());
                }
            }

            // Wait for the next frame
            tokio::time::sleep(Duration::from_millis(16)).await; // ~60hz
        }
    });

    // --- Accept Connections ---
    while let Ok((stream, addr)) = server.accept().await {
        tokio::spawn(handle_connection(stream, addr));
    }
}

#[tauri::command]
async fn start_host() -> Result<(), String> {
    println!("Starting host server...");
    tokio::spawn(run_server());
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![start_host])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}