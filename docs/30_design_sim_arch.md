# Simulation Architecture (v1.3)

The architecture explicitly avoids cross-language determinism by splitting continuous vs. discrete responsibilities.

## Authority Split
| Feature | Authority | Location | Reason |
| :--- | :--- | :--- | :--- |
| **Movement Physics** | Client | `packages/sim` (TS) | Instant input response. |
| **Collision (visual)** | Client | TS | Immediate feedback. |
| **Hit Detection (final)** | Server | Rust | Ensures both players see the same result. |
| **Health/Death** | Server | Rust | Centralized game rules. |
| **Scoring/Tickets** | Server | Rust | Consistent match flow. |
| **Rate Limits** | Server | Rust | Prevents accidental spam. |

## Hit Model: Predict + Reconcile
**Client**
1.  Performs raycast.
2.  Shows hit spark / marker immediately.
3.  Sends a fire proposal: `{ type: "fire", origin, direction, weaponId, clientTick }`

**Server**
1.  Re-runs the raycast using authoritative positions.
2.  Confirms if the hit is valid.
3.  Computes damage.
4.  Broadcasts a final event: `{ type: "hitConfirmed", shooterId, targetId, damage }`

*This avoids “I was behind cover on my screen” even on LAN.*

## Determinism Rules
* **Client** runs fixed timestep (1/60).
* **Server** stores authoritative transforms from client reports.
* **Server** validates movement with simple checks (max speed, max teleport).
* **Server** performs only discrete logic (health, respawns, tickets).