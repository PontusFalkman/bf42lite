==============================

FRAMETIME \& TICKRATE (TXT)

==============================



bf42lite uses a classic networked-FPS timing model inspired by GoldSrc / Source, designed for predictable simulation, smooth rendering, and minimal input latency.



This document defines how frametime, tickrate, and snapshot frequency interact.



Key Concepts



FPS (Frames Per Second)

How many frames the client renders each second.

Typical targets for bf42lite presets:



Potato: 30 FPS



Medium: 90 FPS



High: 120 FPS



Frametime

The duration of one frame. Lower is better.

Examples:



30 FPS → ~33ms



60 FPS → ~16.6ms



90 FPS → ~11.1ms



120 FPS → ~8.3ms



Simulation Tick (Server Tickrate)

How often the server simulates and sends authoritative updates.

Example:



30 Hz tickrate → simulation every 33ms



60 Hz tickrate → simulation every 16.6ms



bf42lite aims for 60 Hz server simulation by default.



Snapshot Frequency

How often the server sends world snapshots to clients. Usually equal to tickrate unless throttled.



Interpolation

Client blends between snapshots to smooth movement. Prevents jitter.



Prediction

Client simulates its own player until an authoritative snapshot arrives.



High-Level Model



Server simulates at 60 Hz



Server sends snapshots at 60 Hz (or throttled to ~30 Hz for weak clients)



Client renders at independent FPS: 30 / 90 / 120 depending on preset



Client interpolates between snapshots



Client predicts local movement and corrects with reconciliation



This decouples rendering from simulation.



Why 60 Hz Simulation Is Chosen



Simple and stable timing (16.6ms steps)



Easy to interpolate to ANY render FPS (30, 60, 90, 120, 144)



Compatible with handhelds and midrange PCs



Keeps network bandwidth reasonable



GoldSrc, Source, Quake, Overwatch 1, TF2 all used similar logic



How Rendering Interacts With Tickrate



Rendering FPS is NOT required to match server tickrate.

Examples:



Case 1: 30 FPS (Potato) vs 60 Hz server



Render every 33ms



Interpolate between every 2 server ticks



Input latency increases, but gameplay stays predictable



Good for weak hardware



Case 2: 90 FPS (Steam Deck OLED) vs 60 Hz server



Render every 11ms



Smooth visual interpolation



Input sampled 3 times per simulation step



Very responsive handheld experience



Case 3: 120 FPS (PC) vs 60 Hz server



Render every ~8ms



High fluidity



Low input latency



Great for 120/144 Hz monitors



In all cases, gameplay correctness remains identical.



Recommended Snapshot Strategy



Default:



60 Hz snapshots for Medium and High presets



Fallback:



30 Hz snapshots for Potato preset (if bandwidth or CPU is restricted)



Client interpolation handles both cases smoothly.



Input Sampling



Client should sample inputs every render frame.

This means:



30 FPS preset samples input 30 times per second



90 FPS preset samples input 90 times per second



120 FPS preset samples input 120 times per second



Inputs are bundled and sent to the server at a fixed rate (e.g., 60 Hz).



Input latency is therefore tied more to frametime than to tickrate.



Reconciliation Loop



When a snapshot arrives:



Correct local player authoritative state



Reapply stored inputs (unacknowledged steps)



Fix visual errors via interpolation and smoothing



This ensures consistency across all three presets.



Frametime Stability



Stable frametime is more important than raw FPS.



A stable:



30 FPS (33ms)

feels better than a spiky:



45 → 70 → 50 → 85 → 40 FPS



Your 30/90/120 targets are chosen because:



They divide evenly into 60 Hz simulation



They match common screen refresh rates



They keep frametime stable and predictable



Summary of Target Rates



POTATO:



Render: 30 FPS



Server tick: 60 Hz



Snapshots: 30–60 Hz depending on bandwidth



Goal: keep frametime consistent for weak hardware



MEDIUM (Steam Deck OLED):



Render: 90 FPS



Server tick: 60 Hz



Snapshots: 60 Hz



Goal: extremely smooth handheld experience



HIGH (1080p PC):



Render: 120 FPS



Server tick: 60 Hz



Snapshots: 60 Hz



Goal: high responsiveness for 120/144 Hz players

