# Armaratris

Armara-branded Tetris. Static — open `index.html`.

- `?skin=<name>` selects `skin/<name>/` (default `armara`); `?seed=<n>` fixes the piece sequence.
- Controls: ← → move · ↑ / X rotate · Z rotate CCW · ↓ soft drop · Space hard drop · C / Shift hold · P pause · M mute. Touch: drag to move, tap to rotate, flick down to drop, swipe up to hold.
- Tests: `node --test` (run from `Armaratris/`; `node --test tests/` fails on Node 24 — pass no path)
- New sponsor: copy `skin/armara/` to `skin/<name>/`, edit `skin.json`, regenerate `skin.js` (command in `docs/superpowers/plans/2026-08-25-armaratris.md`, Task 1 step 5), replace `logo.png`.
- Play-to-earn hook: on game over the page posts `{v:1, type:"gameover", game, skin, score, lines, level, seed, inputsHash}` to its parent frame. The engine is deterministic (seed + input log), so a server can replay a game to verify a score.
