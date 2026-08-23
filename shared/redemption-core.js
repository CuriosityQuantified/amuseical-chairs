// Redemption round client-side state machine. See spec §5.
//
// Anti-spam is reset-on-early-press: any press before green silently redraws
// a new random delay and reschedules green from the moment of the press. The
// light stays red, no feedback of any kind. A masher continually resets their
// own light, never sees green, hits the hard timeout, and takes last place.
// (A percentage penalty alone is beatable — its expected cost is constant in
// the press rate. The 10% penalty is applied server-side ON TOP of this, to
// sting the single anticipatory press.)
//
// All timing dependencies (clock, timers, paint) are injected so the machine
// runs identically in the browser (performance.now / setTimeout / rAF) and
// under a fake clock in tests.

export function createRedemptionRun({
  initialDelay,                 // ms until first green (derived from synced server T_green)
  minDelay = 2000,
  maxDelay = 6000,
  postGreenTimeout = 10000,
  hardTimeout = 25000,
  rng = Math.random,
  now,
  setTimer,
  clearTimer,
  requestPaint,                 // cb => schedule cb(paintTimestamp) on the frame that paints green
  onState = () => {},
  onFinish,
}) {
  const paint = requestPaint || ((cb) => cb(now()));
  let state = 'red';
  let earlyPresses = 0;
  let greenAt = null;
  let finished = false;
  let greenTimer = null;
  let postTimer = null;
  let gen = 0; // invalidates in-flight paint callbacks after a reset

  const hardTimer = setTimer(() => finish('hardTimeout', null), hardTimeout);
  armGreen(Math.max(0, initialDelay));

  function armGreen(delay) {
    const g = ++gen;
    if (greenTimer != null) {
      clearTimer(greenTimer);
      greenTimer = null;
    }
    greenTimer = setTimer(() => {
      paint((ts) => {
        if (finished || g !== gen) return; // reset happened while frame was queued
        greenAt = ts != null ? ts : now();
        state = 'green';
        onState('green');
        postTimer = setTimer(() => finish('postGreenTimeout', null), postGreenTimeout);
      });
    }, delay);
  }

  function press() {
    if (finished) return;
    const t = now();
    if (state !== 'green' || t < greenAt) {
      // Early press: count it, silently reschedule green from this moment.
      // No feedback whatsoever — the light stays red.
      earlyPresses++;
      state = 'red';
      if (postTimer != null) {
        clearTimer(postTimer);
        postTimer = null;
      }
      armGreen(minDelay + rng() * (maxDelay - minDelay));
      return;
    }
    finish('ok', t - greenAt);
  }

  function finish(status, rawMs) {
    if (finished) return;
    finished = true;
    state = 'done';
    for (const t of [hardTimer, greenTimer, postTimer]) {
      if (t != null) clearTimer(t);
    }
    onFinish({ status, rawMs, earlyPresses });
  }

  return {
    press,
    get state() {
      return state;
    },
    get earlyPresses() {
      return earlyPresses;
    },
  };
}

// Server-side scoring of a redemption report. Spec §5.1/§5.2.
export function scoreRedemptionReport(
  report,
  {
    earlyPressPenalty = 0.1,
    tGreen = null,
    receivedAt = null,
    earliestArrivalSlackMs = 0,
  } = {},
) {
  if (!report || report.status === 'hardTimeout' || report.status == null) {
    return { finalMs: 999999, rawMs: null, earlyPresses: report?.earlyPresses ?? 0, status: 'hardTimeout', flagged: false };
  }
  const early = Math.max(0, Math.floor(report.earlyPresses || 0));
  if (report.status === 'postGreenTimeout') {
    return { finalMs: 10000, rawMs: null, earlyPresses: early, status: 'postGreenTimeout', flagged: false };
  }
  const raw = Number(report.rawMs);
  if (!Number.isFinite(raw) || raw < 0) {
    return { finalMs: 999999, rawMs: null, earlyPresses: early, status: 'invalid', flagged: true };
  }
  if (raw < 100) {
    // Below the human floor — macro or clock bug. Flag, don't crash.
    return { finalMs: 999999, rawMs: raw, earlyPresses: early, status: 'tooFast', flagged: true };
  }
  if (Number.isFinite(tGreen) && Number.isFinite(receivedAt)) {
    // Impossible timing: the report arrived before the green signal, or
    // before the claimed reaction time could have physically elapsed (with a
    // jitter-based slack so honest clients on imperfect sync are not burned).
    // This is a disqualification, not a warning — the pre-green forgery from
    // the Strix pentest (2026-08-22) must not be able to outrank honest play.
    const slack = Math.max(0, Number(earliestArrivalSlackMs) || 0);
    if (receivedAt < tGreen || receivedAt + slack < tGreen + raw) {
      return { finalMs: 999999, rawMs: raw, earlyPresses: early, status: 'tooFast', flagged: true };
    }
    // Physically impossible the OTHER way (Strix 2026-08-23, MED): the report
    // arrived so long after the green that the claimed reaction time could
    // not still be true — a client that waited out the round and then
    // submitted a tiny rawMs must not win the chairs round. The arrival time
    // is a hard upper bound on how long the reaction could really have been.
    if (receivedAt - tGreen > raw + 3000) {
      return { finalMs: 999999, rawMs: raw, earlyPresses: early, status: 'tooLate', flagged: true };
    }
  }
  return {
    finalMs: raw * (1 + earlyPressPenalty * early),
    rawMs: raw,
    earlyPresses: early,
    status: 'ok',
    flagged: false,
  };
}
