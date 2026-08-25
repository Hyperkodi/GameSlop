# Flash-era games: where they live, what's legally usable, and which have real open-source releases

Research date: 2026-08-24. All GitHub numbers pulled live via `gh api` on that date. Raw command output is in the sibling files `gh_batch*.txt`, `gh_licenses.txt`, `license_texts.txt`, `misc*.txt`.

**Bottom line up front:** The original Flash catalogs (Addicting Games, Miniclip, Newgrounds, Kongregate, Armor Games) are almost entirely archived in Flashpoint and playable via Ruffle, but they remain copyrighted by their (mostly third-party) developers and none are licensed for modification or commercial reuse. A handful of genuinely famous Flash-era games have real open-source code (Canabalt's official port is MIT; Adam Saltsman's Flixel demos are MIT; Terry Cavanagh's VVVVVV and Tyler Glaiel's entire back-catalog are source-available but non-commercial). For a reskin + play-to-earn portal, the usable pool is: permissively-licensed HTML5 originals (2048, t-rex-runner, HexGL, Nicky Case's CC0 games, Sandspiel, Flappy/Pacman-style clones), copyleft ones if you accept publishing your modified JS (Hextris GPL, Candy Box 2 GPL, Onslaught Arena GPL), and Canabalt if you replace every asset and drop the name.

---

## 1. Flashpoint Archive (flashpointarchive.org)

**What it is.** A volunteer web-game preservation project started December 2017 by Ben "BlueMaxima" Latimore (originally "BlueMaxima's Flashpoint", renamed "Flashpoint Archive"; BlueMaxima stepped down as lead in early 2023). It bundles archived game files with the original players/plugins (Flash Player projector, Shockwave, Unity Web Player, Java, Silverlight, HTML5 via a bundled browser) plus a local proxy/redirector that spoofs the games' original URLs so site-locked and multi-asset games still run.
- Wikipedia: https://en.wikipedia.org/wiki/Flashpoint_Archive
- FAQ: https://flashpointarchive.org/faq

**Size (official, FAQ, 2026-08-24):** "Flashpoint has preserved a grand total of **220,586** games and animations." Supports "over 100 web technologies in addition to Flash" (Wikipedia: 126 technologies as of Flashpoint 14). The public database API breaks this down as **180,016 "arcade" (games) + 32,506 "theatre" (animations)** (https://db-api.unstable.life/stats).

**Are the big portals' titles in it?** Yes. Querying the Flashpoint DB API by the `source` field (substring match, 2026-08-24; undercounts because many entries record a different source URL):
| source contains | entries |
|---|---|
| newgrounds | 15,457 |
| kongregate | 7,935 |
| armorgames | 2,161 |
| **addictinggames** | **1,225** |
| miniclip | 759 |
| coolmath | 740 |
| nitrome | 26 (Nitrome asked for removal in 2020; residual entries only) |

Example AG entries returned: Castle Tales, World's Fastest Drummer, Hockey Game, Ashleys Journey (launch commands point at `http://www.addictinggames.com/...` — the archive keeps the original URL and proxies it). Query used: `https://db-api.unstable.life/search?source=addictinggames&fields=id,title,source,platform&limit=5`. Web frontend for the same API: https://flashpointproject.github.io/flashpoint-database/ (repo `FlashpointProject/flashpoint-database`, MIT, 93 stars).

**Distribution.**
- **Infinity** (~14 GB): launcher + metadata; downloads each game on demand from Flashpoint's own servers. Requires internet.
- **Ultimate** (~413 GB download / ~480 GB extracted per third-party guides; Wikipedia cites 1.68 TB total collection): everything pre-downloaded. "Both versions are technologically identical."
- Downloads: https://flashpointarchive.org/downloads . Windows primary; Linux/Mac support is partial. There is also a native Android app for single-SWF titles.
- The game files themselves are **not on GitHub** — only tooling is. GitHub org https://github.com/FlashpointProject (≈40 repos):
  - `FlashpointProject/launcher` — the Electron/TypeScript launcher, **MIT**, 1,258 stars, pushed 2026-06-18. https://github.com/FlashpointProject/launcher
  - `Flashpoint-Router` (MIT) — serves scripts/local files/internet files to Infinity; `FlashpointProxy` (MIT, C++); `FlashpointSecureTools` (MIT); `FlashpointCC` curation tool (GPL-3); `FlashpointSearchTool` (AGPL-3); `Flashpoint-Website` (MIT); `flashpoint-database` (MIT).

**Licensing stance.** Flashpoint is a preservation archive, not a license. From the FAQ: "As a preservation project, Flashpoint aims to archive as much content as possible from this era. It will not play the role of gatekeeper." Rights holders can request removal via a contact form and the project says it complies quickly (all Nitrome games were pulled in Flashpoint 8.0 at Nitrome's request). It excludes titles that are currently commercially available. Wikipedia describes the legality as "unclear". Nothing in Flashpoint grants any right to redistribute, modify, or commercially exploit the games; every SWF stays under its developer's copyright. The FAQ says nothing about commercial use because there is nothing to say — it's not theirs to license.

**Web-playable version?** Yes, experimental:
- **9o3o** — https://ooooooooo.ooo/ — "an experimental web frontend for the Flashpoint Archive. It utilizes open-source players such as Ruffle and X_ITE, while offering the full extent of Flashpoint's redirection and URL spoofing capabilities in the browser." Uses Ruffle (Flash), DirPlayer (Shockwave), X_ITE (VRML/X3D). Third-party write-ups say ~145k titles are browsable; it "may be limited to games that only use the mouse" and to what Ruffle can run. Source: https://github.com/Dri0m/9o3o (0BSD, Deno/JS, 26 stars, pushed 2026-05-23). Official mention: FAQ + https://x.com/fp_archive/status/1770886264394256629
- Community self-hosted alternative: https://github.com/darkraise/flashpoint-web ("Selfhosted flashpoint archive for playing flash and HTML5 game in browser").
- Independent Ruffle-based sites doing the same thing with their own scrapes: Flash Museum (https://flashmuseum.net/about/), FlashArch, etc. Same legal position as Flashpoint (hosting, not licensing).

Note for archiving: Flashpoint Ultimate *is* the archive the user is asking for — it includes essentially all of Addicting Games' Flash-era catalog that was ever crawled. Archiving it privately is what Flashpoint exists for; re-publishing or reskinning from it is a different matter (section 7).

---

## 2. Ruffle (github.com/ruffle-rs/ruffle)

- **Stars 18,452**, language Rust, **license: Apache-2.0 OR MIT (dual, your choice)**, pushed 2026-08-25, releases are nightlies (latest `nightly-2026-08-25`). npm package `@ruffle-rs/ruffle` (0.5.0 on npm; nightlies via GitHub releases). https://github.com/ruffle-rs/ruffle , https://ruffle.rs
- **Compatibility page (https://ruffle.rs/compatibility, 2026-08):** AVM1 (AS1/2): language 99%, API 82% — "Most AVM 1 content will work". AVM2 (AS3): language 90%, API 82% — "most games will work well enough to be played", still rapidly improving. Per-API tracker: https://ruffle.rs/compatibility/avm2 . Real-world: Newgrounds, Kongregate (Ruffle integrated 2022-08-24) and Armor Games (~4,000 titles listed as Ruffle-playable, list updated through 2026-06-30: https://armorgames.com/page/flash-games-playable-using-ruffle) all run AS3 games through it; complex AS3 games (Stage3D/Starling-heavy, some networking) are the remaining gaps.

**How to embed a SWF (self-hosted build).** Docs: https://github.com/ruffle-rs/ruffle/wiki/Using-Ruffle and https://github.com/ruffle-rs/ruffle/blob/master/web/packages/selfhosted/README.md
1. Download the `selfhosted` zip from a release (or `npm i @ruffle-rs/ruffle`) and serve `ruffle.js` + the `.wasm` files from your origin. `.wasm` must be served as `application/wasm` (Apache `AddType application/wasm .wasm`; nginx `types { application/wasm wasm; }`). CSP needs `script-src 'wasm-unsafe-eval'` and `style-src 'unsafe-inline'`. If SWFs or Ruffle are on another domain, set `Access-Control-Allow-Origin`.
2. **Polyfill mode:** `<script src="/ruffle/ruffle.js"></script>` — Ruffle replaces every legacy `<object>`/`<embed>` Flash tag in the page with its own custom elements `<ruffle-object>` / `<ruffle-embed>` (registered in `web/packages/core/src/internal/player/ruffle-embed-element.ts` and `ruffle-object-element.ts`).
3. **JS API mode:**
   ```html
   <div id="container"></div>
   <script>
     window.RufflePlayer = window.RufflePlayer || {};
     window.RufflePlayer.config = { autoplay: "on", unmuteOverlay: "visible", letterbox: "on",
                                    allowScriptAccess: true, allowNetworking: "internal", base: "/swf/" };
     window.addEventListener("DOMContentLoaded", () => {
       const ruffle = window.RufflePlayer.newest();
       const player = ruffle.createPlayer();
       document.getElementById("container").appendChild(player);
       player.ruffle().load("/swf/game.swf");   // or load({url, parameters, ...})
     });
   </script>
   <script src="/ruffle/ruffle.js"></script>
   ```
   Useful config keys: `autoplay`, `unmuteOverlay`, `letterbox`, `scale`, `quality`, `backgroundColor`, `wmode`, `splashScreen`, `preferredRenderer` (`webgpu`/`wgpu-webgl`/`webgl`/`canvas`), `publicPath`, `polyfills`, `base`, `allowScriptAccess` (enables `ExternalInterface` — "only enable for movies you trust"), `allowNetworking`, `openUrlMode`, `contextMenu`, `showSwfDownload`, `maxExecutionDuration`, `frameRate`, `playerVersion`.
- **Score hook for SWFs:** only possible if the SWF itself calls `ExternalInterface.call(...)` or exposes `ExternalInterface.addCallback` (some portal games did, for Kongregate/Newgrounds/Mochi stat APIs). Ruffle supports ExternalInterface when `allowScriptAccess: true`. A stock SWF with no such calls gives you nothing — you'd have to patch the bytecode (below).

**Reskinning a SWF without the .fla — JPEXS FFDec.** https://github.com/jindrapetrik/jpexs-decompiler — **GPL-3.0, Java, 5,825 stars, pushed 2026-08-08.** It can: replace bitmap images, sounds, fonts and text; edit vector shapes (via SVG import); export SWF→FLA; edit AS1/2/3 — reliably as P-code/assembler, "experimental" as direct source edit; has a debugger. Technically, asset-swapping a simple bitmap-based game (logo, background, a mascot sprite) and injecting an `ExternalInterface.call("onScore", score)` at the game-over handler is feasible for an experienced person in hours per game; vector-heavy AS2 games (most 2003-2008 portal games) are much more painful because art is timeline shapes, not files, and AS2 code is scattered on movieclips. Legally it is irrelevant that it's feasible: it's creating a derivative work of a copyrighted game and requires the rights holder's permission (section 7).

---

## 3. Internet Archive Flash collection

- Collection: https://archive.org/details/softwarelibrary_flash_games — **6,504 items** (6,406 tagged `emulator:ruffle-swf`), inside parent https://archive.org/details/softwarelibrary_flash — **20,737 items** (counts from `archive.org/advancedsearch.php`, 2026-08-24). Only 17 items in the games collection mention "addictinggames" in metadata; IA's Flash holdings are crowd-uploaded, not a portal crawl.
- Playable in-browser via **Ruffle inside Emularity** since 2020-11-19 (https://blog.archive.org/2020/11/19/flash-animations-live-forever-at-the-internet-archive/). Upload recipe: mediatype `software`, metadata `emulator: ruffle-swf`, `emulator_ext: swf`; single SWF, no spaces in filename ("The emulator only works with a single SWF file at the moment"). Multi-asset/site-locked games generally don't work here (that's Flashpoint's niche).
- Licensing stance: none granted. The blog post says nothing about rights. IA is a library operating under DMCA safe harbor with a takedown process; item-level `licenseurl`/rights metadata is whatever the uploader set, usually nothing. As with Flashpoint: good for archiving and playing, not a source of reusable licenses.

---

## 4. Addicting Games specifically

**Ownership chain (verified):**
- 2002: founded by **Bill Karamouzis** (domain + upload infrastructure). (TheWrap, 2020-09-30: https://www.thewrap.com/how-gaming-hub-addicting-games-revived-itself-a-decade-after-its-sale-to-viacom/)
- ~2005: acquired by Atom Shockwave / Atom Entertainment; **Viacom (MTV Networks)** bought Atom Entertainment for ~US$200M in 2006; AG then sat under Nickelodeon/MTVN.
- 2014: Viacom moved GameTrailers, Addicting Games and Shockwave into **Defy Media** in exchange for a stake (https://variety.com/2014/digital/news/defy-media-acquires-viacom-digital-game-assets-1201216394/). Defy Media collapsed 2018-11-06.
- 2018: Karamouzis **bought AG and Shockwave back** ("we bought the company back, we bought the games and Shockwave website back in 2018") as Addicting Games, Inc.
- 2021-09: **Enthusiast Gaming Holdings** (TSX: EGLX) acquired Addicting Games, Inc. for ~US$34.4M ($10M cash + $12M stock + deferred) — https://www.enthusiastgaming.com/enthusiast-gaming-acquires-addicting-games-enters-casual-gaming-market/ ; SEC exhibit https://www.sec.gov/Archives/edgar/data/1854233/000153949721001298/exh99-1.htm
- 2024-04: EG sold "non-core" casual assets — **Shockwave, LittleBigSnake, MathGames.com, TypeRacer** — for C$4.1M; AG was retained (https://www.enthusiastgaming.com/enthusiast-gaming-advances-strategic-objectives-with-c4-1-million-sale-of-select-non-core-assets/).
- 2025-08-30: EG sold its direct-sales business to Vertiqal Studios; AG retained (https://www.enthusiastgaming.com/enthusiast-gaming-completes-direct-sales-business-divestment/).
- 2026: still EG-owned; Q2 2026 results mention AG's "Indie Spotlight" and new developer center (https://www.enthusiastgaming.com/enthusiast-gaming-reports-q2-2026-financial-results/). So: **Addicting Games = Enthusiast Gaming property as of Aug 2026.** ("Formerly Viacom/MTV" is correct; "now part of Enthusiast Gaming" is correct.)

**What happened to the Flash library:**
- 2020-12-16 blog "Flash and the Future of Addicting Games" (https://www.addictinggames.com/blog/flash-and-the-future-of-addicting-games): they had "published thousands of Flash games"; "We ported and published the 10 most popular Flash games of the past 20 years into HTML5" (Helicopter, The Impossible Quiz, Kitten Cannon, Tanks, Bloons, 4 Wheel Madness, Stunt Dirt Bike, ...); "For the last two years, we have been exclusively publishing Mobile, HTML5, and IOGames."
- 2021-06-11 blog "How to Play Flash Games in 2021" (https://www.addictinggames.com/blog/how-to-play-flash-games-in-2021): adopted **Ruffle**; "we have about 30% of our catalog back online" with more being re-enabled as compatibility improved. So the live site today is a mix of native HTML5, a few in-house HTML5 ports, and Ruffle-emulated SWFs.

**Do they own the games?** Mostly no. AG was (and is) a *publisher/portal*: the bulk of the catalog was third-party developer submissions under non-exclusive licensing/sponsorship deals, plus some titles they commissioned or later bought outright (e.g., they acquired Diep.io: https://www.addictinggames.com/blog/addicting-games-acquires-tank-game-diepio). Karamouzis on sourcing: "we really want to see the creator behind it is community-driven." Developers of the "top 10" they ported (from Flashpoint DB developer fields + Flash Gaming Wiki):
- Helicopter Game — SeeThru.co.uk (2002/2004)
- Kitten Cannon — Dan Fleming / BurstStudio (2005)
- The Impossible Quiz — Splapp-me-do (Glenn Rhodes), 2007, Newgrounds original
- Tanks — 2DPlay (2004)
- Stunt Dirt Bike — IriySoft (2007)
- Bloons — Ninja Kiwi
- Fancy Pants Adventure — Brad Borne; Achievement Unlocked — jmtb02 (John Cooney, Armor Games); Effing Worms — Effing Games; Escape the Prison — Puffballs United
So even Enthusiast Gaming can't license most of them to you; you'd be negotiating per developer.

**Openly licensed AG titles?** **None found.** No AG game has a public source release or open license; the AG blog and ToS grant nothing; searches of GitHub for the top titles return only fan clones (e.g., "impossible quiz" → a Java Swing quiz; "boxhead" → asset rips; "bloons" → BTD6 mod helper). Honest answer: no.

---

## 5. Flash-era games with real open-source releases (verified with `gh api`)

Legend: **usable** = license permits modification + commercial use. Stars/pushed as of 2026-08-24.

### Genuinely open source, commercially usable
| Repo | Stars | License | What it is | Web embed |
|---|---|---|---|---|
| `ninjamuffin99/canabalt-hf` | 144 | **MIT** (code, © Finji 2024) — assets **All Rights Reserved** in `canabalt-assets` | The *official* HaxeFlixel port of Canabalt (2009, Adam Saltsman), sanctioned by Finji; "as close to the original source code as it could get". Newgrounds.io leaderboard already wired. | `lime test html5` → static bundle |
| `AdamAtomic/Mode`, `EZPlatformer`, `Flx-Invaders`, `FlxTeroids`, `Bomber-Planet`, `FlxCollisions` | 75/41/27/15/21/24 | **MIT** (license.txt in each, verified) | Adam Saltsman's 2009-2011 Flixel demo games (Mode is the canonical flixel game) | AS3 → compile with Flex/AIR SDK → Ruffle; or use the HaxeFlixel ports |
| `AdamAtomic/Flappybalt` | 23 | **MIT** | Canabalt-themed Flappy Jam game (2014) | same |
| `HaxeFlixel/flixel-demos` | 465 | **MIT** (LICENSE.md) | HTML5-targetable ports: Mode, EZPlatformer, FlxInvaders, FlxTeroids, Flappybalt, Breakout, FlxSnake, MinimalistTD, Flixius, ProjectJumper, Revenge, … | `lime test html5` |
| `AdamAtomic/flixel` | 1,143 | **MIT** | The Flash-era engine behind Canabalt/Gravity Hook/Fathom (AS3) | via Ruffle |
| `HaxeFlixel/flixel` / `openfl/openfl` | 2,197 / 2,153 | MIT | Modern successors; HTML5 target | build |
| `gabrielecirulli/2048` | 13,361 | **MIT** | The original 2048 (2014) | static |
| `wayou/t-rex-runner` | 2,176 | **BSD-3-Clause** | Chrome's Dino runner extracted from Chromium | static |
| `BKcore/HexGL` | 1,736 | **MIT** ("code and resources") | 2012 WebGL racer | static (three.js) |
| `MaxBittker/sandspiel` | 3,158 | **MIT** | Falling-sand game (Rust/wasm), sandspiel.club | build (strip Firebase sharing) |
| `ncase/nothing-to-hide` | 787 | **CC0** | Nicky Case's 2014 open-source stealth game | static |
| `ncase/wbwwb` | 1,448 | **CC0** (README; no LICENSE file) | We Become What We Behold (2016) | static (PIXI) |
| `ncase/trust`, `ncase/anxiety` | 6,273 / 496 | CC0 | interactive explainers, not arcade | static |
| `nebez/floppybird` | 598 | Apache-2.0 | Flappy Bird clone (art imitates the original — replace it) | static |
| `daleharvey/pacman` | 731 | WTFPL | HTML5 Pac-Man (Pac-Man is a Bandai Namco trademark — must re-theme fully) | static |
| `increpare/PuzzleScript` | 1,092 | MIT | Engine; thousands of tiny community games (each author sets own license) | static export |
| `inolen/quakejs` | 1,609 | README says MIT (engine is ioquake3-derived → treat as GPL-2.0); needs Quake 3 data (proprietary) or OpenArena | Quake 3 in browser | server + static |
| `mozilla/BrowserQuest` | 9,378 | **MPL-2.0** code / **CC-BY-SA-3.0** art (archived 2023) | 2012 HTML5 MMO demo | node server |

### Open source but copyleft (fine if you publish your modified JS — see §7)
| Repo | Stars | License | Notes |
|---|---|---|---|
| `Hextris/hextris` | 2,435 | GPL-3.0 | 2014 hex-Tetris, hextris.io |
| `candybox2/candybox2` | 610 | GPL-3.0 (license header with minified-distribution exception; GitHub doesn't auto-detect) | Candy Box 2 (2013). Candy Box 1 repo `candybox2/candybox` (244★) has **no license file** |
| `doublespeakgames/adarkroom` | 8,241 | MPL-2.0 (file-level copyleft, commercial OK) | A Dark Room (2013); text game, no score |
| `lostdecade/onslaught_arena` | 203 | GPL (README; no LICENSE file); assets "cannot be resold without our permission" | 2010 HTML5 arena shooter |
| `ellisonleao/clumsy-bird` | 1,620 | GPL-3.0 | melonJS Flappy clone, archived |
| `freeciv/freeciv-web` | 2,188 | **AGPL-3.0** client / GPL server | heavy Java+C server stack |
| `cloudflare/doom-wasm` | 411 | GPL-2.0 (Chocolate Doom) | Doom in browser; use Freedoom (BSD) IWAD. `id-Software/DOOM` itself: 19,456★, GPL-2.0 |
| `SuperTux/supertux` | 3,130 | GPL-3.0 | Official WASM build exists (≥0.6.3): https://play.supertux.org/ |
| `The-Powder-Toy/The-Powder-Toy` | 5,278 | GPL-3.0 | Emscripten target in CI; needs COOP/COEP headers (SharedArrayBuffer) |
| `nxengine/nxengine-evo` | 545 | GPL-3.0 | Cave Story engine re-implementation; needs Pixel's freeware (not open) data files |
| `caiiiycuk/js-dos` | 1,322 | GPL-2.0 (package.json) | DOSBox in browser — for DOS-era shareware, not Flash |
| `jealouscloud/linerider-advanced` / `RatherBeLunar/LRA-Community-Edition` | 54 / 11 | GPL-3.0 | Line Rider spiritual successors — **C# desktop**, not embeddable. `kevansevans/OpenLR` (MIT, Haxe, 9★) can target JS; `conundrumer/lr-core` has **no license**. "Line Rider" itself (Boštjan Čadež, rights sold to inXile 2007) is proprietary; linerider.com is closed source. |

### Source-available but NOT usable commercially (be honest)
| Repo | Stars | License | Notes |
|---|---|---|---|
| `TerryCavanagh/VVVVVV` | 8,014 | "VVVVVV Source Code License v1.0" — personal use/compile only; redistribution needs permission; no assets included | Repo includes the original 2010 **Flash/AS3** source too. Not open source. |
| `TylerGlaiel/GlaielGamesOldFlashSources` | 33 | **CC BY-NC-SA 4.0** | Every Glaiel Flash game 2001-2012 as .fla: Closure, Spectrum, Nutcracker, Aqua Slug, Pigeon Pooper, Blockslide, Chain Reaction, Magnetism, Nightstrike, Paths, Pilgrimage, Tetraform, Warehouse, Butcher Bugs, Fracuum, Krazy Kar, Egg Hunter, Gone Bananas, Incubus Pulsum, Pico UFO, Sousapalooza, Project Monochrome, A216 … "preservation and educational purposes only". Mostly AS2 (needs Flash CS6). |
| `ericjohnson/canabalt-ios` | 1,587 | Custom "Canabalt Game License": everything except the `flixel-ios` folder is proprietary "Content" | 2011 iOS source drop. Not open source. Use `canabalt-hf` instead. |
| `nuclear-unicorn/kittensgame` | 98 | "WET PAWS LICENSE": "Using the game code for commercial gain or creation of derivative works is not permitted." | Not usable. |
| `ozh/cookieclicker` | 286 | none — unauthorized mirror of Orteil's proprietary game | Not usable. Cookie Clicker is closed. |
| `jgmize/paperclips` | 112 | none — mirror of Frank Lantz's Universal Paperclips | Not usable. |
| `OgarProject/Ogar` | 727 | custom LICENSE.md (archived 2020) | Agar.io *server* clone only; agar.io client is proprietary. |

### Confirmed NOT open source (no official source release exists; GitHub shows only fan clones)
Bloons/BTD (Ninja Kiwi), The Impossible Quiz, Boxhead, Frog Fractions, Motherload, Dolphin Olympics, QWOP/GIRP (Bennett Foddy), Crush the Castle, Bloxorz, Desktop Tower Defense, Fancy Pants, Papa Louie (Flipline), Gemcraft, Sonny, N (Metanet), Alien Hominid / Pico (Newgrounds/Tom Fulp), Meat Boy, Braid, Bejeweled/PopCap games, Kingdom of Loathing, Line Rider (original), Cookie Clicker, Universal Paperclips, Agar.io / Slither.io clients, Minecraft Classic (2019 web version), Powder Game (Dan-Ball; The Powder Toy is the GPL cousin). Notch's LD22 *Minicraft* source is public (many mirrors, e.g. `Miserlou/Minicraft`) but carries **no license**, so treat as all-rights-reserved.

Useful index: https://github.com/michelpereira/awesome-open-source-games (its Flash-era entries are essentially Flixel, FlashPunk, Starling, Bfxr and `JordanMagnuson/The-Killer` — confirming how thin the real list is).

---

## 6. Did the portals' own HTML5 ports release source? No.

| Portal | What they did after 2020 | Source released? |
|---|---|---|
| **Nitrome** | Asked Flashpoint to remove all their games (Flashpoint 8.0); converting library to HTML5 with **Poki** — ~50 of ~150 games done (https://www.nitrome.com/blog/articles/1427/ , https://news.ycombinator.com/item?id=23314635) | No |
| **Armor Games** | Runs catalog through Ruffle; ~4,000 titles listed as playable, list still updated 2026-06-30 (https://armorgames.com/page/flash-games-playable-using-ruffle); others delisted | No |
| **Kongregate** | Stopped submissions 2020-07-01; ported top in-house titles to Unity; integrated Ruffle site-wide 2022-08-24; Diamond sponsor of Ruffle (https://medium.com/@kongregate/unlocking-kongregates-flash-games-65cca6805e6d , https://medium.com/@kongregate/play-your-favorites-again-more-flash-games-return-5788c3d1849a) | No |
| **Newgrounds** | Built the standalone **Newgrounds Player**; embeds Ruffle on-site (`?emulate=flash` forces it); Diamond sponsor; runs "Flash Forward" jams (2025) whose Flash entries play via Ruffle | No (Newgrounds.io API is open, games aren't) |
| **Coolmath Games** | Converted 100+ Flash games to HTML5 (Run 3, Bloxorz…), uses **AwayFL** and Ruffle for the rest (https://www.coolmathgames.com/coolmath-games-and-flash , https://www.coolmathgames.com/blog/using-flash-emulator-to-bring-back-games) | No |
| **Miniclip** | Shut down 100+ Flash games in 2020; closed the browser portal July 2022 keeping only 8 Ball Pool and Agar.io (https://en.wikipedia.org/wiki/Miniclip) | No |
| **Addicting Games** | 10 in-house HTML5 ports + Ruffle for ~30%+ of catalog (see §4) | No |

Individual developers who did open-source (the real list): Adam Saltsman (Flixel + demos, MIT; Canabalt code MIT via Finji's 2024 port), Terry Cavanagh (VVVVVV, non-commercial), Tyler Glaiel (all Flash FLAs, CC BY-NC-SA), Nicky Case (CC0), Jordan Magnuson (The Killer, AS3), Lost Decade Games (Onslaught Arena, GPL), Mozilla (BrowserQuest, MPL), Gabriele Cirulli (2048, MIT), Logan Engstrom (Hextris, GPL), aniwey (Candy Box 2, GPL), Michael Townsend (A Dark Room, MPL), Max Bittker (Sandspiel, MIT). Ludum Dare entries are required to publish source, but "source available" ≠ licensed (e.g., Notch's Minicraft, Saltsman's `GraveRobbers` LD48 repo has no license file).

---

## 7. Legal reality check for a reskin + play-to-earn portal (practical, not legal advice)

1. Emulating/hosting a SWF you don't own (Flashpoint dump, IA, scraped portal) is the same act the portals and archives do — tolerated preservation, but you have no license; adding sponsor branding and paying players for scores turns it into a commercial derivative work and a DMCA/trademark magnet. Don't build the business on it.
2. Reskinning needs (a) source or clean asset separation and (b) a license permitting modification **and** commercial use. MIT/BSD/Apache/CC0/MPL/WTFPL: yes, keep the notices. CC BY-NC-SA (Glaiel), VVVVVV's license, Kittens' "Wet Paws": no. "No LICENSE file" (lr-core, Candy Box 1, Minicraft, Onslaught's missing file): all rights reserved — ask the author.
3. Trademarks are separate from code: Canabalt's code is MIT but "Canabalt", its art and Danny B's music are reserved — ship it as "Mascot Run" with your own assets. Same for Pac-Man, Flappy Bird, Doom, Quake names/assets.
4. GPL browser JS: the JS you serve is "distributed" to every visitor, so the GPL/LGPL obligations bite — you must make the corresponding modified source of the game available (a link to your repo is enough) under GPL. The "SaaS loophole" only covers server-side code; **AGPL** (Freeciv-web) closes that too. Your own portal shell, wallet and scoring backend can stay proprietary if kept as separate programs communicating over HTTP, but the modified game itself must be published. MPL-2.0 is lighter: only modified MPL files must be published.
5. Score integrity: anything computed client-side (all of these) is trivially spoofable; for real payouts you need server-authoritative or replay-verified scoring, which is a rewrite for most of these games anyway — favor titles with a small deterministic core (2048, t-rex-runner, Hextris, Flappy) where you can replay inputs on the server.
6. Playing to earn also drags in sweepstakes/gambling rules per jurisdiction and platform policies; scope that separately.
7. Practical path: (i) archive Flashpoint Ultimate privately for reference; (ii) host Ruffle-emulated SWFs only where you have written permission from the developer (AG's catalog = per-developer deals; EG can't license most of it); (iii) build the reskin/P2E product on the MIT/CC0/BSD list above plus copyleft titles you're willing to publish; (iv) for anything Flash-native you do get rights to, get the .fla or use FFDec to swap assets and inject an `ExternalInterface` score callback, then serve via Ruffle with `allowScriptAccess: true`.
