# Armara Aegis Live Tower Management and Animation Specification

**Date:** 2026-08-30
**Status:** Approved implementation contract
**Scope:** Candidate battle presentation and contextual tower management

## 1. Goal

Tower controls must work during an active wave without making the player guess whether an order was accepted. Towers must also communicate firing through intentional poses and effects, without visible upgrade-number badges or whole-body shaking.

This specification narrows and implements the existing contextual-management and animation requirements. It does not change combat values, costs, the 70 percent sell rule, command schemas, simulation order, or replay identity.

## 2. Battlefield level presentation

- No visible number, level badge, or level marker is drawn beside a deployed tower on the battlefield.
- The tower's level remains available in the occupied-tower panel, upgrade comparison, accessible name, SVG title, and keyboard-readable tower list.
- Removing the battlefield badge must not remove any authoritative level data or alter sprite-row selection.

## 3. Tower firing animation

- An idle tower holds one stable `idleA` atlas frame. It never loops through idle, active, and recovery cells on a wall-clock cycle.
- Authoritative attack cooldown state drives firing presentation. A newly reset cooldown selects the authored `active` frame, followed by the authored `recover` frame, then the stable `idleA` frame.
- Frame selection is derived from canonical cooldown facts and produces the same result for the same state. Animation frames never drive targeting, damage, timing, economy, hit testing, or replay data.
- The whole tower sprite must not shake, jitter, or repeatedly translate when firing. Motion comes from the authored active and recovery poses plus bounded tower-specific effects such as a muzzle flash, time ring, bolt, shell, or shockwave.
- Effects remain short, readable, clipped to the battlefield, and must not obscure tower selection, enemy health, the route, or Aether feedback.
- Reduced Motion holds the stable idle body frame and replaces large motion with a short restrained effect. It does not change the authoritative cooldown or attack result.
- Missing or failed optional art falls back without affecting simulation.

## 4. Management during an active wave

- A player may select an empty foundation or deployed tower while a wave is active.
- Opening the contextual store or inspector immediately suspends combat presentation. Enemies, cooldowns, effects, and the simulation tick do not advance while the panel is open.
- Build, upgrade, and sell controls remain usable during this contextual suspension, subject to their ordinary rules: equipped defense, empty or occupied pad, available Aether, maximum level, specialization requirements, and the Mission 1 tutorial gate.
- A locally valid build or upgrade queues one deterministic command at the current simulation boundary. A confirmed sell does the same.
- Once such an order is queued, the contextual panel closes automatically, combat resumes, and the command applies at the beginning of the next fixed tick. The player must not be asked to close the panel to make the order happen.
- The queued command keeps its host-owned current tick and sequence. The command is recorded once and follows the existing kernel validation, denial-event, replay, and hash contracts.
- Canceling the panel or canceling sell confirmation costs nothing, records no command, and returns focus to the selected battlefield foundation or tower.
- A validation failure that prevents queuing keeps the panel open and explains the reason without mutating state.
- Manual Pause remains separate. Closing a contextual panel does not resume a battle that the player manually paused.

## 5. Mission 1 upgrade tutorial

- A first non-skipped Mission 1 run still withholds Upgrade until Wave 1 clears or the player explicitly skips the tutorial gate.
- When the selected tower has another level but Upgrade is gated, the inspector visibly explains: `Upgrades unlock after Wave 1. You can still build and sell during the wave.`
- The explanation is visible player copy, not only a disabled-button title or accessibility label.
- No later wave adds another ordinary upgrade lock.

## 6. Determinism and pause invariants

- Contextual suspension is presentation and scheduler state. It is excluded from canonical simulation state, replay input, and hashes.
- A suspended panel with no queued order makes zero kernel `advanceTick` calls.
- Queuing an order does not advance combat. Closing the panel permits the existing fixed-step loop to apply the order at the next tick boundary.
- Build, upgrade, and sell continue to resolve only through the authoritative management reducer. Presentation code never adjusts Aether, tower level, investment, refund, runtime IDs, or combat timers directly.
- Sell remains `floor(actual invested Aether * 70 / 100)` and requires deliberate confirmation.
- Existing ABI v1 and ABI v2 command records remain unchanged.

## 7. Accessibility and feedback

- Battlefield foundations and towers remain keyboard selectable during planning and active waves.
- Opening the panel moves focus to its Close control. Closing or completing an order returns focus sensibly to the battlefield without scrolling the selected site out of view.
- Prices, affordability, current Aether, next-level changes, and sell refund remain visible and do not depend on color alone.
- The status message reports that the order was queued and will apply as combat resumes. The applied or denied result is then reported from the next authoritative command event.

## 8. Acceptance

Automated coverage must prove:

1. idle, active, recovery, and reduced-motion tower frame selection follows cooldown facts and never uses a free-running loop;
2. no visible battlefield level badge is emitted while panel and accessibility level information remains;
3. opening a tower panel during a wave suspends fixed ticks;
4. active-wave build, upgrade, and confirmed sell each queue exactly one normalized command, auto-close the panel, resume combat unless manually paused, and apply on the next fixed tick;
5. cancel and failed validation record nothing and keep authoritative state unchanged;
6. Mission 1's upgrade gate remains enforced and visibly explained;
7. replaying the recorded inputs reaches the same canonical final hash; and
8. existing 70 percent refunds, runtime-ID monotonicity, pause behavior, and reduced-motion behavior remain green.

Local browser QA at desktop and mobile viewports must visibly prove:

- no tower level number appears on the map;
- a tower uses a distinct firing pose and readable tower-specific effect without body shake;
- an empty site can be selected and built during a wave;
- a deployed tower can be selected, upgraded, and sold during a wave;
- each completed order closes the panel and resumes motion; and
- the Mission 1 gate explanation is readable before Wave 1 clears.

Run bare `node --test` inside `games/aegis`. A live-site claim additionally requires `games/.nojekyll`, a 200 response from `/_kit/shell.js`, and a live CDP-driven Aegis boot.
