// Regression tests for issue #52: prefers-reduced-motion accessibility gate.
//
// (a) motion.js helper honours the signal via override and matchMedia stub.
// (b) Seed/deadline/metric invariance: the motion signal must never reach
//     seeded content, deadlines, or scoring.
// (c) Structural guarantee: server/ and shared/ files must not import or
//     reference the motion helper.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { prefersReducedMotion, setReducedMotionOverride } from '../public/js/motion.js';
import { seededRng } from '../shared/rng.js';
import { buildGameData, computeMetric } from '../server/games.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

// ---------------------------------------------------------------------------
// (a) motion.js helper honours the signal
// ---------------------------------------------------------------------------
test('prefersReducedMotion() with no window and no override returns false', () => {
  const hadWindow = 'window' in globalThis;
  const saved = hadWindow ? globalThis.window : undefined;
  try {
    delete globalThis.window;
    setReducedMotionOverride(null);
    assert.equal(prefersReducedMotion(), false);
  } finally {
    if (hadWindow) globalThis.window = saved;
    setReducedMotionOverride(null);
  }
});

test('setReducedMotionOverride(true) makes prefersReducedMotion() return true', () => {
  try {
    setReducedMotionOverride(true);
    assert.equal(prefersReducedMotion(), true);
  } finally {
    setReducedMotionOverride(null);
  }
});

test('setReducedMotionOverride(false) makes prefersReducedMotion() return false', () => {
  try {
    setReducedMotionOverride(false);
    assert.equal(prefersReducedMotion(), false);
  } finally {
    setReducedMotionOverride(null);
  }
});

test('setReducedMotionOverride(null) reverts to environment detection', () => {
  try {
    setReducedMotionOverride(true);
    setReducedMotionOverride(null);
    // Without a window, should be false again
    const hadWindow = 'window' in globalThis;
    const saved = hadWindow ? globalThis.window : undefined;
    try {
      delete globalThis.window;
      assert.equal(prefersReducedMotion(), false);
    } finally {
      if (hadWindow) globalThis.window = saved;
    }
  } finally {
    setReducedMotionOverride(null);
  }
});

// Runs fn with globalThis.window set to a stub, then restores the original.
function withFakeWindow(stub, fn) {
  const hadWindow = 'window' in globalThis;
  const saved = hadWindow ? globalThis.window : undefined;
  try {
    globalThis.window = stub;
    fn();
  } finally {
    if (hadWindow) globalThis.window = saved;
    else delete globalThis.window;
    setReducedMotionOverride(null);
  }
}

test('prefersReducedMotion() reads matchMedia when window is present and matches', () => {
  setReducedMotionOverride(null);
  withFakeWindow(
    { matchMedia: (q) => ({ matches: q.includes('reduce') }) },
    () => assert.equal(prefersReducedMotion(), true),
  );
});

test('prefersReducedMotion() reads matchMedia when window is present and does not match', () => {
  setReducedMotionOverride(null);
  withFakeWindow(
    { matchMedia: (_q) => ({ matches: false }) },
    () => assert.equal(prefersReducedMotion(), false),
  );
});

// ---------------------------------------------------------------------------
// (b) Seed / deadline / metric invariance under the reduced-motion signal
// ---------------------------------------------------------------------------

// Simple games whose buildGameData does not require aggregation or external
// stages — safe to call directly with a fresh seededRng.
const SIMPLE_KEYS = ['cups', 'rgb', 'bisect'];

test('buildGameData output is identical regardless of reduced-motion override', () => {
  try {
    for (const key of SIMPLE_KEYS) {
      setReducedMotionOverride(false);
      const { clientData: cd1, secret: s1 } = buildGameData(key, {
        rng: seededRng('rm-fixed-seed'),
        config: {},
        used: {},
      });

      setReducedMotionOverride(true);
      const { clientData: cd2, secret: s2 } = buildGameData(key, {
        rng: seededRng('rm-fixed-seed'),
        config: {},
        used: {},
      });

      assert.deepEqual(cd1, cd2,
        `${key}: clientData differs between reduced=false and reduced=true`);
      assert.deepEqual(s1, s2,
        `${key}: secret differs between reduced=false and reduced=true`);
    }
  } finally {
    setReducedMotionOverride(null);
  }
});

test('computeMetric result is identical for cups regardless of reduced-motion override', () => {
  try {
    // Build a cups game under both signals using the same seed.
    setReducedMotionOverride(false);
    const { clientData: cd1 } = buildGameData('cups', {
      rng: seededRng('rm-metric-seed'),
      config: {},
      used: {},
    });

    setReducedMotionOverride(true);
    const { clientData: cd2 } = buildGameData('cups', {
      rng: seededRng('rm-metric-seed'),
      config: {},
      used: {},
    });

    // A valid cups payload: all picks for all levels (correct first cup = 0).
    const picks = Array.from({ length: 10 }, () => [0]);

    setReducedMotionOverride(false);
    const m1 = computeMetric('cups', { picks }, {}, cd1, {});

    setReducedMotionOverride(true);
    const m2 = computeMetric('cups', { picks }, {}, cd2, {});

    assert.equal(m1, m2,
      'computeMetric for cups differs between reduced=false and reduced=true');
  } finally {
    setReducedMotionOverride(null);
  }
});

// ---------------------------------------------------------------------------
// (c) Structural guarantee: server/ and shared/ must not reference the motion
//     helper
// ---------------------------------------------------------------------------

function walkDir(dir) {
  const results = [];
  for (const name of readdirSync(join(ROOT, dir))) {
    const abs = join(ROOT, dir, name);
    if (statSync(abs).isDirectory()) {
      results.push(...walkDir(join(dir, name)));
    } else if (name.endsWith('.js') || name.endsWith('.mjs')) {
      results.push(join(dir, name));
    }
  }
  return results;
}

const SERVER_AND_SHARED_FILES = [
  ...walkDir('server'),
  ...walkDir('shared'),
];

test('no server/ or shared/ file imports or references the motion helper', () => {
  const violations = [];
  for (const relPath of SERVER_AND_SHARED_FILES) {
    const src = readFileSync(join(ROOT, relPath), 'utf8');
    if (src.includes('/js/motion.js') || src.includes('motion.js') || src.includes('prefersReducedMotion')) {
      violations.push(relPath);
    }
  }
  assert.deepEqual(violations, [],
    `server/shared files must not import or reference the motion helper: ${violations.join(', ')}`);
});
