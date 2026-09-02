# Handoff — issue #90

- **Issue:** #90 — Player reconnect during Musical Chairs cannot restore the reaction UI
- **Repository:** `CuriosityQuantified/amuseical-chairs`
- **Job/lane owner:** amuseical-chairs issue-worker cron `bb940d093f22`; branch lane `fix/90-redemption-rejoin`
- **Worktree:** `/Users/halgorithm/workspaces/games/amuseical-chairs`
- **Branch:** `fix/90-redemption-rejoin`
- **Base:** `main` at `38f0f46` (`fix #91: Skipping music leaves a stale timer...`)
- **Open PR:** none

## State

No implementation changes were made. The first Claude Code launch stopped after one turn because authentication failed:
`401 OAuth access token has been revoked`.

The issue remains open. No acceptance criterion is complete.

## Required work

1. Verify issue #90 is still open and no open PR covers it.
2. Use graphify MCP with explicit `project_path=/Users/halgorithm/workspaces/games/amuseical-chairs`; do not read `graphify-out/*` directly.
3. Run four separate fresh Claude Agent/Task phases sequentially in this shared checkout:
   - implementation + CI, write access, no commit/push/PR
   - code review using `/Users/halgorithm/.hermes/skills/mattpocock/code-review/SKILL.md`
   - code simplification using the installed code-simplifier skill, fallback to the Hermes skill
   - read-only Claude Security review using the installed skill and `jobs/scan-changes.md`
4. Restore player Musical Chairs redemption state on reconnect before and after `redemption:go`, without weakening server-authoritative timing or causing duplicate reports.
5. Add two-player browser/integration regression coverage, including no page/console/request errors.
6. Keep CI stronger. Current workflow has build, code-graph, unit, regressions, e2e, and audit jobs.
7. Run local gates: `npm test`, relevant `npm run test:e2e`, `npm run check`, `npm run graph`, and build/smoke syntax checks.
8. Commit as `CuriosityQuantified <curiosityquantified@gmail.com>`, push, and create exactly one PR titled `fix #90: Player reconnect during Musical Chairs cannot restore the reaction UI` with `Closes #90`. Do not merge in the worker.

## Graph findings already collected

- `server/room.js`: `Room.snapshot()` around L494; redemption state starts around L1215; `redemption:go` is emitted around L1240; chairs result begins around L1321.
- `public/js/player.js`: `applySnapshot()` around L107; phase handling around L515; `prepareRedemption()` around L591; `redemption:go` handler around L619; `state.redemption` is initialized only by `prepareRedemption()`.
- Existing relevant tests: `test/room.test.js`, `test/redemption.test.js`, and the Playwright setup. Similar implementation: commit `6247f4f` / issue #89 / PR #97, host snapshot restoration.

## Commands and results

- `git fetch origin` — passed
- `git status --short --branch` — clean before branch creation; now clean on `fix/90-redemption-rejoin`
- `gh pr list --state open` — no open PRs
- `gh issue list --state open` — issue #90 is the oldest open actionable issue found
- Claude launch command via `bash ~/.hermes/scripts/claude-lean.sh ...` — stopped with verified 401 OAuth revocation; no files changed, no tests ran

## Next actions

1. Use a fresh Hermes continuation worker because Claude OAuth is revoked. Read this handoff first and validate it against the live tree and issue.
2. Complete the four-phase implementation/review/simplification/security pipeline.
3. Run all gates and refresh graphify after the final edit.
4. Commit, push, open one PR, then let the parent orchestrator verify fail-closed CI, squash-merge, delete the local and remote feature branch, and verify issue #90 is closed.

No secrets or credentials are recorded here.
