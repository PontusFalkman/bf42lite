This document describes how map data, flags, spawns, and geometry now work.

---

## 1. Overview

The **server owns all gameplay-related map data**:

- flag positions  
- flag radii  
- initial ownership  
- spawn points for teams  
- world boundaries  
- terrain areas relevant for gameplay  

The client does not own any authoritative geometry.

---

## 2. Flag Data Structure

```rust
pub struct FlagZone {
    pub id: u32,
    pub x: f32,
    pub y: f32,
    pub z: f32,
    pub radius: f32,
    pub owner: TeamId,
    pub capture: f32,
}
Flags are defined in Rust under maps/ and loaded into the simulation.

3. Spawn Points
Rust provides spawn positions for:

Team A bases

Team B bases

Possible forward spawns (later)

Safe spawn checks

Client only shows spawn UI; server validates and executes respawns.

4. Why Server Owns Map Data
Prevents client-side cheating by altering geometry

Ensures consistent collision and capture zones

Simplifies gameplay code

Makes flag ownership authoritative

Client’s map/minimap is presentation-only.

5. Snapshot Map Data
Snapshots include:

ts
Copy code
flags[] {
  id,
  x, y, z,
  radius,
  owner,
  capture
}
Client uses this purely to draw UI.

6. Future Extensions
The current model supports future systems:

dynamic objectives

vehicle spawns

destructible structures

map scripting (scripted events)

line-of-sight / minimap fog-of-war