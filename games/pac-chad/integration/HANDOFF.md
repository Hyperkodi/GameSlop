# Pac-Chad: X login and leaderboard handoff

Target: `kobeyaki/game-slop`, branch `feature/x-tournaments-20260907`, inspected at `f7463189ec91d4ad802aab621353c71dda6020f7` on September 7, 2026. No changes have been made to that checkout or its deployments.

## Already implemented here

- `js/platform.mjs` loads `integration/gameslop-sdk.js` only when embedded. The SDK is copied from the branch above, unchanged apart from local text encoding. It sends the existing `game:ready`, `game:start`, optional score tick and `game:complete` protocol with slug `pac-chad`, sequence and the parent-issued run ID. It receives the existing pause/resume/restart callbacks.
- X authentication stays on the host origin. No duplicate login, X credentials, account IDs, leaderboard service tokens or database keys enter the game. The SDK preserves parent-window and host-origin checks; the host must continue enforcing its independent frame checks.
- If registered with the current browser-summary handler, completion can only be provisional. UI messages do not label that result official. Standalone play stores personal results on this device.
- `js/model.mjs` is DOM-free and deterministic, driven by integer simulation ticks and a seeded RNG. `js/replay.mjs` recomputes complete legal runs and rejects unsupported versions, invalid inputs, truncated/oversized evidence, inputs after completion, and incorrect claimed scores.
- `Recorder` packs two four-bit inputs per byte. A complete 18,000-tick run produces 9,000 bytes, or 12,000 characters of base64. The complete JSON evidence envelope fits the current 16 KiB limit. Player identity and run authorization do not come from this envelope.

## Integration still required on the X branch

1. Register `pac-chad` in the source game catalog and content-host publication allowlist, then publish the static game through that repository's existing process. Its canonical content URL must be `/games/pac-chad/`. Reuse the website's X access gate and leaderboard component.
2. Add an immutable scoring ruleset: `pac-chad-score-attack-v1`, metric points, higher-is-better, five-minute score attack, normal difficulty, three lives. Pin the whole deployed build and its relevant assets. Use a new ruleset ID when logic changes. The machine-readable candidate is `ruleset.json`; keep it `ranked: false` until reviewed and wired.
3. Keep existing all-time and tournament best-run rankings. Tournament attempts are unlimited. Supply one authoritative seed for the tournament and lock ability options before it starts. Store seed and selected ability on the run before gameplay. The local adapter uses a numeric server seed if provided and otherwise a fixed practice seed. It does not invent a trusted server seed or assume tournament metadata already exists in the SDK.
4. Extend the current SDK, iframe schema, host bridge and completion endpoint to carry the bounded `evidence` object alongside the existing score/result. The current SDK only accepts display outcome/reason and cannot transmit input evidence; this build deliberately does not smuggle replay bytes into that field.
5. Dispatch to `validateReplay(evidence, {version, seed, ability, score})` using version/seed/ability from the locked server run, never from client configuration. Persist the recomputed score. Leave existing ownership, one-time consumption, retries, build validation, expiration, tournament start/end checks, immutable snapshots and evidence retention in place.
6. Enforce authoritative wall-clock/tournament timing. Local practice can pause and slows down when a browser drops frames; before ranked activation decide whether wall-clock continues or interruptions invalidate a run, and bind that decision to the ruleset. Apply a bounded CPU budget to replay validation. Assess automation separately: valid input replay is not proof of a human player.
7. Test the real X flow and hosted database with honest runs, replay tampering, different builds/seeds/abilities, late completion, session expiry, duplicates/concurrency, and actual touch devices. Only reviewed server-validated runs should qualify for official rankings. Existing browser-summary records remain provisional.

The future Telegram bot should keep using the existing read-only leaderboard API. It needs no Pac-Chad-specific identity, scoring, or ranking implementation.

## Validation limits

The browser test includes a mock parent using the current SDK protocol. That verifies the game's ready/start/complete integration and run-ID binding. It does not claim live X OAuth, database persistence or official score acceptance. No external leaderboard writes occurred during local testing.
