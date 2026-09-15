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

## 100-level expansion weapon sprites

Generated with the built-in image generation tool, one PNG master per weapon. The tool does not expose a model selector. Existing whale.webp and gas.webp were used only as style references. Masters have real alpha and were converted to 360 by 360 WebP using Lanczos resampling, quality 92, method 6. No background removal or replacement. Every output was visually inspected.


### paper

Output: `assets/illustrated/paper.webp`. PNG source: `exec-18195398-f044-44f8-ac85-9988f9ae6d71.png`.

Use case: stylized-concept. Create one original game inventory sprite for Paper Hands, a chunky fan of three folded ivory paper banknotes held in a small antique-gold mechanical gripper, jade inlay, ink-teal fittings, a little scarlet accent. Match the provided existing Slop Survivor weapon sprites in illustration style, silhouette weight, saturated palette and detail: premium hand-painted 2D cel shading, thick very dark outlines, dimensional bright metallic highlights. Asset for a mobile game, readable at 40 pixels, centered in a square, entire object uncropped with 8 percent clear padding. No writing, numbers, symbols resembling letters, logos, floor, cast shadow, background or checkerboard. Real transparent alpha background. Generate a PNG master. The source images are style references only, do not depict a whale, dragon, or gun.


### copium

Output: `assets/illustrated/copium.webp`. PNG source: `exec-9e479d46-b40a-49c0-99fb-678b8544edd2.png`.

Use case: stylized-concept. Original mobile game inventory sprite: a compact jade-green copium pressure tank with antique-gold valve, pressure gauge without numbers, a short curled hose and translucent mint vapor puff attached to nozzle. Match the two provided existing weapon illustrations in silhouette weight and detail: premium hand-painted 2D cel shading, thick very dark outlines, dimensional highlights, rich saturated jade, ink-teal, antique gold and scarlet. Chunky readable at 40 pixels. Square composition, centered and fully uncropped, 8 percent clear margin. No text, logos, letters, numbers, background, floor, cast shadow or checkerboard. Real transparent alpha around the object and through openings. PNG master. Reference images are for style only; do not depict their whale or gun subject.


### printer

Output: `assets/illustrated/printer.webp`. PNG source: `exec-33d9fdf6-ed8f-4e6d-b44e-442ffe332319.png`.

Use case: stylized-concept. Original mobile game inventory sprite: a chunky ink-teal and antique-gold money printing machine, wide paper slot ejecting three blank ivory banknotes with jade ornamental circles, small gold crank and scarlet indicator. Match the two provided existing weapon illustrations in silhouette weight and detail: premium hand-painted 2D cel shading, thick very dark outlines, dimensional highlights, rich saturated jade, ink-teal, antique gold and scarlet. Chunky readable at 40 pixels. Square composition, centered and fully uncropped, 8 percent clear margin. No text, logos, letters, numbers, background, floor, cast shadow or checkerboard. Real transparent alpha around the object and through openings. PNG master. Reference images are for style only; do not depict their whale or gun subject.


### sniper

Output: `assets/illustrated/sniper.webp`. PNG source: `exec-9fbb48bc-dded-42af-9694-d631a4a892bf.png`.

Use case: stylized-concept. Original mobile game inventory sprite: a compact robotic sniper device, single jade lens eye on an ink-teal housing with long slim gold barrel, gold tripod feet folded inward, scarlet targeting lens. Match the two provided existing weapon illustrations in silhouette weight and detail: premium hand-painted 2D cel shading, thick very dark outlines, dimensional highlights, rich saturated jade, ink-teal, antique gold and scarlet. Chunky readable at 40 pixels. Square composition, centered and fully uncropped, 8 percent clear margin. No text, logos, letters, numbers, background, floor, cast shadow or checkerboard. Real transparent alpha around the object and through openings. PNG master. Reference images are for style only; do not depict their whale or gun subject.


### halving

Output: `assets/illustrated/halving.webp`. PNG source: `exec-eef92ee9-8c41-4def-91a1-7db734fe124e.png`.

Use case: stylized-concept. Original mobile game inventory sprite: an oversized antique-gold halving hammer with a split jade crystal embedded in its heavy square head and short ink-teal wrapped handle. Match the two provided existing weapon illustrations in silhouette weight and detail: premium hand-painted 2D cel shading, thick very dark outlines, dimensional highlights, rich saturated jade, ink-teal, antique gold and scarlet. Chunky readable at 40 pixels. Square composition, centered and fully uncropped, 8 percent clear margin. No text, logos, letters, numbers, background, floor, cast shadow or checkerboard. Real transparent alpha around the object and through openings. PNG master. Reference images are for style only; do not depict their whale or gun subject.


### slippage

Output: `assets/illustrated/slippage.webp`. PNG source: `exec-ac00c022-8d26-4401-808b-41cb2bd879df.png`.

Use case: stylized-concept. Original mobile game inventory sprite: a tipped jade-glass liquidity vial on a gold mechanical base spilling a small curling turquoise slick held within the object's silhouette, gold coin sliding down the liquid slope. Match the two provided existing weapon illustrations in silhouette weight and detail: premium hand-painted 2D cel shading, thick very dark outlines, dimensional highlights, rich saturated jade, ink-teal, antique gold and scarlet. Chunky readable at 40 pixels. Square composition, centered and fully uncropped, 8 percent clear margin. No text, logos, letters, numbers, background, floor, cast shadow or checkerboard. Real transparent alpha around the object and through openings. PNG master. Reference images are for style only; do not depict their whale or gun subject.


### trap

Output: `assets/illustrated/trap.webp`. PNG source: `exec-aca1c2c1-e50e-445c-aad3-cd6bb31ab611.png`.

Use case: stylized-concept. Original mobile game inventory sprite: an open chunky mechanical bear trap with antique-gold triangular teeth and ink-teal metal jaws, jade circular trigger plate, short scarlet spring. Match the two provided existing weapon illustrations in silhouette weight and detail: premium hand-painted 2D cel shading, thick very dark outlines, dimensional highlights, rich saturated jade, ink-teal, antique gold and scarlet. Chunky readable at 40 pixels. Square composition, centered and fully uncropped, 8 percent clear margin. No text, logos, letters, numbers, background, floor, cast shadow or checkerboard. Real transparent alpha around the object and through openings. PNG master. Reference images are for style only; do not depict their whale or gun subject.


### nuke

Output: `assets/illustrated/nuke.webp`. PNG source: `exec-d3c7172e-e755-4ceb-bebd-0f3d733ffa27.png`.

Use case: stylized-concept. Original mobile game inventory sprite: a compact chunky scarlet rocket bomb with antique-gold nose and fins, ink-teal central housing and bright jade reactor porthole, no radiation sign or writing. Match the two provided existing weapon illustrations in silhouette weight and detail: premium hand-painted 2D cel shading, thick very dark outlines, dimensional highlights, rich saturated jade, ink-teal, antique gold and scarlet. Chunky readable at 40 pixels. Square composition, centered and fully uncropped, 8 percent clear margin. No text, logos, letters, numbers, background, floor, cast shadow or checkerboard. Real transparent alpha around the object and through openings. PNG master. Reference images are for style only; do not depict their whale or gun subject.


### lambo

Output: `assets/illustrated/lambo.webp`. PNG source: `exec-c729b578-7565-48cb-a0c0-d1983232bfaf.png`.

Use case: stylized-concept. Original mobile game inventory sprite: a tiny original golden sports car, ink-teal windshield, jade glowing wheels, compact exaggerated wide silhouette viewed from three-quarter top-front, no manufacturer logos. Match the two provided existing weapon illustrations in silhouette weight and detail: premium hand-painted 2D cel shading, thick very dark outlines, dimensional highlights, rich saturated jade, ink-teal, antique gold and scarlet. Chunky readable at 40 pixels. Square composition, centered and fully uncropped, 8 percent clear margin. No text, logos, letters, numbers, background, floor, cast shadow or checkerboard. Real transparent alpha around the object and through openings. PNG master. Reference images are for style only; do not depict their whale or gun subject.


### flashloan

Output: `assets/illustrated/flashloan.webp`. PNG source: `exec-67f37953-eff4-4b5b-aad1-33b49f0098f7.png`.

Use case: stylized-concept. Original mobile game inventory sprite: a chunky antique-gold lightning bolt passing through an ink-teal circular debt clock with jade segments and a scarlet gauge needle, no letters or numbers. Match the two provided existing weapon illustrations in silhouette weight and detail: premium hand-painted 2D cel shading, thick very dark outlines, dimensional highlights, rich saturated jade, ink-teal, antique gold and scarlet. Chunky readable at 40 pixels. Square composition, centered and fully uncropped, 8 percent clear margin. No text, logos, letters, numbers, background, floor, cast shadow or checkerboard. Real transparent alpha around the object and through openings. PNG master. Reference images are for style only; do not depict their whale or gun subject.
