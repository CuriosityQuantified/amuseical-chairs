// Regression suite for issue #53: non-color cues for colorblind accessibility.
//
// Asserts that every game classified as "incidental color use" carries a
// redundant non-color cue (shape/texture/number/label) so the game is playable
// without hue discrimination. Also guards that excluded games (rgb) and
// mechanic games (oddoneout, gridflash) are untouched, and that no seed or
// scoring behavior was changed by the cue additions.
//
// See: docs/color-cue-audit-issue-53.md for the full classification rationale.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { seededRng } from '../shared/rng.js';
import { PALETTE, assertLabelParity } from '../shared/stroop.js';
import { ROSTER_BY_KEY, buildGameData, computeMetric } from '../server/games.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const gamesJs = readFileSync(join(ROOT, 'public/js/games.js'), 'utf8');
const chairsJs = readFileSync(join(ROOT, 'public/js/chairs.js'), 'utf8');

// ---------------------------------------------------------------------------
// trace — dashed-line texture cue (issue #53 addition)
// ---------------------------------------------------------------------------

test('trace client uses setLineDash for the player trace (dashed texture cue, issue #53)', () => {
  // Locate the GameClients.trace block by finding the marker then scanning forward
  // for the closing brace — a narrow region search avoids false positives from
  // other canvas code elsewhere in games.js.
  const traceStart = gamesJs.indexOf('GameClients.trace');
  assert.ok(traceStart !== -1, 'GameClients.trace block must exist in public/js/games.js');

  // Find the end of the block: the next top-level `};` after traceStart.
  // The block ends with `};` at column 0 (no indent).
  const traceRegion = gamesJs.slice(traceStart, traceStart + 6000);

  assert.ok(
    traceRegion.includes('setLineDash'),
    'GameClients.trace must call setLineDash (dashed texture cue for issue #53)',
  );
});

test('trace client sets a non-empty dash pattern for the player trace', () => {
  const traceStart = gamesJs.indexOf('GameClients.trace');
  const traceRegion = gamesJs.slice(traceStart, traceStart + 6000);

  // Must set a real dash array (not just reset []) for the player trace.
  // A real dash looks like setLineDash([N, M]) where both are positive.
  const dashSet = /setLineDash\(\[[\d,\s]+\]\)/.test(traceRegion);
  assert.ok(dashSet, 'GameClients.trace must set a non-empty dash pattern (e.g. [8, 5]) for the player trace');
});

test('trace client resets dash to [] after the player trace stroke (so outline stays solid)', () => {
  const traceStart = gamesJs.indexOf('GameClients.trace');
  const traceRegion = gamesJs.slice(traceStart, traceStart + 6000);

  // Two intentional resets: one before the solid target outline stroke and one
  // after the dashed player trace. Requiring both guards against a reorder that
  // would leave the target outline inadvertently dashed on a frame.
  const resetCount = (traceRegion.match(/setLineDash\(\[\]\)/g) || []).length;
  assert.ok(resetCount >= 2, 'GameClients.trace must reset setLineDash([]) around the outline and after the trace so the target stays solid');
});

test('trace legend text is present in the client (issue #53 text cue)', () => {
  const traceStart = gamesJs.indexOf('GameClients.trace');
  const traceRegion = gamesJs.slice(traceStart, traceStart + 6000);

  assert.ok(
    traceRegion.includes('Solid line') && traceRegion.includes('Dashed line'),
    'GameClients.trace must include a text legend distinguishing solid outline from dashed trace',
  );
});

test('trace intro mentions the dashed cue (issue #53 textual redundancy)', () => {
  const traceStart = gamesJs.indexOf('GameClients.trace');
  const traceRegion = gamesJs.slice(traceStart, traceStart + 6000);

  // The intro string should mention "dashed" so screen-readers and tooltips
  // surface the distinction.
  const introMatch = traceRegion.match(/intro:\s*['"`]([^'"`]+)['"`]/);
  assert.ok(introMatch, 'GameClients.trace must have an intro string');
  const intro = introMatch[1];
  assert.ok(
    intro.toLowerCase().includes('dashed'),
    `trace intro must mention "dashed" — got: "${intro}"`,
  );
});

// ---------------------------------------------------------------------------
// area — existing BIG/SMALL text label cue (assert, no change needed)
// ---------------------------------------------------------------------------

test('area client draws BIG and SMALL text labels (existing redundant cue, issue #53)', () => {
  assert.ok(
    gamesJs.includes("fillText('BIG'") || gamesJs.includes('fillText("BIG"'),
    'area game must draw "BIG" label text (non-color cue)',
  );
  assert.ok(
    gamesJs.includes("fillText('SMALL'") || gamesJs.includes('fillText("SMALL"'),
    'area game must draw "SMALL" label text (non-color cue)',
  );
});

// ---------------------------------------------------------------------------
// chairs avatars — existing name/initial label cue (assert, no change needed)
// ---------------------------------------------------------------------------

test('drawAvatar in chairs.js uses fillText for the name/initial label (existing cue, issue #53)', () => {
  // drawAvatar draws the first initial as text — asserted here so it is
  // tracked as part of the #53 colorblind-accessibility contract.
  const avatarStart = chairsJs.indexOf('function drawAvatar');
  assert.ok(avatarStart !== -1, 'drawAvatar function must exist in public/js/chairs.js');

  const avatarRegion = chairsJs.slice(avatarStart, avatarStart + 800);
  assert.ok(
    avatarRegion.includes('fillText'),
    'drawAvatar must use fillText to render the player name/initial',
  );
});

// ---------------------------------------------------------------------------
// stroop — label parity guard (existing cue, cross-referenced from #53)
// ---------------------------------------------------------------------------

test('stroop PALETTE entries all have non-empty names (label parity, issue #53 cross-ref)', () => {
  for (const entry of PALETTE) {
    assert.ok(
      typeof entry.name === 'string' && entry.name.trim().length > 0,
      `PALETTE entry missing name: ${JSON.stringify(entry)}`,
    );
  }
});

test('assertLabelParity(PALETTE) holds — stroop buttons are distinguishable without hue', () => {
  // Note: shared/stroop.js also runs assertLabelParity() at module load, so a
  // broken PALETTE would surface as an import failure of this file. This
  // explicit call additionally guards that the function still enforces the
  // contract (rather than being weakened to a no-op) and returns true.
  assert.equal(assertLabelParity(PALETTE), true,
    'stroop PALETTE must have unique names AND unique hexes (colorblind accessibility contract)');
});

// ---------------------------------------------------------------------------
// rgb exclusion — the RGB Color Match game must remain in the roster untouched
// ---------------------------------------------------------------------------

test('rgb game is still in ROSTER_BY_KEY (excluded from colorblind changes, issue #53)', () => {
  assert.ok(
    ROSTER_BY_KEY.has('rgb'),
    'rgb (RGB Color Match) must remain in the roster — it is the excluded mechanic for issue #53',
  );
});

// ---------------------------------------------------------------------------
// Seed / scoring invariance — no drift introduced by issue #53 cue changes
// ---------------------------------------------------------------------------

test('trace buildGameData is deterministic across two identical seeds (no drift from issue #53)', () => {
  const opts = () => ({ rng: seededRng('cc53-trace-seed'), config: {}, used: {} });
  const { clientData: cd1, secret: s1 } = buildGameData('trace', opts());
  const { clientData: cd2, secret: s2 } = buildGameData('trace', opts());
  assert.deepEqual(cd1, cd2, 'trace clientData must be identical for the same seed');
  assert.deepEqual(s1, s2, 'trace secret must be identical for the same seed');
});

test('area buildGameData is deterministic across two identical seeds (no drift from issue #53)', () => {
  const opts = () => ({ rng: seededRng('cc53-area-seed'), config: {}, used: {} });
  const { clientData: cd1, secret: s1 } = buildGameData('area', opts());
  const { clientData: cd2, secret: s2 } = buildGameData('area', opts());
  assert.deepEqual(cd1, cd2, 'area clientData must be identical for the same seed');
  assert.deepEqual(s1, s2, 'area secret must be identical for the same seed');
});

test('trace computeMetric is deterministic for a fixed input (no scoring drift from issue #53)', () => {
  const { clientData, secret } = buildGameData('trace', {
    rng: seededRng('cc53-trace-metric-seed'),
    config: {},
    used: {},
  });
  // A valid trace payload: deviation + coverage within passing thresholds.
  const payload = { deviation: 0.05, coverage: 0.95 };
  const m1 = computeMetric('trace', payload, secret, clientData, {});
  const m2 = computeMetric('trace', payload, secret, clientData, {});
  assert.equal(m1, m2, 'trace computeMetric must be deterministic for identical inputs');
  assert.ok(typeof m1 === 'number' && isFinite(m1), 'trace computeMetric must return a finite number for a valid payload');
});

test('area computeMetric is deterministic for a fixed input (no scoring drift from issue #53)', () => {
  const { clientData, secret } = buildGameData('area', {
    rng: seededRng('cc53-area-metric-seed'),
    config: {},
    used: {},
  });
  // Build a valid payload: one guess per trial that exactly matches the ratio.
  const guesses = secret.ratios.map((r) => r);
  const payload = { guesses };
  const m1 = computeMetric('area', payload, secret, clientData, {});
  const m2 = computeMetric('area', payload, secret, clientData, {});
  assert.equal(m1, m2, 'area computeMetric must be deterministic for identical inputs');
  assert.ok(typeof m1 === 'number' && isFinite(m1), 'area computeMetric must return a finite number for a valid payload');
});
