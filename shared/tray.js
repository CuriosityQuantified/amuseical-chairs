// Pure, seeded derivation for Vanishing Tray (issue #11).
//
// The whole round — which glyphs, which slots change, and what they change to
// — is a pure function of the round seed, so the client re-derives the swapped
// tray locally (the way cups/oddoneout derive their layouts) and the server
// re-derives the same truth to score. No Math.random() anywhere in here.
//
// This module is the single source of truth for the glyph pool and the round
// derivation: server/games.js and public/js/games.js both import it (the
// browser via the absolute /shared/tray.js URL). Emoji render differently per
// platform — identity is what is scored, not appearance — so near-identical
// pairs (🙂/🙃, 🍊/🍋) and skin-tone / variation-selector families are
// excluded; the pool stays large (80) so a session's 12 items rarely repeat.

import { seededRng, shuffle, randInt } from './rng.js';

export const TRAY_GLYPHS = [
  '🍎','🍌','🍇','🍓','🍑','🍍','🥝','🥥','🍅','🥕',
  '🌽','🍔','🍕','🌮','🍩','🍪','🎂','🍰','🍫','🍬',
  '🐶','🐱','🐰','🐭','🐹','🦊','🐻','🐼','🐨','🦁',
  '🐸','🐧','🦉','🦄','🐙','🦋','🐝','🐞','🦕','🦖',
  '⚽','🏀','🏈','⚾','🎾','🏐','🎱','🏓','🥊','🎯',
  '🎸','🎹','🎺','🥁','🎤','🎧','📷','🕹️','💎','🔑',
  '🎲','🧩','🎁','🎈','🪁','🧸','👒','🎩','👑','💍',
  '⏰','⌛','🌂','☂️','🔥','⭐','🌙','☀️','❄️','⚡',
];

export const TRAY_SLOTS = 12;

// Derive the full round state from a seed: items shown, which slots changed,
// and the replacement glyphs. Pure — same seed always returns the same shape.
export function trayLevel(seed) {
  const rng = seededRng(seed);
  const pool = shuffle(rng, TRAY_GLYPHS);
  const items = pool.slice(0, TRAY_SLOTS);
  const nSwaps = randInt(rng, 2, 4);
  const slotOrder = shuffle(rng, [...Array(TRAY_SLOTS).keys()]);
  const changed = slotOrder.slice(0, nSwaps).sort((a, b) => a - b);
  const replacements = changed.map((_, i) => pool[TRAY_SLOTS + i]);
  return { items, changed, replacements };
}

// Derive the swapped tray (what the player sees in the recall phase) from the
// original items and the changed slots + replacements.
export function traySwapped(items, changed, replacements) {
  const swapped = items.slice();
  for (let i = 0; i < changed.length; i++) swapped[changed[i]] = replacements[i];
  return swapped;
}
