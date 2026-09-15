# Implementation decisions and verification

Working branch: codex/slop-survivor-complete. Pull request base: slop-survivor-progression. No changes are committed to main.

## Baseline repair

The supplied baseline at fc9c41c passed 70 unit tests but failed three of 45 deterministic encounters: chapter 13 Hard, 14 Hell, and 15 Hell. Section 5b already requires campaign Market Crash and volatile explosions to scale from the highest-damage collected weapon. Applying that change fixes all three losses with the same seeds and card policy, without changing chapter health, speeds or the test's pass criteria. Tournament special scaling is preserved because the brief explicitly keeps its rules unchanged.

## Handoff reconciliation

The user authorized resolving contradictions on this working branch. The final implementation and verification record decisions here rather than silently changing the scope.

- The newer branch instruction supersedes the TXT's original instruction to branch from main.
- The analytical model is a target, not proof that real engine runs win. The balance harness must retain engine simulation and report failures honestly.
- Exact source formulas take precedence over rounded illustrative totals when they disagree.
