# Pac-Chad sound pack

Status: complete local pack installed. All 20 cues are original layered digital synthesis rendered to 44.1 kHz, mono, 16-bit WAV files. No ElevenLabs files, borrowed samples, voices or external accounts were used. Total production audio is about 1.03 MiB. `js/sound-bank.mjs` maps the game to these real audio assets.

The pack covers pellets, power pellets, ghost capture, dash, decoy, damage, enemy warning, shortcut warning, shortcut opening, combos, stage clear, run start/end, menu selection, countdown, pause, resume, ability recharge, power expiry and personal best. Music and dialogue are outside this pack.

## Rebuild and preview

```powershell
npm.cmd --prefix games/pac-chad run audio:build
node games/pac-chad/tests/audio-browser.mjs
```

The deterministic source is `synthesize.mjs`. Each sound combines its own pitch envelopes, harmonic layers, filtered noise, attacks, decays and occasional short echoes. Files are normalized to a 0.72 peak with smooth boundaries, then mixed at individual levels. Chomps are only 115 ms long and alternate subtly in pitch. Capture chains rise in pitch. An eight-voice cap and master compressor control busy scenes. Existing minimal synth cues remain a fallback if a file cannot load.

Open `/games/pac-chad/sound-lab.html` in the running preview to play individual sounds or the whole set at the game's relative levels. `sound-pack-preview.wav` is a standalone audition reel; `preview-cues.json` gives cue timestamps. These review files stay outside production assets. Rebuilding updates the WAVs, bank, hashes and reel. It does not call a remote API.

Validation: every WAV served with the correct MIME type, decoded by Chrome Web Audio, and checked for silence, clipping and nonzero endpoints. All 20 sample playback paths passed. Dense-scene offline rendering peaked at about 0.72 full scale. Mute, voice limit, restart, ability recharge, power expiry, pause/resume and touch sound picker passed. The full desktop/mobile gameplay check also passed without JavaScript errors. See `validation.json`. These are browser and signal checks; subjective listening and physical-phone speaker quality were not independently verified by the assistant.

## Optional ElevenLabs replacement

The earlier 13 prompts remain in `effects.mjs` if ElevenLabs is connected later. This is optional; the installed pack already works.

Set `ELEVENLABS_API_KEY` in your local environment, then run from the workspace root:

```powershell
npm.cmd --prefix games/pac-chad run audio:plan
npm.cmd --prefix games/pac-chad run audio:generate
```

The key must have Sound Effects access. Keep it out of source files, browser code and chat. The generator sends only the sound prompts to ElevenLabs. Generation uses account credits. It makes one request per missing effect, saves each successful MP3, records prompts and hashes in `generated.json`, and updates the browser bank and build manifest. It never automatically retries billable failures or overwrites existing effects.

Generate a subset with `npm.cmd --prefix games/pac-chad run audio:generate -- pellet dash`. To revise an existing effect, first move its MP3 to a versioned backup outside `assets`, then regenerate that ID.

Optional ElevenLabs files use `assets/sfx-<id>.mp3` and replace only generated entries in the bank, preserving the local pack's additional cues. The installed local files use `assets/sfx-<id>.wav`. No live generation calls or credentials are used in the game.

For optional MP3 replacements, listen and balance before publishing. Run `audio:build` to restore the complete original local pack.

API checked against [ElevenLabs Create sound effect](https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert), using `eleven_text_to_sound_v2`, `mp3_44100_128`, and explicit 0.5–1.8 second durations.
