# HANDOFF — issue #89

- **Issue:** #89 — Host rejoin ignores active snapshot and strands in-progress sessions
- **Job:** amuseical-chairs issue-worker cron `bb940d093f22`
- **Repository:** `CuriosityQuantified/amuseical-chairs`
- **Lane/worktree:** `/Users/halgorithm/workspaces/games/amuseical-chairs`; throwaway feature branch required
- **Owner:** fresh Hermes continuation after Claude Code OAuth failure
- **Branch:** `feat/89-host-rejoin` (to be created by continuation)
- **Base:** `main` at `2d1356b`
- **Open PR:** none

## Blocker

Claude Code lean launch returned verified API authentication failure: HTTP 401, OAuth access token revoked. No Claude retries remain. The checkout was clean and no implementation edits were made.

## Acceptance criteria

- [ ] Restore host UI after reload in lobby, music, tutorial, minigame, reveal, scores, redemption, chairs result, and winner phases
- [ ] Restore player count and roster from the snapshot without waiting for a later broadcast
- [ ] Preserve rotated host credentials
- [ ] Add Playwright coverage for reload during at least one host-driven blocking phase and one timed phase
- [ ] No page or console errors

## Required four-phase pipeline

- [ ] Fresh implementation + CI subagent
- [ ] Fresh code-review subagent using `/Users/halgorithm/.hermes/skills/mattpocock/code-review/SKILL.md`
- [ ] Fresh code-simplifier subagent using the installed Claude plugin file, with Hermes fallback skill if absent
- [ ] Fresh read-only Claude Security subagent using the installed skill, `jobs/scan-changes.md`, and `agents/claude-security.md`

Phases must run sequentially in the shared checkout. Pass the issue body, explicit graphify project path, graph findings, repo commands, and READ CONSTRAINTS to each phase. No implementation or simplification subagent may commit, push, or create a PR. Security review is read-only.

## Known code scope and graph findings

Use graphify MCP or CLI with explicit project path `/Users/halgorithm/workspaces/games/amuseical-chairs` before coding. Relevant nodes: `public/js/host.js`; `server/sockets.js`; `server/room.js`; `Room.snapshot()` near server/room.js:L492; `attachSockets()` near server/sockets.js:L126; `enterLobbyUi()` near public/js/host.js:L78; render functions for music/tutorial/minigame/reveal/scores/redemption/chairs result/winner. Related room methods include `setPhase()`, `progressInfo()`, `playerSummaries()`, `startGame()`, `revealPayload()`, `extendTimer()`, and `hostNext()`.

## Commands and gates

- `npm ci` if needed
- `npm test`
- focused Playwright reload regressions plus `npm run test:e2e`; check page and console errors
- `npm run check`
- `npm run graph` after the last edit, then `npm run check` freshness gate
- syntax/build smoke: parse server/shared/public/js/scripts and boot `npm start`; curl `/healthz` and `/`

CI already has build, code-graph, unit, regressions, e2e, and audit jobs. Strengthen it only for this issue. Keep all existing gates.

## Git and PR rules

- Use commit author `CuriosityQuantified <curiosityquantified@gmail.com>`.
- Main Claude/Hermes continuation must commit, push, and create exactly one PR. PR title: `fix #89: Host rejoin ignores active snapshot and strands in-progress sessions`. Body must contain `Closes #89`. Target `main`.
- Do not merge in the continuation. Parent orchestrator verifies all checks fail-closed, merges only when every required check is `success`, deletes local and remote feature branches, and verifies issue #89 is closed.
- Do not use `--continue` or `--resume`.
- Use ASD-STE100 Simplified Technical English in prompts, notes, handoffs, PR text, and reports. Redact secrets.

## READ CONSTRAINTS

Do not read files larger than about 20KB in full. Use `grep -n` and `sed -n 'A,Bp'` line ranges. Never read `graphify-out/graph.json`, `graph.html`, or any graphify-out file directly.

## Ordered next actions

1. Read this handoff first. Verify it against the live checkout and `gh issue view 89`.
2. Create or verify `feat/89-host-rejoin` from current `main`; preserve this handoff until the worker has recorded its state.
3. Perform graphify understanding with explicit project path.
4. Run the four fresh sequential review/implementation phases.
5. Reconcile findings and run all local gates.
6. Refresh graphify with `npm run graph`; stage tracked graph outputs.
7. Commit and push with the required author; create exactly one PR. Do not merge.
8. If unable to finish, update this handoff with exact progress and blocker, commit/push when safe, and comment its path on issue #89.
