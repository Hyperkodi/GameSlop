(function (root) {
  'use strict';
  // Timeline is independent of frame rate and pauses with the rest of the game.
  const SHOTS = [
    { id: 'throw', start: 0, end: 4, label: 'The invitation' },
    { id: 'flight', start: 4, end: 7.5, label: 'A little further' },
    { id: 'sprint', start: 7.5, end: 10.8, label: 'Maximum zoomies' }
  ];
  const DURATION = SHOTS[2].end;
  const clamp = n => Math.max(0, Math.min(1, n));
  const ease = n => { n = clamp(n); return n * n * (3 - 2 * n); };
  function sample(seconds) {
    const t = Math.max(0, Number(seconds) || 0), shot = SHOTS.find(s => t < s.end) || SHOTS[2];
    const local = Math.min(t, DURATION) - shot.start;
    return { id: shot.id, label: shot.label, time: t, local, progress: clamp(local / (shot.end - shot.start)),
      done: t >= DURATION, glance: ease((t - .8) / .85), windup: ease((t - 1.85) / .8),
      release: ease((t - 2.55) / .35), coinReleased: t >= 2.7, star: shot.id === 'flight' && local >= 2.35 };
  }
  function createTimeline() {
    let elapsed = 0, active = false;
    return { get active() { return active; }, get state() { return sample(elapsed); },
      start() { elapsed = 0; active = true; },
      update(dt) { if (active) { elapsed = Math.min(DURATION, elapsed + Math.max(0, Math.min(.05, dt || 0))); if (elapsed >= DURATION) active = false; } return sample(elapsed); },
      skip() { elapsed = DURATION; active = false; } };
  }
  const api = { SHOTS, DURATION, sample, createTimeline };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BitDogCinematic = api;
})(typeof window !== 'undefined' ? window : globalThis);
