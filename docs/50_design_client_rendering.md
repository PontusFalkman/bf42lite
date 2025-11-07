\# Client Rendering \& Input (v1.2)



\## Renderer

\- Library: Three.js.

\- Target: 1080p @ 120 fps on mid-range hardware.

\- Scene:

&nbsp; - Directional light + ambient light.

&nbsp; - Low-poly meshes, simple materials.



\## Camera

\- First-person or close third-person view.

\- Smooth follow/lERP mechanics around player entity.

\- Pointer lock for mouse look on desktop.



\## HUD

Minimum items:



\- Crosshair.

\- Health bar.

\- Ammo count.

\- FPS and RTT indicators (small, non-intrusive).



\## Input

\- Keyboard: WASD for movement, Space for jump, Shift for sprint.

\- Mouse:

&nbsp; - Movement → look.

&nbsp; - Left click → fire.

\- Mapping:

&nbsp; - Raw browser events → `InputAxis` + button states → ECS.



Next: \[60\_backlog\_phase1\_core\_mvp.md](./60\_backlog\_phase1\_core\_mvp.md)



