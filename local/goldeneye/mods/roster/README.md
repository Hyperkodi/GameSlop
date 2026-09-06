# Gameslop GoldenEye roster

The default local build layers these native N64 head replacements onto the
mascot in a black tuxedo. Original uniforms, body animations and mission roles
remain. These are stylized 32-pixel likenesses, not photorealistic character scans.

Regular guards draw from Donald, Melania, Donald Jr., Eric, Ivanka, Tiffany and
adult Barron Trump; JD Vance; Benjamin Netanyahu; Anthony Fauci; Osama bin Laden;
Barack and Michelle Obama; Bill and Hillary Clinton; and Bill Gates.

Scientists use Pepe, Shiba Inu, Brett and Squirrel heads on their lab-coat bodies.
All four are assigned in Facility, with the same rotation in Silo and Caverns.
Dr. Doak uses Pepe and retains his original mission script.

| Named enemy model | Replacement |
| --- | --- |
| Boris | Bill Gates |
| Ourumov | Benjamin Netanyahu |
| Trevelyan (enemy outfit) | Donald Trump |
| Xenia | Hillary Clinton |
| Baron Samedi | Osama bin Laden |
| Jaws | JD Vance |
| Mayday | Michelle Obama |
| Oddjob | Bill Clinton |
| Snow soldier | Anthony Fauci |
| Pilot | Donald Trump Jr. |

Friendly 006, Natalya and Valentin retain their story roles and models. Original
menu portraits and dialogue names are unchanged. Shared generic head slots also
affect civilian/multiplayer appearances that use those slots.

## Build

First build `mods/mascot-tux/build.py`, then run `python mods/roster/build.py`
from `local/goldeneye`. Zopfli 0.4.3 is needed when a compressed asset exceeds its
original slot using zlib. Run `python mods/roster/verify.py` afterwards.

`pack.html` converts the two generated atlases into CI4 textures and displays
the 20 reduced images. `textures.json` contains the checked-in conversion.
The native builder embeds palettes, image data and rounded head geometry.
Public-figure portraits use individual tighter atlas crops so the eyes, nose and
mouth occupy more of the 32-pixel texture. Their visible heads are 22% wider and
8% taller, with a shallower front to reduce facial distortion. Scientist head
crops and proportions are retained. The same geometry is used by generic guards
and the integrated enemy models, including their head LODs.
It preserves body joints, head collision data and the original head LOD branches
for integrated enemy models. Scientist changes only touch setup head IDs.

Output: `data/goldeneye-roster.z64` and `data/roster-build.json`, both gitignored.
The source ROM and mascot-only build remain intact. The launcher uses a separate
save namespace for the roster. Start a new mission instead of loading a state
from an older build, which contains the older character models in memory.

Format reference: [GoldenEye decompilation](https://github.com/n64decomp/007),
commit `c4356466796c697dfd298010b9bed261f9ed8c6a`.

## Validation

Inspected CI4 face mapping on an enlarged, animated intro test character.
A separate QA-only Dam lineup rendered a regular guard, all four scientist
heads and the Trevelyan replacement with the native animations. That fixture
changes positions and bodies solely for inspection; it is not the launcher's ROM.
Structural checks cover all replacement models, original collision records,
scientist head assignments, unchanged mission scripts, and every untouched ROM
byte. These checks do not constitute a complete playthrough of every mission.
The final default build also passed desktop Chrome boot, menu navigation, Dam
movement and firing, save-state round trip, fullscreen, save flush, return to
the launcher, and the 844-by-390 landscape overflow check.

The two additional integrated models (snow soldier and pilot) are included in
the coverage check. The snow soldier's 12-vertex distant head is replaced too.
Replacement head buffers retain enough vertices for the original impact-paint
indices and their linked vertices; validation checks that those allocations
never shrink below the original model's count.

The enlarged-face revision passed a fresh Dam mission with movement and firing
and no iframe emulator errors. All 36 replacement head slots retain full
32-pixel texture width (none needed the reduced-width fallback). Review images:
`../../art/roster/enlarged-face-textures.png` and `enlarged-faces-dam.png`.
