\# Phase 2 – LAN Loopback Backlog (v1.2)



\## Scope

Add a simple LAN multiplayer mode using embedded host and WebSocket-based loopback.



\## Tasks

| ID  | Task                  | Output                                      |

|-----|-----------------------|---------------------------------------------|

| N1  | LoopbackAdapter       | Local client ↔ host message pipeline        |

| N2  | WebSocket server      | Host process accepts 2–4 LAN clients        |

| N3  | Snapshot broadcasting | Host sends 30 Hz state deltas               |

| N4  | Client reconciliation | Input buffering + state corrections         |

| N5  | Ping/RTT display      | HUD shows round-trip time                   |

| N6  | Host/Join UI          | Basic menu to start host or connect by IP   |



\## Acceptance Criteria

\- Two PCs on LAN control their own cubes.

\- Average RTT ≤ 5 ms.

\- No visible rubberbanding under normal play.

\- Desync corrections < 1 per 30 seconds in a 10-minute session.



Next: \[62\_backlog\_phase3\_visual\_polish.md](./62\_backlog\_phase3\_visual\_polish.md)



