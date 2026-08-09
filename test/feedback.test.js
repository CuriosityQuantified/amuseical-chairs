// Unit coverage for the per-turn answer feedback derivations (issue #48).
// Every applicable game's your/correct/ok formatting is checked against right,
// wrong, blank/skip, boundary, and hostile inputs. These are advisory-UI pure
// functions, so they must never throw and must never fabricate a correct
// answer they do not have.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bisectFeedback,
  areaFeedback,
  dotsFeedback,
  stopclockFeedback,
  gridflashFeedback,
  fractionsFeedback,
  anagramFeedback,
  BISECT_TOL,
  AREA_TOL,
  DOTS_TOL,
  STOPCLOCK_TOL,
} from '../shared/feedback.js';

test('bisect: exact and near-target read as correct, far as incorrect', () => {
  const exact = bisectFeedback(30, 30);
  assert.deepEqual({ your: exact.your, correct: exact.correct, ok: exact.ok, answered: exact.answered },
    { your: '30%', correct: '30%', ok: true, answered: true });
  assert.equal(bisectFeedback(30, 30 + BISECT_TOL).ok, true);
  assert.equal(bisectFeedback(30, 30 + BISECT_TOL + 1).ok, false);
});

test('bisect: blank turn keeps the correct answer, marks no-answer', () => {
  const fb = bisectFeedback(42, null);
  assert.deepEqual(fb, { your: '—', correct: '42%', ok: false, answered: false });
});

test('bisect: hostile out-of-range guess is clamped, never throws', () => {
  assert.doesNotThrow(() => bisectFeedback(0, 1e9));
  assert.equal(bisectFeedback(0, 1e9).your, '100%');
  assert.equal(bisectFeedback(0, -50).your, '0%');
  // Non-numeric guess is a blank, not a crash.
  assert.equal(bisectFeedback(50, 'nope').answered, false);
});

test('area: correct answer derived from rendered shapes, matches server ratio', () => {
  // areaRatio = (smallSize/bigSize)^2 * 100 → (60/120)^2*100 = 25.
  const trial = { shape: 'circle', bigSize: 120, smallSize: 60 };
  const fb = areaFeedback(trial, 25);
  assert.equal(fb.correct, '25%');
  assert.equal(fb.your, '25%');
  assert.equal(fb.ok, true);
  assert.equal(areaFeedback(trial, 25 + AREA_TOL + 1).ok, false);
});

test('area: degenerate/hostile trial yields unknown correct, blank guess safe', () => {
  assert.equal(areaFeedback(null, 50).correct, '—');
  assert.equal(areaFeedback({ bigSize: 0, smallSize: 0 }, 50).correct, '—');
  assert.equal(areaFeedback({ bigSize: 120, smallSize: 60 }, undefined).answered, false);
});

test('dots: relative-tolerance correctness, blank and zero-count safe', () => {
  assert.equal(dotsFeedback(100, 100).ok, true);
  assert.equal(dotsFeedback(100, 100 + 100 * DOTS_TOL).ok, true);
  assert.equal(dotsFeedback(100, 200).ok, false);
  assert.equal(dotsFeedback(100, null).answered, false);
  assert.equal(dotsFeedback(100, null).correct, '100');
  // A zero or non-finite true count never divides by zero.
  assert.doesNotThrow(() => dotsFeedback(0, 5));
  assert.equal(dotsFeedback(0, 5).ok, false);
  assert.equal(dotsFeedback('bad', 5).correct, '—');
});

test('stopclock: elapsed vs target formatting and tolerance', () => {
  const fb = stopclockFeedback(8000, 8000);
  assert.equal(fb.correct, '8.000s');
  assert.equal(fb.your, '8.000s');
  assert.equal(fb.ok, true);
  assert.equal(stopclockFeedback(8000, 8000 + STOPCLOCK_TOL).ok, true);
  assert.equal(stopclockFeedback(8000, 8000 + STOPCLOCK_TOL + 1).ok, false);
  assert.equal(stopclockFeedback(8000, null).answered, false);
});

test('gridflash: exact set correct, missed/extra cells incorrect', () => {
  const pattern = [1, 2, 3];
  const perfect = gridflashFeedback(pattern, [3, 2, 1]);
  assert.equal(perfect.ok, true);
  assert.equal(perfect.correct, '3 cells lit');
  assert.equal(perfect.your, '3/3 correct');
  // One missed.
  assert.equal(gridflashFeedback(pattern, [1, 2]).ok, false);
  // One extra.
  const extra = gridflashFeedback(pattern, [1, 2, 3, 9]);
  assert.equal(extra.ok, false);
  assert.match(extra.your, /1 extra/);
  // Blank pick.
  assert.equal(gridflashFeedback(pattern, []).answered, false);
});

test('gridflash: hostile out-of-range indices are dropped, never throw', () => {
  assert.doesNotThrow(() => gridflashFeedback([1, 2], [999, -1, 'x', 1.5, 2]));
  const fb = gridflashFeedback([1, 2], [999, -1, 'x', 1.5, 2]);
  // Only the valid in-grid index 2 survives; index 1 missed → incorrect.
  assert.equal(fb.ok, false);
});

test('fractions: bigger side is the correct answer, tie goes right', () => {
  const pair = { left: '3/4', right: '1/2' };
  assert.equal(fractionsFeedback(pair, 'left').ok, true);
  assert.equal(fractionsFeedback(pair, 'left').correct, '3/4');
  assert.equal(fractionsFeedback(pair, 'right').ok, false);
  // Missing/hostile side → blank.
  assert.equal(fractionsFeedback(pair, undefined).answered, false);
  assert.equal(fractionsFeedback(pair, 'up').answered, false);
  // Tie resolves to right (matches the client's strict-> comparison).
  const tie = { left: '1/2', right: '2/4' };
  assert.equal(fractionsFeedback(tie, 'right').ok, true);
});

test('anagram: correct word supplied by server, case-insensitive match', () => {
  assert.equal(anagramFeedback('bread', 'BREAD').ok, true);
  assert.equal(anagramFeedback('bread', ' bread ').ok, true);
  assert.equal(anagramFeedback('bread', 'beard').ok, false);
  assert.equal(anagramFeedback('bread', 'BREAD').correct, 'BREAD');
});

test('anagram: skip/blank shows correct word but no answer, unknown answer is not fabricated', () => {
  const skipped = anagramFeedback('bread', '');
  assert.deepEqual(skipped, { your: '(skipped)', correct: 'BREAD', ok: false, answered: false });
  // Reveal unavailable (null answer): correct shown as unknown, never guessed.
  const noReveal = anagramFeedback(null, 'bread');
  assert.equal(noReveal.correct, '—');
  assert.equal(noReveal.ok, false);
  assert.equal(noReveal.answered, true);
});
