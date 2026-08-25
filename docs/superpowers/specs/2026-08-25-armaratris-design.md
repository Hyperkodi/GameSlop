# Armaratris — Design Spec

**Date:** 2026-08-25
**Status:** Approved in chat (Ryan), pending spec review
**Location:** `d:\ClaudeCode\GameSlop\Armaratris\`

## 1. Purpose

A branded Tetris for the Armara token project ("Sovereign AI Operating System"), built as the first game of the GameSlop portal. It must:

1. Play as a complete, modern Tetris on desktop and mobile.
2. Carry the Armara identity (gold hourglass mark, marble/gold Greco-Roman look, Cinzel caps).
3. Be re-brandable for the next sponsor by adding a `skin/<name>/` folder — no code changes.
4. Run as a static folder (double-click `index.html`, or drop into an iframe). No build step, no dependencies.
5. Leave a clean seam for play-to-earn later: deterministic engine (seed + input log) and a game-over `postMessage` stub. No server, no tokens in v1.

## 2. File layout

```
Armaratris/
  index.html              shell: title, well, side panels, overlays, on-screen buttons
  css/game.css            layout; all colors/fonts come from CSS variables the skin sets
  js/engine.js            pure game logic, zero DOM — ES module, testable in Node
  js/renderer.js          canvas drawing: well, tiles, ghost, hold/next, watermark, marble ground
  js/input.js             keyboard (DAS/ARR) + touch (swipe/tap) + on-screen buttons → engine actions
  js/audio.js             Web Audio synthesized SFX, mute toggle
  js/skin.js              loads skin/<name>/skin.json, applies CSS vars, preloads logo
  js/main.js              wires modules: rAF loop, overlays, high score, postMessage stub
  skin/armara/skin.json   palette, fonts, per-tetromino tile tones, logo path, strings (source of truth)
  skin/armara/skin.js     same object as a classic script, for file:// (generated from skin.json)
  skin/armara/logo.png    copy of Hourglass.png (transparent PNG, 1254×1254)
  art/                    source posters, reference only — never loaded by the game
  tests/engine.test.js    node:test unit tests for engine.js
```

**Script loading:** Chrome blocks ES-module imports from `file://`, and double-click-to-open is a requirement, so the game uses **classic scripts** loaded in dependency order (`engine.js`, `audio.js`, `skin.js`, `renderer.js`, `input.js`, `main.js`). Each file attaches to one global namespace, `window.Armaratris`. `engine.js` ends with a guard — `if (typeof module !== "undefined") module.exports = { createEngine, ... }` — so Node tests `require()` it unchanged. `skin.json` is fetched with `fetch()`, which also fails on `file://` in Chrome; therefore `skin.js` first tries `fetch`, and on failure falls back to `skin/<name>/skin.js` — a tiny classic script that assigns the same object to `window.Armaratris.skins[name]`. The Armara skin ships both `skin.json` (canonical) and `skin.js` (generated copy, one line: `Armaratris.skins.armara = {...}`), and a comment in each says the JSON is the source of truth.

Skin selection: `?skin=<name>` query parameter, default `armara`. Unknown skin → fall back to `armara` and log a console warning.

## 3. Engine (`engine.js`)

Pure state machine. No DOM, no timers; the host calls `engine.tick(dtMs)` and dispatches actions.

### 3.1 Rules
- Well: 10 columns × 20 visible rows, plus 2 hidden rows above (22 total). Spawn at rows 0–1 (hidden), columns 3–6.
- Pieces: I, O, T, S, Z, J, L with **SRS** rotation states 0/R/2/L and standard SRS wall-kick tables (separate table for I; O never kicks).
- Randomizer: **7-bag** using a seeded PRNG (`mulberry32`). Seed from `?seed=` (integer) or `Date.now() >>> 0` at game start. Seed is stored on the engine and exposed.
- Gravity: guideline table by level (seconds per row): L1 1.000, L2 0.793, L3 0.618, L4 0.473, L5 0.355, L6 0.262, L7 0.190, L8 0.135, L9 0.094, L10 0.064, L11 0.043, L12 0.028, L13 0.018, L14 0.011, L15+ 0.007.
- Soft drop: 20× gravity while held, +1 point per cell moved.
- Hard drop: instant, +2 per cell, locks immediately.
- Lock delay: 500 ms; any successful move/rotate resets it, max 15 resets per piece; landing after the 15th reset locks on the next expiry.
- Hold: swap with hold slot; allowed once per piece (re-enabled after lock). First hold with empty slot spawns the next piece.
- Preview: next 3 pieces exposed.
- Ghost: engine exposes `ghostY()` = lowest valid row for the active piece.
- Line clear scoring: 1 line 100, 2 lines 300, 3 lines 500, 4 lines 800, all × level.
- Level: starts 1, +1 every 10 total lines cleared.
- Game over: a new piece cannot spawn without overlap (block-out), or a piece locks entirely within hidden rows (lock-out).

### 3.2 API
```js
const engine = createEngine({ seed, startLevel = 1 });
engine.dispatch(action)     // "left" | "right" | "rotateCW" | "rotateCCW" | "softDropOn" | "softDropOff" | "hardDrop" | "hold" | "pause" | "resume"
engine.tick(dtMs)           // advances gravity / lock timers; returns array of events
engine.state                // { board, active:{type,rot,x,y}, hold, holdUsed, queue:[3], score, lines, level, status:"ready"|"playing"|"paused"|"over", seed, inputLog }
engine.ghostY()
engine.reset(seed?)
```
Events returned by `tick`/`dispatch`: `{type:"move"}`, `{type:"rotate"}`, `{type:"lock"}`, `{type:"clear", lines:n}`, `{type:"level", level}`, `{type:"hold"}`, `{type:"gameover"}`.

### 3.3 Determinism / input log
- The engine advances only via `tick(dtMs)`. `main.js` drives it with a fixed timestep: an accumulator inside `requestAnimationFrame` calls `tick(1000/60)` zero or more times per frame. Because every tick is the same length, a game is fully described by `seed` + `inputLog`.
- Every dispatched action is appended to `state.inputLog` as `[tickIndex, action]`, where `tickIndex` is the number of ticks completed so far.
- Replay = `createEngine({seed})`, then for each tick index dispatch the logged actions for that index before calling `tick(1000/60)`. The determinism test in §10 does exactly this.
- `inputsHash`: FNV-1a 32-bit over `JSON.stringify(inputLog)`, computed on game over for the postMessage stub.

## 4. Skin (`skin.json`)

```json
{
  "name": "armara",
  "title": "ARMARATRIS",
  "tagline": "SOVEREIGN AI OPERATING SYSTEM",
  "logo": "logo.png",
  "fonts": {
    "display": "Cinzel",
    "body": "Cormorant Garamond",
    "googleFonts": "family=Cinzel:wght@400;700;900&family=Cormorant+Garamond:wght@400;600"
  },
  "palette": {
    "bg": "#0B0A0A", "bg2": "#151210", "marble": "#E9E2D3", "gold": "#C9A24A",
    "goldDeep": "#8A6A23", "bronze": "#7A5230", "ink": "#EFE8D8", "muted": "#9A8E78",
    "well": "#0E0D0C", "grid": "#1E1A15", "frame": "#C9A24A", "ghost": "#C9A24A"
  },
  "tiles": {
    "I": { "base": "#E9E2D3", "hi": "#FFFFFF", "lo": "#A99F8C" },
    "O": { "base": "#C9A24A", "hi": "#F1D890", "lo": "#7E6120" },
    "T": { "base": "#7A5230", "hi": "#B98A5E", "lo": "#3F2914" },
    "S": { "base": "#6E7F6A", "hi": "#A7B8A2", "lo": "#3B473A" },
    "Z": { "base": "#B76E5A", "hi": "#E7A48E", "lo": "#66392C" },
    "J": { "base": "#2B2622", "hi": "#6B5E52", "lo": "#000000", "edge": "#C9A24A" },
    "L": { "base": "#A8893E", "hi": "#E4C97C", "lo": "#5F4B1C" }
  },
  "watermarkAlpha": 0.06,
  "strings": {
    "hold": "HOLD", "next": "NEXT", "score": "SCORE", "level": "LEVEL", "lines": "LINES", "best": "BEST",
    "start": "PRESS ENTER OR TAP TO BEGIN", "paused": "PAUSED", "gameOver": "GAME OVER", "restart": "PLAY AGAIN"
  }
}
```
`skin.js` sets each palette key as `--c-<key>` and fonts as `--font-display` / `--font-body` on `:root`, injects the Google Fonts `<link>` (fails silently offline → serif fallbacks), and resolves `logo` relative to the skin folder. Tile tones are passed to the renderer as-is. The renderer builds the Greek-key frame as an inline SVG data URI using `palette.frame`, so the frame recolors per skin.

## 5. Renderer (`renderer.js`)

- One `<canvas>` for the well (logical 10×22, draws rows 2–21), one each for HOLD and NEXT (4×4 cells per piece, NEXT stacks 3).
- Device-pixel-ratio aware; cell size derived from available height (well fits viewport height minus chrome).
- Tile drawing: filled square `base`, 1-cell-wide inner bevel (`hi` top/left, `lo` bottom/right, ~12 % of cell), optional `edge` outline (used for J to keep the near-black tile readable), 1 px inset gap so tiles read as set stones. Ghost = `palette.ghost` outline at 45 % alpha, no fill.
- Well background: `palette.well`, faint grid lines `palette.grid`, hourglass logo centered at `watermarkAlpha`.
- Page ground: `palette.bg` with procedural marble veining drawn once to an offscreen canvas (low-frequency noise + a few Bezier veins at 4–6 % alpha), used as `body` background image. No texture file.
- Line clear animation: cleared rows flash `palette.marble` → collapse over 120 ms; engine already removed the rows, renderer animates from a snapshot. Respects `prefers-reduced-motion` (no flash, instant collapse).

## 6. Input (`input.js`)

- Keyboard: ← → move (DAS 170 ms, ARR 40 ms), ↑ / X rotate CW, Z / Ctrl rotate CCW, ↓ soft drop (hold), Space hard drop, C / Shift hold, P / Esc pause, Enter start/restart, M mute.
- Touch: horizontal swipe moves one column per ~cell-width of travel (drag-to-move), tap rotates CW, swipe down (fast) hard-drops, slow drag down soft-drops, swipe up holds. Four on-screen buttons on narrow viewports: ◀ ▶ ⟳ ⬇ (⬇ = hard drop; long-press ⬇ = soft drop).
- All inputs call `engine.dispatch(...)`; input.js knows nothing about rendering.

## 7. Audio (`audio.js`)

Web Audio, created on first user gesture. Six procedural sounds: move (short click), rotate (higher click), lock (thud), clear (rising two-note), tetris (four-note fanfare), gameover (descending). Mute toggle persisted in `localStorage["armaratris:muted"]`. No files.

## 8. Main (`main.js`)

- Parses `?skin` and `?seed`; loads skin; builds engine; starts a fixed-timestep loop (60 Hz accumulator inside `requestAnimationFrame`).
- Overlays: start ("PRESS ENTER OR TAP TO BEGIN"), paused, game over (score, best, PLAY AGAIN).
- High score: `localStorage["armaratris:<skin>:best"]`.
- On `gameover` event: update best, show overlay, and `window.parent.postMessage({v:1, type:"gameover", game:"armaratris", skin, score, lines, level, seed, inputsHash}, "*")` if `window.parent !== window`.
- Pauses automatically on `visibilitychange` hidden.

## 9. Layout

- Desktop (≥ 760 px wide): three columns — left panel (HOLD box, then SCORE / LEVEL / LINES / BEST), the well with the Greek-key frame, right panel (NEXT ×3, then the hourglass mark + ARMARATRIS wordmark + tagline). Title "ARMARATRIS" with the mark sits above the well.
- Mobile (< 760 px): stats strip on top (HOLD | SCORE·LEVEL·LINES | NEXT ×1), well fills remaining height, four buttons pinned at the bottom (safe-area aware).
- Fonts: Cinzel 700/900 for title, labels, score digits; Cormorant Garamond for tagline and overlay body. Fallback `Georgia, "Times New Roman", serif`.

## 10. Testing

- `tests/engine.test.js` (CommonJS, `require("../js/engine.js")`) with `node:test` + `node:assert` (run: `node --test tests/`):
  - 7-bag: first 14 pieces contain each type exactly twice.
  - Seeded PRNG: same seed → same first 50 pieces; different seed → different.
  - SRS: T-piece rotation at left wall kicks right; I-piece kick table cases; O rotation is a no-op.
  - Movement blocked by walls/floor/stack.
  - Line clear: fill row(s) → clear count, score by level, level increment at 10 lines.
  - Hard drop lands at `ghostY()` and scores 2/cell; soft drop scores 1/cell.
  - Hold: swaps, once per piece, re-enabled after lock.
  - Lock delay: resets on move up to 15 times, then locks.
  - Game over on block-out.
  - Determinism: run a scripted 200-tick game twice from the same seed and input log → identical `board`, `score`, `inputsHash`.
- Browser check: open `index.html` in Chrome desktop and a 390×844 device emulation; screenshot both for Ryan. Verify touch buttons, mute, pause, high score persistence, and that `?skin=nope` falls back.

## 11. Out of scope (v1)

Accounts, leaderboards, token payouts, server-side replay verification, multiplayer, T-spin / back-to-back / combo bonuses, custom key binding UI, additional skins.

## 12. Open items carried forward (not blocking)

- Play-to-earn: replace the `postMessage` stub with the portal SDK (signed session, epoch settlement) when the portal exists. The engine's seed + input log already supports server replay.
- Git: folder is not a repository; initialize when Ryan wants history.
