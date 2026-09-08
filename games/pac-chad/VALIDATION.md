# Local validation, September 7, 2026

`npm.cmd --prefix games/pac-chad test`: 10 tests passed. Coverage includes connected maze layouts across 36 seeds/stages, safe spawn paths, turns and reversals, pellet accounting, combo resets, escalating power-pellet captures, both abilities, non-closing shortcuts, stage transitions, the five-minute limit, deterministic completed replay, forged scores, invalid evidence, and preview file boundaries.

`node games/pac-chad/tests/browser.mjs`: passed in isolated headless Chrome. Checked real keyboard controls, both abilities, pause/resume, fullscreen, a completed run validated from recorded inputs, personal-best persistence after reload, 390x844 touch portrait and 844x390 landscape layouts, swipe/direction-pad control, touch ability, and fullscreen after a swipe and orientation change. No browser JavaScript errors. Actual phone hardware and gamepad hardware remain untested.

The browser initially suppressed the toolbar's click after a touch swipe. Fullscreen now also handles the trusted touch release, deduplicates the resulting click, and ignores overlapping requests. The combined mobile gesture scenario passes after this fix.

The SDK test uses a mock parent. It verified ready/start/complete, the `pac-chad` slug and binding to the parent's run ID. It did not use real X credentials, send external scores, connect to a hosted database or establish official ranking eligibility.

Art inspected on the title page, cast guide, desktop maze and phone maze. All five PNGs have transparent corner pixels. A 1x contact sheet shows the supplied portraits at 51-pixel gameplay size. The mobile tile minimum is 38 pixels. Ghost portraits retain full opacity and their unique colors even while awaiting release; power mode uses an outline rather than obscuring faces.

Browser QA screenshots/report are in ignored `art/qa-*` paths. `art/cast-preview.png` and `art/website-preview.png` are shareable review images. Art prompts and built-in imagegen provenance are in `art/PROMPTS.md`.

Build fingerprint: regenerate `build-manifest.json` with `node games/pac-chad/integration/build-manifest.mjs`. It identifies these local runtime files; it does not prove that a remote client executed them honestly.

Test browsers and preview servers closed on completion. No commit, push or deployment was performed.

## Mouth-animation update

`node games/pac-chad/tests/chomp-browser.mjs` passes. The browser renders all four mouth poses during real movement, holds one pose during pause, returns to the closed pose when blocked, and resumes the mirrored animation after turning left. Mobile art loading, touch movement and pause/resume passed with zero browser errors. The 1254x1254 atlas is RGBA with transparent corners; upper-face registration keeps its eyes/hair steady. The contact sheet at `art/chomp-preview.png` uses the actual renderer at enlarged and 38-pixel mobile tile sizes.

Only presentation/assets changed; the scoring simulation and replay rules remain unchanged. The build manifest was regenerated. Temporary animation test servers closed; the user-requested preview at `http://127.0.0.1:8782/games/pac-chad/` remains running and returned HTTP 200 after the update.
