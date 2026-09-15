# Current artwork

Version 1.1 uses the corrected cartoon assets described in [CARTOON-ART.md](CARTOON-ART.md). The following prompts document the archived v1.0 artwork, including the superseded character proportions.

# Original art and audio

Generation mode: built-in image-generation tool. Runtime uses compressed WebP copies of the original PNGs, preserving real alpha where present. No Cell Survivor artwork is used.

## Terrarium background — assets/terrarium.webp

Final prompt specification: Create an original premium vertical 2:3 mobile game environment: a cel-shaded magical greenhouse vault seen from above, dark petrol-teal engraved stone floor occupying the open center, tropical plants and giant glass tubes along the edges, copper fittings, jade crystals, tiny golden coin stacks and an ornate vault entrance at the bottom. Restrained jade, ink blue and antique gold. Keep the center low contrast and empty for gameplay. No characters, words or UI.

Source generation: `exec-9873df91-cb45-4e53-a1d7-3dc3d3019ad0.png`.

## Key art — assets/key-art.webp

Final prompt specification: An original landscape 3:2 cel-shaded action faceoff in a magical greenhouse vault. Sloppy in the foreground aims an inventive gold coin cannon with a mint crystalline chamber toward an enormous golden Slippy curving through the background. Preserve Sloppy's scarlet round body, curved stem, cream eyes and black plus-sign mouth. Preserve Slippy's heavy eyelids, thick pink lips and brown tuft. Dramatic gold coin streaks, jade crystals, copper architecture, rich ink-teal/gold/scarlet palette. No text. Reference images are for character identity only; ignore the human in Sloppy's reference sheet.

Source generation: `exec-b21cefae-4442-40bc-8ae7-38383f58703a.png`.

## Slippy head — assets/slippy-head.webp

Final prompt specification: One isolated transparent game sprite of Slippy's gold-orange snake head and very short rounded neck. Front view, half-closed heavy lazy eyelids, small dark pupils, wide pink smiling lips, small brown swept tuft. No mask, hose, tank, body coils, limbs or writing. Premium hand-painted cel shading, cream highlights and dark brown outline. Preserve actual transparent alpha around the silhouette.

Identity reference: https://www.slippy.club/assets/characters-v2/copium.png (research folder only; not shipped as game art). Source generation: `exec-7afa21f0-e2b0-4d56-b8e1-818201c75f81.png`.

## Sloppy — assets/sloppy-v2.webp

Final generation prompt:

> Transparent-background game sprite asset. Single full-body Sloppy mascot, frontal view: squat spherical bright scarlet red creature, a short bent red stem on its head, two big cream oval eyes with black pupils and angled red eyebrows, a simple black PLUS SIGN + for its mouth. Short mitten red arms and short red legs, chunky red boots. Olive explorer shoulder straps and a small backpack with gold buckles. No gun. Charming determined expression. Beautiful premium 2D cel shaded hand-painted game art with dimensional highlights and rich dark red shadows. The ONLY content is this character, isolated, centered and uncropped. Create real transparent alpha around silhouette and between legs, absolutely no background texture or transparency checkerboard drawn in the image. Square image. No text, floor or cast shadow.

Source generation: `exec-d46e4fa6-69a9-4811-afbc-f6f8562500c9.png`. Two earlier drafts contained printed checkerboards and are not used by the game or included in the release archive. Actual selected hero and head images were checked for RGBA/zero-alpha corners.

## Runtime artwork and animation

Weapon icons, projectiles, serpent body shading, armor, critical numbers, particles, targeting, fields, beam effects, HUD and app icon are original Canvas/SVG/CSS artwork authored for this game. Sloppy breathes, his cannon tracks targets, Slippy's head moves subtly, and the segmented body follows the rounded path. PNG app icons are rasterizations of our own SVG source.

## Audio

All sounds and the looping musical sequence are synthesized in `audio.mjs` using the Web Audio API. Quiet triangle/sine oscillator percussion, pitched firing cues, reward notes, bass and melody; no downloaded music or paid generation service. Independent music and effects sliders. Audio starts after user interaction to comply with normal browser autoplay behavior.
