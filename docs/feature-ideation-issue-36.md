# Feature ideation & application review — issue #36

**Review date:** 2026-08-09
**Issue:** [#36 — Review and ideate new features and functionality](https://github.com/CuriosityQuantified/amuseical-chairs/issues/36)
**Scope of this document:** an auditable record of the application review that
produced the child feature issues. No application features are implemented here;
this file plus the child GitHub issues are the deliverable.

## Methodology

1. **Graphify-first understanding.** Read the committed knowledge graph via the
   graphify CLI (`god-nodes`, `GRAPH_REPORT.md`) with the explicit project path,
   then validated every finding against source slices — never full-file reads of
   the large modules (`server/games.js`, `public/js/games.js`,
   `public/js/tutorials.js`). Graph scale sanity-checked against
   `graphify-out/GRAPH_REPORT.md`: 511 nodes · 1179 edges · 35 communities; god
   nodes `Room`, `seededRng()`, `buildGameData()`, `computeMetric()`,
   `attachSockets()`.
2. **Issue-inventory dedup.** Enumerated every issue (open + closed) via `gh`
   before drafting, so nothing duplicates shipped or rejected work.
3. **Scope discipline.** Cross-checked every idea against the README's explicit
   "Out of scope (by design)" list and the repo's static-check invariants
   (`scripts/check.mjs`).

## Architecture summary (as reviewed)

- Node 20 + Express + Socket.IO; vanilla JS + Canvas client, no build step.
  All state in memory, no database; sessions are ephemeral by design.
- **Roster:** 20 games (`server/games.js` ROSTER ~L214–234) across 8 category
  labels. Server builds seeded round content (`buildGameData`), scores it
  (`computeMetric`), and formats the raw metric (`formatRaw`) — the same seed
  server-side gives every player an identical configuration.
- **Category balance (verified count):** perceptual 5, motor 4, social 3,
  timing 2, numerical 2, memory 2, **language 1** (Anagram Rush, default OFF),
  **attention 1** (Follow the Cup). Language and attention are the clearly
  underserved categories.
- **Engine features:** multi-stage games (Caption Battle, Icebreaker), animated
  looping tutorials, a pinned live leaderboard, a musical-chairs elimination
  finale, server-side moderation (`shared/textclean.js` + host hide), and
  anti-cheat (clock sync, CIEDE2000 color scoring, in-order metronome taps,
  keyup-gated mashing).
- **Host surface (deliberately tiny):** minigame duration + per-game toggles +
  solo-test, all **lobby-only**, allowlist-enforced across `public/host.html`,
  `scripts/check.mjs`, and `HOST_EDITABLE_CONFIG` in `server/room.js`.
- **Adding a game is multi-file & checked:** ROSTER + `GameClients.<key>` +
  `TUTORIALS.<key>` + a `test/<game>.test.js` + 20-bot harness wiring, with
  `scripts/check.mjs` failing if any surface disagrees.

### Out of scope (by design) — honored by every proposal

Accounts, persistence, cross-session leaderboards, native apps, spectators,
anything requiring pre-gathered player data, and any turn-based mechanic. No
child issue crosses these lines.

## Child issues created

Each was filed as a separate, self-contained GitHub issue with problem,
proposed behavior, acceptance criteria, non-goals, testing/CI, dependencies, and
a scope note.

| # | Title | Category | Rationale (one line) |
|---|-------|----------|----------------------|
| (games) | | | |
| [#50](https://github.com/CuriosityQuantified/amuseical-chairs/issues/50) | New minigame: Stroop Rush (attention) | game | Fills the thin `attention` category (only Follow the Cup today). |
| [#51](https://github.com/CuriosityQuantified/amuseical-chairs/issues/51) | New minigame: Word Hunt (language) | game | Gives the `language` category real presence; Anagram Rush is the only one and ships default-off. Filed default-OFF for #16 parity. |
| (non-game) | | | |
| [#52](https://github.com/CuriosityQuantified/amuseical-chairs/issues/52) | Accessibility: honor `prefers-reduced-motion` across games, tutorials, finale | a11y | Zero reduced-motion handling exists today; canvas motion is everywhere. |
| [#53](https://github.com/CuriosityQuantified/amuseical-chairs/issues/53) | Accessibility: non-color cues for games where color is incidental (colorblind) | a11y | Redundant cues where hue is a labeling choice; RGB Color Match explicitly excluded (color is its mechanic). |
| [#54](https://github.com/CuriosityQuantified/amuseical-chairs/issues/54) | Allow players to join a session already in progress | engine/UX | `Room.join` hard-blocks post-lobby (`server/room.js:227`); scoring already tolerates missed games. |
| [#55](https://github.com/CuriosityQuantified/amuseical-chairs/issues/55) | Host mid-session controls: skip current game & extend active timer | host UX | The host has no live lever during a game. NB: these are mid-game *actions*, not lobby config keys — they must NOT go through `HOST_EDITABLE_CONFIG` (`server/room.js:110`, currently `{gameDuration, enabled}`) or the rule-6 config-grid allowlist, which govern lobby-only config. |

## Open decisions carried into the child issues

- **Word Hunt default state (issue B).** The draft leans toward default-ON to
  give `language` real presence. This cuts against the established precedent:
  Anagram Rush (#16) shipped **default-OFF** on the fairness rationale that a
  language task disadvantages non-native English speakers in a mixed meeting.
  A shared-grid word search has the same fairness profile. Recommendation:
  file issue B as **default-OFF for parity with #16**, and raise default-ON only
  as an explicit, separately-argued option — do not assert it as the default.
- **Stroop Rush color a11y (issue A).** The label-parity guard (ink color also
  named by the button label) is what keeps the game answerable without hue
  discrimination; it is load-bearing, not optional, and cross-references D.

## Explicitly rejected / merged ideas (and why)

- **Visual metronome for Metronome Blackout** — REJECTED as a duplicate: the
  game already flashes a visual beat independent of sound
  (`public/js/games.js` ~L668, "beat flashes whether or not a sound came out").
- **Spectator / watch-only mode** — REJECTED: spectators are explicitly out of
  scope. (The late-join issue E deliberately admits latecomers as *players*, not
  spectators.)
- **Cross-session leaderboards / accounts / stats history** — REJECTED: out of
  scope (no persistence; sessions ephemeral by design).
- **Reverse Digit Span-style memory game** — REJECTED: Digit Span was removed
  (#34) over an unresolved cheat surface; re-adding a similar mechanic would
  reopen settled ground.
- **Colorblind support for RGB Color Match specifically** — MERGED into issue D
  as an explicit non-goal: matching a target color via CIEDE2000 is the game
  itself and cannot be made hue-free.
- **Turn-based / party word games (e.g. pass-and-play)** — REJECTED: any
  turn-based mechanic is out of scope; every proposed game stays simultaneous +
  seeded.

## Notes for implementers

- Every new game must keep round content seeded (no `Math.random()` in
  server/shared content paths — `scripts/check.mjs` rule) and must be wired into
  the 20-bot harness.
- Issue F's skip/extend are mid-game host-only *actions* (socket events), not
  lobby config keys — they must NOT be added to `HOST_EDITABLE_CONFIG` or the
  rule-6 `cfg-*` allowlist. (Only a genuine new *lobby config* control needs the
  three-surface allowlist change — `public/host.html`/`host.js` +
  `scripts/check.mjs` + `HOST_EDITABLE_CONFIG` — or `npm run check` fails.)
- After any code change, refresh the graph: `npm run graph` then `npm run check`.
