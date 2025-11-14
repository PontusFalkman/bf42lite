# Client Rendering (v1.3)

## Tech
Three.js + React overlay.

## Interpolation
* **Local player:** Immediate (predicted).
* **Remote players:** Interpolated between last two snapshots for smoothness.

## Visual Style
* Low-poly, flat shading, readable silhouettes.
* Target 60 FPS on basic GPUs/APUs.