# Armara Aegis Landscape Redesign — Implementation Plan

**Goal:** Rebuild Aegis as a large, readable landscape tower-defense game with animated cartoon units, contextual build/management panels, persistent Aether information, automatic management pause, and 70% selling.

**Binding spec:** `docs/superpowers/specs/2026-08-26-armara-aegis-landscape-redesign.md`

**Constraints:** Work on `main`; preserve unrelated dirty `research/` and untracked `Assets/`; never stage `research/`, `Assets/`, or `.superpowers/`; use `apply_patch` for source edits; run bare `node --test` in each owner folder; commit as Ryan with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`; preserve `games/.nojekyll` and the exact canonical hourglass.

## Track 1 — Engine, landscape geometry, and selling

Owned files:

- `games/aegis/js/engine.js`
- `games/aegis/tests/engine.test.js`

Steps:

1. Replace the world, path, and pad constants with the approved 160×100 landscape geometry.
2. Update only coordinate-sensitive fixtures; retain existing wave and combat expectations.
3. Track total investment deterministically and implement selected-pad `sell` with `floor(invested × 0.70)`.
4. Add tests for level 1/2/3 refunds, empty-pad denial, one-time removal/refund, and replay stability.
5. Run bare Aegis tests and syntax checks.

## Track 2 — Contextual interface and responsive landscape shell

Owned files:

- `games/aegis/index.html`
- `games/aegis/css/aegis.css`
- `games/aegis/js/game.js`
- `games/aegis/skin/armara/skin.json`
- `games/aegis/skin/armara/skin.js`

Steps:

1. Replace the permanent side panels and icon bar with a full-width stage, overlaid HUD, large Aether chip, labelled wave control, and contextual panel.
2. Build three complete tower cards and the occupied-tower inspector with current/next stats, upgrade price, sell refund, feedback copy, and close control.
3. Keep all mapped action buttons inside the input root, but let Aegis renderer/controller show and update the appropriate panel state.
4. Add Aegis-only desktop panel positioning and narrow-screen bottom-sheet behavior without altering layouts of other games.
5. Add keyboard mapping for sell and update accessible help/labels.
6. Regenerate `skin.js` as the exact twin of `skin.json`.

## Track 3 — Shared animation/presentation hooks

Owned files:

- `games/_kit/shell.js`
- relevant `games/_kit/tests/` files if a testable helper is introduced

Steps:

1. Before each fixed tick, call optional `renderer.capturePrevious(state)`.
2. Pass fixed-step interpolation metadata to `renderer.draw` while preserving existing arguments.
3. If optional `renderer.pausesSimulation()` is true, discard accumulated simulation time but continue drawing and accepting build/upgrade/sell input.
4. If contextual management is open, Escape/P calls optional `renderer.closePanel()` before using the normal manual-pause overlay.
5. Prove all existing kit tests and games remain compatible.

## Track 4 — Generated production art

Owned files:

- the 12 new PNGs named in the binding spec under `games/aegis/skin/armara/`

Steps:

1. Use the built-in image-generation workflow and the local Armara reference images for visual language only.
2. Generate the quiet 16:10 Greek-tech battlefield, four strict 3×2 enemy pose atlases, six strict three-level tower layer atlases, and the three-card portrait atlas.
3. Inspect every result for clear grid/cell boundaries, consistent viewpoint, bright palette, thick outlines, transparent presentation, readable silhouettes, and absence of text/fake logos.
4. Iterate any asset that fails. Validate dimensions and alpha mechanically; normalize every gameplay atlas to strict cells and browser-sized source dimensions. If built-in output bakes a neutral transparency matte, use the renderer's one-time exterior/large-island neutral cleanup without touching protected outlined interiors.
5. Do not alter or stage `Assets/`; keep the canonical hourglass unchanged.

## Track 5 — Animated renderer and contextual controller

Owned file:

- `games/aegis/js/renderer.js`

Steps:

1. Convert geometry and sizing to the 160×100 landscape world and Aegis-specific maximum viewport.
2. Load/draw the atlases with procedural fallbacks and minimum CSS-pixel sprite sizes.
3. Implement interpolated progress, stable walk phases, eased facing, shadows, thick HP bars, stronger selection/range treatments, and quieter terrain/path hierarchy.
4. Split tower base/top rendering; aim and animate tops from attack events.
5. Replace straight line flashes with bounded Sentinel, Chronos, and Siege projectile/effect sequences.
6. Own panel open/close state, automatic presentation pause, desktop side flipping, bottom-sheet state, live card/inspector content, affordability, stat deltas, and signed Aether feedback.
7. Preserve reduced-motion and image-failure fallbacks.

## Track 6 — Integration and QA

1. Integrate tracks in the order: engine/shared hooks → HTML/CSS/config → assets → renderer.
2. Run bare tests in `_kit`, `armaratris`, `serpent`, `breaker`, `flight`, `starfall`, and `aegis`; no failures allowed.
3. Run `node --check` across kit and game JavaScript and verify `skin.json`/`skin.js` parity.
4. Run local HTTP/CDP desktop and mobile scenarios, wait for both game-ready and art-ready signals, capture screenshots, inspect them visually, and iterate readability/interaction defects.
5. Confirm exact hourglass hash, `games/.nojekyll`, scoped Git diff, and exclusion of `research/`, `Assets/`, and `.superpowers/`.
6. Commit on `main` as Ryan with the required trailer, push `origin main`, publish the Pages mirror, verify live `_kit/shell.js` 200, and prove a live Aegis boot/interact shot.
