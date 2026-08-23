# HANDOFF — issue #84 Book Bash

- **Issue:** #84 — Create "Book Bash" Game
- **Repository:** CuriosityQuantified/amuseical-chairs
- **Lane owner:** amuseical-chairs issue-worker cron
- **Checkout:** `/Users/halgorithm/workspaces/games/amuseical-chairs`
- **Branch:** `feat/84-book-bash`
- **Base:** `main` at `5b67782`
- **PR:** none
- **Merge owner:** parent Hermes; worker must not merge

## Blocker and current state

The Claude Code launch failed before inference with verified API authentication error:
`401 OAuth access token has been revoked`.
No implementation edits were made by Claude Code. This fresh Hermes continuation owns the remaining work.

## Issue specification

The game is Book Bash. All player characters stand on the lower page of a massive open book. Pages continuously flip and slam down. Each falling page has cut-out holes in shapes such as stars, circles, or triangles. A player survives by positioning the character directly under a matching hole as the page falls. A hit flattens and eliminates the player. Page speed increases over time. Later pages have fewer holes and tighter or trickier shapes. Multiple players may share a hole. The last surviving player wins. If all remaining players are crushed on the final page at the same time, the result is a draw. Players receive points based on final standing.

The GitHub issue body is the binding product specification. Run `gh issue view 84` before implementation and verify the issue is open and has no open PR.

## Required remaining phases

1. Read and follow `/Users/halgorithm/.hermes/skills/autonomous-ai-agents/autonomous-issue-worker/SKILL.md` and its `references/development-pipeline.md`, `references/amuseical-chairs-node-worker.md`, and `references/amuseical-chairs-minigame-addition.md`.
2. Use graphify MCP or the canonical graphify CLI with explicit project path `/Users/halgorithm/workspaces/games/amuseical-chairs` for codebase understanding. Do not read `graphify-out/*` directly. Read large files only by focused `grep -n` and `sed -n 'A,Bp'` ranges.
3. Complete four sequential review phases. Since Claude Code is unavailable, perform fresh equivalent Hermes phases sequentially and record outcomes: implementation + CI; code/spec review; simplification; read-only security review. Do not run phases in parallel.
4. Implement the issue as a real minigame using repository patterns. Add focused Book Bash tests and wire server roster, shared logic if needed, browser client, tutorial, bot harness, roster payload, and CI regression coverage. Avoid scope creep.
5. Reconcile reviews and run all gates: focused tests, `npm test`, `npm run graph`, `npm run check`, syntax checks, `git diff --check`, and server health/page smoke. Ensure tracked graphify outputs are fresh and included.
6. Commit with author `CuriosityQuantified <curiosityquantified@gmail.com>`, push this feature branch, and create exactly one PR targeting `main` with `Closes #84`. Do not merge.
7. Before completion, remove this temporary HANDOFF.md from the final feature diff if it is no longer needed, then refresh graphify after that final edit and include the fresh tracked graph artifacts. If work remains, update this handoff with exact results and ordered next actions, commit/push it, and comment the path on issue #84.

## Exact repository gates

- `npm test` — full Node test suite.
- Regressions include `node --test test/harness.test.js test/roster.test.js` plus the new Book Bash suite and affected suites.
- `npm run graph` — `graphify update . && node scripts/graph-lock.mjs`.
- `npm run check` — static and graph freshness checks.
- Build equivalent: syntax check server/shared/public/js/scripts and boot the server, then curl `/healthz` and the served page.
- Current CI already has build, code-graph, unit, regressions, e2e, and audit jobs. Strengthen the regressions job to run Book Bash coverage.

## Read-only security review contract

Review changed data-flow boundaries for injection/XSS/SSRF/path traversal, IDOR/auth bypass, secrets, unsafe deserialization, dependency risk, and missing validation. Report severity, file:line evidence, exploit path, and remediation. Do not commit security-review-only changes.

Use ASD-STE100 Simplified Technical English in plans, progress notes, handoffs, PR text, and the final report. Keep technical identifiers and required quotations unchanged. Never merge from this branch.
