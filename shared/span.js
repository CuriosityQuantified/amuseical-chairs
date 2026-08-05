// Pure, seeded digit strings for Digit Span (issue #15).
//
// Cheat-mitigation decisions (both applied per issue spec):
//   1. Digits flash individually at perDigitMs cadence — no replay, no pause.
//      Transcription must keep pace with the display; errors compound.
//   2. Reverse span: players type the string BACKWARDS. A written list still
//      helps, but less, and it is a better working-memory measure anyway.
//
// The strings are deterministic from the round seed so server scoring and
// client display always agree on the same sequence without sending the seed
// down to the player (which would let a sophisticated player precompute the
// reversed answer before the flash begins).

import { seededRng } from './rng.js';

export const SPAN_START_LEN = 3;
export const SPAN_MAX_LEN = 12;
export const SPAN_PER_DIGIT_MS = 700;
export const SPAN_GAP_MS = 200;

export function spanStrings(seed, {
  startLen = SPAN_START_LEN,
  maxLen = SPAN_MAX_LEN,
} = {}) {
  const rng = seededRng(`span:${seed}`);
  const strings = [];
  for (let len = startLen; len <= maxLen; len++) {
    let value = '';
    for (let i = 0; i < len; i++) value += Math.floor(rng() * 10);
    strings.push(value);
  }
  return strings;
}

// Strip all non-digit characters so "3 2 1", "3-2-1", and "321" compare equal.
export function digitsOnly(value) {
  return typeof value === 'string' ? value.replace(/\D/g, '') : null;
}

// The correct submission for a given string under reverse-span rules.
export function expectedAnswer(original) {
  return digitsOnly(original).split('').reverse().join('');
}
