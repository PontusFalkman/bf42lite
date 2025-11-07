\# Vision \& Core Goals (v1.2)



\## Project Overview

\*\*Name:\*\* bf42lite  

\*\*Genre:\*\* LAN / Local Multiplayer First-Person Shooter  

\*\*Inspiration:\*\* Battlefield 1942 (simplified)  

\*\*Perspective:\*\* First-person  

\*\*Players:\*\* 2–12 (focus on 2–4 for MVP)  

\*\*Target Platforms:\*\* Windows (primary), Linux (AppImage), macOS (later)



\## Vision

Provide fast, deterministic LAN battles with a retro look and clear, readable combat.  

Stability, predictability, and modularity are more important than realism or visual fidelity.



\## Core Principles

\- \*\*Deterministic simulation:\*\* Fixed 60 Hz tick, predictable results.

\- \*\*Modular architecture:\*\* Simulation, networking, protocol, and client kept separate.

\- \*\*Rust-ready:\*\* Simulation can migrate from TypeScript to Rust without rewriting client/UI.

\- \*\*Low friction:\*\* Single binary can host and join matches; minimal setup.



\## Scope by Phase

\- \*\*Phase 1:\*\* Local ECS movement + renderer.

\- \*\*Phase 2:\*\* LAN loopback and snapshot sync.

\- \*\*Phase 3:\*\* Visual polish, HUD, basic map.

\- \*\*Phase 4:\*\* Core gameplay (combat, tickets, optional Rust tick bridge).

\- \*\*Phase 5:\*\* Modern features, gadgets, optional vehicles and dedicated server.



Next: \[20\_design\_gameplay.md](./20\_design\_gameplay.md)



