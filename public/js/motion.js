// Single detection point for the OS/browser `prefers-reduced-motion: reduce`
// signal (issue #52). Decorative, non-essential animations gate on this so
// players with vestibular sensitivity can calm the between-game avatar
// circling, tutorial loops, and finale flourishes — WITHOUT touching any
// game's seeded content, deadlines, or scoring (all of which live server-side
// and never import this module).
//
// Browser-safe (no bundler; absolute/relative imports only — this leaf module
// has none) and node-safe (guards `window`/`matchMedia`, so unit tests can
// import it). Essential motion — a game whose movement IS the mechanic, or a
// functional countdown/timer — must NOT gate on this.

const QUERY = '(prefers-reduced-motion: reduce)';

// Test/override hook: null = defer to the live media query. Tests set this to
// deterministically simulate the OS signal without a DOM.
let override = null;

export function setReducedMotionOverride(value) {
  override = value == null ? null : !!value;
}

export function prefersReducedMotion() {
  if (override !== null) return override;
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia(QUERY).matches;
}
