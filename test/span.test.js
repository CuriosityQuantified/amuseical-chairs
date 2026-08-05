// Digit Span (issue #15): a seeded stream of increasing digit strings, flashed
// one digit at a time with no replay. The selected cheat mitigation is reverse
// span: after every flash the player types the string backwards. The client
// receives the strings only because it must display them; it never receives the
// seed, which could otherwise reveal every upcoming string.

import test from 'node:test';
import assert from 'node:assert/strict';
import { seededRng } from '../shared/rng.js';
import {
  SPAN_START_LEN,
  SPAN_MAX_LEN,
  SPAN_PER_DIGIT_MS,
  SPAN_GAP_MS,
  digitsOnly,
  spanStrings,
} from '../shared/span.js';
import {
  ROSTER_BY_KEY,
  buildGameData,
  computeMetric,
  formatRaw,
} from '../server/games.js';

const CONFIG = { gameDuration: 45000 };
const round = (seed = 'span-seed') =>
  buildGameData('span', { rng: seededRng(seed), config: CONFIG, used: {} });

const reversed = (strings) => strings.map((s) => [...s].reverse().join(''));

test('roster entry: memory category, score type, per-player scoring', () => {
  const g = ROSTER_BY_KEY.get('span');
  assert.ok(g, 'span is on the roster');
  assert.equal(g.category, 'memory');
  assert.equal(g.type, 'score');
  assert.equal(g.name, 'Reverse Digit Span');
  assert.equal(g.stages, undefined, 'single-stage game');
});

test('seeded strings are deterministic and increase one digit at a time', () => {
  assert.deepEqual(spanStrings('same'), spanStrings('same'));
  assert.notDeepEqual(spanStrings('one'), spanStrings('two'));
  const strings = spanStrings('shape');
  assert.equal(strings.length, SPAN_MAX_LEN - SPAN_START_LEN + 1);
  strings.forEach((value, index) => {
    assert.match(value, /^\d+$/, 'digits only');
    assert.equal(value.length, SPAN_START_LEN + index);
  });
});

test('buildGameData is deterministic, flashes individually, and does not leak its seed', () => {
  assert.deepEqual(round('same'), round('same'));
  const { clientData, secret } = round('shape');
  assert.equal(clientData.startLen, SPAN_START_LEN);
  assert.equal(clientData.maxLen, SPAN_MAX_LEN);
  assert.equal(clientData.perDigitMs, SPAN_PER_DIGIT_MS);
  assert.equal(clientData.gapMs, SPAN_GAP_MS);
  assert.equal(clientData.reverse, true, 'selected reverse-span mitigation is explicit');
  assert.equal(clientData.seed, undefined, 'a derivable seed is never sent to the client');
  assert.deepEqual(clientData.strings, secret.strings, 'the client can flash exactly what the server scores');
  assert.ok(clientData.strings.every((value, i) => value.length === SPAN_START_LEN + i));
});

test('computeMetric walks upward, requires reversed strings, and stops at first miss', () => {
  const { secret } = round('metric');
  const answers = reversed(secret.strings);
  assert.equal(computeMetric('span', { answers }, secret, {}, CONFIG), SPAN_MAX_LEN);
  const miss = answers.slice();
  miss[2] = '00000';
  assert.equal(computeMetric('span', { answers: miss }, secret, {}, CONFIG), SPAN_START_LEN + 1);
  assert.equal(computeMetric('span', { answers: ['not digits'] }, secret, {}, CONFIG), 0);
});

test('comparison accepts separator noise but not the forward string', () => {
  const secret = { strings: ['123', '4567'] };
  assert.equal(computeMetric('span', { answers: ['3-2 1', '7 6-5 4'] }, secret, {}, CONFIG), 4);
  assert.equal(computeMetric('span', { answers: ['123', '7654'] }, secret, {}, CONFIG), 0);
  assert.equal(digitsOnly('3-2 1'), '321');
  assert.equal(digitsOnly(['321']), null);
});

test('empty answers are a real zero; missing and hostile payloads never crash', () => {
  const secret = { strings: ['123'] };
  assert.equal(computeMetric('span', { answers: [] }, secret, {}, CONFIG), 0);
  for (const payload of [null, undefined, 'string', 7, {}, { answers: '321' }, { answers: [null] }]) {
    const metric = computeMetric('span', payload, secret, {}, CONFIG);
    assert.ok(metric === null || Number.isFinite(metric), `returned ${metric} for ${JSON.stringify(payload)}`);
  }
  assert.equal(computeMetric('span', null, secret, {}, CONFIG), null);
  assert.equal(computeMetric('span', {}, secret, {}, CONFIG), null);
});

test('formatRaw names the longest reversed span recalled', () => {
  assert.equal(formatRaw('span', null, {}), 'no submission');
  assert.equal(formatRaw('span', 7, {}), '7 digits');
});
