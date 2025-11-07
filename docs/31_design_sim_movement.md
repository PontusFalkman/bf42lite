
---

### `/docs/31_design_sim_movement.md`
```markdown
# Movement System Design (v1.2)

## Purpose
Provide deterministic, simple player locomotion that works identically in JS and in a potential Rust port.

## Components
```ts
Transform { x, y, z }
Velocity  { x, y, z }
InputAxis { forward, right, jump }

Transform: world-space position.

Velocity: world-space velocity per second.

InputAxis: normalized input values from client.

Tick Logic

Per tick (dt = 1/60):

Read InputAxis for local player.

Map input to horizontal velocity:

Velocity.x = InputAxis.right   * SPEED;
Velocity.z = -InputAxis.forward * SPEED;
Velocity.y = 0;


Integrate:

Transform.x += Velocity.x * dt;
Transform.y += Velocity.y * dt; // stays 0 in Phase 1
Transform.z += Velocity.z * dt;


Clamp to ground plane:

Transform.y = 0;

Constants
Parameter	Value	Description
SPEED	3.0	Units per second on X/Z plane
GRAVITY	9.81	Reserved for later
FRICTION	0.8	Simple damping (Phase 2+)

Phase 1 may omit friction and gravity entirely.

Determinism

Always use fixed dt inside the sim, even if the display loop has variable frame times.

Quantize InputAxis values to a small set of steps if needed.

Future Extensions

Phase 2: Add jump and fall.

Phase 3: Add sprint and stamina.

Phase 4: Replace basic integration with capsule sweep and collision resolution.

Next: 32_design_sim_weapons.md