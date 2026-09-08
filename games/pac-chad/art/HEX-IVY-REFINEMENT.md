# Hex and Ivy refinement

Built-in imagegen edits, 2026-09-07. Installed assets: `../assets/hex.png` and `../assets/ivy.png`. Previous installed sprites are backed up as `hex-before-refinement.png` and `ivy-before-refinement.png`. Blue Rook and rainbow Riot were preserved unchanged.

Final design: gaunt purple Hex has round black glasses, theatrical blue eye makeup, pink blush and lipstick, sparse facial hair and a natural human chin. Green Ivy has tired eyes, sparse facial hair, a few small cheek blemishes and a natural human jawline. The initially exaggerated rectangular chins were rejected by the user and corrected before installation. Gameplay rules are unchanged.

## Initial edit prompts

### Hex

Use case: precise-object-edit. Edit target: the supplied existing Pac-Chad fictional adult ghost character sprite. Keep the same polished illustrated arcade style, thick dark outlines, lavender skin, near-frontal floating head with small spectral wisp, recognizable hair silhouette and color. Redesign the face as an awkward, scrawny cartoon antagonist rather than a handsome muscular hero: hollow cheeks, tired eyes with light under-eye bags, thin uneven lips, a REALLY BOXY flat-bottomed chin but NO chiseled superhero cheekbones, no handsome confident smirk. Slightly anxious irritated expression. Keep whole head and wisp visible, centered with clear margin. Asset for overlay on dark game maze, readable at 51 pixels. Deliver isolated sprite on a TRUE transparent background with real alpha, not a painted checkerboard. No text, scenery, border, or extra character. For purple Hex specifically: retain purple messy top bun and bangs. Change the red cat-eye glasses to clearly different oversized ROUND BLACK glasses with transparent lenses and visible eyes. Add theatrical DRAG MAKEUP: exaggerated painted high eyebrows, broad electric-blue eyeshadow, dramatic black winged eyeliner and false eyelashes, obvious rosy blush circles, overdrawn magenta lipstick. Keep a sparse small purple goatee, much less lush than the input, and a wispy uneven mustache. Long narrow face with a blunt rectangular box chin, somewhat gawky asymmetric facial proportions. The result should look like an eccentric cartoon drag performer, scrawny and awkward, not glamorous or heroic. Preserve purple ghost wisp.

### Ivy

Use case: precise-object-edit. Edit target: the supplied existing Pac-Chad fictional adult ghost character sprite. Keep the same polished illustrated arcade style, thick dark outlines, lavender skin, near-frontal floating head with small spectral wisp, recognizable hair silhouette and color. Redesign the face as an awkward, scrawny cartoon antagonist rather than a handsome muscular hero: hollow cheeks, tired eyes with light under-eye bags, thin uneven lips, a REALLY BOXY flat-bottomed chin but NO chiseled superhero cheekbones, no handsome confident smirk. Slightly anxious irritated expression. Keep whole head and wisp visible, centered with clear margin. Asset for overlay on dark game maze, readable at 51 pixels. Deliver isolated sprite on a TRUE transparent background with real alpha, not a painted checkerboard. No text, scenery, border, or extra character. For green Ivy specifically: keep bright acid-green swept undercut, shaved side, silver septum ring and hoop earrings. Medium-width face with softer slack cheeks and a blunt rectangular box chin, modest asymmetry, small hesitant mouth instead of swaggering smile. Replace dense groomed beard with sparse scraggly green goatee and thin uneven mustache. Add only a LITTLE acne: 3 or 4 small subdued reddish blemishes on the visible cheeks, no severe rash. Subdued eyelids and slight bags, ungainly proportions, no glamour makeup or sculpted muscular planes. Preserve lime-green ghost wisp.

## User-requested chin correction (both sprites)

Use case: precise-object-edit. Correct ONLY the lower jaw and chin anatomy in this cartoon adult ghost portrait. The chin in this input is unnaturally rectangular. Replace it with a believable HUMAN chin: modest width, naturally rounded corners, softly curved bottom, smooth continuous jaw contour from the cheeks into the chin. No projecting rectangular block, shelf, ledge, right-angle corners or flat plank at the bottom of the face. A thin human face, not a superhero jaw. Keep the same expression, facial features, hair, glasses if present, makeup if present, tiny acne spots if present, sparse facial hair, colors, jewelry and wisp. Sparse goatee follows the corrected natural chin. Keep illustrated arcade style and full isolated silhouette. Output real transparent RGBA PNG, alpha zero around character; no background, no checkerboard artwork. Main requirement: anatomically plausible human lower face, subtle natural chin.

## Final transparency pass (both sprites)

Use case: background-extraction. Make the background TRANSPARENT. Cut out this ghost character from the checkerboard background. Return the character alone on a transparent background, ready to overlay onto a dark game maze. Keep the art exactly as shown, including face, hair, makeup, glasses or piercings, blemishes and ghost tail. This is a background removal task, not a new illustration. The final PNG must have real transparency (RGBA alpha=0 outside the character), not a picture of a checkerboard. Remove background from enclosed gaps too. Preserve the corrected NATURAL rounded human chin exactly. Do not square it or add a rectangular shelf.

## Selected outputs

- Hex: `exec-d15368d9-1478-47fc-83fc-cd5fd43485d2.png`, RGBA, 1102 x 1427.
- Ivy: `exec-bc97b4c6-a95e-476d-aebd-8ba1e54accd1.png`, RGBA, 1224 x 1285.

Both outputs came from the built-in tool, not the CLI. Background alpha checked before installation. The cast review renders the installed sprites at portrait and 51-pixel sizes.
