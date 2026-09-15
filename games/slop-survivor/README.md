# Slop Survivor — The Serpent Siege

A complete standalone mobile browser defense game: **Wojak shoots, Slippy is the snake.** Original implementation and new game artwork, inspired by Cell Survivor's segmented-boss and chest-choice mechanics.

See [PROGRESSION.md](PROGRESSION.md) for the current 15-chapter campaign, 14 weapons, weighted upgrade tiers and automatic saving and endless tournament behavior.

See [ILLUSTRATED-UPDATE.md](ILLUSTRATED-UPDATE.md) for the new art, boss cast and three additional chapters.

Wojak is the starting defender; v1.6.0 adds rear-facing weapon animations. See [PLAYTEST-NOTES.md](PLAYTEST-NOTES.md) for validation and limitations. Sloppy and Pepons progression unlocks are deferred; see [CHARACTER-BACKLOG.md](CHARACTER-BACKLOG.md).

## Play locally

From this folder, run `npm start`, then open **http://localhost:8193**. No npm dependencies or build step are required; Node.js serves the files. For a phone on the same Wi-Fi, open `http://YOUR-PC-LAN-IP:8193` while the server is running and the firewall allows it. HTTPS hosting enables installation and offline caching on mobile. Opening index.html directly with `file://` is not supported because the game uses JavaScript modules.

Run `npm test` for engine/economy tests. From the workspace root, run `node --test tools/mobile-joystick-policy.test.mjs`. The deterministic campaign audit is `node tests/balance.mjs` from this folder.

## Included

- Fifteen chapters, each with its own Normal → Hard → Hell unlock chain: 45 chapter/difficulty encounters.
- Three waves per early chapter, four from chapter five onward. Body sections span four pieces and share one health pool. Breaking a section slides the snake ahead backward along its route while the rear stays anchored. Shorter tail sections keep each wave's original body length.
- Fourteen unlocked weapons can enter the chest pool, with up to six collected per run. Six later unlocks add homing bots, percentage-health strikes, black holes, splitting shots, damage marks and dragons.
- Each weapon has a starting critical chance and multiplier. Critical hits bypass armor; chest cards state before/after statistics. Green/Blue/Red/Gold cards add 5/10/15/25 critical percentage points, capped at 85%.
- Battle chests freeze the visible battlefield and overlay three options. Green/Blue/Red/Gold rates are 60/28/10/2 per ordinary option; the opening chest offers Green weapon unlocks. Each new level resets battle weapons/upgrades; unlocks and workshop levels stay saved.
- One starting bonus on Normal, two on Hard, three on Hell; higher difficulty rewards more coins. Each difficulty has its own completion record and best score.
- Permanent weapon levels 1–10, earning +12% of the original base damage per level. Coins and weapon shards pay for upgrades.
- Idle chest accumulation every **10 minutes**, including while closed, capped at **32**. Open one or a full batch. Each awards coins and shards; four welcome chests are provided.
- Market Crash special attack, charged by damage. It hits visible segments and slows the snake.
- Original synthesized effects and a quiet looping musical sequence, independent volume controls and reduced visual effects.
- Portrait and landscape layouts, thumb joystick with pointer capture and multi-touch, keyboard and mouse support, basic physical-controller aiming.
- Automatic local and Telegram progress saving, separate campaign/tournament resume slots, pause on app switching, and an offline service worker.
- Endless tournament mode with progressively tougher waves, exactly three full-health revives per attempt, and saved personal bests.

## Controls

- Weapons fire automatically. Let go of the joystick for automatic target selection.
- Thumb joystick: choose an area to focus fire. The joystick owns only its own touch; another finger can activate the special.
- Desktop: point in the battlefield or use arrows/WASD to move the target. Space activates Market Crash. Esc pauses/resumes.
- Shield icons below Wojak are the vault's health. A breach consumes a shield and pushes Slippy back. Zero shields loses a campaign siege. In endless tournament mode it offers a revive, up to three per attempt.
- Destroy all sections in all waves to win. Any point along a section takes damage; a piercing projectile hits that health pool only once per pass. Chest choices freeze the retreat animation along with combat. Existing saved runs migrate automatically to larger sections.

## Hosting / installation

The production game is static. Host the contents of the release ZIP on an HTTPS static host (GitHub Pages works). All runtime paths are relative, including the service worker and manifest, so a subdirectory is supported. No wallet, login, paid API or database is needed. A Telegram Mini App launch loads the official Telegram SDK for automatic account sync; offline and ordinary browser play retain local saves.

On Android, use the browser's Install option. On iOS, use Safari → Share → Add to Home Screen. Desktop and ordinary browser tabs also work. Browser support determines fullscreen availability. Physical Galaxy S25 Ultra / iPhone performance has not yet been measured; mobile QA uses Chromium device emulation. This is a browser game, not a signed Android APK.

Progress saves automatically on this device. A supported Gameslop Telegram Mini App also restores and syncs account progress automatically, without save/load buttons. Both active run slots and revive counts persist. Offline timers and snapshot ordering rely on the device clock; the endless mode is **not** a server-authoritative tournament build. Online leaderboard submission and paid monetization are not included.

## Files

`data.mjs` owns weapon/chapter definitions, account progression and save validation. `engine.mjs` is the DOM-independent deterministic combat simulation. `art.mjs` draws animated gameplay and original weapon icons. `audio.mjs` synthesizes sound. `app.mjs` connects menus, controls, lifecycle, persistence and rendering. `style.css` includes both orientations. `sw.js` caches the standalone game.

See [RESEARCH-AND-DESIGN.md](RESEARCH-AND-DESIGN.md) for researched mechanics versus our own rules, and [ART-PROMPTS.md](ART-PROMPTS.md) for art provenance. QA screenshots and browser checks are in `artifacts/slop-survivor` at the workspace root.

This is fan-made mascot game artwork, not an official Cell Survivor product or a claim of affiliation with Robinhood. No Cell Survivor code, graphics or sounds are shipped.
