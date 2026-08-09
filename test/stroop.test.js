// Stroop Rush (issue #50): a seeded, simultaneous ink-colour task. Every player
// gets the identical sequence; scoring counts only correct ink picks, one per
// item, so flooding every button cannot beat honest play. The palette stays
// label-parity accessible (unique names AND hexes) for colourblind players.

import test from 'node:test';
import assert from 'node:assert/strict';
import { seededRng } from '../shared/rng.js';
import { stroopSequence, PALETTE, COLOR_NAMES, assertLabelParity } from '../shared/stroop.js';
import { ROSTER_BY_KEY, buildGameData, computeMetric, formatRaw } from '../server/games.js';
import { Room } from '../server/room.js';

const CONFIG = { gameDuration: 45000 };
const round = (seed = 'stroop-seed') =>
  buildGameData('stroop', { rng: seededRng(seed), config: CONFIG, used: {} });

const stubIo = () => ({ to: () => ({ emit: () => {} }) });

test('roster marks Stroop Rush as an attention score game that is on by default', () => {
  const game = ROSTER_BY_KEY.get('stroop');
  assert.deepEqual(
    { key: game?.key, name: game?.name, category: game?.category, type: game?.type },
    { key: 'stroop', name: 'Stroop Rush', category: 'attention', type: 'score' },
  );
  assert.equal(game?.defaultEnabled, undefined, 'the spec roster entry carries no defaultEnabled flag');
  const room = new Room(stubIo(), 'STRP', {});
  try {
    assert.equal(room.config.enabled.stroop, true, 'new rooms enable the attention game by default');
  } finally {
    room.destroy();
  }
});

test('two clients built from the same seed get an identical sequence', () => {
  assert.deepEqual(round('same'), round('same'));
  const { clientData, secret } = round();
  assert.ok(Array.isArray(clientData.items) && clientData.items.length >= 60, 'a generous stream so nobody exhausts it');
  assert.equal(secret.inks.length, clientData.items.length, 'the secret answer per item lines up with the stream');
  for (let i = 0; i < clientData.items.length; i++) {
    const item = clientData.items[i];
    assert.ok(COLOR_NAMES.includes(item.word), `item ${i} word is a palette name`);
    assert.ok(COLOR_NAMES.includes(item.ink), `item ${i} ink is a palette name`);
    assert.equal(item.ink, secret.inks[i], `secret ink ${i} matches the rendered item`);
  }
  // The palette rides along so buttons can be labelled by colour NAME text.
  assert.deepEqual(clientData.palette, PALETTE);
});

test('the seeded stream makes interference the common case', () => {
  const { clientData } = round('interference');
  const incongruent = clientData.items.filter((it) => it.word !== it.ink).length;
  assert.ok(incongruent > clientData.items.length / 2, 'most cards print a word in a disagreeing ink');
});

test('scoring counts only correct ink picks, is position-bound and duplicate-safe', () => {
  const { clientData, secret } = round();
  const inks = secret.inks;
  const wrongFor = (name) => COLOR_NAMES.find((n) => n !== name);
  const score = (picks) => computeMetric('stroop', { picks }, secret, clientData, CONFIG);

  assert.equal(score([{ index: 0, color: inks[0] }]), 1, 'a correct ink pick scores');
  assert.equal(score([{ index: 0, color: wrongFor(inks[0]) }]), 0, 'reading the word / a wrong ink scores nothing');
  assert.equal(
    score([
      { index: 0, color: inks[0] },
      { index: 0, color: inks[0] }, // same position again — must not double-count
      { index: 1, color: inks[1] },
      { index: 999, color: inks[0] }, // out of range
    ]),
    2,
    'each item position can score at most once and indices are bounds-checked',
  );
  assert.equal(score([{ index: '0', color: inks[0] }]), 0, 'indices are integers only');
  assert.equal(score([{ index: 0, color: 42 }]), 0, 'a non-string colour never scores');
  assert.equal(score([]), 0, 'an attempted round with no picks is a real floor score');
});

test('blanket input — pressing every button per item — cannot beat honest play', () => {
  const { clientData, secret } = round('flood');
  const inks = secret.inks;
  // Honest play: one correct pick for each of the first 10 items.
  const honest = [];
  for (let i = 0; i < 10; i++) honest.push({ index: i, color: inks[i] });
  const honestScore = computeMetric('stroop', { picks: honest }, secret, clientData, CONFIG);
  assert.equal(honestScore, 10);

  // Flood attack: for every item submit EVERY colour, hoping one always matches.
  const flood = [];
  for (let i = 0; i < inks.length; i++) {
    for (const c of COLOR_NAMES) flood.push({ index: i, color: c });
  }
  const floodScore = computeMetric('stroop', { picks: flood }, secret, clientData, CONFIG);
  // Dedup-by-index means only the FIRST pick per item counts. Whether that first
  // colour happens to match is pure luck, and it can never exceed the item count
  // — the flood cannot out-score an honest player who answers every item right.
  const perfect = computeMetric(
    'stroop',
    { picks: inks.map((c, index) => ({ index, color: c })) },
    secret, clientData, CONFIG,
  );
  assert.equal(perfect, inks.length, 'answering every item correctly is the honest ceiling');
  assert.ok(floodScore <= perfect, 'flooding every button never beats an honest perfect run');
  assert.ok(floodScore < inks.length, 'and in practice the blanket guard holds it below the ceiling');
});

test('a non-submitter and malformed payloads score null, not a number', () => {
  const { clientData, secret } = round();
  assert.equal(computeMetric('stroop', {}, secret, clientData, CONFIG), null, 'no picks array → non-submission');
  assert.equal(computeMetric('stroop', { picks: 'nope' }, secret, clientData, CONFIG), null);
  assert.equal(computeMetric('stroop', null, secret, clientData, CONFIG), null);
});

test('formatRaw reports "N correct" and non-submissions read clearly', () => {
  assert.equal(formatRaw('stroop', null), 'no submission');
  assert.equal(formatRaw('stroop', 0), '0 correct');
  assert.equal(formatRaw('stroop', 1), '1 correct');
  assert.equal(formatRaw('stroop', 12), '12 correct');
});

test('palette is label-parity accessible: unique names AND unique hexes', () => {
  assert.equal(assertLabelParity(PALETTE), true);
  assert.equal(new Set(PALETTE.map((c) => c.name)).size, PALETTE.length, 'every button label is distinct');
  assert.equal(new Set(PALETTE.map((c) => c.hex.toLowerCase())).size, PALETTE.length, 'every ink is distinct');
  assert.ok(PALETTE.length >= 3 && PALETTE.length <= 6, 'a small, high-contrast set');
  // A duplicate name would make two buttons indistinguishable without hue.
  assert.throws(() => assertLabelParity([{ name: 'RED', hex: '#111' }, { name: 'RED', hex: '#222' }]));
  // A duplicate hex would make two inks indistinguishable by colour.
  assert.throws(() => assertLabelParity([{ name: 'RED', hex: '#111' }, { name: 'BLUE', hex: '#111' }]));
});

test('the sequence is a pure function of its seed (no Math.random drift)', () => {
  assert.deepEqual(stroopSequence('ladder'), stroopSequence('ladder'));
  assert.notDeepEqual(stroopSequence('ladder'), stroopSequence('other'));
});
