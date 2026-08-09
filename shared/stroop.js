// Pure, seeded item stream for Stroop Rush (issue #50). Every player in a round
// receives the SAME ordered sequence of color-word items and answers the INK
// colour each word is printed in — not the word itself. No Math.random(): the
// round seed fully determines the sequence, so two clients built from one seed
// see an identical stream.
//
// Accessibility (cross-refs the colourblind-accessibility issue #16 family):
// every palette entry pairs a hue with a NAME, and the answer buttons are
// labelled by that name text. The control is therefore answerable without hue
// discrimination — the guard below asserts names and hexes stay unique so the
// label text alone always distinguishes the choices.

import { seededRng } from './rng.js';

// Small, high-contrast palette. `name` is the button label text (the
// accessibility parity cue); `hex` is the ink the word is rendered in.
export const PALETTE = [
  { name: 'RED', hex: '#ff4136' },
  { name: 'BLUE', hex: '#0074ff' },
  { name: 'GREEN', hex: '#2ecc40' },
  { name: 'YELLOW', hex: '#ffdc00' },
  { name: 'PURPLE', hex: '#b10dc9' },
];

export const COLOR_NAMES = PALETTE.map((c) => c.name);

// Label-parity accessibility guard, asserted at module load: every palette
// entry must have a UNIQUE name AND a UNIQUE hex, so a colourblind player can
// always tell the buttons apart by their label text alone. A duplicate name
// would make two buttons indistinguishable without hue; a duplicate hex would
// make two inks indistinguishable. Either breaks the accessibility contract.
export function assertLabelParity(palette = PALETTE) {
  const names = new Set(palette.map((c) => c.name));
  const hexes = new Set(palette.map((c) => String(c.hex).toLowerCase()));
  if (names.size !== palette.length || hexes.size !== palette.length) {
    throw new Error('stroop PALETTE must have unique button names and hexes');
  }
  return true;
}
assertLabelParity();

// Deterministic sequence of { word, ink } items, both colour NAMES. `word` is
// the text shown; `ink` is the colour it is printed in and the correct answer.
// A majority of items are incongruent (word !== ink) — that interference is the
// whole task — with a minority left congruent so honest fast play stays natural.
// `count` is generous so a fast player never exhausts the stream in one round.
export function stroopSequence(seed, count = 120) {
  const rng = seededRng(`stroop:${seed}`);
  const items = [];
  for (let i = 0; i < count; i++) {
    const word = COLOR_NAMES[Math.floor(rng() * COLOR_NAMES.length)];
    let ink = COLOR_NAMES[Math.floor(rng() * COLOR_NAMES.length)];
    // ~75% of the time force incongruence so the printed word and its ink
    // disagree; the remaining congruent items keep the stream from feeling
    // adversarial on every single card.
    if (ink === word && rng() < 0.75) {
      const others = COLOR_NAMES.filter((n) => n !== word);
      ink = others[Math.floor(rng() * others.length)];
    }
    items.push({ word, ink });
  }
  return items;
}
