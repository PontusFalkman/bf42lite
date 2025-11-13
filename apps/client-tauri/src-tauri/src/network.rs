// apps/client-tauri/src-tauri/src/network.rs

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use tokio::net::{TcpListener, TcpStream};
use tokio::sync::Mutex as AsyncMutex; 
use futures_util::{SinkExt, StreamExt};
use tokio_tungstenite::{accept_async, tungstenite::protocol::Message};
use rmp_serde::to_vec as rmp_to_vec;

use crate::sim::{SimState, ClientMessage, TickSnapshot, ServerEnvelope};

pub async fn start_server(
    addr: &str,
    sim: Arc<Mutex<SimState>>,
    inputs: Arc<Mutex<HashMap<u32, ClientMessage>>>
) -> Result<(), String> {
    let listener = TcpListener::bind(addr).await.map_err(|e| e.to_string())?;
    
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
    let addr = stream.peer_addr().expect("Failed to get peer address");
    println!("Client connected: {}", addr);

    let ws_stream = match accept_async(stream).await {
        Ok(ws) => ws,
        Err(e) => { println!("Handshake error: {}", e); return; }
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

    // 3) Spawn Snapshot Sender (20 Hz Background Loop)
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

    // 4) Read Client Inputs
    while let Some(msg) = ws_read.next().await {
        match msg {
            Ok(Message::Binary(bin)) => {
                if let Ok(client_msg) = rmp_serde::from_slice::<ClientMessage>(&bin) {
                    inputs.lock().unwrap().insert(my_id, client_msg);
                    
                    // === RESTORED: Immediate Echo on Input ===
                    // (This was missing in the previous draft)
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
                    // =========================================
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