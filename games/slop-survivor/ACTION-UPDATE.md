# Slop Survivor 3.0 — active defense

## 3.1 follow-up: rug, entrance and speed

- Rug Pull deploys a full patterned carpet with a gold border, tassels and an unrolling edge, drawn under the snakes. Its older dotted ellipse is gone.
- New waves and revives feed from above the screen. The previous 620-unit head start is removed; the body follows through a curved entrance.
- Normal movement is approximately 2.5–3× the 3.0 rate. Enemy health is reduced to keep the faster fights beatable, instead of slowing the snakes. Existing 3.0 saves receive that health adjustment once while retaining position and damage fraction.
- The arena footer displays **v3.1.0**, and the offline cache includes the rug renderer.
- Opening-level aiming simulations clear five seeds in 41–60 seconds; idle and parked fire lose all five. 179 game tests pass, as do both joystick policy tests and the desktop/mobile/offline browser checks. Visual evidence: `../../artifacts/slop-survivor/action-qa/v3.1-rug.png` and `v3.1-entry.png`.

The following sections record the original 3.0 update and its earlier balance measurements.

Implemented September 20, 2026 in this workspace's own `games/slop-survivor` project. No shared website checkout or live deployment was changed.

## Play

Run `npm start` here, or open `http://localhost:8193` while the local server is running. No build step is required.

- Hold the mouse button to aim and fire; hovering does not shoot.
- Mobile uses the existing analog aim joystick. Moving outside its dead zone aims and fires; releasing stops fire.
- Arrow keys / WASD also aim and fire. A controller's stick aims; A activates the special, B vents.
- Release fire to cool down, or press R / Vent for a 1.15-second vent. Overheating latches until you release or vent, preventing a parked trigger from playing indefinitely.
- Space / the star button activates the equipped special. Escape pauses; F toggles speed.

## Combat and encounters

The normal snake speed is several times the previous post-entry crawl. The smaller heads and bodies reveal more of each longer serpent. Arc-length sampled curves give smooth turning without speeding up through bends. Each wave gets seeded route variations; independent speed pulses, body ripples, fin motion and head breathing make the snakes less mechanical.

Six encounter styles repeat through the campaign alongside its existing armor, regeneration, volatile sections and boss phases: Serpent Hunt, Crossfire, The Coil, Sidewinder Rush, Four-Head Siege, and Viper Swarm. Encounters contain one to four snakes. Each has its own path, breach checks and recoil: breaking one does not freeze the others. Tournament encounters also change style and introduce four-snake waves.

Direct projectiles travel toward the crosshair rather than snapping to an enemy. Glowing weak sections take 65% extra damage. A single articulated cannon stays in the player's hands and rotates toward the actual launch point. Explosives and napalm descend on marked zones; napalm leaves a persistent fire field. Drones, the printer and summoned attacks have separate launch positions. Gas Fees unlocks after Easy level 1; Napalm Strike after Easy level 3.

Upgrade frequency now follows the wave's body-piece count, keeping four-snake waves from producing an excessive number of menus. Multi-snake encounters share the wave health budget and have a speed allowance for the extra targets. Difficulty tiers still affect speed, shields, health and traits.

## Saves

v3.2.2: Rug Pull uses per-snake contact with the carpet's rectangular, unrolling footprint instead of setting a global slow timer. Living head/body contact applies the rug's slow until contact ends or the rug expires. Overlapping slows use the strongest value, preserving Market Crash. Previously saved global rug slows are cleared on resume, while their remaining carpets still work locally. The renderer shares collision bounds and shows SLOWED above affected heads. All 192 game tests pass, including four-snake isolation, contact boundaries, upgrades, expiry, pause and saved-run continuation. Portrait/landscape rug screenshots and desktop/mobile/offline browser checks pass.

v3.2.0: renamed the visible game and install manifest to Wojak Survivor without changing storage keys or the install ID. Heads mirror horizontally without rotation. Ten authored route families have 100 distinct level variants; `routeVersion: 2` applies at wave spawn, so existing waves keep their saved geometry. Movement now includes capped level/difficulty scaling inside `actionSpeed`, removing the additional legacy speed multiplication. Opening speed falls from 170 to 124 before formation modifiers, and level growth is capped at 16%. Prominent gold fullscreen toggles work from both home and battle, with an unsupported-browser fallback.

Verification: 185 game tests and both joystick policy tests pass. Browser checks cover fullscreen entry/exit from home and battle at desktop, two portrait sizes and landscape, plus launch/resume and offline reload. Five deterministic opening simulations win with active aiming in 48–64 seconds; idle and parked aiming lose. Route diagrams and both head orientations were visually inspected in `artifacts/slop-survivor/action-qa/`. Browser coverage uses headless Chrome emulation; this does not establish human difficulty balance across all 100 levels.

v3.1.2 repairs a launch failure in migrated accounts: legacy chapter mapping could select a level beyond the first unlocked level, causing Enter Siege to throw `Level or difficulty is locked`. Save normalization now selects the highest unlocked level when the stored selection is locked and falls back to Easy when the stored difficulty is locked. Valid manual selections, clears, currency, upgrades and saved battles are retained. This also repairs accounts converted by earlier builds. All 182 game tests pass, including launch checks for all 15 legacy chapters; browser checks reproduce the failure before the fix and verify old Chapter 3, already-converted and fresh accounts after it.

The account save schema stays at version 2; new combat uses `combatVersion: 3`. Existing progress and both saved run slots remain supported. Opening an older battle upgrades its geometry once, retaining the wave, shields, score, charge, arsenal, cards and proportional remaining enemy health. In-flight effects are cleared during that one-time conversion. Modern saves preserve every snake's state and resume deterministically. Entering battle clears held input.

Historical combat regression suites explicitly use `tests/legacy-engine.mjs`; twelve new action tests cover the shipped combat, including all 24 normal and legendary weapons. The old `tests/balance.mjs` feed-time model describes v2 automatic-fire pacing. Current aiming simulations are in `tests/action-harness.mjs`.

## Verification

- 176 game tests passed; both workspace mobile-joystick policy tests passed.
- Five opening seeds: idle and parked-fire simulations all lose. Predictive aim plus venting wins all five in 92–115 active seconds, with 12–13 upgrade choices. These are deterministic simulations, not claims about human win rates.
- All 100 levels spawn valid modern encounter states. Sampled later Easy/Hard levels were simulated to check progression; a full human balance pass remains useful.
- Local headless Chrome: 1280×900 desktop, 390×844 and 320×700 portrait, 844×390 landscape; no page errors or horizontal overflow.
- Checked mouse hover/release, joystick cancellation, pause, two-finger aim plus vent, orientation release, four simultaneous snakes, and offline reload/resume.
- Browser evidence and screenshots: `../../artifacts/slop-survivor/action-qa/`. Test logs: `../../artifacts/slop-survivor/action-tests.txt`, `action-joystick-policy.txt`, and `action-balance.jsonl`.
- The connected Browser plugin had no available browser. Visual and input checks used a separate local headless Chrome instance; no signed-in user browser was controlled. Mobile checks are emulation, not physical-device tests.

## Generated art

Final project asset: [assets/serpent-bestiary.png](assets/serpent-bestiary.png), a transparent four-head atlas generated with the built-in Image Generation tool. The renderer samples each quadrant directly; the atlas was copied into the game unchanged.

Species: Thorn Viper, Cindermaw, Storm Eel and Void Cobra. The body colors and animated fins match each head.

Exact prompt:

> Use case: stylized-concept. Asset type: transparent 2D game sprite atlas for Slop Survivor. Create a single square sprite sheet with exactly four equally sized cartoon serpent HEADS ONLY, one centered in each quadrant of a 2 by 2 grid, ample transparent margins, no grid lines, no text. Each head faces RIGHT in a slightly top-down view so it can rotate along a curving snake body. Top left: acid-green thorn viper with leaf-like horns, luminous lime eyes, fangs. Top right: molten orange volcanic serpent with black basalt plates and glowing lava cracks. Bottom left: electric cyan deep-sea serpent with translucent fin crests, bioluminescent cheek spots. Bottom right: purple void cobra with broad hood, magenta eyes and constellation freckles. Hand painted polished arcade illustration, bold dark contours, bright readable silhouettes, playful menacing expressions, detailed scales, highlights, no weapons, no bodies, no scenery, no shadows on background. Actual transparent alpha background. Heads centered exactly at 25%/25%,75%/25%,25%/75%,75%/75%; same scale, no elements crossing quadrant boundaries.
