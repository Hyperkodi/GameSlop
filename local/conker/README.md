# Slopper's Bad Fur Day

European Conker browser mod. Start `python local/conker/serve.py`, then open
http://127.0.0.1:8779/. The development server binds only to loopback.

## Build

1. `python local/conker/setup.py "path/to/Conker's Bad Fur Day (Europe).zip"`
2. `python local/conker/build.py`
3. `python local/conker/verify.py`
4. `python tools/build-conker-public.py`

Requires Python 3. The input must match EU SHA-1
`ee7bc6656fd1e1d9ffb3d19add759f28b88df710`. The original cartridge and extracted
assets stay in ignored local folders. The public builder copies only its explicit
allowlist, including the modified game, into `games/conker`.

## Character

Five native character models in asset archive 01 are replaced with original
Gameslop geometry: red body, cream eyes, D-pad, bent antenna, bare red limbs.
Each fits within the corresponding original decompressed model size. Original
28-joint skeletons are preserved. Archive 09's separately animated nine-joint
hand meshes 143/144 have red vertex materials. Other models, maps, animations,
audio, collision, game code and gameplay scripts are unchanged.

The native renderer uses CBFD vertex loading and four-triangle commands.
Compression is raw deflate with a four-byte big-endian uncompressed length.
Archive entries remain in their original ROM ranges. No boot code or cartridge
header/checksum bytes are changed.

Format references: https://github.com/mkst/conker/wiki/ROM-Layout and
https://github.com/gonetz/GLideN64/blob/master/src/uCodes/F3DEX2CBFD.cpp.

## Title and browser

The browser title screen animates a matte red hand from the upper right. Its
rubber plate faces the title plane, presses inward and retreats. At contact,
the Slopper's imprint covers Conker's. Replay includes a short synthesized thud;
the automatic first animation is silent. Reduced-motion users get the final
title immediately. Original story dialogue and cinematic credits are retained.

Keyboard: WASD move, Space jump/A/confirm, J attack/B, Shift crouch/Z, E R,
Q L, arrows C-buttons/camera, Enter Start. Gamepad and emulator touch controls
are available. Fullscreen uses the browser API. Regular saves and emulator save
states use the separate `Sloppers Bad Fur Day EU v1` namespace.

EmulatorJS 4.2.3 is pinned to its versioned CDN. Downloads are checked for both
size and SHA-256 before emulation. `?core=parallel` selects the alternate core.

See [ARTWORK.md](ARTWORK.md) for the stamping-hand prompts and provenance.
