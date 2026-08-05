// Pure, seeded physics for Balance the Beam (issue #13).
//
// A hand-caught broomstick: the player drags anywhere and the BASE (the
// carriage under the pivot) follows the finger. The physics is a virtual
// hand on the pole — drag RIGHT (base sliding right) commands the pole
// toward the LEFT, i.e. the base shoves under a rightward fall, the way you
// move the bottom of a broomstick toward the side it is tipping to. Seeded
// nudges try to knock the pole over, and the round ends when the pole passes
// ~35° from vertical. Score = survival time.
//
// Everything here is a pure function of the round seed + elapsed time, so the
// client derives the identical nudge schedule on every device (the way
// cups/oddoneout derive their layouts) and integrates with a FIXED timestep —
// a 30fps phone and a 120Hz laptop get the same physics. No Math.random()
// anywhere in here.
//
// Direction contract (pinned by tests): theta > 0 is a lean to the RIGHT and
// a rightward drag (`steer` > 0, base sliding right) must produce a
// CORRECTING torque (u < 0) — dragging toward the fall balances it, dragging
// away makes it strictly worse. The version before this fix mapped the drag
// to the pole's own target angle, so dragging right into a rightward fall
// torqued the pole further right.
//
// This module is the single source of truth for the constants: server/games.js
// and public/js/games.js both import it (the browser via the absolute
// /shared/balance.js URL). The server sends a subset in clientData so the
// physics constants are auditable on the host screen; the client integrates
// with these exact values either way.

import { seededRng } from './rng.js';

// Fail past 35° from vertical. Generous enough that a thumb can work in,
// tight enough that "almost upright" never quietly scores a full round.
export const BALANCE_MAX_ANGLE = (35 * Math.PI) / 180;

// Physics constants, sent to every device so a room can audit them. LENGTH is
// long enough that the beam is catchable (a shorter pendulum is a reaction
// test); DAMPING makes kicks decay instead of compounding.
export const BALANCE_GRAVITY = 9.81;   // m/s²
export const BALANCE_LENGTH = 2.0;     // m
export const BALANCE_DAMPING = 2.2;    // 1/s

// The virtual hand. CTRL_K sits BELOW gravity/length on purpose: the pole is
// still genuinely unstable at rest, so holding still costs the round — the
// player has to keep correcting. CTRL_D is the hand's extra damping so a
// correction settles instead of ringing.
export const BALANCE_CTRL_K = 3.0;     // 1/s²
export const BALANCE_CTRL_D = 1.6;     // 1/s
export const BALANCE_TARGET_RANGE = 0.9; // rad — a full drag sweep maps here

// Fixed physics step in seconds. Same on every device, frame rate be damned.
export const BALANCE_DT = 1 / 120;

// Nudge schedule pacing. First kick after a short settle-in; then the
// interval shrinks and the impulse grows, so a round self-escalates: everyone
// survives the openers, and the tail eventually overwhelms even a good hand.
export const BALANCE_FIRST_NUDGE_MS = 2000;
const BALANCE_GAP_START_MS = 5200;
const BALANCE_GAP_MIN_MS = 2800;

// The escalating nudge schedule: [{ atMs, impulse, dir }], pure function of
// the round seed and duration. `impulse` is an angular-velocity kick (rad/s),
// `dir` its seeded direction. Identical on every device — that is the point.
export function balanceSchedule(seed, { durationMs = 45000 } = {}) {
  const rng = seededRng(`balance:${seed}`);
  const out = [];
  let t = BALANCE_FIRST_NUDGE_MS;
  let gap = BALANCE_GAP_START_MS;
  while (t < durationMs) {
    const progress = Math.min(1, t / durationMs);
    const impulse = 0.5 + 1.6 * Math.pow(progress, 0.8);
    out.push({ atMs: Math.round(t), impulse, dir: rng() < 0.5 ? -1 : 1 });
    gap = Math.max(BALANCE_GAP_MIN_MS, gap * 0.88) * (0.9 + rng() * 0.2);
    t += gap;
  }
  return out;
}

// One fixed-timestep of the pendulum. `u` is the control torque (rad/s²) from
// balanceControl. Pure: identical inputs always produce the identical state.
export function balanceStep(state, dt, u) {
  const theta = state.theta + state.omega * dt;
  const omega = state.omega
    + ((BALANCE_GRAVITY / BALANCE_LENGTH) * Math.sin(state.theta)
       - BALANCE_DAMPING * state.omega
       + u) * dt;
  return { theta, omega };
}

// The virtual hand. `steer` (rad, right = positive) is the drag interpreted
// as the BASE sliding right: the pole is commanded toward the OPPOSITE angle
// (the base shoving under it), so a rightward drag on a rightward lean
// produces a correcting torque — balance the fall by dragging toward it.
export function balanceControl(steer, state) {
  return BALANCE_CTRL_K * (-steer - state.theta) - BALANCE_CTRL_D * state.omega;
}

export function balanceState() {
  return { theta: 0, omega: 0 };
}
