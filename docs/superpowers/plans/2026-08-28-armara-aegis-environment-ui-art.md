# Armara Aegis Environment and Interface Art - Implementation Plan

**Date:** 2026-08-28

**Goal:** Replace the generic/asphalt-like battlefield treatment with exact route-following ancient roads, visible mission-specific environments, readable cartoon gameplay pieces, and a polished Ancient Greece-meets-AI interface system.

**Binding spec:** `docs/superpowers/specs/2026-08-28-armara-aegis-environment-ui-art.md`

## 1. Operating constraints

- Work on `main` in `D:\ClaudeCode\GameSlop`.
- Preserve unrelated dirty work. Never stage `research/`, `Assets/`, `.superpowers/`, or root `GAMESLOP_HANDOFF.md`.
- Use `apply_patch` for hand-authored file edits.
- Commit as Ryan `<ryan@xynco.io>` with exact trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Run bare `node --test` inside every game owner folder; the repository baseline must remain fully green.
- Preserve `games/.nojekyll` and the exact canonical hourglass bytes.
- Do not change the public/default Aegis route or publish without Ryan's separate approval.
- Candidate and production approval states remain truthful. Local visual integration does not promote an annex or authorize release.
- Use built-in ImageGen one call per distinct asset. Preview concepts may stay under the built-in generated-images directory; accepted project assets must be copied into the repository and manifested.

## 2. Dependency graph

```text
Approved art specification
        |
        +--> Track A: camera + projection contract
        |          |
        |          +--> Track B: physical-road renderer + guide masks
        |          |          |
        |          |          +--> Track E: M01 environment integration
        |          |
        |          +--> Track D: presentation schema v2 + asset validator
        |                     |
        |                     +--> Tracks E/F/G accepted runtime assets
        |
        +--> Track C: global UI kit contract
        |          |
        |          +--> Track F: shell/menu/result integration
        |
        +--> Track G: M01 cartoon gameplay asset slice
        |
        +--> Track H: twenty-mission concept bible

Tracks E/F/G --> visual/accessibility/performance QA --> scoped commit
```

Only one task owns a file at a time. Subagents receive explicit file ownership and must not stage or commit unless the root agent requests it.

## 3. Phase 1 - Freeze contracts and baselines

### Task 1.1 - Record current visual and asset baseline

**Read-only inputs:**

- `games/aegis/index.html`
- `games/aegis/preview.html`
- `games/aegis/js/renderer.js`
- `games/aegis/js/delivery/preview-controller.js`
- `games/aegis/skin/armara/**`
- current compiled maps and presentation catalog

**Steps:**

1. Record current desktop/mobile screenshots for legacy and developer preview.
2. Record all raster dimensions, alpha modes, compressed bytes, decoded bytes, and consumers.
3. Preserve the canonical logo SHA-256 as an immutable test fixture.
4. Confirm current dynamic viewBoxes, CSS `cover`, duplicated M04 trunk rendering, and current initial-load/decode totals.
5. Store only reviewed reports under `docs/aegis/`; do not add research outputs to the commit.

**Gate:** Baseline is reproducible and no file mutation has occurred outside the approved docs.

### Task 1.2 - Add projection and art decision records

**Owned files:**

- `docs/aegis/architecture-decisions.md` - append only after checking concurrent edits
- a new art-contract fixture under `games/aegis/tests/fixtures/presentation/`

Record the fixed camera, contain/no-crop rule, route-free plate rule, physical-lane ownership, 8+2+2 road hierarchy, layer order, canonical-logo rule, and fallback invariants.

## 4. Phase 2 - Fixed camera and physical-road foundation

### Task 2.1 - Introduce a presentation-owned fixed camera

**Preferred new files:**

- `games/aegis/js/presentation/camera.js`
- `games/aegis/tests/presentation-camera.test.js`

**Integration owners, after concurrent work is reconciled:**

- `games/aegis/js/delivery/preview-controller.js`
- `games/aegis/preview.html`
- later `games/aegis/js/renderer.js`

**Red tests first:**

1. Exact `camera.overscan-16x10-v1` record and 8:5 aspect.
2. World -> asset -> screen -> world round trip for camera corners, board corners, route points, pads, entry, and gate.
3. Required viewport and DPR matrix with deterministic letterbox offsets.
4. Reject CSS-cover tactical placement, aspect mismatch, non-containing camera, unsafe arithmetic, and inferred dynamic camera bounds.
5. Resize/orientation projection changes without simulation mutation.

**Implementation:**

- Export pure projection helpers with integer/fixed-point inputs and immutable results.
- Render the battlefield in an exact 8:5 box and remove the tactical `min-height: 30rem`/`cover` mismatch.
- Use the same transform and offsets for rendering and hit testing.

### Task 2.2 - Normalize visible road geometry from physical lanes

**Preferred new files:**

- `games/aegis/js/presentation/road-geometry.js`
- `games/aegis/js/presentation/road-materials.js`
- `games/aegis/tests/road-presentation.test.js`

Reuse the compiler/map-report normalized physical-lane IR. Do not build a second route geometry implementation.

**Red tests first:**

1. M01 road centerline equals compiled geometry.
2. M04 shared trunk paints exactly once.
3. Declared joins receive one deterministic cap.
4. M07-style overpass fixtures sort by layer without merging logical routes.
5. Road union reports 8-unit core, 12-unit core-plus-shoulders, and optional <=14-unit AO.
6. No center stripe, asphalt style ID, modern curb, or logical-route duplicate is accepted.

**Implementation:**

- Build immutable render pieces from normalized physical subsegments, joins, ends, crossings, and material spans.
- Clip world-anchored textures/patterns to the exact union.
- Provide a high-quality ancient-material implementation and a vector/CSS fallback using the same geometry.

### Task 2.3 - Generate map-art guide masks

**Preferred new files:**

- `tools/lib/aegis/art-guide.js`
- `tools/render-aegis-art-guide.js`
- `games/aegis/tests/art-guide.test.js`

**Outputs:**

- deterministic SVG guides outside runtime asset packs;
- optional raster references rendered from those SVGs for ImageGen input;
- camera, board, physical lanes, shoulders, pad-clear disks, anchors, exclusions, crossing layers, and safe landmark zones.

Tests compare canonical SVG bytes or normalized geometry, not anti-aliased screenshots. Guide generation must not mutate maps.

## 5. Phase 3 - Presentation schema v2 and asset validation

### Task 3.1 - Add strict version dispatch

**Preferred new files:**

- `tools/lib/aegis/v3-presentation-v2.js`
- `games/aegis/tests/presentation-v2.test.js`
- `games/aegis/tests/fixtures/presentation-v2/**`

**Minimal existing integrations:**

- `tools/lib/aegis/v3-presentation.js`
- compiler presentation dispatch and generated-companion tests

Keep v1 byte-for-byte behavior and historical compiled artifacts locked. Version 1 continues rejecting all asset fields. Version 2 has an independent strict validator and cannot fall through to v1.

**Red tests first:**

- exact allowed keys and ASCII ordering;
- camera aspect/containment and asset-camera dimension agreement;
- contained case-correct URLs and exact SHA-256/dimension/byte checks;
- alpha requirements, frame rectangles, gutters, pivots, ground contacts, projectile origins, cap insets, placements, and layers;
- one owning pack, resolved dependency graph, preload classification, and budget totals;
- semantic fallback for every cue;
- duplicate/unowned/unresolved records, dependency cycles, bad hashes, invalid alpha, frame bleed, pivot escape, and budget overrun fail at stable paths;
- v2 presentation changes preserve simulation bytes and `rulesetHash` while changing presentation/release identity.

### Task 3.2 - Add filesystem asset inspector

**Preferred new files:**

- `tools/lib/aegis/asset-inspector.js`
- `tools/validate-aegis-art.js`
- `games/aegis/tests/asset-inspector.test.js`

The inspector verifies actual files rather than trusting authored claims. It computes hashes, dimensions, compressed/decoded bytes, alpha occupancy, frame bounds, gutters, and pack totals. It rejects opaque checkerboard atlases and large connected matte regions using explicit fixtures; it does not repair them at runtime.

### Task 3.3 - Define developer-preview and production gates

- Candidate content may use schema-v1 procedural fallback.
- A locally integrated schema-v2 developer pack remains non-release-eligible until its applicable annex and release descriptor permit selection.
- Production selection fails unless every required asset, fallback, evidence record, budget, and approval state is valid.
- Missing/corrupt assets at runtime select deterministic presentation fallbacks only and never alter simulation.

## 6. Phase 4 - Global Ancient Greece-meets-AI interface kit

### Task 4.1 - Build code-native primitives first

**Preferred new files:**

- `games/aegis/css/aegis-art-system.css`
- `games/aegis/js/presentation/ui-theme.js`
- `games/aegis/tests/ui-theme.test.js`

Implement tokens and reusable classes for marble panels, bronze edges, gold hierarchy, cyan/violet powered states, Greek-key dividers, focus rings, chips, cards, buttons, tabs, modals, tooltips, and sheets. Use live text and semantic icons. Ensure 4.5:1 text contrast, 3:1 control boundaries, visible focus, safe-area support, and 200% zoom.

### Task 4.2 - Generate and normalize decorative UI rasters

Use built-in ImageGen for one asset per call:

1. crop-safe landscape shell environment;
2. crop-safe portrait shell environment;
3. blank marble/bronze nine-slice ornament source;
4. blank victory/share-card ornament source;
5. four act-banner ornament sources.

Prompts forbid text, statistics, prices, icons, logos, fake hourglasses, watermarks, and baked controls. Normalize accepted assets, define cap insets/crops, and copy only reviewed finals into a versioned global art directory.

### Task 4.3 - Apply the kit to required surfaces

Integrate shell/title, hub, campaign map, briefing, loadout, battle HUD/store/inspector, wave preview, tutorial, results, Codex, replay, settings, community, offline/loading/error, and victory/share layouts as those surfaces become available. Missing future screens receive documented components and contracts, not fabricated navigation behavior.

## 7. Phase 5 - M01 Gate of Dawn visual vertical slice

### Task 5.1 - Generate the route-free environment plate

**Generation references:**

- exact M01 camera/guide mask: composition and quiet-zone reference;
- current Armara shell/background: material and mood reference only;
- approved Gate of Dawn concept: palette/material reference only;
- canonical logo: immutable-brand exclusion reference, never an edit target.

**Final prompt intent:**

```text
Use case: stylized-concept
Asset type: route-free tower-defense environment plate
Primary request: Gate of Dawn, a bright near-overhead Attican approach into an ancient Greek AI city at sunrise
Composition: exact fixed 16:10 camera; preserve every marked route, pad, anchor, and exclusion quiet zone from the guide
Style: polished stylized game illustration; monumental marble/bronze/gold world; quieter than cartoon units
Materials: dry Attican earth, limestone terraces, olive scrub, marble city architecture, restrained cyan/violet/gold inlay away from tactical quiet zones
Constraints: scenery only; no road, trail, paving ribbon, route, pads, foundations, gate asset, breach, units, UI, text, watermark, logo, or hourglass; no false tactical line; no modern objects
```

Inspect and iterate until the plate is genuinely route-free, readable, and correctly composed. Produce the 1280 x 800 derivative from the accepted master through deterministic offline tooling, not a new generation.

### Task 5.2 - Build exact M01 road materials

Generate separate seamless material sources for packed Attican earth, worn limestone setts, and fitted city cobble. Code owns masks, widths, corners, joins, and transitions. The generated texture never owns route geometry. Add world-space dust/edge decals sparingly outside the dominant eight-unit core.

### Task 5.3 - Build neutral foundations and environmental anchors

Generate/normalize transparent Attican plinth and approved landmark cutouts only after exact logical bounds and pivots exist. Integrate canonical-logo gate and breach states without modifying the canonical logo pixels. All clickable, focus, selected, affordability, range, and warning states remain code-driven.

### Task 5.4 - Integrate and validate static M01 layers

Render plate, road, plinths, landmarks, and gates through the fixed camera. Cache static layers. Validate actual desktop/mobile screenshots against guide overlays and confirm no fake roads, drift, crop, duplicate trunk, hidden pads, or occlusion.

## 8. Phase 6 - Cartoon gameplay-piece M01 slice

### Task 6.1 - Lock sprite contracts before generation

For Sentinel, Chronos, Siege, Scout, and Raider define exact source canvas, facing, ground contact, visual bounds, pivot, projectile origin, minimum rendered size, palette, light direction, frame names, and modular reuse. Generate one character/tower family asset or animation strip per call, never a mixed unlabeled collage.

### Task 6.2 - Generate and normalize starter defenses

Cover three levels for each starter family with readable upgrade silhouettes, idle A/B, charge/anticipation, fire, recoil/recovery, and hit/disabled coverage. Keep bases and rotatable/animated tops modular when useful. Generate matching store/Codex portraits from the same approved design anchors.

### Task 6.3 - Generate and normalize M01 enemies

Scout and Raider receive eight required poses/states with genuine alpha and stable scale/pivot. Animation uses frame timing and smooth world interpolation; no static bobbing substitute.

### Task 6.4 - Effects and semantic cues

Prefer code-native projectiles, range rings, shadows, health/shield/status bars, focus, and simple particles. Generate raster effects only when they materially improve the distinct Sentinel, Chronos, or Siege identity. Reduced Motion maintains meaning without bob, shake, or rapid flash.

## 9. Phase 7 - Campaign concept bible without false finality

Generate one reviewed environment concept per mission, or one mission-specific concept board per call when it contains no runtime asset. Every prompt uses the Section 6 environment identity/material family and forbids modern roads, fake tactical geometry, text, watermarks, logos, and generated hourglasses.

Store accepted concept references under a documented design-source location that is never loaded by the game. Do not call them final backgrounds. M02-M20 production plates wait for accepted route guides; M04/M05 follow immediately after the M01 pipeline passes.

## 10. Phase 8 - UI, art, accessibility, and performance QA

### Automated gates

1. Bare `node --test` in `_kit`, `armaratris`, `serpent`, `breaker`, `flight`, `starfall`, and `aegis`.
2. `node --check` for all changed JavaScript.
3. Historical schema-v1/v2 and compiled-artifact byte locks unchanged.
4. Asset validator, pack budgets, canonical logo hash, `.nojekyll`, and relative-path checks.
5. Projection goldens at all required viewports/DPRs and orientation change.
6. M04 trunk once, crossing order, exact road widths, pivots, gutters, and missing/corrupt fallback.
7. Identical simulation/replay hashes with art present, absent, and corrupt.
8. 100 enemies/15 towers: p95 <=16.7 ms desktop and <=33.3 ms mobile; active decoded art <=64 MB.

### Browser journeys

- Boot legacy/public route unchanged.
- Boot developer preview over local HTTP and wait for game-ready plus art-ready.
- Open an empty foundation, compare affordable/unaffordable cards, build each starter, inspect/upgrade/sell, start a wave, observe locomotion/fire/hit states, rotate viewport, finish/retry, and open victory/share treatment.
- Repeat keyboard-only and Reduced Motion journeys.
- Capture and inspect `320 x 568`, `390 x 844`, `768 x 1024`, `1280 x 800`, and `1920 x 1080` screenshots.
- Verify direct `file://` fallback where the current delivery contract requires it.

Use the repository CDP tooling when the in-app browser is unavailable. Screenshots are evidence, not a substitute for interaction and state assertions.

## 11. Commit and handoff policy

Before every commit:

1. Re-read `git status --short` and distinguish concurrent/user-owned changes.
2. Stage only explicit owned paths. Never use broad staging.
3. Confirm staged diff contains no `research/`, `Assets/`, `.superpowers/`, root handoff, generated preview evidence, or unrelated Candidate-BAL tuning.
4. Confirm author/committer is Ryan and append the exact Claude co-author trailer.
5. Record tests, screenshots, known fallbacks, asset paths, hashes, prompt set, and remaining approval gates in the handoff.

Recommended commits are contract/tooling, fixed-camera/road foundation, schema-v2 validator, global UI kit, M01 static environment pack, M01 animated gameplay pack, and final visual QA. Combine only when shared dirty files make a smaller truthful commit safer.

No push, Pages publication, default-route switch, or production descriptor selection occurs without Ryan's explicit approval.
