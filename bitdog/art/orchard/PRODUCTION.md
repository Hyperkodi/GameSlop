# Harvest Hustle assets

Built-in ImageGen produced the continuous panorama, forward POV, prop atlas and two character-preserving movie references. Exact prompts are in `prompts.json`. Source images are preserved beside their runtime derivatives.

`master-v1.png` is 2,172 × 724. The three PNG tiles use 96-pixel overlaps at x = 804 and 1,608. `seam-verification.json` records exact overlap equality and complete pixel-identical reconstruction. `artifacts/bitdog/pack-orchard.cjs` reproduces the slicing and checks. The final tile does not wrap to the first.

The PNGs contain real alpha transparency; their dark matte in some previews is not an opaque backdrop. Runtime drawing preserves that alpha directly. The old hand-cut silhouette masks, separate log/trunk construction and straight platform highlight lines are retired.

## Current route: harvest equipment

Built-in ImageGen produced three new transparent assets: `harvest-bins-v1.png`, `harvest-wagon-v1.png` and `harvest-loading-v1.png`. Exact prompts and the style reference are recorded in `harvest-prompts.json`. Generated alpha is preserved directly; the original canvases remain intact.

Three loading yards use lidded apple bins, picking wagons, an integrated loading ramp and cross-braced packing platform, then a hay-bale landing from the original prop sheet. All equipment is scaled uniformly. Source-pixel contact profiles in `js/levels.js` place paws and coins on the painted lid, deck and ramp. The loading ramp can be entered on foot at its low end. Nothing in this route automatically bounces.

The terrain is locally graded with smooth transitions around each yard. Wheels and feet meet this shared ground plane; terrain covers only the lowest two pixels of the props. The ground path remains traversable in front of the equipment. No invisible platform guide strokes are drawn. Orchard trees stay in the scenery.

Current desktop, portrait and landscape review captures are in `artifacts/bitdog/harvest-review/`. Engine tests cover supported landings without bounce, adjacent jumps in both directions, all three upper routes, walking up/down the loading ramp and the full fetch-and-return journey.

## Retired platform experiment, revision 2

`tree-platform-v2.png` and `shed-pitched-v2.png` are archived experiments, no longer loaded or drawn by the game. The user rejected the giant tree formation. Both were generated with built-in ImageGen; historical prompts are in `platform-v2-prompts.json`.

That retired version traced branch and roof contours and buried roots/foundations into uneven terrain. Harvest Hustle replaces both the artwork and those collision profiles with practical orchard equipment.

Historical captures remain in `artifacts/bitdog/orchard-graphics-v2/` for reference only.

## Opening movies (preserved orchard setting)

Kling V3 Pro, accessed through the authorized Replicate account, animated both approved character references. Sanitized requests are in `throw-animation.json` and `sprint-animation.json`; source movies and request status are in `artifacts/bitdog/orchard-intro/`. Runtime movies are silent 1,280-pixel H.264 with fast-start metadata. The owner remains cropped above the shoulders; the dog's muzzle stays intact. Contact sheets sample both clips at four frames per second for visual review.

The opening uses four seconds of owner action, 3.5 seconds of level-specific coin flight and 3.3 seconds of galloping. Continuous playback adjusts speed gently and never repeatedly seeks during a shot. Orchard's throw cue starts at 3.15 seconds; the star cue stays at 6.35. The gallop is the existing continuous ElevenLabs grass Foley, without repeated paw clicks. Reduced-motion and failed-video fallbacks use matching approved posters.

Browser reports and desktop/portrait/landscape captures are in `artifacts/bitdog/orchard-intro/`. Validation covers full route completion, high-route traversal outward and carrying the Bitcoin home, separate records, music/effects loading, joystick multitouch/release, video pause/skip/replay, reduced motion, failed-video fallback and scenery joins.
