# Vision & Core Goals (v1.3)

**Project:** bf42lite
**Genre:** LAN / Local Multiplayer FPS
**Inspiration:** Battlefield 1942
**Players:** 2–12 (MVP: 2–4)
**Platforms:** Windows (primary), Linux (AppImage), macOS (later)
**Engine Stack:** JS/TS (Client Physics) + Three.js + Tauri + Rust (Server State)

## Vision
Deliver fast and responsive LAN battles with smooth movement, readable visuals, and consistent state.
Use Client Authority for movement and aiming, while the server ensures consistent results for health, tickets, and confirmed hits.

## Core Principles
* **Client controls continuous physics** (movement, aiming).
* **Server controls all discrete game rules** (health, kills, scores).
* **Hits feel instant** (client prediction) but are reconciled by the server so all players see the same outcome.
* **Minimal setup:** single host, quick join.

## Focus
LAN gameplay (no anti-cheat, but full consistency). Updated for Client-Predicted, Server-Reconciled Hits.