
# Weapons & Classes — Data-Driven, Server-Authoritative

This document describes the weapon and class system in bf42lite.

---

## 1. Overview

All **gameplay-critical** weapon and class stats are **owned by the server (Rust)**.  
The client loads the same data only for:

- prediction  
- HUD labels  
- recoil/crosshair visuals  
- ammo indicators  

Damage, RPM enforcement, and hit validation are always done on the server.

---

## 2. Data Sources

### 2.1 game_config.toml  
Movement, conquest, and global rules.

### 2.2 weapons.json / classes.json  
Per-weapon fields such as:

- damage  
- rpm  
- muzzle velocity  
- ammo capacity  
- allowed classes  

These are loaded by Rust at startup.

---

## 3. Server Responsibilities

Server controls:

- Bullet/hit detection  
- Damage calculation  
- Fire rate enforcement  
- Ammo consumption  
- Weapon switching validation  
- Reload timing  
- Death state  

This eliminates prediction cheating and client authority.

---

## 4. Client Responsibilities

Client uses the same weapon definitions to:

- animate recoil  
- draw crosshair expansion  
- show weapon name  
- show ammo HUD  
- play sound/muzzle flash  
- predict local refire timing (cosmetic only)

Server may override predicted refire with snapshots.

---

## 5. Snapshot Data

Snapshot includes:

```ts
entity.weapon_state = {
  weapon_id: number,
  ammo_current: number,
  ammo_reserve: number,
  is_reloading: boolean,
}
Client mirrors this exactly.

6. Fire Request Flow
Client → send fire request.

Server:

checks RPM

checks ammo

checks hit

applies damage

updates ammo

Snapshot → client shows:

ammo

hitmarker

death state

7. Why Server Authoritative
Prevents exploited RPM

Consistent, fair damage

Predictable balancing

Multiplayer-safe