# Handoff — issue #92

- **Issue:** #92 — Hosted Solo Test omits nine allowed games and exposes inert raw-key toggles
- **Repository:** `CuriosityQuantified/amuseical-chairs`
- **Job/lane owner:** amuseical-chairs issue-worker cron (`bb940d093f22`); fresh Hermes continuation owns this lane
- **Checkout:** `/Users/halgorithm/workspaces/games/amuseical-chairs`
- **Branch:** `feat/issue-92-hosted-solo-test`
- **Base:** `main` at `2d1356b`
- **PR:** none
- **Commits:** handoff commit only; no implementation edits

## Blocker

The Claude Code lean worker stopped after one turn with a verified authentication failure:
`Failed to authenticate. API Error: 401 OAuth access token has been revoked.`
Result metadata: `subtype=success`, `is_error=true`, `api_error_status=401`, `terminal_reason=completed`, `num_turns=1`, `total_cost_usd=0`.
Do not retry Claude Code for this issue in this run. Continue with a fresh Hermes subagent.

## Issue specification

The hosted lobby applies the competitive-game roster filter to the unscored **Solo test** UI, even though issue #67 explicitly preserved those test runs. The same filtering also leaves nine blocked competitive games visible as raw internal-key toggles that appear interactive but cannot change the actual enabled count.

Acceptance criteria:

- Keep the competitive queue filter server-authoritative
- Provide the full display roster to the unscored test UI, or provide separate competitive/test rosters
- Hide or explicitly disable blocked competitive toggles with a human-readable explanation
- Re-render checkbox state from the server response so rejected changes cannot remain visually checked
- Add UI/config regression coverage for all nine blocked keys and all 23 unscored test buttons

Full issue body: `gh issue view 92`.

## Verified repository context

- `server/room.js`: `clientScoredGameAllowed()` at line 50, `publicConfig()` near 545, `updateConfig()` near 556, `startTest()` near 636
- `server/games.js`: `ROSTER` near line 218 and `ROSTER_BY_KEY`
- `public/js/host.js`: `enabledCount()` near 104 and `buildConfigPanel()` near 122
- `server/sockets.js`: `host:config` and `host:test` acknowledgement paths
- Existing related tests: `test/room.test.js` hosted blocking and solo coverage around lines 525–605
- Related history: `8bd51f9 fix #67: block client-scored competitive games and reject pre-green redemption reports (#68)`; later `7c40569 fix #79: rotate reconnect credentials and block metronome competitive scoring (Strix d869) (#80)`
- `package.json`: `npm test`, `npm run check`, `npm run test:e2e`, `npm run graph`
- `.github/workflows/ci.yml` already has named unit, regressions, code-graph, build/smoke, e2e, and audit jobs. Strengthen the issue-area regression coverage without pointless workflow churn.

## Required remaining work

1. Use graphify MCP with explicit `project_path: /Users/halgorithm/workspaces/games/amuseical-chairs` before code changes. Never read `graphify-out/*` directly. Validate graph findings against source.
2. Implement issue #92 test-first. Keep competitive filtering server-authoritative. Make all 23 Solo test buttons use display names and remain available. Hide or clearly disable blocked competitive toggles with a human-readable reason. Re-render checkbox state from the server response after rejected config changes.
3. Add offline UI/config regressions for all nine blocked keys and all 23 test buttons. Use the existing Node test conventions; add a browser regression only if the repository harness supports the required real interaction.
4. Read `/Users/halgorithm/.hermes/skills/mattpocock/code-review/SKILL.md`, the installed code-simplifier agent skill (fallback `/Users/halgorithm/.hermes/skills/mattpocock/code-simplifier/SKILL.md`), and the Claude Security skill plus `jobs/scan-changes.md` and `agents/claude-security.md`. Because Claude API access is blocked, perform equivalent four sequential fresh review phases in this Hermes continuation and record their outcomes: implementation+CI, code review, simplification, read-only security review. No parallel write/review phases.
5. Run `npm test`; `npm run check`; `npm run test:e2e` when Chromium is available; and the CI build/smoke equivalent: syntax check `find server shared public/js scripts -name '*.js' -o -name '*.mjs' | xargs node --check`, boot on `PORT=3111`, then curl `/healthz`, `/`, and `/shared/cups.js`. Stop stale port-3000 servers before browser tests if needed.
6. After the final edit run `npm run graph` and `npm run check`. Stage tracked graphify output. Graph freshness is a hard gate.
7. Remove this handoff from the final implementation commit unless it is needed for an active continuation. Keep the final PR scoped to issue #92.
8. Commit with author `CuriosityQuantified <curiosityquantified@gmail.com>`, push this branch, and create exactly one PR targeting `main` with title `fix #92: Hosted Solo Test omits nine allowed games and exposes inert raw-key toggles`, body containing `Closes #92`, acceptance checklist, tests, graph refresh, and review findings. Do not merge in the continuation.
9. Report exact files, four phase outcomes, commands/results, graph status, commit, and PR URL. Parent orchestrator owns fail-closed CI verification and squash merge.

## Constraints

Use ASD-STE100 Simplified Technical English in plans, prompts, progress notes, handoff, PR text, and final report. Never read large repository files in full; use `grep -n` plus `sed -n 'A,Bp'` ranges for files over about 20 KB. Never use live network in tests. Do not touch other repositories. Do not use `--continue` or `--resume`.

## Next action

Fresh Hermes subagent reads this handoff and `gh issue view 92`, validates the live branch, then completes only the remaining work above.
