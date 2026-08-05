// Anagram Rush (issue #16): the stream is deterministic and server-authoritative;
// a displayed scramble is never the answer or a trivial cyclic rotation.

import test from 'node:test';
import assert from 'node:assert/strict';
import { seededRng } from '../shared/rng.js';
import { anagramRounds, isTrivialRotation, scrambleWord } from '../shared/anagram.js';
import { ROSTER_BY_KEY, buildGameData, computeMetric, formatRaw } from '../server/games.js';
import { Room } from '../server/room.js';

const CONFIG = { gameDuration: 45000 };
const round = (seed = 'anagram-seed') =>
  buildGameData('anagram', { rng: seededRng(seed), config: CONFIG, used: {} });

const stubIo = () => ({ to: () => ({ emit: () => {} }) });

test('roster marks Anagram Rush as a default-off language score game', () => {
  const game = ROSTER_BY_KEY.get('anagram');
  assert.deepEqual(
    { key: game?.key, name: game?.name, category: game?.category, type: game?.type, defaultEnabled: game?.defaultEnabled },
    { key: 'anagram', name: 'Anagram Rush', category: 'language', type: 'score', defaultEnabled: false },
  );
  const room = new Room(stubIo(), 'ANAG', {});
  try {
    assert.equal(room.config.enabled.anagram, false, 'new rooms leave the vocabulary game off');
  } finally {
    room.destroy();
  }
});

test('round data is deterministic, easy-to-hard, and keeps answers server-side', () => {
  assert.deepEqual(round('same'), round('same'));
  const { clientData, secret } = round();
  assert.equal(clientData.scrambles.length, 25);
  assert.equal(secret.answers.length, 25);
  assert.equal(clientData.seed, undefined, 'a client cannot derive the answer stream from a seed');
  for (let i = 0; i < clientData.scrambles.length; i++) {
    const scramble = clientData.scrambles[i];
    const answer = secret.answers[i];
    assert.equal(scramble.length, answer.length);
    assert.equal(scramble.length, 4 + Math.min(4, Math.floor(i / 5)), `round ${i} follows the length ladder`);
    assert.notEqual(scramble.toLowerCase(), answer, `round ${i} is not already solved`);
    assert.equal(isTrivialRotation(scramble, answer), false, `round ${i} is not a trivial rotation`);
  }
});

test('scrambler preserves letters and never emits the source word or rotation', () => {
  for (const word of ['mint', 'planet', 'anagram', 'elephant']) {
    const scramble = scrambleWord(word, seededRng(`scramble:${word}`));
    assert.equal([...scramble].sort().join(''), [...word].sort().join(''));
    assert.equal(isTrivialRotation(scramble, word), false);
  }
  const rounds = anagramRounds('ladder');
  assert.deepEqual(rounds, anagramRounds('ladder'));
});

test('scoring is exact case-insensitive, position-bound, and duplicate-safe', () => {
  const { clientData, secret } = round();
  const score = (solved) => computeMetric('anagram', { solved }, secret, clientData, CONFIG);
  assert.equal(score([{ index: 0, word: secret.answers[0].toUpperCase() }]), 1);
  assert.equal(score([
    { index: 0, word: secret.answers[0].toUpperCase() },
    { index: 0, word: secret.answers[0] },
    { index: 1, word: 'wrong' },
    { index: 999, word: secret.answers[0] },
  ]), 1, 'a word position can score only once');
  assert.equal(score([]), 0, 'an attempted round with no solves is a real floor score');
  assert.equal(score([{ index: 0, word: secret.answers[1] }]), 0, 'answers are position-bound');
  assert.equal(score([{ index: '0', word: secret.answers[0] }]), 0, 'indices are integers only');
  assert.equal(computeMetric('anagram', {}, secret, clientData, CONFIG), null);
  assert.equal(computeMetric('anagram', { solved: 'nope' }, secret, clientData, CONFIG), null);
  assert.equal(computeMetric('anagram', null, secret, clientData, CONFIG), null);
});

test('formatRaw names word scores and non-submissions', () => {
  assert.equal(formatRaw('anagram', null), 'no submission');
  assert.equal(formatRaw('anagram', 0), '0 words');
  assert.equal(formatRaw('anagram', 1), '1 word');
  assert.equal(formatRaw('anagram', 7), '7 words');
});
