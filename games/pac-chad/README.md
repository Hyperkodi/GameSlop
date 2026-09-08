# Pac-Chad

Gameslop maze chase. Gigachad's grayscale head, four distinct fictional ghost rivals, ten maze themes, a ten-level campaign without a time limit, three lives, combos, opening shortcuts, dash/decoy, ten illustrated level-specific power-ups, 20 original sound effects, touch and gamepad controls, browser fullscreen, and a personal best board.

## Play locally

From the workspace root:

```powershell
npm.cmd --prefix games/pac-chad start
```

Open <http://127.0.0.1:8782/games/pac-chad/>. Stop with Ctrl+C. The local preview binds only to this computer and serves only Pac-Chad files. No runtime packages are needed. The static `games/pac-chad` directory also works under a normal HTTP server.

Arrow keys/WASD or left gamepad stick/D-pad steer. Space/gamepad A activates the chosen ability. P pauses. On a phone, use the direction pad or swipe on the maze and tap the ability button. Movement continues in the selected direction until a wall; the next turn can be buffered. Fullscreen uses the browser API, with a full-window fallback where unsupported. Landscape orientation locking is optional.

## Current build

- 23 by 19 original generated layouts. Ten distinct visual themes accompany ten increasingly difficult levels, each with its own deterministic layout. Clearing level 10 wins the campaign. The HUD counts elapsed time; there is no five-minute cutoff. Every pellet is reachable, loops prevent trapping the player in dead ends, and a safe bottom lane anchors spawns.
- Rook follows the player, Hex targets the route ahead, Ivy guards remaining power pellets, and Riot warns before charging a lane. Periodic retreat behavior gives breathing room. Returning ghosts are harmless.
- The revised cast keeps fuller-built blue Rook and feminine rainbow-haired Riot. Purple Hex is a slightly heavyset feminine-presenting adult man with fuller cheeks with light stubble, a soft natural jawline, round black glasses and blue-and-pink drag makeup. Green Ivy is a feminine-presenting adult man with a soft clean-shaven face, subtle makeup and light cheek acne. Both have natural human chin proportions. See [the updated cast preview](art/cast-preview.png), [original cast prompts](art/CAST-REVISION-PROMPTS.md) and [latest Hex prompts](art/HEX-STUBBLE.md) and [latest Ivy prompts](art/IVY-SOFT-FACE.md).
- Every 20 consecutive pellets raises the multiplier, capped at 5. After 2.5 seconds without a pellet, or after damage, it resets. Pellets award 10 points and power pellets 50, multiplied by the current combo.
- Seven-second power pellets allow ghost capture chains worth 200, 400, 800, then 1,600. Stage clears award 1,000 times the completed stage number.
- Dash grants 0.8 seconds of faster, protected movement; decoy attracts ghosts for four seconds. Both recharge in ten seconds. Abilities are selected before a run.
- Three shortcuts per maze, where available, open at 15-second intervals with three-second warnings. They only open and never close around an actor.
- Original transparent generated character PNGs. Hair silhouettes, large jewelry and glasses remain visible during frightened mode. Faces stay upright when moving vertically. The closer follow camera uses 48?56-pixel tiles in taller views and at least 44 pixels in short landscape views, with a full-maze minimap. The cast guide supplies larger portraits.
- Pac-Chad now uses a registered four-pose mouth atlas: closed, opening, wide chomp, then closing. The largest open mouth is exaggerated and held longer. One cycle follows each corridor tile, accelerates with dash, freezes when paused, and closes against a wall. His eyes and hair remain aligned while the bearded jaw moves. The decoy shares this animation. The original portrait remains on the title page.
- Campaign personal scores use a separate board from the old timed mode. Downloadable input evidence supports up to four hours of play; longer sessions remain playable but cannot export a replay. No fabricated global scores or local X identities.

The larger proposal also included bonus rooms, bosses, equipped phase abilities and personal-best ghost races. Those are subsequent features, not present in this first build.

## Level power-ups

One optional collectible appears off the spawn lane in every maze. It has a large original vector illustration and a gold minimap star; it does not count toward the remaining pellets. Contact activates it for five seconds. A persistent illustrated banner shows the full name, effect, countdown, and remaining shield charges. The title-page guide displays all ten objects and effects.

1. **Gym Pass** (gym card): edible ghosts, double capture points.
2. **Leg Day** (running shoe): ghosts flee at twice normal speed; this alone does not make them edible.
3. **Damn, that was a great steak** (grilled steak): double movement speed.
4. **Mirror Check** (hand mirror): two moving Chad lures.
5. **Cold Plunge** (ice bucket): freeze ghosts for two seconds, then half-speed movement for three seconds.
6. **Pre-Workout** (shaker): block and repel the next three ghost collisions, stunning each ghost. Ends after three blocks or five seconds.
7. **Cheat Day** (burger): gold regular pellets score triple, stacking with the combo multiplier.
8. **Ghosted** (headphones): ghosts search the pickup location instead of tracking the player.
9. **Absolute Aura** (deodorant): nearby ghosts choose routes away from Chad; the shield repels any ghost that touches him.
10. **Final Form** (gold dumbbell): 50% more speed, edible ghosts, double capture points.

Special effects expire on damage or the next level; used pickups never respawn after damage. Ordinary seven-second power pellets remain independent. Ghost capture takes priority over shield knockback when both are active. Speed boosts do not multiply with dash speed. Returning ghosts keep returning safely. No ability pushes a ghost through a wall. Pausing freezes effect timers.

Original illustrations: `assets/power-*.svg`, built by `node art/build-powerup-icons.mjs`. These are authored vector drawings, with no emoji, stock artwork or external image dependencies. Validation: `tests/powerups.test.mjs` and `node tests/powerups-browser.mjs`.

Campaign scoring and personal records now use `pac-chad-campaign-v3`, separate from previous builds. Ranked integration remains disabled.

## Sound effects

The complete pack contains 20 original locally synthesized WAV effects, including chomps, power pellets, ghost captures, dash, decoy, damage, warnings, shortcuts, combos, stage clear, countdown, menu selection, pause/resume, ability recharge, power expiry and run results. It needs no API or account. [Preview every sound](sound-lab.html). See [audio build and validation notes](audio/README.md). Playback uses preloaded samples, quiet repeated chomps, escalating capture pitch, limited overlapping voices and a compressor. Mute and backgrounding stop active sounds; manual pause adds a short confirmation cue.

## Leaderboard integration

The embedded game uses the SDK from Kobe's existing X branch. See [integration/HANDOFF.md](integration/HANDOFF.md). A standalone page remains a local practice game. This change does not alter or deploy `kobeyaki/game-slop`, configure credentials, register a public game or enable official rankings.

The pure simulation and compact input recorder have a working Node-compatible replay validator. This is a component for the platform integration, not a claim that client scores are already trusted or that replay validation prevents bots.

## Checks

```powershell
npm.cmd --prefix games/pac-chad test
node games/pac-chad/tests/browser.mjs
```

Unit tests need Node 22+ only. Browser QA uses `playwright-core` installed in the environment (the existing local Mario Kart test install is a fallback) and Google Chrome. Set `CHROME_PATH` to override its executable. All test servers and browsers close in `finally` blocks. Screenshots and the report go to ignored `art/qa-*` files.

Character prompts and provenance: [art/PROMPTS.md](art/PROMPTS.md). No game ROM or original Pac-Man map/art assets are used.

Mouth-animation preview: [art/chomp-preview.png](art/chomp-preview.png). Additional imagegen prompts: [art/CHOMP-PROMPTS.md](art/CHOMP-PROMPTS.md) and [latest bigger-chomp edit](art/BIGGER-CHOMP.md). Focused browser check: `node games/pac-chad/tests/chomp-browser.mjs`.
