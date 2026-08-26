# Armara Aegis — Landscape Readability Redesign

**Date:** 2026-08-26
**Status:** Approved by Ryan in chat
**Supersedes for presentation and interaction:** `2026-08-26-armara-aegis-design.md` sections 2, 3, 7, and the former no-selling scope decision. The original combat tables, twelve-wave campaign, brand, and deterministic rules remain binding unless amended below.

## 1. Approved product direction

Armara Aegis becomes a large landscape tower-defense game with a contextual command interface. Ryan approved all four decisions from the reference-game review:

1. Replace the portrait battlefield with a landscape map and newly authored route.
2. Automatically suspend combat while the build store or tower inspector is open.
3. Allow a tower to be sold for 70% of all Aether invested in it.
4. Use a bright high-contrast faction palette: cyan Sentinel, violet Chronos, orange/coral Siege, crimson/magenta enemies, with shared Armara gold and ivory trim.

The exact canonical hourglass remains unchanged. The game remains an original Armara work rather than a visual copy of another tower-defense title.

## 2. Reference-game lessons

The redesign combines four established interaction patterns:

- Kingdom Rush: choose a construction pad first, then open contextual build or upgrade actions.
- Bloons TD and Plants vs. Zombies: keep currency persistent and print cost directly on every purchase card.
- Infinitode: expose the selected tower's useful combat statistics and next upgrade deltas.
- Plants vs. Zombies accessibility presentation: quiet the battlefield behind high-contrast gameplay pieces instead of trying to make every background element vivid.

These are interaction lessons only. No external code, art, names, maps, balance data, or proprietary assets are copied.

## 3. Landscape world and route

Logical world: `160 × 100`, landscape. The route preserves approximately the original total travel distance so the existing tower ranges, cooldowns, enemy speeds, and wave balance remain useful.

```text
(-8,18) → (42,18) → (42,48) → (88,48) →
(88,76) → (132,76) → (132,44) → (168,44)
```

Ten fixed construction pads:

```text
(18,34), (61,17), (61,64), (76,31), (104,32),
(105,61), (106,90), (148,88), (148,61), (148,27)
```

The hostile breach remains at the left entrance and the Eternal Gate with the exact hourglass remains at the right endpoint. The code-drawn path must be lighter and simpler than the surrounding terrace. Pads need a minimum 48 CSS-pixel pointer target even when their visible rings are smaller.

At a 1280×800 viewport, the desktop target is approximately `1050 × 656` CSS pixels, clamped to the available viewport. The board uses the full center stage; no permanent 172-pixel side columns or bottom icon strip remain. On narrow portrait screens, the entire landscape map remains visible and contextual controls become a bottom sheet; gameplay sprites use minimum pixel sizes so they do not collapse with the map scale.

## 4. Information hierarchy and controls

### Persistent HUD

An overlaid HUD remains visible whenever the game is running:

- A prominent `AETHER` chip with the exact current balance.
- Integrity and current/next wave.
- A labelled `START WAVE N` button while planning.
- Pause and sound controls.
- Score may remain secondary; the economy cannot be visually subordinate to score.

Purchases and sales briefly show signed feedback such as `−40 Aether` or `+52 Aether`. An unaffordable purchase says how much more is required and does not rely only on dimming.

### Empty-pad store

Selecting an empty pad opens a contextual desktop panel, positioned on the side least likely to cover the selected pad. On narrow screens it opens as a bottom sheet. All three build choices are simultaneously visible and each card contains:

- Bright tower portrait and full name.
- Plain-language role.
- Exact build price.
- Damage, attacks per second, and range.
- Chronos slow percentage/duration or Siege splash radius where applicable.
- A real labelled `BUILD — N` button with an affordable/unaffordable state.

No tower choice is represented by an unexplained icon.

### Occupied-pad inspector

Selecting a built tower opens the same contextual surface with:

- Name, level, portrait, role, current stats, and a visible range ring.
- Current-to-next-level stat changes.
- `UPGRADE — N` or a clear `MAX LEVEL` state.
- `SELL — N`, where the refund is defined below.

The panel has a visible Close button. Escape closes it. Opening it suspends combat immediately; closing it resumes automatically. Build, upgrade, and sell remain available while the panel has suspended the presentation loop. A manual Pause remains a separate engine state and uses the standard pause overlay.

## 5. Selling rule

Each tower stores or can deterministically derive its total invested Aether:

```text
invested = build cost + every paid upgrade cost
refund = floor(invested × 0.70)
```

`sell` applies only to the selected occupied pad. It removes exactly that tower, adds the integer refund once, and emits a `sell` event containing tower id, pad, type, level, invested amount, and refund. Selling an empty pad is denied. Selling cannot duplicate rewards or alter enemy state.

Examples:

- Level-1 Sentinel: invested 40, refund 28.
- Level-2 Sentinel: invested 75, refund 52.
- Level-3 Siege: invested 225, refund 157.

## 6. Bright cartoon production art

Gameplay art is designed for final display at roughly 32–110 CSS pixels, not as downsampled concept art. Every foreground piece uses:

- Simplified three-value cel shading.
- A thick near-black/navy outer contour.
- A thin ivory or faction-color rim highlight.
- Large identifying shapes and restrained internal detail.
- A soft grounded shadow drawn by the renderer.
- Genuine alpha whenever the built-in generator provides it; if that export instead bakes a
  neutral transparency matte, the renderer may remove the edge-connected neutral exterior and
  large enclosed neutral matte islands once at load time while preserving outlined ivory details.
  No checkerboard may remain visible in play, and no text, watermark, or fake hourglass is accepted.

Palette:

- Sentinel: electric cyan/azure, ivory armor, Armara gold fittings.
- Chronos: luminous violet, cool white/cyan time energy, Armara gold rings; exact hourglass is composited in code.
- Siege: hot orange/coral, dark bronze chassis, Armara gold fittings.
- Enemies: crimson/magenta primary energy, obsidian/navy structure, with silhouettes and secondary accents that distinguish Scout, Raider, Guardian, and Titan without color alone.

The new generated set contains at least 45 useful illustrated states in 12 production files:

- `battlefield-v2.png`: quiet landscape Greek terrace with a readable route region.
- `enemy-{scout,raider,guardian,titan}-atlas.png`: each a strict 3×2 atlas containing idle/contact, left-step, right-step, hit, stagger, and defeated poses.
- `{sentinel,chronos,siege}-base-atlas.png`: three cells, one base for each upgrade level.
- `{sentinel,chronos,siege}-top-atlas.png`: three cells, one independently rotatable/animated weapon or core for each upgrade level.
- `tower-card-atlas.png`: three bright, close-cropped shop portraits.

Existing gate and breach art may remain if it passes the new contrast review. The exact `logo.png` is reused without regeneration. Projectiles, range fills, selection rings, health bars, damage flashes, and short particles are code-drawn so timing remains flexible and readable.

## 7. Animation architecture

Simulation remains fixed-step and deterministic. Cosmetic animation never feeds the engine, input log, hit testing, targeting, damage, or economy.

The shared shell gains backward-compatible optional renderer hooks:

- `capturePrevious(state)` immediately before a fixed simulation tick.
- `draw(state, extras, frameMeta)` receives `{alpha, stepMs, now}`.
- `pausesSimulation()` may suspend fixed ticks for a contextual management panel without changing the engine's manual-pause status.
- `closePanel()` lets Escape/P close contextual management before invoking the standard pause overlay.

Other games ignore the optional hooks and must remain unchanged.

Aegis uses stable enemy/tower ids for presentation-only state:

- Enemy progress is interpolated between fixed ticks; path tangent controls facing and corner turns ease instead of snapping.
- Walk pose is derived from interpolated distance plus a stable id offset. Hit/stagger/death poses come from events.
- Tower tops aim toward the last target. Attack events trigger anticipation, recoil/charge/spin, and recovery.
- Sentinel fires a cyan-gold bolt, Chronos a violet time orb/ripple, and Siege an orange arcing shell with a circular blast.
- Build and upgrade use a short squash/pop flourish; sell uses a clean dissolve/ring.
- Effects are bounded and presentation-only. Reduced-motion retains smooth positional interpolation but removes bob, recoil, shake, and large bursts.

## 8. Accessibility and responsive behavior

- Text contrast targets WCAG AA for normal UI text.
- Prices and affordability never depend on color alone.
- Buttons use visible labels, actual disabled state where safe, exact `aria-label`s, and keyboard focus styles.
- The contextual surface uses dialog semantics and returns focus sensibly when closed.
- Keyboard remains: Left/Right or A/D cycle pads, 1/2/3 build, U upgrade, S sell, Space starts a wave, Escape closes management or pauses, P pauses, M mutes, Enter starts.
- On mobile, HUD text remains legible, cards scroll within a bottom sheet, and no essential state is hidden in an accessibility-only label.

## 9. Acceptance

- Existing deterministic combat behavior remains green after updating coordinate-specific fixtures.
- New selling behavior, exact refunds, denial, and replay determinism are covered by bare `node --test`.
- All kit and game tests remain green; all JavaScript passes `node --check`.
- Desktop 1280×800 and mobile 390×844 screenshots visibly prove the larger landscape board, persistent Aether, readable costs/descriptions, and bright units.
- A driven browser check proves: start, select empty pad, automatic simulation suspension, build, inspect, upgrade, sell/refund, close/resume, start wave, animated movement, manual pause/resume, and restart.
- The canonical hourglass pixels remain unchanged.
- `games/.nojekyll` exists. After publishing, `/_kit/shell.js` returns 200 and a live CDP shot boots
  Aegis with `body.dataset.ready === "1"` and all authored art settled in `body.dataset.artReady === "1"`.
