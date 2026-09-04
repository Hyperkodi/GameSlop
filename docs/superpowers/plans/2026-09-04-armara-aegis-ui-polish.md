# Armara Aegis UI Polish Implementation Plan

Date: 2026-09-04

## Phase 1: Lock the presentation contract

1. Add a browser journey that exercises actual player controls and measures overflow, target sizes, accessible labels, battlefield fit, tower-store readability, and balanced protocol rows.
2. Verify the scoped staged version separately from the existing user-owned edits.

## Phase 2: Add the additive polish layer

1. Create `games/aegis/css/aegis-polish.css` as a final cascade layer.
2. Add the stylesheet after the existing inline preview styles so it can refine the UI without rewriting the underlying delivery shell.
3. Establish shared spacing, radii, shadows, surface, type, and interaction tokens.

## Phase 3: Polish each player surface

1. Refine global chrome, title, navigation, and notices.
2. Refine campaign chapters and mission states.
3. Refine loadout summaries, difficulty choices, equipment cards, and the sticky primary action.
4. Refine briefing, settings, and result hierarchy.
5. Refine the battle command deck, battlefield frame, foundations, tower effects, and tower store.
6. Hide the tactical authoring grid while preserving all projection logic.

## Phase 4: Responsive and access modes

1. Tune wide desktop, tablet, phone, landscape phone, and short viewport layouts.
2. Verify focus, forced-colors, Reduced Motion, photosensitive-safe mode, overflow, and safe areas.

## Phase 5: Verification and delivery

1. Run the browser journey at desktop, tablet, phone, and landscape sizes.
2. Run bare `node --test` from `games/aegis`.
3. Run the legacy game and shared-kit suites if shared files changed. They should not change in this pass.
4. Inspect screenshots and check tower management with the existing interaction driver.
5. Stage only the new polish files, stylesheet link, and isolated accessibility, protocol-state, road-tile, and store-scroll fixes. Leave unrelated pre-existing edits unstaged.
6. Commit as Ryan with the required Claude co-author trailer.
