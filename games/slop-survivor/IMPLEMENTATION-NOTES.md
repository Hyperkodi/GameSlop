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
