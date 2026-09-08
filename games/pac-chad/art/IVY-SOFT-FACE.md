# Ivy soft-face revision

Built-in imagegen edit, 2026-09-07. Final asset: `../assets/ivy.png`. Previous sprite backed up as `ivy-before-soft-face.png`. The other three ghosts are unchanged.

Ivy now has a soft clean-shaven human face, subtle feminine makeup, green undercut, silver jewelry and light acne. Removed the gaunt expression and scraggly facial hair. No gameplay changes.

## Edit prompt

Use case: precise-object-edit. Edit ONLY green Ivy's face in this existing arcade ghost sprite. The new character should look like a feminine-presenting adult man with ordinary, believable human proportions. Soft oval face of average width, gently rounded cheeks, modest natural chin, subtle masculine nose and jaw softened by light feminine styling. Clean-shaven: remove the entire scraggly green beard and mustache. Remove gaunt hollow cheeks, forehead wrinkles, drooping exhausted eyelids and dark under-eye bags. Give gently shaped eyebrows, delicate eyeliner and lashes, understated pink lip tint, a small closed-mouth mildly annoyed expression. Do not make a macho handsome superhero or an elderly exhausted face; no exaggerated block chin, no glamour-model bone structure, no theatrical drag makeup. Preserve only 3 or 4 subtle small acne spots on cheeks. Keep exactly the recognizable acid-green swept undercut and shaved side, silver septum ring and silver hoop earrings, lavender ghost skin, lime spectral wisp, bold dark outline and polished cartoon arcade shading. Single whole floating head and short wisp, no body, centered and uncropped. Actual transparent RGBA PNG background with alpha zero, not a painted checkerboard. No text or scenery. This is the green character only.

## Transparency prompt

Use case: background-extraction. Make the background TRANSPARENT. Cut out this green-haired ghost character from the checkerboard background. Return the character alone on a transparent background, ready to overlay onto a dark game maze. Keep the art exactly as shown: clean-shaven soft human face, green hair, silver jewelry, tiny acne marks and green tail. This is a background removal task, not a new illustration. The final PNG must have real transparency (RGBA alpha=0 outside the character), not a picture of a checkerboard. Remove background from enclosed earring and hair gaps too.

Final selected built-in output: `exec-8f777550-b789-41a6-bed5-79cb27750d02.png`. RGBA transparency verified before installation. No CLI generation or image manipulation used.
