// The roster contract, checked at runtime for every game at once.
//
// Adding a game means adding a case to three switch statements in
// server/games.js, and every one of them fails quietly when you miss it:
// buildGameData throws only when that game is drawn, computeMetric's `default`
// returns null so every submission silently reads as a non-submission, and
// formatRaw's `default` prints a bare float on the reveal screen. scripts/
// check.mjs covers the roster ↔ client ↔ tutorial half statically; this covers
// the server half by actually calling it.
//
// PAYLOADS below is the part that fails when a game is added: it must name
// every roster key, so a new game cannot be merged without deciding what a
// plausible submission to it looks like.

import test from 'node:test';
import assert from 'node:assert/strict';
import { seededRng } from '../shared/rng.js';
import { cupsLevel } from '../shared/cups.js';
import { trayLevel } from '../shared/tray.js';
import { parseValue } from '../shared/fractions.js';
import { solveScramble } from '../shared/anagram.js';
import { solveGrid } from '../shared/wordhunt.js';
import { areaRatio } from '../shared/area.js';
import {
  ROSTER,
  ROSTER_BY_KEY,
  MULTI_STAGE,
  NEEDS_AGGREGATION,
  buildGameData,
  computeMetric,
  formatRaw,
} from '../server/games.js';

// One plausible submission per game, built from that game's own round data.
// `null` marks a game whose score is not a function of one submission — those
// are scored across the room by aggregateGame instead, and computeMetric is
// expected to decline them.
const PAYLOADS = {
  rgb: () => ({ r: 100, g: 120, b: 130 }),
  oddoneout: () => ({ cleared: 7 }),
  bisect: (cd) => ({ guesses: cd.targets.map((t) => t + 3) }),
  area: (cd) => ({ guesses: cd.trials.map(areaRatio) }),
  trace: () => ({ deviation: 0.05, coverage: 0.95 }),
  dots: (cd) => ({ guesses: cd.counts.map((c) => c + 5) }),
  stopclock: () => ({ best: 240 }),
  metronome: (cd) => ({
    offsets: [...Array(cd.silentBeats)].map((_, i) => cd.intervalMs * (i + 1) + 20),
  }),
  gridflash: (cd) => ({ picks: cd.patterns.map((p) => p.slice(0, 3)) }),
  tray: (cd) => ({ picks: trayLevel(cd.seed).changed }),
  cups: (cd) => ({
    picks: [1, 2, 3].map((level) => ({ level, cupIndex: cupsLevel(cd.seed, level, cd).ball })),
  }),
  typing: (cd) => ({ typed: cd.sentence.slice(0, 24), elapsedMs: 20000 }),
  anagram: (cd) => ({ solved: cd.scrambles.map((scramble, index) => ({ index, word: solveScramble(scramble) })) }),
  wordhunt: (cd) => ({ words: solveGrid(cd.grid) }),
  stroop: (cd) => ({ picks: cd.items.map((it, index) => ({ index, color: it.ink })) }),
  spacemash: () => ({ count: 55, flagged: false }),
  slingshot: () => ({ best: 12.5 }),
  balance: () => ({ survivedMs: 12000 }),
  fractions: (cd) => ({
    picks: cd.pairs.map((p) => (parseValue(p.left) > parseValue(p.right) ? 'left' : 'right')),
  }),
  flags: (cd) => ({ choices: cd.rounds.map((round) => round.options.indexOf(round.options[0])) }),
  readroom: null,
  caption: null,
  icebreaker: null,
};

const CONFIG = { gameDuration: 45000, slingshotDistance: 60 };

const roundData = (key) =>
  buildGameData(key, { rng: seededRng(`roster:${key}`), config: CONFIG, used: {} });

test('every roster game has a canonical payload in this file, and vice versa', () => {
  assert.deepEqual(
    Object.keys(PAYLOADS).sort(),
    ROSTER.map((g) => g.key).sort(),
    'a new game needs a plausible payload here — that is what makes the rest of this file cover it');
});

test('the roster is a set: no duplicate keys, and the index agrees with it', () => {
  const keys = ROSTER.map((g) => g.key);
  assert.equal(new Set(keys).size, keys.length, 'duplicate roster key');
  assert.equal(ROSTER_BY_KEY.size, ROSTER.length);
  for (const g of ROSTER) assert.equal(ROSTER_BY_KEY.get(g.key), g);
});

test('every game declares a normalization direction the scorer understands', () => {
  // room.js picks normalizeError vs normalizeScore off this exact string. A
  // typo does not throw — it silently scores the game backwards.
  for (const g of ROSTER) {
    assert.ok(['error', 'score'].includes(g.type), `${g.key}: type "${g.type}"`);
    assert.ok(g.category && typeof g.category === 'string', `${g.key} has a category`);
    assert.ok(g.name && typeof g.name === 'string', `${g.key} has a display name`);
  }
});

test('every game builds round data without throwing', () => {
  for (const g of ROSTER) {
    const { clientData, secret } = roundData(g.key);
    assert.equal(typeof clientData, 'object', `${g.key} broadcasts round data`);
    assert.ok(clientData, `${g.key} broadcasts round data`);
    assert.equal(typeof secret, 'object', `${g.key} has a secret half, even if empty`);
    assert.ok(secret, `${g.key} has a secret half, even if empty`);
  }
});

test('every per-player game scores a plausible submission to a real number', () => {
  for (const g of ROSTER) {
    const make = PAYLOADS[g.key];
    const { clientData, secret } = roundData(g.key);
    const metric = make
      ? computeMetric(g.key, make(clientData), secret, clientData, CONFIG)
      : null;
    if (make) {
      assert.ok(Number.isFinite(metric),
        `${g.key}: a plausible submission scored ${metric} — a missing computeMetric case reads as a non-submission`);
    } else {
      assert.ok(NEEDS_AGGREGATION.has(g.key),
        `${g.key} has no per-submission payload, so it must be scored by aggregateGame`);
      assert.equal(computeMetric(g.key, { text: 'anything' }, secret, clientData, CONFIG), null,
        `${g.key} is scored across the room, so computeMetric must decline it`);
    }
  }
});

test('no game crashes or scores on a hostile payload', () => {
  const hostile = [null, undefined, 'string', 7, [], {}, { offsets: 1, guesses: 1, picks: 1 }];
  for (const g of ROSTER) {
    const { clientData, secret } = roundData(g.key);
    for (const payload of hostile) {
      const metric = computeMetric(g.key, payload, secret, clientData, CONFIG);
      assert.ok(metric === null || Number.isFinite(metric),
        `${g.key} returned ${metric} for ${JSON.stringify(payload) ?? String(payload)}`);
    }
  }
});

test('every game formats its own raw result — nothing falls through to a bare number', () => {
  for (const g of ROSTER) {
    assert.equal(formatRaw(g.key, null), 'no submission', `${g.key} names a non-submission`);
    const shown = formatRaw(g.key, 3);
    assert.equal(typeof shown, 'string');
    assert.notEqual(shown, '3',
      `${g.key} has no formatRaw case — the reveal screen would show a bare number`);
  }
});

test('multi-stage games are the ones that need aggregation, and they declare it', () => {
  for (const key of MULTI_STAGE) {
    const meta = ROSTER_BY_KEY.get(key);
    assert.ok(meta, `MULTI_STAGE lists ${key}, which is not on the roster`);
    assert.ok(meta.stages === 'variable' || meta.stages >= 2, `${key} declares its stage count`);
    assert.ok(NEEDS_AGGREGATION.has(key), `${key} is scored across its stages`);
  }
  for (const g of ROSTER) {
    const declared = g.stages === 'variable' || (typeof g.stages === 'number' && g.stages >= 2);
    assert.equal(declared, MULTI_STAGE.has(g.key),
      `${g.key}: roster stage count and MULTI_STAGE disagree`);
  }
});

test('regression: span (Reverse Digit Span) has been removed and must not reappear', () => {
  assert.ok(
    !ROSTER_BY_KEY.has('span'),
    'span is on the roster — it was removed in issue #34 and must not be re-added without deliberate review',
  );
  assert.ok(
    !('span' in PAYLOADS),
    'span has a payload entry — remove it along with the roster entry',
  );
});
