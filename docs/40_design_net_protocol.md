

---



\### `/docs/40\_design\_net\_protocol.md`

```markdown

\# Network Protocol (v1.2)



\## Purpose

Define the binary messages exchanged between client and host.  

Schemas must be shared between JS and Rust.



\## Encoding

\- Binary format: `msgpackr`.

\- Validation: `zod` schemas in `/packages/protocol`.



\## Message Types

High-level:



\- `input` — client → host, player input per tick.

\- `state` — host → client, world snapshot delta.

\- `event` — host → client, discrete events (death, respawn, capture).



Example zod-style schemas (conceptual):



```ts

InputMsg = {

&nbsp; type: "input",

&nbsp; tick: number,

&nbsp; axes: { forward: number; right: number; jump: boolean },

};



StateMsg = {

&nbsp; type: "state",

&nbsp; tick: number,

&nbsp; entities: Array<EntitySnapshot>,

};



EventMsg = {

&nbsp; type: "event",

&nbsp; tick: number,

&nbsp; eventType: string,

&nbsp; payload: unknown,

};



Versioning



Include a protocol version field for compatibility.



Changes to schemas should be additive when possible.



Next: 41\_design\_net\_transport.md

