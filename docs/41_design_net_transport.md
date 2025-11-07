

---



\### `/docs/41\_design\_net\_transport.md`

```markdown

\# Transport \& Topology (v1.2)



\## Topology

\- Phase 2: Embedded host in same executable.

\- Clients connect via WebSocket over LAN.

\- Later phases may add Rust-based host and UDP/WebRTC.



\## Rates

\- Simulation tick: 60 Hz on host.

\- Snapshot broadcast: 30 Hz deltas.

\- Input messages: sent every tick or bundled.



\## Reliability Model

\- WebSocket guarantees ordering and reliability.

\- Client predicts motion locally, host corrects via snapshots.

\- Simple reconciliation: client rewinds to last authoritative state, replays local inputs.



\## Metrics Targets

\- RTT on LAN: ≤ 5 ms typical.

\- Snapshot size: ≤ 5 KB per player.

\- Desync corrections: ≤ 1 per 30 seconds.



Next: \[50\_design\_client\_rendering.md](./50\_design\_client\_rendering.md)



