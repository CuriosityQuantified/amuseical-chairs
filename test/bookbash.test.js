import test from 'node:test';
import assert from 'node:assert/strict';
import { seededRng } from '../shared/rng.js';
import { bookBashRound, BOOKBASH_PAGES, BOOKBASH_POSITIONS, bookBashSurvivors } from '../shared/bookbash.js';
import { ROSTER_BY_KEY, buildGameData, computeMetric, formatRaw } from '../server/games.js';

const round = (seed = 'bookbash-test') => buildGameData('bookbash', { rng: seededRng(seed), config: {}, used: {} });

test('Book Bash is a motor score game on the roster', () => {
  assert.deepEqual(ROSTER_BY_KEY.get('bookbash'), { key: 'bookbash', name: 'Book Bash', category: 'motor', type: 'score' });
});

test('Book Bash derives the same eight-page round from a seed', () => {
  const a = bookBashRound('same-seed');
  assert.deepEqual(a, bookBashRound('same-seed'));
  assert.equal(a.length, BOOKBASH_PAGES);
  assert.ok(a.every((page) => page.holes.length >= 1 && page.holes.length <= 4));
  assert.deepEqual(a.map((page) => page.fallMs), [2600, 2380, 2160, 1940, 1720, 1500, 1280, 1060]);
  assert.ok(a.every((page) => page.holes.every((position) => position >= 0 && position < BOOKBASH_POSITIONS)));
  assert.ok(a[0].holes.length > a.at(-1).holes.length, 'later pages have fewer holes');
});

test('server client data agrees with the shared round', () => {
  const { clientData, secret } = round();
  assert.deepEqual(clientData.pages, bookBashRound(clientData.seed));
  assert.deepEqual(secret.pages, clientData.pages);
});

test('survivor score stops at the first crushed page', () => {
  const pages = bookBashRound('score-seed');
  const safe = pages.map((page) => page.holes[0]);
  assert.equal(bookBashSurvivors(pages, safe), BOOKBASH_PAGES);
  assert.equal(bookBashSurvivors(pages, [safe[0], safe[1], 8]), 2);
  assert.equal(computeMetric('bookbash', { positions: safe }, { pages }, {}, {}), BOOKBASH_PAGES);
  assert.equal(computeMetric('bookbash', { positions: [] }, { pages }, {}, {}), null);
});

test('Book Bash rejects hostile payloads and formats final standing', () => {
  const { secret } = round();
  for (const payload of [null, {}, { positions: 'bad' }, { positions: [NaN] }, { positions: [1.5] }]) {
    const metric = computeMetric('bookbash', payload, secret, {}, {});
    assert.ok(metric === null || Number.isFinite(metric));
  }
  assert.equal(formatRaw('bookbash', null), 'no submission');
  assert.equal(formatRaw('bookbash', 6), '6/8 pages survived');
});
