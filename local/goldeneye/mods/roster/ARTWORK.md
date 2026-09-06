# Generated roster artwork

Created with the built-in image generation tool. The atlases were inspected,
then converted to 32-by-32 CI4 palettes using browser canvas in pack.js.
The public-figure conversion now uses per-person crop rectangles recorded in
`textures.json` to enlarge facial features. The original generated atlases are
preserved; this is a texture-mapping/conversion change, not regenerated artwork.

## Public figures final prompt

Use case: stylized-concept. Asset type: one production game character FACE TEXTURE ATLAS for an N64-era satirical character reskin. Create a square image with an EXACT 4-column by 4-row uniform grid, sixteen edge-to-edge equal square cells, no gutters, no borders, NO TEXT OR LABELS. Each cell is an orthographic straight-on portrait of one ADULT public figure, head only from top of hair to base of chin, with ears, centered and filling almost the entire square, completely frontal, looking straight forward, neutral expression, uniformly soft frontal light, flat muted taupe background. Strong recognizable facial features and characteristic hair, hand-painted low-poly-game texture style, realistic likeness simplified for 32x32 game textures, no pixel grid, no weapons, no injuries, no bodies, no shoulders. The exact row-major order is: ROW 1: Donald Trump, Melania Trump, Donald Trump Jr., Eric Trump. ROW 2: Ivanka Trump, Tiffany Trump, adult Barron Trump age 20, JD Vance with beard. ROW 3: Benjamin Netanyahu, Anthony Fauci with glasses, Osama bin Laden with white turban and long dark beard, Barack Obama. ROW 4: Michelle Obama, Bill Clinton, Hillary Clinton, Bill Gates with glasses. Precisely sixteen individual faces, each in its own identically sized square cell. Preserve identities; no caricature insults. This is a technical atlas so keep all head positions, face scales and lighting consistent.

Output: art/public-figures.png.

## Scientists initial prompt

Use case: stylized-concept. Asset type: production FACE TEXTURE ATLAS for four friendly meme scientist characters in a retro N64 game. One square image divided into an EXACT 2 by 2 grid of equal square cells, no borders, no gutters, NO TEXT. Top left: Pepe the Frog, recognizable green face with bulging half-lidded cream eyes and broad brown-orange lips. Top right: Shiba Inu dog meme, orange fur, cream muzzle, black nose, pointed ears and knowing expression. Bottom left: Brett from Matt Furie's Boys' Club / Based Brett meme, recognizable bright blue rounded head, droopy cream eyes, wide smile with a few small teeth, NO HAIR, NOT a human. Bottom right: cute reddish-brown squirrel with little rounded ears, cream muzzle, bright black eyes and two buck teeth. Each character head only, perfectly straight-on, ears included, head almost filling cell, head centered with face in center, no clothes or shoulders. Consistent soft frontal light, hand-painted game texture style with clearly defined facial features, simple shading that reads at 32 by 32 pixels. Uniform dark taupe background. No weapons, no violence, no political symbols. This is a technical texture atlas, not a poster.

## Scientists final edit prompt

Edit only the bottom-left tile to recognizable Based Brett: a bald blue
humanoid/froglike head with a smooth dome, small humanlike ears at the sides at
eye level, half-lidded eyes and salmon-pink lips. No bear ears, fur or hair.
Preserve the other three characters and the grid layout.

Final output: art/scientists.png. Initial version: art/scientists-v1.png.
The final edit corrected Brett's silhouette before the N64 conversion.
