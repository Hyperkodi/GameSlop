# Armara Aegis UI Polish Specification

Date: 2026-09-04
Status: Implemented presentation pass under Ryan's UI polish request
Scope: Player-facing `candidate-v4` campaign preview

## 1. Outcome

Armara Aegis should feel like a finished premium arcade game, not a developer panel wrapped around a battlefield. The interface must keep the battlefield dominant, make the next action obvious, and carry one consistent ancient Greece meets AI visual language across every screen.

This pass changes presentation only. It does not change simulation rules, progression, economy, rewards, input commands, or authored map geometry.

## 2. Visual language

- Obsidian and warm black form the base.
- Armara red marks decisive actions and danger.
- Antique gold marks titles, milestones, and important values.
- Electric cyan marks selection, tactical information, and focus.
- Pale limestone is reserved for readable text and high contrast edges.
- Fine Greek-key and circuit-like line work may decorate panels, but never compete with controls.
- The hourglass remains the primary logo.
- Existing environment and unit art remains unchanged in this pass.

## 3. Global hierarchy

- Remove or visually suppress release and developer chrome once the game is ready.
- Give every screen one dominant heading, one clear primary action, and a consistent panel rhythm.
- Use quieter borders for ordinary containers and stronger borders only for selection, rewards, warnings, and primary actions.
- Preserve visible keyboard focus and 44 pixel minimum targets.
- Use short transitions for hover, selection, screen entry, and drawers. Reduced Motion disables them.

## 4. Title and campaign

- The title screen uses a centered ceremonial hero with the Armara palette and clear progress at a glance.
- Main menu choices read as intentional arcade menu tiles rather than generic form buttons.
- Campaign acts read as chapters.
- Mission cards emphasize mission number, title, current state, and first-clear reward.
- Completed, current, and locked missions remain distinguishable without relying on color alone.

## 5. Loadout

- Laurels and difficulty remain visible at the top.
- Towers, Divine Protocols, Relics, and Reinforcements share one ordered card language.
- Equipped cards receive a strong cyan selection state.
- Locked cards remain legible and name their exact milestone.
- Divine Protocols remain two ordered rows of five on wide screens. Intermediate screens use balanced two-column rows. Phones use one column.
- The final briefing action remains visible at the bottom of the viewport while reviewing long loadouts.

## 6. Briefing, settings, and results

- Briefing copy reads like battle lore, followed by compact mission facts and Laurel targets.
- Settings group related controls with clear row separation and large inputs.
- Victory and defeat results use distinct ceremonial headers.
- Reward, Laurel, mastery, and share actions are visually ordered by importance.

## 7. Battle

- The map is the largest visual object at every supported viewport.
- Aether, Gate Health, Wave, Score, Start Wave, and Pause form one compact command deck.
- The tower store remains a right-side overlay on wide screens and a bottom sheet on narrow screens.
- Tower cards make build or upgrade cost the obvious action.
- Empty foundations are clickable but do not advertise strategy.
- The tactical authoring grid must never be visible to players.
- Selection, attack range, projectiles, impacts, and tower motion remain readable above the environment.

## 8. Responsive behavior

- Wide desktop uses the full available game canvas with a deliberate outer border.
- Tablet retains balanced grids and a map-first battle layout.
- Phone controls stack without horizontal scrolling or clipped buttons.
- Safe-area insets are respected for the command deck and tower sheet.

## 9. Accessibility

- Focus indicators remain at least 3 pixels and use the high-contrast focus green or system Highlight.
- Hover is never the only way to expose information.
- Disabled, selected, locked, completed, and warning states include non-color cues.
- Forced-colors mode removes decorative backgrounds and retains control boundaries.
- Reduced Motion removes entry, hover, pulse, and drawer animation.

## 10. Acceptance criteria

- The polish stylesheet loads after the existing preview and shell styles.
- Title, campaign, loadout, briefing, settings, result, battle, and tower-store surfaces each have explicit polish rules.
- The tactical grid is hidden in the player interface.
- Wide protocol layout remains five columns, intermediate layout becomes two columns, and phone layout becomes one column.
- No em dash appears in new player copy, source comments, spec, or plan.
- Bare `node --test` in `games/aegis` remains fully green.
- Desktop and phone browser journeys boot successfully and pass layout checks.

## 11. Non-goals

- No new game mechanics.
- No balance changes.
- No new raster art or sprite generation.
- No change to the public `/aegis/` route in this pass.
- No commitment of unrelated tactical-grid, research, raw artwork, or QA-capture changes already present in the working tree.
