# Armara Aegis — Tower Defense Design Spec

**Date:** 2026-08-26
**Status:** Approved direction in chat; the working product defaults are the title **ARMARA AEGIS** and a finite twelve-wave campaign.
**Builds on:** `2026-08-25-armara-five-games-design.md` and the shared `games/_kit/` runtime.

## 1. Purpose and scope

Replace the visible Armara 2048 game with an original fixed-path tower-defense game built for the existing static GameSlop kit. The game must feel like a polished Flash-era portal game, work from `file://`, support mouse, touch, and keyboard, remain deterministic for future replay verification, and use original generated artwork based on Ryan's Armara references.

The shipped result is `games/aegis/`, titled **ARMARA AEGIS**, with the line **HOLD THE ETERNAL GATE**. The existing canonical gold hourglass remains unchanged as the title mark, defended gate seal, and Chronos-tower motif. `games/2048/` and its hub entry are removed. Historical specs and screenshots remain as project history.

Out of scope: free-placement maze building, pathfinding, endless mode, selling towers, accounts, leaderboards, rewards, multiplayer, and externally sourced game code or art.

## 2. Visual direction and generated assets

Armara means “mythic sovereign technology”: monumental Greek marble architecture, burnished bronze and gold, black standards, golden-hour atmosphere, and subtle luminous circuit traces engraved into stone. Technology glows gold, not generic sci-fi blue. Enemy energy may use restrained ember red for danger.

The exact reference files are:

- `docs/armara-reference-art/photo_2026-08-09_05-07-24.jpg` — full mythic-AI language.
- `docs/armara-reference-art/photo_2026-08-10_06-40-53.jpg` — temple, Greek key, sunset, and marble.
- `docs/armara-reference-art/photo_2026-08-10_18-18-29.jpg` — monumental server/relic and circuit halo.
- `docs/armara-reference-art/Hourglass.png` — immutable canonical mark.

Image generation produces a complete original, text-free production set under `games/aegis/skin/armara/`:

- `shell-bg.png`: widescreen Acropolis atmosphere with a deliberately quiet dark center.
- `battlefield.png`: three-quarter/top-down citadel terrace, used beneath a code-drawn route and build pads.
- `sentinel-l1.png`, `sentinel-l2.png`, `sentinel-l3.png`: the Ballista evolves from a compact torsion weapon to a twin-limbed repeater and then a monumental golden rail-ballista.
- `chronos-l1.png`, `chronos-l2.png`, `chronos-l3.png`: the Oracle evolves through larger gyroscopic rings, additional time crystals, and a crowned temporal array.
- `siege-l1.png`, `siege-l2.png`, `siege-l3.png`: the artillery evolves from a bronze catapult to a furnace mortar and then a multi-ring Hephaestus bombard.
- `enemy-scout.png`, `enemy-raider.png`, `enemy-guardian.png`, `enemy-titan.png`: four transparent hostile automata with progressively heavier silhouettes. Allied/Armara machinery uses gold light; enemies use cracked obsidian, oxidized bronze, and restrained ember-red seams.
- `gate.png`: the defended marble-and-gold Eternal Gate, with the canonical hourglass composited separately in code.
- `breach.png`: the hostile circuit portal at the path entrance.

This is 17 generated assets plus the copied canonical hourglass. Every tower upgrade has a materially different silhouette and added machinery; levels are never represented by tint alone. Generated artwork is atmosphere and presentation, never collision truth. The renderer draws the path, pads, ranges, health bars, effects, and UI in code. If an image is unavailable, the game remains fully playable using procedural marble and code-drawn fallbacks. No generated lettering, logo approximation, trademark, or watermark is accepted.

The skin gains optional data keys:

```json
{
  "background": { "image": "shell-bg.png", "position": "center", "overlay": 0.72 },
  "art": {
    "battlefield": "battlefield.png",
    "sentinelL1": "sentinel-l1.png",
    "sentinelL2": "sentinel-l2.png",
    "sentinelL3": "sentinel-l3.png",
    "chronosL1": "chronos-l1.png",
    "chronosL2": "chronos-l2.png",
    "chronosL3": "chronos-l3.png",
    "siegeL1": "siege-l1.png",
    "siegeL2": "siege-l2.png",
    "siegeL3": "siege-l3.png",
    "enemyScout": "enemy-scout.png",
    "enemyRaider": "enemy-raider.png",
    "enemyGuardian": "enemy-guardian.png",
    "enemyTitan": "enemy-titan.png",
    "gate": "gate.png",
    "breach": "breach.png"
  }
}
```

Brand colors, copy, tower tones, and asset filenames remain in `skin.json` and its exact `skin.js` twin. The generated images are copied into the game folder; the untracked `Assets/` directory is never staged.

## 3. Game world and path

Logical world: `100 × 120`, portrait. Path waypoints:

```text
(-5,14) → (28,14) → (28,42) → (74,42) →
(74,70) → (38,70) → (38,101) → (105,101)
```

Ten fixed build pads:

```text
(14,29), (43,18), (58,29), (88,27), (56,55),
(89,57), (19,59), (20,84), (56,86), (78,88)
```

The entrance is an ember-red circuit breach. The endpoint is a marble-and-gold gate carrying the exact hourglass. Towers cannot alter the path.

## 4. Session loop and economy

- Reset state: ready, score 0, 160 aether, integrity 20, wave 0, planning phase, pad 0 selected, Sentinel selected, no towers or enemies.
- Enter or the overlay starts an untimed planning phase.
- Space or the WAVE command begins the next wave only when no wave is active. No overlapping waves.
- Building and upgrading are allowed during planning and combat.
- Kill rewards are paid exactly once. A leaked enemy gives no reward and reduces integrity by its leak value.
- A cleared wave grants `20 + 5 × wave` aether and `100 × wave` score, then returns to planning.
- Clearing wave 12 with integrity above zero grants `integrity × 100` score and ends in victory.
- Integrity reaching zero ends in defeat.
- Both endings emit `gameover`; state also stores `outcome: "victory" | "defeat"` so the shell can show distinct copy and bridge it in stats.

## 5. Towers

All towers auto-target the in-range enemy with greatest path progress; ties use the lowest immutable enemy id. Damage resolves at fire time and attacks never miss. Armor rule: `max(1, damage - armor)`.

| Tower | Build | Level 1 | Level 2 | Level 3 |
|---|---:|---|---|---|
| Sentinel | 40 | 8 dmg, 450 ms, range 22 | +35: 12 dmg, 410 ms, range 24 | +60: 18 dmg, 360 ms, range 26 |
| Chronos | 55 | 3 dmg, 800 ms, range 20, 35% slow/1500 ms | +45: 5 dmg, 720 ms, range 22, 45%/1700 ms | +75: 8 dmg, 650 ms, range 24, 55%/1900 ms |
| Siege | 75 | 18 dmg, 1350 ms, range 24, splash 5 | +60: 28 dmg, 1250 ms, range 26, splash 6 | +90: 42 dmg, 1150 ms, range 28, splash 7 |

Chronos slows do not multiply. The strongest live slow wins; a stronger or equal hit refreshes its duration. Siege applies full armor-adjusted damage independently to each enemy inside the target-centered splash radius. Max level is 3. Invalid or unaffordable commands emit `denied` and do not otherwise mutate state.

## 6. Enemies and waves

| Enemy | HP | Speed | Armor | Bounty | Score | Leak |
|---|---:|---:|---:|---:|---:|---:|
| Scout | 20 | 9 | 0 | 6 | 60 | 1 |
| Raider | 40 | 6 | 0 | 9 | 90 | 1 |
| Guardian | 85 | 4.2 | 3 | 14 | 140 | 2 |
| Titan | 240 | 2.8 | 2 | 30 | 400 | 5 |

Wave HP is `ceil(baseHP × (1 + 0.12 × (wave - 1)))`; other enemy stats stay fixed. Each authored roster is shuffled once with seeded Mulberry32. Spawn interval is `max(420, 850 - 30 × (wave - 1))` ms.

```text
W1  8 Raider                 W7  12 Guardian + 12 Scout
W2  12 Scout                 W8  16 Raider + 10 Guardian
W3  8 Raider + 6 Scout       W9  2 Titan + 12 Raider + 8 Scout
W4  8 Guardian + 6 Scout     W10 14 Guardian + 16 Scout
W5  12 Raider + 10 Scout     W11 2 Titan + 16 Guardian + 10 Raider
W6  1 Titan + 10 Raider + 6 Scout
W12 3 Titan + 18 Guardian + 18 Scout
```

Movement follows the waypoint polyline without overshoot. Path progress is monotonic and is the targeting authority.

## 7. Controls and shared-kit additions

Pointer/touch:

- Tap a build pad to select it.
- Tap one of the three command medallions to choose/build that tower on the selected empty pad.
- Tap Upgrade to upgrade the selected occupied tower.
- Tap Wave to launch the next wave.

Keyboard:

- Left/Right or A/D: cycle pads with wrap.
- 1/2/3: select/build Sentinel, Chronos, or Siege.
- U: upgrade.
- Space: launch wave.
- P/Escape: pause; M: mute; Enter: start.

The shared input layer gains a backward-compatible `gestures.tapAt(point) → semanticAction | null`. `point` contains normalized canvas coordinates derived from `pointerEl.getBoundingClientRect()`. Only the returned semantic string (for example `selectPad:4`) reaches and is logged by the engine, so replay does not depend on viewport pixels. Existing `tap` behavior remains unchanged.

The shell passes `#well` as `pointerEl`, continues to listen on `#wellwrap`, and accepts optional `cfg.endOverlay(state, skin) → {title, body, button}` for victory/defeat copy. `paintGround` becomes backward compatible with either a palette or a skin and layers an optional skin background beneath a dark readability wash.

The always-visible Aegis command bar uses five icon-only buttons with exact `aria-label`/cost text and kit-owned SVG masks: Sentinel, Chronos, Siege, Upgrade, Wave. Minimum target size is 48 px. Tower silhouettes, line styles, and icons—not color alone—communicate type and selection. Reduced-motion removes trails, pulses, and shake.

## 8. Engine and bridge contract

`games/aegis/js/engine.js` is pure, CommonJS-loadable, and attaches `Game.createEngine` in the browser. It follows the existing contract: `state.status`, `score`, `seed`, `inputLog`, `tick`, `dispatch(action)`, `tick(dtMs)`, `reset(seed?)`, and `hash()`.

Additional state includes `gold`, `integrity`, `wave`, `phase`, `outcome`, `selectedPad`, `selectedType`, `towers`, `enemies`, `spawnQueue`, and deterministic timers/ids. Renderer-only particles and projectiles are derived from engine events and never feed back into logic.

Bridge payload remains version 1. Aegis stats include score, wave, integrity, aether, and outcome.

## 9. Testing and acceptance

Baseline before this work is 90/90. Removing 2048 removes 8 tests; Aegis adds 15 deterministic engine tests; the input layer adds one `tapAt` test. Expected total: **98/98** across the kit and all remaining games.

The 15 engine tests cover initial state; lifecycle; pad selection; valid builds; denied builds; upgrades; seeded rosters; spawn catch-up; waypoint/slow movement; targeting; Sentinel cooldown/armor; Chronos slow rules; Siege splash; kill/leak/defeat accounting; and wave-clear/victory plus deterministic replay.

Acceptance also requires:

- Bare `node --test` green inside `_kit` and every remaining game folder.
- `node --check` green for all kit and game JavaScript.
- Desktop 1280×800 and mobile 390×844 screenshots viewed for readability.
- CDP driver proves start, normalized tap selection, build, wave, score, pause/resume, defeat/restart, best persistence, and same-seed reproducibility.
- `games/.nojekyll` remains present.
- After publish, live `/_kit/shell.js` returns 200 and a live Aegis CDP shot reaches `document.body.dataset.ready === "1"` and boots the game.
