// Word Hunt (issue #51): a seeded NxN letter grid every player shares. A word
// scores only when it is BOTH in the curated offline WORDLIST AND traces a real
// 8-directional adjacency path on the grid. Scoring is server-authoritative and
// bounded, so blanket input (the whole dictionary / random junk) cannot farm a
// score. The grid is public and deterministic; the answer is never a secret the
// client can read off a seed because the grid IS the puzzle.

import test from 'node:test';
import assert from 'node:assert/strict';
import { seededRng } from '../shared/rng.js';
import { buildGrid, WORDLIST, gridHasPath, scoreWord, solveGrid } from '../shared/wordhunt.js';
import { ROSTER_BY_KEY, buildGameData, computeMetric, formatRaw } from '../server/games.js';
import { Room } from '../server/room.js';

const CONFIG = { gameDuration: 45000 };
const round = (seed = 'wordhunt-seed') =>
  buildGameData('wordhunt', { rng: seededRng(seed), config: CONFIG, used: {} });

const stubIo = () => ({ to: () => ({ emit: () => {} }) });

test('roster marks Word Hunt as a default-off language score game', () => {
  const game = ROSTER_BY_KEY.get('wordhunt');
  assert.deepEqual(
    { key: game?.key, name: game?.name, category: game?.category, type: game?.type, defaultEnabled: game?.defaultEnabled },
    { key: 'wordhunt', name: 'Word Hunt', category: 'language', type: 'score', defaultEnabled: false },
  );
  const room = new Room(stubIo(), 'WHNT', {});
  try {
    assert.equal(room.config.enabled.wordhunt, false, 'new rooms leave the vocabulary game off');
  } finally {
    room.destroy();
  }
});

test('the grid is a pure function of its seed — two clients see identical boards', () => {
  assert.deepEqual(buildGrid('abc'), buildGrid('abc'));
  assert.deepEqual(buildGrid('abc', 4), buildGrid('abc', 4));
  assert.notDeepEqual(buildGrid('abc'), buildGrid('xyz'));
  // A 4x4 board is 4 rows of 4 single letters.
  const grid = buildGrid('shape');
  assert.equal(grid.length, 4);
  for (const row of grid) {
    assert.equal(row.length, 4);
    for (const letter of row) assert.match(letter, /^[A-Z]$/);
  }
});

test('round data is deterministic and the public grid matches the trusted secret grid', () => {
  assert.deepEqual(round('same'), round('same'));
  const { clientData, secret } = round();
  assert.equal(clientData.size, clientData.grid.length);
  assert.deepEqual(clientData.grid, secret.grid, 'the client renders the exact grid the server scores against');
  assert.deepEqual(secret.grid, buildGrid(secret.seed), 'the secret grid is the seed rendered — nothing else');
  assert.equal(clientData.seed, undefined, 'the client is not handed the seed as a separate field');
});

test('gridHasPath accepts real adjacency paths and rejects everything else', () => {
  // A hand-built grid with a known path: C(0,0) A(0,1) T(1,1).
  const grid = [
    ['C', 'A', 'X'],
    ['R', 'T', 'O'],
    ['B', 'E', 'D'],
  ];
  assert.equal(gridHasPath(grid, 'cat'), true, 'C-A-T is a real 8-direction path');
  assert.equal(gridHasPath(grid, 'CAT'), true, 'matching is case-insensitive');
  assert.equal(gridHasPath(grid, 'bed'), true, 'B-E-D across the bottom row');
  // Reused cell: 'cc' would need the single C twice.
  assert.equal(gridHasPath(grid, 'cc'), false, 'a cell is used at most once');
  // Absent letter.
  assert.equal(gridHasPath(grid, 'zzz'), false, 'a letter not on the board cannot path');
  // Non-adjacent: C(0,0) to O(1,2) is not a single step.
  assert.equal(gridHasPath(grid, 'co'), false, 'non-touching letters do not path');
  assert.equal(gridHasPath(grid, ''), false, 'the empty string is not a path');
});

test('scoreWord is length-weighted: a longer word never scores less than a shorter one', () => {
  const lengths = [3, 4, 5, 6, 7, 8, 9];
  let prev = -1;
  for (const n of lengths) {
    const s = scoreWord('a'.repeat(n));
    assert.ok(s >= prev, `length ${n} scores ${s}, not below ${prev}`);
    assert.ok(s >= 1, 'an accepted word scores at least 1');
    prev = s;
  }
  assert.ok(scoreWord('cats') > scoreWord('cat'), 'a 4-letter word beats a 3-letter word');
  assert.ok(scoreWord('planet') > scoreWord('plane'), 'a 6-letter word beats a 5-letter word');
  assert.equal(scoreWord('ab'), 0, 'sub-minimum words score 0');
  assert.equal(scoreWord(42), 0, 'non-strings score 0');
});

test('computeMetric scores only words that are BOTH listed AND path on the grid', () => {
  const { clientData, secret } = round();
  const real = solveGrid(secret.grid);
  assert.ok(real.length >= 1, 'the seed must be playable so this test is meaningful');
  const one = real[0];
  const score = (words) => computeMetric('wordhunt', { words }, secret, clientData, CONFIG);

  assert.equal(score([one]), scoreWord(one), 'a listed word that paths scores its weight');
  assert.equal(score([]), 0, 'an attempted round with no finds is a real floor score');
  // Duplicates score once, case-insensitively.
  assert.equal(score([one, one.toUpperCase(), one]), scoreWord(one), 'a word scores at most once');
  // Sum of several real words.
  const many = real.slice(0, 5);
  const expected = [...new Set(many)].reduce((s, w) => s + scoreWord(w), 0);
  assert.equal(score(many), expected, 'the metric is the summed length-weighted score');
});

test('a valid grid path that is NOT in the wordlist scores nothing', () => {
  const { clientData, secret } = round();
  // Build a short string that traces a real path on the grid but is (almost
  // certainly) not an English word: the first two grid letters read in order.
  const g = secret.grid;
  const twoLetterPath = (g[0][0] + g[0][1]).toLowerCase(); // adjacent cells
  assert.equal(gridHasPath(secret.grid, twoLetterPath), true, 'the two letters are adjacent');
  assert.ok(!WORDLIST.has(twoLetterPath), 'and are not a curated word');
  assert.equal(computeMetric('wordhunt', { words: [twoLetterPath] }, secret, clientData, CONFIG), 0,
    'pathing is not enough — the word must also be listed');
});

test('blanket input is defeated and bounded: the whole dictionary plus junk scores only real finds', () => {
  const { clientData, secret } = round();
  const real = solveGrid(secret.grid);
  const trueScore = real.reduce((s, w) => s + scoreWord(w), 0);
  assert.ok(trueScore > 0, 'the seed is playable');

  // Submit the ENTIRE wordlist. Only the words that actually path can score, so
  // the metric is exactly the honest solver's score — no more.
  const everything = [...WORDLIST];
  assert.equal(computeMetric('wordhunt', { words: everything }, secret, clientData, CONFIG), trueScore,
    'dumping the dictionary scores only the words that path on this grid');

  // A huge pile of random junk strings returns a finite, small number quickly.
  const junk = [...Array(10000)].map((_, i) => `zzq${i}xkv`);
  const start = Date.now();
  const junkScore = computeMetric('wordhunt', { words: junk }, secret, clientData, CONFIG);
  assert.equal(junkScore, 0, 'random strings never path and never list');
  assert.ok(Date.now() - start < 2000, 'a 10000-length junk array is bounded and fast');

  // Dictionary + junk together still only credits the genuine finds.
  const mixed = [...everything, ...junk];
  assert.equal(computeMetric('wordhunt', { words: mixed }, secret, clientData, CONFIG), trueScore,
    'mixing junk into the dictionary changes nothing');
});

test('non-submitters and hostile payloads score null or a finite number, never a crash', () => {
  const { clientData, secret } = round();
  const call = (payload) => computeMetric('wordhunt', payload, secret, clientData, CONFIG);
  assert.equal(call(null), null);
  assert.equal(call(undefined), null);
  assert.equal(call('x'), null);
  assert.equal(call(7), null);
  assert.equal(call({}), null, 'no words array reads as a non-submission');
  assert.equal(call({ words: 'notanarray' }), null);
  // An array of non-strings is a real (empty) submission: a finite 0.
  const hostile = call({ words: [null, 7, {}, [], undefined, true] });
  assert.ok(Number.isFinite(hostile) && hostile === 0, `hostile array scored ${hostile}`);
});

test('formatRaw names the point rule and non-submissions without a bare number', () => {
  assert.equal(formatRaw('wordhunt', null), 'no submission');
  assert.equal(formatRaw('wordhunt', 0), '0 pts');
  assert.equal(formatRaw('wordhunt', 1), '1 pt');
  assert.equal(formatRaw('wordhunt', 7), '7 pts');
  assert.notEqual(formatRaw('wordhunt', 3), '3', 'the reveal screen never shows a bare number');
});
