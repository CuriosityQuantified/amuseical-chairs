# HANDOFF — issue #95

- Issue: #95 — Used +15s control remains active and silently ignores later clicks
- Job: amuseical-chairs issue-worker cron `bb940d093f22`
- Repository: `CuriosityQuantified/amuseical-chairs`
- Lane owner: this issue-worker job; next worker owns continuation
- Checkout: `/Users/halgorithm/workspaces/games/amuseical-chairs`
- Branch: `feat/issue-95-extend-feedback`
- Open PR: none
- Commit before handoff: `main` was clean at `origin/main`; this handoff is the only change

## Blocker

The Claude Code lean launch stopped before implementation with verified authentication failure:
`401 OAuth access token has been revoked`.
Do not retry Claude Code in this job. Continue with a fresh Hermes worker.

## Issue spec

The host may extend a timed minigame only once, but after the first successful extension the **+15s** button remains active. Further clicks are rejected silently, leaving the host unsure whether the timer changed.

Acceptance criteria:

- Disable or hide **+15s** after the successful extension acknowledgement
- Handle rejected extension acknowledgements with visible non-blocking feedback
- Reset the control for the next timed stage/game
- Add browser coverage for the first and second clicks

Environment: Chromium / macOS; production route `https://amuseical.com/host.html`.

## Work state

- Implementation: not started
- CI changes: not started
- Code review phase: not started
- Code simplification phase: not started
- Security review phase: not started
- Local tests/checks: not run for this issue
- Graph refresh: not run for this issue
- Commit/push/PR: handoff commit only; no implementation PR
- Merge: not started

## Graph findings to verify

Use graphify MCP with explicit `project_path: /Users/halgorithm/workspaces/games/amuseical-chairs` before editing. Relevant nodes and locations:

- `public/js/host.js:216-224`: `#extend-btn` emits `host:extend` and currently discards the acknowledgement.
- `public/js/host.js:232-238`: timed minigame visibility for `#extend-btn`.
- `public/js/host.js:429-501`: host minigame render and `game:extend` countdown resync.
- `public/host.html:55-62`: host control markup.
- `server/sockets.js:362-364`: host-only extension acknowledgement.
- `server/room.js:793-810`: per-game `g.extended = false` reset.
- `server/room.js:969-981`: one-shot server extension and rejected-second-extension error.
- `test/room.test.js:810-945`: existing server extension tests.
- Browser patterns: `tests/e2e/host-rejoin.spec.js`, `tests/e2e/music-skip.spec.js`, `tests/e2e/feedback.spec.js`.

## Required next actions

1. Read `/Users/halgorithm/.hermes/skills/autonomous-ai-agents/autonomous-issue-worker/SKILL.md` and `references/development-pipeline.md`; run `gh issue view 95`; confirm no open PR.
2. Use explicit-project graphify MCP queries and inspect only focused line ranges for large files.
3. Use four separate fresh Claude Agent/Task phases sequentially in the shared checkout: implementation + CI; code review using `/Users/halgorithm/.hermes/skills/mattpocock/code-review/SKILL.md`; code simplification using the installed code-simplifier agent skill or fallback; read-only Claude Security review using the installed skill plus `jobs/scan-changes.md`. Pass the issue and graph findings to each. No parallel phases. No phase commits/pushes/PRs.
4. Reconcile findings. Add browser coverage for first successful extension, second rejected click, visible non-blocking feedback, and reset on the next timed stage. Keep server validation unchanged unless tests prove a defect.
5. Run `npm test`, focused and full `npm run test:e2e` as applicable, `npm run graph`, `npm run check`, and the build/smoke syntax gates from the runbook. Verify the graph lock is fresh.
6. Remove this handoff before the final graph refresh if it is no longer needed; otherwise update it with the new state. Stage tracked graph artifacts. Commit with author `CuriosityQuantified <curiosityquantified@gmail.com>`.
7. Push this branch and create exactly one PR targeting `main` titled `fix #95: Used +15s control remains active and silently ignores later clicks`, with a body that closes #95. Do not merge.
8. If incomplete, update and commit/push this handoff, comment its path on issue #95, and report exact remaining gates. Never use `--continue` or `--resume`.

Use ASD-STE100 Simplified Technical English in plans, prompts, progress notes, handoffs, PR text, and reports. Do not use `accounts/fireworks/*` models. Redact secrets.
