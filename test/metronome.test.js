// Metronome Blackout (issue #9): four beats play, then the room goes silent
// and the player taps where the next eight beats would have fallen.
//
// The measurement is entirely local to the client — performance.now() deltas
// against a grid that client scheduled itself — so unlike the chairs finale
// there is no clock sync and no network latency anywhere in the metric. What
// the server has to get right is the scoring of an untrusted array of taps:
// missing ones, extra ones, junk ones, and the mashing strategy the shape of
// this game invites.

import test from 'node:test';
import assert from 'node:assert/strict';
import { seededRng } from '../shared/rng.js';
import { Room } from '../server/room.js';
import {
  ROSTER_BY_KEY,
  MULTI_STAGE,
  NEEDS_AGGREGATION,
  buildGameData,
  computeMetric,
  formatRaw,
} from '../server/games.js';

// The spec's interval window. Hardcoded rather than imported: the point of
// these two numbers is that they are a decision, so a change to them should
// break a test and be re-argued.
const MIN_INTERVAL = 400;
const MAX_INTERVAL = 900;

const build = (seed = 'metronome-seed') =>
  buildGameData('metronome', { rng: seededRng(seed), config: {}, used: {} }).clientData;

const score = (offsets, clientData) =>
  computeMetric('metronome', { offsets }, {}, clientData, {});

// Taps exactly on the grid: the nth scored beat falls intervalMs * n after the
// last lead-in beat. `off(i)` displaces tap i, in ms.
function taps(cd, count = cd.silentBeats, off = () => 0) {
  return [...Array(count)].map((_, i) => cd.intervalMs * (i + 1) + off(i));
}

// ---- roster wiring ---------------------------------------------------------

test('metronome is a single-stage timing game scored as error', () => {
  const meta = ROSTER_BY_KEY.get('metronome');
  assert.ok(meta, 'metronome is on the roster');
  assert.equal(meta.category, 'timing');
  assert.equal(meta.type, 'error', 'lower ms off is better');
  assert.equal(meta.stages, undefined, 'one payload, one deadline');
  assert.ok(!MULTI_STAGE.has('metronome'));
  assert.ok(!NEEDS_AGGREGATION.has('metronome'),
    'the metric is per-player: nothing about it depends on the rest of the room');
});

// ---- round data ------------------------------------------------------------

test('round data is the grid and nothing else — there is no secret to keep', () => {
  const { clientData, secret } = buildGameData('metronome', {
    rng: seededRng('shape'), config: {}, used: {},
  });
  assert.deepEqual(Object.keys(clientData).sort(), ['intervalMs', 'leadInBeats', 'silentBeats']);
  assert.equal(clientData.leadInBeats, 4);
  assert.equal(clientData.silentBeats, 8);
  assert.deepEqual(secret, {}, 'intervalMs implies the whole grid — hiding it would hide nothing');
});

test('the interval is seeded: same seed, same grid for every player in the room', () => {
  assert.equal(build('room-ABCD:g3:metronome').intervalMs,
    build('room-ABCD:g3:metronome').intervalMs);
});

test('the interval varies across rounds and is never a whole number of BPM', () => {
  const seen = new Set();
  for (let i = 0; i < 300; i++) {
    const { intervalMs } = build(`seed-${i}`);
    assert.ok(Number.isInteger(intervalMs), `interval is whole ms (${intervalMs})`);
    assert.ok(intervalMs >= MIN_INTERVAL && intervalMs <= MAX_INTERVAL,
      `interval ${intervalMs} inside ${MIN_INTERVAL}–${MAX_INTERVAL}ms`);
    // 60000 / intervalMs is the BPM. A whole one is a number you can type into
    // any metronome app; everything else has to be matched by ear and phase.
    assert.notEqual(60000 % intervalMs, 0,
      `interval ${intervalMs} is exactly ${60000 / intervalMs} BPM — a metronome app preset`);
    seen.add(intervalMs);
  }
  assert.ok(seen.size > 50, `intervals spread across the window (${seen.size} distinct)`);
});

// ---- the scorer ------------------------------------------------------------

test('a perfect attempt scores 0 ms of error', () => {
  const cd = build();
  assert.equal(score(taps(cd), cd), 0);
});

test('a steady offset scores exactly that offset — playing behind the beat is the error', () => {
  const cd = build();
  assert.equal(score(taps(cd, cd.silentBeats, () => 40), cd), 40);
  assert.equal(score(taps(cd, cd.silentBeats, () => -25), cd), 25, 'early counts the same as late');
});

test('the metric is the mean absolute deviation, not the net drift', () => {
  const cd = build();
  // +60 and −60 cancel to zero net drift and must not read as a perfect run.
  const alternating = taps(cd, cd.silentBeats, (i) => (i % 2 ? 60 : -60));
  assert.equal(score(alternating, cd), 60);
});

test('a tap that never came costs one full beat', () => {
  const cd = build();
  // Four beats played perfectly, then the player stopped.
  assert.equal(score(taps(cd, 4), cd), cd.intervalMs / 2,
    'four perfect + four missing = half a beat of average error');
  assert.equal(score(taps(cd, 7), cd), cd.intervalMs / 8, 'one missing beat out of eight');
});

test('a partial attempt still scores, and beats not playing at all', () => {
  const cd = build();
  const partial = score(taps(cd, 3), cd);
  assert.ok(partial != null && partial < cd.intervalMs, 'three taps is a score, not a non-entry');
  assert.equal(computeMetric('metronome', { offsets: [] }, {}, cd, {}), null,
    'zero taps is a non-submission — that player did not play the game');
});

test('one wild tap costs a full beat and no more', () => {
  const cd = build();
  const wild = taps(cd);
  wild[3] += 10000; // tapped ten seconds late
  assert.equal(score(wild, cd), cd.intervalMs / 8,
    'a single catastrophic tap is charged exactly what skipping it would have been');
});

test('the metric never exceeds one beat, however bad the attempt', () => {
  const cd = build();
  assert.equal(score([0, 0, 0, 0, 0, 0, 0, 0], cd), cd.intervalMs);
  assert.equal(score([-1e9, 1e9], cd), cd.intervalMs);
});

// ---- the strategies this game invites --------------------------------------

test('extra taps past the eighth are ignored — mashing on cannot repair an average', () => {
  const cd = build();
  const clean = taps(cd);
  const withMashing = [...clean, ...[...Array(40)].map((_, i) => cd.intervalMs * 9 + i * 12)];
  assert.equal(score(withMashing, cd), score(clean, cd));
  assert.equal(score(withMashing, cd), 0);
});

test('taps are consumed in order, not best-matched to the nearest beat', () => {
  const cd = build();
  // Missed beat 1, then played beats 2–9 perfectly. Best-matching would call
  // this near-perfect; in order, every tap is judged one beat behind.
  const shifted = [...Array(8)].map((_, i) => cd.intervalMs * (i + 2));
  assert.equal(score(shifted, cd), cd.intervalMs,
    'a whole-beat phase error is a whole-beat error on every tap');
});

test('a masher scores worse than a fair attempt, and worse than a drifter', () => {
  const cd = build();
  const fair = score(taps(cd, cd.silentBeats, (i) => (i % 3 === 0 ? 55 : -35)), cd);
  const drifter = score(taps(cd, cd.silentBeats, (i) => i * 30), cd);       // speeding up
  const masher = score([...Array(20)].map((_, i) => i * 25), cd);           // 20 taps in half a second
  assert.ok(fair < drifter, `a steady player beats a drifting one (${fair} < ${drifter})`);
  assert.ok(drifter < masher, `a drifting player beats a masher (${drifter} < ${masher})`);
  assert.equal(masher, cd.intervalMs, 'mashing bottoms out at the worst score the game has');
});

// ---- untrusted payloads ----------------------------------------------------

test('payloads that are not an attempt are non-submissions, never a crash', () => {
  const cd = build();
  const junk = [null, undefined, 'offsets', 42, {}, { offsets: null }, { offsets: 'lots' },
    { offsets: {} }, { offsets: [] }, { offsets: ['x', null, NaN, Infinity] }];
  for (const payload of junk) {
    assert.equal(computeMetric('metronome', payload, {}, cd, {}), null,
      `${JSON.stringify(payload) ?? String(payload)} scores as no submission`);
  }
});

test('junk mixed into a real attempt is dropped, not counted as a tap', () => {
  const cd = build();
  const clean = taps(cd);
  const dirty = [clean[0], 'x', clean[1], null, clean[2], NaN, ...clean.slice(3), Infinity];
  assert.equal(score(dirty, cd), score(clean, cd), 'the honest taps score exactly as they would alone');
});

// ---- reveal ----------------------------------------------------------------

test('the raw reveal reads in milliseconds off the beat', () => {
  assert.equal(formatRaw('metronome', 137.4), '137 ms avg off');
  assert.equal(formatRaw('metronome', 0), '0 ms avg off');
  assert.equal(formatRaw('metronome', null), 'no submission');
});

// ---- in a room -------------------------------------------------------------

const stubIo = () => ({ to: () => ({ emit: () => {} }) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, ms = 5000, label = 'condition') {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (fn()) return;
    await sleep(20);
  }
  throw new Error(`timed out waiting for ${label}`);
}

function addPlayer(room, id, name) {
  room.players.set(id, {
    id, name, socketId: `sock-${id}`, connected: true,
    disconnectedAt: null, sync: null, joinedAt: Date.now(),
  });
}

function onlyMetronome() {
  const enabled = {};
  for (const g of ROSTER_BY_KEY.values()) enabled[g.key] = g.key === 'metronome';
  return enabled;
}

const FAST = {
  gameDuration: 800, musicMs: 60, tutorialMs: 0,
  redemptionPrepMs: 60, redemptionLeadMs: 120,
  postGreenTimeout: 800, hardTimeout: 1500, closeGraceMs: 200,
};

test('a room plays it: the grid is broadcast, and points follow the beat', async () => {
  const room = new Room(stubIo(), 'METR', { ...FAST, enabled: onlyMetronome() });
  try {
    ['steady', 'drifter', 'masher', 'silent'].forEach((id) => addPlayer(room, id, id));
    assert.equal(room.start().ok, true);
    await waitFor(() => room.phase === 'minigame', 3000, 'the metronome round');

    const g = room.round.games[0];
    assert.equal(g.key, 'metronome');
    const cd = g.clientData;
    assert.ok(cd.intervalMs >= MIN_INTERVAL && cd.intervalMs <= MAX_INTERVAL,
      'the room is playing a real grid');
    assert.deepEqual(g.secret, {}, 'nothing is withheld from the players');

    room.handleSubmit('steady', { offsets: taps(cd, cd.silentBeats, (i) => (i % 2 ? 18 : -14)) });
    room.handleSubmit('drifter', { offsets: taps(cd, cd.silentBeats, (i) => 30 + i * 45) });
    room.handleSubmit('masher', { offsets: [...Array(25)].map((_, i) => i * 20) });
    // 'silent' never submits.

    await waitFor(() => room.phase === 'scores', 3000, 'scores');
    const board = room.lastScores;
    const row = (id) => board.find((r) => r.id === id);

    assert.equal(row('steady').points, 1000, 'the best timing in the room takes the game');
    assert.ok(row('steady').points > row('drifter').points, 'steady beats drifting');
    assert.ok(row('drifter').points > row('masher').points, 'drifting beats mashing');
    assert.equal(row('silent').points, 0, 'a non-submitter scores 0');
    assert.ok(room.players.has('silent'), 'and stays in the game');
    assert.match(row('steady').raw, /ms avg off$/, 'the reveal names the unit');
    assert.equal(row('silent').raw, 'no submission');
  } finally {
    room.destroy();
  }
});

test('in a room, half an attempt still outscores mashing', async () => {
  const room = new Room(stubIo(), 'METP', { ...FAST, enabled: onlyMetronome() });
  try {
    ['partial', 'masher'].forEach((id) => addPlayer(room, id, id));
    assert.equal(room.start().ok, true);
    await waitFor(() => room.phase === 'minigame', 3000, 'the metronome round');
    const cd = room.round.games[0].clientData;

    // Tapped along for three beats and gave up — the deadline collects what
    // the client had.
    room.handleSubmit('partial', { offsets: taps(cd, 3) });
    room.handleSubmit('masher', { offsets: [...Array(30)].map((_, i) => i * 15) });

    await waitFor(() => room.phase === 'scores', 3000, 'scores');
    const board = room.lastScores;
    const points = (id) => board.find((r) => r.id === id).points;
    assert.ok(points('partial') > points('masher'),
      'giving up halfway is a worse score, not a worse outcome than gaming it');
  } finally {
    room.destroy();
  }
});
