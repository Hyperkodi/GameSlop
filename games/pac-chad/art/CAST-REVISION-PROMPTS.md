# Four-ghost cast revision

Built-in imagegen edits, 2026-09-07. Rook's previous updated sprite is unchanged. The other three final assets are installed at `../assets/hex.png`, `../assets/ivy.png`, and `../assets/riot.png`. Earlier versions are preserved here as `hex-original.png`, `ivy-original.png`, and `riot-original.png`.

| Character | Final design |
| --- | --- |
| Rook | Fuller-built masculine presentation, broad jaw, blue bob, dark goatee and septum ring. |
| Hex | Slim masculine presentation, narrow angular face, pointed goatee, purple bun and red cat-eye glasses. |
| Ivy | Average-build masculine presentation, squared jaw, trimmed green goatee, green undercut and silver jewelry. |
| Riot | Feminine presentation, smooth chin, soft face, rainbow space buns and red cat-eye glasses. |

These are head-and-wisp sprites, so build differences are expressed through face width, cheeks, chin and spectral-tail silhouette. The runtime uses their existing shared paths for gameplay, hero art and cast portraits. Enemy behavior and scoring have not changed.

## hex edit

Use case: precise-object-edit. Edit the attached existing hex Pac-Chad ghost sprite into an updated version of the SAME fictional adult woman cartoon ghost. Make her the SLIM, masculine-presenting member of the cast. Give her a distinctly long, narrow face, lean cheeks, angular cheekbones, a masculine squared chin, a stronger brow and a prominent dark-purple pointed GOATEE with a short mustache. Keep her lean, not plump. The face silhouette should clearly contrast with a round full-cheeked character. Preserve the tall vivid purple messy bun, blunt bangs, oversized red cat-eye librarian glasses with clear lenses and visible eyes, lavender ghost skin, and small purple spectral wisp. Give the wisp a slender elongated taper. Retain a confident mischievous expression. Keep the polished bold cartoon arcade style, thick dark outline, large readable features, near-frontal pose, and head with a tiny spectral tail rather than a full human body. Fill a square canvas with the entire silhouette and 5 percent clear margin, no cropping. Output the finished game sprite as a TRUE TRANSPARENT RGBA PNG. Background pixels must have alpha zero, including holes around the hair and tail. No background artwork, no text, no additional characters. Preserve the identity cues specified above.

### Final background extraction

Use case: background-extraction. Edit ONLY the background of this hex character sprite. Remove the entire white/light-gray checkerboard and replace it with TRUE transparent alpha pixels. Deliver an RGBA PNG with alpha=0 outside the isolated head. The checkerboard in the input is unwanted baked-in artwork, not transparency: it must disappear completely. Preserve the character pixel-for-pixel as much as possible, including its exact size, location, hair colors and silhouette, face proportions, facial hair if present, glasses if present, piercings, skin, and small ghost tail. Keep the square canvas. Do not change the character, add labels or draw a new checkerboard. Transparent background only.

## ivy edit

Use case: precise-object-edit. Edit the attached existing ivy Pac-Chad ghost sprite into an updated version of the SAME fictional adult woman cartoon ghost. Make her the AVERAGE-BUILD, masculine-presenting member of the cast. Give her a medium-width face, average cheek fullness, a pronounced masculine square jawline, strong brow, and a bold neatly trimmed dark-green GOATEE with a short mustache. Neither skinny nor heavy: facial proportions are between a narrow long face and a very full round face. Preserve the tall acid-green swept-up undercut with shaved side, silver septum ring, large hoop earrings, lavender skin and small lime-green ghost wisp. Keep the same playful confident expression; lips may close into a smirk so the goatee reads clearly. Keep the polished bold cartoon arcade style, thick dark outline, large readable features, near-frontal pose, and head with a tiny spectral tail rather than a full human body. Fill a square canvas with the entire silhouette and 5 percent clear margin, no cropping. Output the finished game sprite as a TRUE TRANSPARENT RGBA PNG. Background pixels must have alpha zero, including holes around the hair and tail. No background artwork, no text, no additional characters. Preserve the identity cues specified above.

### Final background extraction

Make the background TRANSPARENT. Cut out this green-haired ghost character from the checkerboard background. Return the character alone on a transparent background, ready to overlay onto a dark game maze. Keep the art exactly as shown. This is a background removal task, not a new illustration. The final PNG must have real transparency, not a picture of a checkerboard.

## riot edit

Use case: precise-object-edit. Edit the attached existing riot Pac-Chad ghost sprite into an updated version of the SAME fictional adult woman cartoon ghost. Keep her FEMININE, with the same soft cheeks, softly tapered jaw, expressive lashes, smooth chin with NO facial hair, smile and oversized red cat-eye glasses. Change ALL of her mint-green hair into clearly recognizable RAINBOW HAIR: broad saturated ribbons of red, orange, yellow, green, cyan, blue and purple flowing naturally through the fringe, side locks and two space buns. Keep the same distinctive two-bun silhouette, lavender face and teal ghost wisp. The rainbow should be unmistakable even at small sprite size, with broad color sections rather than tiny strands. Preserve her face and feminine presentation; change only the hair colors. Keep the polished bold cartoon arcade style, thick dark outline, large readable features, near-frontal pose, and head with a tiny spectral tail rather than a full human body. Fill a square canvas with the entire silhouette and 5 percent clear margin, no cropping. Output the finished game sprite as a TRUE TRANSPARENT RGBA PNG. Background pixels must have alpha zero, including holes around the hair and tail. No background artwork, no text, no additional characters. Preserve the identity cues specified above.

### Final background extraction

Use case: background-extraction. Edit ONLY the background of this riot character sprite. Remove the entire white/light-gray checkerboard and replace it with TRUE transparent alpha pixels. Deliver an RGBA PNG with alpha=0 outside the isolated head. The checkerboard in the input is unwanted baked-in artwork, not transparency: it must disappear completely. Preserve the character pixel-for-pixel as much as possible, including its exact size, location, hair colors and silhouette, face proportions, facial hair if present, glasses if present, piercings, skin, and small ghost tail. Keep the square canvas. Do not change the character, add labels or draw a new checkerboard. Transparent background only.

Only final RGBA outputs with transparent corners were installed. Some earlier imagegen outputs contained opaque checkerboards and were not used. The art review renders the installed assets at portrait and 51-pixel gameplay sizes.
