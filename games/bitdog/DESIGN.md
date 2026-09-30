# BitDog next-pass design

The agreed direction below is now implemented in the second playable. The following notes retain the initial proposals; current values are recorded at the end.

## Agreed direction

- Music: playful adventure funk, with polished, live-sounding instrumentation.
- Failure: three hearts within one attempt.
- Timer: countdown begins when BitDog grabs the big Bitcoin. The outbound trip remains untimed.
- Audio: use ElevenLabs for high-quality sound effects; replace the prototype music and synthesized collision sound.
- Level 1: extend the route and introduce more obstacles and decisions.

## Proposals still to tune

- A shallow pond slows the dog; jumping across preserves momentum.
- One optional route, such as a tunnel, trades collection opportunities for speed. Alternate paths need not appear in every level.
- Score combines collected coins and time remaining on delivery. Proposed starting values: 100 per coin, 50 per remaining second, and 1,000 for delivery. These weights are not yet agreed or playtested.
- Strong collisions could remove one heart with brief invulnerability; mud and shallow water could affect speed only.
- Return music could introduce stronger percussion while retaining the outward theme.
- Final route length and countdown duration require playtesting together.

## Local audio credentials

GameSlop's shared local ElevenLabs credential belongs in the workspace-root `.env.local` as `ELEVENLABS_API_KEY`. Generation tools should load it locally. Never put the credential in browser code, generated audio metadata, prompts, or published game files.

## Second playable implementation

- Level length 22,000 world units; two ponds, 14 obstacles, one hollow-log / boardwalk branch.
- Three hearts; 1.6-second hit protection; retry after the third hit.
- Countdown starts on Bitcoin pickup, initially tuned to 75 seconds.
- Score: 100 per coin, 50 per whole second remaining, 1,000 on delivery. Three hearts retained awards Perfect Fetch. These are starting balance values.
- Funky Chunk by Kevin MacLeod (CC BY 4.0), plus 19 custom ElevenLabs effects.
- Runtime recordings and public attribution live in `audio/`; prompts and original generated files are preserved there.
