# Armaratris Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Armaratris — a complete, Armara-branded Tetris that runs as a static folder, is re-skinnable by adding a `skin/<name>/` folder, and has a deterministic engine ready for later play-to-earn replay verification.

**Architecture:** Six classic-script modules attach to one global namespace `window.Armaratris`: a pure, DOM-free engine (`engine.js`, also `require()`-able in Node for tests), a canvas renderer, an input layer (keyboard/touch/buttons), a Web Audio SFX module, a skin loader that turns `skin.json` into CSS variables, and `main.js` that wires them with a fixed 60 Hz loop. The Armara skin is data only: `skin/armara/skin.json` (+ a generated `skin.js` twin for `file://`).

**Tech Stack:** Vanilla JavaScript (ES2020, no bundler, no dependencies), HTML5 Canvas 2D, Web Audio API, CSS custom properties, Node ≥ 18 built-in `node:test` for engine tests, headless Chrome for screenshots.

**Spec:** `docs/superpowers/specs/2026-08-25-armaratris-design.md`

## Global Constraints

- Project root for this game: `d:\ClaudeCode\GameSlop\Armaratris\`. All paths below are relative to it unless they start with `docs/`.
- No build step, no npm dependencies, no `package.json` needed. Everything must run by double-clicking `index.html` in Chrome (`file://`).
- Classic scripts only (`<script src>`), loaded in this order: `engine.js`, `audio.js`, `skin.js`, `renderer.js`, `input.js`, `main.js`. Every module wraps itself in `(function (global) { ... })(typeof window !== "undefined" ? window : globalThis);` and attaches to `global.Armaratris`.
- `engine.js` ends with `if (typeof module !== "undefined" && module.exports) module.exports = {...}` so tests can `require("../js/engine.js")`.
- Tests: `node --test tests/` from the `Armaratris` folder. Node's built-in runner only — no Jest, no installs.
- Skin is the only place brand values live. No hex colors, font names, or brand strings in JS/CSS other than fallbacks (`Georgia, "Times New Roman", serif`).
- Well: 10 columns × 22 rows (rows 0–1 hidden). Spawn at `x=3, y=0, rot=0`. SRS rotation + standard wall kicks. 7-bag on `mulberry32(seed)`. Lock delay 500 ms, max 15 move-resets. Scoring 100/300/500/800 × level; soft drop +1/cell; hard drop +2/cell; level = startLevel + floor(lines/10). Gravity ms per row by level: `[1000, 793, 618, 473, 355, 262, 190, 135, 94, 64, 43, 28, 18, 11, 7]` (level 15+ uses 7).
- Fixed timestep: `main.js` calls `engine.tick(1000/60)` from an accumulator; a game is fully described by `seed + inputLog`.
- localStorage keys: `armaratris:<skin>:best`, `armaratris:muted`.
- Game-over bridge: `window.parent.postMessage({v:1, type:"gameover", game:"armaratris", skin, score, lines, level, seed, inputsHash}, "*")` only when `window.parent !== window`.
- **Git:** the folder is not a repository and Ryan has not asked for one, so there are no commit steps. If a repo is initialized later, commit at the end of every task with the message given in that task's final step.
- Respect `prefers-reduced-motion` (no flash animation) and keyboard focus visibility.

---

## File map

| File | Responsibility |
|---|---|
| `index.html` | DOM shell: title, panels, well canvas, overlays, touch buttons; loads scripts in order |
| `css/game.css` | Layout (desktop 3-column, mobile strip + buttons), all colors/fonts via `--c-*` / `--font-*` variables |
| `js/engine.js` | Pure game state machine + PRNG/bag/hash helpers; test helpers `setBoard`/`setActive` |
| `js/audio.js` | `createAudio()` → `{play(name), unlock(), muted, toggle()}` |
| `js/skin.js` | `loadSkin(name)` → fetch JSON (fallback `skin.js`) → apply CSS vars, fonts, strings, frame, logo |
| `js/renderer.js` | `createRenderer({skin, wellCanvas, holdCanvas, nextCanvas, wrapEl})` → `{resize(), draw(state), drawHold(type), drawNext(queue, count), flash(rows, board), paintGround()}` |
| `js/input.js` | `createInput({engine, wellEl, touchEl, onAction})` → `{update(dt), destroy()}` |
| `js/main.js` | boot: parse query, load skin, create engine/renderer/audio/input, loop, overlays, best score, postMessage |
| `skin/armara/skin.json` | Armara brand data (source of truth) |
| `skin/armara/skin.js` | Same object as a classic script for `file://` |
| `skin/armara/logo.png` | Hourglass mark |
| `art/*.jpg,*.png` | Reference posters, not loaded |
| `tests/engine.test.js` | Engine unit tests |
| `tests/skin.test.js` | skin.json validity + skin.js sync |

---

### Task 1: Scaffold folders and the Armara skin

**Files:**
- Create: `skin/armara/skin.json`, `skin/armara/skin.js`, `skin/armara/logo.png` (copy), `tests/skin.test.js`, `art/` (move the three posters + original Hourglass.png here)

**Interfaces:**
- Produces: the skin object shape consumed by `skin.js` (Task 4) and `renderer.js` (Task 5): `{name, title, tagline, logo, fonts:{display, body, googleFonts}, palette:{bg,bg2,marble,gold,goldDeep,bronze,ink,muted,well,grid,frame,ghost}, tiles:{I,O,T,S,Z,J,L → {base,hi,lo,edge?}}, watermarkAlpha, strings:{hold,next,score,level,lines,best,start,paused,resume,gameOver,restart}}`.

- [ ] **Step 1: Move the artwork and create folders**

Run from `d:\ClaudeCode\GameSlop\Armaratris` (Bash):
```bash
mkdir -p art skin/armara js css tests
mv photo_2026-08-09_05-07-24.jpg photo_2026-08-10_06-40-53.jpg photo_2026-08-10_18-18-29.jpg art/
cp Hourglass.png skin/armara/logo.png && mv Hourglass.png art/
ls -R
```
Expected: `art/` has 4 files, `skin/armara/logo.png` exists, folder root has only `art css js skin tests`.

- [ ] **Step 2: Write the failing skin tests**

Create `tests/skin.test.js`:
```js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SKIN_DIR = path.join(__dirname, "..", "skin", "armara");

function readJson() {
  return JSON.parse(fs.readFileSync(path.join(SKIN_DIR, "skin.json"), "utf8"));
}

test("skin.json has every key the game reads", () => {
  const s = readJson();
  assert.equal(s.name, "armara");
  assert.ok(s.title && s.tagline && s.logo);
  assert.ok(s.fonts.display && s.fonts.body && s.fonts.googleFonts);
  for (const k of ["bg", "bg2", "marble", "gold", "goldDeep", "bronze", "ink", "muted", "well", "grid", "frame", "ghost"]) {
    assert.match(s.palette[k], /^#[0-9A-Fa-f]{6}$/, `palette.${k}`);
  }
  for (const t of ["I", "O", "T", "S", "Z", "J", "L"]) {
    for (const k of ["base", "hi", "lo"]) assert.match(s.tiles[t][k], /^#[0-9A-Fa-f]{6}$/, `tiles.${t}.${k}`);
  }
  assert.ok(s.watermarkAlpha > 0 && s.watermarkAlpha < 0.2);
  for (const k of ["hold", "next", "score", "level", "lines", "best", "start", "paused", "resume", "gameOver", "restart"]) {
    assert.equal(typeof s.strings[k], "string", `strings.${k}`);
  }
  assert.ok(fs.existsSync(path.join(SKIN_DIR, s.logo)), "logo file exists");
});

test("skin.js mirrors skin.json exactly", () => {
  const json = readJson();
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(SKIN_DIR, "skin.js"), "utf8"), sandbox);
  assert.deepEqual(sandbox.window.Armaratris.skins.armara, json);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test tests/`
Expected: 2 failing tests (ENOENT for skin.json).

- [ ] **Step 4: Write skin.json**

Create `skin/armara/skin.json`:
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
    "bg": "#0B0A0A",
    "bg2": "#151210",
    "marble": "#E9E2D3",
    "gold": "#C9A24A",
    "goldDeep": "#8A6A23",
    "bronze": "#7A5230",
    "ink": "#EFE8D8",
    "muted": "#9A8E78",
    "well": "#0E0D0C",
    "grid": "#1E1A15",
    "frame": "#C9A24A",
    "ghost": "#C9A24A"
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
    "hold": "HOLD",
    "next": "NEXT",
    "score": "SCORE",
    "level": "LEVEL",
    "lines": "LINES",
    "best": "BEST",
    "start": "PRESS ENTER OR TAP TO BEGIN",
    "paused": "PAUSED",
    "resume": "RESUME",
    "gameOver": "GAME OVER",
    "restart": "PLAY AGAIN"
  }
}
```

- [ ] **Step 5: Generate skin.js from skin.json**

Run (Bash, from `Armaratris`):
```bash
node -e '
const fs=require("fs");
const j=fs.readFileSync("skin/armara/skin.json","utf8");
fs.writeFileSync("skin/armara/skin.js",
"// GENERATED from skin.json (source of truth). Regenerate with the command in docs/superpowers/plans/2026-08-25-armaratris.md Task 1.\n"+
"window.Armaratris = window.Armaratris || {};\n"+
"window.Armaratris.skins = window.Armaratris.skins || {};\n"+
"window.Armaratris.skins.armara = "+j.trim()+";\n");
'
head -3 skin/armara/skin.js
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `node --test tests/`
Expected: 2 passing.

- [ ] **Step 7: (If git) commit**

`git add Armaratris && git commit -m "feat(armaratris): scaffold folders and Armara skin data"`

---

### Task 2: Engine core — pieces, PRNG, bag, board, movement, rotation

**Files:**
- Create: `js/engine.js`, `tests/engine.test.js`

**Interfaces:**
- Produces (used by Tasks 3, 5, 7, 8):
  - `Armaratris.COLS = 10`, `Armaratris.ROWS = 22`, `Armaratris.HIDDEN_ROWS = 2`, `Armaratris.TYPES`, `Armaratris.SHAPES[type][rot] → [[dx,dy],...]`
  - `Armaratris.mulberry32(seed) → () => number in [0,1)`
  - `Armaratris.sequence(seed, n) → type[]` (the first n bag draws for a seed)
  - `Armaratris.fnv1a(str) → 8-char hex`
  - `Armaratris.createEngine({seed?, startLevel?}) → engine` with `engine.state`, `engine.dispatch(action) → events[]`, `engine.ghostY() → number`, `engine.reset(seed?)`, `engine.setBoard(rows)`, `engine.setActive(piece)`, `engine.hash()`. `engine.tick(dt)` is added in Task 3 (this task ships a stub returning `[]`).
  - Actions: `"start" | "pause" | "resume" | "left" | "right" | "rotateCW" | "rotateCCW" | "softDropOn" | "softDropOff" | "hardDrop" | "hold"` (drop/hold/soft-drop implemented in Task 3).
  - `state`: `{board: (type|null)[22][10], active: {type, rot, x, y} | null, hold: type|null, holdUsed: bool, queue: type[3], score, lines, level, status: "ready"|"playing"|"paused"|"over", seed, inputLog: [tick, action][], tick}`

- [ ] **Step 1: Write the failing tests**

Create `tests/engine.test.js`:
```js
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../js/engine.js");

test("mulberry32 is deterministic per seed", () => {
  const a = E.mulberry32(123), b = E.mulberry32(123), c = E.mulberry32(124);
  const va = [a(), a(), a(), a(), a()], vb = [b(), b(), b(), b(), b()], vc = [c(), c(), c(), c(), c()];
  assert.deepEqual(va, vb);
  assert.notDeepEqual(va, vc);
  for (const v of va) assert.ok(v >= 0 && v < 1);
});

test("7-bag: first 14 draws contain each type exactly twice", () => {
  const seq = E.sequence(7, 14);
  for (const t of E.TYPES) assert.equal(seq.filter((x) => x === t).length, 2, t);
});

test("sequence is stable for a seed and differs across seeds", () => {
  assert.deepEqual(E.sequence(42, 50), E.sequence(42, 50));
  assert.notDeepEqual(E.sequence(42, 50), E.sequence(43, 50));
});

test("new engine is ready with active + 3 queued from the seed sequence", () => {
  const e = E.createEngine({ seed: 42 });
  assert.equal(e.state.status, "ready");
  assert.equal(e.state.seed, 42);
  const seq = E.sequence(42, 4);
  assert.equal(e.state.active.type, seq[0]);
  assert.deepEqual(e.state.queue, seq.slice(1));
  assert.deepEqual(e.state.active, { type: seq[0], rot: 0, x: 3, y: 0 });
  assert.equal(e.state.board.length, E.ROWS);
  assert.equal(e.state.board[0].length, E.COLS);
});

test("start moves status to playing and actions are logged with the tick index", () => {
  const e = E.createEngine({ seed: 1 });
  e.dispatch("start");
  assert.equal(e.state.status, "playing");
  e.dispatch("left");
  assert.deepEqual(e.state.inputLog, [[0, "start"], [0, "left"]]);
});

test("movement is ignored unless playing", () => {
  const e = E.createEngine({ seed: 1 });
  e.setActive({ type: "O", rot: 0, x: 3, y: 5 });
  assert.deepEqual(e.dispatch("left"), []);
  assert.equal(e.state.active.x, 3);
});

test("left/right move one column and are blocked by walls", () => {
  const e = E.createEngine({ seed: 1 });
  e.dispatch("start");
  e.setActive({ type: "O", rot: 0, x: 1, y: 5 }); // O occupies cols x+1, x+2 → cols 2,3
  assert.deepEqual(e.dispatch("left"), [{ type: "move" }]); // cols 1,2
  assert.equal(e.state.active.x, 0);
  assert.deepEqual(e.dispatch("left"), [{ type: "move" }]); // cols 0,1 — still inside
  assert.equal(e.state.active.x, -1);
  assert.deepEqual(e.dispatch("left"), []); // x=-2 would use col -1 → blocked
  assert.equal(e.state.active.x, -1);
  e.setActive({ type: "O", rot: 0, x: 7, y: 5 }); // cols 8,9
  assert.deepEqual(e.dispatch("right"), []);
  assert.equal(e.state.active.x, 7);
});

test("movement is blocked by the stack", () => {
  const e = E.createEngine({ seed: 1 });
  e.dispatch("start");
  const rows = new Array(E.ROWS).fill("..........");
  rows[5] = "...X......"; // col 3, row 5
  e.setBoard(rows);
  e.setActive({ type: "O", rot: 0, x: 3, y: 4 }); // cols 4,5 rows 4,5
  assert.deepEqual(e.dispatch("left"), []); // would put col 3 row 5 into X
  assert.equal(e.state.active.x, 3);
});

test("SRS: T in state R against the left wall kicks right when rotating CW", () => {
  const e = E.createEngine({ seed: 1 });
  e.dispatch("start");
  e.setActive({ type: "T", rot: 1, x: -1, y: 5 }); // R state cells: (1,0)(1,1)(2,1)(1,2) → cols 0,0,1,0
  assert.deepEqual(e.dispatch("rotateCW"), [{ type: "rotate" }]);
  assert.equal(e.state.active.rot, 2);
  assert.equal(e.state.active.x, 0);
  assert.equal(e.state.active.y, 5);
});

test("SRS: vertical I against the left wall kicks to x=0 when rotating CW", () => {
  const e = E.createEngine({ seed: 1 });
  e.dispatch("start");
  e.setActive({ type: "I", rot: 1, x: -2, y: 5 }); // R state cells at dx=2 → col 0
  assert.deepEqual(e.dispatch("rotateCW"), [{ type: "rotate" }]);
  assert.equal(e.state.active.rot, 2);
  assert.equal(e.state.active.x, 0);
});

test("SRS: rotation is refused when no kick fits", () => {
  const e = E.createEngine({ seed: 1 });
  e.dispatch("start");
  const rows = new Array(E.ROWS).fill("XXXXXXXXXX");
  rows[5] = "....X.X..."; // leave col 5 free in row 5
  rows[6] = "....X.X..."; // and row 6 → a 1-wide vertical slot
  rows[7] = "....X.X...";
  rows[4] = "....X.X...";
  e.setBoard(rows);
  e.setActive({ type: "I", rot: 1, x: 3, y: 4 }); // vertical I in the slot (col 5), rows 4–7
  assert.deepEqual(e.dispatch("rotateCW"), []);
  assert.equal(e.state.active.rot, 1);
  assert.equal(e.state.active.x, 3);
});

test("O never rotates", () => {
  const e = E.createEngine({ seed: 1 });
  e.dispatch("start");
  e.setActive({ type: "O", rot: 0, x: 3, y: 5 });
  assert.deepEqual(e.dispatch("rotateCW"), []);
  assert.deepEqual(e.dispatch("rotateCCW"), []);
  assert.equal(e.state.active.rot, 0);
});

test("rotateCCW goes 0 → L(3)", () => {
  const e = E.createEngine({ seed: 1 });
  e.dispatch("start");
  e.setActive({ type: "T", rot: 0, x: 3, y: 5 });
  e.dispatch("rotateCCW");
  assert.equal(e.state.active.rot, 3);
});

test("ghostY is the lowest row the active piece can occupy", () => {
  const e = E.createEngine({ seed: 1 });
  e.dispatch("start");
  e.setActive({ type: "T", rot: 0, x: 3, y: 0 }); // T rot 0 uses dy 0 and 1
  assert.equal(e.ghostY(), E.ROWS - 2); // 20
  const rows = new Array(E.ROWS).fill("..........");
  rows[10] = "....X.....";
  e.setBoard(rows);
  assert.equal(e.ghostY(), 8); // T row y+1 would hit row 10 at col 4 when y=9
});

test("fnv1a is stable", () => {
  assert.equal(E.fnv1a(""), "811c9dc5");
  assert.equal(E.fnv1a("a"), "e40c292c");
  assert.equal(E.fnv1a("abc").length, 8);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/`
Expected: engine tests fail with `Cannot find module '../js/engine.js'`; the 2 skin tests still pass.

- [ ] **Step 3: Write engine.js (core)**

Create `js/engine.js`:
```js
/* Armaratris engine — pure game logic. No DOM, no timers.
   Classic script that attaches to window.Armaratris, plus a CommonJS export for Node tests. */
(function (global) {
  "use strict";

  const COLS = 10;
  const ROWS = 22;          // 2 hidden rows on top + 20 visible
  const HIDDEN_ROWS = 2;
  const TYPES = ["I", "O", "T", "S", "Z", "J", "L"];
  const ROT_NAMES = "0R2L";
  const SPAWN = { x: 3, y: 0, rot: 0 };
  const LOCK_DELAY_MS = 500;
  const MAX_LOCK_RESETS = 15;
  const SOFT_DROP_FACTOR = 20;
  const QUEUE_SIZE = 3;
  const GRAVITY_MS = [1000, 793, 618, 473, 355, 262, 190, 135, 94, 64, 43, 28, 18, 11, 7];
  const LINE_SCORES = [0, 100, 300, 500, 800];

  // SRS shapes: [dx, dy] offsets per rotation state 0, R, 2, L. y grows downward.
  const SHAPES = {
    I: [[[0, 1], [1, 1], [2, 1], [3, 1]], [[2, 0], [2, 1], [2, 2], [2, 3]], [[0, 2], [1, 2], [2, 2], [3, 2]], [[1, 0], [1, 1], [1, 2], [1, 3]]],
    O: [[[1, 0], [2, 0], [1, 1], [2, 1]], [[1, 0], [2, 0], [1, 1], [2, 1]], [[1, 0], [2, 0], [1, 1], [2, 1]], [[1, 0], [2, 0], [1, 1], [2, 1]]],
    T: [[[1, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [1, 1], [2, 1], [1, 2]], [[0, 1], [1, 1], [2, 1], [1, 2]], [[1, 0], [0, 1], [1, 1], [1, 2]]],
    S: [[[1, 0], [2, 0], [0, 1], [1, 1]], [[1, 0], [1, 1], [2, 1], [2, 2]], [[1, 1], [2, 1], [0, 2], [1, 2]], [[0, 0], [0, 1], [1, 1], [1, 2]]],
    Z: [[[0, 0], [1, 0], [1, 1], [2, 1]], [[2, 0], [1, 1], [2, 1], [1, 2]], [[0, 1], [1, 1], [1, 2], [2, 2]], [[1, 0], [0, 1], [1, 1], [0, 2]]],
    J: [[[0, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [2, 0], [1, 1], [1, 2]], [[0, 1], [1, 1], [2, 1], [2, 2]], [[1, 0], [1, 1], [0, 2], [1, 2]]],
    L: [[[2, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [1, 1], [1, 2], [2, 2]], [[0, 1], [1, 1], [2, 1], [0, 2]], [[0, 0], [1, 0], [1, 1], [1, 2]]],
  };

  // SRS wall kicks, already converted to y-down ([dx, dy]). Key = fromState + toState using "0R2L".
  const KICKS = {
    JLSTZ: {
      "0R": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
      "R0": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
      "R2": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
      "2R": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
      "2L": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
      "L2": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
      "L0": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
      "0L": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    },
    I: {
      "0R": [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
      "R0": [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
      "R2": [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
      "2R": [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
      "2L": [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
      "L2": [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
      "L0": [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
      "0L": [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
    },
  };

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function createBag(rng) {
    let bag = [];
    return function next() {
      if (bag.length === 0) {
        bag = TYPES.slice();
        for (let i = bag.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          const tmp = bag[i]; bag[i] = bag[j]; bag[j] = tmp;
        }
      }
      return bag.pop();
    };
  }

  function sequence(seed, n) {
    const next = createBag(mulberry32(seed));
    const out = [];
    for (let i = 0; i < n; i++) out.push(next());
    return out;
  }

  function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return ("0000000" + h.toString(16)).slice(-8);
  }

  function gravityMs(level) {
    return GRAVITY_MS[Math.min(Math.max(level, 1), GRAVITY_MS.length) - 1];
  }

  function emptyBoard() {
    const b = [];
    for (let y = 0; y < ROWS; y++) b.push(new Array(COLS).fill(null));
    return b;
  }

  function cellsOf(piece) {
    return SHAPES[piece.type][piece.rot].map(function (d) { return [piece.x + d[0], piece.y + d[1]]; });
  }

  function createEngine(opts) {
    opts = opts || {};
    const startLevel = opts.startLevel || 1;

    const state = {
      board: emptyBoard(), active: null, hold: null, holdUsed: false, queue: [],
      score: 0, lines: 0, level: startLevel, status: "ready", seed: 0, inputLog: [], tick: 0,
    };
    let nextFromBag = null;
    let gravityAcc = 0, lockTimer = 0, lockResets = 0, softDrop = false;

    function fits(piece) {
      const cells = cellsOf(piece);
      for (let i = 0; i < cells.length; i++) {
        const x = cells[i][0], y = cells[i][1];
        if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return false;
        if (state.board[y][x] !== null) return false;
      }
      return true;
    }

    function shifted(piece, dx, dy) {
      return { type: piece.type, rot: piece.rot, x: piece.x + dx, y: piece.y + dy };
    }

    function resetPieceTimers() {
      gravityAcc = 0; lockTimer = 0; lockResets = 0;
    }

    function gameOver(events) {
      state.status = "over";
      events.push({ type: "gameover" });
    }

    function spawn(events) {
      const type = state.queue.shift();
      state.queue.push(nextFromBag());
      state.active = { type: type, rot: SPAWN.rot, x: SPAWN.x, y: SPAWN.y };
      resetPieceTimers();
      if (!fits(state.active)) gameOver(events); // block-out
    }

    function reset(seed) {
      if (seed === undefined) seed = opts.seed === undefined ? (Date.now() >>> 0) : opts.seed;
      state.seed = seed >>> 0;
      nextFromBag = createBag(mulberry32(state.seed));
      state.board = emptyBoard();
      state.hold = null; state.holdUsed = false;
      state.queue = [];
      for (let i = 0; i < QUEUE_SIZE + 1; i++) state.queue.push(nextFromBag());
      state.score = 0; state.lines = 0; state.level = startLevel;
      state.status = "ready"; state.inputLog = []; state.tick = 0;
      softDrop = false;
      spawn([]);
    }

    function onPlayerMoved() {
      if (lockResets < MAX_LOCK_RESETS) { lockTimer = 0; lockResets++; }
    }

    function tryMove(dx, dy) {
      const p = shifted(state.active, dx, dy);
      if (!fits(p)) return false;
      state.active = p;
      onPlayerMoved();
      return true;
    }

    function tryRotate(dir) {
      const a = state.active;
      if (a.type === "O") return false;
      const from = a.rot, to = (a.rot + dir + 4) % 4;
      const table = (a.type === "I" ? KICKS.I : KICKS.JLSTZ)[ROT_NAMES[from] + ROT_NAMES[to]];
      for (let i = 0; i < table.length; i++) {
        const cand = { type: a.type, rot: to, x: a.x + table[i][0], y: a.y + table[i][1] };
        if (fits(cand)) { state.active = cand; onPlayerMoved(); return true; }
      }
      return false;
    }

    function ghostY() {
      let y = state.active.y;
      while (fits(shifted(state.active, 0, y - state.active.y + 1))) y++;
      return y;
    }

    // ---- Task 3 fills these in ----
    function lock() { return []; }
    function doHold() { return []; }
    function hardDrop() { return []; }
    function tick() { return []; }

    function dispatch(action) {
      state.inputLog.push([state.tick, action]);
      const events = [];
      if (action === "start") { if (state.status === "ready") state.status = "playing"; return events; }
      if (action === "pause") { if (state.status === "playing") state.status = "paused"; return events; }
      if (action === "resume") { if (state.status === "paused") state.status = "playing"; return events; }
      if (state.status !== "playing" || !state.active) return events;
      switch (action) {
        case "left": if (tryMove(-1, 0)) events.push({ type: "move" }); break;
        case "right": if (tryMove(1, 0)) events.push({ type: "move" }); break;
        case "rotateCW": if (tryRotate(1)) events.push({ type: "rotate" }); break;
        case "rotateCCW": if (tryRotate(-1)) events.push({ type: "rotate" }); break;
        case "softDropOn": softDrop = true; break;
        case "softDropOff": softDrop = false; break;
        case "hardDrop": Array.prototype.push.apply(events, hardDrop()); break;
        case "hold": Array.prototype.push.apply(events, doHold()); break;
        default: break;
      }
      return events;
    }

    // Test/replay helpers. rows: array of strings ('.' empty, letter = tile type), bottom-aligned if fewer than ROWS.
    function setBoard(rows) {
      const b = emptyBoard();
      const offset = ROWS - rows.length;
      for (let i = 0; i < rows.length; i++) {
        for (let x = 0; x < COLS; x++) {
          const ch = rows[i][x];
          b[offset + i][x] = ch && ch !== "." ? ch : null;
        }
      }
      state.board = b;
    }
    function setActive(piece) {
      state.active = { type: piece.type, rot: piece.rot || 0, x: piece.x, y: piece.y };
      resetPieceTimers();
    }
    function hash() { return fnv1a(JSON.stringify(state.inputLog)); }

    reset(opts.seed);

    return { state: state, dispatch: dispatch, tick: tick, ghostY: ghostY, reset: reset, setBoard: setBoard, setActive: setActive, hash: hash };
  }

  const api = {
    COLS: COLS, ROWS: ROWS, HIDDEN_ROWS: HIDDEN_ROWS, TYPES: TYPES, SHAPES: SHAPES, KICKS: KICKS,
    GRAVITY_MS: GRAVITY_MS, LINE_SCORES: LINE_SCORES, LOCK_DELAY_MS: LOCK_DELAY_MS, MAX_LOCK_RESETS: MAX_LOCK_RESETS,
    mulberry32: mulberry32, createBag: createBag, sequence: sequence, fnv1a: fnv1a, gravityMs: gravityMs, cellsOf: cellsOf,
    createEngine: createEngine,
  };
  global.Armaratris = global.Armaratris || {};
  Object.assign(global.Armaratris, api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
```

Note on the "left/right blocked by walls" test: the O shape lives in columns `x+1` and `x+2` of its box, so `x=-1` is legal (columns 0 and 1) and `x=-2` is not. The test encodes exactly that.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/`
Expected: all engine + skin tests pass (16 tests). If the `fnv1a("a")` expectation fails, verify against the reference: FNV-1a 32-bit of "a" is `0xe40c292c`.

- [ ] **Step 5: (If git) commit**

`git commit -am "feat(armaratris): engine core — SRS pieces, seeded 7-bag, movement, rotation"`

---

### Task 3: Engine timing and scoring — gravity, lock delay, drops, line clears, level, hold, game over, determinism

**Files:**
- Modify: `js/engine.js` (replace the four Task-3 stubs; add `tick`)
- Modify: `tests/engine.test.js` (append tests)

**Interfaces:**
- Consumes: everything from Task 2.
- Produces: `engine.tick(dtMs) → events[]`; events `{type:"lock"}`, `{type:"clear", lines, rows:number[]}`, `{type:"level", level}`, `{type:"hold"}`, `{type:"gameover"}`, plus `{type:"move"|"rotate"}` from Task 2. `state.tick` increments once per `tick()` call while playing.

- [ ] **Step 1: Append the failing tests**

Append to `tests/engine.test.js`:
```js
const DT = 1000 / 60;

function playing(seed) {
  const e = E.createEngine({ seed: seed === undefined ? 1 : seed });
  e.dispatch("start");
  return e;
}

test("gravity: level 1 moves the piece one row every 1000 ms", () => {
  const e = playing();
  e.setActive({ type: "T", rot: 0, x: 3, y: 0 });
  e.tick(999);
  assert.equal(e.state.active.y, 0);
  e.tick(1);
  assert.equal(e.state.active.y, 1);
  assert.equal(e.state.tick, 2);
});

test("tick does nothing unless playing", () => {
  const e = E.createEngine({ seed: 1 });
  e.setActive({ type: "T", rot: 0, x: 3, y: 0 });
  assert.deepEqual(e.tick(5000), []);
  assert.equal(e.state.active.y, 0);
  assert.equal(e.state.tick, 0);
  e.dispatch("start"); e.dispatch("pause");
  assert.deepEqual(e.tick(5000), []);
  assert.equal(e.state.active.y, 0);
});

test("soft drop is 20x gravity and scores 1 per cell", () => {
  const e = playing();
  e.setActive({ type: "T", rot: 0, x: 3, y: 0 });
  e.dispatch("softDropOn");
  e.tick(50);
  assert.equal(e.state.active.y, 1);
  assert.equal(e.state.score, 1);
  e.dispatch("softDropOff");
  e.tick(50);
  assert.equal(e.state.active.y, 1);
});

test("hard drop lands at ghostY, scores 2 per cell, locks, spawns the next piece", () => {
  const e = playing(42);
  e.setActive({ type: "T", rot: 0, x: 3, y: 0 });
  const nextType = e.state.queue[0];
  const ev = e.dispatch("hardDrop");
  assert.ok(ev.some((x) => x.type === "lock"));
  assert.equal(e.state.score, 40); // 20 rows * 2
  assert.equal(e.state.board[21][3], "T");
  assert.equal(e.state.board[21][4], "T");
  assert.equal(e.state.board[21][5], "T");
  assert.equal(e.state.board[20][4], "T");
  assert.equal(e.state.active.type, nextType);
  assert.deepEqual([e.state.active.x, e.state.active.y], [3, 0]);
  assert.equal(e.state.status, "playing");
});

test("single line clear scores 100 x level and emits clear", () => {
  const e = playing();
  e.setBoard(["....XXXXXX"]);
  e.setActive({ type: "I", rot: 0, x: 0, y: 0 }); // horizontal I on row y+1 → cols 0..3
  const ev = e.dispatch("hardDrop");
  const clear = ev.find((x) => x.type === "clear");
  assert.deepEqual(clear, { type: "clear", lines: 1, rows: [21] });
  assert.equal(e.state.lines, 1);
  assert.equal(e.state.score, 20 * 2 + 100);
  assert.ok(e.state.board[21].every((c) => c === null));
});

test("tetris scores 800 x level", () => {
  const e = playing();
  e.setBoard([".XXXXXXXXX", ".XXXXXXXXX", ".XXXXXXXXX", ".XXXXXXXXX"]);
  e.setActive({ type: "I", rot: 1, x: -2, y: 0 }); // vertical I in col 0, rows 0..3
  const ev = e.dispatch("hardDrop");
  const clear = ev.find((x) => x.type === "clear");
  assert.equal(clear.lines, 4);
  assert.deepEqual(clear.rows, [18, 19, 20, 21]);
  assert.equal(e.state.score, 18 * 2 + 800);
  assert.equal(e.state.lines, 4);
});

test("level rises every 10 lines and multiplies scoring", () => {
  const e = playing();
  let levelEvent = null;
  for (let i = 0; i < 10; i++) {
    e.setBoard(["....XXXXXX"]);
    e.setActive({ type: "I", rot: 0, x: 0, y: 0 });
    const ev = e.dispatch("hardDrop");
    levelEvent = ev.find((x) => x.type === "level") || levelEvent;
  }
  assert.equal(e.state.lines, 10);
  assert.equal(e.state.level, 2);
  assert.deepEqual(levelEvent, { type: "level", level: 2 });
  e.setBoard(["....XXXXXX"]);
  e.setActive({ type: "I", rot: 0, x: 0, y: 0 });
  const before = e.state.score;
  e.dispatch("hardDrop");
  assert.equal(e.state.score - before, 20 * 2 + 200);
});

test("gravity speeds up with level", () => {
  const e = E.createEngine({ seed: 1, startLevel: 5 });
  e.dispatch("start");
  e.setActive({ type: "T", rot: 0, x: 3, y: 0 });
  e.tick(355);
  assert.equal(e.state.active.y, 1);
});

test("hold swaps once per piece and re-enables after lock", () => {
  const e = playing(42);
  const first = e.state.active.type, second = e.state.queue[0];
  const ev = e.dispatch("hold");
  assert.deepEqual(ev, [{ type: "hold" }]);
  assert.equal(e.state.hold, first);
  assert.equal(e.state.active.type, second);
  assert.equal(e.state.holdUsed, true);
  assert.deepEqual(e.dispatch("hold"), []);
  e.dispatch("hardDrop");
  assert.equal(e.state.holdUsed, false);
  const third = e.state.active.type;
  e.dispatch("hold");
  assert.equal(e.state.active.type, first);
  assert.equal(e.state.hold, third);
  assert.deepEqual([e.state.active.x, e.state.active.y, e.state.active.rot], [3, 0, 0]);
});

test("lock delay: a grounded piece locks after 500 ms", () => {
  const e = playing();
  e.setActive({ type: "T", rot: 0, x: 3, y: 20 });
  assert.deepEqual(e.tick(499), []);
  assert.equal(e.state.board[21][4], null);
  const ev = e.tick(1);
  assert.ok(ev.some((x) => x.type === "lock"));
  assert.equal(e.state.board[21][4], "T");
});

test("lock delay resets on player moves, at most 15 times", () => {
  const e = playing();
  e.setActive({ type: "T", rot: 0, x: 3, y: 20 });
  for (let i = 0; i < 15; i++) {
    e.tick(400);
    e.dispatch(i % 2 ? "right" : "left");
  }
  assert.equal(e.state.board[21][4], null); // still airborne-locked? no: still unlocked
  e.tick(400);
  e.dispatch("left"); // 16th move: no reset
  assert.equal(e.state.board[21].filter((c) => c !== null).length, 0);
  const ev = e.tick(100);
  assert.ok(ev.some((x) => x.type === "lock"));
});

test("lock timer pauses while the piece is airborne", () => {
  const e = playing();
  e.setActive({ type: "T", rot: 0, x: 3, y: 0 });
  e.tick(300); // airborne, no lock progress
  e.setActive({ type: "T", rot: 0, x: 3, y: 20 });
  e.tick(300); // grounded: 300 of 500
  assert.equal(e.state.board[21][4], null);
  e.tick(200);
  assert.equal(e.state.board[21][4], "T");
});

test("block-out: spawning into the stack ends the game", () => {
  const e = playing();
  const rows = [];
  for (let i = 0; i < 22; i++) rows.push("...XXXX...");
  e.setBoard(rows); // every row (including hidden rows 0–1) filled at cols 3..6, so nothing can spawn
  e.setActive({ type: "O", rot: 0, x: 0, y: 20 }); // safe spot, cols 1,2
  const ev = e.dispatch("hardDrop");
  assert.ok(ev.some((x) => x.type === "gameover"));
  assert.equal(e.state.status, "over");
  assert.deepEqual(e.dispatch("left"), []);
});

test("lock-out: a piece locking entirely in hidden rows ends the game", () => {
  const e = playing();
  const rows = [];
  for (let i = 0; i < 20; i++) rows.push("...XXXX...");
  e.setBoard(rows);
  e.setActive({ type: "T", rot: 0, x: 3, y: 0 }); // rows 0,1 only
  const ev = e.dispatch("hardDrop");
  assert.ok(ev.some((x) => x.type === "gameover"));
});

test("determinism: same seed + same input log reproduces the game", () => {
  function scripted(seed) {
    const e = E.createEngine({ seed });
    e.dispatch("start");
    for (let t = 0; t < 900; t++) {
      if (t % 37 === 0) e.dispatch("left");
      if (t % 53 === 0) e.dispatch("rotateCW");
      if (t % 41 === 0) e.dispatch("right");
      if (t % 97 === 0) e.dispatch("hardDrop");
      if (t % 211 === 0) e.dispatch("hold");
      e.tick(DT);
    }
    return e;
  }
  const a = scripted(42), b = scripted(42);
  assert.deepEqual(a.state.board, b.state.board);
  assert.equal(a.state.score, b.state.score);
  assert.equal(a.hash(), b.hash());
  assert.ok(a.state.score > 0);

  // replay from the log alone
  const r = E.createEngine({ seed: 42 });
  const byTick = new Map();
  for (const [t, action] of a.state.inputLog) {
    if (!byTick.has(t)) byTick.set(t, []);
    byTick.get(t).push(action);
  }
  for (let t = 0; t < 900; t++) {
    for (const action of byTick.get(t) || []) r.dispatch(action);
    r.tick(DT);
  }
  assert.deepEqual(r.state.board, a.state.board);
  assert.equal(r.state.score, a.state.score);
  assert.equal(r.state.status, a.state.status);
  assert.equal(r.hash(), a.hash());
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `node --test tests/`
Expected: the Task-2 tests still pass; the new tests fail (stubs return `[]`, pieces never move).

- [ ] **Step 3: Replace the four stubs in engine.js**

In `js/engine.js`, replace the block starting `// ---- Task 3 fills these in ----` through `function tick() { return []; }` with:
```js
    function clearLines(events) {
      const cleared = [];
      for (let y = ROWS - 1; y >= 0; y--) {
        if (state.board[y].every(function (c) { return c !== null; })) cleared.push(y);
      }
      if (cleared.length === 0) return;
      const remaining = state.board.filter(function (row, y) { return cleared.indexOf(y) === -1; });
      while (remaining.length < ROWS) remaining.unshift(new Array(COLS).fill(null));
      state.board = remaining;
      const n = cleared.length;
      state.lines += n;
      state.score += LINE_SCORES[n] * state.level;
      events.push({ type: "clear", lines: n, rows: cleared.slice().sort(function (a, b) { return a - b; }) });
      const newLevel = startLevel + Math.floor(state.lines / 10);
      if (newLevel !== state.level) {
        state.level = newLevel;
        events.push({ type: "level", level: newLevel });
      }
    }

    function lock() {
      const events = [{ type: "lock" }];
      const cells = cellsOf(state.active);
      let allHidden = true;
      for (let i = 0; i < cells.length; i++) {
        const x = cells[i][0], y = cells[i][1];
        state.board[y][x] = state.active.type;
        if (y >= HIDDEN_ROWS) allHidden = false;
      }
      if (allHidden) { gameOver(events); return events; } // lock-out
      clearLines(events);
      state.holdUsed = false;
      spawn(events);
      return events;
    }

    function doHold() {
      if (state.holdUsed || !state.active) return [];
      const events = [{ type: "hold" }];
      const current = state.active.type;
      if (state.hold === null) {
        state.hold = current;
        spawn(events);
      } else {
        const swapIn = state.hold;
        state.hold = current;
        state.active = { type: swapIn, rot: SPAWN.rot, x: SPAWN.x, y: SPAWN.y };
        resetPieceTimers();
        if (!fits(state.active)) gameOver(events);
      }
      state.holdUsed = true;
      return events;
    }

    function hardDrop() {
      const gy = ghostY();
      const dist = gy - state.active.y;
      state.active = shifted(state.active, 0, dist);
      state.score += 2 * dist;
      return lock();
    }

    function tick(dt) {
      if (state.status !== "playing" || !state.active) return [];
      const events = [];
      state.tick++;
      const interval = softDrop ? gravityMs(state.level) / SOFT_DROP_FACTOR : gravityMs(state.level);
      gravityAcc += dt;
      while (gravityAcc >= interval) {
        gravityAcc -= interval;
        if (fits(shifted(state.active, 0, 1))) {
          state.active = shifted(state.active, 0, 1);
          if (softDrop) state.score += 1;
        } else {
          gravityAcc = 0;
          break;
        }
      }
      if (!fits(shifted(state.active, 0, 1))) {
        lockTimer += dt;
        if (lockTimer >= LOCK_DELAY_MS) Array.prototype.push.apply(events, lock());
      } else {
        lockTimer = 0;
      }
      return events;
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/`
Expected: all pass (31 tests). If "lock delay resets on player moves" fails because the piece drifts off the T's supporting cells, note that `y=20` with an empty board is the floor — left/right moves keep it grounded; check that `onPlayerMoved` caps at 15 and that `tick` only advances `lockTimer` while grounded.

- [ ] **Step 5: (If git) commit**

`git commit -am "feat(armaratris): gravity, lock delay, drops, line clears, hold, game over, deterministic replay"`

---

### Task 4: Page shell, layout CSS, and skin loader

**Files:**
- Create: `index.html`, `css/game.css`, `js/skin.js`

**Interfaces:**
- Consumes: skin object shape (Task 1).
- Produces: `Armaratris.loadSkin(name) → Promise<skin>` where the resolved skin additionally has `skin.base` (folder URL, e.g. `"skin/armara/"`) and `skin.logoImage` (`HTMLImageElement` or `null`). Side effects: sets `--c-<paletteKey>`, `--font-display`, `--font-body`, `--frame-image` on `:root`; injects the Google Fonts `<link>`; sets `document.title`; writes `skin.strings[key]` into every `[data-str="key"]`; sets `#titleLogo` and `#brandLogo` `src`; fills `#tagline` and `#wordmark`.
- DOM ids used by later tasks: `well`, `wellwrap`, `hold`, `next`, `score`, `level`, `lines`, `best`, `overlay`, `overlayTitle`, `overlayBody`, `overlayBtn`, `mute`, `touch` (buttons with `data-btn="left|right|rotate|drop"`), `app`.

- [ ] **Step 1: Write index.html**

Create `index.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<meta name="theme-color" content="#0B0A0A">
<title>Armaratris</title>
<link rel="stylesheet" href="css/game.css">
</head>
<body>
<div id="app" class="app">
  <header class="title">
    <img id="titleLogo" class="mark" alt="">
    <h1 id="title" data-str="title">ARMARATRIS</h1>
    <p class="tagline" id="tagline"></p>
  </header>

  <main class="stage">
    <aside class="panel panel-left">
      <section class="box box-hold">
        <h2 data-str="hold">HOLD</h2>
        <canvas id="hold" width="96" height="96" aria-label="Held piece"></canvas>
      </section>
      <section class="stats">
        <div class="stat"><h2 data-str="score">SCORE</h2><output id="score">0</output></div>
        <div class="stat"><h2 data-str="level">LEVEL</h2><output id="level">1</output></div>
        <div class="stat"><h2 data-str="lines">LINES</h2><output id="lines">0</output></div>
        <div class="stat stat-best"><h2 data-str="best">BEST</h2><output id="best">0</output></div>
      </section>
    </aside>

    <div class="wellwrap" id="wellwrap">
      <canvas id="well" aria-label="Playfield"></canvas>
      <div class="overlay" id="overlay">
        <p class="overlay-title" id="overlayTitle"></p>
        <p class="overlay-body" id="overlayBody"></p>
        <button class="overlay-btn" id="overlayBtn" type="button"></button>
      </div>
    </div>

    <aside class="panel panel-right">
      <section class="box box-next">
        <h2 data-str="next">NEXT</h2>
        <canvas id="next" width="96" height="264" aria-label="Next pieces"></canvas>
      </section>
      <section class="brand">
        <img id="brandLogo" alt="">
        <div class="wordmark" id="wordmark"></div>
      </section>
      <button id="mute" class="icon" type="button" aria-label="Toggle sound" aria-pressed="false">♪</button>
    </aside>
  </main>

  <nav class="touch" id="touch" aria-label="Touch controls">
    <button type="button" data-btn="left" aria-label="Move left">◀</button>
    <button type="button" data-btn="rotate" aria-label="Rotate">⟳</button>
    <button type="button" data-btn="drop" aria-label="Drop (hold for soft drop)">⬇</button>
    <button type="button" data-btn="right" aria-label="Move right">▶</button>
  </nav>
</div>

<script src="js/engine.js"></script>
<script src="js/audio.js"></script>
<script src="js/skin.js"></script>
<script src="js/renderer.js"></script>
<script src="js/input.js"></script>
<script src="js/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write game.css**

Create `css/game.css`:
```css
:root {
  /* Fallbacks only — skin.js overwrites every one of these at load. */
  --c-bg: #0B0A0A; --c-bg2: #151210; --c-marble: #E9E2D3; --c-gold: #C9A24A; --c-goldDeep: #8A6A23;
  --c-bronze: #7A5230; --c-ink: #EFE8D8; --c-muted: #9A8E78; --c-well: #0E0D0C; --c-grid: #1E1A15;
  --c-frame: #C9A24A; --c-ghost: #C9A24A;
  --font-display: Georgia, "Times New Roman", serif;
  --font-body: Georgia, "Times New Roman", serif;
  --frame-image: none;
  --frame-w: 14px;
}
* { box-sizing: border-box; }
html, body { height: 100%; margin: 0; }
body {
  background-color: var(--c-bg);
  color: var(--c-ink);
  font-family: var(--font-body);
  overflow: hidden;
  -webkit-user-select: none; user-select: none;
  -webkit-tap-highlight-color: transparent;
  touch-action: none;
}
.app {
  height: 100dvh;
  display: grid;
  grid-template-rows: auto 1fr auto;
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
}

/* Title */
.title { display: flex; align-items: center; justify-content: center; gap: 14px; padding: 12px 16px 6px; }
.title .mark { height: 40px; width: auto; }
.title h1 {
  margin: 0; font-family: var(--font-display); font-weight: 700; font-size: clamp(22px, 3.2vw, 34px);
  letter-spacing: .22em; color: var(--c-gold); text-shadow: 0 0 18px rgba(201,162,74,.18);
}
.title .tagline { margin: 0; font-size: 11px; letter-spacing: .28em; color: var(--c-muted); text-transform: uppercase; }

/* Stage */
.stage {
  display: grid;
  grid-template-columns: 172px auto 172px;
  gap: 22px;
  justify-content: center;
  align-items: start;
  padding: 6px 16px 12px;
  min-height: 0;
}
.panel { display: flex; flex-direction: column; gap: 14px; }
.box, .stats { border: 1px solid var(--c-goldDeep); background: var(--c-bg2); padding: 10px 12px 12px; }
.box h2, .stat h2 {
  margin: 0 0 8px; font-family: var(--font-display); font-weight: 700; font-size: 11px; letter-spacing: .28em; color: var(--c-gold);
}
.box canvas { display: block; margin: 0 auto; }
.stats { display: grid; gap: 10px; }
.stat h2 { margin-bottom: 2px; }
.stat output {
  display: block; font-family: var(--font-display); font-weight: 700; font-size: 24px; line-height: 1.1;
  color: var(--c-marble); font-variant-numeric: tabular-nums; letter-spacing: .04em;
}
.brand { display: flex; flex-direction: column; align-items: center; gap: 6px; padding-top: 6px; }
.brand img { width: 64px; height: 64px; object-fit: contain; opacity: .9; }
.brand .wordmark { font-family: var(--font-display); font-weight: 700; letter-spacing: .3em; font-size: 12px; color: var(--c-gold); }
.icon {
  align-self: center; width: 40px; height: 40px; border: 1px solid var(--c-goldDeep); background: var(--c-bg2);
  color: var(--c-gold); font-size: 18px; cursor: pointer; border-radius: 2px;
}
.icon[aria-pressed="true"] { color: var(--c-muted); text-decoration: line-through; }

/* Well */
.wellwrap {
  position: relative;
  border: var(--frame-w) solid var(--c-frame);
  border-image: var(--frame-image) 24 round;
  background: var(--c-well);
  box-shadow: 0 0 0 1px var(--c-goldDeep), 0 24px 60px -20px rgba(0,0,0,.9);
  line-height: 0;
}
#well { display: block; }
.overlay {
  position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
  background: rgba(11,10,10,.78); text-align: center; padding: 20px; line-height: 1.3;
}
.overlay[hidden] { display: none; }
.overlay-title { margin: 0; font-family: var(--font-display); font-weight: 900; font-size: clamp(20px, 3vw, 30px); letter-spacing: .2em; color: var(--c-gold); }
.overlay-body { margin: 0; font-size: 15px; letter-spacing: .08em; color: var(--c-ink); white-space: pre-line; }
.overlay-btn {
  margin-top: 8px; font-family: var(--font-display); font-weight: 700; letter-spacing: .2em; font-size: 12px;
  background: var(--c-gold); color: var(--c-bg); border: 0; padding: 10px 18px; cursor: pointer;
}
.overlay-btn:focus-visible, .icon:focus-visible, .touch button:focus-visible { outline: 2px solid var(--c-marble); outline-offset: 2px; }

/* Touch controls */
.touch { display: none; gap: 8px; padding: 8px 12px 10px; }
.touch button {
  height: 56px; font-size: 24px; background: var(--c-bg2); color: var(--c-gold); border: 1px solid var(--c-goldDeep); border-radius: 4px;
}
.touch button:active { background: var(--c-goldDeep); color: var(--c-bg); }

/* Mobile: stats strip on top, well fills, buttons at the bottom */
@media (max-width: 759px) {
  .title { padding: 8px 12px 2px; gap: 10px; }
  .title .mark { height: 26px; }
  .title .tagline { display: none; }
  .stage {
    grid-template-columns: 1fr auto;
    grid-template-areas: "left right" "well well";
    gap: 8px; padding: 4px 10px 6px;
    justify-items: center;
  }
  .panel-left { grid-area: left; flex-direction: row; align-items: stretch; gap: 8px; width: 100%; }
  .panel-right { grid-area: right; }
  .wellwrap { grid-area: well; }
  .box, .stats { padding: 6px 8px 8px; }
  .box h2, .stat h2 { font-size: 9px; margin-bottom: 4px; }
  .stats { grid-template-columns: repeat(3, auto); gap: 8px; flex: 1; align-content: start; }
  .stat-best { display: none; }
  .stat output { font-size: 16px; }
  .brand, #mute { display: none; }
  .touch { display: grid; grid-template-columns: repeat(4, 1fr); }
}
@media (pointer: coarse) and (min-width: 760px) {
  .touch { display: grid; grid-template-columns: repeat(4, minmax(80px, 160px)); justify-content: center; }
}
@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; animation: none !important; }
}
```

- [ ] **Step 3: Write skin.js**

Create `js/skin.js`:
```js
/* Skin loader: turns skin/<name>/skin.json into CSS variables, fonts, strings and the Greek-key frame. */
(function (global) {
  "use strict";
  const A = global.Armaratris = global.Armaratris || {};
  A.skins = A.skins || {};

  const FALLBACK = "armara";
  const SERIF = 'Georgia, "Times New Roman", serif';

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      const s = document.createElement("script");
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function fetchSkin(name) {
    const base = "skin/" + name + "/";
    try {
      const r = await fetch(base + "skin.json", { cache: "no-store" });
      if (r.ok) return await r.json();
    } catch (e) { /* file:// or offline — fall through */ }
    try { await loadScript(base + "skin.js"); } catch (e) { /* missing */ }
    return A.skins[name] || null;
  }

  // A square-spiral tile, repeated as a pattern → reads as a Greek key in any orientation.
  function frameDataUri(color) {
    const tile = "<path d='M1.5 22.5V1.5H22.5V22.5H7.5V7.5H16.5V16.5H13.5' fill='none' stroke='" + color + "' stroke-width='3'/>";
    const svg = "<svg xmlns='http://www.w3.org/2000/svg' width='72' height='72'>" +
      "<defs><pattern id='k' width='24' height='24' patternUnits='userSpaceOnUse'>" + tile + "</pattern></defs>" +
      "<rect width='72' height='72' fill='url(#k)'/></svg>";
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
  }

  function applySkin(skin) {
    const root = document.documentElement.style;
    Object.keys(skin.palette).forEach(function (k) { root.setProperty("--c-" + k, skin.palette[k]); });
    root.setProperty("--font-display", '"' + skin.fonts.display + '", ' + SERIF);
    root.setProperty("--font-body", '"' + skin.fonts.body + '", ' + SERIF);
    root.setProperty("--frame-image", frameDataUri(skin.palette.frame));

    if (skin.fonts.googleFonts && !document.getElementById("skinFonts")) {
      const link = document.createElement("link");
      link.id = "skinFonts"; link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?" + skin.fonts.googleFonts + "&display=swap";
      document.head.appendChild(link);
    }
    document.title = skin.title;
    document.querySelectorAll("[data-str]").forEach(function (el) {
      const key = el.getAttribute("data-str");
      if (key === "title") el.textContent = skin.title;
      else if (skin.strings[key] !== undefined) el.textContent = skin.strings[key];
    });
    const tagline = document.getElementById("tagline"); if (tagline) tagline.textContent = skin.tagline;
    const wordmark = document.getElementById("wordmark"); if (wordmark) wordmark.textContent = skin.title.replace(/TRIS$/i, "");
    ["titleLogo", "brandLogo"].forEach(function (id) {
      const img = document.getElementById(id); if (img) img.src = skin.base + skin.logo;
    });
    const theme = document.querySelector('meta[name="theme-color"]'); if (theme) theme.content = skin.palette.bg;
  }

  function preloadLogo(skin) {
    return new Promise(function (resolve) {
      const img = new Image();
      img.onload = function () { skin.logoImage = img; resolve(); };
      img.onerror = function () { skin.logoImage = null; resolve(); };
      img.src = skin.base + skin.logo;
    });
  }

  async function loadSkin(name) {
    name = (name || FALLBACK).replace(/[^a-z0-9_-]/gi, "").toLowerCase() || FALLBACK;
    let skin = await fetchSkin(name);
    if (!skin && name !== FALLBACK) {
      console.warn("Armaratris: skin '" + name + "' not found, falling back to '" + FALLBACK + "'");
      name = FALLBACK;
      skin = await fetchSkin(name);
    }
    if (!skin) throw new Error("Armaratris: no skin could be loaded");
    skin = JSON.parse(JSON.stringify(skin));
    skin.base = "skin/" + name + "/";
    applySkin(skin);
    await preloadLogo(skin);
    return skin;
  }

  A.loadSkin = loadSkin;
  A.frameDataUri = frameDataUri;
})(typeof window !== "undefined" ? window : globalThis);
```

- [ ] **Step 4: Add a temporary boot so the shell renders, then verify in headless Chrome**

Create a placeholder `js/main.js` (Task 8 replaces it):
```js
(function (global) {
  "use strict";
  window.addEventListener("DOMContentLoaded", async function () {
    const params = new URLSearchParams(location.search);
    const skin = await global.Armaratris.loadSkin(params.get("skin"));
    document.getElementById("overlayTitle").textContent = skin.title;
    document.getElementById("overlayBody").textContent = skin.strings.start;
    document.getElementById("overlayBtn").textContent = skin.strings.restart;
    const well = document.getElementById("well");
    well.width = 300; well.height = 600; well.style.width = "300px"; well.style.height = "600px";
    document.body.dataset.skin = skin.name; // marker for the screenshot step
  });
})(window);
```
Create empty placeholders so the script tags resolve: `js/audio.js`, `js/renderer.js`, `js/input.js` each containing `/* replaced in a later task */`.

Run (Bash; adjust the Chrome path if different):
```bash
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"
[ -x "$CHROME" ] || CHROME="/c/Program Files (x86)/Google/Chrome/Application/chrome.exe"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --window-size=1280,800 --virtual-time-budget=4000 \
  --screenshot="$PWD/tests/shot-shell-desktop.png" "file:///$(pwd -W 2>/dev/null || pwd)/index.html"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --window-size=390,844 --virtual-time-budget=4000 \
  --screenshot="$PWD/tests/shot-shell-mobile.png" "file:///$(pwd -W 2>/dev/null || pwd)/index.html"
ls -la tests/*.png
```
Then open both PNGs with the Read tool and check: gold "ARMARATRIS" title with the hourglass mark, HOLD/SCORE/LEVEL/LINES/BEST on the left, NEXT + logo on the right, a Greek-key framed black well in the middle with the overlay text; on mobile a stats strip on top and four buttons at the bottom. If the frame shows as a plain gold border, the `--frame-image` data URI failed — check for unescaped `#` in the color (it's `encodeURIComponent`-ed, so it should work).

- [ ] **Step 5: (If git) commit**

`git add -A && git commit -m "feat(armaratris): page shell, responsive layout, skin loader with Greek-key frame"`

---

### Task 5: Renderer

**Files:**
- Create: `js/renderer.js` (replace placeholder)

**Interfaces:**
- Consumes: `Armaratris.SHAPES`, `COLS`, `ROWS`, `HIDDEN_ROWS`, `cellsOf` (Task 2); skin (Task 4).
- Produces: `Armaratris.createRenderer({skin, wellCanvas, holdCanvas, nextCanvas, wrapEl}) → renderer`:
  - `renderer.resize() → {cell}` — sizes the canvases from the viewport; call on load and `resize`.
  - `renderer.draw(state, ghostY)` — full well frame (board, flash snapshot, ghost, active, watermark).
  - `renderer.drawHold(type|null)`, `renderer.drawNext(queue, count)`.
  - `renderer.flash(rows, boardSnapshot)` — start the 120 ms line-clear flash (no-op with reduced motion).
  - `renderer.paintGround()` — procedural marble on `document.body` background.
  - `renderer.cell` — current cell size in CSS px.

- [ ] **Step 1: Write renderer.js**

Create `js/renderer.js`:
```js
/* Canvas renderer: well, bevelled stone tiles, ghost, hold/next, watermark, procedural marble ground. */
(function (global) {
  "use strict";
  const A = global.Armaratris = global.Armaratris || {};
  const FLASH_MS = 120;

  function reducedMotion() {
    return global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function drawTile(ctx, px, py, s, tone, alpha) {
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    const b = Math.max(2, Math.round(s * 0.12));
    ctx.fillStyle = tone.base;
    ctx.fillRect(px + 1, py + 1, s - 2, s - 2);
    ctx.fillStyle = tone.hi;
    ctx.fillRect(px + 1, py + 1, s - 2, b);
    ctx.fillRect(px + 1, py + 1, b, s - 2);
    ctx.fillStyle = tone.lo;
    ctx.fillRect(px + 1, py + s - 1 - b, s - 2, b);
    ctx.fillRect(px + s - 1 - b, py + 1, b, s - 2);
    if (tone.edge) {
      ctx.strokeStyle = tone.edge; ctx.lineWidth = 1;
      ctx.strokeRect(px + 1.5, py + 1.5, s - 3, s - 3);
    }
    ctx.globalAlpha = 1;
  }

  function drawGhost(ctx, px, py, s, color) {
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.strokeRect(px + 3, py + 3, s - 6, s - 6);
    ctx.globalAlpha = 1;
  }

  // Draws one piece centred in a box of (cols x rows) cells at cell size s.
  function drawPieceCentered(ctx, type, ox, oy, cols, rows, s, tiles) {
    const cells = A.SHAPES[type][0];
    let minX = 9, maxX = -9, minY = 9, maxY = -9;
    cells.forEach(function (c) { minX = Math.min(minX, c[0]); maxX = Math.max(maxX, c[0]); minY = Math.min(minY, c[1]); maxY = Math.max(maxY, c[1]); });
    const w = (maxX - minX + 1) * s, h = (maxY - minY + 1) * s;
    const startX = ox + (cols * s - w) / 2, startY = oy + (rows * s - h) / 2;
    cells.forEach(function (c) {
      drawTile(ctx, startX + (c[0] - minX) * s, startY + (c[1] - minY) * s, s, tiles[type]);
    });
  }

  function setupCanvas(canvas, cssW, cssH, dpr) {
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    return ctx;
  }

  function createRenderer(o) {
    const skin = o.skin, tiles = skin.tiles, pal = skin.palette;
    const COLS = A.COLS, ROWS = A.ROWS, HIDDEN = A.HIDDEN_ROWS, VISIBLE = ROWS - HIDDEN;
    const r = { cell: 24 };
    let wellCtx, holdCtx, nextCtx, miniCell = 16;
    let flash = null; // { rows, board, until }
    let dpr = 1;

    r.resize = function () {
      dpr = Math.min(global.devicePixelRatio || 1, 3);
      const narrow = global.innerWidth < 760;
      const frame = parseFloat(getComputedStyle(o.wrapEl).borderTopWidth) || 14;
      const titleH = (document.querySelector(".title") || {}).offsetHeight || 60;
      const touchEl = document.getElementById("touch");
      const touchH = touchEl && getComputedStyle(touchEl).display !== "none" ? touchEl.offsetHeight : 0;
      const stripH = narrow ? ((document.querySelector(".panel-left") || {}).offsetHeight || 70) + 8 : 0;
      const availH = global.innerHeight - titleH - touchH - stripH - 2 * frame - 24;
      const availW = global.innerWidth - (narrow ? 20 : 2 * (172 + 22) + 32) - 2 * frame;
      const cell = Math.max(12, Math.floor(Math.min(availH / VISIBLE, availW / COLS)));
      r.cell = cell;
      wellCtx = setupCanvas(o.wellCanvas, cell * COLS, cell * VISIBLE, dpr);
      miniCell = Math.max(10, Math.round(cell * 0.62));
      holdCtx = setupCanvas(o.holdCanvas, miniCell * 4, miniCell * 3, dpr);
      const nextCount = narrow ? 1 : 3;
      nextCtx = setupCanvas(o.nextCanvas, miniCell * 4, miniCell * (3 * nextCount + (nextCount - 1) * 0.5), dpr);
      r.nextCount = nextCount;
      return { cell: cell };
    };

    r.paintGround = function () {
      const size = 512;
      const c = document.createElement("canvas"); c.width = size; c.height = size;
      const ctx = c.getContext("2d");
      const rng = A.mulberry32(7);
      ctx.fillStyle = pal.bg; ctx.fillRect(0, 0, size, size);
      // soft cloudy patches
      for (let i = 0; i < 18; i++) {
        const g = ctx.createRadialGradient(rng() * size, rng() * size, 0, rng() * size, rng() * size, 120 + rng() * 160);
        g.addColorStop(0, "rgba(233,226,211,0.035)"); g.addColorStop(1, "rgba(233,226,211,0)");
        ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
      }
      // veins
      ctx.strokeStyle = pal.marble; ctx.lineCap = "round";
      for (let i = 0; i < 26; i++) {
        ctx.globalAlpha = 0.025 + rng() * 0.04;
        ctx.lineWidth = 0.6 + rng() * 2.2;
        const x0 = rng() * size, y0 = rng() * size;
        ctx.beginPath(); ctx.moveTo(x0, y0);
        let x = x0, y = y0;
        for (let k = 0; k < 4; k++) {
          const nx = x + (rng() - 0.5) * 260, ny = y + (rng() - 0.5) * 260;
          ctx.quadraticCurveTo(x + (rng() - 0.5) * 120, y + (rng() - 0.5) * 120, nx, ny);
          x = nx; y = ny;
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      document.body.style.backgroundImage = "url(" + c.toDataURL("image/png") + ")";
      document.body.style.backgroundSize = size + "px " + size + "px";
    };

    function drawWatermark(ctx, w, h) {
      if (!skin.logoImage) return;
      const size = Math.min(w, h) * 0.62;
      ctx.globalAlpha = skin.watermarkAlpha || 0.06;
      ctx.drawImage(skin.logoImage, (w - size) / 2, (h - size) / 2, size, size);
      ctx.globalAlpha = 1;
    }

    r.flash = function (rows, boardSnapshot) {
      if (reducedMotion()) return;
      flash = { rows: rows, board: boardSnapshot, until: performance.now() + FLASH_MS };
    };

    r.draw = function (state, ghostY) {
      const ctx = wellCtx, s = r.cell, w = s * COLS, h = s * VISIBLE;
      ctx.fillStyle = pal.well; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = pal.grid; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 1; x < COLS; x++) { ctx.moveTo(x * s + 0.5, 0); ctx.lineTo(x * s + 0.5, h); }
      for (let y = 1; y < VISIBLE; y++) { ctx.moveTo(0, y * s + 0.5); ctx.lineTo(w, y * s + 0.5); }
      ctx.stroke();
      drawWatermark(ctx, w, h);

      let board = state.board;
      if (flash) {
        if (performance.now() < flash.until) board = flash.board; else flash = null;
      }
      for (let y = HIDDEN; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const t = board[y][x];
          if (!t) continue;
          const tone = flash && flash.rows.indexOf(y) !== -1 ? { base: pal.marble, hi: "#FFFFFF", lo: pal.marble } : tiles[t];
          drawTile(ctx, x * s, (y - HIDDEN) * s, s, tone);
        }
      }
      if (state.active && state.status !== "over") {
        const a = state.active;
        if (ghostY !== undefined && ghostY !== a.y) {
          A.cellsOf({ type: a.type, rot: a.rot, x: a.x, y: ghostY }).forEach(function (c) {
            if (c[1] >= HIDDEN) drawGhost(ctx, c[0] * s, (c[1] - HIDDEN) * s, s, pal.ghost);
          });
        }
        A.cellsOf(a).forEach(function (c) {
          if (c[1] >= HIDDEN) drawTile(ctx, c[0] * s, (c[1] - HIDDEN) * s, s, tiles[a.type]);
        });
      }
    };

    r.drawHold = function (type) {
      const ctx = holdCtx, s = miniCell;
      ctx.clearRect(0, 0, s * 4, s * 3);
      if (type) drawPieceCentered(ctx, type, 0, 0, 4, 3, s, tiles);
    };

    r.drawNext = function (queue, count) {
      const ctx = nextCtx, s = miniCell, n = count || r.nextCount || 3;
      ctx.clearRect(0, 0, s * 4, s * (3 * n + (n - 1) * 0.5));
      for (let i = 0; i < n && i < queue.length; i++) {
        drawPieceCentered(ctx, queue[i], 0, i * 3.5 * s, 4, 3, s, tiles);
      }
    };

    r.resize();
    return r;
  }

  A.createRenderer = createRenderer;
  A.drawTile = drawTile;
})(typeof window !== "undefined" ? window : globalThis);
```

- [ ] **Step 2: Syntax-check and smoke-run the pure parts in Node**

Run:
```bash
node --check js/renderer.js && node -e '
global.window = undefined;
require("./js/engine.js");
const A = globalThis.Armaratris;
require("./js/renderer.js");
// drawTile must be callable with a fake context
const calls = [];
const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : (...a) => calls.push(k)), set: (t, k, v) => (t[k] = v, true) });
A.drawTile(ctx, 0, 0, 24, { base: "#000", hi: "#fff", lo: "#888", edge: "#f00" });
console.log("drawTile calls:", calls.filter(c => c === "fillRect").length, "fillRect,", calls.filter(c => c === "strokeRect").length, "strokeRect");
'
```
Expected: `drawTile calls: 5 fillRect, 1 strokeRect`.

- [ ] **Step 3: (If git) commit**

`git add js/renderer.js && git commit -m "feat(armaratris): canvas renderer with stone tiles, ghost, watermark, marble ground"`

---

### Task 6: Audio

**Files:**
- Create: `js/audio.js` (replace placeholder)

**Interfaces:**
- Produces: `Armaratris.createAudio() → {play(name), unlock(), muted (getter), toggle() → muted}`; names: `move`, `rotate`, `lock`, `clear`, `tetris`, `gameover`, `hold`.

- [ ] **Step 1: Write audio.js**

Create `js/audio.js`:
```js
/* Procedural SFX via Web Audio. No files. */
(function (global) {
  "use strict";
  const A = global.Armaratris = global.Armaratris || {};
  const KEY = "armaratris:muted";

  function createAudio() {
    let ctx = null;
    let muted = false;
    try { muted = global.localStorage && global.localStorage.getItem(KEY) === "1"; } catch (e) { /* storage blocked */ }

    function ensure() {
      if (!ctx) {
        const AC = global.AudioContext || global.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
      }
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    }

    function tone(freq, dur, type, gain, when, slideTo) {
      const c = ensure();
      if (!c || muted) return;
      const t = c.currentTime + (when || 0);
      const o = c.createOscillator(), g = c.createGain();
      o.type = type || "square";
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(gain || 0.08, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(c.destination);
      o.start(t); o.stop(t + dur + 0.02);
    }

    const sounds = {
      move: function () { tone(220, 0.035, "square", 0.04); },
      rotate: function () { tone(330, 0.05, "square", 0.045); },
      hold: function () { tone(440, 0.06, "triangle", 0.06, 0, 660); },
      lock: function () { tone(130, 0.09, "triangle", 0.12, 0, 70); },
      clear: function () { tone(523, 0.1, "triangle", 0.1); tone(784, 0.16, "triangle", 0.1, 0.09); },
      tetris: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.16, "triangle", 0.11, i * 0.09); }); },
      gameover: function () { [392, 330, 262, 196].forEach(function (f, i) { tone(f, 0.24, "sawtooth", 0.06, i * 0.18); }); },
    };

    return {
      play: function (name) { const f = sounds[name]; if (f) f(); },
      unlock: function () { ensure(); },
      get muted() { return muted; },
      toggle: function () {
        muted = !muted;
        try { global.localStorage.setItem(KEY, muted ? "1" : "0"); } catch (e) { /* ignore */ }
        return muted;
      },
    };
  }

  A.createAudio = createAudio;
})(typeof window !== "undefined" ? window : globalThis);
```

- [ ] **Step 2: Syntax-check and verify muted persistence logic in Node**

Run:
```bash
node --check js/audio.js && node -e '
const store = {}; globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } };
require("./js/audio.js");
const a = globalThis.Armaratris.createAudio();
console.log("initial muted:", a.muted);
a.play("move"); // no AudioContext in Node → must not throw
console.log("toggle →", a.toggle(), "stored:", store["armaratris:muted"]);
const b = globalThis.Armaratris.createAudio();
console.log("new instance reads stored:", b.muted);
'
```
Expected: `initial muted: false`, `toggle → true stored: 1`, `new instance reads stored: true`.

- [ ] **Step 3: (If git) commit**

`git add js/audio.js && git commit -m "feat(armaratris): procedural Web Audio SFX with persisted mute"`

---

### Task 7: Input — keyboard with DAS/ARR, touch gestures, on-screen buttons

**Files:**
- Create: `js/input.js` (replace placeholder)

**Interfaces:**
- Consumes: `engine.dispatch(action)` (Task 2/3).
- Produces: `Armaratris.createInput({engine, wellEl, touchEl, cellSize: () => number, onAction: (action) => void, onSystem: (name) => void}) → {update(dt), destroy()}`.
  - Every game action goes through `onAction(action)` (main.js forwards to the engine and handles sounds) — input.js never calls `engine.dispatch` directly.
  - `onSystem("start" | "pause" | "mute")` for Enter, P/Esc, M.

- [ ] **Step 1: Write input.js**

Create `js/input.js`:
```js
/* Input: keyboard (DAS/ARR), touch gestures on the well, on-screen buttons. Emits actions; never touches the engine directly. */
(function (global) {
  "use strict";
  const A = global.Armaratris = global.Armaratris || {};
  const DAS_MS = 170, ARR_MS = 40;
  const TAP_MS = 220, TAP_DIST = 12, HARD_DROP_MIN_PX = 60, HARD_DROP_MIN_VEL = 0.9; // px/ms
  const LONG_PRESS_MS = 250;

  const KEYS = {
    ArrowLeft: "left", ArrowRight: "right", ArrowUp: "rotateCW", KeyX: "rotateCW",
    KeyZ: "rotateCCW", ControlLeft: "rotateCCW", ControlRight: "rotateCCW",
    Space: "hardDrop", KeyC: "hold", ShiftLeft: "hold", ShiftRight: "hold",
  };

  function createInput(o) {
    const act = o.onAction, sys = o.onSystem || function () {};
    const held = { left: false, right: false };
    let dasDir = null, dasTimer = 0, arrTimer = 0;
    const listeners = [];
    function on(el, ev, fn, opts) { el.addEventListener(ev, fn, opts); listeners.push([el, ev, fn, opts]); }

    function pressDir(dir) {
      if (held[dir]) return;
      held[dir] = true;
      dasDir = dir; dasTimer = 0; arrTimer = 0;
      act(dir);
    }
    function releaseDir(dir) {
      held[dir] = false;
      if (dasDir === dir) {
        dasDir = held.left ? "left" : held.right ? "right" : null;
        dasTimer = 0; arrTimer = 0;
      }
    }

    // ---- keyboard ----
    on(global, "keydown", function (e) {
      if (e.repeat) { if (KEYS[e.code] || e.code === "ArrowDown") e.preventDefault(); return; }
      switch (e.code) {
        case "Enter": sys("start"); e.preventDefault(); return;
        case "KeyP": case "Escape": sys("pause"); e.preventDefault(); return;
        case "KeyM": sys("mute"); return;
        case "ArrowDown": act("softDropOn"); e.preventDefault(); return;
        case "ArrowLeft": pressDir("left"); e.preventDefault(); return;
        case "ArrowRight": pressDir("right"); e.preventDefault(); return;
      }
      const a = KEYS[e.code];
      if (a) { act(a); e.preventDefault(); }
    });
    on(global, "keyup", function (e) {
      if (e.code === "ArrowDown") act("softDropOff");
      if (e.code === "ArrowLeft") releaseDir("left");
      if (e.code === "ArrowRight") releaseDir("right");
    });
    on(global, "blur", function () { held.left = held.right = false; dasDir = null; act("softDropOff"); });

    // ---- touch / pointer gestures on the well ----
    let g = null; // gesture state
    on(o.wellEl, "pointerdown", function (e) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      o.wellEl.setPointerCapture(e.pointerId);
      g = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now(), tLast: performance.now(), movedCols: 0, soft: false, moved: false };
      e.preventDefault();
    }, { passive: false });
    on(o.wellEl, "pointermove", function (e) {
      if (!g || e.pointerId !== g.id) return;
      const cell = o.cellSize();
      const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
      const cols = Math.trunc(dx / cell);
      while (g.movedCols < cols) { act("right"); g.movedCols++; g.moved = true; }
      while (g.movedCols > cols) { act("left"); g.movedCols--; g.moved = true; }
      const now = performance.now();
      const vel = (e.clientY - g.y) / Math.max(1, now - g.tLast);
      g.x = e.clientX; g.y = e.clientY; g.tLast = now;
      if (!g.soft && dy > cell && Math.abs(dx) < cell * 1.5 && vel < HARD_DROP_MIN_VEL && vel > 0) {
        g.soft = true; act("softDropOn"); g.moved = true;
      }
    });
    function endGesture(e) {
      if (!g || e.pointerId !== g.id) return;
      const dt = performance.now() - g.t0;
      const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
      const vel = dy / Math.max(1, dt);
      if (g.soft) act("softDropOff");
      if (!g.moved && dt < TAP_MS && Math.abs(dx) < TAP_DIST && Math.abs(dy) < TAP_DIST) {
        act("rotateCW");
      } else if (!g.soft && dy > HARD_DROP_MIN_PX && vel > HARD_DROP_MIN_VEL && Math.abs(dx) < Math.abs(dy)) {
        act("hardDrop");
      } else if (dy < -HARD_DROP_MIN_PX && Math.abs(dx) < Math.abs(dy)) {
        act("hold");
      }
      g = null;
    }
    on(o.wellEl, "pointerup", endGesture);
    on(o.wellEl, "pointercancel", function (e) { if (g && e.pointerId === g.id) { if (g.soft) act("softDropOff"); g = null; } });

    // ---- on-screen buttons ----
    if (o.touchEl) {
      o.touchEl.querySelectorAll("[data-btn]").forEach(function (btn) {
        const kind = btn.getAttribute("data-btn");
        let pressTimer = null, softOn = false;
        on(btn, "pointerdown", function (e) {
          e.preventDefault();
          btn.setPointerCapture(e.pointerId);
          if (kind === "left" || kind === "right") pressDir(kind);
          else if (kind === "rotate") act("rotateCW");
          else if (kind === "drop") {
            pressTimer = setTimeout(function () { softOn = true; act("softDropOn"); }, LONG_PRESS_MS);
          }
        }, { passive: false });
        const release = function () {
          if (kind === "left" || kind === "right") releaseDir(kind);
          else if (kind === "drop") {
            if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
            if (softOn) { softOn = false; act("softDropOff"); } else act("hardDrop");
          }
        };
        on(btn, "pointerup", release);
        on(btn, "pointercancel", function () {
          if (kind === "left" || kind === "right") releaseDir(kind);
          if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
          if (softOn) { softOn = false; act("softDropOff"); }
        });
      });
    }

    return {
      update: function (dt) {
        if (!dasDir) return;
        dasTimer += dt;
        if (dasTimer < DAS_MS) return;
        arrTimer += dt;
        while (arrTimer >= ARR_MS) { arrTimer -= ARR_MS; act(dasDir); }
      },
      destroy: function () { listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); }); },
    };
  }

  A.createInput = createInput;
})(typeof window !== "undefined" ? window : globalThis);
```

- [ ] **Step 2: Syntax-check and unit-test DAS/ARR timing in Node with fake DOM**

Run:
```bash
node --check js/input.js && node -e '
const handlers = {};
const fakeEl = { addEventListener: (ev, fn) => { handlers[ev] = fn; }, removeEventListener(){}, setPointerCapture(){}, querySelectorAll: () => [] };
globalThis.addEventListener = fakeEl.addEventListener; globalThis.removeEventListener = () => {};
globalThis.performance = { now: () => 0 };
require("./js/input.js");
const actions = [];
const input = globalThis.Armaratris.createInput({ wellEl: fakeEl, touchEl: null, cellSize: () => 24, onAction: a => actions.push(a), onSystem: () => {} });
handlers.keydown({ code: "ArrowLeft", preventDefault(){} });
input.update(100); input.update(60);           // 160 ms < DAS 170 → no repeat yet
console.log("after 160ms:", actions.join(","));
input.update(10);                              // reaches 170 → ARR starts accumulating
input.update(40); input.update(40);            // two ARR periods
console.log("after 250ms:", actions.join(","));
handlers.keyup({ code: "ArrowLeft" });
input.update(200);
console.log("after release:", actions.join(","));
'
```
Expected: `after 160ms: left`, `after 250ms: left,left,left`, `after release: left,left,left`.

- [ ] **Step 3: (If git) commit**

`git add js/input.js && git commit -m "feat(armaratris): keyboard DAS/ARR, touch gestures, on-screen buttons"`

---

### Task 8: Main loop, overlays, high score, bridge — and the browser verification

**Files:**
- Create: `js/main.js` (replace the Task-4 placeholder)

**Interfaces:**
- Consumes: `createEngine`, `loadSkin`, `createRenderer`, `createAudio`, `createInput` exactly as specified in Tasks 2–7.

- [ ] **Step 1: Write main.js**

Create `js/main.js`:
```js
/* Boot + game loop. Fixed 60 Hz timestep so seed + inputLog reproduces a game. */
(function (global) {
  "use strict";
  const A = global.Armaratris;
  const STEP = 1000 / 60;
  const MAX_STEPS_PER_FRAME = 8;

  function $(id) { return document.getElementById(id); }

  function parseSeed(v) {
    if (v === null || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? (n >>> 0) : (A.fnv1a(String(v)) | 0) >>> 0;
  }

  function bestKey(skin) { return "armaratris:" + skin + ":best"; }
  function readBest(skin) { try { return Number(localStorage.getItem(bestKey(skin))) || 0; } catch (e) { return 0; } }
  function writeBest(skin, v) { try { localStorage.setItem(bestKey(skin), String(v)); } catch (e) { /* ignore */ } }

  async function boot() {
    const params = new URLSearchParams(location.search);
    const skin = await A.loadSkin(params.get("skin"));
    const engine = A.createEngine({ seed: parseSeed(params.get("seed")) });
    const audio = A.createAudio();
    const wrap = $("wellwrap");
    const renderer = A.createRenderer({ skin: skin, wellCanvas: $("well"), holdCanvas: $("hold"), nextCanvas: $("next"), wrapEl: wrap });
    renderer.paintGround();

    const ui = { score: $("score"), level: $("level"), lines: $("lines"), best: $("best"), overlay: $("overlay"), oTitle: $("overlayTitle"), oBody: $("overlayBody"), oBtn: $("overlayBtn"), mute: $("mute") };
    let best = readBest(skin.name);
    ui.best.textContent = best;
    ui.mute.setAttribute("aria-pressed", String(audio.muted));

    function showOverlay(title, body, btn) {
      ui.oTitle.textContent = title; ui.oBody.textContent = body;
      ui.oBtn.textContent = btn || ""; ui.oBtn.hidden = !btn;
      ui.overlay.hidden = false;
    }
    function hideOverlay() { ui.overlay.hidden = true; }

    function refreshStats() {
      ui.score.textContent = engine.state.score;
      ui.level.textContent = engine.state.level;
      ui.lines.textContent = engine.state.lines;
    }

    function handleEvents(events, snapshot) {
      for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        switch (ev.type) {
          case "move": audio.play("move"); break;
          case "rotate": audio.play("rotate"); break;
          case "hold": audio.play("hold"); break;
          case "lock": audio.play("lock"); break;
          case "clear":
            audio.play(ev.lines === 4 ? "tetris" : "clear");
            if (snapshot) renderer.flash(ev.rows, snapshot);
            break;
          case "gameover": onGameOver(); break;
          default: break;
        }
      }
      if (events.length) { refreshStats(); renderer.drawHold(engine.state.hold); renderer.drawNext(engine.state.queue); }
    }

    function snapshotBoard() { return engine.state.board.map(function (row) { return row.slice(); }); }

    function onGameOver() {
      const s = engine.state;
      if (s.score > best) { best = s.score; writeBest(skin.name, best); ui.best.textContent = best; }
      audio.play("gameover");
      showOverlay(skin.strings.gameOver, skin.strings.score + " " + s.score + "\n" + skin.strings.best + " " + best, skin.strings.restart);
      if (global.parent !== global) {
        global.parent.postMessage({ v: 1, type: "gameover", game: "armaratris", skin: skin.name, score: s.score, lines: s.lines, level: s.level, seed: s.seed, inputsHash: engine.hash() }, "*");
      }
    }

    function start() {
      const st = engine.state.status;
      if (st === "ready") { audio.unlock(); handleEvents(engine.dispatch("start")); hideOverlay(); }
      else if (st === "over") { engine.reset(parseSeed(params.get("seed"))); refreshStats(); renderer.drawHold(null); renderer.drawNext(engine.state.queue); handleEvents(engine.dispatch("start")); hideOverlay(); }
      else if (st === "paused") { engine.dispatch("resume"); hideOverlay(); }
    }
    function pause() {
      if (engine.state.status === "playing") { engine.dispatch("pause"); showOverlay(skin.strings.paused, "", skin.strings.resume); }
      else if (engine.state.status === "paused") start();
    }
    function toggleMute() { const m = audio.toggle(); ui.mute.setAttribute("aria-pressed", String(m)); }

    const input = A.createInput({
      wellEl: wrap, touchEl: $("touch"), cellSize: function () { return renderer.cell; },
      onAction: function (action) {
        if (engine.state.status === "ready") { if (action !== "softDropOn" && action !== "softDropOff") start(); return; }
        if (engine.state.status !== "playing") return;
        const snap = action === "hardDrop" ? snapshotBoard() : null;
        handleEvents(engine.dispatch(action), snap);
      },
      onSystem: function (name) {
        if (name === "start") start();
        else if (name === "pause") pause();
        else if (name === "mute") toggleMute();
      },
    });

    ui.oBtn.addEventListener("click", function () { start(); });
    ui.overlay.addEventListener("pointerdown", function (e) { if (e.target === ui.oBtn) return; start(); });
    ui.mute.addEventListener("click", toggleMute);
    global.addEventListener("resize", function () { renderer.resize(); renderer.drawHold(engine.state.hold); renderer.drawNext(engine.state.queue); });
    document.addEventListener("visibilitychange", function () { if (document.hidden && engine.state.status === "playing") pause(); });

    // initial paint
    refreshStats();
    renderer.drawHold(null);
    renderer.drawNext(engine.state.queue);
    showOverlay(skin.title, skin.strings.start, "");

    let last = performance.now(), acc = 0;
    function frame(now) {
      let dt = now - last; last = now;
      if (dt > 250) dt = 250;
      acc += dt;
      input.update(dt);
      let steps = 0;
      while (acc >= STEP && steps < MAX_STEPS_PER_FRAME) {
        const snap = engine.state.status === "playing" ? snapshotBoard() : null;
        handleEvents(engine.tick(STEP), snap);
        acc -= STEP; steps++;
      }
      if (steps === MAX_STEPS_PER_FRAME) acc = 0;
      renderer.draw(engine.state, engine.state.active && engine.state.status === "playing" ? engine.ghostY() : undefined);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    document.body.dataset.ready = "1";
  }

  global.addEventListener("DOMContentLoaded", function () {
    boot().catch(function (err) {
      console.error(err);
      const o = document.getElementById("overlayTitle"); if (o) o.textContent = "FAILED TO LOAD";
      const b = document.getElementById("overlayBody"); if (b) b.textContent = String(err && err.message || err);
    });
  });
})(window);
```

Snapshot note: `snapshotBoard()` copies the board every tick while playing (22 small arrays — negligible) so the renderer can flash the pre-clear rows. If profiling ever shows it, only snapshot when the piece is grounded.

- [ ] **Step 2: Syntax-check everything and run the full test suite**

Run:
```bash
for f in js/*.js skin/armara/skin.js; do node --check "$f" || echo "SYNTAX FAIL $f"; done
node --test tests/
```
Expected: no syntax failures; all tests pass.

- [ ] **Step 3: Headless screenshots (desktop + mobile, start overlay)**

Run (Bash from `Armaratris`):
```bash
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"
[ -x "$CHROME" ] || CHROME="/c/Program Files (x86)/Google/Chrome/Application/chrome.exe"
URL="file:///$(pwd -W 2>/dev/null || pwd)/index.html"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --window-size=1280,800 --virtual-time-budget=5000 --screenshot="$PWD/tests/shot-desktop.png" "$URL"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --window-size=390,844 --virtual-time-budget=5000 --screenshot="$PWD/tests/shot-mobile.png" "$URL?seed=7"
ls -la tests/shot-*.png
```
Open both with the Read tool. Check: NEXT shows three pieces (desktop) / one piece (mobile); HOLD empty; the well shows the grid, faint hourglass watermark, Greek-key frame; overlay reads "ARMARATRIS / PRESS ENTER OR TAP TO BEGIN"; mobile shows the stats strip and four buttons and the well is not clipped.

- [ ] **Step 4: Interactive verification in a real browser**

Open `index.html` in Chrome (double-click) and run this checklist; fix anything that fails before moving on:
1. Enter starts the game; a piece falls; ghost outline shows below it.
2. ← → move (hold for auto-repeat), ↑/X rotate CW, Z rotate CCW, ↓ soft drop (score +1/cell), Space hard drop (score +2/cell, lock sound), C/Shift hold (HOLD panel updates; second press ignored until lock).
3. Clear a line: rows flash marble then collapse; score +100; LINES increments; clearing 10 lines shows LEVEL 2 and faster gravity.
4. P pauses (overlay "PAUSED"), P/Enter resumes. Switching tabs pauses automatically.
5. M or the ♪ button mutes; reload keeps mute state.
6. Stack to the top: "GAME OVER" overlay with score and BEST; BEST persists after reload; PLAY AGAIN starts a new game with a fresh seed.
7. `index.html?seed=42` twice: the first four pieces are identical both times.
8. `index.html?skin=nope`: console warning, Armara skin loads.
9. Chrome DevTools device mode, iPhone 12: swipe left/right moves, tap rotates, fast swipe down hard-drops, slow drag down soft-drops, swipe up holds; on-screen buttons work; long-press ⬇ soft-drops.
10. Resize the window: the well rescales without distortion.

- [ ] **Step 5: Screenshot mid-game for Ryan**

In the open browser, play ~30 seconds so the well has a stack, then in DevTools console run `document.title` (confirms "ARMARATRIS") and take a screenshot with the OS (Win+Shift+S) or Chrome's `Capture screenshot` command; save as `tests/shot-gameplay.png`. Alternatively, drive it headlessly: not needed if the manual checklist passed.

- [ ] **Step 6: Write a short README**

Create `README.md` in `Armaratris`:
```markdown
# Armaratris

Armara-branded Tetris. Static — open `index.html`.

- `?skin=<name>` selects `skin/<name>/` (default `armara`); `?seed=<n>` fixes the piece sequence.
- Controls: ← → move · ↑ / X rotate · Z rotate CCW · ↓ soft drop · Space hard drop · C / Shift hold · P pause · M mute. Touch: drag to move, tap to rotate, flick down to drop, swipe up to hold.
- Tests: `node --test tests/`
- New sponsor: copy `skin/armara/` to `skin/<name>/`, edit `skin.json`, regenerate `skin.js` (command in `docs/superpowers/plans/2026-08-25-armaratris.md`, Task 1 step 5), replace `logo.png`.
- Play-to-earn hook: on game over the page posts `{v:1, type:"gameover", game, skin, score, lines, level, seed, inputsHash}` to its parent frame. The engine is deterministic (seed + input log), so a server can replay a game to verify a score.
```

- [ ] **Step 7: (If git) commit**

`git add -A && git commit -m "feat(armaratris): main loop, overlays, high score, game-over bridge, README"`

---

## Self-review

**Spec coverage:** §2 file layout → Tasks 1, 4–8 (all files present; `skin.js` twin in Task 1). §3 engine rules/API/determinism → Tasks 2–3 (every rule has a test; `start` action added to the spec's list — it was implied by `status:"ready"`). §4 skin → Tasks 1 and 4. §5 renderer (bevel, ghost, watermark, marble ground, flash with reduced-motion) → Task 5. §6 input (keys, DAS/ARR, gestures, buttons, long-press soft drop) → Task 7. §7 audio → Task 6. §8 main (fixed timestep, overlays, best, postMessage, visibility pause) → Task 8. §9 layout desktop/mobile → Task 4 CSS + renderer sizing. §10 tests → Tasks 1–3 automated; browser checklist in Task 8. §11 out of scope respected.

**Placeholder scan:** none; every step has full code or an exact command. Task 8 step 5 offers a manual screenshot because headless Chrome cannot play the game — acceptable.

**Type consistency:** `createRenderer` options `{skin, wellCanvas, holdCanvas, nextCanvas, wrapEl}` match main.js; `createInput` options `{wellEl, touchEl, cellSize, onAction, onSystem}` match; engine events (`move, rotate, hold, lock, clear{lines, rows}, level, gameover`) match `handleEvents`; `engine.hash()`, `engine.reset(seed)`, `renderer.flash(rows, board)`, `renderer.cell`, `audio.unlock/toggle/muted/play` consistent across tasks.
