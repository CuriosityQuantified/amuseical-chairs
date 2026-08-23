// Issue #46 regression suite — Follow the Cup: ten-level linear timing &
// completion scoring. This is the named suite the CI "regressions" job runs for
// this area. It nails down the acceptance criteria of #46 specifically, so a
// future change that reintroduces the old level-count metric, the #35 speed
// decay, the run-ending miss, or a 12-level ramp fails here loudly:
//
//   - exactly ten levels
//   - exact per-level swap durations [400,372,344,317,289,261,233,206,178,150],
//     endpoints exactly 400 and 150, every rounded intermediate value
//   - a perfect ten-run scores 5500
//   - 100·level scored INDEPENDENTLY: a miss costs only that level's points and
//     does not stop later levels from scoring
//   - hostile/forged payloads earn no credit and never abort the scan
//   - completion-mode room close (all-submit, safety backstop, host advance)

import test from 'node:test';
import assert from 'node:assert/strict';
import { seededRng } from '../shared/rng.js';
import {
  CUPS_MAX_LEVELS,
  CUPS_FIRST_SWAP_MS,
  CUPS_LAST_SWAP_MS,
  cupsSwapMs,
  cupsLevel,
} from '../shared/cups.js';
import { Room } from '../server/room.js';
import {
  ROSTER_BY_KEY,
  COMPLETION_MODE,
  buildGameData,
  computeMetric,
  formatRaw,
} from '../server/games.js';

const EXPECTED_MS = [400, 372, 344, 317, 289, 261, 233, 206, 178, 150];
const PERFECT_SCORE = 5500;

const build = (seed = 'reg-seed') =>
  buildGameData('cups', { rng: seededRng(seed), config: {}, used: {} }).clientData;
const score = (picks, cd) => computeMetric('cups', { picks }, {}, cd, {});
const correct = (cd, level) => ({ level, cupIndex: cupsLevel(cd.seed, level, cd).ball });
const wrong = (cd, level) => {
  const plan = cupsLevel(cd.seed, level, cd);
  return { level, cupIndex: (plan.ball + 1) % plan.cups };
};
const perfect = (cd) => [...Array(CUPS_MAX_LEVELS)].map((_, i) => correct(cd, i + 1));

test('#46: exactly ten levels', () => {
  assert.equal(CUPS_MAX_LEVELS, 10);
  assert.equal(build().maxLevels, 10);
});

test('#46: the ten exact swap durations, endpoints, and every rounded value', () => {
  assert.equal(EXPECTED_MS.length, 10);
  // Independently recompute the formula the spec fixes: round(400 - (L-1)*250/9).
  for (let level = 1; level <= 10; level++) {
    const expected = Math.round(400 - (level - 1) * 250 / 9);
    assert.equal(expected, EXPECTED_MS[level - 1], `formula check level ${level}`);
    assert.equal(cupsSwapMs(level), EXPECTED_MS[level - 1], `cupsSwapMs level ${level}`);
    assert.equal(cupsLevel('seed-a', level, {}).swapMs, EXPECTED_MS[level - 1],
      `cupsLevel level ${level} swapMs`);
  }
  assert.equal(cupsSwapMs(1), 400);
  assert.equal(cupsSwapMs(1), CUPS_FIRST_SWAP_MS);
  assert.equal(cupsSwapMs(10), 150);
  assert.equal(cupsSwapMs(10), CUPS_LAST_SWAP_MS);
});

test('#46: swap durations are seed-independent across many seeds', () => {
  for (const seed of ['x', 'y', 'z', 'room-1:g1:cups', 'room-2:g4:cups']) {
    for (let level = 1; level <= 10; level++) {
      assert.equal(cupsLevel(seed, level, {}).swapMs, EXPECTED_MS[level - 1]);
    }
  }
});

test('#46: a perfect ten-level run scores 5500', () => {
  for (const seed of ['p1', 'p2', 'p3']) {
    const cd = build(seed);
    assert.equal(score(perfect(cd), cd), PERFECT_SCORE);
  }
});

test('#46: each correct level adds 100·level independently', () => {
  const cd = build();
  for (let level = 1; level <= 10; level++) {
    const picks = perfect(cd).map((p, i) => (i + 1 === level ? p : wrong(cd, i + 1)));
    assert.equal(score(picks, cd), 100 * level, `only level ${level} correct → ${100 * level}`);
  }
});

test('#46: a wrong level in the middle does NOT stop later levels from scoring', () => {
  const cd = build();
  // Miss level 3 only.
  const picks = perfect(cd).map((p, i) => (i + 1 === 3 ? wrong(cd, 3) : p));
  assert.equal(score(picks, cd), PERFECT_SCORE - 300, '5500 - 300 = 5200');
});

test('#46: a high-level miss costs only its own (large) point value', () => {
  const cd = build();
  const picks = perfect(cd).map((p, i) => (i + 1 === 10 ? wrong(cd, 10) : p));
  assert.equal(score(picks, cd), PERFECT_SCORE - 1000, 'missing level 10 costs 1000');
});

test('#46: empty run is a real zero; non-array is a non-submission', () => {
  const cd = build();
  assert.equal(score([], cd), 0);
  assert.equal(computeMetric('cups', { picks: null }, {}, cd, {}), null);
  assert.equal(computeMetric('cups', 'nope', {}, cd, {}), null);
});

test('#46: hostile payloads — forged high level, mislabels, junk, overrun', () => {
  const cd = build();
  // Forged level 10 in position 1 → checked vs level 1's ball → 0.
  assert.equal(score([{ level: 10, cupIndex: cupsLevel(cd.seed, 10, cd).ball }], cd), 0);
  // Every entry lies about its level → 0, scan does not abort.
  assert.equal(score(perfect(cd).map((p) => ({ ...p, level: p.level + 1 })), cd), 0);
  // Junk at position 3 only costs level 3.
  for (const rubbish of [null, undefined, 'x', 5, [], { cupIndex: 0 }, { level: 3 }, NaN, Infinity]) {
    const picks = perfect(cd).map((p, i) => (i === 2 ? rubbish : p));
    assert.equal(computeMetric('cups', { picks }, {}, cd, {}), PERFECT_SCORE - 300,
      `${JSON.stringify(rubbish) ?? String(rubbish)} at slot 3 only costs 300`);
  }
  // 500-entry overrun still caps at 5500.
  const overrun = [...perfect(cd), ...[...Array(500)].map((_, i) => ({ level: 11 + i, cupIndex: 0 }))];
  assert.equal(score(overrun, cd), PERFECT_SCORE);
});

test('#46: out-of-range cup index earns no credit and does not crash', () => {
  const cd = build();
  for (const cupIndex of [-1, 99, 1.5, '0', null, undefined, NaN, Infinity, {}]) {
    const picks = perfect(cd).map((p, i) => (i === 0 ? { level: 1, cupIndex } : p));
    assert.equal(score(picks, cd), PERFECT_SCORE - 100);
  }
});

test('#46: formatRaw renders a point total', () => {
  assert.equal(formatRaw('cups', 5500), '5500 pts');
  assert.equal(formatRaw('cups', 0), '0 pts');
  assert.equal(formatRaw('cups', null), 'no submission');
});

test('#46: cups is registered as a completion-mode game', () => {
  assert.ok(COMPLETION_MODE.has('cups'));
  assert.equal(ROSTER_BY_KEY.get('cups').type, 'score');
});

// ---- completion-mode room close --------------------------------------------

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
function addPlayer(room, id) {
  room.players.set(id, {
    id, name: id, socketId: `sock-${id}`, connected: true,
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

function cupsRoom(code, overrides = {}) {
  // cups is in COMPETITIVE_CLIENT_SCORING_DISABLED (Strix 2026-08-23: the
  // seed-derivable answer is forgeable), so these unit tests opt in through
  // the server/constructor test flag.
  return new Room(stubIo(), code, { ...FAST, completionSafetyMs: 60000, enabled: onlyCups(), ...overrides }, undefined, { allowClientScoredCompetitive: true });
}

test('#46: room closes on all-submit with no deadline; points follow the total', async () => {
  const room = cupsRoom('RG01');
  try {
    ['a', 'b'].forEach((id) => addPlayer(room, id));
    assert.equal(room.start().ok, true);
    await waitFor(() => room.phase === 'minigame', 3000, 'cups round');
    const cd = room.round.games[0].clientData;
    room.handleSubmit('a', { picks: perfect(cd) });
    room.handleSubmit('b', { picks: perfect(cd).map((p, i) => (i + 1 === 5 ? wrong(cd, 5) : p)) });
    await waitFor(() => room.phase === 'scores', 3000, 'scores via all-submit');
    const row = (id) => room.lastScores.find((r) => r.id === id);
    assert.equal(row('a').raw, '5500 pts');
    assert.equal(row('b').raw, `${PERFECT_SCORE - 500} pts`);
    assert.ok(row('a').points > row('b').points);
  } finally {
    room.destroy();
  }
});

test('#46: a non-submitter cannot hang the room — safety backstop closes it, scores 0', async () => {
  const room = cupsRoom('RG02', { completionSafetyMs: 300 });
  try {
    ['done', 'silent'].forEach((id) => addPlayer(room, id));
    assert.equal(room.start().ok, true);
    await waitFor(() => room.phase === 'minigame', 3000, 'cups round');
    const cd = room.round.games[0].clientData;
    room.handleSubmit('done', { picks: perfect(cd) });
    await waitFor(() => room.phase === 'scores', 3000, 'scores via backstop');
    const row = (id) => room.lastScores.find((r) => r.id === id);
    assert.equal(row('done').points, 1000);
    assert.equal(row('silent').points, 0);
    assert.equal(row('silent').raw, 'no submission');
    assert.ok(room.players.has('silent'));
  } finally {
    room.destroy();
  }
});

test('#46: host advance closes a stalled completion game before the backstop', async () => {
  const room = cupsRoom('RG03');
  try {
    ['fast', 'afk'].forEach((id) => addPlayer(room, id));
    assert.equal(room.start().ok, true);
    await waitFor(() => room.phase === 'minigame', 3000, 'cups round');
    const cd = room.round.games[0].clientData;
    room.handleSubmit('fast', { picks: perfect(cd) });
    room.hostNext();
    await waitFor(() => room.phase === 'scores', 3000, 'scores via host advance');
    const row = (id) => room.lastScores.find((r) => r.id === id);
    assert.equal(row('fast').points, 1000);
    assert.equal(row('afk').points, 0);
  } finally {
    room.destroy();
  }
});
