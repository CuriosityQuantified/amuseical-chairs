// Follow the Cup (issue #10): a ball goes under one of three to five cups, the
// cups shuffle, and you tap the one still holding it. Complete all ten levels;
// misses cost that level's weighted points but do not end the run.
//
// It is the first game on the roster that measures sustained visual TRACKING
// rather than search, and the only one whose whole state is on screen the
// entire time. That shape puts the weight in two places, and this file covers
// both:
//
//   1. The swap script has to be IDENTICAL for every player in the room and
//      derivable by the server, or two people are playing different games and
//      neither answer can be checked. shared/cups.js is that single source —
//      the client animates the plan, the server re-derives it to score.
//   2. The metric is weighted level points walked from an untrusted array.
//      the payload may be taken at face value: not the pick, not the cup index,
//      and not the level number the client claims to have been on.

import test from 'node:test';
import assert from 'node:assert/strict';
import { seededRng } from '../shared/rng.js';
import {
  CUPS_BASE_CUPS,
  CUPS_MAX_CUPS,
  CUPS_MAX_LEVELS,
  CUPS_MIN_SWAP_MS,
  CUPS_GAME_SPEED_DECAY,
  cupsLevel,
} from '../shared/cups.js';
import { Room } from '../server/room.js';
import {
  ROSTER_BY_KEY,
  MULTI_STAGE,
  NEEDS_AGGREGATION,
  buildGameData,
  computeMetric,
  formatRaw,
} from '../server/games.js';

const build = (seed = 'cups-seed') =>
  buildGameData('cups', { rng: seededRng(seed), config: {}, used: {} }).clientData;

const score = (picks, clientData) =>
  computeMetric('cups', { picks }, {}, clientData, {});
const MAX_CUPS_POINTS = 100 * CUPS_MAX_LEVELS * (CUPS_MAX_LEVELS + 1) / 2;

// A run that clears exactly `upTo` levels: the real ball position for each one,
// re-derived from the same seed the client would animate from.
const clears = (cd, upTo) =>
  [...Array(upTo)].map((_, i) => ({ level: i + 1, cupIndex: cupsLevel(cd.seed, i + 1, cd).ball }));

// The same run, then one wrong tap on the next level.
const clearsThenMiss = (cd, upTo) => {
  const plan = cupsLevel(cd.seed, upTo + 1, cd);
  return [...clears(cd, upTo), { level: upTo + 1, cupIndex: (plan.ball + 1) % plan.cups }];
};

// A full ten-level run, with optional levels deliberately answered wrong.
const plays = (cd, wrongLevels = []) => {
  const wrong = new Set(wrongLevels);
  return [...Array(cd.maxLevels)].map((_, i) => {
    const level = i + 1;
    const plan = cupsLevel(cd.seed, level, cd);
    return {
      level,
      cupIndex: wrong.has(level) ? (plan.ball + 1) % plan.cups : plan.ball,
    };
  });
};

// ---- roster wiring ---------------------------------------------------------

test('cups is a single-stage attention game scored by weighted level points', () => {
  const meta = ROSTER_BY_KEY.get('cups');
  assert.ok(meta, 'cups is on the roster');
  assert.equal(meta.category, 'attention');
  assert.equal(meta.type, 'score', 'higher correct count is better');
  assert.equal(meta.completion, 'all-levels');
  assert.equal(meta.stages, undefined, 'one payload, one completion');
  assert.ok(!MULTI_STAGE.has('cups'));
  assert.ok(!NEEDS_AGGREGATION.has('cups'),
    'the metric is per-player: nothing about it depends on the rest of the room');
});

// ---- round data ------------------------------------------------------------

test('round data is a seed and the ramp bounds — the ball is derived, never shipped', () => {
  const { clientData, secret } = buildGameData('cups', {
    rng: seededRng('shape'), config: {}, used: {},
  });
  assert.deepEqual(Object.keys(clientData).sort(), ['baseCups', 'maxLevels', 'seed', 'speedMultiplier']);
  assert.equal(clientData.baseCups, CUPS_BASE_CUPS);
  assert.equal(clientData.maxLevels, CUPS_MAX_LEVELS);
  assert.equal(typeof clientData.seed, 'string');
  assert.deepEqual(secret, {},
    'every level is derivable from the seed — a secret half would be a second copy of the same truth');
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
    // Replay the script by hand: each swap exchanges the contents of two cups.
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
  // Two identical swaps back to back read as a stutter, not a shuffle: the
  // cups return to where they were and the player learns nothing.
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
    assert.ok(plans[i].swapMs <= plans[i - 1].swapMs, `level ${i + 1}: swaps never get slower`);
  }
  assert.equal(plans[0].cups, CUPS_BASE_CUPS, 'level 1 opens at the base cup count');
  assert.equal(plans[plans.length - 1].cups, CUPS_MAX_CUPS, 'the last level is the full table');
  assert.ok(plans[plans.length - 1].swaps.length > plans[0].swaps.length * 2,
    'the top of the ramp is a materially longer shuffle');
});

test('a swap never gets faster than the eye can follow', () => {
  // Below this a crossing stops being an arc and becomes a teleport, and the
  // game turns from tracking into a coin flip. The floor is the reason the
  // ramp runs out of headroom, so it is a decision, not a detail.
  for (let level = 1; level <= CUPS_MAX_LEVELS * 3; level++) {
    const { swapMs } = cupsLevel('fast', level, {});
    assert.ok(swapMs >= CUPS_MIN_SWAP_MS,
      `level ${level}: ${swapMs}ms is under the ${CUPS_MIN_SWAP_MS}ms readable floor`);
  }
});

test('the shuffle actually moves the ball around, level over level', () => {
  // A generator that left the ball under the starting cup most of the time
  // would pass every structural test above and still be a game of "tap the
  // one you first saw".
  let moved = 0;
  const total = 200;
  for (let i = 0; i < total; i++) {
    const plan = cupsLevel(`spread-${i}`, 4, {});
    if (plan.ball !== plan.start) moved++;
  }
  assert.ok(moved > total * 0.5, `the ball leaves its starting cup most rounds (${moved}/${total})`);
});

test('the level speed is evenly linear from 400ms to 150ms', () => {
  const plans = [...Array(CUPS_MAX_LEVELS)].map((_, i) => cupsLevel('speed-ramp', i + 1, {}));
  const stepMs = (400 - 150) / (CUPS_MAX_LEVELS - 1);
  const expected = plans.map((_, i) => Math.round(400 - i * stepMs));
  assert.equal(plans[0].swapMs, 400, 'level 1 starts at 400ms');
  assert.equal(plans.at(-1).swapMs, 150, 'level 10 ends at 150ms');
  assert.deepEqual(plans.map(({ swapMs }) => swapMs), expected,
    'every level follows the same linear duration schedule');
  assert.ok(cupsLevel('speed-ramp', CUPS_MAX_LEVELS + 1, {}).swapMs >= CUPS_MIN_SWAP_MS,
    'levels beyond the ten-level run stay at the readable endpoint');
});

// ---- speedMultiplier (issue #35: 10% faster each subsequent game) ----------

test('speedMultiplier is 1.0 when cups is the first game (queueIndex 0)', () => {
  const { clientData } = buildGameData('cups', { rng: seededRng('x'), config: {}, used: {}, queueIndex: 0 });
  assert.equal(clientData.speedMultiplier, 1.0);
});

test('speedMultiplier decreases by 10% each subsequent game', () => {
  const idx1 = buildGameData('cups', { rng: seededRng('a'), config: {}, used: {}, queueIndex: 1 }).clientData.speedMultiplier;
  const idx2 = buildGameData('cups', { rng: seededRng('b'), config: {}, used: {}, queueIndex: 2 }).clientData.speedMultiplier;
  const idx5 = buildGameData('cups', { rng: seededRng('c'), config: {}, used: {}, queueIndex: 5 }).clientData.speedMultiplier;
  assert.ok(Math.abs(idx1 - 0.9) < 1e-10, `queueIndex 1 → speedMultiplier 0.9, got ${idx1}`);
  assert.ok(Math.abs(idx2 - 0.81) < 1e-10, `queueIndex 2 → speedMultiplier 0.81, got ${idx2}`);
  assert.ok(Math.abs(idx5 - 0.59049) < 1e-10, `queueIndex 5 → speedMultiplier ~0.59049, got ${idx5}`);
});

test('cupsLevel respects speedMultiplier — a later-session game has faster swaps', () => {
  const fast = cupsLevel('x', 1, { speedMultiplier: 0.9 });
  const base = cupsLevel('x', 1, { speedMultiplier: 1 });
  assert.ok(fast.swapMs < base.swapMs, `speedMultiplier 0.9 should yield faster swaps than 1`);
});

test('the floor still applies with speedMultiplier — no swap goes below CUPS_MIN_SWAP_MS', () => {
  for (let level = 1; level <= CUPS_MAX_LEVELS * 3; level++) {
    const { swapMs } = cupsLevel('floor', level, { speedMultiplier: 0.1 });
    assert.ok(swapMs >= CUPS_MIN_SWAP_MS,
      `level ${level} with speedMultiplier 0.1: ${swapMs}ms is under the ${CUPS_MIN_SWAP_MS}ms floor`);
  }
});

test('the floor test still passes with an extreme speedMultiplier', () => {
  for (let level = 1; level <= CUPS_MAX_LEVELS * 3; level++) {
    const { swapMs } = cupsLevel('extreme', level, { speedMultiplier: 0.01 });
    assert.ok(swapMs >= CUPS_MIN_SWAP_MS,
      `level ${level} with speedMultiplier 0.01: ${swapMs}ms is under the ${CUPS_MIN_SWAP_MS}ms floor`);
  }
});

test('speedMultiplier=1 is backward-compatible — cupsLevel behaves identically with and without it', () => {
  for (let level = 1; level <= CUPS_MAX_LEVELS; level++) {
    const withDefault = cupsLevel('compat', level, {});
    const withExplicit = cupsLevel('compat', level, { speedMultiplier: 1 });
    assert.deepEqual(withDefault, withExplicit, `level ${level}: speedMultiplier=1 produces the same plan as the default`);
  }
});

// ---- the scorer ------------------------------------------------------------

test('the metric awards 100 points times the level for each correct pick', () => {
  const cd = build();
  assert.equal(score(clears(cd, 0), cd), 0);
  assert.equal(score(clears(cd, 1), cd), 100);
  assert.equal(score(plays(cd), cd), MAX_CUPS_POINTS);
});

test('a miss costs that level but the player continues through the run', () => {
  const cd = build();
  const picks = plays(cd, [6]);
  assert.equal(score(picks, cd), MAX_CUPS_POINTS - 600,
    'the level-six miss costs 600 points while later levels still count');
});

test('a perfect run tops out at the level cap and cannot be pushed past it', () => {
  const cd = build();
  assert.equal(score(clears(cd, CUPS_MAX_LEVELS), cd), MAX_CUPS_POINTS);
  // 500 picks, every one of them naming a level that does not exist.
  const overrun = [
    ...clears(cd, CUPS_MAX_LEVELS),
    ...[...Array(500)].map((_, i) => ({ level: CUPS_MAX_LEVELS + i + 1, cupIndex: 0 })),
  ];
  assert.equal(score(overrun, cd), MAX_CUPS_POINTS, 'the cap is the cap');
});

test('an empty run is a real zero, not a non-submission', () => {
  // A wrong tap on level 1 and never tapping at all are the same outcome —
  // zero levels cleared — so they score the same. This is oddoneout's
  // convention (`{ cleared: 0 }` is a 0), not metronome's, and it is the right
  // one here because there is no partial credit inside a level to lose.
  const cd = build();
  assert.equal(score([], cd), 0);
  assert.equal(score(clearsThenMiss(cd, 0), cd), 0, 'missing level 1 scores the same as never trying');
});

// ---- what the server refuses to take on trust ------------------------------

test('the level number is checked, not believed', () => {
  const cd = build();
  // Every pick is genuinely correct — for the level it names. Claiming to have
  // started at level 9 does not skip the eight levels underneath it.
  const jumpStart = [9, 10, 11].map((level) => ({ level, cupIndex: cupsLevel(cd.seed, level, cd).ball }));
  assert.equal(score(jumpStart, cd), 0, 'a run that does not start at level 1 clears nothing');

  const skipped = [
    { level: 1, cupIndex: cupsLevel(cd.seed, 1, cd).ball },
    { level: 3, cupIndex: cupsLevel(cd.seed, 3, cd).ball },
  ];
  assert.equal(score(skipped, cd), 100, 'a gap in the ladder ends the walk');
});

test('replaying one cleared level does not clear the room', () => {
  const cd = build();
  const first = { level: 1, cupIndex: cupsLevel(cd.seed, 1, cd).ball };
  assert.equal(score([...Array(20)].map(() => ({ ...first })), cd), 100,
    'the second pick is judged against level 2, whatever it says it is');
});

test('a cup index outside that level\'s table is a miss, not a crash', () => {
  const cd = build();
  const plan = cupsLevel(cd.seed, 1, cd);
  for (const cupIndex of [-1, plan.cups, 99, 1.5, '0', null, undefined, NaN, Infinity, {}]) {
    assert.equal(score([{ level: 1, cupIndex }], cd), 0,
      `cupIndex ${JSON.stringify(cupIndex) ?? String(cupIndex)} ends the walk`);
  }
});

test('the ball is not under the cup a guesser would tap', () => {
  // Tapping cup 0 every time, or the cup the ball started under, has to be a
  // losing strategy across a spread of seeds — otherwise the shuffle is
  // decoration and the metric measures nothing.
  const runs = 300;
  let alwaysZero = 0;
  let alwaysStart = 0;
  for (let i = 0; i < runs; i++) {
    const cd = build(`guess-${i}`);
    alwaysZero += score([...Array(CUPS_MAX_LEVELS)].map((_, l) => ({ level: l + 1, cupIndex: 0 })), cd);
    alwaysStart += score(
      [...Array(CUPS_MAX_LEVELS)].map((_, l) => ({ level: l + 1, cupIndex: cupsLevel(cd.seed, l + 1, cd).start })),
      cd
    );
  }
  assert.ok(alwaysZero / runs < 1800, `tapping cup 0 averages ${(alwaysZero / runs).toFixed(2)} points`);
  assert.ok(alwaysStart / runs < 1800, `tapping the starting cup averages ${(alwaysStart / runs).toFixed(2)} points`);
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

test('junk inside a real run ends the walk where it appears', () => {
  const cd = build();
  const good = clears(cd, 4);
  for (const rubbish of [null, undefined, 'level 3', 5, [], { cupIndex: 0 }, { level: 3 }]) {
    const dirty = [...good.slice(0, 2), rubbish, ...good.slice(2)];
    assert.equal(computeMetric('cups', { picks: dirty }, {}, cd, {}), 300,
      `${JSON.stringify(rubbish) ?? String(rubbish)} stops the run after the first two levels without throwing`);
  }
});

// ---- reveal ----------------------------------------------------------------

test('the raw reveal names weighted points', () => {
  assert.equal(formatRaw('cups', 700), '700 pts');
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

const FAST = {
  gameDuration: 800, musicMs: 60, tutorialMs: 0,
  redemptionPrepMs: 60, redemptionLeadMs: 120,
  postGreenTimeout: 800, hardTimeout: 1500, closeGraceMs: 200,
};

test('a room waits for every player to finish all ten levels before scoring', async () => {
  const room = new Room(stubIo(), 'CUPS', { ...FAST, enabled: onlyCups() });
  try {
    ['sharp', 'ok', 'lost', 'silent'].forEach((id) => addPlayer(room, id, id));
    assert.equal(room.start().ok, true);
    await waitFor(() => room.phase === 'minigame', 3000, 'the cups round');

    const g = room.round.games[0];
    assert.equal(g.key, 'cups');
    assert.equal(g.completion, 'all-levels');
    assert.equal(g.deadline, null, 'the all-levels game has no deadline');
    assert.equal(room.timers.has('game'), false, 'the server does not start a game timer');
    const cd = g.clientData;
    assert.equal(typeof cd.seed, 'string');
    assert.deepEqual(g.secret, {}, 'nothing is withheld from the players');

    room.handleSubmit('sharp', { picks: plays(cd, [9, 10]) });
    room.handleSubmit('ok', { picks: plays(cd, [5, 6, 7, 8, 9, 10]) });
    room.handleSubmit('lost', { picks: plays(cd, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) });
    await sleep(50);
    assert.equal(room.phase, 'minigame', 'three finished players do not score before the fourth finishes');
    room.handleSubmit('silent', { picks: plays(cd, [1, 2, 3, 4, 5, 6, 7, 8]) });

    await waitFor(() => room.phase === 'scores', 3000, 'scores');
    const board = room.lastScores;
    const row = (id) => board.find((r) => r.id === id);

    assert.equal(row('sharp').raw, '3600 pts', 'levels 1–8 total 3600 points');
    assert.ok(row('sharp').points > row('silent').points, 'lower levels do not beat a late-level run');
    assert.ok(row('silent').points > row('ok').points, 'levels 9–10 beat levels 1–4');
    assert.ok(row('ok').points > row('lost').points, 'some correct levels beat none');
    assert.equal(row('lost').raw, '0 pts', 'all misses are a played game, not a missing one');
    assert.equal(row('silent').raw, '1900 pts');
    assert.ok(room.players.has('silent'), 'and stays in the game');
  } finally {
    room.destroy();
  }
});

test('the host can manually commence scoring if an untimed run stalls', async () => {
  const room = new Room(stubIo(), 'CUPD', { ...FAST, enabled: onlyCups() });
  try {
    ['deadline', 'guesser'].forEach((id) => addPlayer(room, id, id));
    assert.equal(room.start().ok, true);
    await waitFor(() => room.phase === 'minigame', 3000, 'the cups round');
    const cd = room.round.games[0].clientData;

    room.handleSubmit('deadline', { picks: plays(cd) });
    assert.equal(room.phase, 'minigame', 'one player finishing does not start scoring alone');
    room.hostNext();

    await waitFor(() => room.phase === 'scores', 3000, 'scores');
    const row = (id) => room.lastScores.find((r) => r.id === id);
    assert.equal(row('deadline').raw, '5500 pts');
    assert.equal(row('guesser').raw, 'no submission');
  } finally {
    room.destroy();
  }
});
