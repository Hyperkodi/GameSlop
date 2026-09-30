# BitDog audio

## Completed campaign: levels 4–8

All five additional tracks are by Kevin MacLeod (incompetech.com), licensed under [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/). The official track pages explicitly provide this attribution license. Retrieved September 29, 2026. Each original is preserved unchanged under `source/`; runtime versions are normalized to -18 LUFS / -2 dBTP with a 50 ms fade-in, encoded at 44.1 kHz / 192 kbps and repeated during play. Full source/download URLs, hashes and editing records are in `campaign-music-sources.json`.

| Level | Music and official source | Runtime file |
| --- | --- | --- |
| Mushroom Moonwood | [Flutey Funk](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100519) — flute, bass and drums | `flutey-funk.mp3` |
| Snowball Summit | [Cold Funk](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100499) — warm bass, electric piano and light bells | `cold-funk.mp3` |
| Cloudburst Carnival | [Acid Trumpet](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100339) — muted trumpet and electric piano groove | `acid-trumpet.mp3` |
| Moon Cheese Chase | [Space Jazz](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN2100030) — bright, relaxed synth jazz | `space-jazz.mp3` |
| The Impossible Backyard | [Funkorama](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100474) — uplifting guitar, bass, organ and synth funk | `funkorama.mp3` |

Fourteen additional premium ElevenLabs Sound Effects v2 files cover mushroom compression and launch, snow gathering/shedding/breaking, umbrella opening and gusts, gravity changes, snow/dust paw contacts, continuous snow/boardwalk/moon intro gallops and quiet rolling-snow/fabric-wind loops. Exact prompts, requested durations, loop flags and original SHA-256 hashes are recorded in `campaign-generation.json`. Original generations remain in `source/`. Runtime effects use 65 Hz high-pass / 7 kHz low-pass filters and -22 LUFS / -3 dBTP normalization. One-shots have leading silence trimmed. No repeated single-step samples are used for the cinematic gallops. The shared loader now contains 41 effects.

Reproduction: `artifacts/bitdog/campaign-audio/produce.py music` and `produce.py effects`. The effects command reads the authorized workspace environment internally; neither generated assets nor manifests contain credentials.

## Harvest Hustle

"Fretless" Kevin MacLeod (incompetech.com), licensed under [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/). [Original track page](https://www.incompetech.com/music/royalty-free/index.html?isrc=USUAN1500074). Retrieved September 29, 2026. The unchanged original is preserved in `source/fretless.mp3`; the runtime version is loudness-normalized and has short end fades. See `orchard-music-source.json` for the download and processing details. Each level displays its own music credit.

`spring.mp3` and `leaves.mp3` are new ElevenLabs Sound Effects v2 Foley for the orchard branch release and leaf clearing. Original generations remain in `source/`; `orchard-generation.json` records both requests and hashes. Runtime effects have leading silence trimmed and are normalized to -22 LUFS / -3 dBTP. The loader retains 22 effect buffers, including the continuous intro gallop and descending throw whistle. Harvest Hustle uses the leaf cue; the retired branch-bounce cue is no longer triggered by its equipment route.

Orchard's throw whistle starts at 3.15 seconds to match its movie's release; the 3.15-second descent ends before the unchanged star cue at 6.35 seconds. Park retains its original 2.7-second release cue.

## Music

"Funky Chunk" Kevin MacLeod (incompetech.com)

Licensed under Creative Commons: By Attribution 4.0 License
https://creativecommons.org/licenses/by/4.0/

Track page: https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1500054

Original download: https://incompetech.com/music/royalty-free/mp3-royaltyfree/Funky%20Chunk.mp3

The original MP3 is included unchanged. The game changes playback volume and loops the track. This is free-to-use music with attribution, not public-domain or unlicensed music. Credits are also linked in the game's visible audio controls.

## Sound effects

Nineteen custom effects generated for BitDog with ElevenLabs Sound Effects v2 using the owner's account. `generation.json` records prompts, parameters and original-file hashes. `source/` preserves original generations. Runtime copies have leading silence trimmed for one-shots and loudness normalized; no retro oscillators are used.

Local generator: `artifacts/bitdog/generate-audio.py`. It reads the workspace-root `.env.local` at generation time. No credential is present in the game or its audio files.

Local processing: `artifacts/bitdog/prepare-audio.py`. `verification.json` records decoded durations and sizes.

## Throw revision

`throw-v3.mp3` is the active throw effect: a pure sine rendered offline, per the user's specific direction, gliding monotonically from 2,200 to 300 Hz over 3.15 seconds. It starts at release (2.94 s) and fades out before the existing star cue (6.35 s). `star.mp3` and its timing are unchanged. `throw-v3-design.json` records the envelope and pitch curve; `artifacts/bitdog/render-throw.py` reproduces it.

The original ElevenLabs throw and the rejected `throw-v2.mp3` revision remain archived. The v2 take drifted upward near its end. The active mix now uses 18 ElevenLabs effects plus this rendered sine effect, with the same music.

## Sprint launch revision

The opening's third shot now plays `sprint-start-v2.mp3` instead of `boost.mp3`. This new ElevenLabs Sound Effects v2 recording uses padded paw pushes, grass scuffs, a small brass collar jingle and light air. The request is recorded in `sprint-start-v2-generation.json`; original output is in `source/`. Runtime audio is trimmed and normalized to -22 LUFS with a -3 dB true-peak target. `artifacts/bitdog/generate-sprint.py` reproduces the request and processing. Existing gameplay boost remains available. There are now twenty active effect buffers: nineteen ElevenLabs effects and the rendered throw sine.

## Continuous intro gallop (current)

`intro-gallop-v3.mp3` replaces the earlier launch cue in shot three. It is a single 3.3-second ElevenLabs Sound Effects v2 recording requested as a large retriever galloping across grass with soft grouped paw impacts, scuffs and subtle panting. No repeated single-step sample is layered into this shot. `intro-gallop-v3-generation.json` records the prompt; the raw file remains in `source/`. Processing: 65 Hz high-pass, 6.5 kHz low-pass, -20 LUFS / -3 dB true-peak normalization and short end fades. Generator: `artifacts/bitdog/generate-run-foley.py`. The earlier `sprint-start-v2.mp3` stays archived and is not loaded at runtime.

The current video throw releases at 2.7 seconds, so the unchanged descending whistle starts there. The star cue remains at 6.35 seconds. Opening skip/replay stops existing one-shot sounds.

## Electric Avenue

"Electro Cabello" Kevin MacLeod (incompetech.com), licensed under [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/). [Official track page](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1400048). Normalized to -18 LUFS / -2 dBTP, with an 80 ms fade-in. Source, hash, attribution and processing are in `electric-music-source.json`.

Five new ElevenLabs Sound Effects v2 recordings: `electric.mp3`, `wire-hum.mp3`, `zap.mp3`, `paw-stone.mp3` and `intro-gallop-electric.mp3`. The intro gallop is a continuous 3.3-second recording on paving; it is never built from repeated paw ticks. The cable hum loops quietly beneath pickups and hazards. Exact requests and source hashes are in `electric-generation.json` and `electric-paws-generation.json`. Effects are trimmed and normalized to -22 LUFS / -3 dBTP. Originals remain in `source/`. The shared loader now has 27 buffers.
