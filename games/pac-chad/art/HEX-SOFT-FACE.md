# Hex soft-face revision

Built-in imagegen edit, 2026-09-07. Final asset: `../assets/hex.png`. Previous sprite backed up as `hex-before-soft-face.png`. The other three ghosts are unchanged.

Hex now has a slim clean-shaven human face, natural proportions, calm expression, round black glasses and blue-and-pink drag makeup. Removed the exaggerated grimace, gaunt wrinkles and scraggly facial hair. No gameplay changes.

## Edit prompt

Use case: precise-object-edit. Edit this existing purple Hex ghost sprite for Pac-Chad. Redesign only the face into a feminine-presenting adult man wearing theatrical drag makeup, with believable ordinary human anatomy. Keep a SLIM face, but remove the extreme gauntness, deep creases, wrinkled hollow cheeks, bulging bloodshot eyes, giant downturned open mouth, yellow teeth, wispy curled mustache and pointed beard. Clean-shaven face, softly curved cheek contours, subtle male nose and modest jaw, normal rounded human chin with no block or ledge. Calm mildly unimpressed expression with NORMAL sized closed lips and relaxed eyes. Keep recognizable drag makeup: blue eyeshadow, dark winged eyeliner, lashes, pink lipstick and softly blended blush. Makeup should look worn by a human, not a grotesque mask. Keep purple messy top bun and blunt fringe, black ROUND glasses clearly distinct from red cat-eye glasses, lavender skin and small purple spectral tail. Same bold clean arcade illustration style. No muscular heroic jaw, no hollow skull-like face, no elongated witch chin. Keep whole head and wisp uncropped in clear margins, transparent RGBA background with actual alpha zero, no painted checkerboard or scenery, no text. This is only the purple character.

## Transparency prompt

Use case: background-extraction. Make the background TRANSPARENT. Cut out this purple-haired ghost character from the checkerboard background. Return the character alone on a transparent background, ready to overlay onto a dark game maze. Keep the art exactly as shown: natural clean-shaven human face, calm closed mouth, purple hair, round black glasses, blue and pink makeup and purple tail. This is a background removal task, not a new illustration. The final PNG must have real transparency (RGBA alpha=0 outside the character), not a picture of a checkerboard. Remove background from enclosed hair gaps too.

Final selected built-in output: `exec-30adb3a8-8abd-4ad0-b77d-a71ebf5d5b6a.png`. RGBA transparency verified before installation. No CLI generation or image manipulation used.
