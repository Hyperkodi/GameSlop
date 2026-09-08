# CashCat artwork

Reference: the CashCat photograph supplied by the user in this conversation (seated cream / gray-brown cat with watery dark eyes).

Generated using the built-in image generation tool, with the user image as its reference. Original prompt:

> Extract the exact photographic CashCat from the supplied reference. Preserve the watery dark eyes, pale face, ear silhouette, seated pose, body, and paws. Remove the white background and ground shadow. One full-body cutout, centered with a narrow margin, intended for an 80–120 pixel game sprite and a larger landing-page image. Actual transparent alpha; no checkerboard, props, clothes, text, or redesign.

The generator returned an RGB image with a baked checkerboard. A second built-in edit requesting actual RGBA transparency returned another RGB image. The user then authorized local background removal. `remove-background.py` preserves the original in `cashcat-generated.png` and creates the finished RGBA sprite at `assets/cashcat.png`, using a silhouette-guided mask and edge cleanup. The pale ears and forehead receive an explicit outline to preserve fur that shares the checkerboard's color. The cutout was inspected against a dark background.

All cannon, hazard, particle and scrolling scenery graphics are original Canvas drawings in `js/renderer.mjs`. The Gameslop wordmark comes from the existing Pac-Chad game assets.
