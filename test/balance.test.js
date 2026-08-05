// Balance the Beam (issue #13): a cart-pole — the player drags anywhere to
// slide the BASE under an inverted pendulum, and the base chases the falling
// pole (drag TOWARD the fall; the pole couples to base acceleration, the way
// a hand catches a broomstick). The round is a pure function of the seed —
// shared/balance.js derives the escalating nudge schedule and the
// fixed-timestep physics, the client integrates it on every device
// identically, and the server clamps the reported survival time (the same
// trust model stopclock and slingshot run on). This file pins the schedule
// shape, the physics determinism, the CART-POLE DIRECTION CONTRACT (a base
// moving in the direction of the fall catches it; the wrong way makes the
// fall strictly worse), the scorer's clamps, and the tuning: an idle player
// must fall quickly, a reactive player must last longer, and the round must
// self-escalate so the room spreads out instead of tie-clumping.

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

// A reactive player: chases the fall — targets a base position toward the
// lean and the lean's velocity (the minimal cart-pole skill), clamped to the
// same ±range the client maps a full drag sweep to. Idle (useController =
// false) just returns the base to centre.
const chaseTarget = (theta, omega) =>
  Math.max(-BALANCE_TARGET_RANGE, Math.min(BALANCE_TARGET_RANGE, 1.2 * theta + 0.35 * omega));

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
    const target = useController ? chaseTarget(state.theta, state.omega) : 0;
    state = balanceStep(state, BALANCE_DT, balanceControl(target, state));
    t += BALANCE_DT * 1000;
    if (Math.abs(state.theta) > BALANCE_MAX_ANGLE) return t;
    assert.ok(
      [state.theta, state.omega, state.x, state.v].every(Number.isFinite),
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
    assert.ok([state.theta, state.omega, state.x, state.v].every(Number.isFinite),
      `non-finite at ${t}ms`);
  }
});

// ---- cart-pole direction contract (the regression this file exists to pin) --
//
// A broomstick falls RIGHT: the hand must move RIGHT to catch it. The pole
// couples to base acceleration, so the sign of that coupling is the whole
// game — the version before this fix steered the pole's ANGLE toward the
// drag, so dragging right into a rightward fall made it fall harder.

test('control direction: the base target chases the fall, never away from it', () => {
  assert.ok(chaseTarget(0.3, 0) > 0, 'falling right → base target is to the right');
  assert.ok(chaseTarget(-0.3, 0) < 0, 'falling left → base target is to the left');
  assert.ok(chaseTarget(0.3, -0.4) > 0, 'falling right, even while swinging back, still chases right');
  assert.ok(chaseTarget(-0.3, 0.4) < 0, 'falling left, even while swinging back, still chases left');
  assert.equal(chaseTarget(0, 0), 0, 'upright and still → target is centre');
});

test('the pole couples to base acceleration the cart-pole way (regression pin)', () => {
  // A rightward base acceleration on a rightward lean must REDUCE theta
  // (catch the fall); a leftward acceleration must make it strictly worse.
  const settle = (theta0, a, steps = 120) => {
    let s = balanceState();
    s.theta = theta0;
    for (let i = 0; i < steps; i++) s = balanceStep(s, BALANCE_DT, a);
    return s.theta;
  };
  const lean = 0.2;
  assert.ok(settle(lean, 2.5) < lean, 'right accel catches a right lean');
  assert.ok(settle(lean, -2.5) > lean, 'left accel makes a right lean strictly worse');
  assert.ok(settle(-lean, -2.5) > -lean, 'left accel catches a left lean');
  assert.ok(settle(-lean, 2.5) < -lean, 'right accel makes a left lean strictly worse');
});

test('a wrong-way controller falls at least as fast as doing nothing', () => {
  // The "backwards physics" feel: steering the base AWAY from the fall must
  // never out-survive idling, so the regression cannot creep back silently.
  const playWrong = (seed, durationMs = 45000) => {
    const schedule = balanceSchedule(seed, { durationMs });
    let state = balanceState();
    let t = 0;
    let n = 0;
    while (t < durationMs) {
      while (n < schedule.length && schedule[n].atMs <= t) {
        const k = schedule[n++];
        state.omega += k.impulse * k.dir;
      }
      const target = -chaseTarget(state.theta, state.omega); // deliberately wrong way
      state = balanceStep(state, BALANCE_DT, balanceControl(target, state));
      t += BALANCE_DT * 1000;
      if (Math.abs(state.theta) > BALANCE_MAX_ANGLE) return t;
    }
    return durationMs;
  };
  for (const seed of ['bal-wrong-0', 'bal-wrong-1', 'bal-wrong-2']) {
    const idleT = play(seed, false);
    const wrongT = playWrong(seed);
    assert.ok(wrongT <= idleT + 200,
      `seed ${seed}: wrong-way control must not outlive idling (${wrongT}ms vs ${idleT}ms)`);
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
