# Moon environment art

Built-in ImageGen generated the panorama and production sprites. Exact prompts are in `prompts.json`; refinement originals are retained as versioned siblings. The ground texture is a quiet crop of the same authored panorama.

`manifest.json` and `manifest.js` provide three tiles with 96-pixel exact shared overlaps. `seam-verification.json` records zero pixel differences. This is one finite panorama, with no arbitrary last-to-first wrap. Ground repeats mirror the same source edge.

`assets` records PNG sizes, solid alpha bounds, ground-contact anchors and traced platform walking surfaces. Preserve aspect ratios. Roots, foundations and rock bases extend beneath the terrain and draw before terrain. Do not replace source contours with horizontal guide lines. The game renderer supplies contact shadows and movement effects separately.

All generated sprite outputs were inspected, including actual alpha values. The image preview may reveal RGB color stored underneath zero alpha; those invisible pixels do not represent a rendered halo. PNG alpha is preserved without background removal scripts.

The campaign mechanics agent aligned collision profiles to the final mushroom, snowbank, horizontal boardwalk and lunar shelf surfaces. The production scripts and source records are in `artifacts/bitdog/campaign-art/`.
