# Paying Developers From the Treasury — questions for the team

*GameSlop · discussion guide · 25 Aug 2026*

The idea: GameSlop holds tokens in a treasury, and developers whose games get played on the platform earn tokens from it — the more play, the more they earn. Before anyone builds it, the team needs to agree on the answers below. Questions marked **[decide first]** block the design; the rest can wait.

## 1. The money
1. **[decide first]** Where do the treasury tokens actually come from? — With a Bankr launch on Robinhood Chain the only team-controlled supply is the 15% vest (12 months, 30-day cliff) plus the creator fee on trading (0.665% of volume). There is no separate treasury line, so the pool is small at first and grows with volume.
2. **[decide first]** How much do we pay out per week — a fixed token amount, or a percentage of the treasury balance? — *Default: 1–2% of balance per week*, and the weekly pool is a fixed budget that games share, so no developer can pull more than the budget.
3. Does the pool shrink over time (halving), stay flat, or grow with revenue? — A published schedule is a promise.
4. Is developer pay a separate pot from player rewards? — Two pots are easier to explain and defend.
5. What happens if the token price collapses and the pool is worth little in dollars? — Nothing / top up from fees / pause. Decide now.

## 2. Measuring "popularity"
6. **[decide first]** What is one unit of "play": a page open, a session over a minimum time, or verified minutes of real input? — *Default: verified play-seconds* (game focused + real inputs; our games already log every input).
7. Do players without a connected wallet count toward a developer's share? — Discount (e.g. 20%), cap, or wallet-only.
8. Is there a daily cap per player per game? — *Default: ~2 hours per wallet per game per day.*
9. Do new games get a boost? — *Default: 2× weight for the first two weeks.*
10. Is there a maximum share one game can take of the pool? — *Default: 35%.*
11. Do we count quality signals (returning players, session length, ratings), or purely time played?

## 3. Cheating and fairness
12. How much fraud are we willing to eat before we'd rather delay payouts? — Paying one week in arrears lets flagged sessions be voided first.
13. Who reviews suspicious activity, and can they void a game's share for a week?
14. Do we require proof-of-personhood or a small stake for play to count (captcha, wallet age, minimum holding)?
15. Will we publish the rules and the weekly shares openly? — *Default: yes.* The public page is the fairness mechanism and free marketing.

## 4. Who gets paid
16. **[decide first]** For a game adapted from open source, who is the "developer": original author, the porter/re-skinner, or both? — A split (e.g. 70/30) can live in each game's manifest.
17. Does a sponsor-branded version of a game earn for the developer, the sponsor, or both? (Armaratris is the live example.)
18. What makes a developer eligible: sign-up, wallet, terms, a quality bar?
19. Can developers submit original games, or do we ship only in-house adaptations at first?
20. What happens to earnings if a game is removed (license, sponsor ends, quality)? — Pay to removal date, or claw back?

## 5. Legal and compliance (bring to a lawyer before the first payout)
21. Are token payments to developers contractor income, and what records/forms does that need?
22. Does "earn tokens from platform growth" wording make the token look like a security in our markets?
23. Which countries will we pay developers in, and is KYC needed above some amount? (The GME stock-token side already excludes U.S. persons; $SLOP payouts have their own constraints.)
24. Do developer terms cover licensing of submissions, takedowns, and revenue-share changes?

## 6. Running it
25. Settlement cadence: weekly, bi-weekly, monthly? — *Default: weekly, paid one week in arrears.*
26. **[decide first]** Who holds the treasury keys and signs payouts? — A 2-of-3 multisig with named people.
27. Manual payouts at first (someone signs a weekly batch) or automated? — *Default: manual for the first months.*
28. What do developers see: live share estimates or only weekly results?
29. Who owns the program day to day, and what's the first success metric? — Suggested: number of games earning above a minimum threshold, week over week.

## 7. Launch scope
30. Do we dry-run with our own adapted games and a fake pool for a month before opening to outside developers?
31. Is the developer program part of the launch story or a phase-two announcement? — If launch, the treasury math must be public on day one.
32. What would make us pause or cancel the program? — Name the exit conditions now.

---
*For the technical folks:* the pieces already exist or are cheap — every game talks to the site through one small script (session start, heartbeat with input evidence, game over), sessions land in one table, a weekly job computes shares. Armaratris is the reference game. Treasury constraints in section 1 come from the Robinhood Chain / Bankr audit of 25 Aug 2026.
