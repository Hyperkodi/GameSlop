# Slop Survivor: The Serpent Siege

A mobile browser defense game. Wojak defends the vault against Slippy and four recurring bosses. The v2 campaign has **100 levels, three difficulties and 24 weapons**. Each attempt starts with Mint Condition and builds a fresh arsenal from battle chests.

## Run and verify

From `games/slop-survivor`:

```sh
npm start                     # http://localhost:8193
npm test                      # deterministic unit and regression tests
node tests/balance.mjs         # 63 encounters, no-card checks, 100-level economy
node tests/balance.mjs --full  # all 300 encounters and 100 Hard no-card controls
node tests/economy-harness.mjs # detailed purchase and farming replay
```

No build step, framework or package dependencies. Use an HTTP server rather than opening `index.html` directly. All production files can be served statically from a subdirectory. HTTPS enables supported browsers' installation and offline features.

## Permanent progression

- Weapons reach level 50 through five ranks. Spend coins and that weapon's parts on levels, and cores on ranks.
- Foundry Ordnance, Precision, Overclock and Vault improve every future run.
- C/B weapons come from Easy clears, A weapons from Hard clears, and S weapons require discovery plus 22 shared blueprints each.
- Every unlocked weapon remains eligible in battle. Account investment increases its selection weight. There is no pre-equipped loadout.
- Six battle slots expand to seven after Easy level 30 and eight after level 65.
- The Refinery exchanges 3 spare parts for 1 part of any unlocked weapon.
- Four idle chest tiers share a 32-chest cap and a ten-minute timer. Better tiers appear with campaign progress. Every tenth Easy first clear grants a Vault chest.
- See [PROGRESSION.md](PROGRESSION.md) for exact formulas, rewards, all weapons and migration rules.

## Controls and saves

Weapons fire automatically. Use the thumb joystick, mouse, arrow keys or WASD to focus fire; a mouse keeps focus fire while it is over the arena. Each wave, Slippy rushes in at 5x speed until three sections are on the board; on Hard and Impossible a starting bonus can slow or remove that rush. Space or the star button activates Market Crash. Escape or the pause button pauses. Switching applications pauses and saves. Settings include independent music/effects volume and reduced effects.

Campaign and endless tournament have separate saved attempts. The tournament keeps its three revives, score, arsenal and personal best across reloads. Permanent account bonuses apply to new attempts. No online leaderboard or paid progression is included.

Local progress saves automatically. Telegram Mini App launches also synchronize account progress. Version 1 saves migrate automatically, including existing battle choices and both active runs. An existing v2 account rejects a newer-timestamp v1 cloud snapshot. A fresh device can recover and migrate its old cloud save.

## Art and offline play

All 24 weapons have original procedural icons and illustrated sprites. The ten expansion sprites were generated individually as transparent PNG masters and converted to WebP. [ART-PROMPTS.md](ART-PROMPTS.md) records the exact prompts and selected source files. Existing character art and generic weapon poses remain in use. The service worker caches every runtime module and sprite.

Mobile browser checks cover 320-pixel and 390-pixel portrait layouts, landscape, purchases, live combat rendering, saved progression and an offline reload. These checks use Chromium emulation, not physical iPhone or Galaxy hardware. Device-clock-based saves are not a server-authoritative competitive system.

## Verification and design decisions

[VERIFICATION.md](VERIFICATION.md) records the baseline, final tests, campaign sweep, economy assumptions and passing pacing checks. [IMPLEMENTATION-NOTES.md](IMPLEMENTATION-NOTES.md) explains resolved brief contradictions and engine fixes. The analytical model in `docs/superpowers/specs/2026-09-14-slop-survivor-curve-model.mjs` remains the source of the target difficulty band; actual engine victories are tested separately.

Original fan-made game implementation and artwork. No Cell Survivor assets or affiliation claims. Character progression beyond Wojak remains the existing separate backlog in [CHARACTER-BACKLOG.md](CHARACTER-BACKLOG.md).

[REQUIREMENTS-AUDIT.md](REQUIREMENTS-AUDIT.md) maps the full brief to implementation and verification. The full 300-encounter sweep requires every Easy clear to take four to twelve active minutes, allows Hard up to 16 minutes and Impossible up to 15 because breaches push the snake back, requires Hard to cost shields, and requires Impossible to be lost by the optimal bot on some first attempts while every level stays winnable within three.
