# Cash Cannon

Original browser launch game inspired by Kitten Cannon, starring CashCat. Vanilla JavaScript and Canvas; no build step or runtime dependencies.

Run `npm.cmd --prefix games/cash-cannon start`, then open http://127.0.0.1:8783. Run tests with `npm.cmd --prefix games/cash-cannon test`.

Aim with the arrow keys or slider. The power meter oscillates automatically; press Space or Fire CashCat to launch. P pauses. There is no steering after launch. Mobile landscape puts launch controls on the left and expands the game. Native fullscreen is requested from a tap when supported; full-window mode handles browsers that deny it.

| Object | Effect |
| --- | --- |
| DEX Boost | Trampoline sends CashCat upward |
| Cabal Push | Ground dynamite adds speed and height |
| CEX Listing | Eleven branded balloons with hanging bombs; either part triggers a boost |
| Honey Pot | Swallows CashCat and ends the run |
| Rug Pull | CashCat lands, stops, then the carpet pulls away and he spins onto his side |

Distance is stored as integer decimetres and shown as metres. The top five scores persist on this device only. These are practice scores, not an authenticated leaderboard. Replay downloads contain the seeded launch settings and result. `replay(launch)` in `js/model.mjs` reproduces the run at 120 Hz; this is not yet a server verification service.

The game suspends on tab blur or hiding and renders no ongoing frames at the title, pause or results screens. Skyline layers are cached and canvas pixel density is capped to limit mobile GPU use. Sound effects are synthesized locally with Web Audio.

Only this directory's runtime files are required for static hosting: `index.html`, `style.css`, `js/`, and `assets/`. No game ROM, original Kitten Cannon source, or original art is included.

The v2 graphics include spring-loaded DEX trampolines, bundled dynamite, a dripping honey-pot trap, and woven animated rugs. The rug ending lasts 2.4 seconds and pauses with the rest of the game. The replay ruleset is now `cash-cannon-v2`.

CEX variants: Binance, MEXC, Kraken, Coinbase, OKX, Bybit, KuCoin, Bitget, Crypto.com, Gemini, and Bitfinex. Original logos are stored locally in `assets/cex/`, with source URLs recorded in `art/cex-sources.json`. MEXC and Bybit use a drawing crop to isolate their official symbol or wordmark. The gallery on the landing page shows the complete lineup.
