# Armara Aegis Environment and Interface Art Specification

**Date:** 2026-08-28

**Status:** Binding art-direction and presentation-architecture specification

**Owner:** Ryan / Armara

**Implementation plan:** `docs/superpowers/plans/2026-08-28-armara-aegis-environment-ui-art.md`

## 1. Authority and approved direction

Ryan approved this direction on 2026-08-28 after reviewing the Gate of Dawn environment concept, the ancient-road material board, and the modular Ancient Greece-meets-AI interface board.

This document refines the presentation requirements in:

- `2026-08-26-armara-aegis-landscape-redesign.md`;
- `2026-08-26-armara-aegis-campaign-expansion.md`; and
- `2026-08-27-armara-aegis-slice-content-schema.md`.

It supersedes the earlier generic battlefield treatment wherever that treatment permits one reusable background, a CSS `cover` battlefield image, baked route-like floor bands, opaque checkerboard atlases, equal-cell atlases without pivots, or a road whose dominant visual face appears twelve world units wide.

This is an explicit presentation amendment to Campaign Expansion Section 18.1: the compiled centerline and complete twelve-world-unit tactical/clearance mask remain exact, but only the central eight-world-unit material core is visually dominant; natural shoulders occupy the balance of the mask. No renderer, hit test, map proof, or simulation rule may infer an eight-unit tactical road from this art decision.

It does not alter simulation values, route geometry, pad coordinates, balance approval, replay identity, progression, the public/default route, or release eligibility. Presentation data remains separately hashed and cannot change `rulesetHash` or replay results.

The seven approved product decisions are binding:

1. The simulation retains the authored twelve-world-unit road corridor, while the visually dominant travel surface is approximately eight world units wide with quiet shoulders completing the tactical corridor.
2. Generated environment plates contain no baked roads. Exact authored physical lanes own the visible road layer.
3. Battlefields use bright, stylized, near-overhead Ancient Greece-meets-AI environments, quieter than the cartoon gameplay pieces.
4. Build sites use subtle, equal-status Greek foundations. They never expose pad IDs, quality, intent, heat, coverage, or recommended strategy.
5. Menus use modular marble, bronze, gold, cyan, and violet components with live text. The exact canonical Armara hourglass is composited separately and is never regenerated.
6. Mission 1 is the first production-quality visual slice, followed by Missions 4 and 5. All twenty environments may be concepted now, but final route-matched plates are produced only against authored, accepted map geometry.
7. Every tactical battlefield uses an explicit fixed 16:10 camera on every device. Tactical art is contained and letterboxed when necessary, never cropped with `cover`.

## 2. Player-facing visual promise

Armara Aegis should look like a vivid animated strategy cartoon built inside a monumental Greek machine civilization:

- Sunlit limestone, marble, mosaic, olive wood, bronze, basalt, obsidian, sea-worn stone, and celestial ivory establish place.
- Cyan, violet, and gold circuitry feels engraved, inlaid, or powered through ancient craft rather than attached modern hardware.
- Towers, enemies, summons, attacks, status effects, and interactable sites read immediately at gameplay size through silhouette, color, outline, motion, and shape.
- Backgrounds remain clearly visible, attractive, and mission-specific without competing with units or suggesting false routes.
- Roads appear to belong to the surrounding terrain and architecture. Asphalt, highway markings, modern curbs, lane paint, and generic black roadway are forbidden.
- Menus feel crafted from the same world without turning labels, prices, or statistics into baked image text.

The target is stylized illustration, not photorealism. Gameplay pieces use a bright three-value palette, thick dark outline, clean internal separations, and restrained material detail. Backgrounds may be painterly but must preserve a quiet tactical field.

## 3. One projection for every tactical layer

### 3.1 Explicit camera records

Every production map declares a presentation-owned `cameraId`. A camera record stores fixed-point `x`, `y`, `width`, and `height`; width-to-height is exactly `8:5`. It is never inferred from current routes, pads, viewport size, DOM bounds, or loaded art.

The initial camera is:

```text
id: camera.overscan-16x10-v1
x: -18000
y: -12000
width: 198400
height: 124000
```

Coordinates use the same 1,000-distance-units-per-world-unit convention as compiled tactical geometry. This camera contains the complete `160 x 100` board plus current entry, breach, gate, pad, and route extents. A map may introduce another reviewed 16:10 camera only when its authored extents require it.

A production environment plate is normally `2048 x 1280` and maps exactly to its camera rectangle. A `1280 x 800` derivative may be selected before decode on constrained devices. Both variants have the same crop and world mapping.

### 3.2 Responsive behavior

- The battlefield viewport uses `aspect-ratio: 8 / 5`, `width: 100%`, and an automatic height.
- The full camera is visible at desktop, tablet, and portrait-mobile widths.
- Any surplus viewport space becomes deliberate letterbox or UI space; tactical art is not cropped.
- Shell and menu backdrops may use `cover` because they contain no tactical geometry.
- One world-to-screen matrix plus letterbox offsets drives background placement, road rendering, pads, landmarks, units, effects, overlays, and inverse hit testing.
- Resize and orientation changes recompute presentation only. Simulation state, selection, commands, and replay timing do not change.

CSS background-size `cover` is forbidden on a tactical battlefield plate. A dynamically inferred SVG viewBox is also forbidden.

## 4. Environment plate contract

Each mission receives one opaque, route-free 16:10 environment plate. The plate establishes terrain, architecture, light, depth, and environmental storytelling while reserving the authored tactical corridor.

A production plate contains no:

- visible road, path, trail, lane paint, channel, rail, repeated paving ribbon, or road-like floor groove;
- pad, tower foundation, range ring, route marker, spawn marker, gate, breach, portal, hazard telegraph, or objective marker;
- unit, projectile, health bar, status icon, UI, text, watermark, fake logo, or generated hourglass;
- high-contrast line that could be mistaken for an alternate route.

Before generation, tooling renders a map guide containing the fixed camera, board bounds, normalized physical-lane union, pad clear disks, anchors, exclusions, crossing layers, and safe landmark regions. This guide is a generation reference and validation artifact, never player-facing art.

The environment keeps at least a sixteen-world-unit calm band centered on every physical lane: the twelve-unit tactical corridor plus two additional quiet world units on each side. Pad clear zones use an eight-to-ten-world-unit radius. High-frequency props, false foundations, bright circuitry, and deep occluding shadows stay outside those zones.

The background is bright enough to be seen without post-render suppression. Runtime must not depend on extreme opacity, brightness, or saturation filters to make gameplay readable. Readability is authored into palette and value structure.

## 5. Exact ancient-road system

### 5.1 Geometry ownership

Road rendering consumes normalized physical lane segments, not logical route traversal records. A shared trunk is drawn once even when multiple routes traverse it. Declared joins create merge/split caps. Declared crossings and `upperLayerId` determine bridge order. No road geometry is inferred from a raster image.

### 5.2 Approved width hierarchy

The full tactical corridor remains twelve world units wide and balance-compatible:

- Dominant core surface: nominally eight world units wide.
- Quiet shoulder or edge transition: two world units per side, completing the twelve-unit corridor.
- Optional ambient occlusion or soft terrain shadow: may extend to fourteen world units, but cannot look like another playable surface.

The core carries the strongest stone, earth, mosaic, or channel texture. Shoulders use broken stones, dust, grass wear, sand, salt, ash, or subdued edge masonry so the road feels narrower without lying about its tactical footprint.

Enemies remain centered on the authoritative compiled route. Road rendering does not change movement, range, collisions, or pad legality.

### 5.3 Material and join requirements

- Road textures are world-anchored so they do not swim during resize or camera changes.
- Stone joints, mosaic modules, ruts, and inlays stay clipped within the tactical surface.
- Corners follow the centerline without blocky stair steps.
- Ends, bends, branches, merges, splits, crossings, bridges, portals, and material transitions have explicit treatments.
- No dashed center stripe, painted edge stripe, modern drainage grate, highway curb, asphalt aggregate, rubber tire mark, or contemporary street furniture is allowed.
- Route boundaries must remain distinguishable at a minimum 3:1 contrast against adjacent terrain without color alone.

### 5.4 Gate of Dawn material progression

Mission 1 uses one continuous authored S route with a visual journey into the city:

- Western approach: warm packed Attican earth with pale limestone fragments and dry grass shoulders.
- Middle approach: worn limestone setts with dust-filled joints and occasional restrained cyan inlay.
- Eastern city approach: tighter limestone/cobble construction with a pale marble threshold and restrained gold/cyan gate circuitry.
- Material transitions blend over short world-space intervals and never create a false fork.

The environment plate aligns terraces, walls, drainage, vegetation, and city architecture to this progression, but the visible road itself remains an exact rendered layer.

## 6. Twenty-mission environment art bible

The following table binds the environment identity and road-material family. Exact weather/time is presentation-only and may be refined during visual review without changing gameplay.

| Mission | Environment identity | Road family |
|---|---|---|
| M01 Gate of Dawn | Sunrise Attican gate, terraces, colonnade, braziers | Packed earth into worn limestone and city cobble |
| M02 Agora Circuit | Bright colonnaded civic agora | Marble paving with black/terracotta Greek-key mosaic |
| M03 Olive Cipher | Late-afternoon olive grove and ruined marble | Dust trail with worn marble crossings |
| M04 Piraeus Switchyard | Salt-bright harbor, quays, cranes, twin approaches | Sea-worn limestone causeways and bridge stone |
| M05 Bronze Warden | Furnace-lit foundry terrace | Blackened limestone with a bronze service channel |
| M06 Delos Airspace | Sun-white island temple over the Aegean | Ground limestone; air route shown only by subtle code-driven current cues |
| M07 Naxos Labyrinth | Monumental mosaic labyrinth and overpass | Black, ivory, and terracotta mosaic with pale bridge stone |
| M08 Poseidon's Clock | Tide temple at blue hour | Wet sea stone versus dry marble route states |
| M09 Rhodes Ring | Colossus plaza in gold afternoon light | Sunburst marble mosaic ring with code-driven solar sectors |
| M10 Cyclops Kernel | Eclipse-lit Cyclopean crater | Megalithic stone and bronze core channels |
| M11 Thermopylae Firewall | Red-dawn mountain choke and defensive walls | Packed earth reinforced with rough stone at turns |
| M12 Delphi Duplex | Misty oracle terraces at different elevations | Pale marble route and darker temple tile, with explicit bridge depth |
| M13 Forge Perimeter | Ashy volcanic workshop | Basalt and bronze main loop with cracked workshop shortcuts |
| M14 Acropolis Mesh | Moonlit acropolis and mirrored arcades | Moon-white marble with restrained arc mosaics |
| M15 Oracle's Black Box | Cold subterranean double spiral | Obsidian-glass mosaic with violet and gold inlay |
| M16 Styx Packet Loss | Underworld banks divided by portal gaps | Obsidian slabs; portal energy never painted as a physical connector |
| M17 Trident Convergence | Storm coast with three parallel approaches | Bridge stone, sea limestone, and temple tile at equal readability |
| M18 Titan Assembly | Furnace-night assembly complex | Bronze channels embedded in basalt with distinct node aprons |
| M19 Olympus Uplink | Storm-lit mountain switchbacks | Rugged marble stairs/slabs and broad landings |
| M20 Eternal Singularity | Cosmic Olympus and celestial machinery | Ivory celestial stone with cyan/violet arms merging into gold |

The campaign palette progresses from warm civic limestone, to sea-white temple/mosaic environments, to cooler volcanic and oracle spaces, and finally to obsidian, storm, and cosmic ivory. Mission thumbnails derive from the accepted environment plates rather than duplicating twenty full illustrations.

## 7. Build sites and landmarks

Build sites must be discoverable and clickable without telling the player which ones are strategically superior.

- Every empty build site uses the same neutral visual status within a mission.
- No player-facing pad ID, grade, intent, heatmap, coverage score, strong/standard label, role hint, or best-placement glow appears.
- A biome plinth may use local material, but its logical footprint and pivot remain consistent.
- The visible plinth is approximately eleven-to-twelve world units across with sufficient transparent gutter; the invisible hit target is at least 48 CSS pixels.
- Focus, hover, touch selection, affordability, range preview, occupied, and disabled states are code-driven overlays, not baked strategic information.

Landmarks are transparent cutouts attached to stable authored anchors or exclusions. They declare world bounds, pivot, layer, and optional foreground cap. A foreground cap may never conceal a build site or make a hostile unreadable. Gates, breaches, portals, and hazards retain semantic code cues; art is never their only explanation.

## 8. Tactical layer order

The renderer uses this immutable world-space order:

1. Quiet procedural fallback terrain.
2. Opaque mission environment plate.
3. Non-tactical ground decals.
4. Physical-road shadow and shoulders.
5. Exact road core/material and crossing layers.
6. Pad plinths and landmark backs.
7. Range, focus, selection, route-warning, and hazard overlays.
8. Depth-sorted towers, summons, and enemies.
9. Projectiles, status effects, impacts, and bounded particles.
10. Safe landmark foreground caps.
11. Health, shield, status, and readability overlays.
12. DOM HUD, store, inspector, tutorial, pause, and result surfaces.

Static layers are cached per mission, camera, theme, and device-pixel ratio. They are not reconstructed at simulation frequency.

## 9. Gameplay-piece style and animation

The current bright cartoon atlases are references for readability, not production files; most contain baked checkerboards. The current isolated realistic sprites are references for Armara materials, not the target gameplay rendering.

Production towers and enemies use:

- genuine alpha with no checkerboard, matte, fringe, vignette, fake ground plate, text, or watermark;
- bright family colors, thick outer contour, clear three-value shading, and restrained interior detail;
- consistent near-overhead perspective, light direction, footprint, scale, ground contact, and pivot;
- explicit tight frame rectangles with transparent/extruded gutters;
- a recognizable silhouette at the smallest supported gameplay size and in color-blind simulation.

Each defense level has a clearly different base silhouette and top/core read. Required animation beats are idle A/B, anticipation/charge, fire or release, recoil/recovery, hit/disabled, and any level-specific mechanic. Code may rotate or interpolate modular tops where appropriate.

Regular enemies cover idle/contact, two locomotion extremes, hit, trait/special, stagger/control, defeat, and breach. Bosses add every phase transition and signature action. Reduced Motion removes bob, shake, large recoil, and rapid pulses while retaining meaningful movement and state changes.

## 10. Interface and menu art system

### 10.1 Visual construction

The interface uses one modular family:

- carved ivory or dark marble panels;
- bronze structural edges and corner ornaments;
- restrained gold hierarchy accents;
- cyan and violet luminous inlays for powered/selected states;
- subtle Greek-key, laurel, column, shield, and celestial-machine motifs;
- dark, quiet live-text interiors that preserve contrast.

Frames are implemented as CSS/SVG where deterministic geometry is superior, or as validated 256/512-pixel nine-slice assets with declared cap insets. Decorative raster art never contains prices, statistics, button labels, mission names, error text, or provider copy.

The exact canonical `logo.png` bytes remain unchanged. Manifest crop metadata may remove transparent padding at draw time. Image generation must never redraw, imitate, replace, or embed the hourglass.

### 10.2 Required surfaces

The visual system covers:

- shell/title, Aegis Hub, Campaign Map, Mission Briefing, Loadout Builder;
- battle HUD, Aether, gate health, wave state, speed/pause, store, tower inspector;
- wave preview, boss warning, objectives, tutorial callouts, settings and accessibility;
- victory, defeat, unlock/reward, Codex, Replay Viewer, Challenges, Community;
- offline, loading, corrupt-asset fallback, unsupported-storage, and error states;
- the 1200 x 675 victory/share card frame.

Desktop may use a side command panel; portrait uses an independently scrollable bottom sheet below the full-width landscape board. Text, focus rings, hit targets, prices, currency, and semantic icons remain live and accessible. Landscape and portrait shell backdrops are distinct assets or use a deliberately crop-safe non-tactical composition.

## 11. Production asset coverage

### 11.1 Global kit

- canonical hourglass integration and manifest crop metadata;
- landscape and portrait shell backdrops;
- reusable UI frame, panel, tab, card, button, chip, divider, modal, tooltip, and share-card ornaments;
- labelled semantic icon family for Aether, gate health, wave, score, targets, traits, statuses, objectives, accessibility, and system states;
- four act accent/banner families.

### 11.2 Mission 1 production pack

- one `2048 x 1280` Gate of Dawn route-free environment plate plus reviewed `1280 x 800` derivative;
- packed-earth, limestone-sett, and city-cobble road materials plus edge/transition treatments;
- neutral Attican plinth, breach, gate healthy/damaged/critical states, and landmark cutouts;
- Sentinel, Chronos, and Siege: three levels, modular animation states, shop/Codex portraits, projectile and impact identities;
- Scout and Raider complete animation coverage;
- essential build, upgrade, sell, affordability, tutorial, wave, target, health, Aether, and status art;
- one M01 victory/defeat/share treatment using a live battlefield snapshot and canonical branding.

### 11.3 Campaign total

The final campaign requires twenty environment plates, fifteen defense families at three levels, fifteen portraits, eleven regular enemy families, five unique bosses, required summons, gate/breach/portal/hazard states, combat cues, campaign UI, tutorial art, and result/share treatments. Modular atlases and reusable code-driven effects are required; this scope must not become hundreds of unrelated 512-pixel PNG requests.

M04/M05 production follows M01 validation. The other seventeen final map plates and route art wait for accepted authored geometry, though their art briefs and non-binding mood concepts may be prepared earlier.

## 12. Presentation catalog v2 requirements

Presentation schema v1 remains a Candidate-BAL procedural-placeholder format and is not widened. Production assets use a separately dispatched, reviewed schema version 2.

Schema v2 must represent, validate, and canonically compile:

- explicit camera records and exact 16:10 aspect;
- immutable bitmap records with contained relative URL, SHA-256, pixel dimensions, alpha mode, compressed bytes, decoded bytes, usage kind, and fallback ID;
- atlas frame rectangles, pivots, ground contacts, projectile origins, gutters, and animation tags;
- world placements with camera ID, world bounds, layer, pivot/anchor ID, and optional foreground split;
- nine-slice cap insets;
- mission pack ownership, dependency pack IDs, critical/preload classification, and compressed/decoded budgets;
- cue-to-asset mappings with a mandatory semantic fallback;
- generation provenance and reviewed-crop metadata outside simulation identity.

All paths are relative, canonical, repository-contained, and case-correct. Duplicate assets, aliasing outside declared dependencies, missing hashes, mismatched dimensions, invalid alpha, overlapping atlas frames/gutters, pivots outside declared bounds, camera/aspect mismatch, unowned assets, dependency cycles, or budget overruns fail validation.

Compiled presentation bytes and their hash remain separate from simulation bytes. Art-only changes alter presentation/release identity but preserve the simulation artifact, `rulesetHash`, and valid replay outcomes.

## 13. Generation and normalization workflow

Built-in ImageGen is the default image source. One call produces one distinct asset or one clearly declared concept board. Generated files are source material, not automatically accepted runtime files.

For each project-bound raster:

1. Generate the exact map/camera guide and define the asset contract.
2. Assemble only approved reference images, labelling each as style, composition, material, or immutable-brand reference.
3. Prompt with the intended use, camera, quiet zones, palette, materials, alpha/background need, and forbidden content.
4. Inspect the full output and an actual-game-size render.
5. Iterate one defect at a time.
6. Normalize crop, alpha, dimensions, gutters, frame rectangles, pivots, compression, and metadata offline.
7. Copy the selected final into the repository under a versioned mission/global art directory.
8. Run asset validation, projection tests, visual regression, accessibility review, memory/frame budgets, and missing/corrupt fallback tests.

The built-in generator's default storage is never referenced by runtime code. Preview-only concepts may remain there; every accepted project asset is copied into the workspace and recorded in the presentation manifest.

## 14. Performance and delivery budgets

- Initial Aegis shell plus M01 critical art: at most 5 MB compressed.
- M01 critical art itself: at most 4 MB compressed.
- Each additional mission/biome pack: target at most 3 MB compressed.
- Maximum production atlas dimension: 2048 pixels.
- No unexplained individual asset above 1 MB compressed.
- Active mobile decoded-art budget: at most 64 MB.
- Only the selected mission, current enemies/boss, equipped defenses, immediate portraits, and required global UI decode at battle start.
- A missing, corrupt, or unsupported art asset falls back to quiet procedural terrain, exact vector roads/plinths, semantic icons, and readable CSS panels without changing simulation or replay hashes.

Opaque environment plates use WebP or another browser-validated compressed format with a tested fallback. Alpha gameplay assets use a format that preserves genuine transparency in all supported browsers. No runtime flood fill or checkerboard cleanup is permitted for production art.

## 15. Accessibility and visual acceptance

Required review sizes are `320 x 568`, `390 x 844`, `768 x 1024`, `1280 x 800`, and `1920 x 1080`, plus a mid-run orientation change.

Acceptance requires:

- full camera visible with no tactical crop or projection drift;
- background, road, pad, unit, projectile, and status hierarchy readable at actual size;
- route/pad/unit boundaries at least 3:1 and ordinary text at least 4.5:1;
- no identity dependent on color alone;
- keyboard-accessible ordered pad companion, visible focus, correct focus return, and minimum hit targets;
- Reduced Motion, 200% zoom, color-blind simulation, NVDA/VoiceOver/TalkBack smoke coverage;
- M04 shared trunk rendered once and overpasses layered correctly;
- world-to-asset-to-screen-to-world projection round trips for camera corners, route points, pads, anchors, and hit tests;
- identical simulation/replay hashes with full art, missing art, and fallback art;
- representative 100-enemy/15-tower frame and decoded-memory budgets.

## 16. Release boundaries

This specification authorizes the art architecture, guide tooling, UI kit, concept work, and production-directed M01 visual development Ryan approved. It does not itself promote a Candidate-BAL annex, select the public/default route, write production progress, publish GitHub Pages, or waive campaign release gates.

Production catalog selection remains gated by the source annex and presentation-catalog approval rules. A concept or locally integrated developer preview is not called production-approved or live.

The site is live only after the selected public release is authorized, `games/.nojekyll` exists, public `/_kit/shell.js` returns 200, and a fresh live CDP run boots the current game with required art settled.
