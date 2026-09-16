# Brief compliance audit

Source: Slop Survivor Prompt.txt, sections 0 through 7 and Appendix A, with the user's later branch and autonomous-repair instructions. This audit is a completion gate. It does not turn a failing requirement into an accepted caveat.

## Setup and workflow

- Work derives from `slop-survivor-progression`, not main. The later explicit branch instruction supersedes the original TXT section 0.
- The supplied baseline and all listed design, implementation and art files were read. The curve model ran before and after balance changes.
- The supplied baseline passed 70 tests but only 42/45 encounters. The user authorized diagnosis and repairs; the repaired baseline passed 71 tests and 45/45 unchanged seeded encounters.
- No framework, bundler or runtime/package dependency was added.
- Passing checkpoints and phase commits are recorded in `IMPLEMENTATION-NOTES.md`. The schema/engine integration was atomic under the user's authorization to resolve handoff conflicts. That historical decision is not represented as two separate commits.
- PR #1 targets `slop-survivor-progression`. A fork provides the contribution branch because upstream direct writes were denied. No main branch is changed.

## Level curve and difficulties

- `generateLevels`, `rawPool`, `spawnWave`: 100 generated entries, exact EHP solve, capped per-wave pieces, 3/4/5/6 waves, prescribed speed curve.
- `campaign-pacing.mjs`: analytically derived entrance geometry targets eight minutes of baseline travel without adding health, waves, invulnerability, waiting states or changes to the simulation clock. The model prints its derivation.
- `tests/balance.mjs`: every timed combat must win in 360 to 720 seconds; timing is a failing assertion, not just a report.
- `DIFFICULTIES`, `createRun`, `chooseBoon`: all health/speed/shield/boon/reroll/reward values; Impossible traits; shield maximum ten.
- `unlockedChapter`, `unlockedDifficulty`: Easy unlocks the next level, Hard and Impossible remain optional. Test accounts cannot pre-clear the encounter under test.
- Generated boss, arena, phase and trait fields replace chapter-index mechanics. Existing five bosses are reused; no new boss art is required.

## Progression and economy

- `makeWeapon`: exact compounding levels and ranks. Five rank caps and core costs. All four Foundry axes, costs and caps.
- `upgradeWeapon`, `rankUp`, `upgradeFoundry`: validated purchases through the home UI, affecting future attempts.
- `arsenalSlots`: six slots, seven after Easy 30, eight after Easy 65.
- `completeRun`: integer first/repeat rewards, cores, S discovery blueprints, every-fourth Impossible blueprints, every-tenth Easy blueprints and Vault chest; duplicate completion protection.
- `CHESTS`, `syncChests`, `openChests`: four exact loot tiers, ten-minute interval, shared 32 cap, progress-based tier rolls, and milestone overflow preserves loot.
- `refine`: exact 3:1 exchange, unlocked target validation, no overdrafts; UI previews the transaction.
- All C/B, A and S discovery levels, grade factors and costs match the roster. Only Mint Condition is free. Shared blueprints follow the user's approved reconciliation of the conflicting per-weapon label.
- `economy-harness.mjs`: real reward and spending functions, cheapest useful affordable purchases, explicit idle and repeat farming, 85% threshold, bounded repeats, and a failing reduced-income regression.

## Weapons and battle behavior

- Every run begins with Mint Condition only. Every unlocked weapon remains eligible; investment changes weights, not eligibility. Campaign and tournament attempts remain separate.
- 24 weapons and gold evolutions have regression coverage. Ten new distinct types implement Paper Hands, Copium Tank, Money Printer, Bear Trap, Slippage, Sniper Bot, Wen Lambo, Halving Hammer, Flash Loan and Nonce Nuke.
- Tests cover hurt damage, contact healing and its cap, focus ramp/reset, crossing traps, two-second roots, vulnerability/Oracle multiplication, crit flag and armor bypass, path sweep/return, capped maximum-health strikes, debt suppression/refund, and distance falloff.
- Roots attach to living struck sections; killing the immobilized victims releases the root rather than freezing an empty entrance.
- Campaign special and volatile damage use the highest-damage weapon. Effective-damage charge scaling prevents the late no-card exploit.
- Tournament entrance, geometry, wave rules, special source, revives and saved scores remain unchanged, apart from the new permanent progression and roster.

## Art and interface

- All ten new weapons have distinct Canvas fallback branches and individually generated transparent WebP sprites. PNG masters are preserved. Exact prompts and selected source files are in `ART-PROMPTS.md`.
- The user confirmed using the available subscription image generator during this audit. The built-in generation method is recorded accurately without inventing an unexposed model identifier.
- All 24 sprites are listed and cached. Procedural/illustrated render tests and offline browser checks cover them.
- Trap markers, moving Lambo, Nuke shockwave, printer ramp, Slippage pips and Flash Loan timer are rendered. Existing generic player poses support all ten; baked new poses are optional.
- Armory shows grade, class, nominal effective DPS, rank, level and blueprint progress. Foundry, Refinery and four-tier Vault are usable.
- The 100-level picker follows the highest unlocked level with a persistent manual farming override.
- Shared K/M/B formatting is used for health, floating damage, card previews, score and permanent costs.
- Guide and result text use current difficulty and acquisition rules. No em dashes are introduced. Art follows the existing palette and silhouette style and includes no affiliation claims.

## Save migration and verification

- `normalizeSave` migrates v1 instead of discarding it: currency, parts refunds, non-decreasing damage, cores/ranks, clears, best scores, unlocks, settings and both active runs.
- Explicit migration endpoints and no-damage-loss rounding resolve internally contradictory numerical instructions, as authorized by the user. Real v1 engine fixtures verify the original save shape.
- `validRun` covers level 100, six waves, eight weapons, ten shields, levels/ranks/Foundry, new timers, hit IDs, paths, spacing and roots. Resumed new effects continue deterministically.
- Local and Telegram saving remain automatic with no manual save/load controls. Existing v2 progress rejects lower-version cloud saves. Fresh-device legacy recovery remains supported.
- Cache v2.0.1 includes all new modules and assets.
- Full sweep: all 300 actual encounters, 100 Hard no-card controls, actual HP and analytical band checks, economy replay, and save checkpoints. Level 100 Impossible must pass.
- Final test output and full sweep are committed and included in the PR description. Browser checks cover mobile layouts, purchases, rendering and offline reload.
- Online leaderboards, server-authoritative scoring and monetization remain out of scope and are not claimed to work.

Final numerical results are recorded in `VERIFICATION.md` and `tests/reports/` after the audit checks pass.
