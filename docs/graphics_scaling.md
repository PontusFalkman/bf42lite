==========================

GRAPHICS SCALING (TXT)

==========================



bf42lite uses three scalable presets: Potato (30 FPS), Medium (90 FPS), and High (120 FPS).

No postprocessing. All scaling is done using classic GoldSrc-style adjustments: geometry, textures, particles, and world detail.



Geometry and LOD



Potato:



Lowest LOD



Many props removed



Medium:



Medium LOD



All key props present



High:



Full detail LOD



All props + clutter



Textures



Potato:



256–512 max textures



Aggressive mip bias



Bilinear filtering



Medium:



512–1024 textures



Normal mip bias



Bilinear or trilinear



High:



1024 hero textures allowed



Trilinear filtering



Lighting



Potato:



Baked lightmaps only



No shadows or blob shadows



Very limited dynamic lights (~4)



Medium:



Baked lightmaps



Projected/blob shadows



More dynamic lights (~12)



High:



Baked lightmaps



Higher-res projected shadows



Many dynamic lights (~24)



Particles



Potato: Cap ~128



Minimal explosions



Short-lived smoke



Simplified tracers



Medium: Cap ~256–512



Standard explosions



Persistent but capped smoke



Normal tracers



High: Cap ~512–1024



Large explosions



Dense debris and persistent smoke



Full tracer density



Decals (bullet holes, impacts)



Potato: ~32 decals cap, aggressive fade

Medium: ~128 decals cap, normal fade

High: ~256–512 decals cap, slow fade



Ragdolls



Potato: 0–1, very short lifetime

Medium: 3–4, medium lifetime

High: 6–8, long lifetime



Props and World Detail



Potato: minimal foliage, minimal debris

Medium: full intended props

High: full props + clutter meshes



Audio Scaling



Potato: ~16 voices

Medium: 48–64 voices

High: 64–96 voices



Simulation / Network Considerations



Preset does NOT affect tickrate.

Only visual density and GPU load scale across presets.

