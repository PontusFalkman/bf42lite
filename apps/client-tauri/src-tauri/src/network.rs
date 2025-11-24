// apps/client-tauri/src-tauri/src/network.rs
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use tokio::net::{TcpListener, TcpStream};
use tokio::sync::Mutex as AsyncMutex;
use futures_util::{SinkExt, StreamExt};
use tokio_tungstenite::{accept_async, tungstenite::protocol::Message};
use rmp_serde::to_vec as rmp_to_vec;

use crate::sim::SimState;
use crate::protocol::{ClientMessage, TickSnapshot, ServerEnvelope};

pub async fn start_server(
    addr: &str,
    sim: Arc<Mutex<SimState>>,
    inputs: Arc<Mutex<HashMap<u32, ClientMessage>>>,
) -> Result<(), String> {
    let listener = TcpListener::bind(addr)
        .await
        .map_err(|e| e.to_string())?;

    // Accept loop
    while let Ok((stream, _)) = listener.accept().await {
        tokio::spawn(accept_connection(
            stream,
            sim.clone(),
            inputs.clone(),
        ));
    }

    Ok(())
}

async fn accept_connection(
    stream: TcpStream,
    sim: Arc<Mutex<SimState>>,
    inputs: Arc<Mutex<HashMap<u32, ClientMessage>>>,
) {
    let addr = stream
        .peer_addr()
        .expect("Failed to get peer address");
    println!("Client connected: {}", addr);

    let ws_stream = match accept_async(stream).await {
        Ok(ws) => ws,
        Err(e) => {
            println!("Handshake error: {}", e);
            return;
        }
    };

    // Split stream and wrap writer
    let (ws_write_raw, mut ws_read) = ws_stream.split();
    let ws_write = Arc::new(AsyncMutex::new(ws_write_raw));

    // 1) Assign Player ID
    let my_id = {
        let mut s = sim.lock().unwrap();
        let id = s.players.len() as u32 + 1;
        s.handle_join(id);
        id
    };

    // 2) Send Initial Snapshot
    let initial_bin = {
        let mut s = sim.lock().unwrap();
        let snapshot: TickSnapshot = s.update(0.0, &HashMap::new());
        rmp_to_vec(&ServerEnvelope {
            your_id: my_id,
            snapshot,
        })
        .unwrap()
    };

    if ws_write
        .lock()
        .await
        .send(Message::Binary(initial_bin))
        .await
        .is_err()
    {
        println!("Failed to send initial snapshot to {}", addr);
        return;
    }

    // 3) Spawn Snapshot Sender (20 Hz Background Loop)
    {
        let sim_for_send = Arc::clone(&sim);
        let inputs_for_send = Arc::clone(&inputs);
        let ws_for_send = Arc::clone(&ws_write);
        let my_id_send = my_id;

        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_millis(50));
            let mut last_instant = Instant::now();

            loop {
                interval.tick().await;

                // Compute delta time in seconds
                let now = Instant::now();
                let dt = (now - last_instant).as_secs_f32();
                last_instant = now;

                // Advance sim and get snapshot using current input map
                let snapshot: TickSnapshot = {
                    let mut s = sim_for_send.lock().unwrap();
                    let input_map = inputs_for_send.lock().unwrap();
                    s.update(dt, &*input_map)
                };

                let envelope = ServerEnvelope {
                    your_id: my_id_send,
                    snapshot,
                };

                let bytes = rmp_to_vec(&envelope).unwrap();
                if ws_for_send
                    .lock()
                    .await
                    .send(Message::Binary(bytes))
                    .await
                    .is_err()
                {
                    break; // client disconnected
                }
            }
        });
    }

    // 4) Read Client Inputs
    while let Some(msg) = ws_read.next().await {
        match msg {
            Ok(Message::Binary(bin)) => {
                // Debug: see that we got a binary message
                println!(
                    "[NET] Received Binary message of {} bytes from player {}",
                    bin.len(),
                    my_id
                );

                match rmp_serde::from_slice::<ClientMessage>(&bin) {
                    Ok(client_msg) => {
                        // Debug: confirm decode worked
                        println!(
                            "[NET] Decoded ClientMessage from player {}: {:?}",
                            my_id, client_msg
                        );

                        // Store latest input for this player
                        inputs.lock().unwrap().insert(my_id, client_msg);
                        // Note: we do NOT send a snapshot here anymore.
                        // The periodic GameLoop::start task handles snapshots.
                    }
                    Err(e) => {
                        eprintln!(
                            "[NET] Failed to decode ClientMessage from player {}: {:?} ({} bytes)",
                            my_id,
                            e,
                            bin.len()
                        );
                    }
                }
            }
            Ok(Message::Close(_)) => break,
            _ => {}
        }
    }

    // 5) Disconnect Cleanup
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
use serde::{Deserialize, Serialize};
use crate::protocol::{Transform, TeamId};

pub const MAX_HEALTH: f32 = 100.0;
pub const RESPAWN_TIME: f32 = 5.0;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Player {
    pub id: u32,
    pub transform: Transform,
    pub velocity: (f32, f32, f32),
    pub team: TeamId,
    pub health: f32,
    pub max_health: f32,
    pub is_dead: bool,
    pub respawn_timer: f32,
    pub fire_cooldown: f32, 
    pub score_kills: u32,
    pub score_deaths: u32,
    pub class_id: u8,
}

impl Player {
    pub fn new(id: u32, team: TeamId) -> Self {
        Self {
            id,
            transform: Transform { x: 0.0, y: 2.0, z: 0.0, yaw: 0.0, pitch: 0.0 },
            velocity: (0.0, 0.0, 0.0),
            team,
            health: MAX_HEALTH,
            max_health: MAX_HEALTH,
            is_dead: false,
            respawn_timer: 0.0,
            fire_cooldown: 0.0,
            score_kills: 0,
            score_deaths: 0,
            class_id: 0,
        }
    }

    pub fn respawn(&mut self) {
        self.health = self.max_health;
        self.is_dead = false;
        self.fire_cooldown = 0.0;
        self.transform.x = 0.0;
        self.transform.z = 0.0; 
        self.transform.y = 2.0;
        println!("[GAME] Player {} respawned", self.id);
    }
}
