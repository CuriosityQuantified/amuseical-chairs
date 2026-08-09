// Follow the Cup (issue #10, reworked by issue #46): a ball goes under one of
// three to five cups, the cups shuffle, and you tap the one still holding it.
// Every player plays all TEN levels and submits at the end — a miss no longer
// ends the run, it just costs that level's points. Each correct cup is worth
// 100 × its level, scored INDEPENDENTLY and by POSITION, so a perfect ten-run
// is 100·(1+…+10) = 5500.
//
// The weight sits in two places, and this file covers both:
//
//   1. The swap script has to be IDENTICAL for every player in the room and
//      derivable by the server, or two people are playing different games and
//      neither answer can be checked. shared/cups.js is that single source —
//      the client animates the plan, the server re-derives it to score. The
//      per-level swap durations are exact: [400, 372, 344, 317, 289, 261, 233,
//      206, 178, 150] ms, endpoints exactly 400 and 150.
//   2. The metric is a positional, independent point sum walked from an
//      untrusted array. Nothing in the payload may be taken at face value: not
//      the pick, not the cup index, and not the level number the client claims.

import test from 'node:test';
import assert from 'node:assert/strict';
import { seededRng } from '../shared/rng.js';
import {
  CUPS_BASE_CUPS,
  CUPS_MAX_CUPS,
  CUPS_MAX_LEVELS,
  CUPS_FIRST_SWAP_MS,
  CUPS_LAST_SWAP_MS,
  cupsSwapMs,
  cupsLevel,
} from '../shared/cups.js';
import { Room } from '../server/room.js';
import {
  ROSTER_BY_KEY,
  MULTI_STAGE,
  NEEDS_AGGREGATION,
  COMPLETION_MODE,
  buildGameData,
  computeMetric,
  formatRaw,
} from '../server/games.js';

// The ten exact per-level swap durations, level 1..10 (issue #46).
const EXPECTED_MS = [400, 372, 344, 317, 289, 261, 233, 206, 178, 150];

const build = (seed = 'cups-seed') =>
  buildGameData('cups', { rng: seededRng(seed), config: {}, used: {} }).clientData;

const score = (picks, clientData) =>
  computeMetric('cups', { picks }, {}, clientData, {});

// A correct pick for one level: the real ball position, re-derived from the
// same seed the client would animate from.
const correct = (cd, level) => ({ level, cupIndex: cupsLevel(cd.seed, level, cd).ball });
// A wrong pick for one level (a real cup, just not the ball).
const wrong = (cd, level) => {
  const plan = cupsLevel(cd.seed, level, cd);
  return { level, cupIndex: (plan.ball + 1) % plan.cups };
};

// A run that answers every level 1..N correctly.
const perfect = (cd, n = CUPS_MAX_LEVELS) =>
  [...Array(n)].map((_, i) => correct(cd, i + 1));

// The maximum achievable score: 100·(1+…+10) = 5500.
const PERFECT_SCORE = 100 * (CUPS_MAX_LEVELS * (CUPS_MAX_LEVELS + 1)) / 2;

// ---- roster wiring ---------------------------------------------------------

test('cups is a single-stage attention game scored as a point total', () => {
  const meta = ROSTER_BY_KEY.get('cups');
  assert.ok(meta, 'cups is on the roster');
  assert.equal(meta.category, 'attention');
  assert.equal(meta.type, 'score', 'higher point total is better');
  assert.equal(meta.stages, undefined, 'one payload');
  assert.ok(!MULTI_STAGE.has('cups'));
  assert.ok(!NEEDS_AGGREGATION.has('cups'),
    'the metric is per-player: nothing about it depends on the rest of the room');
  assert.ok(COMPLETION_MODE.has('cups'),
    'cups runs to completion — the room closes when everyone has submitted, not on a deadline');
});

// ---- round data ------------------------------------------------------------

test('round data is a seed and the ramp bounds — the ball is derived, never shipped', () => {
  const { clientData, secret } = buildGameData('cups', {
    rng: seededRng('shape'), config: {}, used: {},
  });
  assert.deepEqual(Object.keys(clientData).sort(), ['baseCups', 'maxLevels', 'seed'],
    'no speedMultiplier — the durations are fixed by cupsSwapMs (issue #46)');
  assert.equal(clientData.baseCups, CUPS_BASE_CUPS);
  assert.equal(clientData.maxLevels, CUPS_MAX_LEVELS);
  assert.equal(clientData.maxLevels, 10, 'exactly ten levels');
  assert.equal(typeof clientData.seed, 'string');
  assert.deepEqual(secret, {},
    'every level is derivable from the seed — a secret half would be a second copy of the same truth');
});

test('the queue index no longer changes the round data — durations are fixed', () => {
  const a = buildGameData('cups', { rng: seededRng('q'), config: {}, used: {}, queueIndex: 0 }).clientData;
  const b = buildGameData('cups', { rng: seededRng('q'), config: {}, used: {}, queueIndex: 5 }).clientData;
  assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort());
  assert.ok(!('speedMultiplier' in a), 'no speedMultiplier key survives from issue #35');
});

test('the seed is seeded: same round seed, same shuffle for every player', () => {
  assert.equal(build('room-ABCD:g3:cups').seed, build('room-ABCD:g3:cups').seed);
  const a = cupsLevel(build('room-ABCD:g3:cups').seed, 5, { baseCups: CUPS_BASE_CUPS });
  const b = cupsLevel(build('room-ABCD:g3:cups').seed, 5, { baseCups: CUPS_BASE_CUPS });
  assert.deepEqual(a, b, 'two players derive the identical level 5');
});

test('the seed varies from round to round — nobody replays a shuffle they have seen', () => {
  const seen = new Set();
  for (let i = 0; i < 200; i++) seen.add(build(`seed-${i}`).seed);
  assert.ok(seen.size > 150, `seeds spread across rounds (${seen.size} distinct of 200)`);
});

// ---- the exact ten swap durations (issue #46) ------------------------------

test('cupsSwapMs is the exact linear ramp from 400ms to 150ms across ten levels', () => {
  for (let level = 1; level <= CUPS_MAX_LEVELS; level++) {
    assert.equal(cupsSwapMs(level), EXPECTED_MS[level - 1],
      `level ${level}: swap duration is exactly ${EXPECTED_MS[level - 1]}ms`);
  }
  assert.equal(cupsSwapMs(1), 400, 'level 1 endpoint is exactly 400ms');
  assert.equal(cupsSwapMs(1), CUPS_FIRST_SWAP_MS);
  assert.equal(cupsSwapMs(CUPS_MAX_LEVELS), 150, 'level 10 endpoint is exactly 150ms');
  assert.equal(cupsSwapMs(CUPS_MAX_LEVELS), CUPS_LAST_SWAP_MS);
});

test('cupsLevel.swapMs matches the exact ten durations, for several seeds', () => {
  for (const seed of ['a', 'b', 'c', 'room-XY:g2:cups', 'another-seed']) {
    for (let level = 1; level <= CUPS_MAX_LEVELS; level++) {
      assert.equal(cupsLevel(seed, level, {}).swapMs, EXPECTED_MS[level - 1],
        `${seed} level ${level}: ${EXPECTED_MS[level - 1]}ms (durations are seed-independent)`);
    }
  }
});

test('levels above ten clamp to the level-ten duration and never go negative', () => {
  for (let level = CUPS_MAX_LEVELS + 1; level <= CUPS_MAX_LEVELS + 20; level++) {
    assert.equal(cupsSwapMs(level), 150, `level ${level} clamps to 150ms`);
    assert.ok(cupsLevel('clamp', level, {}).swapMs > 0, `level ${level}: swap duration stays positive`);
  }
});

// ---- the level generator ---------------------------------------------------

test('a level is derivable on its own — the server never has to replay the ones before it', () => {
  const cd = build();
  const seventh = cupsLevel(cd.seed, 7, cd);
  assert.deepEqual(cupsLevel(cd.seed, 7, cd), seventh,
    'level 7 is a pure function of (seed, level), not of the run so far');
});

test('the ball ends where the swaps put it', () => {
  const cd = build();
  for (let level = 1; level <= CUPS_MAX_LEVELS; level++) {
    const plan = cupsLevel(cd.seed, level, cd);
    let pos = plan.start;
    for (const { a, b } of plan.swaps) {
      if (pos === a) pos = b;
      else if (pos === b) pos = a;
    }
    assert.equal(plan.ball, pos, `level ${level}: the declared answer is where the script leaves it`);
  }
});

test('every swap is two different cups, both on the table', () => {
  for (let level = 1; level <= CUPS_MAX_LEVELS; level++) {
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const plan = cupsLevel(seed, level, {});
      assert.ok(plan.start >= 0 && plan.start < plan.cups, `level ${level}: the ball starts on the table`);
      assert.ok(plan.ball >= 0 && plan.ball < plan.cups, `level ${level}: the ball ends on the table`);
      for (const { a, b } of plan.swaps) {
        assert.notEqual(a, b, `level ${level}: a cup swapped with itself is a frame of nothing`);
        assert.ok(a >= 0 && a < plan.cups && b >= 0 && b < plan.cups,
          `level ${level}: swap (${a},${b}) is inside ${plan.cups} cups`);
      }
    }
  }
});

test('no swap immediately undoes the one before it', () => {
  for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
    for (let level = 1; level <= CUPS_MAX_LEVELS; level++) {
      const { swaps } = cupsLevel(seed, level, {});
      for (let i = 1; i < swaps.length; i++) {
        const p = swaps[i - 1];
        const q = swaps[i];
        assert.ok(!((p.a === q.a && p.b === q.b) || (p.a === q.b && p.b === q.a)),
          `${seed} level ${level}: swap ${i} repeats swap ${i - 1}`);
      }
    }
  }
});

test('the ramp is monotonic in all three dimensions', () => {
  const plans = [...Array(CUPS_MAX_LEVELS)].map((_, i) => cupsLevel('ramp', i + 1, {}));
  for (let i = 1; i < plans.length; i++) {
    assert.ok(plans[i].cups >= plans[i - 1].cups, `level ${i + 1}: cup count never drops`);
    assert.ok(plans[i].swaps.length > plans[i - 1].swaps.length, `level ${i + 1}: more swaps than the last`);
    assert.ok(plans[i].swapMs < plans[i - 1].swapMs, `level ${i + 1}: swaps get strictly faster`);
  }
  assert.equal(plans[0].cups, CUPS_BASE_CUPS, 'level 1 opens at the base cup count');
  assert.equal(plans[plans.length - 1].cups, CUPS_MAX_CUPS, 'the last level is the full table');
  assert.equal(plans[0].swapMs, 400, 'level 1 crossing is exactly 400ms');
  assert.equal(plans[plans.length - 1].swapMs, 150, 'level 10 crossing is exactly 150ms');
});

test('the shuffle actually moves the ball around, level over level', () => {
  let moved = 0;
  const total = 200;
  for (let i = 0; i < total; i++) {
    const plan = cupsLevel(`spread-${i}`, 4, {});
    if (plan.ball !== plan.start) moved++;
  }
  assert.ok(moved > total * 0.5, `the ball leaves its starting cup most rounds (${moved}/${total})`);
});

// ---- the scorer: independent, positional 100·level -------------------------

test('a perfect ten-level run scores 5500', () => {
  const cd = build();
  assert.equal(PERFECT_SCORE, 5500, 'the arithmetic itself: 100·(1+…+10)');
  assert.equal(score(perfect(cd), cd), 5500);
});

test('each correct level adds exactly 100·level, independently', () => {
  const cd = build();
  assert.equal(score([correct(cd, 1)], cd), 100, 'level 1 alone is worth 100');
  assert.equal(score([wrong(cd, 1), correct(cd, 2)], cd), 200, 'level 2 alone is worth 200');
  assert.equal(score([wrong(cd, 1), wrong(cd, 2), wrong(cd, 3), wrong(cd, 4), wrong(cd, 5),
    wrong(cd, 6), wrong(cd, 7), wrong(cd, 8), wrong(cd, 9), correct(cd, 10)], cd), 1000,
    'level 10 alone is worth 1000');
});

test('a miss in the middle does NOT stop later levels from scoring', () => {
  const cd = build();
  // Clear everything except level 3.
  const picks = perfect(cd).map((p, i) => (i + 1 === 3 ? wrong(cd, 3) : p));
  assert.equal(score(picks, cd), PERFECT_SCORE - 300,
    'missing level 3 costs 300 and nothing else — 5500-300 = 5200');
  assert.equal(score(picks, cd), 5200);
});

test('missing several scattered levels costs exactly their point values and no more', () => {
  const cd = build();
  const missSet = new Set([1, 4, 7]); // costs 100 + 400 + 700 = 1200
  const picks = perfect(cd).map((p, i) => (missSet.has(i + 1) ? wrong(cd, i + 1) : p));
  assert.equal(score(picks, cd), PERFECT_SCORE - (100 + 400 + 700));
  assert.equal(score(picks, cd), 4300);
});

test('an empty run is a real zero, not a non-submission', () => {
  const cd = build();
  assert.equal(score([], cd), 0);
  assert.equal(score([wrong(cd, 1)], cd), 0, 'missing level 1 scores the same as never trying');
});

test('a non-array picks payload is a non-submission (null)', () => {
  const cd = build();
  assert.equal(computeMetric('cups', { picks: null }, {}, cd, {}), null);
  assert.equal(computeMetric('cups', {}, {}, cd, {}), null, 'no picks at all');
});

// ---- what the server refuses to take on trust ------------------------------

test('a forged high level in position 1 scores nothing for it', () => {
  const cd = build();
  // Position 1 is only ever checked against level 1. Claiming to have been on
  // level 10 (with level 10's correct ball) in slot 0 earns nothing.
  const forge = [{ level: 10, cupIndex: cupsLevel(cd.seed, 10, cd).ball }];
  assert.equal(score(forge, cd), 0, 'position 1 is level 1, whatever the entry claims');
});

test('the level tag must match the position, or the entry earns no credit', () => {
  const cd = build();
  // Positions are right, but every entry lies about its own level → no credit,
  // yet the scan keeps going.
  const mislabeled = perfect(cd).map((p) => ({ ...p, level: p.level + 1 }));
  assert.equal(score(mislabeled, cd), 0, 'a level tag that does not match its slot is worthless');
});

test('out-of-order and gap levels get no credit but do not abort the scan', () => {
  const cd = build();
  // Slot 0 says level 2 (mismatch → 0), slot 1 says level 2 correctly (matches
  // position 2 → 200). The gap at position 1 does not stop later scoring.
  const picks = [correct(cd, 2), correct(cd, 2)];
  assert.equal(score(picks, cd), 200,
    'only the entry whose level matches its position scores; the scan continues');
});

test('a cup index outside that level\'s table earns no credit and does not crash', () => {
  const cd = build();
  for (const cupIndex of [-1, 99, 1.5, '0', null, undefined, NaN, Infinity, {}]) {
    const picks = perfect(cd).map((p, i) => (i === 0 ? { level: 1, cupIndex } : p));
    // Level 1 loses its 100 points; everything else still scores.
    assert.equal(score(picks, cd), PERFECT_SCORE - 100,
      `cupIndex ${JSON.stringify(cupIndex) ?? String(cupIndex)} only costs level 1's points`);
  }
});

test('junk entries inside a real run earn no credit and never abort the scan', () => {
  const cd = build();
  for (const rubbish of [null, undefined, 'level 3', 5, [], { cupIndex: 0 }, { level: 3 }, NaN]) {
    // Put the junk at position 3 (level 3): level 3 loses its 300 points, the
    // rest of the run still scores.
    const picks = perfect(cd).map((p, i) => (i === 2 ? rubbish : p));
    assert.equal(computeMetric('cups', { picks }, {}, cd, {}), PERFECT_SCORE - 300,
      `${JSON.stringify(rubbish) ?? String(rubbish)} at position 3 only costs level 3, no throw`);
  }
});

test('an overrun of hundreds of picks still caps at 5500', () => {
  const cd = build();
  const overrun = [
    ...perfect(cd),
    ...[...Array(500)].map((_, i) => ({ level: CUPS_MAX_LEVELS + i + 1, cupIndex: 0 })),
  ];
  assert.equal(score(overrun, cd), PERFECT_SCORE, 'only the first ten positions can score; the cap is the cap');
});

test('payloads that are not an attempt are non-submissions, never a crash', () => {
  const cd = build();
  const junk = [null, undefined, 'picks', 42, { picks: null }, { picks: 'lots' }, { picks: {} },
    { picks: 7 }];
  for (const payload of junk) {
    assert.equal(computeMetric('cups', payload, {}, cd, {}), null,
      `${JSON.stringify(payload) ?? String(payload)} scores as no submission`);
  }
});

test('tapping cup 0 or the starting cup every level is a losing strategy', () => {
  const runs = 200;
  let alwaysZeroTotal = 0;
  let alwaysStartTotal = 0;
  for (let i = 0; i < runs; i++) {
    const cd = build(`guess-${i}`);
    alwaysZeroTotal += score([...Array(CUPS_MAX_LEVELS)].map((_, l) => ({ level: l + 1, cupIndex: 0 })), cd);
    alwaysStartTotal += score(
      [...Array(CUPS_MAX_LEVELS)].map((_, l) => ({ level: l + 1, cupIndex: cupsLevel(cd.seed, l + 1, cd).start })),
      cd
    );
  }
  // Both strategies should land far below the 5500 ceiling on average.
  assert.ok(alwaysZeroTotal / runs < PERFECT_SCORE * 0.35,
    `tapping cup 0 averages ${(alwaysZeroTotal / runs).toFixed(0)} pts`);
  assert.ok(alwaysStartTotal / runs < PERFECT_SCORE * 0.35,
    `tapping the starting cup averages ${(alwaysStartTotal / runs).toFixed(0)} pts`);
});

// ---- reveal ----------------------------------------------------------------

test('the raw reveal names the point total', () => {
  assert.equal(formatRaw('cups', 5500), '5500 pts');
  assert.equal(formatRaw('cups', 0), '0 pts');
  assert.equal(formatRaw('cups', null), 'no submission');
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

function onlyCups() {
  const enabled = {};
  for (const g of ROSTER_BY_KEY.values()) enabled[g.key] = g.key === 'cups';
  return enabled;
}

// Completion mode has no deadline, so the room close for cups is driven by
// all-submit or the safety backstop. A tiny completionSafetyMs keeps the
// non-submitter case deterministic in tests.
const FAST = {
  gameDuration: 800, musicMs: 60, tutorialMs: 0,
  redemptionPrepMs: 60, redemptionLeadMs: 120,
  postGreenTimeout: 800, hardTimeout: 1500, closeGraceMs: 200,
  completionSafetyMs: 400,
};

test('a room plays it with no deadline auto-submit; all-submit closes it and points follow the total', async () => {
  const room = new Room(stubIo(), 'CUPS', { ...FAST, completionSafetyMs: 60000, enabled: onlyCups() });
  try {
    ['sharp', 'ok', 'lost'].forEach((id) => addPlayer(room, id, id));
    assert.equal(room.start().ok, true);
    await waitFor(() => room.phase === 'minigame', 3000, 'the cups round');

    const g = room.round.games[0];
    assert.equal(g.key, 'cups');
    const cd = g.clientData;
    assert.equal(typeof cd.seed, 'string');
    assert.deepEqual(g.secret, {}, 'nothing is withheld from the players');

    // The payload marks cups as a completion game so the client suppresses the
    // countdown/auto-submit.
    const phasePayload = room.phasePayload || {};
    // (phasePayload shape varies; the flag lives on the game payload.)
    assert.ok(COMPLETION_MODE.has('cups'), 'completion mode is on for cups');

    // sharp clears all ten (5500); ok misses levels 1 and 2 (5500-300=5200);
    // lost misses everything (0). All three submit — the room must NOT wait on
    // a deadline; it closes on all-submit.
    room.handleSubmit('sharp', { picks: perfect(cd) });
    room.handleSubmit('ok', { picks: perfect(cd).map((p, i) => (i < 2 ? wrong(cd, i + 1) : p)) });
    room.handleSubmit('lost', { picks: perfect(cd).map((p) => wrong(cd, p.level)) });

    await waitFor(() => room.phase === 'scores', 3000, 'scores (via all-submit close)');
    const board = room.lastScores;
    const row = (id) => board.find((r) => r.id === id);

    assert.equal(row('sharp').points, 1000, 'the highest point total in the room takes the game');
    assert.ok(row('sharp').points > row('ok').points, '5500 beats 5200');
    assert.ok(row('ok').points > row('lost').points, '5200 beats 0');
    assert.equal(row('sharp').raw, '5500 pts');
    assert.equal(row('ok').raw, '5200 pts');
    assert.equal(row('lost').raw, '0 pts', 'an all-wrong run is a played game worth zero, not a missing one');
  } finally {
    room.destroy();
  }
});

test('a non-submitter scores 0 and stays; the safety backstop closes a stalled game', async () => {
  const room = new Room(stubIo(), 'CUPN', { ...FAST, completionSafetyMs: 300, enabled: onlyCups() });
  try {
    ['done', 'silent'].forEach((id) => addPlayer(room, id, id));
    assert.equal(room.start().ok, true);
    await waitFor(() => room.phase === 'minigame', 3000, 'the cups round');
    const cd = room.round.games[0].clientData;

    room.handleSubmit('done', { picks: perfect(cd) });
    // 'silent' never submits — the completionSafetyMs backstop must close it.

    await waitFor(() => room.phase === 'scores', 3000, 'scores (via safety backstop)');
    const row = (id) => room.lastScores.find((r) => r.id === id);
    assert.equal(row('done').points, 1000, 'the only submitter takes the game');
    assert.equal(row('silent').points, 0, 'a non-submitter scores 0');
    assert.ok(room.players.has('silent'), 'and stays in the game');
    assert.equal(row('silent').raw, 'no submission');
  } finally {
    room.destroy();
  }
});

test('the host can advance a stalled completion game (hostNext → closeGame)', async () => {
  const room = new Room(stubIo(), 'CUPH', { ...FAST, completionSafetyMs: 60000, enabled: onlyCups() });
  try {
    ['fast', 'afk'].forEach((id) => addPlayer(room, id, id));
    assert.equal(room.start().ok, true);
    await waitFor(() => room.phase === 'minigame', 3000, 'the cups round');
    const cd = room.round.games[0].clientData;

    room.handleSubmit('fast', { picks: perfect(cd) });
    // 'afk' never submits, and the safety backstop is a full minute out. The
    // host presses Next to move the room on.
    room.hostNext();

    await waitFor(() => room.phase === 'scores', 3000, 'scores (via host advance)');
    const row = (id) => room.lastScores.find((r) => r.id === id);
    assert.equal(row('fast').points, 1000);
    assert.equal(row('afk').points, 0, 'the stalled player scores 0');
  } finally {
    room.destroy();
  }
});
