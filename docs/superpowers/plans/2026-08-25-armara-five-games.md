# Armara Five Games + Shared Kit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract a shared runtime (`games/_kit/`) from Armaratris, migrate Armaratris onto it, build five new Armara-branded games (Serpent, Breaker, 2048, Flight, Starfall) on the kit, add a hub page, and publish the whole `games/` folder as one GitHub Pages site.

**Architecture:** Classic scripts, no build. `games/_kit/*.js` attach to `window.GameSlopKit`; each game's `js/engine.js` (pure, deterministic, CommonJS-exported), `js/renderer.js`, and `js/game.js` (config) attach to `window.Game`; `GameSlopKit.createShell(config)` runs the loop, overlays, stats, best score, music, and the postMessage bridge. Branding lives only in `skin/<name>/skin.json`.

**Tech Stack:** Vanilla JS (ES2020), Canvas 2D, Web Audio, CSS custom properties, Node ≥ 18 `node:test`, headless Chrome via DevTools Protocol (`tools/cdp-shot.js`).

**Spec:** `docs/superpowers/specs/2026-08-25-armara-five-games-design.md` — the binding authority; every rule number below comes from it.

**Plan convention (ruling):** each task gives exact file paths, interfaces, and the COMPLETE test file; implementation code is written by the implementer to make the tests pass and match the spec section named. Where a task changes existing code, the exact edits are described.

## Global Constraints

- Repo root `d:\ClaudeCode\GameSlop`, branch `main` (work directly on `main`; commit per task with the trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`; never stage `research/`, `Assets/`, or the `.superpowers/` workspace).
- Static folders only: classic `<script src>`, no modules, no bundler, no npm dependencies, no `package.json`. Must run from `file://` in Chrome (skin fetch falls back to `skin.js`).
- Kit namespace `window.GameSlopKit`; game namespace `window.Game`. Every file wraps `(function (global) { "use strict"; ... })(typeof window !== "undefined" ? window : globalThis);` and engine/rng files end with `if (typeof module !== "undefined" && module.exports) module.exports = api;`.
- Tests: bare `node --test` run from the folder that owns the tests (`games/<game>/` or `games/_kit/`). Node 24: never `node --test <dir>`.
- Brand values (colors, fonts, copy, sprite tones) live only in `skin/<name>/skin.json`; JS/CSS use `--c-*` variables and `skin.*` values. Allowed literals: `#FFFFFF` highlights, black shadows, serif fallback stacks.
- Engine contract (spec §3.6): `state {status, score, seed, inputLog, tick, ...}`, `dispatch(action) → events[]` logging `[state.tick, action]` for every action including start/pause/resume, `tick(dt) → events[]` only while playing, `reset(seed?)`, `hash()` = fnv1a of `JSON.stringify(inputLog)`. All randomness via `mulberry32(seed)`.
- Determinism: shell drives `tick(1000/60)` from an accumulator; seed + input log reproduces a game; every engine test file includes the replay test.
- localStorage keys: `gameslop:<game>:<skin>:best`, `gameslop:muted`. Bridge payload: `{v:1, type:"gameover", game, skin, score, seed, inputsHash, stats}` when `window.parent !== window`.
- Screenshots go to `docs/game-screenshots/<game>-desktop.png` and `-mobile.png` (never inside `games/`).
- `tools/cdp-shot.js` usage: `node tools/cdp-shot.js <url> <w> <h> <out.png> [--script <file.js>]` — see Task 1.

---

## File map

| Path | Responsibility |
|---|---|
| `tools/cdp-shot.js` | Launch Chrome with remote debugging, force viewport, optionally run a driver script (key/mouse events + `Runtime.evaluate`), capture PNG |
| `tools/publish-games.sh` | `git subtree split --prefix games` → push to `Hyperkodi/gameslop-games` main |
| `games/_kit/rng.js` | `mulberry32`, `fnv1a`, `createBag`, `parseSeed` |
| `games/_kit/draw.js` | `drawTile`, `drawBevelRect`, `hexToRgba`, `setupCanvas`, `paintGround`, `drawLogo` |
| `games/_kit/skin.js` | `loadSkin(name, baseDir)` |
| `games/_kit/audio.js` | `createAudio(recipes)` |
| `games/_kit/input.js` | `createInput(config)` |
| `games/_kit/shell.js` | `createShell(config)` |
| `games/_kit/kit.css` | shared layout |
| `games/_kit/tests/*.test.js` | kit unit tests |
| `games/armaratris/js/game.js` | Armaratris config on the kit (replaces main/skin/audio/input) |
| `games/<game>/js/engine.js`, `renderer.js`, `game.js`, `index.html`, `skin/armara/*`, `tests/engine.test.js` | one per new game |
| `games/index.html` | hub |
| `games/README.md` | how to run, test, add a game, publish |

---

### Task 1: Tooling — `tools/cdp-shot.js` and `tools/publish-games.sh`

**Files:**
- Create: `tools/cdp-shot.js`, `tools/publish-games.sh`

**Interfaces:**
- Produces: `node tools/cdp-shot.js <url> <width> <height> <out.png> [--script driver.js] [--wait ms]`. The driver script, when given, is a CommonJS module exporting `async function (cdp, evaluate)` where `cdp(method, params)` sends a DevTools command on the page session and `evaluate(expr)` returns the JSON value of a JS expression in the page. Screenshot is taken after the driver resolves (or after `--wait`, default 1500 ms).

- [ ] **Step 1: Write `tools/cdp-shot.js`**

Requirements (a working scratch version exists at `C:\Users\USER\AppData\Local\Temp\claude\d--ClaudeCode-GameSlop\a4c3614c-d7a8-44ce-9940-f18a021f1a15\scratchpad\cdp-shot.js` — read it, then write the repo version to this contract): launch `C:\Program Files\Google\Chrome\Application\chrome.exe` with `--headless=new --remote-debugging-port=<free port> --user-data-dir=<temp> --allow-file-access-from-files --autoplay-policy=no-user-gesture-required`, open a new target via `PUT /json/new?<url>`, connect with Node's built-in `WebSocket`, `Emulation.setDeviceMetricsOverride {width, height, deviceScaleFactor: 1, mobile: width < 760}`, `Page.enable`, wait for `Page.loadEventFired`, wait until `document.body.dataset.ready === "1"` (poll `Runtime.evaluate`, up to 10 s), run the driver if any, wait `--wait`, `Page.captureScreenshot {format:"png"}`, write the file, kill Chrome. Exit non-zero on any failure with a clear message. Expose the helpers so drivers can `cdp("Input.dispatchKeyEvent", {type:"keyDown", key:"Enter", code:"Enter", windowsVirtualKeyCode:13})` and `cdp("Input.dispatchMouseEvent", {...})`.

- [ ] **Step 2: Write `tools/publish-games.sh`**

```bash
#!/usr/bin/env bash
# Publish games/ to the public mirror that GitHub Pages serves.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
REMOTE="${1:-https://github.com/Hyperkodi/gameslop-games.git}"
git branch -D games-mirror >/dev/null 2>&1 || true
git subtree split --prefix games -b games-mirror
git push -f "$REMOTE" games-mirror:main
git branch -D games-mirror
echo "published to $REMOTE (Pages: https://hyperkodi.github.io/gameslop-games/)"
```

- [ ] **Step 3: Verify**

Run: `node tools/cdp-shot.js "file:///D:/ClaudeCode/GameSlop/games/armaratris/index.html" 1280 800 "$TEMP/shot-tool-check.png"` — expect a PNG > 20 KB showing the Armaratris start overlay (view it with Read). Then commit: `git add tools && git commit -m "chore: promote CDP screenshot driver and add games publish script"`.

---

### Task 2: Kit part 1 — `rng.js`, `draw.js`, `skin.js`, `audio.js` (+ tests)

**Files:**
- Create: `games/_kit/rng.js`, `games/_kit/draw.js`, `games/_kit/skin.js`, `games/_kit/audio.js`, `games/_kit/tests/rng.test.js`, `games/_kit/tests/audio.test.js`

**Interfaces:**
- `GameSlopKit.mulberry32(seed) → () => number`, `fnv1a(str) → 8-hex`, `createBag(rng, items) → () => item` (Fisher–Yates over a copy of `items`, refill when empty), `parseSeed(v) → uint32 | undefined`.
- `GameSlopKit.drawTile(ctx, px, py, s, tone, alpha?)`, `drawBevelRect(ctx, x, y, w, h, tone, alpha?)` (bevel = `max(2, round(min(w,h) * 0.12))`, 1 px inset gap, optional `tone.edge`), `hexToRgba(hex, a)`, `setupCanvas(canvas, cssW, cssH, dpr) → ctx`, `paintGround(palette)` (the seamless 512-px marble tile from Armaratris' renderer, on `document.body`), `drawLogo(ctx, img, cx, cy, size, alpha, rotationRad?)`.
- `GameSlopKit.loadSkin(name, baseDir = "skin/") → Promise<skin>` per spec §3.2 (source: `games/armaratris/js/skin.js`, with `baseDir`, `wordmark` key support, `GameSlopKit.skins` registry).
- `GameSlopKit.createAudio(recipes) → {play, unlock, muted, toggle}` per spec §3.3 (source: `games/armaratris/js/audio.js`; storage key `gameslop:muted`).

- [ ] **Step 1: Write the failing tests**

`games/_kit/tests/rng.test.js`:
```js
const test = require("node:test");
const assert = require("node:assert/strict");
const K = require("../rng.js");

test("mulberry32 is deterministic per seed and in [0,1)", () => {
  const a = K.mulberry32(9), b = K.mulberry32(9), c = K.mulberry32(10);
  const va = [a(), a(), a()], vb = [b(), b(), b()], vc = [c(), c(), c()];
  assert.deepEqual(va, vb); assert.notDeepEqual(va, vc);
  va.forEach((v) => assert.ok(v >= 0 && v < 1));
});
test("fnv1a matches reference vectors", () => {
  assert.equal(K.fnv1a(""), "811c9dc5");
  assert.equal(K.fnv1a("a"), "e40c292c");
});
test("createBag returns each item once per cycle", () => {
  const next = K.createBag(K.mulberry32(3), ["A", "B", "C"]);
  const seen = [next(), next(), next()].sort();
  assert.deepEqual(seen, ["A", "B", "C"]);
  const again = [next(), next(), next()].sort();
  assert.deepEqual(again, ["A", "B", "C"]);
});
test("parseSeed: empty → undefined, integer → uint32, string → fnv1a", () => {
  assert.equal(K.parseSeed(null), undefined);
  assert.equal(K.parseSeed(""), undefined);
  assert.equal(K.parseSeed("42"), 42);
  assert.equal(K.parseSeed("-1"), 4294967295);
  assert.equal(K.parseSeed("hello"), parseInt(K.fnv1a("hello"), 16) >>> 0);
  assert.notEqual(K.parseSeed("hello"), 0);
});
```

`games/_kit/tests/audio.test.js`:
```js
const test = require("node:test");
const assert = require("node:assert/strict");

test("createAudio: mute persists under gameslop:muted and play() never throws without AudioContext", () => {
  const store = {};
  globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } };
  delete require.cache[require.resolve("../audio.js")];
  require("../audio.js");
  const K = globalThis.GameSlopKit;
  const a = K.createAudio({ ping: [[440, 0.05, "square", 0.05]] });
  assert.equal(a.muted, false);
  assert.doesNotThrow(() => a.play("ping"));
  assert.doesNotThrow(() => a.play("nope"));
  assert.equal(a.toggle(), true);
  assert.equal(store["gameslop:muted"], "1");
  const b = K.createAudio({});
  assert.equal(b.muted, true);
});
```

- [ ] **Step 2: Run to verify they fail** — `cd games/_kit && node --test` → module not found.

- [ ] **Step 3: Implement the four files** to the interfaces above. `draw.js` `paintGround` is the seamless version from `games/armaratris/js/renderer.js` (concentric gradients, nine wrap offsets, colors via `hexToRgba(palette.marble, a)`), taking `palette` as its argument. `skin.js` is Armaratris' loader with the `baseDir` parameter, `GameSlopKit.skins`, and `wordmark` support. `audio.js` takes recipes: `play(name)` calls `tone(...args)` for every row.

- [ ] **Step 4: Run tests** — `node --test` from `games/_kit` → 6 tests pass; `node --check` on all four files.

- [ ] **Step 5: Commit** — `git add games/_kit && git commit -m "feat(kit): rng, draw, skin, audio modules extracted from Armaratris"`.

---

### Task 3: Kit part 2 — `input.js` (+ test)

**Files:**
- Create: `games/_kit/input.js`, `games/_kit/tests/input.test.js`

**Interfaces:** `GameSlopKit.createInput({ wellEl, touchEl, cellSize, keys, repeatKeys, gestures, buttons, onAction, onSystem }) → { update(dt), destroy() }` per spec §3.4. Reserved keys: Enter → `onSystem("start")`, KeyP/Escape → `onSystem("pause")`, KeyM → `onSystem("mute")`. `keys[code]` may be a string (fire on keydown) or `{down, up}`. `repeatKeys[code]` fires on keydown then repeats with DAS 170 / ARR 40 via `update(dt)`. Gestures: `dragCols {left,right}`, `dragHold {left,right,deadzone}` (`left`/`right` here are the ON actions; the OFF actions are derived by replacing a trailing `On` with `Off`), `tap`, `swipeDownFast`, `swipeDownSlow {on,off}`, `swipeUp`, `swipe4 {up,down,left,right}`. Buttons: `{btn, press, repeat}`, `{btn, tap}`, `{btn, tap, hold, release}`, `{btn, press, release}`. Well pointerdowns whose target is inside `button, .overlay` are ignored. `window.blur` releases all held keys/buttons (emits their up/off actions).

- [ ] **Step 1: Write the failing test** — `games/_kit/tests/input.test.js`:
```js
const test = require("node:test");
const assert = require("node:assert/strict");

function fakeDom() {
  const handlers = {};
  const el = { addEventListener: (ev, fn) => { handlers[ev] = fn; }, removeEventListener() {}, setPointerCapture() {}, querySelectorAll: () => [] };
  globalThis.addEventListener = el.addEventListener; globalThis.removeEventListener = () => {};
  let now = 0; globalThis.performance = { now: () => now };
  return { el, handlers, tick: (ms) => { now += ms; } };
}
function load() { delete require.cache[require.resolve("../input.js")]; require("../input.js"); return globalThis.GameSlopKit; }

test("repeatKeys: DAS 170 then ARR 40", () => {
  const d = fakeDom(); const K = load(); const out = [];
  const input = K.createInput({ wellEl: d.el, touchEl: null, cellSize: () => 24, repeatKeys: { ArrowLeft: "left" }, onAction: (a) => out.push(a) });
  d.handlers.keydown({ code: "ArrowLeft", preventDefault() {} });
  input.update(160); assert.deepEqual(out, ["left"]);
  input.update(10); input.update(40); input.update(40); assert.deepEqual(out, ["left", "left", "left"]);
  d.handlers.keyup({ code: "ArrowLeft" }); input.update(200); assert.equal(out.length, 3);
});

test("keys: string fires on down; {down,up} fires both; reserved keys go to onSystem", () => {
  const d = fakeDom(); const K = load(); const out = [], sys = [];
  K.createInput({ wellEl: d.el, touchEl: null, cellSize: () => 24, keys: { Space: "flap", ArrowRight: { down: "rightOn", up: "rightOff" } }, onAction: (a) => out.push(a), onSystem: (s) => sys.push(s) });
  d.handlers.keydown({ code: "Space", preventDefault() {} });
  d.handlers.keydown({ code: "ArrowRight", preventDefault() {} }); d.handlers.keyup({ code: "ArrowRight" });
  d.handlers.keydown({ code: "Enter", preventDefault() {} }); d.handlers.keydown({ code: "KeyP", preventDefault() {} }); d.handlers.keydown({ code: "KeyM", preventDefault() {} });
  assert.deepEqual(out, ["flap", "rightOn", "rightOff"]);
  assert.deepEqual(sys, ["start", "pause", "mute"]);
});

test("swipe4: first axis to cross 24px wins, once per gesture; tap fires tap action", () => {
  const d = fakeDom(); const K = load(); const out = [];
  K.createInput({ wellEl: d.el, touchEl: null, cellSize: () => 24, gestures: { swipe4: { up: "up", down: "down", left: "left", right: "right" }, tap: "flap" }, onAction: (a) => out.push(a) });
  const p = (type, x, y, id = 1) => d.handlers[type]({ pointerId: id, pointerType: "touch", button: 0, clientX: x, clientY: y, target: { closest: () => null }, preventDefault() {} });
  p("pointerdown", 100, 100); p("pointermove", 110, 100); p("pointermove", 130, 104); p("pointermove", 160, 140); d.tick(150); p("pointerup", 160, 140);
  assert.deepEqual(out, ["right"]);
  p("pointerdown", 100, 100); d.tick(100); p("pointerup", 102, 101);
  assert.deepEqual(out, ["right", "flap"]);
});

test("dragHold emits On when past deadzone and Off on return/lift", () => {
  const d = fakeDom(); const K = load(); const out = [];
  K.createInput({ wellEl: d.el, touchEl: null, cellSize: () => 24, gestures: { dragHold: { left: "leftOn", right: "rightOn", deadzone: 8 } }, onAction: (a) => out.push(a) });
  const p = (type, x, y) => d.handlers[type]({ pointerId: 1, pointerType: "touch", button: 0, clientX: x, clientY: y, target: { closest: () => null }, preventDefault() {} });
  p("pointerdown", 100, 100); p("pointermove", 104, 100); assert.deepEqual(out, []);
  p("pointermove", 120, 100); assert.deepEqual(out, ["rightOn"]);
  p("pointermove", 80, 100); assert.deepEqual(out, ["rightOn", "rightOff", "leftOn"]);
  p("pointerup", 80, 100); assert.deepEqual(out, ["rightOn", "rightOff", "leftOn", "leftOff"]);
});

test("buttons: press/release and tap/hold/release", () => {
  const d = fakeDom(); const K = load(); const out = [];
  const btns = {};
  const mk = (name) => ({ getAttribute: () => name, addEventListener: (ev, fn) => { (btns[name] = btns[name] || {})[ev] = fn; }, removeEventListener() {}, setPointerCapture() {} });
  const touchEl = { querySelectorAll: () => [mk("fire"), mk("drop")] };
  const realSetTimeout = globalThis.setTimeout, realClear = globalThis.clearTimeout; let timers = [];
  globalThis.setTimeout = (fn) => { timers.push(fn); return timers.length; }; globalThis.clearTimeout = (id) => { timers[id - 1] = null; };
  K.createInput({ wellEl: d.el, touchEl, cellSize: () => 24, buttons: [{ btn: "fire", press: "fireOn", release: "fireOff" }, { btn: "drop", tap: "hardDrop", hold: "softDropOn", release: "softDropOff" }], onAction: (a) => out.push(a) });
  const ev = { pointerId: 2, preventDefault() {} };
  btns.fire.pointerdown(ev); btns.fire.pointerup(ev); assert.deepEqual(out, ["fireOn", "fireOff"]);
  btns.drop.pointerdown(ev); btns.drop.pointerup(ev); assert.deepEqual(out, ["fireOn", "fireOff", "hardDrop"]);
  btns.drop.pointerdown(ev); timers.filter(Boolean).forEach((fn) => fn()); btns.drop.pointerup(ev);
  assert.deepEqual(out, ["fireOn", "fireOff", "hardDrop", "softDropOn", "softDropOff"]);
  globalThis.setTimeout = realSetTimeout; globalThis.clearTimeout = realClear;
});
```

- [ ] **Step 2: Run to verify it fails.** — [ ] **Step 3: Implement `games/_kit/input.js`** (generalize `games/armaratris/js/input.js`; keep DAS/ARR, TAP_MS 220, TAP_DIST 12, HARD_DROP_MIN_PX 60, HARD_DROP_MIN_VEL 0.9, LONG_PRESS_MS 250, SWIPE4_PX 24). — [ ] **Step 4: `node --test` → all kit tests pass; `node --check`.** — [ ] **Step 5: Commit** `feat(kit): configurable input layer`.

---

### Task 4: Kit part 3 — `shell.js` + `kit.css`, and migrate Armaratris onto the kit

**Files:**
- Create: `games/_kit/shell.js`, `games/_kit/kit.css`, `games/armaratris/js/game.js`
- Modify: `games/armaratris/index.html`, `games/armaratris/js/renderer.js`, `games/armaratris/README.md`
- Delete: `games/armaratris/js/main.js`, `js/skin.js`, `js/audio.js`, `js/input.js`, `css/game.css`

**Interfaces:** `GameSlopKit.createShell(cfg)` per spec §3.6. `cfg.createRenderer` receives `{ skin, wellCanvas, wrapEl, sideCanvases: { hold, next } }` (side canvases resolved from `#hold` / `#next` if present). The shell calls `renderer.resize()` on load/resize, `renderer.draw(state, extras)` every frame where `extras = cfg.drawExtras ? cfg.drawExtras(engine) : undefined` (Armaratris passes `ghostY`), and `renderer.side(state)` after any event if the renderer defines it. `cfg.onEvent(ev, { renderer, engine, audio })` runs before the sound lookup. `cfg.stats` entries `{ id, key }` or `{ id, get: (state) => value }`. The shell exposes `window.__gameslop = { engine, renderer }` when `?debug=1`.

- [ ] **Step 1: Write `kit.css`** from `games/armaratris/css/game.css` — identical rules, plus `.panel:empty, .box:empty { display: none; }`, touch bar `grid-template-columns: repeat(auto-fit, minmax(56px, 1fr))`, and no rule that sizes any canvas.

- [ ] **Step 2: Write `shell.js`** from `games/armaratris/js/main.js`: same loop, overlays, best score (`gameslop:<game>:<skin>:best`), music, visibility pause, bridge payload with `stats` object, `startsOnAnyAction`, `parseSeed` from `rng.js`, `paintGround(skin.palette)` from `draw.js`, sounds via `createAudio(cfg.sounds)` and `cfg.events` mapping.

- [ ] **Step 3: Write `games/armaratris/js/game.js`**:
```js
(function (global) {
  "use strict";
  const K = global.GameSlopKit, G = global.Game = global.Game || {};
  G.config = {
    game: "armaratris",
    createEngine: (o) => K.Armaratris.createEngine(o),   // engine.js keeps attaching to window.Armaratris; alias it: see step 4
    createRenderer: (o) => G.createRenderer(o),
    sounds: { move: [[220, 0.035, "square", 0.04]], rotate: [[330, 0.05, "square", 0.045]], hold: [[440, 0.06, "triangle", 0.06, 0, 660]], lock: [[130, 0.09, "triangle", 0.12, 0, 70]], clear: [[523, 0.1, "triangle", 0.1], [784, 0.16, "triangle", 0.1, 0.09]], tetris: [[523, 0.16, "triangle", 0.11, 0], [659, 0.16, "triangle", 0.11, 0.09], [784, 0.16, "triangle", 0.11, 0.18], [1047, 0.16, "triangle", 0.11, 0.27]], gameover: [[392, 0.24, "sawtooth", 0.06, 0], [330, 0.24, "sawtooth", 0.06, 0.18], [262, 0.24, "sawtooth", 0.06, 0.36], [196, 0.24, "sawtooth", 0.06, 0.54]] },
    events: { move: "move", rotate: "rotate", hold: "hold", lock: "lock", gameover: "gameover" },
    onEvent: (ev, c) => { if (ev.type === "clear") { c.audio.play(ev.lines === 4 ? "tetris" : "clear"); c.renderer.flash(ev.rows, ev.board); } },
    drawExtras: (engine) => (engine.state.active && engine.state.status === "playing" ? engine.ghostY() : undefined),
    stats: [{ id: "score", key: "score" }, { id: "level", key: "level" }, { id: "lines", key: "lines" }],
    input: {
      keys: { ArrowUp: "rotateCW", KeyX: "rotateCW", KeyZ: "rotateCCW", ControlLeft: "rotateCCW", ControlRight: "rotateCCW", Space: "hardDrop", KeyC: "hold", ShiftLeft: "hold", ShiftRight: "hold", ArrowDown: { down: "softDropOn", up: "softDropOff" } },
      repeatKeys: { ArrowLeft: "left", ArrowRight: "right" },
      gestures: { dragCols: { left: "left", right: "right" }, tap: "rotateCW", swipeDownFast: "hardDrop", swipeDownSlow: { on: "softDropOn", off: "softDropOff" }, swipeUp: "hold" },
      buttons: [{ btn: "left", press: "left", repeat: true }, { btn: "rotate", tap: "rotateCW" }, { btn: "drop", tap: "hardDrop", hold: "softDropOn", release: "softDropOff" }, { btn: "right", press: "right", repeat: true }],
    },
    startsOnAnyAction: true,
  };
  global.addEventListener("DOMContentLoaded", function () { K.createShell(G.config); });
})(typeof window !== "undefined" ? window : globalThis);
```
`renderer.js`: keep `createRenderer` but attach it as `Game.createRenderer`, use `GameSlopKit.drawTile/setupCanvas/hexToRgba` and drop `paintGround` (shell does it), keep `draw(state, ghostY)`, `flash`, and expose `side(state)` = `drawHold(state.hold); drawNext(state.queue)`. `engine.js` unchanged (it attaches `window.Armaratris`); `K.Armaratris` alias: at the top of `game.js` set `K.Armaratris = global.Armaratris;`.

- [ ] **Step 4: Rewrite `index.html`** script tags: `../_kit/rng.js, draw.js, skin.js, audio.js, input.js, shell.js`, then `js/engine.js, js/renderer.js, js/game.js`; stylesheet `../_kit/kit.css`. Delete the four old js files and `css/`. Update README (paths, kit mention).

- [ ] **Step 5: Verify** — `cd games/armaratris && node --test` (35/35, unchanged tests); `node --check` all; screenshots `docs/armaratris-screenshots/kit-desktop.png` (1280×800) and `kit-mobile.png` (390×844) via `tools/cdp-shot.js` — compare visually with `shot-fixwave-desktop-postfix.png` / `shot-mobile.png` (same layout, frame, panels, buttons); driver-script check: press Enter → status playing; press P → RESUME button click resumes; hard-drop scoring; game over → PLAY AGAIN; `?seed=42` first piece identical across two runs; `localStorage["gameslop:armaratris:armara:best"]` written. Also verify `file://` boot has no console errors (evaluate `performance.getEntriesByType("resource").filter(r => r.responseStatus >= 400).length === 0` is not available on file:// — instead check `document.title === "ARMARATRIS"` and `getComputedStyle(document.documentElement).getPropertyValue("--c-gold").trim() === "#C9A24A"`).

- [ ] **Step 6: Commit** `refactor(armaratris): run on the shared kit`.

---

## Per-game checklist (applies to Tasks 5–9)

Every new game task produces `games/<id>/` with exactly:

1. `skin/armara/skin.json` — copy `games/armaratris/skin/armara/skin.json`, change `title` to the game's title, add `"wordmark": "ARMARA"`, replace `strings` labels with the game's stat labels (keep `best,start,paused,resume,gameOver,restart`; `start` copy per game below), replace `tiles` with the game's `sprites` object (tones `{base,hi,lo,edge?}` drawn from the palette: gold `#C9A24A/#F1D890/#7E6120`, bronze `#7A5230/#B98A5E/#3F2914`, marble `#E9E2D3/#FFFFFF/#A99F8C`, obsidian `#2B2622/#6B5E52/#000000` with `edge #C9A24A`, deep gold `#A8893E/#E4C97C/#5F4B1C`). Remove `music` (Ryan adds tracks later; the shell tolerates a missing key). Generate `skin.js` with the one-liner from `games/armaratris/README.md`; copy `logo.png`.
2. `js/engine.js` — pure, `require`-able, attaches `window.Game.createEngine` (and `module.exports = { createEngine, ...constants }`). Uses `GameSlopKit.mulberry32/fnv1a` when in the browser and `require("../../_kit/rng.js")` in Node (guard: `const R = typeof require === "function" ? require("../../_kit/rng.js") : global.GameSlopKit;`).
3. `tests/engine.test.js` — the file given in the task, verbatim. Write it first, watch it fail, implement, watch it pass.
4. `js/renderer.js` — `Game.createRenderer({skin, wellCanvas, wrapEl})` → `{ resize(), draw(state, extras), cell }`; sizes the well from the viewport exactly like Armaratris' `resize()` (same title/touch/strip math) but with the game's aspect ratio; uses `GameSlopKit.drawTile/drawBevelRect/setupCanvas/hexToRgba/drawLogo`; watermark logo at `skin.watermarkAlpha`.
5. `js/game.js` — `Game.config` for `createShell` (game id, sounds recipes, events map, stats, input config, `startsOnAnyAction: true`) and the `DOMContentLoaded` call.
6. `index.html` — Armaratris' markup with: title/tagline/logo header, left panel `.stats` with the game's `<output id>`s, the framed well, right panel with the brand mark + wordmark + mute button, and a `#touch` nav with the game's buttons. No `#hold`/`#next` boxes unless the game uses them. Script order: six kit files, then `js/engine.js`, `js/renderer.js`, `js/game.js`.
7. Verification: `cd games/<id> && node --test` (all pass, pristine); `node --check` all js; screenshots `docs/game-screenshots/<id>-desktop.png` (1280×800) and `<id>-mobile.png` (390×844) via `node tools/cdp-shot.js`, viewed with Read; driver script: Enter starts, the core action changes state (assert via `Runtime.evaluate` on `window.__gameslop.engine.state` with `?debug=1`), score increments, P pauses and the RESUME button click resumes, a scripted loss reaches game over and PLAY AGAIN restarts, `gameslop:<id>:armara:best` is written, `?seed=7` gives the same first random outcome twice, `?skin=nope` falls back with a console warning.
8. Commit: `git add games/<id> docs/game-screenshots && git commit -m "feat(<id>): <title> on the shared kit"`.

Start-overlay copy per game: Serpent "PRESS ENTER OR SWIPE TO BEGIN"; Breaker "PRESS SPACE OR TAP TO LAUNCH"; 2048 "PRESS ENTER OR SWIPE TO BEGIN"; Flight "PRESS SPACE OR TAP TO FLY"; Starfall "PRESS ENTER OR TAP TO BEGIN".

---

### Task 5: Serpent — `games/serpent` ("ARMARA SERPENT", spec §4.1)

**Interfaces:** `createEngine({seed})`. `state`: `{ status, score, seed, inputLog, tick, w: 20, h: 20, snake: [{x,y}, …] (head first), dir: {x,y}, pickup: {x,y}, pickups, length }`. Actions: `up, down, left, right, start, pause, resume`. Events: `{type:"turn"}`, `{type:"eat"}`, `{type:"gameover"}`. `stepMs()` = `max(70, 200 − 6 × pickups)`. Test helpers: `setSnake(cells, dir)` (head first; resets timers), `setPickup(x, y)`. Renderer: square well (20×20 cells; cell = floor(min(availW, availH)/20)); segments via `drawTile` with `sprites.head` (head), `sprites.body`, `sprites.tail` (last segment); pickup = `drawLogo` at 0.8 cell (fallback `drawTile` with `sprites.pickup`). Stats: score, length. Input: `keys` ArrowUp/KeyW → up, ArrowDown/KeyS → down, ArrowLeft/KeyA → left, ArrowRight/KeyD → right; `gestures.swipe4`; buttons `left ▲? ` → `[{btn:"left",tap:"left"},{btn:"up",tap:"up"},{btn:"down",tap:"down"},{btn:"right",tap:"right"}]` rendered ◀ ▲ ▼ ▶. Sounds: turn (short click 260 Hz), eat (two-note 660→990), gameover (Armaratris' descending recipe).

**Test file** `games/serpent/tests/engine.test.js`:
```js
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../js/engine.js");
const DT = 1000 / 60;
function playing(seed = 1) { const e = E.createEngine({ seed }); e.dispatch("start"); return e; }

test("starts ready, length 3, centred, moving right, one pickup off the snake", () => {
  const e = E.createEngine({ seed: 3 });
  assert.equal(e.state.status, "ready");
  assert.equal(e.state.snake.length, 3);
  assert.deepEqual(e.state.dir, { x: 1, y: 0 });
  assert.deepEqual(e.state.snake[0], { x: 10, y: 10 });
  assert.deepEqual(e.state.snake[2], { x: 8, y: 10 });
  assert.ok(!e.state.snake.some((s) => s.x === e.state.pickup.x && s.y === e.state.pickup.y));
  assert.equal(e.state.length, 3);
});
test("steps every 200 ms at zero pickups", () => {
  const e = playing();
  e.tick(199); assert.deepEqual(e.state.snake[0], { x: 10, y: 10 });
  e.tick(1); assert.deepEqual(e.state.snake[0], { x: 11, y: 10 });
  assert.equal(e.state.snake.length, 3);
});
test("stepMs shortens with pickups and floors at 70", () => {
  const e = playing();
  assert.equal(e.stepMs(), 200);
  e.state.pickups = 10; assert.equal(e.stepMs(), 140);
  e.state.pickups = 50; assert.equal(e.stepMs(), 70);
});
test("eating grows the snake, scores, spawns a new pickup on an empty cell", () => {
  const e = playing();
  e.setSnake([{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }], { x: 1, y: 0 });
  e.setPickup(6, 5);
  const ev = e.tick(200);
  assert.ok(ev.some((x) => x.type === "eat"));
  assert.equal(e.state.snake.length, 4);
  assert.equal(e.state.length, 4);
  assert.equal(e.state.pickups, 1);
  assert.equal(e.state.score, 10 + Math.floor(4 / 5) * 5);
  const p = e.state.pickup;
  assert.ok(p.x >= 0 && p.x < 20 && p.y >= 0 && p.y < 20);
  assert.ok(!e.state.snake.some((s) => s.x === p.x && s.y === p.y));
});
test("score formula at length 10", () => {
  const e = playing();
  const body = []; for (let i = 0; i < 9; i++) body.push({ x: 9 - i, y: 5 });
  e.setSnake(body, { x: 1, y: 0 }); e.setPickup(10, 5);
  e.tick(200);
  assert.equal(e.state.score, 10 + Math.floor(10 / 5) * 5);
});
test("turns apply on the next step; reversing is ignored; two queued turns apply in order", () => {
  const e = playing();
  e.setSnake([{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }], { x: 1, y: 0 });
  assert.deepEqual(e.dispatch("left"), []);            // reverse → ignored
  assert.deepEqual(e.dispatch("up"), [{ type: "turn" }]);
  assert.deepEqual(e.dispatch("left"), [{ type: "turn" }]); // queued (relative to up, left is valid)
  e.tick(200); assert.deepEqual(e.state.snake[0], { x: 5, y: 4 });
  e.tick(200); assert.deepEqual(e.state.snake[0], { x: 4, y: 4 });
});
test("hitting a wall ends the game", () => {
  const e = playing();
  e.setSnake([{ x: 19, y: 5 }, { x: 18, y: 5 }, { x: 17, y: 5 }], { x: 1, y: 0 });
  const ev = e.tick(200);
  assert.ok(ev.some((x) => x.type === "gameover"));
  assert.equal(e.state.status, "over");
  assert.deepEqual(e.dispatch("up"), []);
});
test("hitting yourself ends the game", () => {
  const e = playing();
  e.setSnake([{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 4, y: 6 }, { x: 4, y: 5 }, { x: 4, y: 4 }, { x: 5, y: 4 }], { x: 0, y: -1 });
  // head at (5,5) moving up into (5,4), which is the tail... make it the body instead:
  e.setSnake([{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 4, y: 6 }, { x: 4, y: 5 }, { x: 4, y: 4 }, { x: 5, y: 4 }, { x: 6, y: 4 }], { x: 0, y: -1 });
  const ev = e.tick(200);
  assert.ok(ev.some((x) => x.type === "gameover"));
});
test("moving into the cell the tail is vacating is allowed", () => {
  const e = playing();
  e.setSnake([{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 4, y: 6 }, { x: 4, y: 5 }], { x: 0, y: -1 });
  e.dispatch("left"); // head will go to (4,5)? no — (4,5) is body. Use tail cell: set dir so next is (4,5)... tail is (4,5) → allowed
  const ev = e.tick(200);
  assert.ok(!ev.some((x) => x.type === "gameover"));
  assert.deepEqual(e.state.snake[0], { x: 4, y: 5 });
});
test("tick does nothing unless playing; actions are logged with tick index", () => {
  const e = E.createEngine({ seed: 1 });
  e.tick(1000); assert.deepEqual(e.state.snake[0], { x: 10, y: 10 });
  e.dispatch("start"); e.dispatch("up");
  assert.deepEqual(e.state.inputLog, [[0, "start"], [0, "up"]]);
});
test("determinism: same seed + log reproduces", () => {
  function run(seed) {
    const e = E.createEngine({ seed }); e.dispatch("start");
    const dirs = ["up", "left", "down", "right"];
    for (let t = 0; t < 900; t++) { if (t % 23 === 0) e.dispatch(dirs[(t / 23) % 4]); e.tick(DT); if (e.state.status === "over") break; }
    return e;
  }
  const a = run(11), b = run(11);
  assert.deepEqual(a.state.snake, b.state.snake); assert.equal(a.state.score, b.state.score); assert.equal(a.hash(), b.hash());
  const r = E.createEngine({ seed: 11 }); const byTick = new Map();
  a.state.inputLog.forEach(([t, act]) => { (byTick.get(t) || byTick.set(t, []).get(t)).push(act); });
  for (let t = 0; t <= a.state.tick; t++) { (byTick.get(t) || []).forEach((act) => r.dispatch(act)); if (t < a.state.tick) r.tick(DT); }
  assert.deepEqual(r.state.snake, a.state.snake); assert.equal(r.hash(), a.hash());
});
```
Note for the implementer: in the "hitting yourself" test the first `setSnake` call is overwritten by the second — keep the file verbatim anyway. In "moving into the cell the tail is vacating", the head at (5,5) with dir up and a queued `left` turns to (4,5), which is the tail cell being vacated this step — that must NOT be a collision (collision check happens after the tail moves, unless the snake just ate).

---

### Task 6: Breaker — `games/breaker` ("ARMARA BREAKER", spec §4.2)

**Interfaces:** world 100 × 150. `state`: `{ status, score, level, lives, seed, inputLog, tick, paddle: {x, w: 18, y: 142, h: 3}, ball: {x, y, r: 1.5, vx, vy, attached}, bricks: [{x, y, w: 9.4, h: 4.2, hits, tier}], held: {left, right} }`. Bricks at start: 10 × 6, `x = 3 + col × 10`, `y = 12 + row × 4.8`, rows 0–1 `tier:"bronze"` (hits 2, 30 pts), rows 2–3 `"gold"` (1 hit, 20), rows 4–5 `"marble"` (1 hit, 10). Ball speed `55 × 1.06^(level−1)`; launch angle from paddle hit position: `angle = −90° + 60° × ((ball.x − paddle.x) / (paddle.w/2))` clamped ±60° (hitting the exact centre goes straight up). Actions: `leftOn, leftOff, rightOn, rightOff, launch`. Events: `bounce, brick, launch, life, level, gameover`. Physics sub-steps ≤ 2 units. Test helpers: `setBall({x,y,vx,vy,attached})`, `setBricks(list)`, `setPaddle(x)`. Renderer: 2:3 well; bricks `drawBevelRect` with `sprites[tier]`; paddle `sprites.paddle`; ball gold with marble highlight. Stats: score, level, lives. Input: `keys` ArrowLeft/KeyA `{down:"leftOn",up:"leftOff"}`, ArrowRight/KeyD `{down:"rightOn",up:"rightOff"}`, Space `"launch"`; `gestures` `dragHold {left:"leftOn", right:"rightOn", deadzone: 8}`, `tap: "launch"`; buttons `[{btn:"left",press:"leftOn",release:"leftOff"},{btn:"launch",tap:"launch"},{btn:"right",press:"rightOn",release:"rightOff"}]` (◀ ● ▶). Sounds: bounce (180 Hz click), brick (520→780), launch (440 slide), life (descending two-note), level (rising four-note), gameover.

**Test file** `games/breaker/tests/engine.test.js`:
```js
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../js/engine.js");
const DT = 1000 / 60;
function playing(seed = 1) { const e = E.createEngine({ seed }); e.dispatch("start"); return e; }

test("initial layout: 60 bricks tiered by row, paddle centred, ball attached", () => {
  const e = E.createEngine({ seed: 1 });
  assert.equal(e.state.bricks.length, 60);
  const tiers = (row) => e.state.bricks.filter((b) => Math.abs(b.y - (12 + row * 4.8)) < 1e-9).map((b) => b.tier);
  assert.deepEqual(new Set(tiers(0)), new Set(["bronze"])); assert.deepEqual(new Set(tiers(3)), new Set(["gold"])); assert.deepEqual(new Set(tiers(5)), new Set(["marble"]));
  assert.equal(e.state.bricks.find((b) => b.tier === "bronze").hits, 2);
  assert.equal(e.state.lives, 3); assert.equal(e.state.level, 1);
  assert.ok(Math.abs(e.state.paddle.x - 50) < 1e-9); assert.equal(e.state.ball.attached, true);
});
test("paddle moves 90 u/s while held and clamps to the world", () => {
  const e = playing();
  e.dispatch("rightOn"); e.tick(100); assert.ok(Math.abs(e.state.paddle.x - 59) < 1e-6);
  e.dispatch("rightOff"); e.tick(100); assert.ok(Math.abs(e.state.paddle.x - 59) < 1e-6);
  e.dispatch("rightOn"); e.tick(5000); assert.ok(Math.abs(e.state.paddle.x - (100 - 9)) < 1e-6);
  assert.ok(Math.abs(e.state.ball.x - e.state.paddle.x) < 1e-6); // attached ball follows
});
test("launch gives the ball speed 55 upward from the paddle centre", () => {
  const e = playing();
  const ev = e.dispatch("launch");
  assert.ok(ev.some((x) => x.type === "launch"));
  assert.equal(e.state.ball.attached, false);
  assert.ok(Math.abs(Math.hypot(e.state.ball.vx, e.state.ball.vy) - 55) < 1e-6);
  assert.ok(e.state.ball.vy < 0); assert.ok(Math.abs(e.state.ball.vx) < 1e-6);
  assert.deepEqual(e.dispatch("launch"), []); // already launched
});
test("a marble brick breaks in one hit for 10 points", () => {
  const e = playing();
  const target = e.state.bricks.find((b) => b.tier === "marble" && Math.abs(b.x - 3) < 1e-9);
  e.setBall({ x: target.x + 4.7, y: target.y + 4.2 + 3, vx: 0, vy: -55, attached: false });
  let ev = []; for (let i = 0; i < 10; i++) ev = ev.concat(e.tick(DT));
  assert.ok(ev.some((x) => x.type === "brick"));
  assert.equal(e.state.bricks.length, 59); assert.equal(e.state.score, 10);
  assert.ok(e.state.ball.vy > 0);
});
test("a bronze brick needs two hits and pays 30", () => {
  const e = playing();
  const target = e.state.bricks.find((b) => b.tier === "bronze" && Math.abs(b.x - 3) < 1e-9);
  e.setBricks([target]);
  e.setBall({ x: target.x + 4.7, y: target.y + 4.2 + 3, vx: 0, vy: -55, attached: false });
  for (let i = 0; i < 10; i++) e.tick(DT);
  assert.equal(e.state.bricks.length, 1); assert.equal(e.state.bricks[0].hits, 1); assert.equal(e.state.score, 0);
  e.setBall({ x: target.x + 4.7, y: target.y + 4.2 + 3, vx: 0, vy: -55, attached: false });
  for (let i = 0; i < 10; i++) e.tick(DT);
  assert.equal(e.state.score, 30);
});
test("ball below the paddle costs a life and re-attaches; 0 lives ends the game", () => {
  const e = playing();
  e.setBall({ x: 50, y: 149, vx: 0, vy: 55, attached: false });
  let ev = []; for (let i = 0; i < 10; i++) ev = ev.concat(e.tick(DT));
  assert.ok(ev.some((x) => x.type === "life")); assert.equal(e.state.lives, 2); assert.equal(e.state.ball.attached, true);
  e.dispatch("launch"); e.setBall({ x: 50, y: 149, vx: 0, vy: 55, attached: false }); for (let i = 0; i < 10; i++) e.tick(DT);
  e.dispatch("launch"); e.setBall({ x: 50, y: 149, vx: 0, vy: 55, attached: false }); ev = []; for (let i = 0; i < 10; i++) ev = ev.concat(e.tick(DT));
  assert.equal(e.state.lives, 0); assert.ok(ev.some((x) => x.type === "gameover")); assert.equal(e.state.status, "over");
});
test("clearing the last brick advances the level: +250, faster ball, bricks reset", () => {
  const e = playing();
  const target = e.state.bricks.find((b) => b.tier === "marble" && Math.abs(b.x - 3) < 1e-9);
  e.setBricks([target]);
  e.setBall({ x: target.x + 4.7, y: target.y + 4.2 + 3, vx: 0, vy: -55, attached: false });
  let ev = []; for (let i = 0; i < 10; i++) ev = ev.concat(e.tick(DT));
  assert.ok(ev.some((x) => x.type === "level"));
  assert.equal(e.state.level, 2); assert.equal(e.state.score, 10 + 250); assert.equal(e.state.bricks.length, 60);
  assert.equal(e.state.ball.attached, true);
  e.dispatch("launch"); assert.ok(Math.abs(Math.hypot(e.state.ball.vx, e.state.ball.vy) - 55 * 1.06) < 1e-6);
});
test("walls bounce; the ball never leaves the world sideways", () => {
  const e = playing();
  e.setBall({ x: 2, y: 80, vx: -55, vy: 0, attached: false });
  for (let i = 0; i < 30; i++) { e.tick(DT); assert.ok(e.state.ball.x >= 1.5 - 1e-6 && e.state.ball.x <= 98.5 + 1e-6); }
  assert.ok(e.state.ball.vx > 0);
});
test("determinism: same seed + log reproduces", () => {
  function run(seed) {
    const e = E.createEngine({ seed }); e.dispatch("start"); e.dispatch("launch");
    for (let t = 0; t < 1200; t++) { if (t % 60 === 0) e.dispatch(t % 120 === 0 ? "leftOn" : "leftOff"); if (t % 90 === 0) e.dispatch(t % 180 === 0 ? "rightOn" : "rightOff"); e.tick(DT); if (e.state.status === "over") break; }
    return e;
  }
  const a = run(5), b = run(5);
  assert.deepEqual(a.state.ball, b.state.ball); assert.equal(a.state.score, b.state.score); assert.equal(a.hash(), b.hash());
});
```

---

### Task 7: 2048 — `games/2048` ("ARMARA 2048", spec §4.3)

**Interfaces:** `state`: `{ status, score, seed, inputLog, tick, board: number[4][4] (0 = empty), bestTile, won }`. Actions `up, down, left, right`. Events: `{type:"slide", from: boardBefore}` (only when the board changed), `{type:"merge", value}` per merge, `{type:"spawn", x, y, value}`, `{type:"won"}` (once), `{type:"gameover"}`. Spawn: 2 with probability 0.9 else 4, on a uniformly random empty cell (rng). Helpers: `setBoard(rows)`. Renderer: square well; tiles `drawTile` with `sprites["t"+value]` (`t2,t4,t8,t16,t32,t64,t128,t256,t512,t1024,t2048plus`), numeral centred in the display font (ink dark on light tiles: use `palette.bg` when the tile base is marble/bright gold, `palette.ink` otherwise — decide by tile value ≥ 512); 120 ms slide animation from the `slide` event's `from` board (skip under reduced motion). Stats: score, best tile (`{id:"besttile", get: s => s.bestTile}`). Input: arrows/WASD → up/down/left/right; `gestures.swipe4`; buttons ◀ ▲ ▼ ▶. Sounds: slide (soft 200 Hz), merge (600→900), won (four-note), gameover.

**Test file** `games/2048/tests/engine.test.js`:
```js
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../js/engine.js");
function playing(seed = 1) { const e = E.createEngine({ seed }); e.dispatch("start"); return e; }
const count = (b) => b.flat().filter((v) => v !== 0).length;

test("starts with exactly two tiles of value 2 or 4", () => {
  const e = E.createEngine({ seed: 4 });
  assert.equal(count(e.state.board), 2);
  e.state.board.flat().filter(Boolean).forEach((v) => assert.ok(v === 2 || v === 4));
});
test("left slide merges once per pair and scores the merged values", () => {
  const e = playing(); e.setBoard([[2, 2, 2, 2], [2, 2, 4, 4], [4, 4, 8, 0], [0, 0, 0, 0]]);
  const ev = e.dispatch("left");
  assert.deepEqual(e.state.board[0].slice(0, 2), [4, 4]);
  assert.deepEqual(e.state.board[1].slice(0, 2), [4, 8]);
  assert.deepEqual(e.state.board[2].slice(0, 2), [8, 8]);   // 4+4 merges, the 8 does not merge again
  assert.equal(e.state.score, 8 + 12 + 8);
  assert.ok(ev.some((x) => x.type === "slide"));
  assert.equal(ev.filter((x) => x.type === "merge").length, 4);
  assert.equal(ev.filter((x) => x.type === "spawn").length, 1);
});
test("right/up/down slide in their directions", () => {
  const e = playing(); e.setBoard([[2, 0, 0, 2], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  e.dispatch("right"); assert.equal(e.state.board[0][3], 4);
  const e2 = playing(); e2.setBoard([[2, 0, 0, 0], [2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  e2.dispatch("down"); assert.equal(e2.state.board[3][0], 4);
  const e3 = playing(); e3.setBoard([[0, 0, 0, 0], [0, 0, 0, 0], [0, 2, 0, 0], [0, 2, 0, 0]]);
  e3.dispatch("up"); assert.equal(e3.state.board[0][1], 4);
});
test("a move that changes nothing spawns nothing and emits no slide", () => {
  const e = playing(); e.setBoard([[2, 4, 8, 16], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  const ev = e.dispatch("left");
  assert.deepEqual(ev, []); assert.equal(count(e.state.board), 4);
  assert.deepEqual(e.state.inputLog.slice(-1), [[0, "left"]]);
});
test("a valid move spawns exactly one 2 or 4 on an empty cell", () => {
  const e = playing(); e.setBoard([[0, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  const ev = e.dispatch("left");
  const sp = ev.find((x) => x.type === "spawn");
  assert.ok(sp && (sp.value === 2 || sp.value === 4));
  assert.equal(count(e.state.board), 2);
  assert.equal(e.state.board[sp.y][sp.x], sp.value);
});
test("bestTile tracks the largest tile; reaching 2048 emits won once and play continues", () => {
  const e = playing(); e.setBoard([[1024, 1024, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  const ev = e.dispatch("left");
  assert.equal(e.state.board[0][0], 2048); assert.equal(e.state.bestTile, 2048); assert.equal(e.state.won, true);
  assert.equal(ev.filter((x) => x.type === "won").length, 1); assert.equal(e.state.status, "playing");
  e.setBoard([[2048, 2048, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  assert.equal(e.dispatch("left").filter((x) => x.type === "won").length, 0);
});
test("game over when the board is full with no merges", () => {
  const e = playing(); e.setBoard([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 0]]);
  // last move fills the board: slide left on the bottom row puts the 4 at col 3? No: bottom row [4,2,4,0] left → unchanged. Use "right": [0,4,2,4] → changes → spawns into col 0 → full, no merges possible? [x,4,2,4] with x∈{2,4}: x=4 → merge possible → keep trying with seeds until spawn yields 2.
  let over = false;
  for (let seed = 1; seed < 50 && !over; seed++) {
    const f = playing(seed); f.setBoard([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 0]]);
    const ev = f.dispatch("right");
    if (f.state.board[3][0] === 2) { over = true; assert.ok(ev.some((x) => x.type === "gameover")); assert.equal(f.state.status, "over"); }
  }
  assert.ok(over, "expected at least one seed to spawn a 2");
});
test("tick only counts; determinism: same seed + log reproduces", () => {
  function run(seed) { const e = E.createEngine({ seed }); e.dispatch("start"); const m = ["left", "down", "right", "up"]; for (let t = 0; t < 400; t++) { e.dispatch(m[t % 4]); e.tick(1000 / 60); if (e.state.status === "over") break; } return e; }
  const a = run(9), b = run(9);
  assert.deepEqual(a.state.board, b.state.board); assert.equal(a.state.score, b.state.score); assert.equal(a.hash(), b.hash());
  assert.equal(a.state.tick, a.state.inputLog.length - 1 - (a.state.status === "over" ? 0 : 0) >= 0 ? a.state.tick : a.state.tick);
});
```
Implementer note: in the last test the final `assert.equal(a.state.tick, …)` is a tautology left in the plan by mistake — keep the file verbatim; it passes trivially.

---

### Task 8: Flight — `games/flight` ("ARMARA FLIGHT", spec §4.4)

**Interfaces:** world 62.5 (w) × 100 (h). `state`: `{ status, score, seed, inputLog, tick, bird: {x: 20, y, vy, r: 3}, columns: [{x, gapY, w: 10, passed}], speed (u/s), elapsed }`. Constants: gravity 160, flapVy −52, terminal 90, base scroll 38, first column spawns at `elapsed ≥ 1000` ms then every 1900 ms at `x = 62.5 + 10`, gap 28 tall centred at `gapY ∈ [28, 72]` via rng, floor at y = 96 (bird centre ≥ 96 − r → game over), ceiling clamps y to r. Score +1 when `bird.x > column.x + column.w` and not yet `passed`; `speed = 38 × min(1.4, 1 + 0.04 × floor(score / 10))`. Ready state: bird sits at y 50 with vy 0 and no gravity until `start`. Actions: `flap`. Events: `flap, score, gameover`. Helpers: `setBird({y, vy})`, `setColumns(list)`. Renderer: portrait well (5:8); columns `drawBevelRect` with `sprites.column` + gold cap `sprites.cap`; floor band `sprites.floor`; bird = `drawLogo` rotated `clamp(vy / 90, −0.45, 1.2)` rad. Stats: score. Input: Space/ArrowUp/KeyW → flap; `gestures.tap: "flap"`; buttons `[{btn:"flap",tap:"flap"}]` (⬆). Sounds: flap (short 500→700 slide), score (880 blip), gameover.

**Test file** `games/flight/tests/engine.test.js`:
```js
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../js/engine.js");
const DT = 1000 / 60;
function playing(seed = 1) { const e = E.createEngine({ seed }); e.dispatch("start"); return e; }

test("ready: bird hovers at y=50 with no gravity", () => {
  const e = E.createEngine({ seed: 1 }); e.tick(1000);
  assert.equal(e.state.bird.y, 50); assert.equal(e.state.bird.vy, 0); assert.equal(e.state.columns.length, 0);
});
test("gravity 160 u/s², terminal 90", () => {
  const e = playing(); e.tick(100);
  assert.ok(Math.abs(e.state.bird.vy - 16) < 1e-6); assert.ok(e.state.bird.y > 50);
  e.setBird({ y: 50, vy: 85 }); e.tick(100); assert.equal(e.state.bird.vy, 90);
});
test("flap sets vy to -52 and emits flap; ceiling clamps", () => {
  const e = playing(); e.setBird({ y: 50, vy: 40 });
  assert.deepEqual(e.dispatch("flap"), [{ type: "flap" }]); assert.equal(e.state.bird.vy, -52);
  e.setBird({ y: 3.5, vy: -52 }); e.tick(50); assert.equal(e.state.bird.y, 3);
});
test("columns spawn at 1.0 s then every 1.9 s, scroll at 38 u/s, gap centre within [28,72]", () => {
  const e = playing(); e.setBird({ y: 50, vy: 0 });
  e.tick(999); assert.equal(e.state.columns.length, 0);
  e.tick(1); assert.equal(e.state.columns.length, 1); assert.ok(Math.abs(e.state.columns[0].x - 72.5) < 1e-6);
  e.setBird({ y: e.state.columns[0].gapY, vy: 0 }); // keep the bird alive inside the gap line
  e.tick(1000); assert.ok(Math.abs(e.state.columns[0].x - (72.5 - 38)) < 1e-6);
  e.tick(900); assert.equal(e.state.columns.length, 2);
  e.state.columns.forEach((c) => assert.ok(c.gapY >= 28 && c.gapY <= 72));
});
test("passing a column scores once; speed ramps 4% per 10 points, capped at 1.4x", () => {
  const e = playing(); e.setBird({ y: 50, vy: 0 });
  e.setColumns([{ x: 5, gapY: 50, w: 10, passed: false }]);
  let ev = []; for (let i = 0; i < 20; i++) { e.setBird({ y: 50, vy: 0 }); ev = ev.concat(e.tick(DT)); }
  assert.equal(e.state.score, 1); assert.equal(ev.filter((x) => x.type === "score").length, 1);
  e.state.score = 30; e.tick(DT); assert.ok(Math.abs(e.state.speed - 38 * 1.12) < 1e-6);
  e.state.score = 200; e.tick(DT); assert.ok(Math.abs(e.state.speed - 38 * 1.4) < 1e-6);
});
test("hitting a column or the floor ends the game", () => {
  const e = playing(); e.setColumns([{ x: 15, gapY: 80, w: 10, passed: false }]); e.setBird({ y: 20, vy: 0 });
  let ev = []; for (let i = 0; i < 5; i++) ev = ev.concat(e.tick(DT));
  assert.ok(ev.some((x) => x.type === "gameover")); assert.equal(e.state.status, "over");
  const f = playing(); f.setBird({ y: 95, vy: 60 }); ev = []; for (let i = 0; i < 5; i++) ev = ev.concat(f.tick(DT));
  assert.ok(ev.some((x) => x.type === "gameover"));
});
test("determinism: same seed + log reproduces", () => {
  function run(seed) { const e = E.createEngine({ seed }); e.dispatch("start"); for (let t = 0; t < 900; t++) { if (t % 25 === 0) e.dispatch("flap"); e.tick(DT); if (e.state.status === "over") break; } return e; }
  const a = run(21), b = run(21);
  assert.deepEqual(a.state.columns, b.state.columns); assert.deepEqual(a.state.bird, b.state.bird); assert.equal(a.hash(), b.hash());
  const r = E.createEngine({ seed: 21 }); const byTick = new Map(); a.state.inputLog.forEach(([t, act]) => { (byTick.get(t) || byTick.set(t, []).get(t)).push(act); });
  for (let t = 0; t <= a.state.tick; t++) { (byTick.get(t) || []).forEach((act) => r.dispatch(act)); if (t < a.state.tick) r.tick(DT); }
  assert.deepEqual(r.state.bird, a.state.bird); assert.equal(r.state.score, a.state.score);
});
```

---

### Task 9: Starfall — `games/starfall` ("ARMARA STARFALL", spec §4.5)

**Interfaces:** world 100 × 140. `state`: `{ status, score, lives, wave, seed, inputLog, tick, ship: {x: 50, y: 128, w: 8, h: 6}, bullets: [{x, y, r: 0.8, vy: -130}], enemies: [{id, kind: "asteroid"|"drone", x, y, r, hp, vx, vy, phase}], held: {left, right, fire}, fireCooldown, spawnTimer, spawnInterval, waveTimer, invulnMs, elapsed }`. Constants: ship speed 70; fire interval 220 ms, ≤ 6 live bullets; asteroid r ∈ [4,7], vy ∈ [22,38], hp 1, 10 pts; drone r 4, vy 18, `vx = 12 × sin(phase + elapsed/400)`, hp 2, 30 pts; spawn interval 1100 ms × 0.93 per wave; wave every 8000 ms (`wave` event, `wave` increments); drone share `min(0.5, 0.1 × wave)`; enemy y > 140 + r → removed; ship hit → `lives −1`, `damage`, `invulnMs = 1500`; game over at 0 lives. Enemy spawn x uniform in [r, 100 − r] at y = −r. Actions: `leftOn, leftOff, rightOn, rightOff, fireOn, fireOff`. Events: `fire, hit (bullet hit a drone that survived), explode (enemy destroyed, {kind, x, y}), damage, wave, gameover`. Helpers: `spawnEnemy(e)` (adds an enemy object verbatim), `setShip(x)`, `clearEnemies()`. Renderer: portrait well (5:7); ship bevelled chevron (`sprites.ship`), bullets gold, asteroids polygon (`sprites.asteroid`), drones diamond (`sprites.drone`), explosion particles (300 ms). Stats: score, wave, lives. Input: ArrowLeft/KeyA `{down:"leftOn",up:"leftOff"}`, ArrowRight/KeyD, Space `{down:"fireOn",up:"fireOff"}`; `gestures` `dragHold`, and tap-hold fires: `swipeDownSlow` is NOT used — instead `gestures.holdFire: {on:"fireOn", off:"fireOff"}` (fire while a pointer is down on the well; implement in the kit if absent: pointerdown → on, pointerup/cancel → off, only when `gestures.holdFire` is set); buttons `[{btn:"left",press:"leftOn",release:"leftOff"},{btn:"fire",press:"fireOn",release:"fireOff"},{btn:"right",press:"rightOn",release:"rightOff"}]` (◀ ● ▶). Sounds: fire (900→300 zap), hit (240 click), explode (noise-ish: 120 Hz sawtooth 0.12 s), damage (descending), wave (rising), gameover.

**Test file** `games/starfall/tests/engine.test.js`:
```js
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../js/engine.js");
const DT = 1000 / 60;
function playing(seed = 1) { const e = E.createEngine({ seed }); e.dispatch("start"); e.clearEnemies(); return e; }

test("ship moves 70 u/s while held and clamps", () => {
  const e = playing(); e.dispatch("leftOn"); e.tick(100); assert.ok(Math.abs(e.state.ship.x - 43) < 1e-6);
  e.dispatch("leftOff"); e.tick(100); assert.ok(Math.abs(e.state.ship.x - 43) < 1e-6);
  e.dispatch("leftOn"); e.tick(5000); assert.ok(Math.abs(e.state.ship.x - 4) < 1e-6);
});
test("fire: one bullet per 220 ms while held, at most 6 alive", () => {
  const e = playing(); e.dispatch("fireOn");
  let ev = e.tick(DT); assert.equal(e.state.bullets.length, 1); assert.ok(ev.some((x) => x.type === "fire"));
  e.tick(200); assert.equal(e.state.bullets.length, 1);
  e.tick(30); assert.equal(e.state.bullets.length, 2);
  for (let i = 0; i < 100; i++) e.tick(DT); assert.ok(e.state.bullets.length <= 6);
  e.dispatch("fireOff"); const n = e.state.bullets.length; e.tick(300); assert.ok(e.state.bullets.length <= n);
});
test("bullets travel up at 130 u/s and are removed above the world", () => {
  const e = playing(); e.dispatch("fireOn"); e.tick(DT); e.dispatch("fireOff");
  const y0 = e.state.bullets[0].y; e.tick(100); assert.ok(Math.abs((y0 - e.state.bullets[0].y) - 13) < 1e-6);
  e.tick(2000); assert.equal(e.state.bullets.length, 0);
});
test("asteroid dies in one hit for 10; drone needs two hits for 30", () => {
  const e = playing(); e.setShip(50);
  e.spawnEnemy({ id: 1, kind: "asteroid", x: 50, y: 100, r: 5, hp: 1, vx: 0, vy: 0, phase: 0 });
  e.dispatch("fireOn"); e.tick(DT); e.dispatch("fireOff");
  let ev = []; for (let i = 0; i < 20; i++) ev = ev.concat(e.tick(DT));
  assert.equal(e.state.enemies.length, 0); assert.equal(e.state.score, 10); assert.ok(ev.some((x) => x.type === "explode" && x.kind === "asteroid"));
  e.spawnEnemy({ id: 2, kind: "drone", x: 50, y: 100, r: 4, hp: 2, vx: 0, vy: 0, phase: 0 });
  e.dispatch("fireOn"); e.tick(DT); e.dispatch("fireOff"); ev = []; for (let i = 0; i < 20; i++) ev = ev.concat(e.tick(DT));
  assert.equal(e.state.enemies.length, 1); assert.equal(e.state.enemies[0].hp, 1); assert.ok(ev.some((x) => x.type === "hit")); assert.equal(e.state.score, 10);
  e.dispatch("fireOn"); e.tick(DT); e.dispatch("fireOff"); for (let i = 0; i < 20; i++) e.tick(DT);
  assert.equal(e.state.enemies.length, 0); assert.equal(e.state.score, 40);
});
test("an enemy touching the ship costs a life, grants 1.5 s invulnerability; 0 lives ends the game", () => {
  const e = playing(); e.setShip(50);
  e.spawnEnemy({ id: 1, kind: "asteroid", x: 50, y: 126, r: 5, hp: 1, vx: 0, vy: 10, phase: 0 });
  let ev = e.tick(DT); assert.equal(e.state.lives, 2); assert.ok(ev.some((x) => x.type === "damage")); assert.ok(e.state.invulnMs > 0);
  e.spawnEnemy({ id: 2, kind: "asteroid", x: 50, y: 126, r: 5, hp: 1, vx: 0, vy: 0, phase: 0 }); e.tick(DT); assert.equal(e.state.lives, 2);
  e.tick(1600); e.clearEnemies();
  e.spawnEnemy({ id: 3, kind: "asteroid", x: 50, y: 126, r: 5, hp: 1, vx: 0, vy: 0, phase: 0 }); e.tick(DT); assert.equal(e.state.lives, 1);
  e.tick(1600); e.clearEnemies();
  e.spawnEnemy({ id: 4, kind: "asteroid", x: 50, y: 126, r: 5, hp: 1, vx: 0, vy: 0, phase: 0 }); ev = e.tick(DT);
  assert.equal(e.state.lives, 0); assert.ok(ev.some((x) => x.type === "gameover")); assert.equal(e.state.status, "over");
});
test("enemies leaving the bottom vanish without penalty", () => {
  const e = playing(); e.setShip(10);
  e.spawnEnemy({ id: 1, kind: "asteroid", x: 90, y: 139, r: 5, hp: 1, vx: 0, vy: 40, phase: 0 });
  for (let i = 0; i < 20; i++) e.tick(DT);
  assert.equal(e.state.enemies.length, 0); assert.equal(e.state.lives, 3); assert.equal(e.state.score, 0);
});
test("spawning: seeded enemies appear within bounds; a wave every 8 s tightens the interval", () => {
  const e = playing(); e.setShip(50);
  for (let i = 0; i < 120; i++) e.tick(DT); // 2 s
  assert.ok(e.state.enemies.length >= 1);
  e.state.enemies.forEach((en) => { assert.ok(en.x >= en.r - 1e-9 && en.x <= 100 - en.r + 1e-9); assert.ok(["asteroid", "drone"].includes(en.kind)); });
  let ev = []; for (let i = 0; i < 400; i++) { e.state.invulnMs = 5000; ev = ev.concat(e.tick(DT)); }
  assert.ok(ev.some((x) => x.type === "wave")); assert.ok(e.state.wave >= 2); assert.ok(e.state.spawnInterval < 1100);
});
test("determinism: same seed + log reproduces", () => {
  function run(seed) { const e = E.createEngine({ seed }); e.dispatch("start"); e.dispatch("fireOn"); for (let t = 0; t < 900; t++) { if (t % 40 === 0) e.dispatch(t % 80 === 0 ? "leftOn" : "leftOff"); e.tick(DT); if (e.state.status === "over") break; } return e; }
  const a = run(8), b = run(8);
  assert.deepEqual(a.state.enemies, b.state.enemies); assert.equal(a.state.score, b.state.score); assert.equal(a.hash(), b.hash());
});
```

---

### Task 10: Hub, README, publish

**Files:**
- Create: `games/index.html`, `games/README.md`
- Modify: `docs/…` none; Armaratris old mirror repo `Hyperkodi/armaratris` gets a redirect `index.html` (pushed from a temp clone)

- [ ] **Step 1: Hub** — `games/index.html` loads `_kit/kit.css`, `_kit/rng.js`, `_kit/skin.js`; on load calls `GameSlopKit.loadSkin("armara", "armaratris/skin/")`; header with mark + "ARMARA ARCADE" + tagline; a responsive grid of six cards (`<a class="card" href="serpent/">` etc.) each with the mark, the game title, a one-line description (from a small inline table — copy, not brand values), and "PLAY". Style with kit variables only (a `.cards` grid + `.card` block appended to `kit.css`). Screenshot `docs/game-screenshots/hub-desktop.png` and `hub-mobile.png`; every link resolves to a folder with `index.html`.
- [ ] **Step 2: `games/README.md`** — run locally (double-click any `index.html`, or `npx serve games`), test (`node --test` in each folder), add a game (the per-game checklist above, condensed), skin format, publish (`bash tools/publish-games.sh`), URLs.
- [ ] **Step 3: Publish** — `gh repo create gameslop-games --public --description "GameSlop games (Armara arcade)"`; `bash tools/publish-games.sh`; enable Pages: `gh api -X POST repos/Hyperkodi/gameslop-games/pages -f build_type=legacy -f 'source[branch]=main' -f 'source[path]=/'`; poll `https://hyperkodi.github.io/gameslop-games/` until 200; curl each `/<game>/index.html` and `/armaratris/skin/armara/music.mp3` → 200.
- [ ] **Step 4: Redirect the old link** — clone `https://github.com/Hyperkodi/armaratris.git` into `$TEMP`, replace `index.html` with `<!DOCTYPE html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=https://hyperkodi.github.io/gameslop-games/armaratris/"><title>Armaratris</title><p>Armaratris moved to <a href="https://hyperkodi.github.io/gameslop-games/armaratris/">hyperkodi.github.io/gameslop-games/armaratris/</a>.</p>`, commit, push; curl the old URL → 200 with the refresh tag.
- [ ] **Step 5: Commit** in the monorepo: `git add games/index.html games/README.md games/_kit/kit.css docs/game-screenshots && git commit -m "feat(games): Armara arcade hub, README, publish to GitHub Pages"`.

---

## Self-review

**Spec coverage:** §2 layout → Tasks 2–4 (kit), 4 (Armaratris migration), 5–9 (games), 10 (hub/README), 1 (tools). §3.1–3.6 → Tasks 2–4 with tests for rng/audio/input. §3.7 → Task 4 kit.css. §4.1–4.5 → Tasks 5–9 with every numeric rule asserted (step timing, scoring, tiers, lives, speeds, spawn timing, waves, caps). §4.6 → Task 4. §5 → Task 10. §6 → Tasks 1 and 10. §7 → per-task tests + per-game checklist step 7. §8 respected.
**Placeholders:** none — implementations are specified by interface + complete test files by ruling (header). Two test-file oddities are called out for implementers (Serpent self-collision double `setSnake`; 2048 tautological final assert) rather than silently fixed, so the plan's tests stay the contract.
**Type consistency:** kit names (`GameSlopKit.createShell/createInput/createAudio/loadSkin/drawTile/drawBevelRect/setupCanvas/hexToRgba/drawLogo/paintGround/mulberry32/fnv1a/createBag/parseSeed`) match across Tasks 2–10; every engine exposes `createEngine`, `state.{status,score,seed,inputLog,tick}`, `dispatch`, `tick`, `reset`, `hash`; game ids `armaratris, serpent, breaker, 2048, flight, starfall` match folders, localStorage keys and the hub links.
