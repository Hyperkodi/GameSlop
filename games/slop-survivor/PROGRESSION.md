# Progression, upgrade odds and Telegram saves — v1.3

## Research and design

Reviewed September 14, 2026. Cell Survivor's [weapon setup guide](https://www.pocketgamer.com/cell-survivor/best-weapon-setup/) describes a starting Capsule, additional weapon selection during a stage, persistent damage areas, late-game percentage-health attacks (Satellite Storm), and executions (Abyssal Maw). Its [progression guide](https://www.pocketgamer.com/cell-survivor/guide/) distinguishes account upgrades from cards collected during a match. The [community weapon wiki](https://gamerch.com/cell-survivor/960738) documents weapon-specific skills.

These sources inform attack roles and the permanent/run progression split. They do **not** establish exact verified chest probabilities. Our Green → Blue → Red → Gold order follows the user's requested hierarchy; it is not a claim that Cell Survivor uses this same ordering or these same rates.

## Fresh chapter, fresh arsenal

- Twelve progressively stronger chapters, each with Normal, Hard and Hell: 36 encounters. Clear Normal to unlock the next chapter and that chapter's Hard; clear Hard for Hell.
- Every new chapter attempt and retry starts with **Mint Condition only**, then offers an opening weapon chest. Collect other weapons during battle, up to six active at once.
- Every account-unlocked weapon is eligible. There is no pre-equipped six-weapon pool to hide new unlocks.
- Collected weapons, chest stat upgrades, signature ranks, legendary evolutions, charge and starting bonuses reset on a fresh attempt.
- Coins, shards, workshop levels, weapon unlocks, chapter clears and best scores remain permanent. Workshop upgrades are applied as baseline power when a new attempt begins.
- Resuming a saved attempt restores its current weapons, exact selected stats, rolled choices, projectiles, timers and snake state; resuming does not restart that level.

## Upgrade distribution

Each ordinary battle-chest option rolls its rarity **first**, independently of how many weapons or upgrade types are eligible. Then a weighted eligible card is selected from that tier. The three options cannot duplicate the same weapon/effect. Rerolls use the same rates; there is no paid probability boost or hidden pity adjustment.

| Tier | Per-option chance | Damage multiplier | Crit chance added | Cooldown reduction | Crit multiplier added |
|---|---:|---:|---:|---:|---:|
| Green · Basic | 60% | +25% | +5 percentage points | 10% | +0.20× |
| Blue · Rare | 28% | +50% | +10 points | 15% | +0.35× |
| Red · Epic | 10% | +100% | +15 points | 20% | +0.50× |
| Gold · Legendary | 2% | +200% | +25 points | 30% | +1.00× |

The chance of at least one Gold among three ordinary options is approximately **5.88%**, not 2%. The opening collection chest intentionally offers three Green weapon unlocks, not a stat-rarity roll. Starting bonuses also use their own selection system. Green weapon unlock cards have weight 2, ordinary eligible effects weight 1, additive base-power cards weight 0.5. Once eligible, legendary evolution cards have weight 5 **within Gold**, without changing the 2% Gold roll.

Signature cards start at Blue and grant 1/2/3 ranks at Blue/Red/Gold, capped at four total ranks. Critical chance caps at 85%; cooldown bottoms at 0.09 seconds. Gold evolution cards require three prior upgrades on their weapon and can be collected only once per run. Gold can also provide a powerful ordinary stat card. Legacy already-rolled cards from v1.0/v1.1 retain their original effects on save migration.

Choosing an upgrade freezes the simulation and renders three cards directly over the unblurred battlefield. The arena is neither cleared nor replaced. Every card names the affected weapon and actual benefit.

## New unlocks

| Clear Normal chapter | Weapon | Distinct behavior | Gold evolution |
|---|---|---|---|
| 5 | Hash Satellite | Orbital area strike plus 1.5% current health, capped at four times base hit damage before crit/mark modifiers | Percentage component becomes 3%, with the same cap |
| 6 | MEV Swarm | Three homing bots independently choose targets and retarget defeated enemies | Double bot count |
| 7 | Ledger Singularity | Repeated area damage for three seconds and a slow on the connected snake | Six-second field |
| 8 | Hard Fork | A bolt splits into two homing fragments on impact | Fragments split a second time |
| 9 | Oracle of Doom | Five-second marks increase incoming arsenal damage by 25% | Marked targets execute below 10% health |
| 10 | Genesis Dragon | Head-seeking dragon, persistent flame trail and burning impact | Second dragon and longer trail |

The original eight weapons also have Gold evolutions: a coin fan, unlimited beam penetration, incendiary blast aftermath, double return damage, more lightning targets, damaging rug fields, a wider burn area and a second whale impact. All 14 weapons have initial critical chance and critical multipliers visible in the Armory. New weapon icons and effects use original canvas artwork matching the existing cartoon style.

## Automatic progress (v1.3)

There are no manual Save, Load, import or export controls. The game saves to local storage every three seconds while in battle and immediately after choices, purchases, results, pauses and leaving the page. **Return to menu** and app switching preserve the current attempt automatically. The menu offers **Resume run** and **Continue tournament** independently. A new campaign level always starts with a fresh battle arsenal while retaining account unlocks and workshop upgrades.

Inside a supported Telegram Mini App, the official SDK exposes per-bot/per-user [CloudStorage](https://core.telegram.org/bots/webapps#cloudstorage). On launch, the game reads cloud progress before enabling play and automatically restores a newer snapshot. Local offline progress with a newer modification timestamp is retained. If the network read fails, local play remains available and syncing retries. Actions made while a network request is pending are never replaced by its delayed response. Settings shows status, not save/load controls.

Cloud writes are serial and coalesced to approximately 15-second intervals. Returning to the menu, hiding the page or Telegram deactivation requests a best-effort immediate sync; the synchronous local save happens first. Network failures retain the local snapshot and retry automatically. Closing an app can interrupt the network request, so another device may receive the last completed cloud snapshot rather than the last few seconds of play.

Snapshots are split into 3,500-character chunks. Unique revision keys, checksums and a pointer committed only after all chunks succeed protect against incomplete writes. The preceding snapshot survives failed writes. Before an automatic restore, a private local recovery snapshot is retained. Timestamps select the newer snapshot; simultaneous play on two devices is not a merged account ledger, and this is not a server-authoritative save system.

No bot token or messages are used. Open the HTTPS build through the same Gameslop bot/Mini App for account sync. A different bot has separate storage. An ordinary external browser link keeps local progress. Real Telegram client testing and bot deployment remain separate from this local implementation.

## Endless tournament

- Available immediately from the Expedition menu. Each attempt starts with Mint Condition, one starting boon, the account's unlocked weapon pool and existing workshop levels.
- Slippy returns in progressively stronger, faster waves without a campaign victory condition. Segment count rises from 25 to a maximum of 64 to keep mobile rendering bounded. Armored, regenerating and volatile segments join from waves 3, 5 and 7.
- Large clears queue at most one upgrade prompt, with six seconds of battle between ordinary tournament choices. The opening chest remains immediate. This prevents dozens of consecutive menus after an entire wave is destroyed.
- In tournaments, damage cards switch to linear gains above 40 times a weapon's original damage and critical multipliers cap at 6×. Previews show the actual increase. Damage-based points count health removed rather than overkill. Campaign upgrade scaling is unchanged.
- Zero shields offers a revive. Each attempt allows exactly **three revives**, each restoring full shields and pushing the existing snake back while preserving score and arsenal. The fourth defeat ends the attempt; a player can also decline a revive and end it sooner.
- Pending revive prompts and the number already used persist through menus, reloads and Telegram sync. Only a genuinely new attempt starts with three revives and zero score.
- Campaign and tournament attempts occupy separate save slots. Tournament results update personal best, attempt count, coins and lifetime statistics without unlocking campaign chapters or replacing a campaign run. Rewards are applied once.
- **Online tournament leaderboard submission is not connected.** The local mode and personal best are playable, but public competitive scoring still needs authenticated server validation and leaderboard integration.

## Verification and limits

Tests cover weighted distributions, fresh-run resets, legacy migration, all 14 attack paths/evolutions, orbital caps, Oracle amplification, homing retargeting, fragment spawning, hazard ticks, frozen state, corrupted saves and partial cloud writes. Campaign simulation exercises all 36 encounters at representative workshop levels. Browser QA verifies an unchanged frozen canvas behind choices, new weapon rendering, narrow/landscape layouts, offline resume, and a two-context Telegram **mock** automatic restore, three-revive persistence, separate run slots and endless-wave survival.

Actual Telegram client/bot behavior still requires device testing in the configured Gameslop Mini App. No real cloud save, public deployment, paid reward system or server-authoritative tournament economy is claimed here.
