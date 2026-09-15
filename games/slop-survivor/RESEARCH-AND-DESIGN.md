# Current rules

See [PROGRESSION.md](PROGRESSION.md) for v1.2 research and implemented rules. The following is the historical v1.0 design record; its original six-chapter/eight-weapon rules and fixed card values have been superseded.

# Research and implementation decisions

Reviewed September 13, 2026. The reference is **Cell Survivor by Snap Brain Games on mobile**, not the unrelated Steam game or older open-source games with the same name.

## Sources

- [Official Google Play listing](https://play.google.com/store/apps/details?id=defense.roguelike.cell.shoot.survivor): virus bosses, weak spots, three randomized skill choices, tower-defense/roguelike framing. It does not publish a complete ruleset or source code.
- [Official App Store listing](https://apps.apple.com/au/app/cell-survivor-idle-tower-rpg/id6746465127): mobile product description; player reviews also discuss starting buffs in Hard/Hell and issues around chest interruptions. Reviews are player reports, not authoritative specifications.
- [Pocket Gamer beginner guide](https://www.pocketgamer.com/cell-survivor/guide/): weapon progression, chest pulls and targeted versus general damage. Used for qualitative structure, not exact economy reproduction.
- [Gamerch community weapon documentation](https://gamerch.com/cell-survivor/960738): weapon-specific unlock choices, including damage, critical, projectile and persistent-effect modifiers. Community information can change between versions.
- [Applizm weapon list](https://applizm.com/cellsurvivor-buki/): weapon/card families such as capsules, beams, control effects and area attacks. Its own notes warn that updates may change values.
- [Player discussion of idle chests](https://www.reddit.com/r/cellsurvivor/comments/1suikv6/where_do_chests_go/): reports periodic free storage. It does not reliably confirm the exact interval and cap.
- [Slippy's project site](https://www.slippy.club/): reference identity is the golden snake with sleepy eyes, broad pink lips and a small brown tuft. The existing Sloppy character sheet supplies the red hero's identity.

I did not find a complete official design document covering all damage formulas, drop probabilities and account systems. The implementation is original; it does not claim those undisclosed systems were reverse-engineered. **One idle chest per 10 minutes and a 32-chest cap are explicit user requirements**, used as our specification where documentation was incomplete.

## Two independent chest systems

1. **Battle chests:** earned from breaking the snake. Pause all simulation, present up to three different eligible cards, choose one. The starting chest offers another equipped weapon. Later chests offer new weapons or upgrades for active weapons. Two free rerolls per run. A 24-second interval without a chosen upgrade supplies a backstop chest.
2. **Idle chests:** accrue from elapsed real time, with integer ten-minute intervals and a hard inventory cap of 32. A full vault stops accumulating. Opening at the cap restarts accumulation without banking overflow. Clock rollback awards no extra chests. The game also awards victory chests.

The random idle loot is **35–65 coins and 2–4 shards per chest**, a new balancing choice. Shards come only from unlocked weapons. No premium currency, purchase prompts or forced ads.

## Original arsenal

| Weapon | Base hit | Cooldown | Initial crit | Crit multiplier | Behavior |
|---|---:|---:|---:|---:|---|
| Mint Condition | 14 | 0.26s | 10% | 2.0× | Coin projectiles; piercing upgrades |
| Liquidator | 34 | 0.90s | 8% | 2.2× | Beam piercing aligned targets |
| Gas Fees | 80 | 2.40s | 12% | 1.8× | Explosive canisters with area damage |
| Diamond Hands | 27 | 1.15s | 18% | 2.3× | Returning blades with fresh return-hit tracking |
| Block Lightning | 29 | 1.80s | 15% | 2.0× | Chained hits on neighboring segments |
| Rug Pull | 21 | 3.20s | 10% | 2.0× | Wide field plus slow |
| Burn Address | 32 | 1.40s | 10% | 1.9× | Initial ignition hit plus persistent burn |
| Whale Drop | 210 | 5.20s | 6% | 2.5× | Telegraph followed by a large orbital impact |

These values are **our own**, not Cell Survivor weapon statistics. Damage listed for area/chain weapons is per affected target. Burn Address uses a fraction of base damage for ignition and separate continuous burn ticks; its initial ignition can crit. Workshop level adds 12% of original base damage, then starting bonuses and battle upgrades apply. Expected raw per-hit damage before armor is `damage × (1 + critChance × (critMultiplier − 1))`; weapon targeting, multiple targets, travel time and effects also matter.

Damage cards multiply current weapon damage by 1.5. Critical chance cards add 0.25, capped at 0.85. Critical multiplier cards add 0.5. Haste cards multiply cooldown by 0.8, with a 0.09-second lower bound. Signature upgrades add pierce, projectiles, radius, chain targets, slow strength or burn duration. Signature upgrades cap at four ranks. The UI describes the actual selected weapon changes.

## Progression and chapter identities

Six Normal clears unlock subsequent chapters. Each chapter independently unlocks Hard after its Normal victory and Hell after its Hard victory. Normal/Hard/Hell offer one/two/three unique starting bonuses. Difficulty changes health, speed and reward scale. Armor reduces ordinary damage but criticals bypass it. Other chapter patterns introduce regeneration, volatile death explosions and mixed traits.

Weapons begin at level 1 and permanently upgrade to level 10. Four initial weapons are immediately available; clearing Normal chapters 1–4 unlocks the other four. The player chooses up to six for the run's chest pool. Later unlocks must be equipped in the Armory. Chapter victory grants coins, idle chests and shards; first clears add a bonus. Defeat pays a smaller reward and preserves permanent progress.

## Scope of this version

Complete offline-capable browser campaign with local saves, not an attempt to reproduce every live-service event, gacha system, hundred-chapter campaign or monetization feature of the reference game. Desktop and mobile share the same simulation. No networked economy or tournament validation. Browser device emulation and deterministic tests are useful checks, but do not replace hands-on play on physical phones.
