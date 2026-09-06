# Mascot tuxedo mod

The character adapts the Gameslop reference in
`Assets/photo_2026-09-04_01-24-35.jpg` to GoldenEye's existing humanoid
skeleton: a new red oval head with antenna, eyes and D-pad emblem, a broader
black tuxedo jacket, and matte red hand materials. The original walk, aim,
reload and cutscene animations remain in use.

All graphics changes here are editable native mesh/material code in `build.py`.
No generated raster artwork or replacement renderer is required.

Model and setup layout reference: [n64decomp/007](https://github.com/n64decomp/007)
at commit `c4356466796c697dfd298010b9bed261f9ed8c6a`. The JSON tables contain
offsets and structure metadata for the exact USA ROM hash verified by the builder.

Build from the repository root:

```powershell
$env:PYTHONPATH = "$PWD/.superpowers/goldeneye/python"
python local/goldeneye/mods/mascot-tux/build.py
python local/goldeneye/mods/mascot-tux/verify.py
```

The workspace Python path contains Zopfli 0.4.3. On another machine, install
`zopfli==0.4.3` in your chosen Python environment instead. The base ROM and
modified ROM both stay in the ignored `local/goldeneye/data/` directory.

The modified ROM loads by default. `http://127.0.0.1:8777/?original=1` selects
the untouched original. Start a new mission after switching versions; emulator
save states include model data and belong to the version that created them.

Verified in Chrome: opening character animation, Dam gameplay, movement,
shooting, fullscreen, save-state restore, save flush and launcher return.
The byte-level verification checks every mission outfit selection and proves
there are no changes elsewhere outside the selected model slots.
