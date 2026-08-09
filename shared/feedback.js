// Per-turn answer feedback derivation (issue #48).
//
// Every function here takes the round's ALREADY-RENDERED prompt data (the same
// clientData the player's device already holds — never a fresh server secret)
// plus the player's own submitted turn value, and returns a small record the
// client renders after each turn and the tests assert on. No DOM, no
// randomness, no network. Keeping the logic here (not inline in games.js) lets
// the unit suite check the exact strings and correct/incorrect state against
// wrong, blank, skip, boundary, and hostile inputs.
//
// The correct answer these expose is either the prompt itself (Bisect targets,
// Dots counts, Grid Flash cells) or is trivially derivable from the rendered
// prompt (Proportion Sense area ratio, Fraction Face-Off comparison). Anagram's
// answer is a genuine server secret, so its correct value is supplied by the
// caller (from a server-authoritative per-player reveal), never derived here.

import { areaRatio } from './area.js';
import { parseValue } from './fractions.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

// Tolerances for the correct/incorrect badge on estimation games. These are
// advisory UI only — the server stays authoritative for final scoring — so the
// exact thresholds never affect a player's score, only the ✓/✗ hint.
export const BISECT_TOL = 5;      // percentage points
export const AREA_TOL = 8;        // percentage points
export const DOTS_TOL = 0.15;     // relative error
export const STOPCLOCK_TOL = 250; // milliseconds

// A blank/missed/skipped turn: the correct answer is still known, but there is
// no player answer to show and the turn is never counted correct.
function blank(correct) {
  return { your: '—', correct, ok: false, answered: false };
}

const secs = (ms) => `${(ms / 1000).toFixed(3)}s`;

// Bisect the Line — submitted position vs. requested target percentage.
export function bisectFeedback(target, guess) {
  const t = clamp(Number(target), 0, 100);
  const correct = `${Math.round(t)}%`;
  if (!isNum(guess)) return blank(correct);
  const g = clamp(guess, 0, 100);
  const off = Math.abs(g - t);
  return { your: `${Math.round(g)}%`, correct, ok: off <= BISECT_TOL, off, answered: true };
}

// Proportion Sense — submitted percentage vs. the rendered shapes' exact area
// percentage (derived from the same shared helper the server scores with).
export function areaFeedback(trial, guess) {
  const ratio = areaRatio(trial);
  const correct = Number.isFinite(ratio) ? `${Math.round(ratio)}%` : '—';
  if (!isNum(guess)) return blank(correct);
  const g = clamp(guess, 0, 100);
  const off = Number.isFinite(ratio) ? Math.abs(g - ratio) : null;
  return { your: `${Math.round(g)}%`, correct, ok: off != null && off <= AREA_TOL, off, answered: true };
}

// Dots in the Jar — submitted estimate vs. actual dot count.
export function dotsFeedback(count, guess) {
  const c = Number(count);
  const correct = Number.isFinite(c) ? String(Math.round(c)) : '—';
  if (!isNum(guess)) return blank(correct);
  const off = Number.isFinite(c) ? Math.abs(guess - c) : null;
  const ok = Number.isFinite(c) && c > 0 && off / c <= DOTS_TOL;
  return { your: String(Math.round(guess)), correct, ok, off, answered: true };
}

// Stop the Clock — measured elapsed time vs. target time for one attempt.
export function stopclockFeedback(targetMs, elapsedMs) {
  const t = Number(targetMs);
  const correct = Number.isFinite(t) ? secs(t) : '—';
  if (!isNum(elapsedMs)) return blank(correct);
  const off = Number.isFinite(t) ? Math.abs(elapsedMs - t) : null;
  return { your: secs(elapsedMs), correct, ok: off != null && off <= STOPCLOCK_TOL, off, answered: true };
}

// Grid Flash — selected cell set vs. the cells that were lit. Both are cell
// indices into the 25-cell grid; hostile/out-of-range picks are dropped the
// same way the server drops them when scoring.
export function gridflashFeedback(pattern, pick) {
  const inGrid = (c) => Number.isInteger(c) && c >= 0 && c < 25;
  const want = new Set((Array.isArray(pattern) ? pattern : []).filter(inGrid));
  const got = new Set((Array.isArray(pick) ? pick : []).filter(inGrid));
  let hit = 0;
  for (const c of want) if (got.has(c)) hit++;
  const extra = [...got].filter((c) => !want.has(c)).length;
  const answered = got.size > 0;
  return {
    your: answered ? `${hit}/${want.size} correct${extra ? `, ${extra} extra` : ''}` : '—',
    correct: `${want.size} cell${want.size === 1 ? '' : 's'} lit`,
    ok: want.size > 0 && hit === want.size && extra === 0,
    answered,
  };
}

// Fraction Face-Off — selected side/value vs. the larger side/value. Matches
// the client's own comparison (strict >, ties resolve to the right side).
export function fractionsFeedback(pair, side) {
  const left = parseValue(pair && pair.left);
  const right = parseValue(pair && pair.right);
  const bigger = left > right ? 'left' : 'right';
  const correct = String(bigger === 'left' ? pair && pair.left : pair && pair.right);
  if (side !== 'left' && side !== 'right') return { your: '—', correct, ok: false, answered: false };
  const your = String(side === 'left' ? pair.left : pair.right);
  return { your, correct, ok: side === bigger, answered: true };
}

// Anagram Rush — submitted word or skip vs. the correct word. The correct word
// is a server secret, so it is supplied by the caller (server-authoritative
// per-player reveal); if the reveal was unavailable, `answer` is null/undefined
// and the correct value is shown as unknown rather than fabricated.
export function anagramFeedback(answer, submitted) {
  const correct = typeof answer === 'string' && answer ? answer.toUpperCase() : '—';
  const norm = (s) => String(s == null ? '' : s).trim().toLowerCase();
  const has = typeof submitted === 'string' && submitted.trim().length > 0;
  if (!has) return { your: '(skipped)', correct, ok: false, answered: false };
  const ok = typeof answer === 'string' && !!answer && norm(submitted) === norm(answer);
  return { your: submitted.trim().toUpperCase(), correct, ok, answered: true };
}
