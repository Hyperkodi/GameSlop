# GoldenEye 64 — Gameslop local lab

Start with `powershell -ExecutionPolicy Bypass -File local/goldeneye/start.ps1`
from the repository root. Open http://127.0.0.1:8777/ and press Play GoldenEye.
The server binds only to loopback. This prototype has not been published.

The ZIP supplied by the user contains the US 12 MB big-endian ROM. Its SHA-256
is `2cdcec8a9f0cb6e36337f3ee39d8ad105dc8afa6ba1c02d466e8f5b771f9a162`.
Only that ROM member was copied into `data/goldeneye.z64`; the original ZIP is
untouched. Local ROMs and downloaded runtimes are gitignored and live outside
the public `games/` tree.

## Controls and saves

- Mouse mode: click the game or **Mouse aim** to capture the cursor. Move the
  mouse to aim, left-click to fire, and hold right-click for the sights.
  WASD moves and strafes; R reloads/interacts, X changes weapons.
  Esc releases the cursor; Enter releases it and opens the watch / Start.
  The first capture click does not fire. Adjust sensitivity in the toolbar;
  that preference is kept in browser storage.
- Mouse mode temporarily selects native 1.2 Solitaire and hold-to-aim in the
  live player settings. Releasing the cursor restores the prior controls.
  Release it before menu navigation or switching back to a controller.
  The following keyboard mappings apply with the cursor released:
- Enter: N64 Start. X: N64 A / confirm. Z: N64 B / reload.
- WASD: left analog stick, move / turn with the original control scheme.
- Space: Z trigger / fire. E: R / aim. Q: L.
- IJKL: right stick / C buttons. Arrow keys: D-pad.
- Gamepads and the emulator's touch controls are available; physical phone and
  controller testing has not been performed.
- The original watch menu contains alternate GoldenEye control schemes.
- Emulator toolbar: save/load state, control mapping, sound and fullscreen.
  States default to browser storage. Export backup files through its menus.
  Regular cartridge progress flushes every 30 seconds and before returning to
  the launcher. Clearing browser data removes locally stored saves.

## Runtime and restoration

EmulatorJS 4.2.3 from https://github.com/EmulatorJS/EmulatorJS and its pinned CDN,
using `mupen64plus_next`. The alternate core is available at `/?core=parallel`
for compatibility testing. The ROM stays on the local server; it is not sent
to an emulator service. Upstream EmulatorJS may check its CDN for version metadata.
`runtime-manifest.json` records every downloaded runtime file's exact hash.
Core licenses are embedded in the downloaded core archive and accessible in
the emulator's information menu.

Restore dependencies with `python local/goldeneye/setup.py`. To also restore
the original ROM, append `--rom-zip "C:\path\GoldenEye 007 (USA).zip"`.
Only the verified USA base file is accepted. No game download is performed.

## Gameslop mascot in a black tuxedo

The default build replaces Bond with the mascot's red oval head, antenna,
cream eyes and black D-pad emblem, a broader black tuxedo jacket, bow tie,
and red hands. It uses native N64 meshes and materials and retains GoldenEye's
character skeleton and animations. Every mission selects the tuxedo outfit.
First-person hand materials also cover weapon models and the watch arm.
The reference is `Assets/photo_2026-09-04_01-24-35.jpg`.

The mascot-only build is `data/goldeneye-mascot-tux.z64`. The source ROM remains
untouched. Use `/?original=1` to play the original version; each version has
its own save-state name. Old original-ROM save states should not be loaded
into the modified game because they contain the old character data.

Rebuild with `python mods/mascot-tux/build.py` from this directory. It requires
Zopfli 0.4.3 for models that need tighter compression (`pip install zopfli==0.4.3`).
The workspace installation can be used by setting PYTHONPATH to
`.superpowers/goldeneye/python` from the repository root before running the builder.
The recipe verifies the USA ROM hash, checks each compressed asset's capacity,
and writes a build report alongside the modified ROM. Model format references
come from https://github.com/n64decomp/007; no complete engine rebuild is needed.

## Verification

Checked in desktop Chrome: boot, keyboard menu navigation, Dam first-person
gameplay, movement and firing (ammo decreased from 7 to 2), save-state creation
and restoration, fullscreen, save-file flush and return to the launcher.
The launcher also passed a landscape 844-by-390 horizontal-overflow check.
Both included cores rendered Dam; Mupen64Plus remains the default.
The first mission has a noticeable black loading transition before its intro.
This is a local playtest, not a full-game or physical-mobile compatibility test.

Mouse integration lives in `mouse-controls.js`. Its native profile targets the
pinned USA ROM and identifies live RDRAM from the loaded ROM's boot code,
page alignment, current-player pointer and valid option values. Ambiguous or
unsupported sessions fail without writing memory. The offsets come from
`player.c`, `bondview.h` and `options.c` in n64decomp/007 at commit
`c4356466796c697dfd298010b9bed261f9ed8c6a`. It does not modify the ROM or game code.
Mouse motion drives the native analog look input, so native turn-speed limits
still apply. Browser capture uses the Pointer Lock API with a fallback when
raw mouse input is unavailable.

Run `node --test tools/goldeneye-mouse.test.cjs` from the repository root for
profile restoration, unsupported ROM, ambiguous memory and pitch-setting
checks. Desktop browser QA exercises actual camera movement, mouse buttons,
WASD and release cleanup in a fresh Dam mission on the default core.

The mascot build passed the same desktop gameplay checks, plus visual inspection
of the animated gun-barrel character and red first-person hands. Review captures
are in `art/mascot-tux/`. Run `python mods/mascot-tux/verify.py` to verify that
the original ROM is intact and every byte outside selected model slots and
the 21 mission costume records is unchanged in that mascot-only build.

## Enemy and scientist roster

The roster build is `data/goldeneye-roster.z64`, layered on the mascot
build. It adds the 16 requested public-figure likenesses to generic guards and
eight named enemy models. Facility, Silo and Caverns scientists use Pepe, Shiba
Inu, Brett and Squirrel heads with their lab coats and original mission scripts.
See [the roster recipe](mods/roster/README.md) for the full cast and build steps,
and [artwork prompts](mods/roster/ARTWORK.md) for the generated texture sources.

Run `python mods/roster/verify.py` to verify all 20 likenesses, scientist
assignments, model pointers, and unchanged mission logic and map data. The
roster uses a separate save namespace; begin a new mission after rebuilding.
The final branding build replaces Bond's save-folder and mission-dossier
portraits with the mascot in his tux. Other character portraits and dialogue
names retain the original GoldenEye characters.

## GoldenEye 64 / SLOP branding

The default launcher now loads `data/goldeneye-slop64.z64`, which adds the native
GoldenEye 64 title with SLOP brush-painted across EYE. The launcher and game
toolbar share that treatment. Page titles, play controls and loading status
also use GoldenEye 64. The existing roster save namespace is preserved.
The opening certificate screen now carries the same SLOP-over-Eye logo.
See [the branding recipe](mods/branding/README.md) for rebuilding.

Each build writes a content hash manifest so the emulator loads the current
ROM instead of reusing an older file of the same size. Return to the launcher
and start again after an update. If loading an old save state restores old
characters, restart the mission from the game's menus; cartridge progress is
kept. `?original=1` deliberately loads the unmodified cast and now displays a
link to switch back to the Gameslop version.
