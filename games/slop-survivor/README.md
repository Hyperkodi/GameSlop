# Wojak Survivor: The Serpent Siege

A mobile browser defense game. The v3 action update adds fast curved serpents, six encounter styles, four-snake sieges, manual aiming and heat management. The campaign has **100 levels, three difficulties and 24 weapons**. Each attempt starts with Mint Condition and builds a fresh arsenal from battle chests.

Version 3.2 names the game **Wojak Survivor**, keeps serpent heads upright with horizontal mirroring, and gives all 100 levels distinct routes built from ten movement patterns. Opening speed is 27% lower than v3.1; level-based speed growth is capped at 16%. Gold fullscreen buttons are visible on the home screen and battle HUD. Saved progress keeps its existing storage keys; ongoing waves retain their geometry until the next wave.

Rug Pull now slows only snakes whose living head or body touches the unrolled carpet. Each snake resumes normal speed when it leaves or the rug expires. Its base slow is 20%; overlapping rugs use the strongest slow, and Market Crash retains its stronger global slow. A SLOWED marker identifies affected snakes.

## Run and verify

From `games/slop-survivor`:

```sh
npm start                     # http://localhost:8193
npm test                      # deterministic unit and regression tests
node tests/action-harness.mjs --report # active aim versus idle/parked fire
node tests/economy-harness.mjs # detailed purchase and farming replay
```

No build step, framework or package dependencies. Use an HTTP server rather than opening `index.html` directly. All production files can be served statically from a subdirectory. HTTPS enables supported browsers' installation and offline features.

## Permanent progression

- Weapons reach level 50 through five ranks. Spend coins and that weapon's parts on levels, and cores on ranks.
- Foundry Ordnance, Precision, Overclock and Vault improve every future run.
- C/B weapons come from Easy clears, A weapons from Hard clears, and S weapons require discovery plus 22 shared blueprints each.
- Every unlocked weapon remains eligible in battle. Account investment increases its selection weight. There is no pre-equipped loadout.
- Six battle slots expand to seven after Easy level 30 and eight after level 65.
- The Refinery exchanges 3 spare parts for 1 part of any unlocked weapon.
- Four idle chest tiers share a 32-chest cap and a ten-minute timer. Better tiers appear with campaign progress. Every tenth Easy first clear grants a Vault chest.
- See [PROGRESSION.md](PROGRESSION.md) for exact formulas, rewards, all weapons and migration rules.

## Controls and saves

Hold the thumb joystick off center, hold the mouse button over the arena, or hold arrow keys / WASD to aim and fire. Hover does not fire. Release to cool the cannon; R or the Vent button cools faster but interrupts firing for 1.15 seconds. Overheating locks fire until you release or vent. Glowing sections take 65% extra damage. Lead moving targets and delayed airstrikes. E, Space or the star button activates your equipped special. F toggles 1x/2x speed; Escape pauses. Blur, app switching and rotation safely release inputs.

Explosive air support unlocks after Easy level 1; Napalm Strike after Easy level 3. The character keeps a single rotating cannon; airstrikes, summoned effects and drones have separate origins. Each snake has an independent route, speed variation, health and recoil.

Campaign and endless tournament have separate saved attempts. The tournament keeps its three revives, score, arsenal and personal best across reloads. Permanent account bonuses apply to new attempts. No online leaderboard or paid progression is included.

Local progress saves automatically. Telegram Mini App launches also synchronize account progress. Version 1 saves migrate automatically, including existing battle choices and both active runs. An existing v2 account rejects a newer-timestamp v1 cloud snapshot. A fresh device can recover and migrate its old cloud save.

## Art and offline play

All 24 weapons have original procedural icons and illustrated sprites. The ten expansion sprites were generated individually as transparent PNG masters and converted to WebP. [ART-PROMPTS.md](ART-PROMPTS.md) records the exact prompts and selected source files. The player uses an articulated cannon aimed at its actual muzzle direction. Four new serpent heads share a transparent atlas, with runtime body waves, breathing, fins and directional turns. [ACTION-UPDATE.md](ACTION-UPDATE.md) records the new art and exact generation prompt. The service worker caches every runtime module and sprite.

Mobile browser checks cover 320-pixel and 390-pixel portrait layouts, landscape, purchases, live combat rendering, saved progression and an offline reload. These checks use Chromium emulation, not physical iPhone or Galaxy hardware. Device-clock-based saves are not a server-authoritative competitive system.

## Verification and design decisions

[ACTION-UPDATE.md](ACTION-UPDATE.md) records v3 verification. [VERIFICATION.md](VERIFICATION.md) records the historical v2 baseline and pacing checks. [IMPLEMENTATION-NOTES.md](IMPLEMENTATION-NOTES.md) explains resolved brief contradictions and engine fixes. The older analytical feed-time model and `tests/balance.mjs` are historical v2 tools; their automatic-fire assumptions do not apply to v3. Use the action harness for current combat. Existing v2 combat regression suites explicitly use `tests/legacy-engine.mjs`, while action tests exercise the shipped rules.

Original fan-made game implementation and artwork. No Cell Survivor assets or affiliation claims. Character progression beyond Wojak remains the existing separate backlog in [CHARACTER-BACKLOG.md](CHARACTER-BACKLOG.md).

[REQUIREMENTS-AUDIT.md](REQUIREMENTS-AUDIT.md) preserves the older brief audit. Its long automatic-fire pacing targets are superseded by the v3 action update.
