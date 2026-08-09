// Follow the Cup's shuffle script — the one copy of it.
//
// The browser imports this by absolute URL to ANIMATE a level; the server
// imports it by relative path to SCORE one. That is the whole reason it lives
// in shared/: two implementations of the same swap script would drift, and the
// failure would be silent — the room would watch one shuffle and be marked
// against another.
//
// A level is a pure function of (seed, level). It deliberately does NOT chain
// off the level before it, so `computeMetric` can check the seventh pick
// without replaying the first six, and a client that drops a frame cannot
// desync the ladder underneath it.
//
// Nothing here is hidden from the player. It cannot be: the ball's whole path
// is on screen for as long as the shuffle lasts, so the answer is derivable by
// anyone watching — that is the game. Putting the ball in `secret` instead
// would hide it from nobody and cost the client the ability to animate it.

import { seededRng, randInt } from './rng.js';

export const CUPS_BASE_CUPS = 3;   // level 1 opens with three cups
export const CUPS_MAX_CUPS = 5;    // and the ramp tops out at five
export const CUPS_MAX_LEVELS = 10;
// Issue #46: the ten levels ramp linearly from a comfortably followable
// 400ms level-1 crossing down to a hard-but-fair 150ms at level 10. The exact
// per-level duration is `Math.round(400 - (level - 1) * 250 / 9)`, giving
// [400, 372, 344, 317, 289, 261, 233, 206, 178, 150]. Endpoints are exact.
export const CUPS_FIRST_SWAP_MS = 400; // level 1
export const CUPS_LAST_SWAP_MS = 150;  // level 10
// NOTE (deliberate deviation from #35): the per-game speed decay is dropped for
// cups. #46 mandates EXACT swap durations for every level, which is
// incompatible with scaling the whole ladder by 0.9^queueIndex. There is no
// speedMultiplier and no CUPS_GAME_SPEED_DECAY here anymore.

// The one source of a level's swap duration, shared by client, server, and
// tests. Levels above 10 clamp to the level-10 value so the formula can never
// go negative; the game only ever asks for 1..10.
export function cupsSwapMs(level) {
  const n = Math.min(Math.max(1, Math.floor(level)), CUPS_MAX_LEVELS);
  return Math.round(CUPS_FIRST_SWAP_MS - (n - 1) * 250 / 9);
}

// Every unordered pair of cup positions. A swap is symmetric, so (a, b) is
// stored with a < b and the client decides which one arcs over the top.
function pairsFor(cups) {
  const out = [];
  for (let a = 0; a < cups; a++) for (let b = a + 1; b < cups; b++) out.push({ a, b });
  return out;
}

export function cupsCount(level, baseCups = CUPS_BASE_CUPS, maxCups = CUPS_MAX_CUPS) {
  // One more cup every four levels: 3 for levels 1–4, 4 for 5–8, 5 from 9 on.
  return Math.min(maxCups, baseCups + Math.floor((Math.max(1, level) - 1) / 4));
}

// The plan for one level: where the ball starts, every swap in order, how long
// one swap takes, and where the ball ends up.
export function cupsLevel(seed, level, { baseCups = CUPS_BASE_CUPS, maxCups = CUPS_MAX_CUPS } = {}) {
  const n = Math.max(1, Math.floor(level));
  const rng = seededRng(`${seed}:lvl${n}`);
  const cups = cupsCount(n, baseCups, maxCups);
  const swapCount = 2 + n;
  const swapMs = cupsSwapMs(n);
  const allPairs = pairsFor(cups);

  const start = randInt(rng, 0, cups - 1);
  const swaps = [];
  let ball = start;
  let prev = null;
  for (let i = 0; i < swapCount; i++) {
    // Draw from every pair EXCEPT the one just played. Two identical swaps back
    // to back put the cups straight back where they were: a stutter the player
    // learns nothing from, and free time off the clock. Filtering rather than
    // re-rolling keeps this a fixed number of rng draws per swap, so the script
    // stays byte-identical everywhere it is derived.
    const choices = prev ? allPairs.filter((p) => !(p.a === prev.a && p.b === prev.b)) : allPairs;
    const swap = choices[randInt(rng, 0, choices.length - 1)];
    swaps.push(swap);
    if (ball === swap.a) ball = swap.b;
    else if (ball === swap.b) ball = swap.a;
    prev = swap;
  }

  return { level: n, cups, start, swaps, swapMs, ball, shuffleMs: swaps.length * swapMs };
}
