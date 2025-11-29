==========================

PERFORMANCE PRESETS (TXT)

==========================



bf42lite – GoldSrc-inspired, no postprocessing

Three presets based on target hardware and refresh-rate goals.



PRESETS:



POTATO → 30 FPS



MEDIUM → 90 FPS



HIGH → 120 FPS



PRESET: POTATO (30 FPS target)



Target hardware:



Very old iGPUs (Intel HD 500)



Low-end Chromebooks



Old preowned PCs



Resolution:



720p



FPS Target:



30 FPS stable (half of 60 Hz)



Shadows:



None or simple blob



Textures:



Low resolution (256–512 max)



Geometry / Props:



Lowest LODs



Many props removed to reduce draw calls



Particles:



Cap ~128 total



Decals:



Cap ~32 total



Ragdolls:



0 to 1 active at once



Dynamic lights:



Roughly 4 active lights



Notes:



Pure fallback mode for very weak systems



Ensures game is still playable even at minimal hardware



PRESET: MEDIUM (90 FPS target – Steam Deck OLED)



Target hardware:



Steam Deck OLED (90 Hz)



Low–mid PCs and handheld devices



Resolution:



1280x800



FPS Target:



90 FPS stable



Shadows:



Cheap blob or projected shadows



Textures:



Medium resolution (512–1024)



Geometry / Props:



Full low-poly world



All intended props present



Particles:



Cap roughly 256 to 512



Decals:



Cap around 128



Ragdolls:



3 to 4 active



Dynamic lights:



Around 12 active lights



Notes:



Primary design preset



Smooth handheld experience designed for the 90 Hz OLED screen



PRESET: HIGH (120 FPS target – Midrange PC)



Target hardware:



Midrange gaming PCs (RTX 3060 / RX 6600 / 2060 class)



Resolution:



1080p



FPS Target:



120 FPS (never below 60)



Shadows:



Higher-quality projected shadows



Textures:



Medium–High (1024 for hero assets)



Geometry / Props:



Full detail, clutter included



Particles:



Cap ~512 to 1024



Decals:



Cap ~256 to 512



Ragdolls:



6 to 8 active



Dynamic lights:



Around 24 active lights



Notes:



Designed for 120–144 Hz desktop monitors



Smooth, high-end PC experience



Preset Summary (TXT Form)



POTATO – 30 FPS – 720p – weak hardware

MEDIUM – 90 FPS – 1280x800 – Steam Deck OLED

HIGH – 120 FPS – 1080p – midrange PCs

