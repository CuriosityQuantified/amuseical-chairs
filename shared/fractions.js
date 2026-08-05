// Pure, seeded comparison stream for Fraction Face-Off (issue #14).
//
// The round is a fixed stream of two-choice comparisons: which side is
// bigger? Every pair renders as plain text ("3/7", "40%", "2^5") and the
// numeric values never leave this module's pool — the client renders the
// strings as given and the answers stay in the server's secret half. The
// stream is a pure function of the round seed: the same seed always yields
// the same pairs, so the server's answer list always lines up with what
// every device renders. No Math.random() anywhere — seededRng only.
//
// Difficulty curve: the two sides start far apart (value ratio ~1.9 —
// trivially easy) and converge toward ~1.05 (a genuine 3/7-vs-5/12 eyebrow
// raise), so the stream self-limits even a fast player instead of running
// out of material.
//
// Cheat surface, stated rather than hidden: every value is right there on
// screen in slash/percent/power form, so anyone with a calculator can check
// a pair. The game is a speed test — punching two fractions into a phone
// takes longer than answering, and the wrong-answer penalty makes that
// negative-EV — so the calculator loses to honest play. Keep it numeric-only:
// a word problem would become a reading-speed test and unfair to non-native
// speakers.

import { seededRng, randInt } from './rng.js';

export const FRACTIONS_COUNT = 60;   // more than anyone will finish in a round
export const FRACTIONS_PENALTY = 2;  // per wrong tap — guessing is negative-EV

const RATIO_START = 1.9;
const RATIO_END = 1.05;

// The magnitude pool: fractions, percents, and decimals whose text form is
// unambiguous at phone size (slash form, never stacked glyphs). Sorted by
// value so the ratio search below is a simple scan.
const MAGNITUDE_POOL = (() => {
  const out = [];
  for (let d = 3; d <= 11; d++) {
    for (let n = 1; n < d; n++) out.push({ text: `${n}/${d}`, value: n / d });
  }
  for (let p = 5; p <= 95; p += 5) out.push({ text: `${p}%`, value: p / 100 });
  for (let v = 0.05; v <= 0.95 + 1e-9; v += 0.05) out.push({ text: String(v), value: v });
  const seen = new Set();
  return out
    .filter((e) => (seen.has(e.text) ? false : (seen.add(e.text), true)))
    .sort((a, b) => a.value - b.value);
})();

// Small-integer powers ("2^5", "5^2", …), value 8..1024. Used only for the
// easy opening pairs, where the wide ratio band has room for them.
const POWER_POOL = (() => {
  const out = [];
  for (let b = 2; b <= 12; b++) {
    for (let e = 2; e <= 10; e++) {
      const value = Math.pow(b, e);
      if (value >= 8 && value <= 1024) out.push({ text: `${b}^${e}`, value });
    }
  }
  const seen = new Set();
  return out
    .filter((e) => (seen.has(e.text) ? false : (seen.add(e.text), true)))
    .sort((a, b) => a.value - b.value);
})();

// The two pool entries whose value ratio lands closest to `target`, scanning
// deterministically from a seeded offset. Equal-valued entries are skipped —
// a tie is a broken question. Always terminates: falls back to the closest
// pair overall when nothing lands in the band.
function findPair(pool, offset, target) {
  const n = pool.length;
  let best = null;
  let bestDev = Infinity;
  for (let i = 0; i < n; i++) {
    const j = (offset + i) % n;
    for (let k = j + 1; k < n; k++) {
      const ratio = pool[k].value / pool[j].value;
      if (ratio <= 1.001) continue;              // tie — skip
      if (ratio > target * 1.6) break;           // sorted: further k only grow
      const dev = Math.abs(ratio - target);
      if (dev < bestDev) {
        bestDev = dev;
        best = [pool[j], pool[k]];
      }
      if (ratio >= target * 0.96 && ratio <= target * 1.04) return [pool[j], pool[k]];
    }
  }
  return best || [pool[0], pool[n - 1]];
}

// The full comparison stream: [{ left, right, answer }], where `answer` is
// 'left' | 'right' (the bigger side). Deterministic per seed.
export function fractionsPairs(seed, { count = FRACTIONS_COUNT } = {}) {
  const rng = seededRng(`fractions:${seed}`);
  const pairs = [];
  for (let i = 0; i < count; i++) {
    const progress = count === 1 ? 1 : i / (count - 1);
    const eased = Math.pow(progress, 1.3);
    const target = RATIO_START * Math.pow(RATIO_END / RATIO_START, eased);
    const usePower = progress < 0.25 && rng() < 0.55;
    const src = usePower ? POWER_POOL : MAGNITUDE_POOL;
    const offset = randInt(rng, 0, src.length - 1);
    const [lo, hi] = findPair(src, offset, target);
    const biggerLeft = rng() < 0.5;
    pairs.push({
      left: biggerLeft ? hi.text : lo.text,
      right: biggerLeft ? lo.text : hi.text,
      answer: biggerLeft ? 'left' : 'right',
    });
  }
  return pairs;
}

// Turn a rendered pair back into a number — used by the client to keep its
// own running tally and by the test harness's bot. The values are right
// there on screen anyway; this is the same information a player with a
// calculator has, and the same speed-race keeps it honest.
export function parseValue(text) {
  if (typeof text !== 'string') return NaN;
  if (text.includes('/')) {
    const [n, d] = text.split('/').map(Number);
    return n / d;
  }
  if (text.includes('%')) return Number(text.slice(0, -1)) / 100;
  if (text.includes('^')) {
    const [b, e] = text.split('^').map(Number);
    return Math.pow(b, e);
  }
  return Number(text);
}
