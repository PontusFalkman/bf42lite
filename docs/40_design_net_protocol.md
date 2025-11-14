# Networking Protocol (v1.3)

## Transport
* **UDP:** State updates (positions, rotations).
* **TCP/WebSocket:** Reliable events (joins, hits, killfeed, system messages).

## Message Structure

### Client → Server
* **State Update:** `{ type: 'update', x, y, z, yaw }`
* **Fire Proposal:** `{ type: 'fire', origin, direction, weaponId, clientTick }`
* **Actions:** `{ type: 'respawn', classId }`, etc.

### Server → Client
* **Snapshot:** `{ type: 'snapshot', entities: [...], scores, tickets }`
* **Hit Confirmation:** `{ type: 'hitConfirmed', shooterId, targetId, damage }`
* **Death Event:** `{ type: 'death', victimId, killerId }`

## Encoding
* `msgpackr` for binary transport.
* `zod` schemas for strict validation (`packages/protocol`).

## Snapshot Rate
Target: 10–20 Hz snapshots, client interpolates to 60 FPS.