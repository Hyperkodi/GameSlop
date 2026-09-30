# BitDog: eight increasingly impossible fetches

The eight-level campaign is playable. The owner keeps throwing farther than any sensible person would; BitDog's imagination turns each fetch into a bigger adventure. His black collar and gold BIT tag remain the visual anchor. All eight levels have distinct scenery, music and movement routes.

## Progression and challenge

- Five hearts across the eight-level run per attempt. Explore outward without a countdown; picking up the large Bitcoin starts the return timer.
- Introduce one signature movement mechanic per level. Later levels ask for more timing and route decisions while the ordinary path stays close to level 1's difficulty.
- Optional high routes reward skill with coins or saved time. Missing a jump normally drops BitDog onto a slower safe route. Avoid blind drops, instant death and compulsory precision jumps.
- Teach through visible examples, coin arcs and geometry, with few signs. Keep Jump, Roll, Sprint and the existing joystick; environmental powers activate through contact. Sprint builds speed; Roll ignores directional input and boost pads, coasts to a stop on flat ground, gains speed downhill and slows faster uphill.
- Outbound exploration teaches the fast way home. Measure each countdown from return playtests with recovery room, not level number.
- Score stays coins x 100 + whole seconds remaining x 50 + 1,000 for delivery. Best scores are per level. Balance optional-route rewards against climbing time.
- All eight levels are selectable. Delivery offers a Next Fetch button through level seven; the backyard ends with a homecoming message. Best scores are separate. The selector scrolls on narrow screens and stays clear of the mobile joystick.

| Level | Signature mechanic | Optional route and payoff | Unique music direction |
| --- | --- | --- | --- |
| 1. Satoshi Park | Familiar ponds and garden obstacles | Clear ponds for speed; log/boardwalk branch | Existing playful adventure funk: Funky Chunk |
| 2. Harvest Hustle | An orchard harvest route built from real farm equipment | Lidded apple bins, picking wagons, a loading ramp and braced packing deck lead to extra coins and a hay-bale landing. Roll through ground-level leaves to clear the return path. | Acoustic funk: Fretless |
| 3. Electric Avenue | Crate to pitched workshop roof to powered cables | Animated paw arcs and a fading spark trail show a 1.35x speed boost, lasting 0.8 seconds after dismount. Ceramic junctions spark visibly and require jumps. Three optional cable sections work in both directions above a continuous street with roadwork barriers and delivery crates. | Electro Cabello: bouncy disco, brass, ukulele and synths |
| 4. Mushroom Moonwood | Giant rooted mushrooms squash and spring | Land on a cap for an automatic bounce; holding Jump takes the higher route. Misses cost time in shallow mud. Hollow woodland arches mark the lower trail. | Flutey Funk: flute, bass and woody rhythm |
| 5. Snowball Summit | Rolling gathers a temporary fluffy snowball shell | Bank slope momentum, burst through soft snow barricades, jump to shed the shell. Connected snowbanks lead to coins; shell size and speed are capped. | Cold Funk: electric piano and warm bass |
| 6. Cloudburst Carnival | Air currents carry an umbrella-gliding BitDog | Jump into an umbrella to open it automatically; steer through visible gust ribbons and tap Jump to fold. Supported raised decks offer coins above a continuous lower boardwalk. Gusts work on both legs. | Acid Trumpet: playful trumpet groove |
| 7. Moon Cheese Chase | Low-gravity crater hops | Long jumps reach broad crater shelves and coin trails; rolling follows the faster low route. Ring-marked gravity pockets briefly restore ordinary weight. | Space Jazz: relaxed synth jazz |
| 8. The Impossible Backyard | Home becomes a lantern-lit remix of the adventure | Three sections reuse harvest equipment, an electric garden cable and mushroom bounces. Each keeps a ground route. No new ability; owner waits at the recognizable home landmark. | Funkorama: celebratory full-band funk |

## Standing rule: obstacles belong in their setting

The user explicitly requires believable environmental construction for this and every future level. Plan the purpose and support of each object before generating its art. Fantasy can change what an object does, but it still needs to look as if it belongs there.

- Use plausible scale, materials and load-bearing connections. Wheels, feet, roots and foundations meet the ground. Ramps connect to actual decks; cables attach to visible supports. Preserve asset proportions instead of stretching objects to fit old collision boxes.
- Walkable collision surfaces follow the painted surface. Never draw a straight guide line across organic artwork to manufacture a platform. Keep trees as scenery in Harvest Hustle; the rejected giant boughs, propped logs and rooftop chain are retired.
- Keep the ordinary route readable beside the equipment, with optional jumps offering coins and shortcuts. Use purposeful clusters such as a picking row or packing yard, rather than arbitrary towers of props.
- Electric Avenue: sensible sheds, supported roofs, utility poles, insulators and attached cables. Mushroom Moonwood: rooted clusters with coherent stalks and caps. Snowball Summit: connected snowbanks, ice shelves and believable slope transitions.
- Cloudburst Carnival: posts, rigging and a supported lower boardwalk; fabric responds to visible wind. Moon Cheese Chase: coherent crater rims and rock shelves; floating objects need an explicit gravity effect. The final backyard reuses the same construction rules.
- Review grounding, silhouettes and paw contact at desktop and real phone sizes before calling a theme complete.
- Foreground roots must be buried below the deepest terrain across their footprint, including transparent atlas padding. Draw their bases before the soil and use the same world-camera transform as the path. Never leave a strip of parallax background visible under a foreground trunk.

A framed canvas apple-catching sheet remains an optional future orchard addition. If added, its supports, visible fabric flex and matching Foley must explain the bounce. Solid wooden bins and wagons do not bounce.

## Electric Avenue: implemented mechanic

1. A broad crate and shed roof make the ascent obvious. Coins lead over the cable attachment. Give mobile players enough view ahead at boosted speed.
2. Use chunky insulated supports, a bright-edged cable and a quiet skyline behind it. Show the exact running surface and its ends.
3. Friendly wire grants energy rather than hurting BitDog. Animated arcs around his paws and a fading spark trail show the charge. A dedicated lifted-fur pose remains a possible later polish pass. Keep his face and BIT tag clear; no full-screen flashes.
4. Rail attachment works in both directions. Jump exits cleanly; a short reattachment cooldown prevents sticking. Passing over a wire without landing does not activate it.
5. Dangerous junctions have large ceramic blocks and localized moving arcs, distinct by shape and motion as well as color. They use the usual one-heart and invulnerability rules.
6. Ground remains underneath. Test the high route outward and while carrying the Bitcoin home. Climbing should earn enough coins or save enough return time to be worthwhile.

## Opening animation and audio

Keep the three-shot story: owner notices coin/dog and throws; level-specific POV follows coin to star; BitDog accelerates into the adventure. Never show the owner's face.

The opening now uses continuous Kling V3 Pro video for the owner throw and the dog's run, based on the approved Image Gen characters composited in the actual park. The former sprite swaps and face crossfades are retired from these shots. Static approved frames cover loading failures and reduced-motion mode. Natural ElevenLabs launch Foley, the descending throw whistle and existing star cue stay separate. On narrow screens, contain the full shot so neither the muzzle nor the throwing hand gets cropped.

Generate each future throw POV using that level's actual scenery as reference. Match its sprint surface and background too. Preserve reduced-motion support, pause and skip.

## Art visibility contract

- Image Gen supplies raster assets and scenery. Build continuous panoramas with exact shared tile overlaps and verify every join at runtime scale. Independently generated edges are not assumed seamless.
- Every obstacle needs a clean silhouette, deliberate light/dark edge and contact shadow. Do not rely on glow alone. Leave quieter scenery behind the playable path and high routes while retaining detail elsewhere.
- Separate interactive props from decorative duplicates by shape, size and placement. Background rocks must not resemble collision rocks at the same depth.
- Platforms show their top surface and ends in consistent three-quarter perspective. Moving/opening obstacles need matching state poses.
- Review each theme at real mobile size and in grayscale. Golden fur needs dark separation in sunny scenes; dark crates need light edges at night. One filter will not suit all themes.
- Keep foreground foliage and particles away from approaching obstacles. Power animation stays outside or behind the dog. UI text needs strong contrast on a stable backing.

## Music and sound production contract

Eight levels use eight DIFFERENT songs under verified licenses: Funky Chunk, Fretless, Electro Cabello, Flutey Funk, Cold Funk, Acid Trumpet, Space Jazz and Funkorama, all by Kevin MacLeod under CC BY 4.0. Source, attribution and processing records are in `audio/`; the selected level's credit is visible below the game.

Save title, artist, original source/download page, license version/link, retrieval date, attribution and edits for each track. Prefer CC0 or attribution-permitted music with clear game/commercial reuse terms; a royalty-free label alone is insufficient. Keep visible credits current. Normalize loudness, review loop seams and audition the return-run mix. Avoid vocals competing with gameplay cues.

Use ElevenLabs for premium location-specific Foley and mechanics: springy wood, electrical fizz, soft mushroom boings, snow crunch, umbrella fabric and gentle space chimes. Keep powers below important pickups and countdown cues.

## Build order

Harvest Hustle is the first campaign addition: three optional equipment routes, leaf piles cleared by rolling, apple crates, an 80-second return, separate best score and its own music. Its panorama, throw POV and continuous Kling throw/sprint clips share the same orchard setting. The ground route stays continuous. Image Gen source art and exact prompts are in `art/orchard/`; overlapping tile checks are in `seam-verification.json`.

Electric Avenue now has three supported cable routes, 1.35x electric speed, jumpable junctions, a continuous lower street and an 80-second return. ImageGen supplies its panorama, poles, pitched workshops, roadwork barriers, paving and matching opening references. Owner and sprint shots use continuous Kling V3 Pro clips. New ElevenLabs effects cover charge, cable hum, junction zap, padded paving contacts and a continuous opening gallop.

Levels 4–8 add mushroom springs, rolling snow shells, optional umbrella glides, low-gravity crater routes and the backyard remix. Each keeps the continuous lower route. The new return limits are 90, 85, 90, 90 and 90 seconds respectively. Automated round trips cover all five; optional routes are checked in both directions. Terrain and sprite contact profiles share the same world coordinates.

New theme folders: `art/moonwood/`, `art/snow/`, `art/carnival/`, `art/moon/` and `art/backyard/`. Each includes Image Gen art and production records, a finite panorama with exact shared tile overlaps, and matching three-shot intro assets. The game uses local pre-generated files; no vendor API keys or generation calls are shipped in the runtime.

Review entry points: `art/campaign-review.html`, `audio/review.html`, `node --test games/bitdog/tests/*.test.js`, and `node artifacts/bitdog/verify-eight-levels.mjs`. Desktop, portrait and landscape captures are stored in `artifacts/bitdog/campaign-review/`.
