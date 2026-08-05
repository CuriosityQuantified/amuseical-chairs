// Vanishing Tray (issue #11): twelve glyphs sit on a tray for five seconds;
// a seeded 2–4 of them are swapped for new ones, and you tap the slots that
// changed. The metric is a symmetric difference — changed slots missed plus
// unchanged slots wrongly flagged — so flagging everything (12 - nSwaps
// errors) is worse than a real attempt, and blanket-tapping is never a
// winning strategy.
//
// The round is a pure function of the seed: shared/tray.js derives items,
// changed slots, and replacements from one seed string, the client re-derives
// the swapped tray locally, and the server re-derives the same truth to score.
// This file pins that single source of truth and every scoring edge the issue
// calls out.

import test from 'node:test';
import assert from 'node:assert/strict';
import { seededRng } from '../shared/rng.js';
import {
  TRAY_GLYPHS,
  TRAY_SLOTS,
  trayLevel,
  traySwapped,
} from '../shared/tray.js';
import {
  ROSTER_BY_KEY,
  buildGameData,
  computeMetric,
  formatRaw,
} from '../server/games.js';

const round = (seed = 'tray-seed') =>
  buildGameData('tray', { rng: seededRng(seed), config: {}, used: {} });

const score = (picks, secret) => computeMetric('tray', { picks }, secret, {}, {});

test('roster entry: memory category, error type, per-player scoring', () => {
  const g = ROSTER_BY_KEY.get('tray');
  assert.ok(g, 'tray is on the roster');
  assert.equal(g.category, 'memory');
  assert.equal(g.type, 'error');
  assert.equal(g.name, 'Vanishing Tray');
});

test('buildGameData is deterministic: same seed, identical round', () => {
  assert.deepEqual(round('tray-seed'), round('tray-seed'));
});

test('round shape: 12 unique glyphs, 2–4 changed slots, fresh replacements', () => {
  const { clientData, secret } = round();
  assert.equal(clientData.items.length, TRAY_SLOTS);
  assert.equal(clientData.showMs, 5000);
  assert.equal(typeof clientData.seed, 'string');
  assert.ok(clientData.seed.startsWith('tray-'));
  assert.equal(new Set(clientData.items).size, TRAY_SLOTS, 'no duplicate glyphs on the tray');
  assert.ok(secret.changed.length >= 2 && secret.changed.length <= 4,
    `2–4 slots change, got ${secret.changed.length}`);
  assert.equal(secret.replacements.length, secret.changed.length);
  assert.ok(secret.changed.every((c) => Number.isInteger(c) && c >= 0 && c < TRAY_SLOTS),
    'changed slots are valid indices');
  assert.equal(new Set(secret.changed).size, secret.changed.length, 'changed slots unique');
  // A replacement is a glyph the memorize phase never showed — otherwise the
  // swap could be invisible.
  const shown = new Set(clientData.items);
  assert.ok(secret.replacements.every((r) => !shown.has(r)),
    'replacements come from outside the shown tray');
});

test('the glyph pool is large and free of the excluded families', () => {
  assert.ok(TRAY_GLYPHS.length >= 60, `pool is large (${TRAY_GLYPHS.length} glyphs)`);
  assert.equal(new Set(TRAY_GLYPHS).size, TRAY_GLYPHS.length, 'no duplicates in the pool');
  // Near-identical pairs and skin-tone / variation-selector families must not
  // be in the pool, or the game becomes a rendering lottery across platforms.
  const excluded = ['🙂', '🙃', '🍊', '🍋', '👍', '👎', '❤', '🧡', '💛', '💚', '💙', '💜'];
  for (const e of excluded) assert.ok(!TRAY_GLYPHS.includes(e), `${e} must not be in the pool`);
});

test('traySwapped applies replacements exactly at the changed slots', () => {
  const { clientData, secret } = round();
  const swapped = traySwapped(clientData.items, secret.changed, secret.replacements);
  secret.changed.forEach((c, i) => {
    assert.equal(swapped[c], secret.replacements[i], `slot ${c} got its replacement`);
  });
  for (let i = 0; i < TRAY_SLOTS; i++) {
    if (!secret.changed.includes(i)) {
      assert.equal(swapped[i], clientData.items[i], `slot ${i} keeps its glyph`);
    }
  }
});

test('perfect recall scores 0 — and a partial attempt is close behind', () => {
  for (let s = 0; s < 20; s++) {
    const { secret } = round(`tray-partial-${s}`);
    assert.equal(score(secret.changed, secret), 0, `seed ${s}: all changed flagged`);
    const partial = secret.changed.slice(0, secret.changed.length - 1);
    assert.equal(score(partial, secret), 1, `seed ${s}: one missed swap = 1 error`);
  }
});

test('symmetric difference: misses and wrong flags both count', () => {
  const { secret } = round();
  const miss = secret.changed.slice(0, secret.changed.length - 1);
  assert.equal(score(miss, secret), 1, 'a missed changed slot is 1 error');
  const wrong = [...secret.changed, secret.changed[0] === 0 ? 1 : 0];
  assert.equal(score(wrong, secret), 1, 'an unchanged slot wrongly flagged is 1 error');
});

test('flagging everything is WORSE than a real attempt — blanket-tapping loses', () => {
  for (let s = 0; s < 20; s++) {
    const { secret } = round(`tray-blanket-${s}`);
    const blanket = score([...Array(TRAY_SLOTS).keys()], secret);
    assert.equal(blanket, TRAY_SLOTS - secret.changed.length,
      `seed ${s}: 12 picks, ${TRAY_SLOTS - secret.changed.length} of them wrong`);
    const real = score(secret.changed.slice(0, secret.changed.length - 1), secret);
    assert.ok(blanket > real,
      `seed ${s}: blanket (${blanket}) must be worse than a partial real answer (${real})`);
    const none = score([], secret);
    assert.ok(blanket > none, `seed ${s}: flagging everything must be worse than flagging nothing`);
  }
});

test('payload validation: non-array, out-of-range, fractional, duplicate, capped', () => {
  const { secret } = round();
  assert.equal(computeMetric('tray', null, secret, {}, {}), null, 'null payload declines');
  assert.equal(computeMetric('tray', { picks: 'nope' }, secret, {}, {}), null, 'string picks declines');
  assert.equal(computeMetric('tray', { picks: 7 }, secret, {}, {}), null, 'number picks declines');
  assert.equal(score([], secret), secret.changed.length,
    'flagging nothing misses every changed slot');
  // Fractional and out-of-range indices are dropped, not trusted.
  assert.equal(score([0.5, -3, 12, 99, ...secret.changed], secret), 0,
    'invalid entries are dropped; the valid set still scores perfectly');
  // Duplicates collapse; a giant array is capped at the tray size.
  assert.equal(score([...secret.changed, ...secret.changed], secret), 0, 'dupes collapse');
  const flood = [...Array(500).keys()];
  assert.equal(score(flood, secret), TRAY_SLOTS - secret.changed.length, 'array capped at 12');
});

test('hostile payloads never crash the scorer', () => {
  const { secret } = round();
  for (const payload of [null, undefined, 'string', 7, [], {}, { picks: 1 }, { picks: {} }]) {
    const m = computeMetric('tray', payload, secret, {}, {});
    assert.ok(m === null || Number.isFinite(m), `tray returned ${m} for ${JSON.stringify(payload)}`);
  }
});

test('formatRaw names the miss count', () => {
  assert.equal(formatRaw('tray', null), 'no submission');
  assert.equal(formatRaw('tray', 3), '3 wrong');
});

test('trayLevel and buildGameData agree on the same seed', () => {
  // The server derives round content through trayLevel; the client re-derives
  // the swapped tray through the same function. They must agree, or a room
  // would be playing two different games.
  const { clientData, secret } = round();
  const derived = trayLevel(clientData.seed);
  assert.deepEqual(derived.items, clientData.items);
  assert.deepEqual(derived.changed, secret.changed);
  assert.deepEqual(derived.replacements, secret.replacements);
});
