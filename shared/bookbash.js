// Pure, seeded round derivation for Book Bash (issue #84).
// Each page has safe holes. A player selects one book position per page.
// Later pages are faster and have fewer, tighter safe holes.

import { seededRng, shuffle, randInt } from './rng.js';

export const BOOKBASH_POSITIONS = 9;
export const BOOKBASH_PAGES = 8;
const SHAPES = ['circle', 'star', 'triangle'];

export function bookBashRound(seed) {
  const rng = seededRng(seed);
  const pages = [];
  for (let page = 0; page < BOOKBASH_PAGES; page++) {
    const holeCount = Math.max(1, 4 - Math.floor(page / 2));
    const candidates = shuffle(rng, [...Array(BOOKBASH_POSITIONS).keys()]);
    const holes = candidates.slice(0, holeCount).sort((a, b) => a - b);
    pages.push({
      holes,
      shape: SHAPES[randInt(rng, 0, SHAPES.length - 1)],
      fallMs: 2600 - page * 220,
      tightness: 1 - page * 0.07,
    });
  }
  return pages;
}

export function bookBashSurvivors(pages, positions) {
  if (!Array.isArray(positions)) return 0;
  let survived = 0;
  for (let i = 0; i < pages.length; i++) {
    const position = positions[i];
    if (Number.isInteger(position) && pages[i].holes.includes(position)) survived++;
    else break;
  }
  return survived;
}
