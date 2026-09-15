# Implementation decisions and verification

Working branch: codex/slop-survivor-complete. Pull request base: slop-survivor-progression. No changes are committed to main.

## Baseline repair

The supplied baseline at fc9c41c passed 70 unit tests but failed three of 45 deterministic encounters: chapter 13 Hard, 14 Hell, and 15 Hell. Section 5b already requires campaign Market Crash and volatile explosions to scale from the highest-damage collected weapon. Applying that change fixes all three losses with the same seeds and card policy, without changing chapter health, speeds or the test's pass criteria. Tournament special scaling is preserved because the brief explicitly keeps its rules unchanged.

## Handoff reconciliation

The user authorized resolving contradictions on this working branch. The final implementation and verification record decisions here rather than silently changing the scope.

- The newer branch instruction supersedes the TXT's original instruction to branch from main.
- The analytical model is a target, not proof that real engine runs win. The balance harness must retain engine simulation and report failures honestly.
- Exact source formulas take precedence over rounded illustrative totals when they disagree.

## Progression integration checkpoint (phases 1 and 2)

The save schema and engine consumers are committed together because changing difficulty IDs, chest storage, level bounds and permanent power separately would leave a broken intermediate game. Both phases' requirements remain in scope. The checkpoint passes 105 tests and 63 sampled real engine encounters, including level 100 Impossible. The full sweep and economy replay remain phase 6 requirements.

- Generate ten acts with five recurring bosses, boss phases on every tenth level, secondary phase behavior in the latter five acts, and a rotating section-trait table. All 15 original chapter definitions remain anchor inputs.
- Legacy chapter 15 has 13.3x health, which is nearest level 23, contradicting the explicit migration endpoint of level 21. Calibrate the legacy log-health range to the specified endpoints, preserving all intermediate clears and their difficulty records.
- Round weapon level conversion upward whenever the nearest level would lose damage. Refund the actual legacy parts costs of removed upgrade steps.
- Use one shared blueprint balance, as the TXT describes a four-currency account and gives a total 132-blueprint demand without a per-weapon allocation rule. Discovery still gates each purchase. This resolves the design table's isolated per-weapon label.
- Integer rewards round after applying the tier multiplier. Chests distribute their listed total parts across the stated number of distinct weapons, limited only by the unlocked roster.
- If a milestone arrives at the 32-chest cap, automatically open the oldest available low-tier chest, retain its loot, and store the guaranteed Vault chest.
- Phase verification uses the original engine test suite adapted to the changed rules, plus additional regression tests. The analytical bands and actual simulated victories are reported separately.

## Final integration and verification

- Phase 3 passed 133 tests and 63 sampled encounters, then committed all ten mechanics and new save state.
- Phase 4 passed 135 tests and 63 sampled encounters, then committed ten generated WebP sprites, all ten procedural icons, effect rendering and offline asset entries. PNG masters were retained as deliverables. Built-in image generation was used; its API exposes no model selector, so the record does not assert a specific hidden model.
- Phase 5 passed 138 tests and 63 sampled encounters. Browser checks covered fresh saves at 320 and 390 portrait widths and 844 by 390 landscape, all home tabs, the Refinery and live combat. Foundry text contrast was corrected during visual review.
- Late campaign damage initially refilled Market Crash nearly every frame. Scale campaign charge by encounter health and count effective damage, eliminating all tested Hard no-card wins. Tournament charge behavior is preserved.
- The intended test account funds six core weapons, not the entire unlocked roster. Extra weapons stay level 1 and remain eligible, with S discovery followed by a later blueprint unlock. The full sweep reports actual wins, shield margins, timings, no-card controls and save-validation checkpoints.
- The design's card multiplier is an analytical pressure index. It is not an experimentally measured minimum multiplier. The harness checks the original model band and an independently reconstructed index using actual spawned health and permanent weapon/Foundry stats. It reports engine outcomes separately.
- The economy replay uses real reward, chest, rank, level, Foundry and Refinery transactions. It assumes a ten-minute idle interval per completed clear, no free currency injection, and at most twenty repeat clears total. The recorded route needs fourteen repeats. Halving reward income causes the regression test to fail.
- Real v1 fixtures were generated from the supplied original engine at fc9c41c. Migration preserves both run slots, rolled cards, existing projectiles and account totals. Fresh-device cloud restoration is distinguished from replacement of an existing v2 account.
- Flash Loan countdowns clamp at zero while debt suppresses firing, keeping fast weapons saveable. Effect iteration snapshots the current effects so chained traps appear armed before the next simulation tick. Lambo path state, projectile hit IDs and duplicate weapon state receive additional validation.
- The six-to-twelve-minute session length remains a pacing target rather than a forced timer. The deterministic bot chooses cards instantly and excludes time spent reading choices. Early runs can be shorter and unlucky low-investment builds longer. A trial that delayed campaign choices introduced a loss and was removed. The final report explicitly includes the observed timing distribution rather than padding runs with waiting or hiding outliers. Health, speed and wave-count formulas remain unchanged.
