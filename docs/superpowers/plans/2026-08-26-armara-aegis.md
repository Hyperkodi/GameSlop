# Armara Aegis Implementation Plan

**Goal:** Replace the visible 2048 game with a deterministic twelve-wave Armara tower-defense game, enrich it with original generated Greek/AI artwork, and publish it on the existing GitHub Pages mirror.

**Spec:** `docs/superpowers/specs/2026-08-26-armara-aegis-design.md` is binding.

**Architecture:** Keep the classic-script, no-build shared kit. Add one normalized tap-to-semantic-action input hook, one optional end-overlay hook, and optional skin-driven page backgrounds. Aegis remains an engine + renderer + config, with all logic deterministic and all generated art presentation-only.

**Global constraints:** Work on `main`; preserve unrelated dirty `research/` and untracked `Assets/`; never stage `research/`, `Assets/`, or `.superpowers/`; use bare `node --test` from each owning folder; commit as Ryan with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`; keep `games/.nojekyll`.

## Task 1 — Shared kit hooks

Files:

- Modify `games/_kit/input.js`
- Modify `games/_kit/tests/input.test.js`
- Modify `games/_kit/shell.js`
- Modify `games/_kit/draw.js`
- Modify `games/_kit/kit.css`

Steps:

1. Add a failing input test for `gestures.tapAt(point)` using a pointer element with a known rectangle. Assert normalized coordinates, one semantic action, and no action after movement/cancel.
2. Implement `pointerEl` plus backward-compatible `tapAt`, preserving existing `tap` behavior and normalized/clamped coordinates.
3. Pass `#well` as `pointerEl` from the shell.
4. Add optional `cfg.endOverlay(state, skin)` without changing existing game-over copy.
5. Make `paintGround` accept either the old palette argument or a skin and layer optional background image/position/overlay with the procedural tile as fallback.
6. Add kit-owned icon masks and reusable command-bar styling for Sentinel, Chronos, Siege, Upgrade, and Wave.
7. Run `_kit` bare tests and syntax checks.

## Task 2 — Deterministic Aegis engine

Files:

- Create `games/aegis/js/engine.js`
- Create `games/aegis/tests/engine.test.js`

Steps:

1. Write exactly the 15 behavior tests enumerated in spec §9 before the engine.
2. Implement path geometry, pads, tower/enemy tables, authored waves, deterministic shuffling/spawning, movement, targeting, damage/armor/slow/splash, economy, lifecycle, victory/defeat, logging, reset, and hash.
3. Keep renderer-only visual state out of the engine.
4. Run bare `node --test` from `games/aegis` and `node --check`.

## Task 3 — Generate and integrate original Armara art

Files:

- Create `games/aegis/skin/armara/shell-bg.png`
- Create `games/aegis/skin/armara/battlefield.png`
- Create `games/aegis/skin/armara/{sentinel,chronos,siege}-l{1,2,3}.png`
- Create `games/aegis/skin/armara/enemy-{scout,raider,guardian,titan}.png`
- Create `games/aegis/skin/armara/gate.png`
- Create `games/aegis/skin/armara/breach.png`
- Copy canonical `games/aegis/skin/armara/logo.png`

Steps:

1. Use the built-in image generation workflow with the three local Armara photographs explicitly labeled as style references.
2. Generate text-free shell and battlefield images; inspect for center readability, path neutrality, Greek architecture, gold circuitry, and absence of fake logos/text.
3. Generate a consistent transparent level-1 render for each tower, then derive level 2 and 3 from its preceding level while preserving the family identity and visibly adding machinery, scale, and power. Tint-only upgrades are unacceptable.
4. Generate four consistent transparent enemy automata, plus the defended gate and hostile breach portal.
5. Inspect every sprite for readable silhouette, real alpha, consistent camera/lighting, and absence of text/fake logos.
6. Iterate only when an output violates the spec.
7. Copy all 17 generated assets plus the canonical hourglass into the skin folder without altering source references or `Assets/`.

## Task 4 — Renderer, skin, page, and controls

Files:

- Create `games/aegis/js/renderer.js`
- Create `games/aegis/js/game.js`
- Create `games/aegis/index.html`
- Create `games/aegis/skin/armara/skin.json`
- Create exact `games/aegis/skin/armara/skin.js` twin

Steps:

1. Build the 100×120 portrait renderer with generated battlefield art plus code-drawn route, breach, gate, pads, tower ranges, enemies, health bars, effects, HUD, and procedural fallbacks.
2. Implement renderer hit testing that maps normalized points only to stable semantic actions.
3. Configure sounds, stats, keys, `tapAt`, command buttons, event effects, and distinct victory/defeat overlay copy.
4. Build accessible markup, five icon-only command buttons, live status text, exact hourglass logo, and standard kit script order.
5. Put all brand values/copy/assets in the skin manifest and regenerate the exact JS twin.
6. Verify `file://` boot and syntax.

## Task 5 — Replace 2048 in the collection

Files:

- Remove `games/2048/`
- Modify `games/index.html`
- Modify `games/README.md`

Steps:

1. Delete the tracked 2048 game folder; leave historical specs/screenshots intact.
2. Replace its hub card with Aegis and update copy/counts/test instructions.
3. Verify every visible hub link resolves locally.

## Task 6 — Full QA, commit, publish, and live proof

1. Run bare tests in `_kit`, `armaratris`, `serpent`, `breaker`, `flight`, `starfall`, and `aegis`; expect 98/98.
2. Run syntax checks over all remaining kit/game JS.
3. Generate and inspect `docs/game-screenshots/aegis-desktop.png`, `aegis-mobile.png`, refreshed hub desktop/mobile, and a driven gameplay shot.
4. Exercise start, tap/select/build, upgrade, wave progression/score, pause/resume, defeat, restart, local best, seed replay, skin fallback, and reduced-motion presentation.
5. Review the scoped diff; confirm `research/`, `Assets/`, and `.superpowers/` are unstaged and `games/.nojekyll` exists.
6. Commit on `main` as Ryan with the required Claude co-author trailer.
7. Push `origin main`, run `bash tools/publish-games.sh`, verify live `/_kit/shell.js` is 200, and take a live Aegis CDP shot that proves `body.dataset.ready === "1"` and a game boot.
