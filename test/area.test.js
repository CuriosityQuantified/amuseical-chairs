import test from 'node:test';
import assert from 'node:assert/strict';
import { seededRng } from '../shared/rng.js';
import { AREA_TRIAL_COUNT, areaRatio, areaTrials } from '../shared/area.js';
import {
  ROSTER_BY_KEY,
  buildGameData,
  computeMetric,
  formatRaw,
} from '../server/games.js';

const round = (seed = 'area-seed') =>
  buildGameData('area', { rng: seededRng(seed), config: { gameDuration: 45000 }, used: {} });

test('roster entry: perceptual category, error type, per-player scoring', () => {
  const game = ROSTER_BY_KEY.get('area');
  assert.ok(game, 'area is on the roster');
  assert.equal(game.name, 'Proportion Sense');
  assert.equal(game.category, 'perceptual');
  assert.equal(game.type, 'error');
  assert.equal(game.stages, undefined);
});

test('seeded trials are deterministic, varied, and secret ratios match the render', () => {
  assert.deepEqual(areaTrials('fixed'), areaTrials('fixed'));
  const { clientData, secret } = round('round-fixed');
  assert.deepEqual(round('round-fixed'), round('round-fixed'));
  assert.equal(clientData.trials.length, AREA_TRIAL_COUNT);
  assert.equal(clientData.seed, undefined, 'the generator seed is not broadcast');
  assert.deepEqual(secret.ratios, clientData.trials.map(areaRatio));
  assert.deepEqual(new Set(clientData.trials.map((t) => t.shape)), new Set(['circle', 'rect', 'triangle']));
  const ratios = secret.ratios.slice().sort((a, b) => a - b);
  assert.ok(ratios[0] < 25 && ratios.at(-1) > 75, `wide range: ${ratios}`);
  assert.ok(ratios[1] - ratios[0] > 10 && ratios[3] - ratios[2] > 10, `not clustered: ${ratios}`);
});

test('mean percentage-point error charges missing trials but declines empty sheets', () => {
  const secret = { ratios: [20, 40, 60, 80] };
  assert.equal(computeMetric('area', { guesses: [20, 40, 60, 80] }, secret), 0);
  assert.equal(computeMetric('area', { guesses: [20] }, secret), 37.5, 'three misses cost 50 each');
  assert.equal(computeMetric('area', { guesses: [30, 30, 70, 70] }, secret), 10);
  assert.equal(computeMetric('area', { guesses: [] }, secret), null);
  assert.equal(computeMetric('area', { guesses: [null, undefined, '50'] }, secret), null);
});

test('scorer clamps guesses, ignores extras, and never crashes on hostile payloads', () => {
  const secret = { ratios: [20, 40, 60, 80] };
  assert.equal(computeMetric('area', { guesses: [-10, 110, 60, 80, 0] }, secret), 20);
  for (const payload of [null, {}, { guesses: '50' }, { guesses: [NaN] }, { guesses: [{ value: 20 }] }]) {
    assert.doesNotThrow(() => computeMetric('area', payload, secret));
  }
  assert.equal(computeMetric('area', {}, secret), null);
});

test('formatRaw follows the perceptual-error display contract', () => {
  assert.equal(formatRaw('area', null), 'no submission');
  assert.equal(formatRaw('area', 12.345), '12.3 pts off');
});
