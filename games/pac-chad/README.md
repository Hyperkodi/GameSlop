# Pac-Chad

Gameslop maze chase. Gigachad's grayscale head, four distinct fictional ghost rivals, three maze themes, five-minute score attack, three lives, combos, opening shortcuts, dash/decoy, 20 original sound effects, touch and gamepad controls, browser fullscreen, and a personal best board.

## Play locally

From the workspace root:

```powershell
npm.cmd --prefix games/pac-chad start
```

Open <http://127.0.0.1:8782/games/pac-chad/>. Stop with Ctrl+C. The local preview binds only to this computer and serves only Pac-Chad files. No runtime packages are needed. The static `games/pac-chad` directory also works under a normal HTTP server.

Arrow keys/WASD or left gamepad stick/D-pad steer. Space/gamepad A activates the chosen ability. P pauses. On a phone, use the direction pad or swipe on the maze and tap the ability button. Movement continues in the selected direction until a wall; the next turn can be buffered. Fullscreen uses the browser API, with a full-window fallback where unsupported. Landscape orientation locking is optional.

## Current build

- 23 by 19 original generated layouts. Three visual themes cycle through increasingly difficult stages; every stage has a different deterministic layout. Every pellet is reachable, loops prevent trapping the player in dead ends, and a safe bottom lane anchors spawns.
- Rook follows the player, Hex targets the route ahead, Ivy guards remaining power pellets, and Riot warns before charging a lane. Periodic retreat behavior gives breathing room. Returning ghosts are harmless.
- The revised cast keeps fuller-built blue Rook and feminine rainbow-haired Riot. Purple Hex is a slightly heavyset feminine-presenting adult man with fuller cheeks with light stubble, a soft natural jawline, round black glasses and blue-and-pink drag makeup. Green Ivy is a feminine-presenting adult man with a soft clean-shaven face, subtle makeup and light cheek acne. Both have natural human chin proportions. See [the updated cast preview](art/cast-preview.png), [original cast prompts](art/CAST-REVISION-PROMPTS.md) and [latest Hex prompts](art/HEX-STUBBLE.md) and [latest Ivy prompts](art/IVY-SOFT-FACE.md).
- Every 20 consecutive pellets raises the multiplier, capped at 5. After 2.5 seconds without a pellet, or after damage, it resets. Pellets award 10 points and power pellets 50, multiplied by the current combo.
- Seven-second power pellets allow ghost capture chains worth 200, 400, 800, then 1,600. Stage clears award 1,000 times the completed stage number.
- Dash grants 0.8 seconds of faster, protected movement; decoy attracts ghosts for four seconds. Both recharge in ten seconds. Abilities are selected before a run.
- Three shortcuts per maze, where available, open at 15-second intervals with three-second warnings. They only open and never close around an actor.
- Original transparent generated character PNGs. Hair silhouettes, large jewelry and glasses remain visible during frightened mode. Faces stay upright when moving vertically. The closer follow camera uses 48?56-pixel tiles in taller views and at least 44 pixels in short landscape views, with a full-maze minimap. The cast guide supplies larger portraits.
- Pac-Chad now uses a registered four-pose mouth atlas: closed, opening, wide chomp, then closing. The largest open mouth is exaggerated and held longer. One cycle follows each corridor tile, accelerates with dash, freezes when paused, and closes against a wall. His eyes and hair remain aligned while the bearded jaw moves. The decoy shares this animation. The original portrait remains on the title page.
- Local personal scores and downloadable input evidence. No fabricated global scores or local X identities.

The larger proposal also included bonus rooms, bosses, equipped phase abilities and personal-best ghost races. Those are subsequent features, not present in this first build.

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
