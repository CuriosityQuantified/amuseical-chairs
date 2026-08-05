// Fraction Face-Off (issue #14): a seeded stream of two-choice comparisons
// ("which is bigger?") rendered as plain text — fractions, percents,
// decimals, and small powers only, in slash form so phone-size rendering is
// unambiguous. The server's secret is the per-pair answer list; the client
// renders the strings and never sees the values. This file pins the stream's
// determinism, the difficulty curve (ratios start far apart and converge so
// the stream self-limits), the scorer's penalty arithmetic, and the tuning:
// a perfect player's net equals their correct count, a pure guesser lands at
// zero rather than half, and the answers always agree with the rendered text
// (the parse-compare a calculator-wielding player has).

import test from 'node:test';
import assert from 'node:assert/strict';
import { seededRng } from '../shared/rng.js';
import { FRACTIONS_PENALTY, fractionsPairs, parseValue } from '../shared/fractions.js';
import {
  ROSTER_BY_KEY,
  buildGameData,
  computeMetric,
  formatRaw,
} from '../server/games.js';

const CONFIG = { gameDuration: 45000 };

const round = (seed = 'fractions-seed') =>
  buildGameData('fractions', { rng: seededRng(seed), config: CONFIG, used: {} });

const score = (picks, answers, cfg = CONFIG) =>
  computeMetric('fractions', { picks }, { answers }, {}, cfg);

test('roster entry: numerical category, score type, per-player scoring', () => {
  const g = ROSTER_BY_KEY.get('fractions');
  assert.ok(g, 'fractions is on the roster');
  assert.equal(g.category, 'numerical');
  assert.equal(g.type, 'score');
  assert.equal(g.name, 'Fraction Face-Off');
  assert.equal(g.stages, undefined, 'single-stage game');
});

test('buildGameData is deterministic and never leaks the values', () => {
  assert.deepEqual(round('fx-1'), round('fx-1'));
  const { clientData, secret } = round();
  assert.equal(clientData.pairs.length, 60, 'a full stream, more than anyone will finish');
  assert.equal(secret.answers.length, 60);
  for (const pair of clientData.pairs) {
    assert.deepEqual(Object.keys(pair).sort(), ['left', 'right'], 'only rendered text leaves the server');
  }
  for (const a of secret.answers) assert.ok(a === 'left' || a === 'right');
});

test('the answers always agree with the rendered text (no ties, no lies)', () => {
  for (const seed of ['fx-a', 'fx-b', 'fx-c']) {
    for (const pair of fractionsPairs(seed)) {
      const l = parseValue(pair.left);
      const r = parseValue(pair.right);
      assert.notEqual(l, r, `${pair.left} vs ${pair.right} is a tie`);
      if (pair.answer === 'left') assert.ok(l > r, `${pair.left} should beat ${pair.right}`);
      else assert.ok(r > l, `${pair.right} should beat ${pair.left}`);
    }
  }
});

test('difficulty curve: ratios start far apart and converge', () => {
  const pairs = fractionsPairs('fx-curve');
  const ratio = (p) =>
    Math.max(parseValue(p.left), parseValue(p.right)) /
    Math.min(parseValue(p.left), parseValue(p.right));
  const first = ratio(pairs[0]);
  const last = ratio(pairs[pairs.length - 1]);
  assert.ok(first > 1.5, `opening pair is trivially easy (${first.toFixed(2)})`);
  assert.ok(last < first, `closing pair is tighter (${last.toFixed(2)} vs ${first.toFixed(2)})`);
  assert.ok(last < 1.15, `the stream genuinely converges (${last.toFixed(2)})`);
});

test('the server\'s secret answers always agree with what the client renders', () => {
  // The seed deliberately never travels to the client (deriving the answers
  // from it would be a cheat surface worse than the calculator), so the
  // contract to pin is: whatever text the client renders, the server's
  // answer list matches it, positionally, with no ties.
  const { clientData, secret } = round('fx-agree');
  clientData.pairs.forEach((p, i) => {
    const l = parseValue(p.left);
    const r = parseValue(p.right);
    assert.notEqual(l, r, `${p.left} vs ${p.right} is a tie`);
    if (secret.answers[i] === 'left') assert.ok(l > r, `${p.left} should beat ${p.right}`);
    else assert.ok(r > l, `${p.right} should beat ${p.left}`);
  });
});

test('computeMetric: net = correct − penalty × wrong, clamped at zero', () => {
  const { secret } = round('fx-metric');
  const n = secret.answers.length;
  // Perfect play: every answer right → net equals the count.
  assert.equal(score(secret.answers, secret.answers), n);
  // One wrong answer costs exactly FRACTIONS_PENALTY.
  const picks = secret.answers.slice();
  picks[0] = picks[0] === 'left' ? 'right' : 'left';
  assert.equal(score(picks, secret.answers), n - 1 - FRACTIONS_PENALTY);
  // A pure guesser alternates blindly: ~half right, half wrong → 0, not half.
  const guesser = [...Array(n)].map((_, i) => (i % 2 ? 'left' : 'right'));
  assert.equal(score(guesser, secret.answers), 0);
  // Skipped entries (anything that is not left/right) are not counted wrong.
  const withSkips = secret.answers.slice();
  withSkips[0] = null;
  withSkips[1] = 'UP';
  assert.equal(score(withSkips, secret.answers), n - 2);
});

test('computeMetric: over-long picks are ignored past the stream end', () => {
  const { secret } = round('fx-long');
  const picks = [...secret.answers, 'left', 'right', 'left'];
  assert.equal(score(picks, secret.answers), secret.answers.length, 'extra picks add nothing');
});

test('computeMetric: hostile payloads never crash and missing picks = no submission', () => {
  for (const payload of [null, undefined, 'string', 7, {}, { picks: 'x' }, { picks: [1, 2] }, { picks: ['left', 'LEFT', null, 5] }]) {
    const m = computeMetric('fractions', payload, { answers: [] }, {}, CONFIG);
    assert.ok(m === null || Number.isFinite(m), `returned ${m} for ${JSON.stringify(payload)}`);
  }
  assert.equal(computeMetric('fractions', null, { answers: [] }, {}, CONFIG), null);
  assert.equal(computeMetric('fractions', {}, { answers: [] }, {}, CONFIG), null);
  assert.equal(computeMetric('fractions', { picks: [] }, { answers: ['left'] }, {}, CONFIG), 0, 'answered nothing → a real worst score');
  assert.equal(computeMetric('fractions', { picks: ['left'] }, { answers: [] }, {}, CONFIG), 0, 'no answers → nothing counts');
});

test('a ~70% bot nets positive, mirroring the harness player', () => {
  const { secret } = round('fx-bot-b');
  const rng = seededRng('fx-bot-b');
  let correct = 0;
  const picks = secret.answers.map((a) => {
    const pick = rng() < 0.7 ? a : (a === 'left' ? 'right' : 'left');
    if (pick === a) correct++;
    return pick;
  });
  const m = score(picks, secret.answers);
  assert.equal(m, Math.max(0, correct - FRACTIONS_PENALTY * (picks.length - correct)));
  assert.ok(m > 0, 'a solid player nets positive');
});

test('formatRaw: net with the player\'s own tally for the display line', () => {
  assert.equal(formatRaw('fractions', null, {}), 'no submission');
  assert.equal(formatRaw('fractions', 22, { correct: 26, wrong: 2 }), '22 net (26✓ 2✗)');
  assert.equal(formatRaw('fractions', 0, {}), '0 net (0✓ 0✗)', 'missing tally falls back to zeros');
});
