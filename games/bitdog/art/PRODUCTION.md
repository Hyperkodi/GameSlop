# BitDog opening — production package v1

## Character reference

Source: https://bit-dog-coin.netlify.app/ — the retriever in the site's embedded hero/rewards graphic, saved unchanged as `reference/website-image-1.png`. Only the character was used as the art reference; financial tables and promotional claims are not part of the game.

Final model sheets:

- `characters/bitdog-model-v3.png`: front, three-quarter, side, back; attentive, happy and fetching expressions; gallop and roll studies. Golden retriever with honey-gold feathered fur, darker floppy ears, cream muzzle/chest, brown eyes, black nose and pink tongue. Black leather collar with brass fittings and a round gold tag reading BIT.
- `characters/owner-model-v2.png`: neck-down front, back and rear three-quarter costume views; hands holding/releasing the coin; glance, windup and follow-through poses. Muted sage overshirt, oatmeal T-shirt, slate trousers, cream sneakers. Never show eyes, nose, mouth or facial profile. His head can be shown only from behind. This keeps BitDog the emotional focus.

Use v3 for future work. It replaces the earlier orange bandana with the black collar and gold BIT tag from the user's reference. Earlier sheets remain as historical drafts; the mouth-held fetch coin retains its Bitcoin symbol.

## Edit and timing

| Shot | Time | Camera and action |
| --- | --- | --- |
| 1: invitation | 0–4.0 s | BitDog is near the center, seated and watching. Owner is a muted supporting figure on the left, viewed from behind. He holds the coin near chest height, bows toward it, inclines his head toward BitDog, winds up, then throws. Coin release at 2.94 s. |
| 2: flight | 4.0–7.5 s | Owner's forward POV. His throwing forearm briefly leaves the foreground. A spinning coin arcs toward the horizon and shrinks to a point. At 6.35 s it becomes a four-point star with two gentle pulses, then disappears. |
| 3: zoomies | 7.5–10.8 s | Side tracking shot of BitDog galloping. Ears and collar tag, four gait poses, bright streaks and translucent trailing poses carry the action. BitDog runs off the right edge into the level transition. |

Shot 2 uses `environment/satoshi-park-pov-v1.png`, generated with the gameplay panorama as its location reference. It preserves the cottages, white fences, trees, warm sunlight, distant hills and lake. This is an illustrated forward view of the same park, rather than an exact geometric reconstruction of each gameplay obstacle. Future level openings must use that level's approved environment as their reference.

## Current implementation

This is a playable 2D animatic. The owner and dog use generated transparent pose atlases, with rear-view owner poses for the glance, windup, release and follow-through. It establishes timing, framing and the gameplay handoff using held poses and animated transforms. It is not a finished hand-drawn film or an AI-generated video.

`js/cinematic.js` owns the deterministic shot timeline. `js/renderer.js` draws the opening using shared level scenery. `js/game.js` pauses gameplay, gates inputs, handles audio and skip/replay, and starts the engine only after the opening. Blur and hidden tabs pause the opening. Reduced-motion mode disables speed-line movement, trailing poses and pulsing effects. No fullscreen flashing.

The silent `opening-preview.webm` is a 30 fps recording of the actual canvas. The game itself includes a licensed funk recording and custom ElevenLabs Foley, throw, coin and star effects. See `../audio/CREDITS.md`.

## Asset generation and reuse

All model sheets and sprite art used built-in `image_gen`, with the website mascot and the resulting model sheets supplied as image references. Final prompts are in `prompts.json`; the left-facing seated cutout's prompt is in `sitting-left-prompt.txt`.

`sprites/bitdog-poses-v2.png` preserves the generated alpha and original pixels. Runtime source rectangles select the eight poses; no image editor or background-removal script was used. `sprites/bitdog-sitting-left-v2.png` supplies a native left-facing pose with a normally readable BIT tag. `sprites/owner-poses-v1.png` derives eight action/hand poses from the owner model sheet.

## Environment art and seamless assembly

Use Image Gen for BitDog raster assets, including backgrounds. Keep the established golden retriever and faceless owner consistent through reference images. Gameplay code handles placement, animation, effects and loading/error fallbacks.

`environment/satoshi-park-master-v1.png` is the continuous 2,172 × 724 park painting. Following Slop Commando, `artifacts/bitdog/pack-environment.cjs` copies lossless strips from that single source, without resizing, repainting or feathering:

| Tile | Source x | Width | Shared overlap |
| --- | --- | --- | --- |
| 0 | 0 | 900 | 96 px with tile 1 |
| 1 | 804 | 900 | 96 px with tile 2 |
| 2 | 1608 | 564 | End of finite panorama |

Place tiles at their authored coordinates using one common scale and camera offset. Do not concatenate the overlap twice. `environment/manifest.json` records dimensions and SHA-256 hashes; `environment/seam-verification.json` records identical overlap pixels and an exact reconstruction of the entire master. The final tile is not intended to repeat into tile 0. Use `environment-review.html` to scroll the original and assembled tiles side by side, with optional join markers.

`environment/park-props-v1.png` supplies transparent trees, a doghouse, crates, fences, coins and signs. `environment/park-ground-v1.png` supplies the grassy soil cross-section. Terrain follows the actual collision hills using narrow texture columns; alternate horizontal repeats reflect the texture so adjacent end samples match. Original generated assets remain unchanged.

Environment and owner-atlas prompts are in `environment/prompts.json`; terrain uses `environment/ground-prompt.txt`. All were generated with the built-in tool and copied into this project. Native Canvas packaging only extracts the background tiles. `js/environment.js` loads and draws the art; `js/renderer.js` composes it with gameplay and the opening.

## Validation

- Engine, timeline and workspace mobile-joystick tests.
- Desktop opening, freeze of gameplay during opening, pause/skip/replay, natural transition through all shots.
- Mobile portrait and landscape opening, blur pause and touch skip.
- Existing complete level playthrough and two-finger joystick/jump checks after skipping the opening.
- Review screenshots and verification logs in `artifacts/bitdog/opening/` at the workspace root.

## Collar revision

The user-supplied reference establishes a black leather collar, brass hardware and round gold tag engraved BIT. This supersedes the bandana instructions in historical prompts. Built-in Image Gen edited the model sheet, right-facing atlas and left-facing sitting cutout; a separate `sprites/bitdog-poses-left-v2.png` keeps BIT readable when returning home. The renderer selects native directional poses rather than mirroring lettering. Final prompts are in `collar-prompts.json`; `collar-owner-prompt.txt` records the matching dog correction on the owner sheet.

The second playable adds `environment/park-obstacles-v1.png`: shallow pond, cutaway hollow log, raised boardwalk and mossy rocks, generated with built-in Image Gen from the approved prop style. Its prompt is in `environment/obstacles-prompt.txt`. Signs use the original blank wooden art with larger live labels.

## Obstacle readability revision

`environment/fence-perspective-v2.png` supplies three-quarter upright, folding and lowered poses from built-in Image Gen, replacing the flat fence rotation. Prompt: `environment/fence-perspective-prompt.txt`. The renderer adds crisp silhouette edges and ground-contact shadows to solid obstacles; open fences use a softer treatment. Crates are slightly larger visually. Only the initial FETCH sign remains; coin trails and geometry guide the rest of the route.

## Opening animation revision 2

Built-in ImageGen created `sprites/owner-throw-v2.png` and `sprites/bitdog-gallop-v3.png`, twelve poses each. Exact prompts and references are recorded in `opening-v2-prompts.json`. Original atlases remain intact. Runtime uses source crops, fixed scale and body anchors; alpha is preserved. The owner's former six held poses are replaced with twelve timed poses, retaining release at 2.94 seconds. The sprint uses twelve gallop poses, camera acceleration and lighter rear speed streaks without stacked dog copies. Reduced-motion mode holds one gallop pose and suppresses scenery travel and streaks.

The sprint entry uses `audio/sprint-start-v2.mp3`, new ElevenLabs natural paw-push, collar and air Foley. Throw whistle and star timing remain unchanged. `artifacts/bitdog/verify-opening.mjs` checks shot order, locked gameplay, pause/skip, natural handoff and portrait/landscape layout, and refreshes the silent `opening-preview.webm`.

## Sprint stabilization revision

The third shot now selects eight poses from the existing twelve-pose atlas in foot-contact order. Each pose is registered in X and Y using its eye position and normalized by eye-to-nose distance, replacing the previous horizontal-only shoulder registration. Runtime compositing blends adjacent aligned poses in a premultiplied-alpha layer. The dog stays at a fixed screen position until the exit, with a controlled 1.5-pixel vertical bob rather than atlas-driven jumps. Cadence ramps smoothly to 1.65 strides per second; scenery acceleration is eased too. Reduced-motion mode stays fixed, including the exit. Other shots, sound, gameplay sprites and controls are unchanged.

Verification: full opening playback, locked gameplay, pause/skip and handoff passed without browser errors. Portrait and landscape opening checks passed; a dedicated portrait sprint capture and six-frame review are in `artifacts/bitdog/`. The silent opening preview was refreshed.

## Continuous intro animation (current)

The owner throw and sprint now use local Kling V3 Pro movies, generated through Replicate using the user-authorized StickerBot credential. `cinematics/generation.json` contains the approved prompts and asset provenance; secrets stay outside the game. The approved throw starting image was reframed with built-in ImageGen (`cinematics/throw-reference-v3.png`, prompt alongside it). Two earlier throw takes were rejected because they revealed the owner's face. The approved closer composition keeps the owner's entire head above the picture and BitDog as the focus.

The dog run was inspected across all 97 source frames for nose/muzzle continuity; the owner framing across all 121 source frames. Original movies and frame-review sheets live in `artifacts/bitdog/kling/`. Web copies are 1280-pixel-wide H.264 with fast-start metadata. The 5-second throw plays within the 4-second first shot; the 4-second run fits the 3.3-second third shot. The throw cue now starts at 2.7 seconds to match the new release; star timing remains 6.35 seconds.

`js/intro-video.js` uses normal media playback with gentle rate correction, never repeated in-play seeking. Pause, replay and skip control the media as well as the timeline. The Start button waits for playable clips or a known load failure. Static approved posters are used for reduced motion and load failures. Narrow screens contain the full landscape shot with cinematic letterboxing, preserving every nose, paw and throwing hand. The former owner atlas swaps and blended sprint atlas are retired from the intro.

The third shot now plays one continuous ElevenLabs `intro-gallop-v3.mp3`: padded four-paw impacts, grass scuffs and subtle breath/fur texture. Repeated gameplay paw taps and the earlier launch cue are disabled for the intro. Skip/replay stops one-shot effects. Existing in-level footsteps remain unchanged.

Verification includes complete movie playback with monotonic playback time, decoder frame counts, pause/seek/skip, portrait/landscape/reduced-motion and unavailable-video fallback, plus an audio-event check for exactly one continuous gallop and no repeated paw taps. See `artifacts/bitdog/kling/browser-verification.json`. The actual game-canvas preview is refreshed in `opening-preview.webm`.
