// Pure, seeded word stream for Anagram Rush (issue #16). The server keeps the
// intended answers private; clients receive only these scrambled render strings.
// No Math.random(): the same round seed always produces the same ordered stream.

import { seededRng } from './rng.js';

const WORDS_BY_LENGTH = {
  4: ['mint', 'lamp', 'frog', 'ship', 'wave'],
  5: ['bread', 'tiger', 'plant', 'music', 'smile'],
  6: ['planet', 'garden', 'winter', 'monkey', 'castle'],
  7: ['journey', 'crystal', 'thunder', 'blanket', 'anagram'],
  8: ['notebook', 'elephant', 'mountain', 'painting', 'sunshine'],
};

const letters = (value) => [...String(value).toLowerCase()].sort().join('');

// A cyclic shift is effectively the original word with its first few letters
// moved to the end, too close to count as a real scramble.
export function isTrivialRotation(scramble, word) {
  const a = String(scramble).toLowerCase();
  const b = String(word).toLowerCase();
  return a.length === b.length && (b + b).includes(a);
}

export function scrambleWord(word, rng) {
  const chars = [...word];
  for (let attempt = 0; attempt < 24; attempt++) {
    const candidate = chars.slice();
    for (let i = candidate.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [candidate[i], candidate[j]] = [candidate[j], candidate[i]];
    }
    const scrambled = candidate.join('');
    if (!isTrivialRotation(scrambled, word)) return scrambled;
  }

  // A seeded shuffle could repeatedly pick an unlucky rotation. Pick the first
  // non-rotation swap deterministically instead; our word list has no all-one-
  // letter entries, so this always gives the player a genuine anagram.
  for (let i = 0; i < chars.length; i++) {
    for (let j = i + 1; j < chars.length; j++) {
      if (chars[i] === chars[j]) continue;
      const candidate = chars.slice();
      [candidate[i], candidate[j]] = [candidate[j], candidate[i]];
      const scrambled = candidate.join('');
      if (!isTrivialRotation(scrambled, word)) return scrambled;
    }
  }
  throw new Error(`cannot scramble ${word}`);
}

// Returns easy-to-hard words: five each at four through eight letters. The
// answer stays in the server-only secret; callers should send just `scramble`.
export function anagramRounds(seed, count = 25) {
  const rng = seededRng(`anagram:${seed}`);
  const used = new Map();
  const rounds = [];
  for (let index = 0; index < count; index++) {
    const length = 4 + Math.min(4, Math.floor(index / 5));
    const words = WORDS_BY_LENGTH[length];
    const seen = used.get(length) || new Set();
    const choices = words.filter((word) => !seen.has(word));
    const pool = choices.length ? choices : words;
    const word = pool[Math.floor(rng() * pool.length)];
    seen.add(word);
    used.set(length, seen);
    rounds.push({ word, scramble: scrambleWord(word, rng).toUpperCase() });
  }
  return rounds;
}

// Test-harness helper: a bot has only the rendered scramble, just like a
// player. The browser never imports this lookup; it is not an answer sent in
// clientData. The curated list deliberately contains one intended solution per
// letter set so alternate real-word anagrams are not silently rejected.
export function solveScramble(scramble) {
  const signature = letters(scramble);
  for (const words of Object.values(WORDS_BY_LENGTH)) {
    const answer = words.find((word) => letters(word) === signature);
    if (answer) return answer;
  }
  return null;
}
