# Reduced Motion Accessibility (issue #52)

## Detection point

`public/js/motion.js` exports `prefersReducedMotion()`, backed by
`window.matchMedia('(prefers-reduced-motion: reduce)')`. This is the single
place in the codebase that reads the OS/browser accessibility preference.
All decorative animations import and gate on this one function; no other code
reads the media query directly. The module is browser-safe (guards
`window`/`matchMedia`) and Node-safe (returns `false` when there is no DOM),
so unit tests can import it without a browser environment. A
`setReducedMotionOverride(bool|null)` hook lets tests simulate the signal
deterministically.

## Decorative animations (gated on `prefersReducedMotion()`)

| File | Animation | Reduced-motion behaviour |
|---|---|---|
| `public/js/chairs.js` `startChairs` | Between-game and redemption-wait scene: avatars circling the chair ring counter-clockwise with a walking bob | Draws one static frame with avatars evenly spaced on the ring; rAF loop does not run |
| `public/js/chairs.js` `startChairsSeated` | Round-result scene: surviving avatars walk into their chairs; eliminated player walks off and fades | Draws the final settled pose (`p=1`) once; no walk-in animation or settle-bounce |
| `public/js/tutorials.js` `startTutorialAnim` | Continuously looping DO / AVOID demo shown before each game | Steps through the same spec as static end-frames (one per step) on a `setTimeout` cycle; same labels and layout, no motion |
| `public/js/host.js` `confetti` | Falling confetti particles on the winner screen | Draws one static scattered burst; canvas removes itself after 4 s |

## Essential motion (NOT gated — motion IS the mechanic or is functional)

| Location | What | Why not gated |
|---|---|---|
| `public/js/games.js` line ~1109 | Follow the Cup shuffle animation | Movement of the cups IS the game; removing it makes the game unplayable |
| `server/games.js` line ~625 | Stop the Clock timer | Functional deadline, not decoration |
| `public/js/games.js` line ~2011 | Free-Throw ball flight | Mechanic, not flourish |
| `public/js/games.js` line ~2158 | Balance the Beam physics | Mechanic, not flourish |
| `public/js/player.js` line ~209 | Countdown readout | Functional timer |
| `public/js/host.js` line ~387 | Game timer bar | Functional timer |
| `public/js/player.js` line ~594 | `requestPaint` canvas | Game rendering loop |

## Guarantee

The reduced-motion branch is **purely presentational**. Server code
(`server/games.js` `buildGameData` / `computeMetric`), all `shared/` modules
(seed, rng, cups timing), and deadline logic never import or reference
`prefersReducedMotion`. This is enforced by two independent guardrails:

- **`scripts/check.mjs` rule 7** — static CI check that no file under
  `server/` or `shared/` imports or references the motion helper.
- **`test/reduced-motion.test.js` test (c)** — runtime assertion that reads
  every `server/` and `shared/` source and asserts the same.

Test (b) in that file additionally proves that `buildGameData` and
`computeMetric` produce byte-identical output whether the override is `false`
or `true`, using a fixed seed.
