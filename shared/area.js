// Pure seeded rounds for Proportion Sense (issue #17).
//
// Each trial compares two similar shapes. Their displayed linear sizes are
// derived from a ratio whose square is the true area percentage, so the server
// can score exactly what the player saw. The round seed stays server-side;
// clients receive only the four shapes they must render.

import { seededRng } from './rng.js';

export const AREA_TRIAL_COUNT = 4;

const RATIOS = [18, 37, 63, 82];
const SHAPES = ['circle', 'rect', 'triangle'];

function shuffled(rng, values) {
  const out = values.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// The ratio is derivable from the rendered dimensions, which is unavoidable
// for a visual-area game. Keep this helper shared so harness bots and tests
// calculate the same answer without receiving the server secret.
export function areaRatio(trial) {
  if (!trial || !Number.isFinite(trial.bigSize) || !Number.isFinite(trial.smallSize)
    || trial.bigSize <= 0 || trial.smallSize < 0) return NaN;
  return (trial.smallSize / trial.bigSize) ** 2 * 100;
}

// Four trials span the range instead of clustering around 50. Every round has
// circles, rectangles, and triangles; the fourth type and all ordering are
// seeded, so identical seeds render identically on every device.
export function areaTrials(seed, { count = AREA_TRIAL_COUNT } = {}) {
  const rng = seededRng(`area:${seed}`);
  const ratios = shuffled(rng, RATIOS);
  const shapes = shuffled(rng, [...SHAPES, SHAPES[Math.floor(rng() * SHAPES.length)]]);
  return [...Array(count)].map((_, index) => {
    const ratio = ratios[index % ratios.length];
    const bigSize = 120;
    return {
      shape: shapes[index % shapes.length],
      bigSize,
      smallSize: bigSize * Math.sqrt(ratio / 100),
    };
  });
}
