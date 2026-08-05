// Balance the Beam (issue #13): a hand-caught broomstick — the player drags
// anywhere and the BASE (the carriage under the pivot) follows the finger;
// the virtual hand commands the pole toward the OPPOSITE side, so the base
// shoves under a rightward fall (drag TOWARD the fall to balance it). The
// round is a pure function of the seed — shared/balance.js derives the
// escalating nudge schedule and the fixed-timestep physics, the client
// integrates it on every device identically, and the server clamps the
// reported survival time (the same trust model stopclock and slingshot run
// on). This file pins the schedule shape, the physics determinism, the
// DIRECTION CONTRACT (dragging toward a lean produces a correcting torque;
// dragging away makes it strictly worse — the regression that made the
// physics feel backwards), the scorer's clamps, and the tuning: an idle
// player must fall quickly, a reactive player must last longer, and the
// round must self-escalate so the room spreads out instead of tie-clumping.

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

// A reactive player: drags the base TOWARD the fall — steer is positive
// (right) when the pole leans right, clamped to the same ±range the client
// maps a full drag sweep to. Idle (useController = false) just recentres.
const steerTowardFall = (theta, omega) =>
  Math.max(-BALANCE_TARGET_RANGE, Math.min(BALANCE_TARGET_RANGE, 0.55 * theta + 0.9 * omega));

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
    const steer = useController ? steerTowardFall(state.theta, state.omega) : 0;
    state = balanceStep(state, BALANCE_DT, balanceControl(steer, state));
    t += BALANCE_DT * 1000;
    if (Math.abs(state.theta) > BALANCE_MAX_ANGLE) return t;
    assert.ok(
      [state.theta, state.omega].every(Number.isFinite),
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
    assert.ok([state.theta, state.omega].every(Number.isFinite),
      `non-finite at ${t}ms`);
  }
});

// ---- direction contract (the regression this file exists to pin) -----------
//
// A broomstick falls RIGHT: the hand must slide the bottom RIGHT to catch
// it. theta > 0 is a lean to the right; a rightward drag (steer > 0) must
// produce a CORRECTING torque (u < 0). The version before this fix mapped
// the drag to the pole's own target angle, so dragging right into a
// rightward fall torqued the pole further right — the backwards feel.

test('control direction: dragging toward the fall produces a correcting torque', () => {
  // Rightward lean + rightward drag → correcting (negative) torque.
  assert.ok(balanceControl(0.6, { theta: 0.3, omega: 0 }) < 0,
    'falling right, drag right → torque pushes the pole back left');
  // Leftward lean + leftward drag → correcting (positive) torque.
  assert.ok(balanceControl(-0.6, { theta: -0.3, omega: 0 }) > 0,
    'falling left, drag left → torque pushes the pole back right');
  // Dragging AWAY from the fall must be worse, never better.
  assert.ok(balanceControl(-0.6, { theta: 0.3, omega: 0 }) > 0,
    'falling right, drag left → torque pushes into the fall (wrong way is worse)');
  assert.ok(balanceControl(0.6, { theta: -0.3, omega: 0 }) < 0,
    'falling left, drag right → torque pushes into the fall (wrong way is worse)');
});

test('torque direction is physical: a correcting torque reduces |lean|', () => {
  // The physical sign of balanceStep: u > 0 accelerates a rightward lean,
  // u < 0 decelerates it. This pins the integration so a "fixed" control law
  // cannot be silently undone by a flipped step.
  const settle = (theta0, u, steps = 120) => {
    let s = { theta: theta0, omega: 0 };
    for (let i = 0; i < steps; i++) s = balanceStep(s, BALANCE_DT, u);
    return s.theta;
  };
  assert.ok(settle(0.2, -1.0) < 0.2, 'negative torque pulls a right lean back');
  assert.ok(settle(0.2, 1.0) > 0.2, 'positive torque pushes a right lean further right');
  assert.ok(settle(-0.2, 1.0) > -0.2, 'positive torque pulls a left lean back');
  assert.ok(settle(-0.2, -1.0) < -0.2, 'negative torque pushes a left lean further left');
});

test('dragging toward the fall outsurvives dragging away', () => {
  // End-to-end feel pin: the same player dragging the RIGHT way must never
  // outlive one dragging the wrong way — the backwards-physics regression
  // cannot creep back in and pass the tuning numbers.
  const playAway = (seed, durationMs = 45000) => {
    const schedule = balanceSchedule(seed, { durationMs });
    let state = balanceState();
    let t = 0;
    let n = 0;
    while (t < durationMs) {
      while (n < schedule.length && schedule[n].atMs <= t) {
        const k = schedule[n++];
        state.omega += k.impulse * k.dir;
      }
      const steer = -steerTowardFall(state.theta, state.omega); // wrong way
      state = balanceStep(state, BALANCE_DT, balanceControl(steer, state));
      t += BALANCE_DT * 1000;
      if (Math.abs(state.theta) > BALANCE_MAX_ANGLE) return t;
    }
    return durationMs;
  };
  for (const seed of ['bal-dir-0', 'bal-dir-1', 'bal-dir-2']) {
    const toward = play(seed, true);
    const away = playAway(seed);
    assert.ok(away <= toward,
      `seed ${seed}: wrong-way drag must not outlive correct drag (${away}ms vs ${toward}ms)`);
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
