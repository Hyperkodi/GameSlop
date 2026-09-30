# BitDog: Zoomies

A Sonic-inspired fetch-and-return game starring the approved golden retriever, black leather collar and gold BIT tag. Eight levels are selectable, with a different setting, movement feature and song for each fetch. See [LEVEL-PLAN.md](LEVEL-PLAN.md) for the campaign and standing art direction.

Serve `games/` and visit `/bitdog/`. `/bitdog/?level=2` opens Harvest Hustle directly. No build or runtime package dependencies; include the shared `../_kit/joystick.js` and CSS when copying the game. Audio fetching requires HTTP. Nothing is deployed by this folder.

## Playable levels

- **Satoshi Park:** 22,000 world units, 14 fences/crates/rocks, two ponds and a hollow-log/boardwalk route. Fetching opens the fences. Return countdown: 75 seconds.
- **Harvest Hustle:** the same length, three optional routes across lidded apple bins, picking wagons, loading ramps and supported packing decks, ending in hay bales. Ramps can be walked onto; wooden equipment supports ordinary jumps without bouncing. Smashable apple crates and leaf piles remain on the ground route. Rolling clears leaves for a faster return. Return countdown: 80 seconds.

- **Electric Avenue:** three optional crate/workshop/cable routes, grounded utility poles, a 1.35x electric speed boost, jumpable sparking junctions, roadwork barriers and delivery crates. The street stays continuous beneath every cable. Return countdown: 80 seconds.

- **Mushroom Moonwood:** rooted mushroom springs, shallow mud and hollow woodland arches. Land on a cap to bounce automatically; hold Jump for more height. Return countdown: 90 seconds.
- **Snowball Summit:** broad snowbanks and soft snow barricades. Rolling gathers a capped snowball shell; jumping sheds it. Return countdown: 85 seconds.
- **Cloudburst Carnival:** supported carnival decks, visible gust ribbons and umbrella pickups. Jump into an umbrella to glide, steer with the existing stick, and tap Jump to fold it. A continuous lower boardwalk catches missed jumps. Return countdown: 90 seconds.
- **Moon Cheese Chase:** low gravity, broad crater shelves and visible gravity pockets that restore normal weight. Return countdown: 90 seconds.
- **The Impossible Backyard:** a lantern-lit finale combining the harvest route, a supported electric cable and rooted mushroom springs. Return countdown: 90 seconds.

All eight are available without unlocking. Delivery offers Next Fetch through level seven; the final delivery has its own homecoming message. Best scores are saved per level; Park reads the previous v2 record when no newer per-level record exists.

Player guide: [How to Play](how-to-play.html), linked from the title and pause screens.

## Controls and scoring

Open **Controls Setup** on the title or pause screen to remap every keyboard action, including alternate keys. Assignments save on this device; occupied keys swap assignments. Restore defaults is available in the same menu.

- A/D or left/right arrows: run. Mobile: horizontal thumb joystick.
- Space, W or up arrow: jump; release early for a shorter jump.
- Hold Shift while moving: sprint.
- Hold S or Down: roll and coast. Rolling ignores directional input and boost pads. It coasts to a stop on flat ground, gains speed downhill and slows faster uphill. Release Roll to run again.
- Separate mobile Sprint, Jump and Roll buttons support simultaneous fingers. Roll overrides Sprint while both are held.
- Escape/P: pause/resume. Enter: start/retry and skip intro. Levels play in order from 1 to 8; the level strip shows progress.

Five hearts shared across all eight levels; collisions grant 1.6 seconds of protection. Outbound exploration is untimed. The return countdown starts only when BitDog grabs the large Bitcoin. Score = coins × 100 + whole seconds remaining × 50 + 1,000 delivery points + 1,000 per broken obstacle. A level completed without losing a heart earns Perfect Fetch. Hearts and points carry forward; failure or completion offers a fresh run from level 1. Reloading starts a fresh run. Coins are game points; there is no on-chain integration.

## Artwork, animation and audio

Each level has a continuous Image Gen panorama, losslessly sliced into three tiles with 96 identical overlapping pixels. These sequential tiles cover a finite landscape; the last does not wrap to the first. `art/environment/` and `art/orchard/` contain originals, manifests, prompts and pixel verification. Orchard props preserve their generated PNG alpha. Harvest equipment uses uniform scaling and collision profiles traced from the artwork. Small graded yards ground the wheels and supports. The former tree and shed platform route is retired. Foreground roots account for transparent sprite padding and extend beneath the terrain. Electric Avenue adds grounded poles and complete workshop foundations; cable drawing and collision use the same sag profile.

Standing art direction: obstacles must have a believable purpose, scale, construction and ground contact in their setting. Apply the environmental rules in [LEVEL-PLAN.md](LEVEL-PLAN.md) to every future theme before generating assets.

Each opening has three shots over 10.8 seconds: owner throw, level-specific coin-flight POV and dog sprint. Throw and sprint are continuous local Kling V3 Pro videos based on approved Image Gen characters. The owner's head stays outside the frame. The player supports pause, skip, replay, reduced-motion stills and uncropped portrait framing. The old pose swaps and muzzle crossfades are retired. There are no API keys or generation calls in the runtime game.

During player-controlled running, the four illustrated gallop poses are registered by eye position and head scale in both directions. This keeps BitDog's body steady while his legs cycle; the carried coin follows the aligned muzzle. Review sheets are in `artifacts/bitdog/gameplay-run-review/`.

The rolling pose is 20% larger than its original gameplay size. Its rotation center and turn rate scale with it so the ball stays on the ground as it spins.

The original park, orchard and street ground textures are cached in small world sections after their first paint. Obstacles use a single native silhouette shadow instead of a multi-filter chain, and high-density canvases stop at 1.5x backing scale. These keep the painted scenery and obstacle contrast while preserving smooth scrolling.

The eight songs are **Funky Chunk**, **Fretless**, **Electro Cabello**, **Flutey Funk**, **Cold Funk**, **Acid Trumpet**, **Space Jazz** and **Funkorama**, all by Kevin MacLeod under CC BY 4.0. Credits change with the selected level. The 41 effect buffers include ElevenLabs Foley, continuous cinematic gallops, mushroom springs, snow, umbrella fabric, gravity cues and the user-requested descending sine throw. Sources, prompts and processing are in `audio/`; audition assets in `audio/review.html`.

## Validation

From the workspace root:

```
node --test games/bitdog/tests/*.test.js
node --test tools/mobile-joystick-policy.test.mjs
node artifacts/bitdog/pack-environment.cjs
node artifacts/bitdog/pack-orchard.cjs
node artifacts/bitdog/verify-orchard-route.mjs
node artifacts/bitdog/verify-orchard-opening.mjs
node artifacts/bitdog/review-harvest.mjs
node artifacts/bitdog/verify-electric-route.mjs
node artifacts/bitdog/verify-electric-opening.mjs
node artifacts/bitdog/review-electric.mjs
node artifacts/bitdog/verify-eight-levels.mjs
node artifacts/bitdog/verify-campaign-controls.mjs
node artifacts/bitdog/verify-moonwood-mud.mjs
node artifacts/bitdog/verify-audio-review.mjs
node artifacts/bitdog/verify-gameplay-run.mjs
node artifacts/bitdog/verify-performance-visuals.mjs
node artifacts/bitdog/profile-frame-rate.mjs
```

Browser checks use the local server on port 8765 and the existing workspace Playwright installation. Gameplay/intro reports are under `artifacts/bitdog/orchard-intro/`; current equipment captures are under `artifacts/bitdog/harvest-review/`. Engine tests cover return timing, hearts, scoring, a complete round trip, all three equipment routes in both directions, ramp walking and leaf persistence/reset.

The eight-level browser report and desktop/phone captures are under `artifacts/bitdog/campaign-review/`. Real touch-input results are under `artifacts/bitdog/campaign-controls/`. The engine suite covers every new ground route as a full round trip and checks optional routes in both directions, movement powers, countdown timing, scoring, five-heart failure and reset behavior. The campaign scenery viewer is [art/campaign-review.html](art/campaign-review.html).

Electric Avenue production details, source assets and prompts: [art/electric/PRODUCTION.md](art/electric/PRODUCTION.md). New theme source art, manifests, exact-overlap checks and generation records are in `art/moonwood/`, `art/snow/`, `art/carnival/`, `art/moon/` and `art/backyard/`.


## Arcade embedding and fullscreen

Embed `https://hyperkodi.github.io/GameSlop/bitdog/?embed=1` using an iframe with `allow="fullscreen"` and `allowfullscreen`. Example:

```html
<iframe src="https://hyperkodi.github.io/GameSlop/bitdog/?embed=1"
  title="BitDog: Zoomies" width="100%" height="640"
  style="border:0" allow="fullscreen" allowfullscreen></iframe>
```

Embedded mode also activates automatically inside an iframe. It hides the surrounding website content and fits the available viewport. Tested at 640x480, 390x844, 844x390 and 320x568. The Full Screen button requests native fullscreen where available; otherwise it expands to the available browser/iframe viewport. Hosts must grant fullscreen permission for expansion beyond the iframe.

Mobile controls use a 100-112px horizontal joystick and separate action buttons on a shelf below the scene. The mobile camera raises the ground to two-thirds of the scene height. Horizontal camera velocity compensation holds the running dog near the rear third in either direction, except at map edges. No directional buttons are used.

Release packaging excludes raw generation source media and includes runtime media, source code, tests and credits. No environment files or API keys are needed at runtime.
