# Illustrated expansion - v1.5.0

The campaign now has 15 chapters, five boss identities and 14 illustrated weapons. Sloppy keeps the red GameSlop slime silhouette, cream eyes and plus-shaped mouth. Slippy keeps his sleepy eyelids, pink lips and brown tuft.

The visual direction references the public [Slippy website](https://www.slippy.club/): navy, parchment, amber, ink outlines and turquoise accents. Titan One and Nunito are bundled locally with their OFL licenses. The four new rivals are original game characters, not claims about official Slippy characters or real tokens.

| Boss | New chapter | Behavior |
| --- | --- | --- |
| Rattlesatoshi | 13: Copper Canyon | Two-second warning, then two-second stampede. Destroy a section to pull the front backward. |
| Madame Mamba | 14: Midnight Marina | Three-second healing chant every 16 seconds. Focus damaged sections before the chant. |
| Brass Baron | 15: Clockwork Citadel | Three-second body shutters every 12 seconds reduce ordinary damage by 30%; head and critical hits bypass them. |

Coldbyte and the other boss portraits also appear throughout the existing chapters, whose original encounter rules remain. Four illustrated arena plates are shared across the campaign; the three new chapters have distinct routes. Existing saves and unlocks retain their chapter indices.

Art includes four poses each for Sloppy and five bosses, four burst frames, four flame frames, four ammunition sprites, a scale texture and fourteen weapon illustrations. The canvas renderer chooses hit/attack poses from combat events. Idle poses change occasionally; reduced-effects mode suppresses idle animation. Ammunition is separate from inventory art.

Generated masters and generation records are preserved in `artifacts/slop-survivor/art-v2` in the development workspace. Built-in image generation does not expose a model selector, so no exact API model ID is asserted. Runtime images are compressed WebP with alpha, included in the offline cache. Simple functional icons, rays and targeting markers remain code-drawn.

The previous v1.4.0 standalone ZIP is preserved in `artifacts/slop-survivor/sections-v1`. To compare, extract it into a separate folder and use a separate localhost port so it has its own save storage.

Validation: see the accompanying art-v2 QA report. Browser emulation is not a substitute for physical Android/iPhone playtesting. Automated balance samples use upgraded workshop weapons and a simple card-choice policy; they demonstrate possible wins, not guaranteed wins for every randomized build.
