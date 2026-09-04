# Enemy animation pass, 2026-09-04

Scope: presentation only. No movement speeds, damage, costs, simulation bundle,
progression, or replay identities change.

## Production artwork

Two eight-pose run sheets were created with the built-in image-generation tool,
using the existing accepted enemy atlases as identity references:

- `games/aegis/art/v2/m01/enemies/scout-run-v2.webp`: 1774 x 887, alpha, 316626 bytes.
- `games/aegis/art/v2/m01/enemies/raider-run-v2.webp`: 1774 x 887, alpha, 419956 bytes.

The generator returned 1774 x 887 instead of the requested 1024 x 512 and did not
perfectly respect cell boundaries. Production uses measured per-pose SVG crops
with stable foot baselines, not the old fixed-grid contract. No existing atlas or
its semantic idle/hit/defeat cells was replaced. New sheets are movement-only.

First drafts had a baked checkerboard. A second image-tool pass removed it and
returned actual RGBA transparency. FFmpeg encoded those RGBA outputs as WebP
quality 90, without resizing or retouching. Alpha was verified in both source and
production files. Added transfer is 736582 bytes and nominal decoded texture
memory is 12588304 bytes for both sheets. Original generated files remain intact.

Source folder: `C:/Users/USER/.codex/generated_images/01a03c7c-41bc-7cf1-bf41-7d66cf50e6fb/`

- Scout RGBA: `exec-c5bc950f-9cb2-4de4-be16-ff2fee624e01.png`
- Raider RGBA: `exec-21c55e76-6111-491c-adf2-489c0db8383f.png`

## Motion and readability

- Gaits follow distance traveled, including slows and stops, rather than a free-running timer.
- Individual phase offsets avoid synchronized marching. Facing follows horizontal movement.
- Grounded foot shadows, small smooth weight shifts, and restrained footfall dust.
- Scout bounds, heavy units sway less, and echoes float without ground dust.
- Real damage telemetry drives short hit recoil/sparks and defeat remnants. Leaks do not trigger kills.
- Tower atlas opacity now works; firing effects render above the tower body.
- Health bars remain stable. Reduced motion and photosensitive-safe settings suppress added effects.
- Same SVG scene and simulation cadence; no GIF dependency, video decoder, or extra runtime dependency.

## Prompts

### scout

Use case: stylized-concept. Asset type: production 2D sprite sheet for Armara Aegis. Reference image is identity/style reference only. Make a NEW 8-frame seamless scout locomotion cycle, not a set of combat poses. mechanical Greek war hound with gold bronze armor, charcoal metal limbs, lime dorsal plates and orange core, identical to reference. gallop: extended reach, forefoot contact, compressed landing, gathered legs, hind push off, airborne tuck, opening flight, extended flight. All eight figures face RIGHT in the same three-quarter slightly overhead perspective as reference. Preserve proportions, weapons, colors and armor details exactly between frames. Real limb articulation, moving joints and weight transfer; stationary body center, no camera changes, no orientation changes. Crisp bright cartoony outlines readable at 80 pixels. EXACT layout: 1024 by 512 pixels, FOUR columns and TWO rows, EIGHT equal 256x256 cells, row-major chronological order. Each character fully inside its cell with at least 20px padding all sides. Same size and anchor in every cell; center of torso x128 and ground baseline y226 per cell, consistent body height. Truly transparent alpha background, NOT magenta, NOT white, NOT checkerboard. No cast shadow, no floor, no labels, no text, no borders or divider lines. No sparks/dust trails in the sheet. Spear/shield remains in same hands. Smooth distinct poses that loop from frame8 to frame1.

### raider

Use case: stylized-concept. Asset type: production 2D sprite sheet for Armara Aegis. Reference image is identity/style reference only. Make a NEW 8-frame seamless raider locomotion cycle, not a set of combat poses. stocky bronze Greek automaton hoplite with red crest and skirt, round shield, spear and orange visor, identical to reference. march/run: left foot forward contact, left supporting compression, passing right knee, right lift, right foot forward contact, right supporting compression, passing left knee, left lift. All eight figures face RIGHT in the same three-quarter slightly overhead perspective as reference. Preserve proportions, weapons, colors and armor details exactly between frames. Real limb articulation, moving joints and weight transfer; stationary body center, no camera changes, no orientation changes. Crisp bright cartoony outlines readable at 80 pixels. EXACT layout: 1024 by 512 pixels, FOUR columns and TWO rows, EIGHT equal 256x256 cells, row-major chronological order. Each character fully inside its cell with at least 20px padding all sides. Same size and anchor in every cell; center of torso x128 and ground baseline y226 per cell, consistent body height. Truly transparent alpha background, NOT magenta, NOT white, NOT checkerboard. No cast shadow, no floor, no labels, no text, no borders or divider lines. No sparks/dust trails in the sheet. Spear/shield remains in same hands. Smooth distinct poses that loop from frame8 to frame1.

### Transparency correction

Remove the checkerboard background and return real transparent alpha. Preserve
the exact eight characters, poses, size, colors, 4 x 2 arrangement, and 2:1 canvas.
Do not redraw the characters or bake any replacement background into the image.

## Verification

`tests/enemy-animation.test.js` covers all eight frames, frame bounds, foot anchors,
real WebP alpha, stops, facing, reduced motion, heavy/hovering gait differences, and
damage-only hit/defeat cues. `tools/cdp-drivers/aegis-enemy-animation.js` runs real
store/build/upgrade/sell controls and observes both new sheets, hits, defeats,
projectiles, tower blending and effects, and reduced motion during actual waves.

No deployment is included in this animation pass.

Completed checks: 963/963 Aegis tests in both working and isolated staged trees;
83/83 shared-kit and legacy-game tests. Actual CDP combat journeys passed at
1440 x 900 and 390 x 844 on the isolated staged tree, including both eight-pose
cycles, visible tower blending/firing, hit/defeat effects, and reduced motion.
No missing sprite assets or fatal runtime errors were observed.
