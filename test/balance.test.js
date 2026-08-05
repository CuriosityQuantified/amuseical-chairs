// Balance the Beam (issue #13): an inverted pendulum kept upright by dragging
// its base. The round is a pure function of the seed — shared/balance.js
// derives the escalating nudge schedule and the fixed-timestep physics, the
// client integrates it on every device identically, and the server clamps the
// reported survival time (the same trust model stopclock and slingshot run
// on). This file pins the schedule shape, the physics determinism, the
// scorer's clamps, and the tuning: an idle player must fall quickly, a
// reactive player must last longer, and the round must self-escalate so the
// room spreads out instead of tie-clumping.

import test from 'node:test';
import assert from 'node:assert/strict';
import { seededRng } from '../shared/rng.js';
import {
  BALANCE_MAX_ANGLE,
  BALANCE_TARGET_RANGE,
  BALANCE_DT,
  BALANCE_FIRST_NUDGE_MS,
  BALANCE_GRAVITY,
  BALANCE_LENGTH,
  BALANCE_DAMPING,
  balanceSchedule,
  balanceStep,
  balanceControl,
  balanceState,
} from '../shared/balance.js';
import {
  ROSTER_BY_KEY,
  buildGameData,
  computeMetric,
  formatRaw,
} from '../server/games.js';

const CONFIG = { gameDuration: 45000 };

const round = (seed = 'balance-seed') =>
  buildGameData('balance', { rng: seededRng(seed), config: CONFIG, used: {} });

const score = (survivedMs, cfg = CONFIG) =>
  computeMetric('balance', { survivedMs }, {}, {}, cfg);

// A reactive player: drag opposite the lean (the minimal skill), clamped to
// the same target range the client maps a full drag sweep to.
const play = (seed, useController, durationMs = 45000) => {
  const schedule = balanceSchedule(seed, { durationMs });
  let state = balanceState();
  let t = 0;
  let n = 0;
  while (t < durationMs) {
    while (n < schedule.length && schedule[n].atMs <= t) {
      const k = schedule[n++];
      state.omega += k.impulse * k.dir;
    }
    const raw = -0.55 * state.theta - 0.9 * state.omega;
    const target = useController
      ? Math.max(-BALANCE_TARGET_RANGE, Math.min(BALANCE_TARGET_RANGE, raw))
      : 0;
    state = balanceStep(state, BALANCE_DT, balanceControl(target, state));
    t += BALANCE_DT * 1000;
    if (Math.abs(state.theta) > BALANCE_MAX_ANGLE) return t;
    assert.ok(Number.isFinite(state.theta) && Number.isFinite(state.omega),
      `seed ${seed}: physics went non-finite at ${t}ms`);
  }
  return durationMs;
};

test('roster entry: motor category, score type, per-player scoring', () => {
  const g = ROSTER_BY_KEY.get('balance');
  assert.ok(g, 'balance is on the roster');
  assert.equal(g.category, 'motor');
  assert.equal(g.type, 'score');
  assert.equal(g.name, 'Balance the Beam');
  assert.equal(g.keyboardOnly, undefined, 'pointer-drag game, not keyboard-only');
});

test('buildGameData is deterministic and carries the auditable physics constants', () => {
  assert.deepEqual(round('bal-1'), round('bal-1'));
  const { clientData, secret } = round();
  assert.ok(clientData.seed.startsWith('balance-'), `seed is namespaced, got ${clientData.seed}`);
  // The constants travel with the round so the host screen can audit them —
  // and they are the exact values the client integrates with (one source).
  assert.equal(clientData.gravity, BALANCE_GRAVITY);
  assert.equal(clientData.length, BALANCE_LENGTH);
  assert.equal(clientData.damping, BALANCE_DAMPING);
  assert.equal(clientData.nudgeEveryMs, BALANCE_FIRST_NUDGE_MS);
  assert.deepEqual(secret, {}, 'nothing to hide — the metric is survival time');
});

test('the nudge schedule is deterministic and self-escalating', () => {
  const a = balanceSchedule('bal-x', { durationMs: 45000 });
  const b = balanceSchedule('bal-x', { durationMs: 45000 });
  assert.deepEqual(a, b, 'same seed, identical schedule');
  assert.ok(a.length >= 6, `a 45s round gets a real ladder of nudges (${a.length})`);
  assert.ok(a[0].atMs >= 1000, `first kick gives the player a settle-in (${a[0].atMs}ms)`);
  for (const n of a) {
    assert.ok(n.atMs >= 0 && n.atMs < 45000, `kick ${n.atMs}ms lands inside the round`);
    assert.ok(n.impulse > 0 && Number.isFinite(n.impulse), `impulse ${n.impulse} is sane`);
    assert.ok(n.dir === -1 || n.dir === 1, `dir ${n.dir} is a seeded direction`);
  }
  assert.ok(a[a.length - 1].impulse > a[0].impulse,
    `impulse grows: ${a[0].impulse.toFixed(2)} → ${a[a.length - 1].impulse.toFixed(2)}`);
  const gaps = a.slice(1).map((n, i) => n.atMs - a[i].atMs);
  assert.ok(gaps[gaps.length - 1] < gaps[0],
    `interval shrinks: ${gaps[0]}ms → ${gaps[gaps.length - 1]}ms`);
});

test('physics step is deterministic and stable across a full round', () => {
  const s1 = balanceStep(balanceState(), BALANCE_DT, 2.0);
  const s2 = balanceStep(balanceState(), BALANCE_DT, 2.0);
  assert.deepEqual(s1, s2, 'same inputs, same state');
  // A long idle run (kicks included) must never blow up to NaN.
  let state = balanceState();
  const schedule = balanceSchedule('bal-stable', { durationMs: 45000 });
  let n = 0;
  for (let t = 0; t < 45000; t += BALANCE_DT * 1000) {
    while (n < schedule.length && schedule[n].atMs <= t) {
      state.omega += schedule[n].impulse * schedule[n].dir;
      n++;
    }
    state = balanceStep(state, BALANCE_DT, 0);
    assert.ok(Number.isFinite(state.theta) && Number.isFinite(state.omega), `non-finite at ${t}ms`);
  }
});

test('computeMetric clamps survival time to the round, treats 0 as a real score', () => {
  assert.equal(score(12345), 12345, 'mid-round fall scores as-is');
  assert.equal(score(0), 0, 'fell instantly — a real (worst) score, not a non-submission');
  assert.equal(score(45000), 45000, 'survived the full round');
  assert.equal(score(999999), 45000, 'over-round claims clamp to the deadline');
  assert.equal(score(-5), null, 'negative survival time is nonsense → non-submission');
  assert.equal(computeMetric('balance', null, {}, {}, CONFIG), null);
  assert.equal(computeMetric('balance', {}, {}, {}, CONFIG), null);
  assert.equal(computeMetric('balance', { survivedMs: 'long' }, {}, {}, CONFIG), null, 'string declines');
  assert.equal(computeMetric('balance', { survivedMs: NaN }, {}, {}, CONFIG), null, 'NaN declines');
  // A short room config clamps to its own round length, not the default.
  assert.equal(score(30000, { gameDuration: 900 }), 900);
});

test('formatRaw names the survival time', () => {
  assert.equal(formatRaw('balance', null), 'no submission');
  assert.equal(formatRaw('balance', 3500), '3.5s upright');
  assert.equal(formatRaw('balance', 0), '0.0s upright');
});

test('tuning: an idle player falls fast; a reactive player lasts longer; the round spreads', () => {
  const idleTimes = [0, 1, 2, 3, 4].map((i) => play(`bal-tune-${i}`, false));
  const ctrlTimes = [0, 1, 2, 3, 4].map((i) => play(`bal-tune-${i}`, true));
  for (let i = 0; i < idleTimes.length; i++) {
    assert.ok(idleTimes[i] < 8000,
      `seed ${i}: an idle player must fall fast (${(idleTimes[i] / 1000).toFixed(1)}s)`);
    assert.ok(ctrlTimes[i] > idleTimes[i],
      `seed ${i}: reacting must beat doing nothing (${(ctrlTimes[i] / 1000).toFixed(1)}s vs ${(idleTimes[i] / 1000).toFixed(1)}s)`);
  }
  const spread = Math.max(...ctrlTimes) - Math.min(...ctrlTimes);
  assert.ok(spread >= 3000,
    `the same skill level spreads across seeds rather than tie-clumping (${(spread / 1000).toFixed(1)}s spread)`);
  // A stronger player can make the full round on some seeds — the ceiling exists.
  const strong = [0, 1, 2].map((i) => play(`bal-strong-${i}`, true, 45000));
  assert.ok(strong.some((t) => t >= 20000),
    `an excellent run can push deep into the round (${strong.map((t) => (t / 1000).toFixed(0)).join(', ')}s)`);
});

test('hostile payloads never crash the scorer', () => {
  for (const payload of [null, undefined, 'string', 7, [], {}, { survivedMs: {} }, { survivedMs: [1] }]) {
    const m = computeMetric('balance', payload, {}, {}, CONFIG);
    assert.ok(m === null || Number.isFinite(m), `returned ${m} for ${JSON.stringify(payload)}`);
  }
});

test('the round seed derives the same schedule the client will integrate', () => {
  const { clientData } = round('bal-agree');
  const schedule = balanceSchedule(clientData.seed, { durationMs: 45000 });
  assert.ok(schedule.length > 0, 'a real round has nudges');
  assert.deepEqual(balanceSchedule(clientData.seed, { durationMs: 45000 }), schedule,
    'and the schedule is a pure function of the seed — every device plays the same one');
});
