# GoldenEye 64 title branding

The browser launcher, game toolbar, page titles, play button and loading status
use GoldenEye 64. A generated red brush-painted SLOP covers EYE in the shared
logo. The native game's GoldenEye logo model is also replaced with that design;
it is not a browser overlay over the original title screen.

Build after the mascot and roster recipes:

```powershell
python local/goldeneye/mods/branding/build.py
```

Use the same Zopfli Python environment as the mascot/roster recipes; the
portrait's tight compressed slot requires Zopfli 0.4.3.

The builder consumes `title-texture.json`, converted by `pack.html` / `pack.js`,
and the verified `goldeneye-roster.z64`. The output is
`data/goldeneye-slop64.z64`. It changes only the native title model slot, dossier
graphics slot, opening certificate logo slot and the 20-byte cartridge title field. The build asserts every other byte is identical,
checks compressed-slot capacity and verifies the decompression round trip.

The title uses sixteen native 32-by-32 CI4 texture tiles through the game's
character display-list renderer, which supports the embedded palette. Original title timing,
menu controls, mission content and character mods remain intact. The roster
save namespace is retained. Restart the emulator to see the new startup title;
an old save state taken on the title screen still contains the old logo.

Source artwork and the final built-in imagegen prompt are in
`../../art/branding/README.md`. Native format references come from the local
checkout of [n64decomp/007](https://github.com/n64decomp/007).

Verified in desktop Chrome: native title rendering and transition to file
selection, menu navigation, Dam movement/firing, save-state round trip,
fullscreen, save flush and launcher return. The logo and toolbar also pass
1280-pixel desktop, 844-by-390 landscape and 320-pixel narrow layout checks.
Review captures are `../../art/branding/in-game-title.png` and `launcher.png`.

The builder also writes `build-manifest.json`. The engine reads it without
HTTP caching before starting EmulatorJS and appends the ROM's SHA-256 to its
URL. EmulatorJS 4.2.3 otherwise trusts a cached ROM when its filename and byte
length match, even if its contents changed. Save names and ROM basenames stay
stable; old ROM cache entries and player saves are not deleted.

Cache regression check: seeded the unversioned ROM cache key with the original
12 MB game, removed only the test browser's current hashed ROM entry, then
restarted. The emulator's in-memory ROM SHA-256 matched the build manifest.
The old cache entry and a saved-state sentinel both remained intact.

The save-folder cover and mission dossier now use the mascot in a black tuxedo.
`pack-portrait.html` / `pack-portrait.js` convert the generated portrait to CI4;
`portrait-texture.json` is the reproducible build input. The portrait is sampled
at 32 by 32 pixels and stored in four 32-pixel tiles to fit the original 5,552-byte
compressed wallet slot. Dormant alternate-Bond photo geometry is removed;
the retail game's switches, folder animation and active picture frames remain.
`portraits.py` puts textures before all display lists and packs the lists in
traversal order, as required by the native loader's adjacent-pointer lengths.
Run `python local/goldeneye/mods/branding/verify.py` after building.
Source art and the built-in imagegen prompt: `../../art/portraits/README.md`.
Verified the final build in Chrome: all four save-folder photos, the larger
mission-menu photo, and navigation through mission selection and difficulty.
Review captures: `../../art/portraits/save-select.png` and `mission-menu.png`.

The opening licensing/certification screen also uses the GoldenEye 64 logo with
the red SLOP brush across Eye. `pack-legal.html` / `pack-legal.js` convert the
existing title artwork to 128 by 32 CI4; `legal.py` replaces the embedded logo
and its texture commands. Its original logo frame, certificate text, copyright
credits, signatures and certification mark remain in place. This is part of the
ROM, so it follows fullscreen and native startup timing. Review capture:
`../../art/branding/opening-certificate.png`.
