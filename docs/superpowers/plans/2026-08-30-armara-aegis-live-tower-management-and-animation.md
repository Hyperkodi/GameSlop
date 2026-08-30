# Armara Aegis Live Tower Management and Animation Implementation Plan

**Date:** 2026-08-30
**Specification:** `docs/superpowers/specs/2026-08-30-armara-aegis-live-tower-management-and-animation.md`
**Method:** red test, smallest implementation, focused tests, full bare `node --test`, browser proof

## 1. Preserve the command and simulation boundary

Files to inspect:

- `games/aegis/js/delivery/battle-session.js`
- `games/aegis/js/sim/kernel.js`
- `games/aegis/js/sim/management.js`
- `games/aegis/tests/preview-controller.test.js`
- `games/aegis/tests/kernel.test.js`
- `games/aegis/tests/kernel-v2-commands.test.js`

Do not add a wave-phase denial to build, upgrade, or sell. The management reducer already accepts those commands during combat. Keep the current command schemas, current-tick sequence rules, authoritative Aether handling, replay inputs, and hashes unchanged.

Add or retain focused tests proving that a suspended session with no order makes zero kernel advances, that a queued active-wave management order remains pending while suspended, and that the next resumed fixed tick applies it exactly once.

## 2. Repair contextual management flow

Primary file:

- `games/aegis/js/delivery/preview-controller.js`

Test file:

- `games/aegis/tests/preview-controller.test.js`

Implementation steps:

1. Keep active-wave site selection available on both SVG foundations and the accessible tower list.
2. Keep contextual panel opening as an automatic suspension distinct from manual Pause.
3. Leave build, upgrade, and sell enabled while the panel itself is causing suspension. Disable them only for their actual affordability, level, tutorial, fatal-error, or confirmation rules.
4. After a locally valid build or upgrade is queued, close the panel through the existing close path so focus and pause state stay consistent. Do the same only after sell confirmation succeeds.
5. Resume the fixed-step loop unless manual Pause remains active. Let the next tick apply the already normalized command and report its authoritative event.
6. Remove the `ORDER READY. CLOSE THE TOWER MENU TO APPLY IT` dead-end state. Replace it with concise queued and applied feedback.
7. Preserve panel state when no command was queued, including canceled sell and validation failures.
8. Make the Mission 1 gate explanation visible with the exact specification copy.

Focused tests must cover active-wave build, upgrade, and sell separately, one recorded command per action, auto-close, manual-pause non-resume, sell cancel, insufficient Aether, and tutorial-gated Upgrade.

## 3. Remove the battlefield level badge

Primary file:

- `games/aegis/js/delivery/preview-controller.js`

Related styles:

- `games/aegis/css/aegis-preview.css`
- any other Aegis stylesheet that defines `.preview-map-level`

Remove the visible SVG level text and its unused styling. Retain level text in the SVG title, `aria-label`, occupied-tower heading, next-level comparison, and accessible tower list.

Add a presentation assertion that rendered battlefield towers contain no `.preview-map-level`, while their accessible label and management panel still name the current level.

## 4. Use authored firing poses without body shake

Primary files:

- `games/aegis/js/delivery/preview-controller.js`
- `games/aegis/js/presentation/sprite-atlas.js`

Test files:

- `games/aegis/tests/preview-controller.test.js`
- `games/aegis/tests/act-i-gameplay-art.test.js`

Implementation steps:

1. Keep cooldown-derived action timing as the only firing-animation clock.
2. Map firing action to the tower atlas `active` frame, recovery to `recover`, and rest to `idleA`.
3. Remove the whole-sprite translate, rotate, and scale recoil transform. Do not add CSS shake or a wall-clock animation loop.
4. Retain and refine bounded tower-specific procedural effects so Sentinel, Chronos, and Siege read differently at gameplay size.
5. Keep the tower's authored level as the atlas row. Frame changes must never change the level row.
6. Keep Reduced Motion on `idleA` with a restrained semantic effect and no large transform.
7. Preserve asset-error fallback behavior.

Update the old stable-body regression test. It must still forbid free-running cycling, but it now expects `active`, `recover`, and `idleA` from authoritative cooldown states. Add a source or rendered assertion that firing applies no whole-body motion transform.

## 5. Deterministic and regression verification

Run focused tests first from `games/aegis`:

```text
node --test tests/preview-controller.test.js
node --test tests/act-i-gameplay-art.test.js
node --test tests/management.test.js
node --test tests/kernel.test.js
node --test tests/kernel-v2-commands.test.js
node --test tests/replay.test.js tests/replay-v2.test.js
```

Then run the full Aegis suite with bare `node --test` inside `games/aegis`. No generated content rebuild is required unless a simulation source or content record changes. If either changes, rebuild every required Aegis artifact set before rerunning the suite.

Check changed JavaScript with `node --check`. Search changed copy for U+2014 and remove any occurrence.

## 6. Driven browser QA

Use a local HTTP server and `tools/cdp-shot.js` with the Candidate release at desktop and mobile viewports.

The driver must:

1. enter Mission 1 and build a tower;
2. start Wave 1 and prove enemy progress advances;
3. select an empty foundation during combat and prove the tick stops while the panel is open;
4. build, then prove the panel closes, the command applies once, and enemy progress resumes;
5. inspect a deployed tower during combat and repeat the proof for upgrade after the tutorial gate is open;
6. confirm sell, prove the exact refund and one removal, then verify cancel records no command;
7. inspect the SVG and prove no `.preview-map-level` nodes exist while the selected tower's accessible label still includes its level;
8. capture a firing tower in active and recovery poses and verify no body-shake transform is present; and
9. repeat the animation check with Reduced Motion enabled.

Save QA screenshots only under the allowed documentation area. Do not stage unrelated research, `Assets/`, `.superpowers/`, handoff files, existing art-guide QA images, or excluded road assets.

## 7. Completion gate

The work is complete only when:

- every automated acceptance item in the specification is green;
- desktop and mobile CDP runs prove active-wave build, upgrade, and sell;
- the map has no visible tower level badge;
- tower fire reads as an authored action and recovery rather than a shake or frame loop;
- `games/.nojekyll` still exists; and
- the scoped diff contains no unrelated files.

Commit on `main` as `Ryan <ryan@xynco.io>` with the required Claude co-author trailer. Do not push, publish, or change the public route without Ryan's explicit approval.
