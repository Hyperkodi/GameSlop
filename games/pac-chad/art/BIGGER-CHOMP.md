# Bigger chomp and closer camera

Built-in imagegen edit, 2026-09-08. Final asset: `../assets/chad-chomp.png`. Original atlas backed up locally as `chad-chomp-before-bigger.png`.

The wide pose has a larger dark mouth cavity and a much lower bearded jaw. The largest pose now occupies two of seven movement phases. The new atlas uses 627-pixel columns and a 600-pixel row boundary to avoid clipping the lower row's hair. Read-only upper-face template matching measured registration offsets (0,0), (60,-1), (1,18), (58,17); only renderer coordinates change, not the generated image. Background verified RGBA transparent.

Camera tiles are now 48–56 CSS pixels in taller views and at least 44 pixels in short landscape views (previously typically 34 desktop / 38 mobile). The existing follow camera and overview minimap retain navigation context. No gameplay or scoring rules changed.

## Edit prompt

Edit target: this exact 2 by 2 Pac-Chad mouth animation atlas. Keep the four equal square cells and the same grayscale Gigachad likeness, black swept-back hair, eyes, nose, three-quarter facing right pose, black beard and detailed arcade illustration. Make the CHOMP much more exaggerated and readable. Top-left CLOSED stays closed. Bottom-right OPENING has a medium open mouth. Top-right OPEN has a large dark mouth cavity, jaw lowered noticeably. Bottom-left BIG CHOMP has a HUGE WIDE OPEN mouth: the black mouth opening is roughly twice the current height and visibly wider, lower jaw hinging far down like an exaggerated cartoon chomping action. Strong visible white upper and lower teeth framing the dark cavity. Not just a smile or shout: this is a big Pac-Man-style biting animation. Keep hair/eyes/nose registered at the same coordinates and same size in each cell. Only the mouth and bearded lower jaw move. Fit the entire dropped jaw within the bottom-left cell without clipping. Slightly reduce ALL four heads uniformly if needed to leave room for the biggest open jaw, preserving consistent scale. Transparent background. Actual RGBA PNG alpha, no checkerboard artwork, no text, no grid lines, no additional heads. Exact 2x2 four-frame atlas.

## Transparency prompt

Remove the checkerboard background. Preserve all four heads exactly. Return a transparent PNG sprite sheet with real alpha transparency around and between the heads. Keep the 2x2 layout, sizes, positions and mouth poses unchanged. No glow, shadow, backdrop or checkerboard artwork.

Selected output: `exec-22ff0d88-1cd2-459d-8b23-c433a298a63a.png`, 1254 x 1254 RGBA. Built-in imagegen used, not CLI.
