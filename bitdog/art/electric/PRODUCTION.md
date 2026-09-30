# Electric Avenue

Playable level 3: three optional routes climb delivery crates and pitched workshop roofs onto powered cables. Each cable has three grounded wooden poles, ceramic insulators and two sagging spans. The drawn cable and collision path share the same points. Both directions work, including the faster return with the Bitcoin.

Landing grants 1.35x normal movement speed. Blue paw arcs and a short spark trail show the charge; it lasts 0.8 seconds after dismount. Jump releases the cable and briefly blocks reattachment. Orange sparking ceramic junctions cost one heart on contact with the usual protection interval. The continuous lower path has roadwork barriers and smashable delivery crates; cables are optional. Three hearts and an 80-second return use the shared scoring rules.

## Artwork

Built-in ImageGen originals and exact prompts are preserved in this directory:

- `master-v1.png`: continuous neighborhood panorama, 2172 x 724.
- `tile-0.png` through `tile-2.png`: lossless slices with 96 identical overlap pixels. `manifest.json` supplies placement; `seam-verification.json` proves exact reconstruction. The last tile does not wrap to the first.
- `pole-v1.png`: complete utility pole and footing, with a ceramic insulator also reused for junctions.
- `workshop-v1.png`: brick shed with pitched slate roof and complete foundation.
- `barrier-v1.png`: portable roadworks barricade on A-frame feet.
- `ground-v1.png`: even paving/verge texture; horizontal repeats reflect the same source edge.
- `pov-v1.png`: forward coin-flight view of the same neighborhood.
- `throw-reference-v1.png`, `sprint-reference-v1.png`: character-preserving opening references.
- `prompts.json` and `barrier-prompt.json`: exact built-in ImageGen prompts and reference roles.

Transparent PNG alpha is preserved. Workshops and poles use uniform scaling and source-pixel anchors. Foundations extend into the soil; terrain draws over the lowest part. Foreground decorative trees compensate for transparent root padding and use the deepest ground sample across their roots, preventing a parallax gap. Keep this rule in future themes.

The electric arcs, sparks and cable curves are runtime canvas animation, so their positions match contacts and physics without sprite swaps. Reduced motion removes traveling sparks and freezes decorative arc variation.

## Opening and sound

Kling V3 Pro animated the two approved references into continuous silent clips. `throw-animation.json` and `sprint-animation.json` preserve sanitized requests. Local H.264 movies contain the complete shots; the owner remains cropped above the shoulders, and BitDog retains his black collar, gold BIT tag and full muzzle. The second shot uses this level's actual POV. The existing three-shot timing, pause, skip and reduced-motion/error stills remain.

The third shot plays one new continuous ElevenLabs gallop on paving, without repeated paw taps. Five new effects cover electric charge, cable hum, junction zap, soft paving contacts and this gallop. Requests and processing are in `audio/electric-generation.json` and `audio/electric-paws-generation.json` relative to the game root. No generation API or credential is included in the game runtime.

Music: **Electro Cabello**, Kevin MacLeod, [official track and attribution](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1400048), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). `audio/electric-music-source.json` records the source, original hash and processing. The visible game credits and audio room include the attribution.

## Review

`artifacts/bitdog/electric-review/` holds desktop/portrait/landscape equipment captures. `artifacts/bitdog/electric/` holds movie contact sheets and browser reports. `artifacts/bitdog/root-review/` shows the corrected orchard roots at successive camera positions and on slopes.

Engine tests cover the return clock, charge activation/expiry, jump detachment, junction contact and clearance, adjacent roof/cable jumps, all three powered routes both ways and a complete street-level delivery. Browser checks exercise real keyboard movement, a full round trip, joystick plus second-finger jump, pause and cancellation, movies, records, music and level transitions.
