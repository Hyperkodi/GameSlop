# Rook appearance update

Built-in imagegen edit, 2026-09-07. Final asset: `../assets/rook.png`. Original saved at `rook-original.png`. Updates appear in gameplay, the hero lineup and the cast guide through their existing shared asset path.

Rook has fuller cheeks, a heavier chin, a broad square jaw, and a bold dark goatee with a small mustache. Her blue bob, silver septum ring and blue ghost tail remain recognizable. Other characters and enemy behavior are unchanged.

## Character edit prompt

Use case: precise-object-edit. Edit target: the existing transparent Rook ghost sprite attached. Keep this the SAME fictional adult woman ghost, matching the Pac-Chad game's polished cartoon art. Change her face to be fuller and heavier, with rounder plump cheeks, a subtle double chin, a distinctly broad masculine square jawline, and a prominent short dark navy-black GOATEE on her chin, with a small connected mustache. Make the goatee a bold clean shape large enough to read when this sprite is only 50 pixels tall. Retain the recognizable electric cobalt-blue asymmetric bob, large bright silver horseshoe septum piercing, pale lavender skin, expressive cream eyes, confident mischievous smirk, and tiny blue spectral tail. Keep the same near-frontal pose, framing, and thick clean outline. Keep her face rather than a full body; suggest extra weight through the cheeks, chin and broader lower head. Preserve the sprite's colorful arcade style, not photorealism. No new clothes, text, props, glasses, background or additional characters. Deliver an RGBA PNG with actual transparent alpha outside the sprite, NOT a drawn checkerboard or a black rectangle. Full silhouette fits within the canvas with clear transparent margins.

## Final transparent-background prompt

Use case: background-extraction. Edit ONLY the background of this Rook character sprite. Remove the entire white/light-gray checkerboard and replace it with TRUE transparent alpha pixels. Deliver an RGBA PNG with alpha=0 outside the isolated head. The checkerboard in the input is unwanted baked-in artwork, not transparency: it must disappear completely. Preserve the character pixel-for-pixel as much as possible, including its exact size, location, blue hair, plump cheeks, broad jaw, goatee and mustache, silver piercing, purple skin, and small ghost tail. Keep the square canvas. Do not change the character, add labels or draw a new checkerboard. Transparent background only.

The initial output and first extraction attempt had RGB checkerboard backgrounds. Only the final RGBA output with transparent corners was installed. No programmatic image edits were used.
