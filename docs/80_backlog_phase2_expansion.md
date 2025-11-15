Phase 2 expands bf42lite from infantry-only combat into a simplified combined-arms Battlefield-style game.
The goal is to introduce classes, vehicles, conquest mode, dynamic spawning, and a larger map while keeping all systems “Lite” and manageable for a solo developer.

Purpose

Phase 2 introduces several major features:

• Lite classes
• Simplified vehicle framework
• Conquest game mode
• Dynamic spawnpoints
• Ticket bleed
• Stationary defenses
• Island-style combined-arms map

This phase also sets the foundation for future projects such as BF2Lite and BF2142Lite.

High-Level Deliverables

Gameplay:

Three infantry classes with simplified abilities.

Basic loadout system.

Vehicles:

GenericVehicle base class.

First vehicle: Tank using simplified hover-based movement.

Game Mode:

Conquest mode including capture points and capture progress.

Spawning:

Deploy screen allowing spawnpoint selection based on flag ownership.

Map:

Island map with flags, beaches, hills, and sea approach routes.

Balancing:

Ticket bleed based on majority flag ownership.

Stationary Defenses:

AA gun and coastal gun implemented as immobile vehicles.

Phase Breakdown

3.1. Conquest Core

Flag Zones:

Each flag has a capture radius and an ownership state.

Capture progress increases toward the team with more players inside the radius.

Progress stops if team counts are equal.

Dynamic Spawnpoints:

Each flag contains several spawnpoints.

When a team captures a flag, its spawnpoints become available to that team.

Ticket System Update:

Teams still lose a ticket when a player dies.

A team holding more than half the flags causes enemy tickets to drain slowly over time.

This component should be completed before vehicle work begins.

3.2. Lite Classes

Class Selection:

Added to Deploy Screen.

Loadouts assigned per class.

Grunt:

Primary weapon: SMG.

Ability: Heal aura activates if stationary for several seconds.

Heavy:

Primary weapon: Bazooka.

Ability: Wrench repairs friendly vehicles when used as melee.

Scout:

Primary weapon: Bolt-action rifle.

Ability: High-zoom mode for long-range aiming.

3.3. Vehicle Core Framework

Mount System:

Player enters vehicle with a key press.

Player model becomes hidden.

Camera attaches to vehicle seat.

Inputs are sent to the vehicle instead of the player character.

GenericVehicle Architecture:

Health value.

Seat definitions.

Movement model type (land, air, sea).

Weapon systems.

Spawn and respawn properties.

Tank (Land Vehicle):

Uses four downward raycasts to simulate hover-like suspension.

Remains upright at all times.

Independent turret and barrel rotation.

Slow but powerful movement and firing.

3.4. Additional Vehicle Units

Plane:

Always moves forward.

Pitch controlled by mouse vertical input.

Roll controlled by mouse horizontal input.

No stall system; simplified flight.

Boat:

Uses buoyancy to stay near water level.

Forward acceleration and slow turning.

Stationary Defenses:

Coastal gun with high-damage shell.

AA gun with high rate of fire.

Implemented as vehicles without movement.

Phase 2 Map: Island

Map Design Goals:

Large enough for vehicle combat.

Several flag zones (beach, hill, center).

Shoreline for boat landings.

Open sky for aircraft.

Areas for stationary defenses.

Technical Requirements

Physics:

VehicleController for all vehicles.

Hover simulation with raycasts.

Simplified buoyancy for boats.

Simplified pitch/roll flight model.

Networking:

Vehicle input messages from client to server.

Vehicle state included in snapshots.

Vehicles predicted locally with server reconciliation.

Rendering:

Cameras mounted to vehicle seats.

Turret rotation animations.

Optional visual effects for boats and planes.

UI:

Updated Deploy Screen with class and spawnpoint selection.

Indicators for flag ownership and capture progress.

Display for active vehicle seat.

Optional Stretch Goals

Infantry:

Grenade launcher for Heavy.

Smoke grenade for Scout.

Vehicles:

Jeep (fast, unarmored).

Transport boat.

Commander (Lite):

Single ability: artillery strike triggered by a marked location.

Acceptance Criteria

Phase 2 is complete when:

• Flags can be captured and ownership changes correctly.
• Ticket bleed works and can end a match.
• Class selection functions at spawn.
• Vehicles can be entered and exited consistently.
• Tank movement and firing are functional.
• Planes and boats operate with basic stability.
• Island map performs at or near 60 FPS.
• Multiple clients can play a full Conquest match from start to finish.