# Armara Five Games + Shared Kit — Design Spec

**Date:** 2026-08-25
**Status:** Approved in chat (Ryan); pending spec review
**Builds on:** `docs/superpowers/specs/2026-08-25-armaratris-design.md` (Armaratris, shipped at `games/armaratris/`)

## 1. Purpose

Add five Armara-branded arcade games to GameSlop and, first, extract the reusable half of Armaratris into a shared runtime so every game (six after this) shares one look, one skin format, one input/audio/overlay layer, and one game-over bridge. Each new game is then an engine + a renderer + a config file.

Requirements carried over from Armaratris: static folders, no build, no dependencies, `file://` works, skin-driven branding, deterministic engines (seed + input log), touch + keyboard, synthesized SFX, local best score, optional looping music per skin, `postMessage` game-over bridge.

Decisions (Ryan, 2026-08-25): games = Snake, Breakout, 2048, Flappy-style, vertical shooter; own engines on a shared kit; one GitHub Pages site for the whole `games/` folder (Armaratris link redirects); music per game supplied later by Ryan (hook present, silent until an mp3 exists).

## 2. File layout

```
games/
  index.html                   hub: lists the six games (Armara-styled, uses the kit)
  _kit/
    kit.css                    shared layout: title, side panels, framed well, overlays, touch bar (from armaratris/css/game.css)
    rng.js                     GameSlopKit.mulberry32, fnv1a, createBag (generic), parseSeed
    skin.js                    GameSlopKit.loadSkin(name, baseDir)  (from armaratris/js/skin.js)
    audio.js                   GameSlopKit.createAudio(recipes)     (from armaratris/js/audio.js, recipes injected)
    input.js                   GameSlopKit.createInput(config)      (from armaratris/js/input.js, generalized)
    draw.js                    GameSlopKit.drawTile, drawBevelRect, hexToRgba, setupCanvas, paintGround, drawLogo
    shell.js                   GameSlopKit.createShell(config)      (from armaratris/js/main.js, generalized)
  armaratris/                  migrated onto the kit; engine.js + tests unchanged
    index.html  js/engine.js  js/renderer.js  js/game.js  skin/armara/  tests/
  serpent/   breaker/   2048/   flight/   starfall/
    index.html                 same shell markup; script tags: ../_kit/*.js then js/engine.js, js/renderer.js, js/game.js
    js/engine.js               pure, deterministic, CommonJS-exported for tests
    js/renderer.js             canvas drawing for this game (uses _kit/draw.js)
    js/game.js                 config passed to createShell (actions, key map, gestures, buttons, sounds, stats, strings defaults)
    skin/armara/skin.json      brand data (source of truth) + skin.js twin + logo.png (+ music.mp3 when supplied)
    tests/engine.test.js       node:test
tools/
  cdp-shot.js                  DevTools-Protocol screenshot/driver script (promoted from scratch)
docs/armaratris-screenshots/   existing; new games add docs/game-screenshots/<game>-desktop.png, -mobile.png
```

Script loading stays classic (`file://` requirement). Every kit file attaches to `window.GameSlopKit`; every game attaches to `window.Game` (engine, renderer, config). Node tests `require()` engines and `_kit/rng.js` directly (CommonJS guard).

## 3. The kit

### 3.1 `rng.js`
`mulberry32(seed)`, `fnv1a(str)` (8-char hex), `createBag(rng, items)` (shuffle-bag over any array), `parseSeed(v)` (`undefined` for empty; integer → `>>> 0`; other strings → `parseInt(fnv1a(s), 16) >>> 0`). Armaratris keeps its internal copies (engine untouched); new engines use these.

### 3.2 `skin.js`
`loadSkin(name, baseDir = "skin/")` — as Armaratris: sanitize name, fetch `<baseDir><name>/skin.json` (skip fetch on `file://`), fall back to `<baseDir><name>/skin.js` (`window.GameSlopKit.skins[name]`), fall back to `armara`, apply palette → `--c-*`, fonts (Google Fonts link, serif fallback), Greek-key `--frame-image`, `document.title`, `[data-str]`, tagline, wordmark (`skin.wordmark` if present, else title with trailing "TRIS" stripped), logo `src` + favicon, `theme-color`; preload `skin.logoImage`; resolve `skin.base`. Skin shape shared by all games:

```json
{ "name", "title", "tagline", "wordmark"?, "logo", "music"?, "musicVolume"?,
  "fonts": { "display", "body", "googleFonts" },
  "palette": { "bg","bg2","marble","gold","goldDeep","bronze","ink","muted","well","grid","frame","ghost" },
  "watermarkAlpha", "strings": { "score","level","lines"?,"best","start","paused","resume","gameOver","restart", ...game labels },
  "sprites": { ...game-specific tones, see §4 } }
```

### 3.3 `audio.js`
`createAudio(recipes)` where `recipes = { name: [[freq, dur, type, gain, when?, slideTo?], ...] }`. Returns `{play(name), unlock(), muted, toggle()}`; mute persisted under `gameslop:muted` (shared across games — one preference). Armaratris' seven recipes move into its `game.js`.

### 3.4 `input.js`
`createInput({ wellEl, touchEl, cellSize, keys, repeatKeys, gestures, buttons, onAction, onSystem }) → {update(dt), destroy()}`.
- `keys`: `{ [e.code]: action | { down: action, up: action } }`. Enter/P/Escape/M are reserved → `onSystem("start"|"pause"|"mute")`.
- `repeatKeys`: `{ [e.code]: action }` — held keys with DAS 170 ms / ARR 40 ms (Armaratris ← →, Breaker/Starfall ← →).
- `gestures` (all optional): `dragCols: {left, right}` (one action per `cellSize()` px of horizontal drag — Armaratris), `dragHold: {left, right, deadzone: 8}` (Breaker/Starfall: while the pointer is more than `deadzone` px left/right of where it went down, emit `left`/`right` as held actions — `leftOn`… then `leftOff` when it crosses back or lifts; exactly like holding the arrow key), `tap: action`, `swipeDownFast: action`, `swipeDownSlow: {on, off}`, `swipeUp: action`, `swipe4: {up, down, left, right}` (Serpent/2048: the first axis to cross 24 px wins, one action per gesture).
- `buttons`: `[{ btn: "left", press: "left", repeat: true }, { btn: "rotate", tap: "rotateCW" }, { btn: "drop", tap: "hardDrop", hold: "softDropOn", release: "softDropOff" }, { btn: "fire", press: "fireOn", release: "fireOff" }]` matched against `[data-btn]` in the game's `#touch` nav. Long-press threshold 250 ms.
- Overlay/button pointerdowns are ignored by the well gesture handler (Armaratris fix carried over).

### 3.5 `draw.js`
`drawTile(ctx, x, y, size, tone, alpha?)` (bevelled stone tile, `tone = {base, hi, lo, edge?}`), `drawBevelRect(ctx, x, y, w, h, tone)` (same bevel, any rectangle — bricks, paddle, ship body), `hexToRgba`, `setupCanvas(canvas, cssW, cssH, dpr)`, `paintGround(palette)` (the seamless marble ground, once per page), `drawLogo(ctx, img, cx, cy, size, alpha)`.

### 3.6 `shell.js`
`createShell(cfg)` runs a game. `cfg`:
```js
{
  game: "serpent",                       // id used in localStorage keys and the bridge payload
  skinDir: "skin/",                      // for the hub: "armaratris/skin/"
  createEngine: (opts) => engine,        // from js/engine.js; opts = {seed}
  createRenderer: ({skin, wellCanvas, sideCanvases, wrapEl}) => renderer,
  sounds: { move: [...recipes] },        // audio recipes
  events: { eat: "eat", gameover: "gameover" },   // engine event type → sound name (omit = silent)
  onEvent: (ev, ctx) => {},              // optional per-event hook (flash rows, etc.)
  stats: [{ id: "score", key: "score" }, { id: "level", key: "level" }],   // engine.state keys → #ids
  input: { keys, repeatKeys, gestures, buttons },
  startsOnAnyAction: true                // any game action while "ready" starts the game
}
```
Shell responsibilities (from Armaratris `main.js`): parse `?skin`, `?seed`, `?debug=1` (exposes `window.__gameslop.engine`); load skin; create engine (seeded), renderer, audio, input; fixed 60 Hz accumulator (cap 8 steps, clamp 250 ms); per-frame `refreshStats()` while playing; overlays start/paused/over with skin strings; best score in `gameslop:<game>:<skin>:best`; music (`skin.music`, loop, `musicVolume`, starts on first start, follows mute, pauses when hidden); auto-pause on `visibilitychange`; PLAY AGAIN → `engine.reset(parseSeed(...))` + start; bridge on game over: `window.parent.postMessage({v:1, type:"gameover", game, skin, score, seed, inputsHash, stats:{...all stats keys}}, "*")` when framed.

Engine contract every game satisfies: `state {status: "ready"|"playing"|"paused"|"over", score, seed, inputLog, tick, ...}`, `dispatch(action) → events[]` (logs `[tick, action]`; `start/pause/resume` handled by the engine), `tick(dtMs) → events[]` (only while playing), `reset(seed?)`, `hash()`. Renderer contract: `resize()`, `draw(state)`, optional `side(state)` for hold/next-style panels (Armaratris only).

### 3.7 `kit.css`
Armaratris' `game.css` with the well aspect ratio no longer assumed: each renderer sizes its own well canvas (all six wells are square or portrait, so the three-column desktop / strip-on-top mobile layout holds); panels are optional (`.panel:empty { display:none }`). Touch bar accepts 1–5 buttons.

## 4. The games

All: skin palette identical to Armaratris; `strings` include the shared keys; game over when noted; score is the bridge score. RNG is `mulberry32(seed)`; every random decision goes through it so seed + input log replays the game (determinism test required per engine).

### 4.1 Serpent (`games/serpent`) — "ARMARA SERPENT"
- Grid 20 × 20 cells. Serpent starts length 3 in the middle moving right. One pickup on the board at a time, spawned on a random empty cell.
- Step every `stepMs = max(70, 200 − 6 × pickups)`; `tick(dt)` accumulates and steps. Actions `up/down/left/right` queue up to 2 turns; reversing into yourself is ignored. Walls kill (no wrap).
- Score: `+10 + floor(length / 5) × 5` per pickup. Game over on wall or self collision. Events: `turn`, `eat`, `gameover`.
- Renderer: obsidian grid; segments = bevelled gold tiles (head uses `sprites.head`, body `sprites.body`, tail darker); pickup = the skin logo drawn at 80 % of a cell (fallback gold diamond). `sprites`: `{ head, body, tail, pickup }` tones.
- Input: arrows/WASD; `swipe4`; buttons ◀ ▲ ▼ ▶. Stats: score, length.

### 4.2 Breaker (`games/breaker`) — "ARMARA BREAKER"
- World units 100 × 150 (w × h), rendered to a 2:3 canvas. Paddle width 18, height 3, y = 142, moves at 90 u/s while held. Ball radius 1.5, speed 55 u/s at level 1, +6 % per level; launches from the paddle on `launch`; angle depends on hit position (±60°).
- Bricks: 10 cols × 6 rows, each 9.4 × 4.2 with 0.6 gap, top margin 12. Rows 1–2 `bronze` (2 hits, 30 pts), rows 3–4 `gold` (1 hit, 20 pts), rows 5–6 `marble` (1 hit, 10 pts). Level cleared → next level: same layout, ball faster, +250 bonus.
- 3 lives; ball below paddle → lose a life, ball re-attaches. Game over at 0 lives. Events: `bounce`, `brick`, `launch`, `life`, `level`, `gameover`.
- Physics at fixed `tick(dt)`; sub-steps of ≤ 2 u to avoid tunneling. Actions: `leftOn/leftOff/rightOn/rightOff`, `launch`.
- Renderer: bricks via `drawBevelRect` with row tones from `sprites.{bronze,gold,marble}`; paddle `sprites.paddle`; ball gold with marble highlight. `sprites`: `{ bronze, gold, marble, paddle, ball }`.
- Input: ← → / A D held (`keys` with down/up → `leftOn/leftOff`…), Space/tap = launch; `dragHold` moves the paddle; buttons ◀ ● ▶ (● = launch). Stats: score, level, lives.

### 4.3 2048 (`games/2048`) — "ARMARA 2048"
- 4 × 4; standard rules: a move slides and merges once per pair in move direction; a move that changes nothing is ignored (not logged as a change, but still logged as input); after a valid move spawn a 2 (90 %) or 4 (10 %) on a random empty cell. Score += merged tile values. Game over when no move changes the board. Reaching 2048 sets `won = true` and play continues.
- `tick()` only advances the tick counter (no gravity). Actions `up/down/left/right`. Events: `slide`, `merge`, `spawn`, `won`, `gameover`.
- Renderer: tile ramp from `sprites`: `t2, t4` obsidian-ish; `t8, t16` bronze; `t32, t64` deep gold; `t128, t256` gold; `t512, t1024` bright gold; `t2048plus` marble; numerals in the display font, dark on light tiles. 120 ms slide animation from a pre-move snapshot (engine `slide` event carries `from` board); skipped under reduced motion.
- Input: arrows/WASD; `swipe4`; buttons ◀ ▲ ▼ ▶. Stats: score, best tile.

### 4.4 Flight (`games/flight`) — "ARMARA FLIGHT"
- World 100 (h) × 62.5 (w) units (16:10 portrait). Gravity 160 u/s²; `flap` sets vy = −52 u/s; terminal vy 90. Bird = hourglass sprite 8 u tall, hitbox circle r 3 at its centre.
- Columns: pair every 1.9 s, scrolling at 38 u/s, width 10, gap 28, gap centre uniform in [28, 72] via rng. Score +1 when the bird's x passes a column's trailing edge. Speed +4 % every 10 points (cap +40 %).
- Game over on column or floor collision (ceiling clamps). Events: `flap`, `score`, `gameover`. Actions: `flap`.
- Renderer: marble columns (`sprites.column`) with gold caps; hourglass = skin logo rotated with velocity (−25° … +70°); floor band. `sprites`: `{ column, cap, floor }`.
- Input: Space/↑/W/click/tap = flap; single button ⬆. Stats: score.

### 4.5 Starfall (`games/starfall`) — "ARMARA STARFALL"
- World 100 (w) × 140 (h). Ship at y = 128, width 8, moves 70 u/s while held, clamped to the world. Fire: while `fireOn`, a bullet every 220 ms (speed 130 u/s, r 0.8); max 6 live bullets.
- Enemies (seeded): asteroids — obsidian polygons, r 4–7, fall 22–38 u/s, 1 hit, 10 pts; drones — gold-edged diamonds r 4, fall 18 u/s with sinusoidal drift, 2 hits, 30 pts. Spawn interval starts 1.1 s, ×0.93 per wave; a wave every 8 s (`wave` event); each wave adds 10 % drone share (cap 50 %).
- 3 lives; enemy touching the ship → lose a life, 1.5 s invulnerability (blink); enemies leaving the bottom vanish, no penalty. Game over at 0 lives. Events: `fire`, `hit`, `explode`, `damage`, `wave`, `gameover`. Actions: `leftOn/leftOff/rightOn/rightOff`, `fireOn/fireOff`.
- Renderer: ship = bevelled gold chevron (`sprites.ship`), bullets gold, asteroids `sprites.asteroid`, drones `sprites.drone`, explosions = 8-particle gold burst (300 ms). `sprites`: `{ ship, bullet, asteroid, drone }`.
- Input: ← → / A D held (`leftOn/leftOff`…), Space held = `fireOn/fireOff`, tap-and-hold on the well = fire; `dragHold` moves the ship; buttons ◀ ● ▶ (● = fire while pressed). Stats: score, wave, lives.

### 4.6 Armaratris migration
`index.html` loads `../_kit/*`; `js/game.js` supplies its recipes, key map (`ArrowLeft/Right` repeat; ↑/X rotateCW; Z/Ctrl rotateCCW; ↓ soft on/off; Space hardDrop; C/Shift hold), gestures (dragCols, tap rotate, swipes), buttons, stats (score, level, lines), `onEvent` for the clear flash and hold/next redraw. `engine.js` and `tests/` unchanged; `renderer.js` switches its local `drawTile/hexToRgba/setupCanvas/paintGround` to the kit's. `js/main.js`, `js/skin.js`, `js/audio.js`, `js/input.js` are deleted. Behaviour must be identical (screenshots compared, tests green, CDP checklist re-run).

## 5. Hub (`games/index.html`)
Armara-styled page using `kit.css` + `loadSkin("armara", "armaratris/skin/")`: title "ARMARA ARCADE", six cards (logo mark, title, one-line description, PLAY link to `<game>/`), footer with the GameSlop mark from `Assets/` is **not** used here (sponsor page, not portal). No JS beyond the skin loader.

## 6. Deployment
- Public mirror repo `Hyperkodi/gameslop-games` = `git subtree split --prefix games`; GitHub Pages from `main:/`. URLs: `https://hyperkodi.github.io/gameslop-games/` (hub) and `/<game>/`.
- `Hyperkodi/armaratris` (current Pages site): replace `index.html` with a meta-refresh + link to `https://hyperkodi.github.io/gameslop-games/armaratris/`; keep the rest so the old URL never 404s.
- A helper `tools/publish-games.sh` runs the split + push (documented in `games/README.md`).

## 7. Testing
- Per engine: `node --test` from the game folder — rules (each bullet in §4 that is testable: scoring, collisions, level/wave progression, game over), RNG use only via the injected rng, and a determinism/replay test (scripted 900 ticks, replay from log alone → identical state + hash).
- Kit: `_kit/tests/` for `rng.js` (`parseSeed`, `createBag`) and `input.js` DAS/ARR + `swipe4` + button hold/tap via fake DOM (as in Armaratris Task 7).
- Browser: `tools/cdp-shot.js` desktop 1280×800 + mobile 390×844 screenshots per game (start overlay + mid-game), driven checklist per game (start, core action, score increments, pause/resume via RESUME button, game over → PLAY AGAIN, best persists, mute persists, `?seed=` reproducibility, `?skin=nope` fallback). Armaratris re-runs its Task-8 checklist after migration.
- Hub: screenshot; all six PLAY links resolve.

## 8. Out of scope
Portal/site, accounts, leaderboards, token payouts, developer rewards (see `docs/developer-rewards-team-questions.md`), multiplayer, per-game music files (hook only), non-Armara skins (the format supports them; none shipped).
