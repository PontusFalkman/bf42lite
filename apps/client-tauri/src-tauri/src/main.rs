// apps/client-tauri/src-tauri/src/main.rs

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::State;
use tokio::net::{TcpListener, TcpStream};
use tokio::time::sleep;
use futures_util::{SinkExt, StreamExt};
use tokio_tungstenite::{accept_async, tungstenite::protocol::Message};
use tokio::sync::Mutex as AsyncMutex;          // NEW
use rmp_serde::to_vec as rmp_to_vec;            // NEW

// Define the module (assumes sim.rs is in the same folder)
mod sim;
use sim::{SimState, ClientMessage, TickSnapshot, ServerEnvelope};

struct AppState {
    sim: Arc<Mutex<SimState>>,
    inputs: Arc<Mutex<HashMap<u32, ClientMessage>>>,
}

#[tauri::command]
async fn start_host(state: State<'_, AppState>) -> Result<(), String> {
    let addr = "127.0.0.1:8080";
    println!("Starting Host at ws://{}", addr);

    let listener = TcpListener::bind(addr).await.map_err(|e| e.to_string())?;
    
    let sim_state = state.sim.clone();
    let inputs_state = state.inputs.clone();

    let loop_sim = sim_state.clone();
    let loop_inputs = inputs_state.clone();
    
    tokio::spawn(async move {
        let tick_rate = Duration::from_millis(16); // ~60 FPS
        loop {
            let start = Instant::now();
            {
                let mut sim = loop_sim.lock().unwrap();
                let mut inputs = loop_inputs.lock().unwrap();
                
                sim.update(0.016, &inputs); 

                for msg in inputs.values_mut() {
                    msg.2 = 0.0; // Reset dx
                    msg.3 = 0.0; // Reset dy
                }
            }
            let elapsed = start.elapsed();
            if elapsed < tick_rate {
                sleep(tick_rate - elapsed).await;
            }
        }
    });

    tokio::spawn(async move {
        while let Ok((stream, _)) = listener.accept().await {
            tokio::spawn(accept_connection(
                stream,
                sim_state.clone(),
                inputs_state.clone(),
            ));
        }
    });

    Ok(())
}

async fn accept_connection(
    stream: TcpStream,
    sim: Arc<Mutex<SimState>>,
    inputs: Arc<Mutex<HashMap<u32, ClientMessage>>>,
) {
    let addr = stream.peer_addr().expect("Failed to get peer address");
    println!("Client connected: {}", addr);

    let ws_stream = match accept_async(stream).await {
        Ok(ws) => ws,
        Err(e) => { println!("Handshake error: {}", e); return; }
    };

    // FIX: split then wrap writer in AsyncMutex
    let (ws_write_raw, mut ws_read) = ws_stream.split();
    let ws_write = Arc::new(AsyncMutex::new(ws_write_raw)); // shareable writer


    // 1) assign id
    let my_id = {
        let mut s = sim.lock().unwrap();
        let id = s.players.len() as u32 + 1;
        s.handle_join(id);
        id
    };

    // 2) initial snapshot
    let initial_bin = {
        let mut s = sim.lock().unwrap();
        let snapshot: TickSnapshot = s.update(0.0, &HashMap::new());
        rmp_to_vec(&ServerEnvelope { your_id: my_id, snapshot }).unwrap()
    };

    if ws_write.lock().await
        .send(Message::Binary(initial_bin))
        .await
        .is_err()
    {
        println!("Failed to send initial snapshot to {}", addr);
        return;
    }

    // 4) periodic snapshots at 20 Hz
    {
        let sim_for_send = Arc::clone(&sim);
        let ws_for_send  = Arc::clone(&ws_write);
        let my_id_send   = my_id;

        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_millis(50));
            loop {
                interval.tick().await;

                let snapshot: TickSnapshot = {
                    let mut s = sim_for_send.lock().unwrap();
                    s.update(0.0, &HashMap::new())
                };

                let bytes = match rmp_to_vec(&ServerEnvelope { your_id: my_id_send, snapshot }) {
                    Ok(b) => b,
                    Err(_) => break,
                };

                if ws_for_send.lock().await
                    .send(Message::Binary(bytes))
                    .await
                    .is_err()
                {
                    break; // client disconnected
                }
            }
        });
    }


    // 3. Client Loop
    while let Some(msg) = ws_read.next().await {
        match msg {
            Ok(Message::Binary(bin)) => {
                if let Ok(client_msg) = rmp_serde::from_slice::<ClientMessage>(&bin) {
                    inputs.lock().unwrap().insert(my_id, client_msg);

                    let envelope = {
                        let mut s = sim.lock().unwrap();
                        let snapshot = s.update(0.0, &HashMap::new());
                        ServerEnvelope { your_id: my_id, snapshot }
                    };

                    let bytes = rmp_to_vec(&envelope).unwrap();
                    if ws_write.lock().await
                        .send(Message::Binary(bytes))
                        .await
                        .is_err()
                    {
                        break;
                    }
                }
            }
            Ok(Message::Close(_)) => break,
            _ => {}
        }
    }

    // 4. Disconnect
    {
        let mut s = sim.lock().unwrap();
        s.handle_disconnect(my_id);
    }
    {
        let mut inp = inputs.lock().unwrap();
        inp.remove(&my_id);
    }
    println!("Client {} disconnected", addr);
}

fn main() {
    let sim = Arc::new(Mutex::new(SimState::new()));
    let inputs = Arc::new(Mutex::new(HashMap::new()));

    tauri::Builder::default()
        .manage(AppState { sim, inputs })
        .invoke_handler(tauri::generate_handler![start_host])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}