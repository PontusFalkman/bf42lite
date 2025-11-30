# Conquest System — Authoritative Server Implementation (2025)

This document explains the **server-side Conquest system**.  
Everything in this file reflects the **current**, fully server-authoritative model.

---

## 1. Overview

Conquest is managed entirely on the **server (Rust)**.  
The client simply renders whatever the snapshot provides.

Server maintains:

- Flag ownership & capture progress  
- Tickets for both teams  
- Ticket loss per death  
- Ticket bleed from flag majority  
- Match end conditions  
- Winner declaration  

This ensures all gameplay logic is secure and consistent across clients.

---

## 2. Capture Logic

Each flag is represented as:

```rust
pub struct FlagZone {
    pub id: u32,
    pub x: f32,
    pub y: f32,
    pub z: f32,
    pub radius: f32,
    pub owner: TeamId,
    pub capture: f32,  // -1.0..1.0
}
Steps per tick:
Count players inside radius per team.

Choose capture direction:

If only Team A present → capture += speed

If only Team B present → capture -= speed

If contested or empty → capture decays toward 0

Flip owner if capture >= 1.0 or <= -1.0.

Write updated flags into the snapshot.

3. Tickets
Tickets represent remaining team strength.

Server updates tickets through:

3.1 Ticket Loss per Death
Triggered in combat system:

Team of the dead player loses tickets_per_death.

3.2 Ticket Bleed
Controlled by majority flag ownership:

css
Copy code
if A owns more flags → B bleeds
if B owns more flags → A bleeds
Amount:

ini
Copy code
bleed = advantage * tickets_per_bleed * dt
3.3 Ticket Floor
Tickets never go below 0.

4. Match End
The server marks the match as ended when:

nginx
Copy code
team_a_tickets <= 0  → winner = TeamB
team_b_tickets <= 0  → winner = TeamA
This sets:

rust
Copy code
match_ended = true
winner = Some(TeamWinner)
These values are included in the snapshot’s game_state.

5. Config-Driven Conquest
Defined in game_config.toml:

toml
Copy code
[conquest]
team_a_initial_tickets = 100
team_b_initial_tickets = 100
tickets_per_death = 1
tickets_per_bleed = 1
bleed_interval_seconds = 5.0
The server reads these at startup and initializes ConquestState accordingly.

6. Snapshot Fields
Server sends:

ts
Copy code
game_state: {
  team_a_tickets: number,
  team_b_tickets: number,
  match_ended: boolean,
  winner: 'TEAM_A' | 'TEAM_B' | null
}

flags: FlagSnapshot[]
Client HUD uses these values exclusively.

7. Client Role
Client is purely visual:

Draws flags on minimap

Shows capture bar from flag.capture

Shows ticket counts

Plays capture/bleed animations

Shows game-over screen from game_state.match_ended

Client does not compute tickets or capture.